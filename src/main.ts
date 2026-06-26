import {addIcon, Notice, Plugin} from 'obsidian';
import Filesystem from "./filesystem";
import issueTrackerIcon from './assets/issue-tracker-icon.svg';
import {GitlabIssuesSettingTab} from "./SettingsTab/settings-tab";
import {GitlabIssuesSettings} from "./SettingsTab/settings-types";
import {normalizeSettings} from "./SettingsTab/settings";
import SyncService from "./Sync/sync-service";
import {logger} from "./utils/utils";

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
		new Notice('Updating issues from supported hosts');
		void new SyncService(this.app, this.settings).run()
			.catch((error) => logger(error instanceof Error ? error.message : String(error)));
	}
}
