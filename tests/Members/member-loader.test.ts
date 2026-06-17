import MemberLoader from "../../src/Members/member-loader";
import {DEFAULT_SETTINGS} from "../../src/SettingsTab/settings";
import GitlabApi from "../../src/GitlabLoader/gitlab-api";

const mockLoadAllPages = jest.spyOn(GitlabApi, "loadAllPages");

describe('MemberLoader', () => {
	afterEach(() => {
		jest.clearAllMocks();
	});

	it('merges org members, repo collaborators, and whitelist users into one index', async () => {
		mockLoadAllPages
			.mockResolvedValueOnce([{username: 'org_user'}])
			.mockResolvedValueOnce([{username: 'repo_user'}]);

		const loader = new MemberLoader({
			...DEFAULT_SETTINGS,
			orgName: 'CPF-KMP-CMP',
			repoList: ['repo-a'],
			internalUserWhitelist: ['manual_user'],
		});

		const index = await loader.loadInternalMemberIndex();

		expect(index.usernames.org_user.source).toBe('org');
		expect(index.usernames.repo_user.source).toBe('repo');
		expect(index.usernames.repo_user.repo).toBe('repo-a');
		expect(index.usernames.manual_user.source).toBe('whitelist');
		expect(mockLoadAllPages).toHaveBeenNthCalledWith(
			1,
			'https://gitcode.com/api/v5/orgs/CPF-KMP-CMP/members',
			'',
		);
		expect(mockLoadAllPages).toHaveBeenNthCalledWith(
			2,
			'https://gitcode.com/api/v5/repos/CPF-KMP-CMP/repo-a/collaborators',
			'',
		);
	});

	it('keeps the first internal source when the same username appears multiple times', async () => {
		mockLoadAllPages
			.mockResolvedValueOnce([{username: 'shared_user'}])
			.mockResolvedValueOnce([{username: 'shared_user'}]);

		const loader = new MemberLoader({
			...DEFAULT_SETTINGS,
			orgName: 'CPF-KMP-CMP',
			repoList: ['repo-a'],
			internalUserWhitelist: ['shared_user'],
		});

		const index = await loader.loadInternalMemberIndex();

		expect(index.usernames.shared_user).toEqual({
			username: 'shared_user',
			source: 'org',
		});
	});
});
