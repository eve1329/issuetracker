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
const mockResolveRepoNames = jest.fn();

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
	resolveRepoNames: mockResolveRepoNames,
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
		syncAllOrgRepos: false,
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

function makeInternalMemberLoadResult(overrides: Partial<{index: InternalMemberIndex; warningMessages: string[]}> = {}) {
	return {
		index: makeInternalMemberIndex(),
		warningMessages: [],
		...overrides,
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

function makeGitCodeIssue(partial: Partial<Issue> = {}): Issue {
	return {
		id: 4102300,
		number: '76',
		state: 'open',
		title: '[需求] 添加侧边栏容器用户手册',
		description: '添加侧边栏容器用户手册',
		created_at: '2026-06-17T19:07:15+08:00',
		updated_at: '2026-06-17T19:07:15+08:00',
		html_url: 'https://gitcode.com/CPF-KMP-CMP/docs/issues/76',
		labels: [],
		user: {
			id: 2,
			login: 'bearboyxp',
			name: 'hid72949189',
			avatar_url: '',
			html_url: 'https://gitcode.com/bearboyxp',
		},
		repository: {
			id: 9384224,
			full_name: 'CPF-KMP-CMP/docs',
			path: 'docs',
			name: 'docs',
		},
		issue_type: 'issue',
		...partial,
	} as Issue;
}

describe('SyncService', () => {
	const mockApp = {vault: {}} as App;

	beforeEach(() => {
		jest.useFakeTimers().setSystemTime(new Date('2026-06-17T12:00:00.000Z'));
		mockEnsureFolders.mockReset();
		mockWriteJson.mockReset();
		mockWriteIssueNotes.mockReset();
		mockUpsertTextFile.mockReset();
		mockReadJson.mockReset();
		mockReadIssueNotes.mockReset();
		mockPurgeIssueNotes.mockReset();
		mockLoadRepoIssues.mockReset();
		mockLoadInternalMemberIndex.mockReset();
		mockResolveRepoNames.mockReset();
		mockEnsureFolders.mockResolvedValue(undefined);
		mockWriteJson.mockResolvedValue(undefined);
		mockWriteIssueNotes.mockResolvedValue([]);
		mockUpsertTextFile.mockResolvedValue(undefined);
		mockReadJson.mockResolvedValue(null);
		mockReadIssueNotes.mockResolvedValue([]);
		mockPurgeIssueNotes.mockResolvedValue(undefined);
		mockLoadInternalMemberIndex.mockResolvedValue(makeInternalMemberLoadResult());
		mockResolveRepoNames.mockImplementation(async () => ['repo-a']);
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
				memberSyncProgress: undefined,
			}),
		);
	});

	it('keeps syncing remaining repos and marks outputs degraded when one repo fails', async () => {
		const settings = makeSettings({repoList: ['repo-a', 'repo-b']});
		mockResolveRepoNames.mockResolvedValueOnce(['repo-a', 'repo-b']);
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
		mockResolveRepoNames.mockResolvedValueOnce(['repo-a']);
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

	it('uses repo collaborator matches without degrading sync when collaborator loading succeeds', async () => {
		const settings = makeSettings({repoList: ['docs']});
		mockResolveRepoNames.mockResolvedValueOnce(['docs']);
		mockLoadInternalMemberIndex.mockResolvedValueOnce(
			makeInternalMemberLoadResult({
				index: {
					usernames: {
						openharmony_ci: {
							username: 'openharmony_ci',
							source: 'repo',
							repo: 'docs',
						},
					},
				},
				warningMessages: [],
			}),
		);
		mockLoadRepoIssues.mockResolvedValueOnce([
			makeGitCodeIssue({
				title: '[BUG] 内部成员提的缺陷',
				user: {
					id: 2,
					login: 'openharmony_ci',
					name: 'openharmony_ci',
					avatar_url: '',
					html_url: 'https://gitcode.com/openharmony_ci',
				},
			}),
		]);

		await new SyncService(mockApp, settings).run();

		expect(mockWriteJson).toHaveBeenNthCalledWith(
			1,
			'GitCode Issues/meta/internal-members.json',
			expect.objectContaining({
				usernames: expect.objectContaining({
					openharmony_ci: expect.objectContaining({
						source: 'repo',
						repo: 'docs',
					}),
				}),
			}),
		);
		expect(mockWriteIssueNotes).toHaveBeenCalledWith([
			expect.objectContaining<Partial<NormalizedIssueNote>>({
				authorUsername: 'openharmony_ci',
				isInternalAuthor: true,
				internalMatchedBy: 'repo',
			}),
		]);
		expect(mockWriteJson).toHaveBeenLastCalledWith(
			'GitCode Issues/meta/sync-state.json',
			expect.objectContaining({
				syncStatus: 'success',
				memberSyncStatus: 'success',
				repositorySyncStatus: 'success',
				warningMessages: [],
			}),
		);
	});

	it('keeps stale notes from failed repos in degraded daily reports', async () => {
		const settings = makeSettings({repoList: ['repo-a', 'repo-b']});
		mockResolveRepoNames.mockResolvedValueOnce(['repo-a', 'repo-b']);
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

	it('uses persisted issue notes when generating the daily report', async () => {
		const settings = makeSettings({repoList: ['repo-a']});
		mockResolveRepoNames.mockResolvedValueOnce(['repo-a']);
		mockLoadRepoIssues.mockResolvedValueOnce([
			makeIssue({
				title: '[BUG] 当前同步结果',
			}),
		]);
		mockReadIssueNotes.mockResolvedValueOnce([
			{
				id: 222,
				iid: 15,
				title: '[需求] 持久化日报条目',
				state: 'opened',
				createdAt: '2026-06-17T07:00:00+08:00',
				updatedAt: '2026-06-17T07:00:00+08:00',
				webUrl: 'https://gitcode.com/CPF-KMP-CMP/repo-a/issues/15',
				projectId: 1001,
				projectPath: 'CPF-KMP-CMP/repo-a',
				sourceScope: 'project',
				sourceRepo: 'repo-a',
				authorUsername: 'partner_a',
				authorName: 'Partner A',
				isInternalAuthor: false,
				internalMatchedBy: 'none',
				labels: [],
				issueTypeRaw: 'issue',
				requestKind: 'requirement',
				requestKindMatchedBy: 'title-prefix',
				referencesFull: 'CPF-KMP-CMP/repo-a#15',
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
			expect.stringContaining('- repo-a #15: [需求] 持久化日报条目'),
		);
	});

	it('continues syncing repos and marks member sync degraded when collaborator loading returns warnings', async () => {
		const settings = makeSettings({repoList: ['repo-a', 'repo-b']});
		mockResolveRepoNames.mockResolvedValueOnce(['repo-a', 'repo-b']);
		mockLoadInternalMemberIndex.mockResolvedValueOnce(
			makeInternalMemberLoadResult({
				index: {
					usernames: {
						dev_b: {
							username: 'dev_b',
							source: 'repo',
							repo: 'repo-b',
						},
					},
				},
				warningMessages: [
					'Failed to sync repo collaborators for repo-a: 403 Forbidden - Unauthorized access',
				],
			}),
		);
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
			.mockResolvedValueOnce([
				makeIssue({
					iid: 80,
					web_url: 'https://gitcode.com/CPF-KMP-CMP/repo-b/issues/80',
					references: {
						short: '#80',
						relative: '#80',
						full: 'CPF-KMP-CMP/repo-b#80',
					},
					author: {
						avatar_url: '',
						id: 2,
						locked: false,
						name: 'Dev B',
						state: 'active',
						username: 'dev_b',
						web_url: '',
					},
				}),
			]);

		await new SyncService(mockApp, settings).run();

		expect(mockLoadInternalMemberIndex).toHaveBeenCalledWith(['repo-a', 'repo-b'], null);
		expect(mockLoadRepoIssues).toHaveBeenNthCalledWith(1, 'repo-a');
		expect(mockLoadRepoIssues).toHaveBeenNthCalledWith(2, 'repo-b');
		expect(mockWriteIssueNotes).toHaveBeenCalledWith(
			expect.arrayContaining([
				expect.objectContaining({sourceRepo: 'repo-a'}),
				expect.objectContaining({sourceRepo: 'repo-b', isInternalAuthor: true, internalMatchedBy: 'repo'}),
			]),
		);
		expect(mockWriteJson).toHaveBeenLastCalledWith(
			'GitCode Issues/meta/sync-state.json',
			expect.objectContaining({
				syncStatus: 'degraded',
				memberSyncStatus: 'degraded',
				repositorySyncStatus: 'success',
				warningMessages: expect.arrayContaining([
					'Failed to sync repo collaborators for repo-a: 403 Forbidden - Unauthorized access',
				]),
			}),
		);
	});

	it('passes the cached internal member index into the incremental member sync and persists sync progress', async () => {
		const settings = makeSettings({repoList: ['repo-a', 'repo-b']});
		const cachedIndex: InternalMemberIndex = {
			usernames: {
				dev_a: {username: 'dev_a', source: 'repo', repo: 'repo-a'},
			},
			repoMembers: {
				'repo-a': ['dev_a'],
			},
			repoSyncState: {
				'repo-a': {status: 'success', lastSuccessAt: '2026-06-17T12:00:00.000Z'},
			},
		};
		mockResolveRepoNames.mockResolvedValueOnce(['repo-a', 'repo-b']);
		mockReadJson.mockImplementation(async (path: string) => {
			if (path === 'GitCode Issues/meta/sync-state.json') {
				return null;
			}

			if (path === 'GitCode Issues/meta/internal-members.json') {
				return cachedIndex;
			}

			return null;
		});
		mockLoadInternalMemberIndex.mockResolvedValueOnce(
			makeInternalMemberLoadResult({
				index: {
					...cachedIndex,
					usernames: {
						dev_a: {username: 'dev_a', source: 'repo', repo: 'repo-a'},
						dev_b: {username: 'dev_b', source: 'repo', repo: 'repo-b'},
					},
					repoMembers: {
						'repo-a': ['dev_a'],
						'repo-b': ['dev_b'],
					},
					repoSyncState: {
						'repo-a': {status: 'success', lastSuccessAt: '2026-06-17T12:00:00.000Z'},
						'repo-b': {status: 'success', lastSuccessAt: '2026-06-17T12:05:00.000Z'},
					},
					syncProgress: {
						totalRepos: 2,
						cachedRepoCount: 2,
						successRepoCount: 2,
						forbiddenRepoCount: 0,
						rateLimitedRepoCount: 0,
						errorRepoCount: 0,
						pendingRepoCount: 0,
						attemptedReposThisRun: ['repo-b'],
					},
				},
			}),
		);
		mockLoadRepoIssues.mockResolvedValue([makeIssue()]);

		await new SyncService(mockApp, settings).run();

		expect(mockReadJson).toHaveBeenCalledWith('GitCode Issues/meta/internal-members.json');
		expect(mockLoadInternalMemberIndex).toHaveBeenCalledWith(['repo-a', 'repo-b'], cachedIndex);
		expect(mockWriteJson).toHaveBeenLastCalledWith(
			'GitCode Issues/meta/sync-state.json',
			expect.objectContaining({
				memberSyncProgress: {
					totalRepos: 2,
					cachedRepoCount: 2,
					successRepoCount: 2,
					forbiddenRepoCount: 0,
					rateLimitedRepoCount: 0,
					errorRepoCount: 0,
					pendingRepoCount: 0,
					attemptedReposThisRun: ['repo-b'],
				},
			}),
		);
	});

	it('preserves the previous lastSuccessfulSyncAt value on degraded syncs', async () => {
		const settings = makeSettings({repoList: ['repo-a', 'repo-b']});
		mockResolveRepoNames.mockResolvedValueOnce(['repo-a', 'repo-b']);
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

	it('marks sync degraded when purging issue notes fails', async () => {
		const settings = makeSettings({repoList: ['repo-a'], purgeIssues: true});
		mockLoadRepoIssues.mockResolvedValueOnce([makeIssue()]);
		mockPurgeIssueNotes.mockRejectedValueOnce(new Error('purge failed'));
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
				repositorySyncStatus: 'degraded',
				lastSuccessfulSyncAt: '2026-06-16T12:00:00.000Z',
				warningMessages: expect.arrayContaining([
					expect.stringContaining('Failed to purge issue notes: purge failed'),
				]),
			}),
		);
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

	it('normalizes GitCode repo issues that use number html_url user and repository fields', async () => {
		const settings = makeSettings({
			repoList: ['docs'],
			classificationRules: {
				titlePrefixes: {
					'[需求]': 'requirement',
				},
				labels: {},
			},
		});
		mockResolveRepoNames.mockResolvedValueOnce(['docs']);
		mockLoadRepoIssues.mockResolvedValueOnce([
			makeGitCodeIssue(),
		]);
		mockReadIssueNotes.mockResolvedValueOnce([
			{
				id: 4102300,
				iid: 76,
				title: '[需求] 添加侧边栏容器用户手册',
				state: 'open',
				createdAt: '2026-06-17T19:07:15+08:00',
				updatedAt: '2026-06-17T19:07:15+08:00',
				webUrl: 'https://gitcode.com/CPF-KMP-CMP/docs/issues/76',
				projectId: 9384224,
				projectPath: 'CPF-KMP-CMP/docs',
				sourceScope: 'project',
				sourceRepo: 'docs',
				authorUsername: 'bearboyxp',
				authorName: 'hid72949189',
				isInternalAuthor: false,
				internalMatchedBy: 'none',
				labels: [],
				issueTypeRaw: 'issue',
				requestKind: 'requirement',
				requestKindMatchedBy: 'title-prefix',
				referencesFull: 'CPF-KMP-CMP/docs#76',
			},
		]);

		await new SyncService(mockApp, settings).run();

		expect(mockWriteIssueNotes).toHaveBeenCalledWith([
			expect.objectContaining<Partial<NormalizedIssueNote>>({
				id: 4102300,
				iid: 76,
				title: '[需求] 添加侧边栏容器用户手册',
				state: 'open',
				webUrl: 'https://gitcode.com/CPF-KMP-CMP/docs/issues/76',
				projectId: 9384224,
				projectPath: 'CPF-KMP-CMP/docs',
				sourceRepo: 'docs',
				authorUsername: 'bearboyxp',
				authorName: 'hid72949189',
				requestKind: 'requirement',
				referencesFull: 'CPF-KMP-CMP/docs#76',
			}),
		]);
		expect(mockUpsertTextFile).toHaveBeenNthCalledWith(
			1,
			'GitCode Issues/reports/daily/2026-06-17.md',
			expect.stringContaining('newRequirementCount: 1'),
		);
		expect(mockUpsertTextFile).toHaveBeenNthCalledWith(
			1,
			'GitCode Issues/reports/daily/2026-06-17.md',
			expect.stringContaining('- docs #76: [需求] 添加侧边栏容器用户手册'),
		);
	});

	it('classifies GitCode docs titles as requirements using keyword fallback', async () => {
		const settings = makeSettings({
			repoList: ['docs'],
			classificationRules: {
				titlePrefixes: {
					'[BUG]': 'bug',
					'[需求]': 'requirement',
				},
				titleKeywords: {
					'添加': 'requirement',
					'手册': 'requirement',
				},
				labels: {},
			} as GitlabIssuesSettings['classificationRules'],
		});
		mockResolveRepoNames.mockResolvedValueOnce(['docs']);
		mockLoadRepoIssues.mockResolvedValueOnce([
			makeGitCodeIssue({
				title: '添加媒体查询用户手册',
			}),
		]);
		mockReadIssueNotes.mockResolvedValueOnce([
			{
				id: 4102300,
				iid: 76,
				title: '添加媒体查询用户手册',
				state: 'open',
				createdAt: '2026-06-17T19:07:15+08:00',
				updatedAt: '2026-06-17T19:07:15+08:00',
				webUrl: 'https://gitcode.com/CPF-KMP-CMP/docs/issues/76',
				projectId: 9384224,
				projectPath: 'CPF-KMP-CMP/docs',
				sourceScope: 'project',
				sourceRepo: 'docs',
				authorUsername: 'bearboyxp',
				authorName: 'hid72949189',
				isInternalAuthor: false,
				internalMatchedBy: 'none',
				labels: [],
				issueTypeRaw: 'issue',
				requestKind: 'requirement',
				requestKindMatchedBy: 'title-keyword',
				referencesFull: 'CPF-KMP-CMP/docs#76',
			},
		]);

		await new SyncService(mockApp, settings).run();

		expect(mockWriteIssueNotes).toHaveBeenCalledWith([
			expect.objectContaining<Partial<NormalizedIssueNote>>({
				title: '添加媒体查询用户手册',
				requestKind: 'requirement',
				requestKindMatchedBy: 'title-keyword',
			}),
		]);
		expect(mockUpsertTextFile).toHaveBeenNthCalledWith(
			1,
			'GitCode Issues/reports/daily/2026-06-17.md',
			expect.stringContaining('newRequirementCount: 1'),
		);
	});
});
