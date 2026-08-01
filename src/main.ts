import {addIcon, Notice, Plugin} from 'obsidian';
import Filesystem from "./filesystem";
import issueTrackerIcon from './assets/issue-tracker-icon.svg';
import {GitlabIssuesSettingTab} from "./SettingsTab/settings-tab";
import {GitlabIssuesSettings} from "./SettingsTab/settings-types";
import {normalizeSettings} from "./SettingsTab/settings";
import SyncService, {SyncProgress} from "./Sync/sync-service";
import SingleFlight from './Sync/single-flight';
import {sendFeishuNewIssueNotification} from './Notifications/feishu-notifier';
import {formatLocalNewIssueNotification} from './Notifications/new-issue-notifications';
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
				await this.notifyNewIssues(result.newIssues);
			} catch (error) {
				const message = error instanceof Error ? error.message : String(error);
				logger(message);
				progressNotice.fail(message);
			}
		});
	}

	private async notifyNewIssues(newIssues: Awaited<ReturnType<SyncService['run']>>['newIssues']) {
		if (newIssues.length === 0) {
			return;
		}

		if (this.settings.localNewIssueNotifications) {
			new Notice(formatLocalNewIssueNotification(newIssues), 10_000);
		}

		try {
			await sendFeishuNewIssueNotification(this.settings.feishuWebhookUrl, newIssues);
		} catch (error) {
			const message = `飞书新增 Issue 通知发送失败：${error instanceof Error ? error.message : String(error)}`;
			logger(message);
			new Notice(message, 10_000);
		}
	}
}
