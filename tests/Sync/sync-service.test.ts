import {App} from "obsidian";
import * as FilesystemModule from "../../src/filesystem";
import * as GitlabLoaderModule from "../../src/GitlabLoader/gitlab-loader";
import * as MemberLoaderModule from "../../src/Members/member-loader";
import SyncService from "../../src/Sync/sync-service";
import {Issue} from "../../src/GitlabLoader/issue-types";
import {GitlabIssuesSettings} from "../../src/SettingsTab/settings-types";
import {normalizeSettings} from "../../src/SettingsTab/settings";
import {InternalMemberIndex} from "../../src/Members/member-types";
import {NormalizedIssueNote} from "../../src/Issues/issue-note";

const mockEnsureFolders = jest.fn();
const mockWriteJson = jest.fn();
const mockWriteIssueNotes = jest.fn();
const mockUpsertTextFile = jest.fn();
const mockReadJson = jest.fn();
const mockReadIssueNotes = jest.fn();
const mockPurgeIssueNotes = jest.fn();
const mockLoadRepoIssues = jest.fn();
const mockLoadInternalMemberIndex = jest.fn();

jest.spyOn(FilesystemModule, "default").mockImplementation(() => ({
	ensureFolders: mockEnsureFolders,
	writeJson: mockWriteJson,
	writeIssueNotes: mockWriteIssueNotes,
	upsertTextFile: mockUpsertTextFile,
	readJson: mockReadJson,
	readIssueNotes: mockReadIssueNotes,
	purgeIssueNotes: mockPurgeIssueNotes,
}) as any);

jest.spyOn(GitlabLoaderModule, "default").mockImplementation(() => ({
	loadRepoIssues: mockLoadRepoIssues,
}) as any);

jest.spyOn(MemberLoaderModule, "default").mockImplementation(() => ({
	loadInternalMemberIndex: mockLoadInternalMemberIndex,
}) as any);

function makeSettings(overrides: Partial<GitlabIssuesSettings> = {}): GitlabIssuesSettings {
	return normalizeSettings({
		gitlabUrl: 'https://gitcode.com',
		apiBaseUrl: 'https://gitcode.com/api/v5',
		gitlabToken: 'test-token',
		gitlabIssuesLevel: 'project',
		orgName: 'CPF-KMP-CMP',
		repoList: ['repo-a'],
		gitlabAppId: '',
		internalUserWhitelist: [],
		classificationRules: {
			titlePrefixes: {
				'[BUG]': 'bug',
				'[需求]': 'requirement',
			},
			labels: {},
		},
		templateFile: 'template.md',
		outputDir: 'GitCode Issues',
		issuesFolder: 'GitCode Issues/issues',
		metaFolder: 'GitCode Issues/meta',
		reportsFolder: 'GitCode Issues/reports',
		issueFilter: '',
		filter: '',
		generateDailyReports: true,
		showIcon: false,
		purgeIssues: false,
		refreshOnStartup: false,
		intervalOfRefresh: 'off',
		...overrides,
	});
}

function makeInternalMemberIndex(): InternalMemberIndex {
	return {
		usernames: {
			dev_a: {
				username: 'dev_a',
				source: 'org',
			},
		},
	};
}

function makeIssue(partial: Partial<Issue> = {}): Issue {
	return {
		id: 123456,
		iid: 78,
		title: '[BUG] 登录失败',
		description: '',
		due_date: '',
		project_id: 1001,
		state: 'opened',
		created_at: '2026-06-17T09:12:00+08:00',
		updated_at: '2026-06-17T10:05:00+08:00',
		web_url: 'https://gitcode.com/CPF-KMP-CMP/repo-a/issues/78',
		references: {
			short: '#78',
			relative: '#78',
			full: 'CPF-KMP-CMP/repo-a#78',
		},
		assignees: [],
		author: {
			avatar_url: '',
			id: 1,
			locked: false,
			name: 'Partner A',
			state: 'active',
			username: 'partner_a',
			web_url: '',
		},
		closed_by: null as any,
		epic: null as any,
		labels: ['P1'],
		upvotes: 0,
		downvotes: 0,
		merge_requests_count: 0,
		user_notes_count: 0,
		imported: false,
		imported_from: '',
		has_tasks: false,
		task_status: '',
		confidential: false,
		discussion_locked: false,
		issue_type: 'issue',
		time_stats: {
			time_estimate: 0,
			total_time_spent: 0,
			human_time_spent: 0,
			human_total_time_spent: 0,
		},
		severity: 'UNKNOWN',
		_links: {
			self: '',
			notes: '',
			award_emoji: '',
			project: '',
			closed_as_duplicate_of: '',
		},
		task_completion_status: {
			count: 0,
			completed_count: 0,
		},
		milestone: null as any,
		...partial,
	};
}

describe('SyncService', () => {
	const mockApp = {vault: {}} as App;

	beforeEach(() => {
		jest.useFakeTimers().setSystemTime(new Date('2026-06-17T12:00:00.000Z'));
		mockEnsureFolders.mockResolvedValue(undefined);
		mockWriteJson.mockResolvedValue(undefined);
		mockWriteIssueNotes.mockResolvedValue([]);
		mockUpsertTextFile.mockResolvedValue(undefined);
		mockReadJson.mockResolvedValue(null);
		mockReadIssueNotes.mockResolvedValue([]);
		mockPurgeIssueNotes.mockResolvedValue(undefined);
		mockLoadInternalMemberIndex.mockResolvedValue(makeInternalMemberIndex());
	});

	afterEach(() => {
		jest.useRealTimers();
		jest.clearAllMocks();
	});

	it('writes meta artifacts, normalized issue notes, daily report, and daily brief for repo sync', async () => {
		const settings = makeSettings({repoList: ['repo-a']});
		mockLoadRepoIssues.mockResolvedValueOnce([
			makeIssue(),
		]);

		await new SyncService(mockApp, settings).run();

		expect(mockEnsureFolders).toHaveBeenCalledWith([
			'GitCode Issues',
			'GitCode Issues/issues',
			'GitCode Issues/meta',
			'GitCode Issues/reports/daily',
			'GitCode Issues/reports/daily-brief',
		]);
		expect(mockWriteJson).toHaveBeenNthCalledWith(
			1,
			'GitCode Issues/meta/internal-members.json',
			makeInternalMemberIndex(),
		);
		expect(mockLoadRepoIssues).toHaveBeenCalledWith('repo-a');
		expect(mockWriteIssueNotes).toHaveBeenCalledWith([
			expect.objectContaining<Partial<NormalizedIssueNote>>({
				id: 123456,
				iid: 78,
				title: '[BUG] 登录失败',
				projectPath: 'CPF-KMP-CMP/repo-a',
				sourceScope: 'project',
				sourceRepo: 'repo-a',
				authorUsername: 'partner_a',
				authorName: 'Partner A',
				isInternalAuthor: false,
				internalMatchedBy: 'none',
				requestKind: 'bug',
				requestKindMatchedBy: 'title-prefix',
				referencesFull: 'CPF-KMP-CMP/repo-a#78',
			}),
		]);
		expect(mockUpsertTextFile).toHaveBeenNthCalledWith(
			1,
			'GitCode Issues/reports/daily/2026-06-17.md',
			expect.stringContaining('syncStatus: success'),
		);
		expect(mockUpsertTextFile).toHaveBeenNthCalledWith(
			2,
			'GitCode Issues/reports/daily-brief/2026-06-17-brief.md',
			expect.stringContaining('# GitCode Issue Daily Brief - 2026-06-17'),
		);
		expect(mockWriteJson).toHaveBeenNthCalledWith(
			2,
			'GitCode Issues/meta/sync-state.json',
			expect.objectContaining({
				syncStatus: 'success',
				failedRepos: [],
				lastSuccessfulSyncAt: '2026-06-17T12:00:00.000Z',
				memberSyncStatus: 'success',
				repositorySyncStatus: 'success',
			}),
		);
	});

	it('keeps syncing remaining repos and marks outputs degraded when one repo fails', async () => {
		const settings = makeSettings({repoList: ['repo-a', 'repo-b']});
		mockReadJson.mockResolvedValueOnce({
			syncStatus: 'success',
			failedRepos: [],
			lastSuccessfulSyncAt: '2026-06-16T12:00:00.000Z',
		});
		mockLoadRepoIssues
			.mockResolvedValueOnce([
				makeIssue({
					iid: 79,
					web_url: 'https://gitcode.com/CPF-KMP-CMP/repo-a/issues/79',
					references: {
						short: '#79',
						relative: '#79',
						full: 'CPF-KMP-CMP/repo-a#79',
					},
				}),
			])
			.mockRejectedValueOnce(new Error('repo-b failed'));

		await new SyncService(mockApp, settings).run();

		expect(mockLoadRepoIssues).toHaveBeenNthCalledWith(1, 'repo-a');
		expect(mockLoadRepoIssues).toHaveBeenNthCalledWith(2, 'repo-b');
		expect(mockWriteIssueNotes).toHaveBeenCalledWith([
			expect.objectContaining({sourceRepo: 'repo-a'}),
		]);
		expect(mockUpsertTextFile).toHaveBeenNthCalledWith(
			1,
			'GitCode Issues/reports/daily/2026-06-17.md',
			expect.stringContaining('syncStatus: degraded'),
		);
		expect(mockUpsertTextFile).toHaveBeenNthCalledWith(
			2,
			'GitCode Issues/reports/daily-brief/2026-06-17-brief.md',
			expect.any(String),
		);
		expect(mockWriteJson).toHaveBeenNthCalledWith(
			2,
			'GitCode Issues/meta/sync-state.json',
			expect.objectContaining({
				syncStatus: 'degraded',
				failedRepos: ['repo-b'],
				lastSuccessfulSyncAt: '2026-06-16T12:00:00.000Z',
				repositorySyncStatus: 'degraded',
			}),
		);
	});

	it('falls back to cached internal members when member sync fails and still syncs repos as degraded', async () => {
		const settings = makeSettings({repoList: ['repo-a']});
		mockLoadInternalMemberIndex.mockRejectedValueOnce(new Error('members failed'));
		mockReadJson.mockImplementation(async (path: string) => {
			if (path === 'GitCode Issues/meta/sync-state.json') {
				return null;
			}

			if (path === 'GitCode Issues/meta/internal-members.json') {
				return {
					usernames: {
						dev_a: {
							username: 'dev_a',
							source: 'org',
						},
					},
				};
			}

			return null;
		});
		mockLoadRepoIssues.mockResolvedValueOnce([
			makeIssue({
				author: {
					avatar_url: '',
					id: 2,
					locked: false,
					name: 'Dev A',
					state: 'active',
					username: 'dev_a',
					web_url: '',
				},
			}),
		]);

		await new SyncService(mockApp, settings).run();

		expect(mockReadJson).toHaveBeenNthCalledWith(1, 'GitCode Issues/meta/sync-state.json');
		expect(mockReadJson).toHaveBeenCalledWith('GitCode Issues/meta/internal-members.json');
		expect(mockLoadRepoIssues).toHaveBeenCalledWith('repo-a');
		expect(mockWriteIssueNotes).toHaveBeenCalledWith([
			expect.objectContaining({isInternalAuthor: true, internalMatchedBy: 'org'}),
		]);
		expect(mockWriteJson).toHaveBeenLastCalledWith(
			'GitCode Issues/meta/sync-state.json',
			expect.objectContaining({
				syncStatus: 'degraded',
				failedRepos: [],
				memberSyncStatus: 'degraded',
			}),
		);
	});

	it('keeps stale notes from failed repos in degraded daily reports', async () => {
		const settings = makeSettings({repoList: ['repo-a', 'repo-b']});
		mockLoadRepoIssues
			.mockResolvedValueOnce([
				makeIssue({
					iid: 79,
					title: '[BUG] 新问题',
					web_url: 'https://gitcode.com/CPF-KMP-CMP/repo-a/issues/79',
					references: {
						short: '#79',
						relative: '#79',
						full: 'CPF-KMP-CMP/repo-a#79',
					},
				}),
			])
			.mockRejectedValueOnce(new Error('repo-b failed'));
		mockReadIssueNotes.mockResolvedValueOnce([
			{
				id: 222,
				iid: 15,
				title: '[需求] 老需求',
				state: 'opened',
				createdAt: '2026-06-17T07:00:00+08:00',
				updatedAt: '2026-06-17T07:00:00+08:00',
				webUrl: 'https://gitcode.com/CPF-KMP-CMP/repo-b/issues/15',
				projectId: 1002,
				projectPath: 'CPF-KMP-CMP/repo-b',
				sourceScope: 'project',
				sourceRepo: 'repo-b',
				authorUsername: 'partner_b',
				authorName: 'Partner B',
				isInternalAuthor: false,
				internalMatchedBy: 'none',
				labels: [],
				issueTypeRaw: 'issue',
				requestKind: 'requirement',
				requestKindMatchedBy: 'title-prefix',
				referencesFull: 'CPF-KMP-CMP/repo-b#15',
			},
		]);
		mockReadJson.mockResolvedValueOnce({
			syncStatus: 'success',
			failedRepos: [],
			lastSuccessfulSyncAt: '2026-06-16T12:00:00.000Z',
		});

		await new SyncService(mockApp, settings).run();

		expect(mockReadIssueNotes).toHaveBeenCalledWith();
		expect(mockUpsertTextFile).toHaveBeenNthCalledWith(
			1,
			'GitCode Issues/reports/daily/2026-06-17.md',
			expect.stringContaining('- repo-b #15: [需求] 老需求'),
		);
	});

	it('preserves the previous lastSuccessfulSyncAt value on degraded syncs', async () => {
		const settings = makeSettings({repoList: ['repo-a', 'repo-b']});
		mockLoadRepoIssues
			.mockResolvedValueOnce([makeIssue()])
			.mockRejectedValueOnce(new Error('repo-b failed'));
		mockReadJson.mockResolvedValueOnce({
			syncStatus: 'success',
			failedRepos: [],
			lastSuccessfulSyncAt: '2026-06-16T12:00:00.000Z',
		});

		await new SyncService(mockApp, settings).run();

		expect(mockWriteJson).toHaveBeenLastCalledWith(
			'GitCode Issues/meta/sync-state.json',
			expect.objectContaining({
				syncStatus: 'degraded',
				lastSuccessfulSyncAt: '2026-06-16T12:00:00.000Z',
			}),
		);
	});

	it('purges issue notes before rewriting when purgeIssues is enabled', async () => {
		const settings = makeSettings({repoList: ['repo-a'], purgeIssues: true});
		mockLoadRepoIssues.mockResolvedValueOnce([makeIssue()]);

		await new SyncService(mockApp, settings).run();

		expect(mockPurgeIssueNotes).toHaveBeenCalled();
	});

	it('falls back to the issue URL when references is only a short string', async () => {
		const settings = makeSettings({repoList: ['repo-a']});
		mockLoadRepoIssues.mockResolvedValueOnce([
			makeIssue({
				references: '#78',
			}),
		]);

		await new SyncService(mockApp, settings).run();

		expect(mockWriteIssueNotes).toHaveBeenCalledWith([
			expect.objectContaining({
				projectPath: 'CPF-KMP-CMP/repo-a',
				referencesFull: 'CPF-KMP-CMP/repo-a#78',
			}),
		]);
	});

	it('still writes degraded sync-state when report generation fails after issue sync', async () => {
		const settings = makeSettings({repoList: ['repo-a']});
		mockLoadRepoIssues.mockResolvedValueOnce([makeIssue()]);
		mockReadJson.mockResolvedValueOnce({
			syncStatus: 'success',
			failedRepos: [],
			lastSuccessfulSyncAt: '2026-06-16T12:00:00.000Z',
		});
		mockUpsertTextFile
			.mockResolvedValueOnce(undefined)
			.mockRejectedValueOnce(new Error('report write failed'));

		await new SyncService(mockApp, settings).run();

		expect(mockWriteIssueNotes).toHaveBeenCalled();
		expect(mockWriteJson).toHaveBeenLastCalledWith(
			'GitCode Issues/meta/sync-state.json',
			expect.objectContaining({
				syncStatus: 'degraded',
				lastSuccessfulSyncAt: '2026-06-16T12:00:00.000Z',
			}),
		);
	});

	it('marks sync degraded and still writes reports/state when some issue notes fail to persist', async () => {
		const settings = makeSettings({repoList: ['repo-a']});
		mockLoadRepoIssues.mockResolvedValueOnce([makeIssue()]);
		mockWriteIssueNotes.mockResolvedValueOnce([
			{
				path: 'GitCode Issues/issues/CPF-KMP-CMP__repo-a__78.md',
				message: 'disk full',
			},
		]);
		mockReadIssueNotes.mockResolvedValueOnce([
			{
				id: 123456,
				iid: 78,
				title: '[BUG] 登录失败',
				state: 'opened',
				createdAt: '2026-06-17T09:12:00+08:00',
				updatedAt: '2026-06-17T10:05:00+08:00',
				webUrl: 'https://gitcode.com/CPF-KMP-CMP/repo-a/issues/78',
				projectId: 1001,
				projectPath: 'CPF-KMP-CMP/repo-a',
				sourceScope: 'project',
				sourceRepo: 'repo-a',
				authorUsername: 'partner_a',
				authorName: 'Partner A',
				isInternalAuthor: false,
				internalMatchedBy: 'none',
				labels: ['P1'],
				issueTypeRaw: 'issue',
				requestKind: 'bug',
				requestKindMatchedBy: 'title-prefix',
				referencesFull: 'CPF-KMP-CMP/repo-a#78',
			},
		]);
		mockReadJson.mockResolvedValueOnce({
			syncStatus: 'success',
			failedRepos: [],
			lastSuccessfulSyncAt: '2026-06-16T12:00:00.000Z',
		});

		await new SyncService(mockApp, settings).run();

		expect(mockUpsertTextFile).toHaveBeenNthCalledWith(
			1,
			'GitCode Issues/reports/daily/2026-06-17.md',
			expect.stringContaining('- repo-a #78: [BUG] 登录失败'),
		);
		expect(mockWriteJson).toHaveBeenLastCalledWith(
			'GitCode Issues/meta/sync-state.json',
			expect.objectContaining({
				syncStatus: 'degraded',
				repositorySyncStatus: 'degraded',
				lastSuccessfulSyncAt: '2026-06-16T12:00:00.000Z',
				warningMessages: expect.arrayContaining([
					expect.stringContaining('Failed to persist issue notes'),
				]),
			}),
		);
	});

	it('falls back to org and repo when references only contain a short repo fragment', async () => {
		const settings = makeSettings({repoList: ['repo-a']});
		mockLoadRepoIssues.mockResolvedValueOnce([
			makeIssue({
				references: 'repo-a#78',
			}),
		]);

		await new SyncService(mockApp, settings).run();

		expect(mockWriteIssueNotes).toHaveBeenCalledWith([
			expect.objectContaining({
				projectPath: 'CPF-KMP-CMP/repo-a',
				referencesFull: 'CPF-KMP-CMP/repo-a#78',
			}),
		]);
	});
});
