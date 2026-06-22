import {GitlabIssuesSettings, SettingsTab, UiLanguage} from "./settings-types";

export const DEFAULT_SETTINGS: GitlabIssuesSettings = {
	gitlabUrl: 'https://gitcode.com',
	apiBaseUrl: 'https://gitcode.com/api/v5',
	gitlabToken: '',
	uiLanguage: 'en',
	gitlabIssuesLevel: 'personal',
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
			'fix(': 'bug',
			'fix:': 'bug',
			'failed': 'bug',
			'报错': 'bug',
			'失败': 'bug',
			'闪退': 'bug',
			'崩溃': 'bug',
			'体积偏大': 'bug',
			'UAF': 'bug',
			'添加': 'requirement',
			'手册': 'requirement',
			'示例': 'requirement',
			'支持': 'requirement',
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
	intervalOfRefresh: "15",
	gitlabApiUrl(): string {
		return this.apiBaseUrl || `${this.gitlabUrl}/api/v5`;
	}
};

export function normalizeSettings(loadedData?: Partial<GitlabIssuesSettings>): GitlabIssuesSettings {
	const rawData = loadedData ?? {};
	const mergedSettings = Object.assign({}, DEFAULT_SETTINGS, rawData);
	const hasExplicitIssueFilter = Object.prototype.hasOwnProperty.call(rawData, 'issueFilter');
	const canonicalFilter = hasExplicitIssueFilter
		? rawData.issueFilter ?? ''
		: rawData.filter ?? DEFAULT_SETTINGS.issueFilter;
	const rawClassificationRules = rawData.classificationRules;
	const classificationRules = {
		titlePrefixes: {
			...DEFAULT_SETTINGS.classificationRules.titlePrefixes,
			...(rawClassificationRules?.titlePrefixes ?? {}),
		},
		titleKeywords: {
			...DEFAULT_SETTINGS.classificationRules.titleKeywords,
			...(rawClassificationRules?.titleKeywords ?? {}),
		},
		labels: {
			...DEFAULT_SETTINGS.classificationRules.labels,
			...(rawClassificationRules?.labels ?? {}),
		},
	};

	return {
		...mergedSettings,
		classificationRules,
		issueFilter: canonicalFilter,
		filter: canonicalFilter,
	};
}

const SHARED_OPTIONS = {
	refreshRates: {off: "off", "15": "15", "30": "30", "45": "45", "60": "60", "120": "120"},
	scopeOptionsEn: {personal: "Personal", project: "Project", group: "Group"},
	scopeOptionsZh: {personal: "个人", project: "项目", group: "组织"},
} as const;

const SETTINGS_BY_LANGUAGE: Record<UiLanguage, SettingsTab> = {
	en: {
		title: 'IssueTracker Configuration',
		languageSetting: {
			title: 'Interface Language',
			description: 'Choose the display language for this settings page.',
			options: {
				en: 'English',
				'zh-CN': '中文',
			},
		},
		settingInputs: [{
			title: 'Gitlab instance URL',
			description: 'Use your own Gitlab instance instead of the public hosted Gitlab.',
			placeholder: 'https://gitcode.com',
			value: "gitlabUrl",
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
				value: "gitlabToken"
			},
			{
				title: 'Template File',
				description: 'Path to an Obsidian note to use as the template.',
				placeholder: 'your-template-file.md',
				value: "templateFile"
			},
			{
				title: "Output Folder",
				description: 'Path to an Obsidian folder to write output files to.',
				placeholder: "IssueTracker",
				value: "outputDir",
				modifier: "normalizePath"
			},
			{
				title: 'Organization Name',
				description: 'The GitCode organization that owns the repositories.',
				placeholder: 'CPF-KMP-CMP',
				value: 'orgName'
			},
			{
				title: 'Repository List',
				description: 'One repository per line. Ignored when syncing all organization repositories.',
				placeholder: 'repo-a\nrepo-b',
				value: 'repoList',
				modifier: 'stringArray',
				inputType: 'textarea'
			},
			{
				title: 'Internal User Whitelist',
				description: 'One internal username per line.',
				placeholder: 'alice\nbob',
				value: 'internalUserWhitelist',
				modifier: 'stringArray',
				inputType: 'textarea'
			},
			{
				title: 'Classification Rules',
				description: 'JSON object that controls issue classification.',
				placeholder: '{\n  "titlePrefixes": {\n    "[BUG]": "bug"\n  },\n  "titleKeywords": {\n    "添加": "requirement"\n  },\n  "labels": {}\n}',
				value: 'classificationRules',
				modifier: 'json',
				inputType: 'textarea'
			},
			{
				title: 'Issues Folder',
				description: 'Path to the folder that stores issue notes.',
				placeholder: 'GitCode Issues/issues',
				value: 'issuesFolder',
				modifier: 'normalizePath'
			},
			{
				title: 'Meta Folder',
				description: 'Path to the folder that stores sync metadata.',
				placeholder: 'GitCode Issues/meta',
				value: 'metaFolder',
				modifier: 'normalizePath'
			},
			{
				title: 'Reports Folder',
				description: 'Path to the folder that stores generated reports.',
				placeholder: 'GitCode Issues/reports',
				value: 'reportsFolder',
				modifier: 'normalizePath'
			},
			{
				title: "Issues Filter",
				description: 'The query string used to filter the issues.',
				placeholder: '',
				value: 'issueFilter'
			}
		],
		dropdowns: [{
			title: 'Refresh Rate',
			description: "That rate at which gitlab issues will be pulled.",
			options: SHARED_OPTIONS.refreshRates,
			value: "intervalOfRefresh",
		},
			{
				title: "GitLab Scope",
				description: "The scope at which the api request will pull.",
				options: SHARED_OPTIONS.scopeOptionsEn,
				value: "gitlabIssuesLevel"
			}
		],
		checkBoxInputs: [{
			title: 'Purge issues that are no longer in Gitlab?',
			value: "purgeIssues",
		},
			{
				title: 'Show refresh Gitlab issues icon in left ribbon?',
				value: 'showIcon',
			},
			{
				title: 'Should refresh Gitlab issues on Startup?',
				value: 'refreshOnStartup'
			},
			{
				title: 'Generate daily reports?',
				value: 'generateDailyReports'
			},
			{
				title: 'Sync all organization repositories?',
				value: 'syncAllOrgRepos'
			}
		],
		getGitlabIssuesLevel: (currentLevel) => {
			return currentLevel === 'group'
				? {title: "Group", url: "https://docs.gitlab.com/ee/user/group/#get-the-group-id"}
				: {title: "Project", url: "https://docs.gitlab.com/ee/user/project/working_with_projects.html#access-the-project-overview-page-by-using-the-project-id"};
		},
		getGitlabIdSettingName: (currentLevelTitle) => `Set Gitlab ${currentLevelTitle} Id`,
		getGitlabIdLinkText: (currentLevelTitle) => `Find your ${currentLevelTitle} Id.`,
		moreInformationTitle: 'More Information',
		gitlabDocumentation: {
			title: 'View the Gitlab documentation',
			url: 'https://docs.gitlab.com/ee/api/issues.html#list-issues'
		}
	},
	'zh-CN': {
		title: 'IssueTracker 配置',
		languageSetting: {
			title: '界面语言',
			description: '选择当前设置页的显示语言。',
			options: {
				en: 'English',
				'zh-CN': '中文',
			},
		},
		settingInputs: [{
			title: 'Gitlab 实例地址',
			description: '如果你使用自建 Gitlab 实例，可以在这里替换默认托管地址。',
			placeholder: 'https://gitcode.com',
			value: "gitlabUrl",
		},
			{
				title: 'API 基础地址',
				description: '需要时可覆盖 GitCode API 的基础地址。',
				placeholder: 'https://gitcode.com/api/v5',
				value: 'apiBaseUrl',
			},
			{
				title: '个人访问令牌',
				description: '在你的 Gitlab 账户中创建 personal access token，并填写到这里。',
				placeholder: 'Token',
				value: "gitlabToken"
			},
			{
				title: '模板文件',
				description: '作为模板使用的 Obsidian 笔记路径。',
				placeholder: 'your-template-file.md',
				value: "templateFile"
			},
			{
				title: "输出目录",
				description: '用于写入输出文件的 Obsidian 文件夹路径。',
				placeholder: "IssueTracker",
				value: "outputDir",
				modifier: "normalizePath"
			},
			{
				title: '组织名称',
				description: '拥有这些仓库的 GitCode 组织名。',
				placeholder: 'CPF-KMP-CMP',
				value: 'orgName'
			},
			{
				title: '仓库列表',
				description: '每行一个仓库名。开启同步全部组织仓库时会忽略这里。',
				placeholder: 'repo-a\nrepo-b',
				value: 'repoList',
				modifier: 'stringArray',
				inputType: 'textarea'
			},
			{
				title: '内部用户名白名单',
				description: '每行一个内部用户名。',
				placeholder: 'alice\nbob',
				value: 'internalUserWhitelist',
				modifier: 'stringArray',
				inputType: 'textarea'
			},
			{
				title: '分类规则',
				description: '用于控制 issue 分类的 JSON 对象。',
				placeholder: '{\n  "titlePrefixes": {\n    "[BUG]": "bug"\n  },\n  "titleKeywords": {\n    "添加": "requirement"\n  },\n  "labels": {}\n}',
				value: 'classificationRules',
				modifier: 'json',
				inputType: 'textarea'
			},
			{
				title: 'Issues 目录',
				description: '存放 issue 笔记的文件夹路径。',
				placeholder: 'GitCode Issues/issues',
				value: 'issuesFolder',
				modifier: 'normalizePath'
			},
			{
				title: '元数据目录',
				description: '存放同步元数据的文件夹路径。',
				placeholder: 'GitCode Issues/meta',
				value: 'metaFolder',
				modifier: 'normalizePath'
			},
			{
				title: '报告目录',
				description: '存放生成报告的文件夹路径。',
				placeholder: 'GitCode Issues/reports',
				value: 'reportsFolder',
				modifier: 'normalizePath'
			},
			{
				title: "Issues 过滤条件",
				description: '用于筛选 issues 的查询字符串。',
				placeholder: '',
				value: 'issueFilter'
			}
		],
		dropdowns: [{
			title: '刷新频率',
			description: "拉取 Gitlab issues 的时间间隔。",
			options: SHARED_OPTIONS.refreshRates,
			value: "intervalOfRefresh",
		},
			{
				title: "GitLab 范围",
				description: "API 请求拉取 issues 时使用的范围。",
				options: SHARED_OPTIONS.scopeOptionsZh,
				value: "gitlabIssuesLevel"
			}
		],
		checkBoxInputs: [{
			title: '清理 Gitlab 中已不存在的 issues？',
			value: "purgeIssues",
		},
			{
				title: '在左侧边栏显示刷新 Gitlab issues 图标？',
				value: 'showIcon',
			},
			{
				title: '启动时自动刷新 Gitlab issues？',
				value: 'refreshOnStartup'
			},
			{
				title: '生成日报？',
				value: 'generateDailyReports'
			},
			{
				title: '同步该组织下的全部仓库？',
				value: 'syncAllOrgRepos'
			}
		],
		getGitlabIssuesLevel: (currentLevel) => {
			return currentLevel === 'group'
				? {title: "组织", url: "https://docs.gitlab.com/ee/user/group/#get-the-group-id"}
				: {title: "项目", url: "https://docs.gitlab.com/ee/user/project/working_with_projects.html#access-the-project-overview-page-by-using-the-project-id"};
		},
		getGitlabIdSettingName: (currentLevelTitle) => `设置 Gitlab ${currentLevelTitle} Id`,
		getGitlabIdLinkText: (currentLevelTitle) => `查找你的 ${currentLevelTitle} Id。`,
		moreInformationTitle: '更多信息',
		gitlabDocumentation: {
			title: '查看 Gitlab 文档',
			url: 'https://docs.gitlab.com/ee/api/issues.html#list-issues'
		}
	}
};

export function getSettingsUi(language: UiLanguage): SettingsTab {
	return SETTINGS_BY_LANGUAGE[language];
}

export const settings = getSettingsUi(DEFAULT_SETTINGS.uiLanguage);
