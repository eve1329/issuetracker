import {GitlabIssuesSettings, SettingsTab, SupportedGitHost, UiLanguage} from "./settings-types";

export function detectGitHost(gitlabUrl: string, apiBaseUrl?: string): SupportedGitHost {
	const combined = `${gitlabUrl} ${apiBaseUrl ?? ''}`.toLowerCase();

	if (combined.includes('github.com') || combined.includes('api.github.com')) {
		return 'github';
	}

	if (combined.includes('gitee.com')) {
		return 'gitee';
	}

	if (combined.includes('gitcode.com')) {
		return 'gitcode';
	}

	if (combined.includes('gitlab')) {
		return 'gitlab';
	}

	return 'unknown';
}

interface HostDocumentation {
	repoScopeUrl: string;
	groupScopeUrl: string;
	issuesApiUrl: string;
	displayName: string;
}

const HOST_DOCUMENTATION: Record<SupportedGitHost, HostDocumentation> = {
	gitcode: {
		repoScopeUrl: 'https://docs.gitcode.com/en/docs/repos/',
		groupScopeUrl: 'https://docs.gitcode.com/en/docs/orgs/',
		issuesApiUrl: 'https://docs.gitcode.com/en/docs/repos/issues/',
		displayName: 'GitCode',
	},
	gitlab: {
		repoScopeUrl: 'https://docs.gitlab.com/api/projects/',
		groupScopeUrl: 'https://docs.gitlab.com/api/groups/',
		issuesApiUrl: 'https://docs.gitlab.com/api/issues/',
		displayName: 'GitLab',
	},
	github: {
		repoScopeUrl: 'https://docs.github.com/en/rest/repos/repos?apiVersion=2022-11-28#list-organization-repositories',
		groupScopeUrl: 'https://docs.github.com/en/rest/repos/repos?apiVersion=2022-11-28#list-organization-repositories',
		issuesApiUrl: 'https://docs.github.com/en/rest/issues/issues?apiVersion=2022-11-28#list-repository-issues',
		displayName: 'GitHub',
	},
	gitee: {
		repoScopeUrl: 'https://gitee.com/api/v5/swagger#/getV5ReposOwnerRepoIssues',
		groupScopeUrl: 'https://gitee.com/api/v5/swagger#/getV5OrgsOrgRepos',
		issuesApiUrl: 'https://gitee.com/api/v5/swagger#/getV5ReposOwnerRepoIssues',
		displayName: 'Gitee',
	},
	unknown: {
		repoScopeUrl: 'https://docs.gitlab.com/api/projects/',
		groupScopeUrl: 'https://docs.gitlab.com/api/groups/',
		issuesApiUrl: 'https://docs.gitlab.com/api/issues/',
		displayName: 'configured host',
	},
};

export function getHostDocumentation(host: SupportedGitHost) {
	return HOST_DOCUMENTATION[host];
}

export function getGitlabApiVersion(apiBaseUrl: string): 'v4' | 'v5' {
	const normalizedApiBaseUrl = apiBaseUrl.trim().replace(/\/+$/, '');

	return /\/api\/v4(?:\/|$)/.test(normalizedApiBaseUrl) ? 'v4' : 'v5';
}

export function resolveGitlabApiBaseUrl(gitlabUrl: string, apiBaseUrl?: string): string {
	const explicitApiBaseUrl = apiBaseUrl?.trim().replace(/\/+$/, '');

	if (explicitApiBaseUrl) {
		return explicitApiBaseUrl;
	}

	return `${gitlabUrl.trim().replace(/\/+$/, '')}/api/v5`;
}

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
	internalMemberDirectory: {},
	issueLedgerStartMonth: '',
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
			'修复': 'bug',
			'没有恢复': 'bug',
			'避让键盘': 'bug',
			'链接问题': 'bug',
			'添加': 'requirement',
			'手册': 'requirement',
			'示例': 'requirement',
			'支持': 'requirement',
			'support': 'requirement',
			'adapt': 'requirement',
			'feat(': 'requirement',
			'Implementation': 'requirement',
			'改用': 'requirement',
			'替换': 'requirement',
			'适配': 'requirement',
			'替代': 'requirement',
			'前移': 'requirement',
			'下沉': 'requirement',
			'兼容': 'requirement',
			'非兼容': 'requirement',
			'编译兼容': 'requirement',
			'零侵入': 'requirement',
			'注释说明': 'requirement',
			'不易理解': 'requirement',
			'demo config': 'requirement',
			'打印模块名称': 'requirement',
			'自动化测试脚本': 'requirement',
			'安全键盘': 'bug',
			'页面上移高度不足': 'bug',
			'遮挡': 'bug',
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
		return resolveGitlabApiBaseUrl(this.gitlabUrl, this.apiBaseUrl);
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
	const internalMemberDirectory = normalizeInternalMemberDirectory(rawData.internalMemberDirectory);
	const issueLedgerStartMonth = normalizeIssueLedgerStartMonth(rawData.issueLedgerStartMonth);
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
		internalMemberDirectory,
		issueLedgerStartMonth,
		classificationRules,
		issueFilter: canonicalFilter,
		filter: canonicalFilter,
	};
}

function normalizeIssueLedgerStartMonth(value: unknown) {
	const startMonth = typeof value === 'string' ? value.trim() : '';
	return /^\d{4}-(0[1-9]|1[0-2])$/.test(startMonth) ? startMonth : '';
}

function normalizeInternalMemberDirectory(directory: unknown): Record<string, string> {
	if (!directory || typeof directory !== 'object' || Array.isArray(directory)) {
		return {};
	}

	return Object.fromEntries(
		Object.entries(directory)
			.filter(([username, name]) => username.trim().length > 0 && typeof name === 'string')
			.map(([username, name]) => [username.trim(), name.trim()]),
	);
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
			title: 'Git Host URL',
			description: 'Base URL for the Git host you want to sync from.',
			placeholder: 'https://gitcode.com',
			value: "gitlabUrl",
		},
			{
				title: 'API Base URL',
				description: 'Override the host API base URL when needed.',
				placeholder: 'https://gitcode.com/api/v5',
				value: 'apiBaseUrl',
			},
			{
				title: 'Personal Access Token',
				description: 'Create a personal access token for the configured host and enter it here.',
				placeholder: 'Token',
				value: "gitlabToken"
			},
			{
				title: 'Legacy Template File',
				description: 'Optional Obsidian note path used by the legacy compatibility importer.',
				placeholder: 'your-template-file.md',
				value: "templateFile"
			},
			{
				title: "Output Folder",
				description: 'Root folder for generated issue notes, metadata, and reports.',
				placeholder: "GitCode Issues",
				value: "outputDir",
				modifier: "normalizePath"
			},
			{
				title: 'Organization Name',
				description: 'The organization, owner, or group that owns the repositories.',
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
				title: 'Internal Member Directory',
				description: 'Authoritative GitCode account-to-name mapping for ledgers, reports, and roster-gap review. Listed accounts are confirmed internal.',
				placeholder: '{\n  "alice": "Alice"\n}',
				value: 'internalMemberDirectory',
				modifier: 'json',
				inputType: 'textarea'
			},
			{
				title: 'Issue Ledger Start Month',
				description: 'Only include issues created in this month or later. Use YYYY-MM; leave empty to include all dates.',
				placeholder: '2026-07',
				value: 'issueLedgerStartMonth'
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
				description: 'Raw query string appended to issue list endpoints for the configured host.',
				placeholder: '',
				value: 'issueFilter'
			}
		],
		dropdowns: [{
			title: 'Refresh Rate',
			description: "How often IssueTracker should refresh issues.",
			options: SHARED_OPTIONS.refreshRates,
			value: "intervalOfRefresh",
		},
			{
				title: "Legacy API Scope",
				description: "Compatibility mode for the original single-endpoint importer.",
				options: SHARED_OPTIONS.scopeOptionsEn,
				value: "gitlabIssuesLevel"
			}
		],
		checkBoxInputs: [{
			title: 'Purge generated issues that are no longer returned by the configured host?',
			value: "purgeIssues",
		},
			{
				title: 'Show the manual sync icon in the left ribbon?',
				value: 'showIcon',
			},
			{
				title: 'Refresh issues on startup?',
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
		getGitlabIssuesLevel: (currentLevel, host) => {
			const docs = getHostDocumentation(host);
			return currentLevel === 'group'
				? {title: "Organization", url: docs.groupScopeUrl}
				: {title: "Repository", url: docs.repoScopeUrl};
		},
		getGitlabIdSettingName: (currentLevelTitle) => `Set ${currentLevelTitle} identifier`,
		getGitlabIdLinkText: (currentLevelTitle) => `Open the ${currentLevelTitle} documentation.`,
		moreInformationTitle: 'References',
		getGitlabDocumentation: (host) => {
			const docs = getHostDocumentation(host);
			return {
				title: `View the ${docs.displayName} issues API documentation`,
				url: docs.issuesApiUrl,
			};
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
			title: 'Git 主机地址',
			description: '需要同步的 Git 主机基础地址。',
			placeholder: 'https://gitcode.com',
			value: "gitlabUrl",
		},
			{
				title: 'API 基础地址',
				description: '需要时可覆盖当前主机 API 的基础地址。',
				placeholder: 'https://gitcode.com/api/v5',
				value: 'apiBaseUrl',
			},
			{
				title: '个人访问令牌',
				description: '在当前主机上创建 personal access token，并填写到这里。',
				placeholder: 'Token',
				value: "gitlabToken"
			},
			{
				title: '兼容模式模板文件',
				description: '仅供旧兼容导入流程使用的 Obsidian 模板笔记路径。',
				placeholder: 'your-template-file.md',
				value: "templateFile"
			},
			{
				title: "输出目录",
				description: '生成 issue、元数据和报告的根目录。',
				placeholder: "GitCode Issues",
				value: "outputDir",
				modifier: "normalizePath"
			},
			{
				title: '组织名称',
				description: '拥有这些仓库的组织、owner 或 group 名称。',
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
				title: '内部成员目录',
				description: '用于台账、日报和名单待补全报告的权威 GitCode 账号到姓名映射，目录中的账号均视为已确认内部人员。',
				placeholder: '{\n  "alice": "Alice"\n}',
				value: 'internalMemberDirectory',
				modifier: 'json',
				inputType: 'textarea'
			},
			{
				title: 'Issue 台账开始月份',
				description: '仅导出该月份及之后创建的 issue，格式为 YYYY-MM；留空则不过滤创建时间。修改月份会重新建立台账序号。',
				placeholder: '2026-07',
				value: 'issueLedgerStartMonth'
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
				description: '附加到当前主机 issue 列表接口后的原始查询字符串。',
				placeholder: '',
				value: 'issueFilter'
			}
		],
		dropdowns: [{
			title: '刷新频率',
			description: "IssueTracker 拉取 issues 的频率。",
			options: SHARED_OPTIONS.refreshRates,
			value: "intervalOfRefresh",
		},
			{
				title: "兼容模式范围",
				description: "兼容原始单接口导入路径的旧设置。",
				options: SHARED_OPTIONS.scopeOptionsZh,
				value: "gitlabIssuesLevel"
			}
		],
		checkBoxInputs: [{
			title: '清理当前主机中已不再返回的生成 issue？',
			value: "purgeIssues",
		},
			{
				title: '在左侧边栏显示手动同步图标？',
				value: 'showIcon',
			},
			{
				title: '启动时自动刷新 issues？',
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
		getGitlabIssuesLevel: (currentLevel, host) => {
			const docs = getHostDocumentation(host);
			return currentLevel === 'group'
				? {title: "组织", url: docs.groupScopeUrl}
				: {title: "仓库", url: docs.repoScopeUrl};
		},
		getGitlabIdSettingName: (currentLevelTitle) => `设置${currentLevelTitle}标识`,
		getGitlabIdLinkText: (currentLevelTitle) => `打开${currentLevelTitle}文档。`,
		moreInformationTitle: '参考文档',
		getGitlabDocumentation: (host) => {
			const docs = getHostDocumentation(host);
			return {
				title: `查看 ${docs.displayName} issues API 文档`,
				url: docs.issuesApiUrl,
			};
		}
	}
};

export function getSettingsUi(language: UiLanguage): SettingsTab {
	return SETTINGS_BY_LANGUAGE[language];
}

export const settings = getSettingsUi(DEFAULT_SETTINGS.uiLanguage);
