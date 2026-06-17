import {GitlabIssuesSettings} from "../../src/SettingsTab/settings-types";
import {DEFAULT_SETTINGS, settings} from "../../src/SettingsTab/settings";

describe('DEFAULT_SETTINGS', () => {
	it('should have the correct default values', () => {
		const expectedDefaults: Omit<GitlabIssuesSettings, 'gitlabApiUrl'> = {
			gitlabUrl: 'https://gitcode.com',
			gitlabToken: '',
			gitlabIssuesLevel: 'personal',
			apiBaseUrl: 'https://gitcode.com/api/v5',
			orgName: 'CPF-KMP-CMP',
			repoList: [],
			gitlabAppId: '',
			internalUserWhitelist: [],
			classificationRules: {
				titlePrefixes: {
					'[BUG]': 'bug',
					'[需求]': 'requirement',
				},
				labels: {},
			},
			templateFile: '',
			outputDir: 'GitCode Issues',
			issuesFolder: 'GitCode Issues/issues',
			metaFolder: 'GitCode Issues/meta',
			reportsFolder: 'GitCode Issues/reports',
			issueFilter: '',
			filter: '',
			generateDailyReports: true,
			showIcon: false,
			purgeIssues: true,
			refreshOnStartup: true,
			intervalOfRefresh: '15',
		};

		expect(DEFAULT_SETTINGS).toEqual({...expectedDefaults, gitlabApiUrl: expect.any(Function)});
	});

	it('gitlabApiUrl should return correct API URL', () => {
		expect(DEFAULT_SETTINGS.gitlabApiUrl()).toBe('https://gitcode.com/api/v5');
	});

	it('uses the explicit GitCode api base URL when provided', () => {
		const customSettings = {
			...DEFAULT_SETTINGS,
			gitlabUrl: 'https://gitcode.com',
			apiBaseUrl: 'https://gitcode.com/api/v5',
		};

		expect(customSettings.gitlabApiUrl()).toBe('https://gitcode.com/api/v5');
	});

	it('defaults the GitCode-specific folders and report toggle', () => {
		expect(DEFAULT_SETTINGS.issuesFolder).toBe('GitCode Issues/issues');
		expect(DEFAULT_SETTINGS.metaFolder).toBe('GitCode Issues/meta');
		expect(DEFAULT_SETTINGS.reportsFolder).toBe('GitCode Issues/reports');
		expect(DEFAULT_SETTINGS.generateDailyReports).toBe(true);
		expect(DEFAULT_SETTINGS.classificationRules.labels).toEqual({});
	});
});

describe('settings', () => {
	it('should have the correct title', () => {
		expect(settings.title).toBe('GitLab Issues Configuration');
	});

	it('should have the correct setting inputs', () => {
		const expectedSettingInputs = [
			{
				title: 'Gitlab instance URL',
				description: 'Use your own Gitlab instance instead of the public hosted Gitlab.',
				placeholder: 'https://gitcode.com',
				value: 'gitlabUrl',
			},
			{
				title: 'API Base URL',
				description: 'Override the GitCode API base URL when needed.',
				placeholder: 'https://gitcode.com/api/v5',
				value: 'apiBaseUrl',
			},
			{
				title: 'Personal Access Token',
				description: 'Create a personal access token in your Gitlab account and enter it here.',
				placeholder: 'Token',
				value: 'gitlabToken',
			},
			{
				title: 'Template File',
				description: 'Path to an Obsidian note to use as the template.',
				placeholder: 'your-template-file.md',
				value: 'templateFile',
			},
			{
				title: 'Output Folder',
				description: 'Path to an Obsidian folder to write output files to.',
				placeholder: 'Gitlab Issues',
				value: 'outputDir',
				modifier: 'normalizePath',
			},
			{
				title: 'Organization Name',
				description: 'The GitCode organization that owns the repositories.',
				placeholder: 'CPF-KMP-CMP',
				value: 'orgName',
			},
			{
				title: 'Repository List',
				description: 'One repository per line.',
				placeholder: 'repo-a\nrepo-b',
				value: 'repoList',
				modifier: 'stringArray',
				inputType: 'textarea',
			},
			{
				title: 'Internal User Whitelist',
				description: 'One internal username per line.',
				placeholder: 'alice\nbob',
				value: 'internalUserWhitelist',
				modifier: 'stringArray',
				inputType: 'textarea',
			},
			{
				title: 'Classification Rules',
				description: 'JSON object that controls issue classification.',
				placeholder: '{\n  "titlePrefixes": {\n    "[BUG]": "bug"\n  },\n  "labels": {}\n}',
				value: 'classificationRules',
				modifier: 'json',
				inputType: 'textarea',
			},
			{
				title: 'Issues Folder',
				description: 'Path to the folder that stores issue notes.',
				placeholder: 'GitCode Issues/issues',
				value: 'issuesFolder',
				modifier: 'normalizePath',
			},
			{
				title: 'Meta Folder',
				description: 'Path to the folder that stores sync metadata.',
				placeholder: 'GitCode Issues/meta',
				value: 'metaFolder',
				modifier: 'normalizePath',
			},
			{
				title: 'Reports Folder',
				description: 'Path to the folder that stores generated reports.',
				placeholder: 'GitCode Issues/reports',
				value: 'reportsFolder',
				modifier: 'normalizePath',
			},
			{
				title: 'Issues Filter',
				description: 'The query string used to filter the issues.',
				placeholder: '',
				value: 'issueFilter',
			},
		];

		expect(settings.settingInputs).toEqual(expectedSettingInputs);
	});

	it('should have the correct dropdowns', () => {
		const expectedDropdowns = [
			{
				title: 'Refresh Rate',
				description: 'That rate at which gitlab issues will be pulled.',
				options: { off: 'off', '15': '15', '30': '30', '45': '45', '60': '60', '120': '120' },
				value: 'intervalOfRefresh',
			},
			{
				title: 'GitLab Scope',
				description: 'The scope at which the api request will pull.',
				options: { personal: 'Personal', project: 'Project', group: 'Group' },
				value: 'gitlabIssuesLevel',
			},
		];

		expect(settings.dropdowns).toEqual(expectedDropdowns);
	});

	it('should have the correct checkBoxInputs', () => {
		const expectedCheckBoxInputs = [
			{
				title: 'Purge issues that are no longer in Gitlab?',
				value: 'purgeIssues',
			},
				{
					title: 'Show refresh Gitlab issues icon in left ribbon?',
					value: 'showIcon',
				},
				{
					title: 'Should refresh Gitlab issues on Startup?',
					value: 'refreshOnStartup',
				},
				{
					title: 'Generate daily reports?',
					value: 'generateDailyReports',
				},
			];

		expect(settings.checkBoxInputs).toEqual(expectedCheckBoxInputs);
	});

	it('should correctly return Gitlab Issues Level information', () => {
		expect(settings.getGitlabIssuesLevel('group')).toEqual({
			title: 'Group',
			url: 'https://docs.gitlab.com/ee/user/group/#get-the-group-id',
		});

		expect(settings.getGitlabIssuesLevel('project')).toEqual({
			title: 'Project',
			url: 'https://docs.gitlab.com/ee/user/project/working_with_projects.html#access-the-project-overview-page-by-using-the-project-id',
		});
	});

	it('should have the correct Gitlab documentation information', () => {
		expect(settings.gitlabDocumentation).toEqual({
			title: 'View the Gitlab documentation',
			url: 'https://docs.gitlab.com/ee/api/issues.html#list-issues',
		});
	});
});
