import {NormalizedIssueNote} from '../Issues/issue-note';
import {buildIssueKey, deduplicateIssues} from '../Issues/issue-scope';

export interface IssueNotificationState {
	seenIssueKeys: string[];
}

export interface NewExternalIssue {
	issueKey: string;
	sourceRepo: string;
	iid: number;
	title: string;
	authorName: string;
	authorUsername: string;
	webUrl: string;
}

export function normalizeIssueNotificationState(value: unknown): IssueNotificationState | null {
	if (!value || typeof value !== 'object' || Array.isArray(value)) {
		return null;
	}

	const seenIssueKeys = (value as {seenIssueKeys?: unknown}).seenIssueKeys;
	if (!Array.isArray(seenIssueKeys)) {
		return null;
	}

	return {
		seenIssueKeys: Array.from(new Set(
			seenIssueKeys
				.filter((issueKey): issueKey is string => typeof issueKey === 'string')
				.map((issueKey) => issueKey.trim())
				.filter(Boolean),
		)).sort(),
	};
}

export function buildIssueNotificationState(
	issues: NormalizedIssueNote[],
	previousState: IssueNotificationState | null,
): IssueNotificationState {
	const seenIssueKeys = new Set(previousState?.seenIssueKeys ?? []);
	for (const issue of deduplicateIssues(issues)) {
		seenIssueKeys.add(buildIssueKey(issue));
	}

	return {seenIssueKeys: Array.from(seenIssueKeys).sort()};
}

export function findNewExternalIssues(
	issues: NormalizedIssueNote[],
	previousState: IssueNotificationState | null,
): NewExternalIssue[] {
	if (!previousState) {
		return [];
	}

	const seenIssueKeys = new Set(previousState.seenIssueKeys);
	return deduplicateIssues(issues)
		.filter((issue) => !seenIssueKeys.has(buildIssueKey(issue)) && !issue.isInternalAuthor)
		.map((issue) => ({
			issueKey: buildIssueKey(issue),
			sourceRepo: issue.sourceRepo,
			iid: issue.iid,
			title: issue.title,
			authorName: issue.authorName,
			authorUsername: issue.authorUsername,
			webUrl: issue.webUrl,
		}));
}

export function formatLocalNewExternalIssueNotification(issues: NewExternalIssue[]): string {
	if (issues.length === 1) {
		const issue = issues[0];
		return `新增外部 Issue：${issue.sourceRepo}#${issue.iid} ${issue.title}`;
	}

	const preview = issues.slice(0, 3)
		.map((issue) => `${issue.sourceRepo}#${issue.iid} ${issue.title}`)
		.join('\n');
	const remaining = issues.length > 3 ? `\n另有 ${issues.length - 3} 条。` : '';
	return `新增 ${issues.length} 个外部 Issue：\n${preview}${remaining}`;
}
