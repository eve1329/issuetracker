import {GitlabIssuesSettings, SettingsTab} from "./settings-types";

export const DEFAULT_SETTINGS: GitlabIssuesSettings = {
	gitlabUrl: 'https://gitcode.com',
	apiBaseUrl: 'https://gitcode.com/api/v5',
	gitlabToken: '',
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
		},
		titleKeywords: {
			'添加': 'requirement',
			'手册': 'requirement',
			'示例': 'requirement',
			'支持': 'requirement',
			'适配': 'requirement',
			'替代': 'requirement',
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

export const settings: SettingsTab = {
	title: 'GitLab Issues Configuration',
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
			placeholder: "Gitlab Issues",
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
		options: {off: "off", "15": "15", "30": "30", "45": "45", "60": "60", "120": "120"},
		value: "intervalOfRefresh",
	},
		{
			title: "GitLab Scope",
			description: "The scope at which the api request will pull.",
			options: {personal: "Personal", project: "Project", group: "Group"},
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
	gitlabDocumentation: {
		title: 'View the Gitlab documentation',
		url: 'https://docs.gitlab.com/ee/api/issues.html#list-issues'
	}
};
