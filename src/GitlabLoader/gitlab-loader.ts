import GitlabApi from "./gitlab-api";
import {GitlabIssue} from "./issue";
import {App} from "obsidian";
import Filesystem from "../filesystem";
import {GitCodeOrgRepository, Issue} from "./issue-types";
import {GitlabIssuesSettings} from "../SettingsTab/settings-types";
import {logger} from "../utils/utils";

export default class GitlabLoader {

	private fs: Filesystem;
	private settings: GitlabIssuesSettings;

	constructor(app: App, settings: GitlabIssuesSettings) {
		this.fs = new Filesystem(app.vault, settings);
		this.settings = settings;
	}

	getUrl() {
		const filter = this.settings.issueFilter;

		switch (this.settings.gitlabIssuesLevel) {
			case "project":
				return `${this.settings.gitlabApiUrl()}/projects/${this.settings.gitlabAppId}/issues?${filter}`;
			case "group":
				return `${this.settings.gitlabApiUrl()}/groups/${this.settings.gitlabAppId}/issues?${filter}`;
			case "personal":
			default:
				return `${this.settings.gitlabApiUrl()}/issues?${filter}`;
		}
	}

	getRepoIssuesUrl(repoName: string) {
		const apiBaseUrl = this.settings.apiBaseUrl || this.settings.gitlabApiUrl();
		const encodedOrgName = encodeURIComponent(this.settings.orgName);
		const encodedRepoName = encodeURIComponent(repoName);
		const baseUrl = `${apiBaseUrl}/repos/${encodedOrgName}/${encodedRepoName}/issues`;
		const filter = this.settings.issueFilter.trim();

		return filter ? `${baseUrl}?${encodeURI(filter)}` : baseUrl;
	}

	getOrgReposUrl() {
		const apiBaseUrl = this.settings.apiBaseUrl || this.settings.gitlabApiUrl();
		const encodedOrgName = encodeURIComponent(this.settings.orgName);

		return `${apiBaseUrl}/orgs/${encodedOrgName}/repos`;
	}

	async loadRepoIssues(repoName: string): Promise<Issue[]> {
		return GitlabApi.loadAllPages<Issue>(
			this.getRepoIssuesUrl(repoName),
			this.settings.gitlabToken,
		);
	}

	async loadOrgRepos(): Promise<GitCodeOrgRepository[]> {
		return GitlabApi.loadAllPages<GitCodeOrgRepository>(
			this.getOrgReposUrl(),
			this.settings.gitlabToken,
		);
	}

	async resolveRepoNames(): Promise<string[]> {
		if (!this.settings.syncAllOrgRepos) {
			return this.settings.repoList;
		}

		const repos = await this.loadOrgRepos();

		return Array.from(new Set(
			repos
				.map((repo) => repo.path?.trim() || repo.name?.trim() || '')
				.filter(Boolean),
		));
	}

	loadIssues() {
		GitlabApi.load<Array<Issue>>(encodeURI(this.getUrl()), this.settings.gitlabToken)
			.then((issues: Array<Issue>) => {
				const gitlabIssues = issues.map((rawIssue: Issue) => new GitlabIssue(rawIssue));

				if(this.settings.purgeIssues) {
					this.fs.purgeExistingIssues();
				}
				this.fs.processIssues(gitlabIssues);
			})
			.catch(error => {
				logger(error.message);
			});
	}
}
