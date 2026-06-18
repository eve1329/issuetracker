import MemberLoader from "../../src/Members/member-loader";
import {DEFAULT_SETTINGS} from "../../src/SettingsTab/settings";
import GitlabApi from "../../src/GitlabLoader/gitlab-api";

const mockLoadAllPages = jest.spyOn(GitlabApi, "loadAllPages");

describe('MemberLoader', () => {
	beforeEach(() => {
		mockLoadAllPages.mockReset();
	});

	afterEach(() => {
		jest.clearAllMocks();
	});

	it('builds the internal member index from repo collaborators and whitelist users only', async () => {
		mockLoadAllPages.mockResolvedValueOnce([{username: 'repo_user'}]);

		const loader = new MemberLoader({
			...DEFAULT_SETTINGS,
			orgName: 'CPF-KMP-CMP',
			repoList: ['repo-a'],
			internalUserWhitelist: ['manual_user'],
		});

		const result = await loader.loadInternalMemberIndex();

		expect(result.index.usernames.repo_user.source).toBe('repo');
		expect(result.index.usernames.repo_user.repo).toBe('repo-a');
		expect(result.index.usernames.manual_user.source).toBe('whitelist');
		expect(result.warningMessages).toEqual([]);
		expect(mockLoadAllPages).toHaveBeenCalledTimes(1);
		expect(mockLoadAllPages).toHaveBeenNthCalledWith(
			1,
			'https://gitcode.com/api/v5/repos/CPF-KMP-CMP/repo-a/collaborators',
			'',
		);
	});

	it('keeps the first repo collaborator source when the same username appears multiple times', async () => {
		mockLoadAllPages
			.mockResolvedValueOnce([{username: 'shared_user'}])
			.mockResolvedValueOnce([{username: 'shared_user'}]);

		const loader = new MemberLoader({
			...DEFAULT_SETTINGS,
			orgName: 'CPF-KMP-CMP',
			repoList: ['repo-a', 'repo-b'],
			internalUserWhitelist: ['shared_user'],
		});

		const result = await loader.loadInternalMemberIndex();

		expect(result.index.usernames.shared_user).toEqual({
			username: 'shared_user',
			source: 'repo',
			repo: 'repo-a',
		});
		expect(result.warningMessages).toEqual([]);
	});

	it('keeps syncing remaining repos and returns warnings when some collaborator endpoints fail', async () => {
		mockLoadAllPages
			.mockRejectedValueOnce(new Error('403 Forbidden - Unauthorized access'))
			.mockResolvedValueOnce([{username: 'repo_b_user'}]);

		const loader = new MemberLoader({
			...DEFAULT_SETTINGS,
			orgName: 'CPF-KMP-CMP',
			repoList: ['repo-a', 'repo-b'],
			internalUserWhitelist: ['manual_user'],
		});

		const result = await loader.loadInternalMemberIndex();

		expect(result.index.usernames.repo_b_user).toEqual({
			username: 'repo_b_user',
			source: 'repo',
			repo: 'repo-b',
		});
		expect(result.index.usernames.manual_user.source).toBe('whitelist');
		expect(result.warningMessages).toEqual([
			'Failed to sync repo collaborators for repo-a: 403 Forbidden - Unauthorized access',
		]);
	});

	it('reuses cached repo members and only fetches a limited batch per run', async () => {
		mockLoadAllPages
			.mockResolvedValueOnce([{username: 'repo_b_user'}]);

		const loader = new MemberLoader({
			...DEFAULT_SETTINGS,
			orgName: 'CPF-KMP-CMP',
			repoList: ['repo-a', 'repo-b', 'repo-c'],
			internalUserWhitelist: [],
		});

		const result = await loader.loadInternalMemberIndex(
			['repo-a', 'repo-b', 'repo-c'],
			{
				usernames: {
					repo_a_user: {username: 'repo_a_user', source: 'repo', repo: 'repo-a'},
				},
				repoMembers: {
					'repo-a': ['repo_a_user'],
				},
				repoSyncState: {
					'repo-a': {status: 'success', lastSuccessAt: '2026-06-18T00:00:00.000Z'},
					'repo-c': {status: 'forbidden', nextRetryAt: '2999-01-01T00:00:00.000Z'},
				},
			},
		);

		expect(result.index.usernames.repo_a_user).toEqual({
			username: 'repo_a_user',
			source: 'repo',
			repo: 'repo-a',
		});
		expect(result.index.usernames.repo_b_user).toEqual({
			username: 'repo_b_user',
			source: 'repo',
			repo: 'repo-b',
		});
		expect(result.index.syncProgress).toEqual(expect.objectContaining({
			totalRepos: 3,
			successRepoCount: 1,
			forbiddenRepoCount: 1,
			errorRepoCount: 1,
			pendingRepoCount: 1,
			cachedRepoCount: 2,
			attemptedReposThisRun: ['repo-b', 'repo-a'],
		}));
		expect(mockLoadAllPages).toHaveBeenCalledTimes(2);
	});

	it('stops the current run after a rate limit response and keeps already cached repo members', async () => {
		mockLoadAllPages
			.mockResolvedValueOnce([{username: 'repo_a_user'}])
			.mockRejectedValueOnce(new Error('429 Threshold: 50 times per user per Minute'));

		const loader = new MemberLoader({
			...DEFAULT_SETTINGS,
			orgName: 'CPF-KMP-CMP',
			repoList: ['repo-a', 'repo-b', 'repo-c'],
			internalUserWhitelist: [],
		});

		const result = await loader.loadInternalMemberIndex(['repo-a', 'repo-b', 'repo-c']);

		expect(result.index.usernames.repo_a_user).toEqual({
			username: 'repo_a_user',
			source: 'repo',
			repo: 'repo-a',
		});
		expect(result.index.syncProgress).toEqual(expect.objectContaining({
			successRepoCount: 1,
			rateLimitedRepoCount: 1,
			pendingRepoCount: 2,
			attemptedReposThisRun: ['repo-a', 'repo-b'],
		}));
		expect(result.warningMessages).toEqual([
			'Failed to sync repo collaborators for repo-b: 429 Threshold: 50 times per user per Minute',
		]);
		expect(mockLoadAllPages).toHaveBeenCalledTimes(2);
	});
});
