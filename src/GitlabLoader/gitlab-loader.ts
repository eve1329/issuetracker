import GitlabApi from "./gitlab-api";
import {GitlabIssue} from "./issue";
import {App} from "obsidian";
import Filesystem from "../filesystem";
import {GitCodeOrgRepository, Issue} from "./issue-types";
import {GitlabIssuesSettings} from "../SettingsTab/settings-types";
import {detectGitHost, getGitlabApiVersion} from "../SettingsTab/settings";
import {logger} from "../utils/utils";

export default class GitlabLoader {

	private fs: Filesystem;
	private settings: GitlabIssuesSettings;

	constructor(app: App, settings: GitlabIssuesSettings) {
		this.fs = new Filesystem(app.vault, settings);
		this.settings = settings;
	}

	private getApiBaseUrl() {
		return this.settings.gitlabApiUrl().replace(/\/+$/, '');
	}

	private getApiVersion() {
		return getGitlabApiVersion(this.getApiBaseUrl());
	}

	private getHost() {
		return detectGitHost(this.settings.gitlabUrl, this.settings.apiBaseUrl);
	}

	getUrl() {
		const filter = this.settings.issueFilter;
		const apiBaseUrl = this.getApiBaseUrl();
		const version = this.getApiVersion();

		switch (this.settings.gitlabIssuesLevel) {
			case "project":
				return version === 'v4'
					? `${apiBaseUrl}/projects/${encodeURIComponent(this.settings.gitlabAppId)}/issues?${filter}`
					: `${apiBaseUrl}/projects/${this.settings.gitlabAppId}/issues?${filter}`;
			case "group":
				return version === 'v4'
					? `${apiBaseUrl}/groups/${encodeURIComponent(this.settings.gitlabAppId)}/issues?${filter}`
					: `${apiBaseUrl}/groups/${this.settings.gitlabAppId}/issues?${filter}`;
			case "personal":
			default:
				return `${apiBaseUrl}/issues?${filter}`;
		}
	}

	getRepoIssuesUrl(repoName: string) {
		const apiBaseUrl = this.getApiBaseUrl();
		const version = this.getApiVersion();
		const encodedOrgName = encodeURIComponent(this.settings.orgName);
		const encodedRepoName = encodeURIComponent(repoName);
		const filter = this.getRepoIssueFilter();
		const host = this.getHost();
		let baseUrl: string;

		if (host === 'github' || host === 'gitee') {
			baseUrl = `${apiBaseUrl}/repos/${encodedOrgName}/${encodedRepoName}/issues`;
		} else if (version === 'v4') {
			const projectId = encodeURIComponent(`${this.settings.orgName}/${repoName}`);
			baseUrl = `${apiBaseUrl}/projects/${projectId}/issues`;
		} else {
			baseUrl = `${apiBaseUrl}/repos/${encodedOrgName}/${encodedRepoName}/issues`;
		}

		return `${baseUrl}?${encodeURI(filter)}`;
	}

	private getRepoIssueFilter() {
		let hasState = false;
		const filterParameters = this.settings.issueFilter
			.trim()
			.replace(/^\?/, '')
			.split('&')
			.filter(Boolean)
			.flatMap((parameter) => {
				const rawKey = parameter.split('=', 1)[0];
				let key = rawKey;
				try {
					key = decodeURIComponent(rawKey.replace(/\+/g, ' '));
				} catch {
					// Keep malformed user-provided parameters instead of discarding the filter.
				}

				if (key.toLowerCase() !== 'state') {
					return [parameter];
				}

				if (hasState) {
					return [];
				}

				hasState = true;
				return ['state=all'];
			});

		if (!hasState) {
			filterParameters.push('state=all');
		}

		return filterParameters.join('&');
	}

	getOrgReposUrl() {
		const apiBaseUrl = this.getApiBaseUrl();
		const encodedOrgName = encodeURIComponent(this.settings.orgName);
		const host = this.getHost();

		if (host === 'github') {
			return `${apiBaseUrl}/orgs/${encodedOrgName}/repos`;
		}

		if (host === 'gitee') {
			return `${apiBaseUrl}/orgs/${encodedOrgName}/repos`;
		}

		if (this.getApiVersion() === 'v4') {
			return `${apiBaseUrl}/groups/${encodedOrgName}/projects`;
		}

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
