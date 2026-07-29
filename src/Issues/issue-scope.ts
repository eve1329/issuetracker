import {NormalizedIssueNote} from './issue-note';

export function normalizeStartMonth(startMonth: string | undefined) {
	const normalized = startMonth?.trim() ?? '';
	return /^\d{4}-(0[1-9]|1[0-2])$/.test(normalized) ? normalized : '';
}

export function isOnOrAfterStartMonth(
	issue: Pick<NormalizedIssueNote, 'createdAt'>,
	startMonth: string,
) {
	if (!startMonth) {
		return true;
	}

	const createdAt = Date.parse(issue.createdAt);
	const startAt = Date.parse(`${startMonth}-01T00:00:00+08:00`);
	return Number.isFinite(createdAt) && createdAt >= startAt;
}

export function buildIssueKey(
	issue: Pick<NormalizedIssueNote, 'projectPath' | 'sourceRepo' | 'iid'>,
) {
	const projectPath = issue.projectPath.trim() || issue.sourceRepo.trim();
	return `${projectPath}#${issue.iid}`;
}

export function deduplicateIssues(issues: NormalizedIssueNote[]) {
	const byIssueKey = new Map<string, NormalizedIssueNote>();

	for (const issue of issues) {
		const issueKey = buildIssueKey(issue);
		const existingIssue = byIssueKey.get(issueKey);
		if (!existingIssue || compareUpdatedAt(issue.updatedAt, existingIssue.updatedAt) > 0) {
			byIssueKey.set(issueKey, issue);
		}
	}

	return [...byIssueKey.values()];
}

function compareUpdatedAt(left: string, right: string) {
	const leftTime = Date.parse(left);
	const rightTime = Date.parse(right);
	const leftIsValid = Number.isFinite(leftTime);
	const rightIsValid = Number.isFinite(rightTime);

	if (leftIsValid && rightIsValid) {
		return leftTime - rightTime;
	}
	if (leftIsValid !== rightIsValid) {
		return leftIsValid ? 1 : -1;
	}
	return left.localeCompare(right);
}
