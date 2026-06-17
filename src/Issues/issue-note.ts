import {InternalMatchSource} from "../Members/member-types";
import {GitlabIssuesLevel, RequestKind} from "../SettingsTab/settings-types";

export interface NormalizedIssueNote {
	id: number;
	iid: number;
	title: string;
	state: string;
	createdAt: string;
	updatedAt: string;
	webUrl: string;
	projectId: number;
	projectPath: string;
	sourceScope: GitlabIssuesLevel;
	sourceRepo: string;
	authorUsername: string;
	authorName: string;
	isInternalAuthor: boolean;
	internalMatchedBy: InternalMatchSource;
	labels: string[];
	issueTypeRaw: string;
	requestKind: RequestKind;
	requestKindMatchedBy: 'title-prefix' | 'label' | 'none';
	referencesFull: string;
}

export function buildIssueNoteMarkdown(issue: NormalizedIssueNote): string {
	return [
		'---',
		`id: ${issue.id}`,
		`iid: ${issue.iid}`,
		`title: ${quoteYamlString(issue.title)}`,
		`state: ${issue.state}`,
		`createdAt: ${issue.createdAt}`,
		`updatedAt: ${issue.updatedAt}`,
		`webUrl: ${quoteYamlString(issue.webUrl)}`,
		`projectId: ${issue.projectId}`,
		`projectPath: ${quoteYamlString(issue.projectPath)}`,
		`sourceScope: ${quoteYamlString(issue.sourceScope)}`,
		`sourceRepo: ${quoteYamlString(issue.sourceRepo)}`,
		`authorUsername: ${quoteYamlString(issue.authorUsername)}`,
		`authorName: ${quoteYamlString(issue.authorName)}`,
		`isInternalAuthor: ${issue.isInternalAuthor}`,
		`internalMatchedBy: ${quoteYamlString(issue.internalMatchedBy)}`,
		renderLabels(issue.labels),
		`issueTypeRaw: ${quoteYamlString(issue.issueTypeRaw)}`,
		`requestKind: ${issue.requestKind}`,
		`requestKindMatchedBy: ${quoteYamlString(issue.requestKindMatchedBy)}`,
		`referencesFull: ${quoteYamlString(issue.referencesFull)}`,
		'---',
		'',
		`# ${issue.title}`,
		'',
	].join('\n');
}

function quoteYamlString(value: string) {
	return JSON.stringify(value);
}

function renderLabels(labels: string[]) {
	if (labels.length === 0) {
		return 'labels: []';
	}

	return `labels:\n${labels.map((label) => `  - ${quoteYamlString(label)}`).join('\n')}`;
}
