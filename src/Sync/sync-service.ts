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
import {buildIssueLedger, IssueLedgerSerialState} from "../Reports/issue-ledger-builder";
import {buildIssueLedgerXlsx} from "../Reports/issue-ledger-xlsx-builder";
import {buildIssueClosureNotice, IssueClosureState} from "../Reports/issue-closure-notice-builder";
import {buildInternalMemberIdentityReview} from "../Reports/internal-member-identity-review-builder";
import {logger} from "../utils/utils";

export type SyncProgressPhase = 'starting' | 'members' | 'issues' | 'issue-files' | 'reports' | 'ledger' | 'closing' | 'complete';

export interface SyncProgress {
	phase: SyncProgressPhase;
	percent: number;
	message: string;
}

export interface SyncRunResult {
	syncStatus: 'success' | 'degraded';
	ledgerWriteFailed: boolean;
}

type LedgerWriteStage = 'prepare' | 'state' | 'csv' | 'xlsx';

const LEDGER_FAILURE_PROGRESS: Record<LedgerWriteStage, Pick<SyncProgress, 'percent' | 'message'>> = {
	prepare: {percent: 82, message: '台账准备失败'},
	state: {percent: 82, message: '台账状态保存失败'},
	csv: {percent: 88, message: 'CSV 台账刷新失败'},
	xlsx: {percent: 96, message: 'Excel 台账刷新失败'},
};

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
	private static readonly RECENT_REPORT_REPAIR_DAYS = 7;

	private readonly fs: Filesystem;
	private readonly loader: GitlabLoader;
	private readonly memberLoader: MemberLoader;

	constructor(
		app: App,
		private readonly settings: GitlabIssuesSettings,
		private readonly onProgress?: (progress: SyncProgress) => void,
	) {
		this.fs = new Filesystem(app.vault, settings);
		this.loader = new GitlabLoader(app, settings);
		this.memberLoader = new MemberLoader(settings);
	}

	async run(): Promise<SyncRunResult> {
		this.reportProgress('starting', 0, '开始同步 Issue');
		const reportDate = new Date().toISOString().slice(0, 10);
		const syncTime = new Date().toISOString();
		const dailyReportsFolder = `${this.settings.reportsFolder}/daily`;
		const dailyBriefsFolder = `${this.settings.reportsFolder}/daily-brief`;
		const previousSyncState = await this.fs.readJson<SyncState>(`${this.settings.metaFolder}/sync-state.json`);
		const warningMessages: string[] = [];
		const repoNames = await this.loader.resolveRepoNames();
		this.reportProgress('members', 5, `已发现 ${repoNames.length} 个仓库，正在同步内部成员`);

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
		this.reportProgress('issues', 12, '正在获取仓库 Issue');

		const normalizedNotes: NormalizedIssueNote[] = [];
		const repoIssueBatches: Array<{repoName: string; issues: Issue[]}> = [];
		const failedRepos: string[] = [];
		const failedRepoSet = new Set<string>();
		let issueStorageFailed = false;
		let hasUnknownClassifications = false;

		for (const [repoIndex, repoName] of repoNames.entries()) {
			const percent = 12 + Math.round((repoIndex / Math.max(repoNames.length, 1)) * 43);
			this.reportProgress('issues', percent, `正在同步 Issue（${repoIndex + 1}/${repoNames.length}）：${repoName}`);
			try {
				const repoIssues = await this.loader.loadRepoIssues(repoName);
				repoIssueBatches.push({repoName, issues: repoIssues});
				if (!hasUnknownClassifications) {
					hasUnknownClassifications = repoIssues.some((issue) => (
						classifyIssue(issue, this.settings.classificationRules).requestKind === 'unknown'
					));
				}
			} catch (error) {
				failedRepos.push(repoName);
				failedRepoSet.add(repoName);
				logger(`Failed to sync ${repoName}: ${this.getErrorMessage(error)}`);
				warningMessages.push(`Failed to sync ${repoName}: ${this.getErrorMessage(error)}`);
			}
		}
		this.reportProgress('issue-files', 55, '正在写入 Issue 文件');

		let existingNotesByKey = new Map<string, NormalizedIssueNote>();
		if (hasUnknownClassifications) {
			const existingIssueNotes = await this.fs.readIssueNotes();
			existingNotesByKey = new Map(
				existingIssueNotes.map((note) => [this.buildIssueKey(note.sourceRepo, note.iid), note]),
			);
		}

		for (const {repoName, issues} of repoIssueBatches) {
			normalizedNotes.push(
				...issues.map((issue) => this.normalizeIssue(issue, repoName, internalMembers, existingNotesByKey)),
			);
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
		let persistedNotes: NormalizedIssueNote[] | null = null;

		if (this.settings.generateDailyReports) {
			this.reportProgress('reports', 68, '正在更新日报和摘要');
			try {
				persistedNotes = await this.fs.readIssueNotes();
				const provisionalStatus: SyncState['syncStatus'] = memberSyncStatus === 'degraded' || repositorySyncStatus === 'degraded'
					? 'degraded'
					: 'success';
				const reportDates = await this.resolveReportDatesToWrite(
					previousSyncState?.lastSuccessfulSyncAt,
					syncTime,
					reportDate,
					dailyReportsFolder,
					dailyBriefsFolder,
				);

				for (const date of reportDates) {
					const report = buildDailyReport(date, persistedNotes, {
						internalMemberDirectory: this.settings.internalMemberDirectory,
						internalUserWhitelist: this.settings.internalUserWhitelist,
					});
					report.syncStatus = provisionalStatus;

					await this.fs.upsertTextFile(
						`${dailyReportsFolder}/${date}.md`,
						buildDailyReportMarkdown(report),
					);
					await this.fs.upsertTextFile(
						`${dailyBriefsFolder}/${date}-brief.md`,
						buildAiBriefMarkdown(report),
					);
				}
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

		let ledgerWriteFailed = false;
		let ledgerWriteStage: LedgerWriteStage = 'prepare';
		let ledgerFailureMessage = '台账刷新失败';
		this.reportProgress('ledger', 82, '正在准备 CSV / Excel 台账');
		try {
			persistedNotes ??= await this.fs.readIssueNotes();
			const previousSerialState = await this.fs.readJson<IssueLedgerSerialState>(
				`${this.settings.metaFolder}/issue-ledger-state.json`,
			);
			const ledger = buildIssueLedger(persistedNotes, {
				internalMemberDirectory: this.settings.internalMemberDirectory,
				internalUserWhitelist: this.settings.internalUserWhitelist,
				startMonth: this.settings.issueLedgerStartMonth,
			}, previousSerialState);

			// Persist allocation first so a CSV write retry cannot assign a different serial.
			ledgerWriteStage = 'state';
			await this.fs.writeJson(`${this.settings.metaFolder}/issue-ledger-state.json`, ledger.serialState);
			ledgerWriteStage = 'csv';
			this.reportProgress('ledger', 88, '正在写入 CSV 台账');
			await this.fs.upsertTextFile(`${this.settings.reportsFolder}/issue-ledger.csv`, ledger.csv);
			ledgerWriteStage = 'xlsx';
			this.reportProgress('ledger', 94, '正在写入 Excel 台账');
			await this.fs.writeBinary(`${this.settings.reportsFolder}/issue-ledger.xlsx`, buildIssueLedgerXlsx(ledger.rows));
			this.reportProgress('ledger', 96, 'Excel 台账已刷新');
		} catch (error) {
			ledgerWriteFailed = true;
			const message = `Failed to write issue ledger: ${this.getErrorMessage(error)}`;
			warningMessages.push(message);
			logger(message);
			const failureProgress = LEDGER_FAILURE_PROGRESS[ledgerWriteStage];
			ledgerFailureMessage = failureProgress.message;
			this.reportProgress('ledger', failureProgress.percent, failureProgress.message);
		}

		if (ledgerWriteFailed) {
			repositorySyncStatus = 'degraded';
		}

		let identityReviewWriteFailed = false;
		try {
			persistedNotes ??= await this.fs.readIssueNotes();
			const identityReview = buildInternalMemberIdentityReview(persistedNotes, {
				internalMemberDirectory: this.settings.internalMemberDirectory,
				startMonth: this.settings.issueLedgerStartMonth,
			});
			await this.fs.upsertTextFile(
				`${this.settings.reportsFolder}/internal-member-identity-review.md`,
				identityReview.markdown,
			);
		} catch (error) {
			identityReviewWriteFailed = true;
			const message = `Failed to write internal member identity review: ${this.getErrorMessage(error)}`;
			warningMessages.push(message);
			logger(message);
		}

		if (identityReviewWriteFailed) {
			repositorySyncStatus = 'degraded';
		}

		let closureNoticeWriteFailed = false;
		this.reportProgress('closing', 98, '正在更新 Issue 关闭提醒');
		try {
			persistedNotes ??= await this.fs.readIssueNotes();
			const previousClosureState = await this.fs.readJson<IssueClosureState>(
				`${this.settings.metaFolder}/issue-closure-state.json`,
			);
			const closureNotice = buildIssueClosureNotice(persistedNotes, previousClosureState, {
				startMonth: this.settings.issueLedgerStartMonth,
			});

			const hadClosedIssues = (previousClosureState?.closedIssueKeys ?? []).length > 0;
			if (closureNotice.currentlyClosed.length > 0 || hadClosedIssues) {
				// Only advance the reminder baseline after the user-visible document is durable.
				await this.fs.upsertTextFile(`${this.settings.reportsFolder}/issue-close-reminders.md`, closureNotice.markdown);
				await this.fs.writeJson(`${this.settings.metaFolder}/issue-closure-state.json`, closureNotice.state);
			}
		} catch (error) {
			closureNoticeWriteFailed = true;
			const message = `Failed to write issue closure reminder: ${this.getErrorMessage(error)}`;
			warningMessages.push(message);
			logger(message);
		}

		if (closureNoticeWriteFailed) {
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

		this.reportProgress(
			'complete',
			100,
			ledgerWriteFailed
				? `同步完成，但 ${ledgerFailureMessage}`
				: syncStatus === 'success'
					? '同步完成，Excel 台账已刷新'
					: '同步完成，但部分任务有异常',
		);

		return {syncStatus, ledgerWriteFailed};
	}

	private reportProgress(phase: SyncProgressPhase, percent: number, message: string) {
		try {
			this.onProgress?.({
				phase,
				percent: Math.max(0, Math.min(100, Math.round(percent))),
				message,
			});
		} catch (error) {
			logger(`Could not report sync progress: ${this.getErrorMessage(error)}`);
		}
	}

	private normalizeIssue(
		issue: Issue,
		repoName: string,
		internalMembers: InternalMemberIndex,
		existingNotesByKey: Map<string, NormalizedIssueNote> = new Map(),
	): NormalizedIssueNote {
		const authorUsername = issue.author?.username ?? issue.user?.login ?? issue.user?.username ?? '';
		const authorName = issue.author?.name ?? issue.user?.name ?? '';
		const iid = this.resolveIssueIid(issue);
		const webUrl = issue.web_url ?? issue.html_url ?? '';
		const projectId = this.resolveProjectId(issue);
		const internalAuthor = matchInternalAuthor(authorUsername, internalMembers);
		const classification = classifyIssue(issue, this.settings.classificationRules);
		const issueKey = this.buildIssueKey(repoName, iid);
		const existingNote = existingNotesByKey.get(issueKey);
		const requestKind = classification.requestKind === 'unknown' && existingNote && existingNote.requestKind !== 'unknown'
			? existingNote.requestKind
			: classification.requestKind;
		const requestKindMatchedBy = classification.requestKindMatchedBy === 'none' && existingNote && existingNote.requestKind !== 'unknown'
			? existingNote.requestKindMatchedBy
			: classification.requestKindMatchedBy;

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
			labels: this.normalizeLabels(issue.labels),
			issueTypeRaw: issue.issue_type ?? '',
			requestKind,
			requestKindMatchedBy,
			referencesFull: this.resolveReferencesFull(issue, repoName),
		};
	}

	private buildIssueKey(repoName: string, iid: number) {
		return `${repoName}#${iid}`;
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

	private resolveProjectId(issue: Issue) {
		if (typeof issue.project_id === 'number') {
			return issue.project_id;
		}

		if (typeof issue.repository?.id === 'number') {
			return issue.repository.id;
		}

		if (typeof issue.repository?.id === 'string') {
			const parsed = Number(issue.repository.id);
			if (Number.isFinite(parsed)) {
				return parsed;
			}
		}

		return 0;
	}

	private normalizeLabels(labels: Issue['labels']) {
		if (Array.isArray(labels)) {
			return labels.map((label) => String(label));
		}

		return Object.keys(labels ?? {});
	}

	private getErrorMessage(error: unknown) {
		return error instanceof Error ? error.message : String(error);
	}

	private resolveReportDates(previousLastSuccessfulSyncAt: string | null | undefined, syncTime: string, fallbackDate: string) {
		const currentDate = this.extractUtcDate(syncTime) ?? fallbackDate;
		const previousDate = this.extractUtcDate(previousLastSuccessfulSyncAt);

		if (!previousDate || previousDate >= currentDate) {
			return [currentDate];
		}

		const dates: string[] = [];
		let cursor = this.addUtcDays(previousDate, 1);

		while (cursor <= currentDate) {
			dates.push(cursor);
			cursor = this.addUtcDays(cursor, 1);
		}

		return dates;
	}

	private async resolveReportDatesToWrite(
		previousLastSuccessfulSyncAt: string | null | undefined,
		syncTime: string,
		fallbackDate: string,
		dailyReportsFolder: string,
		dailyBriefsFolder: string,
	) {
		const scheduledDates = this.resolveReportDates(previousLastSuccessfulSyncAt, syncTime, fallbackDate);
		const currentDate = this.extractUtcDate(syncTime) ?? fallbackDate;
		const repairDates = await this.resolveMissingRecentReportDates(
			dailyReportsFolder,
			dailyBriefsFolder,
			currentDate,
		);

		return Array.from(new Set([...scheduledDates, ...repairDates])).sort();
	}

	private async resolveMissingRecentReportDates(
		dailyReportsFolder: string,
		dailyBriefsFolder: string,
		currentDate: string,
	) {
		const dailyDates = new Set(await this.fs.listMarkdownFileBasenames(dailyReportsFolder));
		const briefDates = new Set(await this.fs.listMarkdownFileBasenames(dailyBriefsFolder));
		const existingDates = Array.from(new Set([...dailyDates, ...briefDates]))
			.filter((date) => /^\d{4}-\d{2}-\d{2}$/.test(date))
			.sort();

		if (existingDates.length === 0) {
			return [];
		}

		const lookbackStartDate = this.addUtcDays(currentDate, -(SyncService.RECENT_REPORT_REPAIR_DAYS - 1));
		const earliestExistingDate = existingDates[0];
		const startDate = earliestExistingDate > lookbackStartDate
			? earliestExistingDate
			: lookbackStartDate;
		const missingDates: string[] = [];
		let cursor = startDate;

		while (cursor <= currentDate) {
			if (!dailyDates.has(cursor) || !briefDates.has(cursor)) {
				missingDates.push(cursor);
			}
			cursor = this.addUtcDays(cursor, 1);
		}

		return missingDates;
	}

	private extractUtcDate(value: string | null | undefined) {
		if (!value) {
			return null;
		}

		const date = new Date(value);
		if (Number.isNaN(date.getTime())) {
			return null;
		}

		return date.toISOString().slice(0, 10);
	}

	private addUtcDays(dateValue: string, days: number) {
		const date = new Date(`${dateValue}T00:00:00.000Z`);
		date.setUTCDate(date.getUTCDate() + days);
		return date.toISOString().slice(0, 10);
	}
}
