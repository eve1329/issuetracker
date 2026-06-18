export type GitlabIssuesLevel = 'personal' | 'project' | 'group';
export type GitlabRefreshInterval = "15" | "30" | "45" |"60" | "120" | "off";
export type RequestKind = 'bug' | 'requirement' | 'unknown';

export interface ClassificationRules {
	titlePrefixes: Record<string, Exclude<RequestKind, 'unknown'>>;
	titleKeywords?: Record<string, Exclude<RequestKind, 'unknown'>>;
	labels: Record<string, Exclude<RequestKind, 'unknown'>>;
}

export interface GitlabIssuesSettings {
	gitlabUrl: string;
	apiBaseUrl: string;
	gitlabToken: string;
	gitlabIssuesLevel: GitlabIssuesLevel;
	orgName: string;
	repoList: string[];
	syncAllOrgRepos: boolean;
	gitlabAppId: string;
	internalUserWhitelist: string[];
	classificationRules: ClassificationRules;
	templateFile: string;
	outputDir: string;
	issuesFolder: string;
	metaFolder: string;
	reportsFolder: string;
	issueFilter: string;
	filter: string;
	generateDailyReports: boolean;
	showIcon: boolean;
	purgeIssues: boolean;
	refreshOnStartup: boolean;
	intervalOfRefresh: GitlabRefreshInterval;
	gitlabApiUrl(): string;
}

export interface SettingOutLink {
	url: string;
	title: string;
}
export interface Setting {
	title: string,
	description: string,
	placeholder?: string;
}
export interface SettingInput extends Setting {
	value: keyof Pick<
		GitlabIssuesSettings,
		| "gitlabUrl"
		| "apiBaseUrl"
		| "gitlabToken"
		| "templateFile"
		| "outputDir"
		| "orgName"
		| "repoList"
		| "internalUserWhitelist"
		| "classificationRules"
		| "issuesFolder"
		| "metaFolder"
		| "reportsFolder"
		| "issueFilter"
	>,
	modifier?: 'normalizePath' | 'stringArray' | 'json';
	inputType?: 'text' | 'textarea';
}
export interface DropdownInputs extends Setting {
	value: keyof Pick<GitlabIssuesSettings, "gitlabIssuesLevel" | "intervalOfRefresh">
	options: Record<string, string>
}
export interface SettingCheckboxInput extends Omit<Setting, "description"> {
	value: keyof Pick<GitlabIssuesSettings, "refreshOnStartup"| "purgeIssues"| 'showIcon' | 'generateDailyReports' | 'syncAllOrgRepos'>
}

export interface SettingsTab {
	title: string,
	settingInputs: SettingInput[],
	dropdowns: DropdownInputs[]
	checkBoxInputs: SettingCheckboxInput[],
	getGitlabIssuesLevel: (currentLevel: Omit<GitlabIssuesLevel, "personal">) => SettingOutLink;
	gitlabDocumentation: SettingOutLink
}
