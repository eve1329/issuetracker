import {GitlabIssuesSettings} from "../../src/SettingsTab/settings-types";
import {
	DEFAULT_SETTINGS,
	getGitlabApiVersion,
	getSettingsUi,
	normalizeSettings,
	resolveGitlabApiBaseUrl,
	settings,
} from "../../src/SettingsTab/settings";

describe('DEFAULT_SETTINGS', () => {
	it('should have the correct default values', () => {
		const expectedDefaults: Omit<GitlabIssuesSettings, 'gitlabApiUrl'> = {
			gitlabUrl: 'https://gitcode.com',
			gitlabToken: '',
			uiLanguage: 'en',
			gitlabIssuesLevel: 'personal',
			apiBaseUrl: 'https://gitcode.com/api/v5',
			orgName: 'CPF-KMP-CMP',
			repoList: [],
			syncAllOrgRepos: false,
			gitlabAppId: '',
			internalUserWhitelist: [],
			classificationRules: {
				titlePrefixes: {
					'[BUG]': 'bug',
					'[需求]': 'requirement',
					'[feature]': 'requirement',
				},
				titleKeywords: {
					'添加': 'requirement',
					'手册': 'requirement',
					'示例': 'requirement',
					'支持': 'requirement',
					'demo config': 'requirement',
					'support': 'requirement',
					'adapt': 'requirement',
					'改用': 'requirement',
					'替换': 'requirement',
					'适配': 'requirement',
					'替代': 'requirement',
					'前移': 'requirement',
					'下沉': 'requirement',
					'零侵入': 'requirement',
					'打印模块名称': 'requirement',
					'自动化测试脚本': 'requirement',
					'fix:': 'bug',
					'fix(': 'bug',
					'failed': 'bug',
					'报错': 'bug',
					'失败': 'bug',
					'闪退': 'bug',
					'崩溃': 'bug',
					'体积偏大': 'bug',
					'UAF': 'bug',
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
			purgeIssues: false,
			refreshOnStartup: true,
			intervalOfRefresh: '15',
		};

		expect(DEFAULT_SETTINGS).toEqual({...expectedDefaults, gitlabApiUrl: expect.any(Function)});
	});

	it('gitlabApiUrl should return correct API URL', () => {
		expect(DEFAULT_SETTINGS.gitlabApiUrl()).toBe('https://gitcode.com/api/v5');
	});

	it('detects the GitLab API version from the configured base URL', () => {
		expect(getGitlabApiVersion('https://gitcode.com/api/v5')).toBe('v5');
		expect(getGitlabApiVersion('https://gitlab.example.com/api/v4')).toBe('v4');
	});

	it('keeps an explicit API base URL as-is when it already points at /api/v4', () => {
		expect(resolveGitlabApiBaseUrl('https://gitlab.example.com', 'https://gitlab.example.com/api/v4'))
			.toBe('https://gitlab.example.com/api/v4');
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
		expect(DEFAULT_SETTINGS.classificationRules.titleKeywords).toMatchObject({
			'添加': 'requirement',
			'前移': 'requirement',
			'自动化测试脚本': 'requirement',
			'demo config': 'requirement',
			'support': 'requirement',
			'fix:': 'bug',
			'fix(': 'bug',
			'崩溃': 'bug',
		});
	});
});

describe('settings', () => {
	it('migrates legacy filter into issueFilter when issueFilter is missing', () => {
		const normalized = normalizeSettings({
			filter: 'due_date=month',
		});

		expect(normalized.issueFilter).toBe('due_date=month');
		expect(normalized.filter).toBe('due_date=month');
	});

	it('prefers explicit issueFilter over legacy filter', () => {
		const normalized = normalizeSettings({
			issueFilter: 'state=opened',
			filter: 'due_date=month',
		});

		expect(normalized.issueFilter).toBe('state=opened');
		expect(normalized.filter).toBe('state=opened');
	});

	it('keeps explicit empty issueFilter and clears legacy filter', () => {
		const normalized = normalizeSettings({
			issueFilter: '',
			filter: 'due_date=month',
		});

		expect(normalized.issueFilter).toBe('');
		expect(normalized.filter).toBe('');
	});

	it('deep-merges classification rules so saved overrides keep new default keyword rules', () => {
		const normalized = normalizeSettings({
			classificationRules: {
				titlePrefixes: {
					'[Task]': 'requirement',
				},
				labels: {
					bug: 'bug',
				},
			},
		});

		expect(normalized.classificationRules.titlePrefixes).toEqual({
			'[BUG]': 'bug',
			'[需求]': 'requirement',
			'[feature]': 'requirement',
			'[Task]': 'requirement',
		});
		expect(normalized.classificationRules.labels).toEqual({
			bug: 'bug',
		});
		expect(normalized.classificationRules.titleKeywords).toMatchObject({
			'添加': 'requirement',
			'前移': 'requirement',
			'自动化测试脚本': 'requirement',
			'demo config': 'requirement',
			'support': 'requirement',
			'fix:': 'bug',
			'fix(': 'bug',
			'崩溃': 'bug',
		});
	});

	it('should have the correct title', () => {
		expect(settings.title).toBe('IssueTracker Configuration');
	});

	it('defaults uiLanguage to English', () => {
		expect(DEFAULT_SETTINGS.uiLanguage).toBe('en');
	});

	it('returns Chinese settings copy when requested', () => {
		const zhSettings = getSettingsUi('zh-CN');

		expect(zhSettings.title).toBe('IssueTracker 配置');
		expect(zhSettings.languageSetting).toEqual({
			title: '界面语言',
			description: '选择当前设置页的显示语言。',
			options: {
				en: 'English',
				'zh-CN': '中文',
			},
		});
		expect(zhSettings.dropdowns[1]).toEqual({
			title: '兼容模式范围',
			description: '兼容原始单接口导入路径的旧设置。',
			options: { personal: '个人', project: '项目', group: '组织' },
			value: 'gitlabIssuesLevel',
		});
		expect(zhSettings.getGitlabIssuesLevel('project')).toEqual({
			title: '仓库',
			url: 'https://docs.gitcode.com/docs/repos/',
		});
		expect(zhSettings.getGitlabIdSettingName('仓库')).toBe('设置仓库标识');
		expect(zhSettings.getGitlabIdLinkText('仓库')).toBe('打开 GitCode 仓库文档。');
		expect(zhSettings.moreInformationTitle).toBe('参考文档');
		expect(zhSettings.gitlabDocumentation).toEqual({
			title: '查看 GitCode issues API 文档',
			url: 'https://docs.gitcode.com/docs/repos/issues/',
		});
	});

	it('should have the correct setting inputs', () => {
		const expectedSettingInputs = [
			{
				title: 'GitCode Instance URL',
				description: 'Base URL for your GitCode instance.',
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
				description: 'Create a personal access token in your GitCode account and enter it here.',
				placeholder: 'Token',
				value: 'gitlabToken',
			},
			{
				title: 'Legacy Template File',
				description: 'Optional Obsidian note path used by the legacy compatibility importer.',
				placeholder: 'your-template-file.md',
				value: 'templateFile',
			},
			{
				title: 'Output Folder',
				description: 'Root folder for generated issue notes, metadata, and reports.',
				placeholder: 'GitCode Issues',
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
				description: 'One repository per line. Ignored when syncing all organization repositories.',
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
				placeholder: '{\n  "titlePrefixes": {\n    "[BUG]": "bug"\n  },\n  "titleKeywords": {\n    "添加": "requirement"\n  },\n  "labels": {}\n}',
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
				description: 'Raw query string appended to GitCode issue list endpoints.',
				placeholder: '',
				value: 'issueFilter',
			},
		];

		expect(settings.settingInputs).toEqual(expectedSettingInputs);
	});

	it('should expose the language selector config', () => {
		expect(settings.languageSetting).toEqual({
			title: 'Interface Language',
			description: 'Choose the display language for this settings page.',
			options: {
				en: 'English',
				'zh-CN': '中文',
			},
		});
	});

	it('should have the correct dropdowns', () => {
		const expectedDropdowns = [
			{
				title: 'Refresh Rate',
				description: 'How often IssueTracker should refresh GitCode issues.',
				options: { off: 'off', '15': '15', '30': '30', '45': '45', '60': '60', '120': '120' },
				value: 'intervalOfRefresh',
			},
			{
				title: 'Legacy API Scope',
				description: 'Compatibility mode for the original single-endpoint importer.',
				options: { personal: 'Personal', project: 'Project', group: 'Group' },
				value: 'gitlabIssuesLevel',
			},
		];

		expect(settings.dropdowns).toEqual(expectedDropdowns);
	});

	it('should have the correct checkBoxInputs', () => {
		const expectedCheckBoxInputs = [
			{
				title: 'Purge generated issues that are no longer returned by GitCode?',
				value: 'purgeIssues',
			},
				{
					title: 'Show the manual sync icon in the left ribbon?',
					value: 'showIcon',
				},
				{
					title: 'Refresh issues on startup?',
					value: 'refreshOnStartup',
				},
				{
					title: 'Generate daily reports?',
					value: 'generateDailyReports',
				},
				{
					title: 'Sync all organization repositories?',
					value: 'syncAllOrgRepos',
				},
			];

		expect(settings.checkBoxInputs).toEqual(expectedCheckBoxInputs);
	});

	it('should correctly return IssueTracker scope information', () => {
		expect(settings.getGitlabIssuesLevel('group')).toEqual({
			title: 'Organization',
			url: 'https://docs.gitcode.com/en/docs/orgs/',
		});

		expect(settings.getGitlabIssuesLevel('project')).toEqual({
			title: 'Repository',
			url: 'https://docs.gitcode.com/en/docs/repos/',
		});
	});

	it('should have the correct Gitlab documentation information', () => {
		expect(settings.gitlabDocumentation).toEqual({
			title: 'View the GitCode issues API documentation',
			url: 'https://docs.gitcode.com/en/docs/repos/issues/',
		});
	});
});
