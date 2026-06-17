import {App} from 'obsidian';
import * as Filesystem from '../../src/filesystem';
import {GitlabIssuesSettings} from '../../src/SettingsTab/settings-types';
import {normalizeSettings} from '../../src/SettingsTab/settings';
import GitlabLoader from "../../src/GitlabLoader/gitlab-loader";
import GitlabApi from "../../src/GitlabLoader/gitlab-api";
import {Issue} from "../../src/GitlabLoader/issue-types";
import {GitlabIssue} from "../../src/GitlabLoader/issue";

const mockPurgeExistingIssues = jest.fn();
const mockProcessIssues = jest.fn();
const mockFileSystem = jest.spyOn(Filesystem, 'default').mockReturnValue({
	purgeExistingIssues: mockPurgeExistingIssues,
	processIssues: mockProcessIssues
} as any);

const mockLoad = jest.spyOn(GitlabApi, "load");

const mockSettings: GitlabIssuesSettings = normalizeSettings({
	gitlabUrl: 'https://gitlab.com',
	apiBaseUrl: 'https://gitcode.com/api/v5',
	gitlabToken: 'test-token',
	gitlabIssuesLevel: 'project',
	orgName: 'CPF-KMP-CMP',
	repoList: [],
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
	outputDir: '/Gitlab Issues/',
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
		return `${this.gitlabUrl}/api/v4`;
	}
});

const mockApp = {} as App;

describe('GitlabLoader', () => {
	let gitlabLoader: GitlabLoader;

	beforeEach(() => {
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

	it('should construct correct URL for group level', () => {
		mockSettings.gitlabIssuesLevel = 'group';
		const expectedUrl = `${mockSettings.gitlabApiUrl()}/groups/${mockSettings.gitlabAppId}/issues?${mockSettings.issueFilter}`;
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
});
