export type GitlabIssuesLevel = 'personal' | 'project' | 'group';
export type GitlabRefreshInterval = "15" | "30" | "45" |"60" | "120" | "off";
export type RequestKind = 'bug' | 'requirement' | 'unknown';
export type UiLanguage = 'en' | 'zh-CN';
export type SupportedGitHost = 'gitcode' | 'gitlab' | 'github' | 'gitee' | 'unknown';

export interface ClassificationRules {
	titlePrefixes: Record<string, Exclude<RequestKind, 'unknown'>>;
	titleKeywords?: Record<string, Exclude<RequestKind, 'unknown'>>;
	labels: Record<string, Exclude<RequestKind, 'unknown'>>;
}

export interface GitlabIssuesSettings {
	gitlabUrl: string;
	apiBaseUrl: string;
	gitlabToken: string;
	uiLanguage: UiLanguage;
	gitlabIssuesLevel: GitlabIssuesLevel;
	orgName: string;
	repoList: string[];
	syncAllOrgRepos: boolean;
	gitlabAppId: string;
	internalUserWhitelist: string[];
	internalMemberDirectory: Record<string, string>;
	issueLedgerStartMonth: string;
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
	localNewIssueNotifications: boolean;
	feishuWebhookUrl: string;
	internalIssueAutoReplyEnabled: boolean;
	internalIssueAutoReplyTemplate: string;
	internalIssueAutoReplyDelayHours: number;
	intervalOfRefresh: GitlabRefreshInterval;
	gitlabApiUrl(): string;
}

export interface SettingOutLink {
	url: string;
	title: string;
}
export interface LanguageSetting extends Omit<Setting, "placeholder"> {
	options: Record<UiLanguage, string>;
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
		| "internalMemberDirectory"
		| "issueLedgerStartMonth"
		| "classificationRules"
		| "issuesFolder"
		| "metaFolder"
		| "reportsFolder"
		| "issueFilter"
		| "feishuWebhookUrl"
		| "internalIssueAutoReplyTemplate"
		| "internalIssueAutoReplyDelayHours"
	>,
	modifier?: 'normalizePath' | 'stringArray' | 'json' | 'number';
	inputType?: 'text' | 'textarea' | 'password' | 'number';
}
export interface DropdownInputs extends Setting {
	value: keyof Pick<GitlabIssuesSettings, "gitlabIssuesLevel" | "intervalOfRefresh">
	options: Record<string, string>
}
export interface SettingCheckboxInput extends Omit<Setting, "description"> {
	value: keyof Pick<GitlabIssuesSettings, "refreshOnStartup"| "purgeIssues"| 'showIcon' | 'generateDailyReports' | 'syncAllOrgRepos' | 'localNewIssueNotifications' | 'internalIssueAutoReplyEnabled'>
}

export interface SettingsTab {
	title: string,
	languageSetting: LanguageSetting,
	settingInputs: SettingInput[],
	dropdowns: DropdownInputs[]
	checkBoxInputs: SettingCheckboxInput[],
	getGitlabIssuesLevel: (currentLevel: Omit<GitlabIssuesLevel, "personal">, host: SupportedGitHost) => SettingOutLink;
	getGitlabIdSettingName: (currentLevelTitle: string) => string;
	getGitlabIdLinkText: (currentLevelTitle: string) => string;
	moreInformationTitle: string;
	getGitlabDocumentation: (host: SupportedGitHost) => SettingOutLink
}
