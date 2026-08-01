import {NormalizedIssueNote} from '../Issues/issue-note';
import {buildIssueKey, deduplicateIssues} from '../Issues/issue-scope';

export interface IssueNotificationState {
	seenIssueKeys: string[];
}

export type IssueAuthorType = 'internal' | 'external';

export interface NewIssue {
	issueKey: string;
	sourceRepo: string;
	iid: number;
	title: string;
	authorName: string;
	authorUsername: string;
	webUrl: string;
	authorType: IssueAuthorType;
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

export function findNewIssues(
	issues: NormalizedIssueNote[],
	previousState: IssueNotificationState | null,
): NewIssue[] {
	if (!previousState) {
		return [];
	}

	const seenIssueKeys = new Set(previousState.seenIssueKeys);
	return deduplicateIssues(issues)
		.filter((issue) => !seenIssueKeys.has(buildIssueKey(issue)))
		.map((issue) => ({
			issueKey: buildIssueKey(issue),
			sourceRepo: issue.sourceRepo,
			iid: issue.iid,
			title: issue.title,
			authorName: issue.authorName,
			authorUsername: issue.authorUsername,
			webUrl: issue.webUrl,
			authorType: issue.isInternalAuthor ? 'internal' : 'external',
		}));
}

export function formatIssueAuthorType(issue: Pick<NewIssue, 'authorType'>) {
	return issue.authorType === 'internal' ? '内部' : '外部';
}

export function formatNewIssueCounts(issues: NewIssue[]) {
	const internalCount = issues.filter((issue) => issue.authorType === 'internal').length;
	return `内部 ${internalCount} / 外部 ${issues.length - internalCount}`;
}

export function formatLocalNewIssueNotification(issues: NewIssue[]): string {
	if (issues.length === 1) {
		const issue = issues[0];
		return `新增${formatIssueAuthorType(issue)} Issue：${issue.sourceRepo}#${issue.iid} ${issue.title}`;
	}

	const preview = issues.slice(0, 3)
		.map((issue) => `[${formatIssueAuthorType(issue)}] ${issue.sourceRepo}#${issue.iid} ${issue.title}`)
		.join('\n');
	const remaining = issues.length > 3 ? `\n另有 ${issues.length - 3} 条。` : '';
	return `新增 ${issues.length} 个 Issue（${formatNewIssueCounts(issues)}）：\n${preview}${remaining}`;
}
