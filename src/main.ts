import {addIcon, Notice, Plugin} from 'obsidian';
import Filesystem from "./filesystem";
import issueTrackerIcon from './assets/issue-tracker-icon.svg';
import {GitlabIssuesSettingTab} from "./SettingsTab/settings-tab";
import {GitlabIssuesSettings} from "./SettingsTab/settings-types";
import {normalizeSettings} from "./SettingsTab/settings";
import SyncService, {SyncProgress} from "./Sync/sync-service";
import SingleFlight from './Sync/single-flight';
import GitlabLoader from './GitlabLoader/gitlab-loader';
import {sendFeishuNewIssueNotification, splitFeishuNewIssueBatches} from './Notifications/feishu-notifier';
import {
	formatLocalNewIssueNotification,
	markFeishuIssuesDelivered,
	normalizeIssueNotificationState,
} from './Notifications/new-issue-notifications';
import {
	appendInternalIssueAutoReplyMarker,
	buildInternalIssueAutoReplyMarker,
	formatInternalIssueAutoReply,
	markInternalIssueAutoRepliesDelivered,
	normalizeInternalIssueAutoReplyState,
	InternalIssueAutoReplyCandidate,
} from './Notifications/internal-issue-auto-reply';
import {logger} from "./utils/utils";

class SyncProgressNotice {
	private static readonly FINAL_MESSAGE_DURATION_MS = 5000;
	private readonly notice: Notice;
	private hideTimeout: number | null = null;

	constructor() {
		this.notice = new Notice(this.buildMessage({
			phase: 'starting',
			percent: 0,
			message: '开始同步 Issue',
		}), 0);
	}

	update(progress: SyncProgress) {
		this.clearHideTimeout();
		this.notice.setMessage(this.buildMessage(progress));
	}

	finish() {
		this.scheduleHide();
	}

	fail(message: string) {
		this.update({
			phase: 'complete',
			percent: 100,
			message: `同步失败：${message}`,
		});
		this.scheduleHide();
	}

	private buildMessage(progress: SyncProgress) {
		const fragment = document.createDocumentFragment();
		const container = document.createElement('div');
		const statusRow = document.createElement('div');
		const status = document.createElement('span');
		const percent = document.createElement('strong');
		const progressBar = document.createElement('progress');

		container.addClass('issuetracker-sync-progress');
		statusRow.addClass('issuetracker-sync-progress__status-row');
		status.addClass('issuetracker-sync-progress__status');
		status.textContent = progress.message;
		percent.addClass('issuetracker-sync-progress__percent');
		percent.textContent = `${progress.percent}%`;
		progressBar.max = 100;
		progressBar.value = progress.percent;
		progressBar.addClass('issuetracker-sync-progress__bar');
		progressBar.setAttribute('aria-label', 'IssueTracker 同步进度');

		statusRow.append(status, percent);
		container.append(statusRow, progressBar);
		fragment.append(container);
		return fragment;
	}

	private scheduleHide() {
		this.clearHideTimeout();
		this.hideTimeout = window.setTimeout(() => {
			this.notice.hide();
			this.hideTimeout = null;
		}, SyncProgressNotice.FINAL_MESSAGE_DURATION_MS);
	}

	private clearHideTimeout() {
		if (this.hideTimeout !== null) {
			window.clearTimeout(this.hideTimeout);
			this.hideTimeout = null;
		}
	}
}

export default class GitlabIssuesPlugin extends Plugin {
	settings: GitlabIssuesSettings;
	startupTimeout: number | null = null;
	automaticRefresh: number | null = null;
	iconAdded = false;
	private readonly syncFlight = new SingleFlight<void>();

	async onload() {
		logger('Starting plugin');

		await this.loadSettings();
		this.addSettingTab(new GitlabIssuesSettingTab(this.app, this));


		if (this.settings.gitlabToken) {
			await this.createOutputFolder();
			this.addIconToLeftRibbon();
			this.addCommandToPalette();
			this.refreshIssuesAtStartup();
			this.scheduleAutomaticRefresh();
		}
	}

	scheduleAutomaticRefresh() {
		if (this.automaticRefresh !== null) {
			window.clearInterval(this.automaticRefresh);
			this.automaticRefresh = null;
		}
		if (this.settings.intervalOfRefresh !== "off") {
			const intervalMinutes = parseInt(this.settings.intervalOfRefresh);
			const intervalId = window.setInterval(() => {
				void this.fetchFromGitlab();
			}, intervalMinutes * 60 * 1000);

			this.register(() => window.clearInterval(intervalId));
			this.automaticRefresh = intervalId; // every settings interval in minutes
		}
	}

	onunload() {

	}

	async loadSettings() {
		this.settings = normalizeSettings(await this.loadData());
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}

	private addIconToLeftRibbon() {
		if (this.settings.showIcon) {
			// Ensure we did not already add an icon
			if (!this.iconAdded) {
				addIcon("issue-tracker", issueTrackerIcon);
				this.addRibbonIcon('issue-tracker', 'Sync IssueTracker', (evt: MouseEvent) => {
					void this.fetchFromGitlab();
				});
				this.iconAdded = true;
			}
		}
	}

	private addCommandToPalette() {
		this.addCommand({
			id: 'sync-issue-tracker',
			name: 'Sync IssueTracker',
			callback: () => {
				void this.fetchFromGitlab();
			}
		});
	}

	private refreshIssuesAtStartup() {
		// Clear existing startup timeout
		if (this.startupTimeout !== null) {
			window.clearTimeout(this.startupTimeout);
			this.startupTimeout = null;
		}
		if(this.settings.refreshOnStartup) {
			const timeoutId = window.setTimeout(() => {
				void this.fetchFromGitlab();
			}, 30 * 1000);

			this.register(() => window.clearTimeout(timeoutId));
			this.startupTimeout = timeoutId; // after 30 seconds
		}
	}

	private createOutputFolder(): Promise<void> {
		const fs = new Filesystem(this.app.vault, this.settings);
		return fs.createOutputDirectory();
	}

	private fetchFromGitlab() {
		return this.syncFlight.run(async () => {
			const progressNotice = new SyncProgressNotice();
			try {
				const result = await new SyncService(this.app, this.settings, (progress) => progressNotice.update(progress)).run();
				progressNotice.finish();
				await this.notifyNewIssues(result);
			} catch (error) {
				const message = error instanceof Error ? error.message : String(error);
				logger(message);
				progressNotice.fail(message);
			}
		});
	}

	private async notifyNewIssues(result: Awaited<ReturnType<SyncService['run']>>) {
		if (result.newIssues.length > 0 && this.settings.localNewIssueNotifications) {
			new Notice(formatLocalNewIssueNotification(result.newIssues), 10_000);
		}

		await this.replyToInternalIssues(result.pendingInternalAutoReplyIssues ?? []);

		if (result.pendingFeishuIssues.length === 0) {
			return;
		}

		try {
			for (const batch of splitFeishuNewIssueBatches(result.pendingFeishuIssues)) {
				await sendFeishuNewIssueNotification(this.settings.feishuWebhookUrl, batch);
				await this.markFeishuIssuesDelivered(batch);
			}
		} catch (error) {
			const message = `飞书 Issue 投递或投递记录保存失败：${error instanceof Error ? error.message : String(error)}`;
			logger(message);
			new Notice(message, 10_000);
		}
	}

	private async replyToInternalIssues(issues: InternalIssueAutoReplyCandidate[]) {
		if (!this.settings.internalIssueAutoReplyEnabled || issues.length === 0) {
			return;
		}

		const loader = new GitlabLoader(this.app, this.settings);
		let deliveredCount = 0;
		const failures: string[] = [];
		for (const issue of issues) {
			try {
				const body = formatInternalIssueAutoReply(this.settings.internalIssueAutoReplyTemplate, issue);
				const marker = buildInternalIssueAutoReplyMarker(issue.issueKey);
				if (!await loader.hasIssueCommentContaining(issue.sourceRepo, issue.iid, marker)) {
					await loader.postIssueComment(
						issue.sourceRepo,
						issue.iid,
						appendInternalIssueAutoReplyMarker(body, issue.issueKey),
					);
				}
				await this.markInternalIssueAutoRepliesDelivered([issue]);
				deliveredCount += 1;
			} catch (error) {
				const message = error instanceof Error ? error.message : String(error);
				failures.push(`${issue.issueKey}: ${message}`);
				logger(`内部 Issue 自动回复失败（${issue.issueKey}）：${message}`);
			}
		}

		if (deliveredCount > 0) {
			new Notice(`已自动回复 ${deliveredCount} 条内部 Issue。`, 10_000);
		}
		if (failures.length > 0) {
			new Notice(
				`内部 Issue 自动回复失败 ${failures.length} 条，后续同步会重试：${failures.join('；')}`,
				10_000,
			);
		}
	}

	private async markFeishuIssuesDelivered(issues: Awaited<ReturnType<SyncService['run']>>['pendingFeishuIssues']) {
		const fs = new Filesystem(this.app.vault, this.settings);
		const statePath = `${this.settings.metaFolder}/issue-notification-state.json`;
		const currentState = normalizeIssueNotificationState(await fs.readJson<unknown>(statePath));
		if (!currentState) {
			throw new Error('无法读取飞书投递状态。');
		}
		await fs.writeJson(statePath, markFeishuIssuesDelivered(currentState, issues, new Date().toISOString()));
	}

	private async markInternalIssueAutoRepliesDelivered(issues: InternalIssueAutoReplyCandidate[]) {
		const fs = new Filesystem(this.app.vault, this.settings);
		const statePath = `${this.settings.metaFolder}/internal-issue-auto-reply-state.json`;
		const currentState = normalizeInternalIssueAutoReplyState(await fs.readJson<unknown>(statePath));
		if (!currentState) {
			throw new Error('无法读取内部 Issue 自动回复状态。');
		}
		await fs.writeJson(
			statePath,
			markInternalIssueAutoRepliesDelivered(currentState, issues, new Date().toISOString()),
		);
	}
}
