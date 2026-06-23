import {App} from 'obsidian';
import * as Filesystem from '../../src/filesystem';
import {GitlabIssuesSettings} from '../../src/SettingsTab/settings-types';
import {normalizeSettings} from '../../src/SettingsTab/settings';
import GitlabLoader from "../../src/GitlabLoader/gitlab-loader";
import GitlabApi from "../../src/GitlabLoader/gitlab-api";
import {Issue} from "../../src/GitlabLoader/issue-types";
import {GitlabIssue} from "../../src/GitlabLoader/issue";
import {resolveGitlabApiBaseUrl} from "../../src/SettingsTab/settings";

const mockPurgeExistingIssues = jest.fn();
const mockProcessIssues = jest.fn();
const mockFileSystem = jest.spyOn(Filesystem, 'default').mockReturnValue({
	purgeExistingIssues: mockPurgeExistingIssues,
	processIssues: mockProcessIssues
} as any);

const mockLoad = jest.spyOn(GitlabApi, "load");
const mockLoadAllPages = jest.spyOn(GitlabApi, "loadAllPages");

const mockSettings: GitlabIssuesSettings = normalizeSettings({
	gitlabUrl: 'https://gitlab.com',
	apiBaseUrl: 'https://gitcode.com/api/v5',
	gitlabToken: 'test-token',
	gitlabIssuesLevel: 'project',
	orgName: 'CPF-KMP-CMP',
	repoList: [],
	syncAllOrgRepos: false,
	gitlabAppId: '12345',
	internalUserWhitelist: [],
	classificationRules: {
		titlePrefixes: {
			'[BUG]': 'bug',
			'[需求]': 'requirement',
		},
		labels: {},
	},
	templateFile: 'template.md',
	outputDir: '/IssueTracker/',
	issuesFolder: 'GitCode Issues/issues',
	metaFolder: 'GitCode Issues/meta',
	reportsFolder: 'GitCode Issues/reports',
	issueFilter: '',
	filter: 'due_date=month',
	generateDailyReports: true,
	showIcon: false,
	purgeIssues: true,
	refreshOnStartup: true,
	intervalOfRefresh: "15",
	gitlabApiUrl(): string {
		return resolveGitlabApiBaseUrl(this.gitlabUrl, this.apiBaseUrl);
	}
});

const mockApp = {} as App;

describe('GitlabLoader', () => {
	let gitlabLoader: GitlabLoader;

	beforeEach(() => {
		mockPurgeExistingIssues.mockReset();
		mockProcessIssues.mockReset();
		mockLoad.mockReset();
		mockLoadAllPages.mockReset();
		mockSettings.gitlabUrl = 'https://gitlab.com';
		mockSettings.apiBaseUrl = 'https://gitcode.com/api/v5';
		mockSettings.gitlabAppId = '12345';
		mockSettings.orgName = 'CPF-KMP-CMP';
		mockSettings.repoList = [];
		mockSettings.syncAllOrgRepos = false;
		mockSettings.gitlabIssuesLevel = 'project';
		mockSettings.issueFilter = 'due_date=month';
		mockSettings.filter = 'due_date=month';
		gitlabLoader = new GitlabLoader(mockApp, mockSettings);
	});

	afterEach(() => {
		jest.clearAllMocks();
	});

	it('should initialize with correct properties', () => {
		expect(gitlabLoader['settings']).toEqual(mockSettings);
	});

	it('should construct correct URL for project level', () => {
		const expectedUrl = `${mockSettings.gitlabApiUrl()}/projects/${mockSettings.gitlabAppId}/issues?${mockSettings.issueFilter}`;
		expect(gitlabLoader.getUrl()).toBe(expectedUrl);
	});

	it('should construct correct GitLab v4 URL for project level', () => {
		mockSettings.gitlabUrl = 'https://gitlab.example.com';
		mockSettings.apiBaseUrl = 'https://gitlab.example.com/api/v4';
		mockSettings.gitlabAppId = 'group/project';

		const expectedUrl = `${mockSettings.gitlabApiUrl()}/projects/${encodeURIComponent(mockSettings.gitlabAppId)}/issues?${mockSettings.issueFilter}`;
		expect(gitlabLoader.getUrl()).toBe(expectedUrl);
	});

	it('should construct correct URL for group level', () => {
		mockSettings.gitlabIssuesLevel = 'group';
		const expectedUrl = `${mockSettings.gitlabApiUrl()}/groups/${encodeURIComponent(mockSettings.gitlabAppId)}/issues?${mockSettings.issueFilter}`;
		expect(gitlabLoader.getUrl()).toBe(expectedUrl);
	});

	it('should construct correct URL for personal level', () => {
		mockSettings.gitlabIssuesLevel = 'personal';
		const expectedUrl = `${mockSettings.gitlabApiUrl()}/issues?${mockSettings.issueFilter}`;
		expect(gitlabLoader.getUrl()).toBe(expectedUrl);
	});

	it('should load issues and process them', async () => {
		const mockIssues = [
			{id: 1, title: 'Issue 1', description: '', due_date: '', web_url: '', references: ''},
			{id: 2, title: 'Issue 2', description: '', due_date: '', web_url: '', references: ''},
		] as Issue[];

		mockLoad.mockResolvedValue(mockIssues);

		await gitlabLoader.loadIssues();

		expect(GitlabApi.load).toHaveBeenCalledWith(
			encodeURI(gitlabLoader.getUrl()),
			mockSettings.gitlabToken
		);
		expect(mockPurgeExistingIssues).toHaveBeenCalled();
		expect(mockProcessIssues).toHaveBeenCalledWith(
			expect.arrayContaining([expect.any(GitlabIssue)])
		);
	});

	it('loads repo issues with the repo endpoint and paginated API helper', async () => {
		const mockIssues = [
			{id: 78, title: '[BUG] 登录失败', description: '', due_date: '', web_url: '', references: ''},
		] as Issue[];
		mockSettings.gitlabUrl = 'https://gitcode.com';
		mockSettings.apiBaseUrl = 'https://gitcode.com/api/v5';
		mockSettings.issueFilter = '';
		mockSettings.filter = '';
		mockLoadAllPages.mockResolvedValue(mockIssues);

		const issues = await gitlabLoader.loadRepoIssues('repo-a');

		expect(issues).toEqual(mockIssues);
		expect(mockLoadAllPages).toHaveBeenCalledWith(
			'https://gitcode.com/api/v5/repos/CPF-KMP-CMP/repo-a/issues',
			mockSettings.gitlabToken,
		);
	});

	it('loads repo issues with the GitLab project endpoint on v4', async () => {
		mockSettings.gitlabUrl = 'https://gitlab.example.com';
		mockSettings.apiBaseUrl = 'https://gitlab.example.com/api/v4';
		mockSettings.issueFilter = '';
		mockSettings.filter = '';
		mockLoadAllPages.mockResolvedValue([]);

		await gitlabLoader.loadRepoIssues('repo-a');

		expect(mockLoadAllPages).toHaveBeenCalledWith(
			'https://gitlab.example.com/api/v4/projects/CPF-KMP-CMP%2Frepo-a/issues',
			mockSettings.gitlabToken,
		);
	});

	it('encodes repo issue URLs before loading paginated results', async () => {
		mockSettings.gitlabUrl = 'https://gitcode.com';
		mockSettings.apiBaseUrl = 'https://gitcode.com/api/v5';
		mockSettings.orgName = 'CPF KMP/Platform';
		mockSettings.issueFilter = 'labels=needs review';
		mockLoadAllPages.mockResolvedValue([]);

		await gitlabLoader.loadRepoIssues('repo a#1');

		expect(mockLoadAllPages).toHaveBeenCalledWith(
			'https://gitcode.com/api/v5/repos/CPF%20KMP%2FPlatform/repo%20a%231/issues?labels=needs%20review',
			mockSettings.gitlabToken,
		);
	});

	it('loads organization repositories with the paginated API helper', async () => {
		mockSettings.gitlabUrl = 'https://gitcode.com';
		mockSettings.apiBaseUrl = 'https://gitcode.com/api/v5';
		mockLoadAllPages.mockResolvedValueOnce([
			{path: 'repo-a', name: 'repo-a'},
		] as any);

		const repos = await gitlabLoader.loadOrgRepos();

		expect(repos).toEqual([{path: 'repo-a', name: 'repo-a'}]);
		expect(mockLoadAllPages).toHaveBeenCalledWith(
			'https://gitcode.com/api/v5/orgs/CPF-KMP-CMP/repos',
			mockSettings.gitlabToken,
		);
	});

	it('loads organization repositories from the GitLab group projects endpoint on v4', async () => {
		mockSettings.gitlabUrl = 'https://gitlab.example.com';
		mockSettings.apiBaseUrl = 'https://gitlab.example.com/api/v4';
		mockSettings.syncAllOrgRepos = true;
		mockLoadAllPages.mockResolvedValueOnce([
			{path: 'repo-a', name: 'repo-a'},
		] as any);

		await gitlabLoader.loadOrgRepos();

		expect(mockLoadAllPages).toHaveBeenCalledWith(
			'https://gitlab.example.com/api/v4/groups/CPF-KMP-CMP/projects',
			mockSettings.gitlabToken,
		);
	});

	it('returns configured repo list when syncAllOrgRepos is disabled', async () => {
		mockSettings.repoList = ['repo-a', 'repo-b'];
		mockSettings.syncAllOrgRepos = false;

		const repoNames = await gitlabLoader.resolveRepoNames();

		expect(repoNames).toEqual(['repo-a', 'repo-b']);
		expect(mockLoadAllPages).not.toHaveBeenCalled();
	});

	it('resolves repo names from the organization repository list when syncAllOrgRepos is enabled', async () => {
		mockSettings.syncAllOrgRepos = true;
		mockLoadAllPages.mockResolvedValueOnce([
			{path: 'repo-a', name: 'repo-a'},
			{path: 'repo-b', name: 'repo-b'},
			{path: 'repo-a', name: 'repo-a duplicate'},
		] as any);

		const repoNames = await gitlabLoader.resolveRepoNames();

		expect(repoNames).toEqual(['repo-a', 'repo-b']);
	});
});
