import GitlabApi from "./gitlab-api";
import {GitlabIssue} from "./issue";
import {App} from "obsidian";
import Filesystem from "../filesystem";
import {GitCodeOrgRepository, Issue, IssueComment} from "./issue-types";
import {GitlabIssuesSettings} from "../SettingsTab/settings-types";
import {detectGitHost, getGitlabApiVersion} from "../SettingsTab/settings";
import {logger} from "../utils/utils";
import {findFirstOtherPersonResponseAt} from '../Issues/first-response';
import {isInternalIssueAutoReplyComment} from '../Notifications/internal-issue-auto-reply';

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

	getIssueCommentsUrl(repoName: string, issueIid: number) {
		const apiBaseUrl = this.getApiBaseUrl();
		const host = this.getHost();
		const encodedOrgName = encodeURIComponent(this.settings.orgName);
		const encodedRepoName = encodeURIComponent(repoName);

		if (host === 'gitlab' || (host === 'unknown' && this.getApiVersion() === 'v4')) {
			const projectId = encodeURIComponent(`${this.settings.orgName}/${repoName}`);
			return `${apiBaseUrl}/projects/${projectId}/issues/${issueIid}/notes`;
		}

		return `${apiBaseUrl}/repos/${encodedOrgName}/${encodedRepoName}/issues/${issueIid}/comments`;
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

	async loadFirstOtherPersonResponseAt(
		repoName: string,
		issueIid: number,
		issueAuthorUsername: string,
	): Promise<string> {
		const comments = await GitlabApi.loadAllPages<IssueComment>(
			this.getIssueCommentsUrl(repoName, issueIid),
			this.settings.gitlabToken,
		);

		return findFirstOtherPersonResponseAt(issueAuthorUsername, comments
			// Drop the plugin's own auto-reply: it is posted with our token account (not the
			// Issue author), so counting it would report the bot's "已收到" as the first human
			// response and mask real 48h+ responsiveness.
			.filter((comment) => !isInternalIssueAutoReplyComment(comment.body ?? comment.note))
			.map((comment) => ({
				authorUsername: comment.author?.username
					?? comment.author?.login
					?? comment.user?.login
					?? comment.user?.username
					?? '',
				createdAt: comment.created_at ?? '',
				isSystem: Boolean(comment.system),
			})));
	}

	async postIssueComment(repoName: string, issueIid: number, body: string): Promise<void> {
		await GitlabApi.create(
			this.getIssueCommentsUrl(repoName, issueIid),
			this.settings.gitlabToken,
			{body},
		);
	}

	/**
	 * Live pre-post gate for the internal auto-reply: true when anyone other than the Issue
	 * author has already commented (a previous auto-reply marker comment or a real human
	 * response). The locally persisted first-response value can be stale when a comment
	 * backfill was rate-limited, so the delivery decision must be re-verified against the API.
	 */
	async hasOtherPersonComment(repoName: string, issueIid: number, issueAuthorUsername: string): Promise<boolean> {
		const comments = await GitlabApi.loadAllPages<IssueComment>(
			this.getIssueCommentsUrl(repoName, issueIid),
			this.settings.gitlabToken,
		);

		const authorUsername = issueAuthorUsername.trim().toLowerCase();
		return comments.some((comment) => {
			const commenterUsername = (
				comment.author?.username
				?? comment.author?.login
				?? comment.user?.login
				?? comment.user?.username
				?? ''
			).trim().toLowerCase();
			return !comment.system
				&& Boolean(commenterUsername)
				&& commenterUsername !== authorUsername;
		});
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
