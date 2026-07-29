import {addIcon, Notice, Plugin} from 'obsidian';
import Filesystem from "./filesystem";
import issueTrackerIcon from './assets/issue-tracker-icon.svg';
import {GitlabIssuesSettingTab} from "./SettingsTab/settings-tab";
import {GitlabIssuesSettings} from "./SettingsTab/settings-types";
import {normalizeSettings} from "./SettingsTab/settings";
import SyncService, {SyncProgress} from "./Sync/sync-service";
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

		container.style.display = 'grid';
		container.style.gap = '8px';
		container.style.width = '280px';
		container.style.maxWidth = '100%';
		statusRow.style.display = 'flex';
		statusRow.style.alignItems = 'center';
		statusRow.style.gap = '12px';
		status.style.flex = '1';
		status.style.minWidth = '0';
		status.style.overflowWrap = 'anywhere';
		status.textContent = progress.message;
		percent.style.flexShrink = '0';
		percent.textContent = `${progress.percent}%`;
		progressBar.max = 100;
		progressBar.value = progress.percent;
		progressBar.style.width = '100%';
		progressBar.style.height = '8px';
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

	async onload() {
		logger('Starting plugin');

		await this.loadSettings();
		this.addSettingTab(new GitlabIssuesSettingTab(this.app, this));


		if (this.settings.gitlabToken) {
			this.createOutputFolder();
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
				this.fetchFromGitlab();
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
					this.fetchFromGitlab();
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
				this.fetchFromGitlab();
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
				this.fetchFromGitlab();
			}, 30 * 1000);

			this.register(() => window.clearTimeout(timeoutId));
			this.startupTimeout = timeoutId; // after 30 seconds
		}
	}

	private createOutputFolder() {
		const fs = new Filesystem(this.app.vault, this.settings);
		fs.createOutputDirectory();
	}

	private fetchFromGitlab() {
		const progressNotice = new SyncProgressNotice();
		void new SyncService(this.app, this.settings, (progress) => progressNotice.update(progress)).run()
			.then(() => progressNotice.finish())
			.catch((error) => {
				const message = error instanceof Error ? error.message : String(error);
				logger(message);
				progressNotice.fail(message);
			});
	}
}
