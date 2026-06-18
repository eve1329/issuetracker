import {App} from "obsidian";
import GitlabLoader from "../GitlabLoader/gitlab-loader";
import {Issue} from "../GitlabLoader/issue-types";
import Filesystem from "../filesystem";
import MemberLoader from "../Members/member-loader";
import {GitlabIssuesSettings} from "../SettingsTab/settings-types";
import {InternalMemberIndex} from "../Members/member-types";
import {classifyIssue, matchInternalAuthor} from "../Classification/classification";
import {NormalizedIssueNote} from "../Issues/issue-note";
import {buildDailyReport, buildDailyReportMarkdown} from "../Reports/daily-report-builder";
import {buildAiBriefMarkdown} from "../Reports/ai-brief-builder";
import {logger} from "../utils/utils";

interface SyncState {
	syncStatus: 'success' | 'degraded';
	failedRepos: string[];
	lastSuccessfulSyncAt: string | null;
	memberSyncStatus?: 'success' | 'degraded';
	repositorySyncStatus?: 'success' | 'degraded';
	warningMessages?: string[];
	memberSyncProgress?: InternalMemberIndex['syncProgress'];
}

export default class SyncService {
	private readonly fs: Filesystem;
	private readonly loader: GitlabLoader;
	private readonly memberLoader: MemberLoader;

	constructor(app: App, private readonly settings: GitlabIssuesSettings) {
		this.fs = new Filesystem(app.vault, settings);
		this.loader = new GitlabLoader(app, settings);
		this.memberLoader = new MemberLoader(settings);
	}

	async run() {
		const reportDate = new Date().toISOString().slice(0, 10);
		const syncTime = new Date().toISOString();
		const dailyReportsFolder = `${this.settings.reportsFolder}/daily`;
		const dailyBriefsFolder = `${this.settings.reportsFolder}/daily-brief`;
		const previousSyncState = await this.fs.readJson<SyncState>(`${this.settings.metaFolder}/sync-state.json`);
		const warningMessages: string[] = [];
		const repoNames = await this.loader.resolveRepoNames();

		await this.fs.ensureFolders([
			this.settings.outputDir,
			this.settings.issuesFolder,
			this.settings.metaFolder,
			dailyReportsFolder,
			dailyBriefsFolder,
		]);

		let memberSyncStatus: NonNullable<SyncState['memberSyncStatus']> = 'success';
		let internalMembers: InternalMemberIndex;
		const previousInternalMembers = await this.fs.readJson<InternalMemberIndex>(`${this.settings.metaFolder}/internal-members.json`);
		try {
			const memberLoadResult = await this.memberLoader.loadInternalMemberIndex(repoNames, previousInternalMembers);
			internalMembers = memberLoadResult.index;
			await this.fs.writeJson(`${this.settings.metaFolder}/internal-members.json`, internalMembers);
			if (
				memberLoadResult.warningMessages.length > 0
				|| (internalMembers.syncProgress?.pendingRepoCount ?? 0) > 0
			) {
				memberSyncStatus = 'degraded';
				warningMessages.push(...memberLoadResult.warningMessages);
				memberLoadResult.warningMessages.forEach((message) => logger(message));
				if ((internalMembers.syncProgress?.pendingRepoCount ?? 0) > 0) {
					const message = `Internal member sync is still catching up: `
						+ `${internalMembers.syncProgress?.successRepoCount ?? 0}/${internalMembers.syncProgress?.totalRepos ?? repoNames.length} repos fetched successfully`;
					warningMessages.push(message);
					logger(message);
				}
			}
		} catch (error) {
			memberSyncStatus = 'degraded';
			const message = `Failed to sync internal members: ${this.getErrorMessage(error)}`;
			warningMessages.push(message);
			logger(message);
			internalMembers = previousInternalMembers ?? {usernames: {}};
		}

		const normalizedNotes: NormalizedIssueNote[] = [];
		const failedRepos: string[] = [];
		const failedRepoSet = new Set<string>();
		let issueStorageFailed = false;

		for (const repoName of repoNames) {
			try {
				const repoIssues = await this.loader.loadRepoIssues(repoName);
				normalizedNotes.push(
					...repoIssues.map((issue) => this.normalizeIssue(issue, repoName, internalMembers)),
				);
			} catch (error) {
				failedRepos.push(repoName);
				failedRepoSet.add(repoName);
				logger(`Failed to sync ${repoName}: ${this.getErrorMessage(error)}`);
				warningMessages.push(`Failed to sync ${repoName}: ${this.getErrorMessage(error)}`);
			}
		}

		if (this.settings.purgeIssues) {
			try {
				const successfulRepos = repoNames.filter((repoName) => !failedRepoSet.has(repoName));
				await this.fs.purgeIssueNotes(successfulRepos);
			} catch (error) {
				issueStorageFailed = true;
				const message = `Failed to purge issue notes: ${this.getErrorMessage(error)}`;
				warningMessages.push(message);
				logger(message);
			}
		}

		const issueWriteFailures = await this.fs.writeIssueNotes(normalizedNotes);
		if (issueWriteFailures.length > 0) {
			issueStorageFailed = true;
			for (const failure of issueWriteFailures) {
				const message = `Failed to persist issue notes: ${failure.path} (${failure.message})`;
				warningMessages.push(message);
				logger(message);
			}
		}

		let repositorySyncStatus: NonNullable<SyncState['repositorySyncStatus']> = failedRepos.length > 0 || issueStorageFailed
			? 'degraded'
			: 'success';
		let reportWriteFailed = false;

		if (this.settings.generateDailyReports) {
			try {
				const persistedNotes = await this.fs.readIssueNotes();
				const provisionalStatus: SyncState['syncStatus'] = memberSyncStatus === 'degraded' || repositorySyncStatus === 'degraded'
					? 'degraded'
					: 'success';
				const report = buildDailyReport(reportDate, persistedNotes);
				report.syncStatus = provisionalStatus;

				await this.fs.upsertTextFile(
					`${dailyReportsFolder}/${reportDate}.md`,
					buildDailyReportMarkdown(report),
				);
				await this.fs.upsertTextFile(
					`${dailyBriefsFolder}/${reportDate}-brief.md`,
					buildAiBriefMarkdown(report),
				);
			} catch (error) {
				reportWriteFailed = true;
				const message = `Failed to write reports: ${this.getErrorMessage(error)}`;
				warningMessages.push(message);
				logger(message);
			}
		}

		if (reportWriteFailed) {
			repositorySyncStatus = 'degraded';
		}

		const syncStatus: SyncState['syncStatus'] = memberSyncStatus === 'degraded'
			|| repositorySyncStatus === 'degraded'
			? 'degraded'
			: 'success';
		const lastSuccessfulSyncAt = syncStatus === 'success'
			? syncTime
			: previousSyncState?.lastSuccessfulSyncAt ?? null;

		await this.fs.writeJson(`${this.settings.metaFolder}/sync-state.json`, {
			syncStatus,
			failedRepos,
			lastSuccessfulSyncAt,
			memberSyncStatus,
			repositorySyncStatus,
			warningMessages,
			memberSyncProgress: internalMembers.syncProgress,
		} as SyncState);
	}

	private normalizeIssue(
		issue: Issue,
		repoName: string,
		internalMembers: InternalMemberIndex,
	): NormalizedIssueNote {
		const authorUsername = issue.author?.username ?? issue.user?.login ?? '';
		const authorName = issue.author?.name ?? issue.user?.name ?? '';
		const iid = this.resolveIssueIid(issue);
		const webUrl = issue.web_url ?? issue.html_url ?? '';
		const projectId = issue.project_id ?? issue.repository?.id ?? 0;
		const internalAuthor = matchInternalAuthor(authorUsername, internalMembers);
		const classification = classifyIssue(issue, this.settings.classificationRules);

		return {
			id: issue.id,
			iid,
			title: issue.title,
			state: issue.state,
			createdAt: issue.created_at,
			updatedAt: issue.updated_at,
			webUrl,
			projectId,
			projectPath: this.resolveProjectPath(issue, repoName),
			sourceScope: this.settings.gitlabIssuesLevel,
			sourceRepo: repoName,
			authorUsername,
			authorName,
			isInternalAuthor: internalAuthor.isInternalAuthor,
			internalMatchedBy: internalAuthor.internalMatchedBy,
			labels: issue.labels,
			issueTypeRaw: issue.issue_type,
			requestKind: classification.requestKind,
			requestKindMatchedBy: classification.requestKindMatchedBy,
			referencesFull: this.resolveReferencesFull(issue, repoName),
		};
	}

	private resolveReferencesFull(issue: Issue, repoName: string) {
		const issueIid = this.resolveIssueIid(issue);

		if (typeof issue.references === 'string') {
			if (issue.references.includes('#')) {
				const [projectPath] = issue.references.split('#');
				if (projectPath.split('/').filter(Boolean).length >= 2) {
					return issue.references;
				}
			}

			if (issue.references.trim().length > 0) {
				return `${this.settings.orgName}/${repoName}#${issueIid}`;
			}

			return `${this.settings.orgName}/${repoName}#${issueIid}`;
		}

		if (issue.references?.full) {
			return issue.references.full;
		}

		if (issue.repository?.full_name) {
			return `${issue.repository.full_name}#${issueIid}`;
		}

		return `${this.settings.orgName}/${repoName}#${issueIid}`;
	}

	private resolveProjectPath(issue: Issue, repoName: string) {
		const referencesFull = this.resolveReferencesFull(issue, repoName);

		if (referencesFull.includes('#')) {
			const projectPath = referencesFull.split('#')[0];
			if (projectPath.trim().length > 0) {
				return projectPath;
			}
		}

		try {
			const issueUrl = issue.web_url ?? issue.html_url;
			if (!issueUrl) {
				throw new Error('Missing issue URL');
			}
			const url = new URL(issueUrl);
			const pathSegments = url.pathname.split('/').filter(Boolean);
			const issuesSegmentIndex = pathSegments.lastIndexOf('issues');

			if (issuesSegmentIndex >= 2) {
				const projectEndIndex = pathSegments[issuesSegmentIndex - 1] === '-'
					? issuesSegmentIndex - 1
					: issuesSegmentIndex;
				const projectSegments = pathSegments.slice(0, projectEndIndex);

				if (projectSegments.length >= 2) {
					return projectSegments.join('/');
				}
			}
		} catch (error) {
			logger(`Could not parse project path for ${repoName}: ${this.getErrorMessage(error)}`);
		}

		return `${this.settings.orgName}/${repoName}`;
	}

	private resolveIssueIid(issue: Issue) {
		if (typeof issue.iid === 'number') {
			return issue.iid;
		}

		const numberValue = issue.number;
		if (typeof numberValue === 'number') {
			return numberValue;
		}

		if (typeof numberValue === 'string') {
			const parsed = Number(numberValue);
			if (Number.isFinite(parsed)) {
				return parsed;
			}
		}

		return issue.id;
	}

	private getErrorMessage(error: unknown) {
		return error instanceof Error ? error.message : String(error);
	}
}
