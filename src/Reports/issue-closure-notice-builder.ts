import {NormalizedIssueNote} from '../Issues/issue-note';

export interface IssueClosureState {
	closedIssueKeys: string[];
	startMonth?: string;
}

export interface IssueClosureNoticeSettings {
	startMonth?: string;
}

export interface ClosedIssueReminder {
	key: string;
	title: string;
	url: string;
	projectPath: string;
	state: string;
	requestKind: NormalizedIssueNote['requestKind'];
	updatedAt: string;
}

export interface IssueClosureNotice {
	newlyClosed: ClosedIssueReminder[];
	currentlyClosed: ClosedIssueReminder[];
	state: IssueClosureState;
	markdown: string;
}

export function buildIssueClosureNotice(
	issues: NormalizedIssueNote[],
	previousState: IssueClosureState | null | undefined,
	settings: IssueClosureNoticeSettings = {},
): IssueClosureNotice {
	const startMonth = normalizeStartMonth(settings.startMonth);
	const resetState = normalizeStartMonth(previousState?.startMonth) !== startMonth;
	const previousClosedKeys = resetState
		? new Set<string>()
		: new Set(normalizeClosedIssueKeys(previousState?.closedIssueKeys));
	const currentlyClosed = deduplicateIssues(issues)
		.filter((issue) => isOnOrAfterStartMonth(issue, startMonth))
		.filter((issue) => isClosedIssue(issue))
		.map(toClosedIssueReminder)
		.sort(compareReminders);
	const newlyClosed = currentlyClosed.filter((issue) => !previousClosedKeys.has(issue.key));
	const state: IssueClosureState = {
		closedIssueKeys: currentlyClosed.map((issue) => issue.key),
		...(startMonth ? {startMonth} : {}),
	};

	return {
		newlyClosed,
		currentlyClosed,
		state,
		markdown: buildIssueClosureNoticeMarkdown(newlyClosed, currentlyClosed, startMonth, resetState),
	};
}

export function buildIssueClosureNoticeMarkdown(
	newlyClosed: ClosedIssueReminder[],
	currentlyClosed: ClosedIssueReminder[],
	startMonth: string,
	isInitialBaseline: boolean,
) {
	const scope = startMonth
		? `仅统计 ${startMonth} 及之后创建的 Issue。`
		: '统计全部创建时间范围内的 Issue。';
	const baselineNotice = isInitialBaseline
		? '> 首次建立提醒基线：当前已关闭的 Issue 会列在“本次新关闭”中，后续同步仅提示状态发生变化的 Issue。\n\n'
		: '';

	return [
		'# Issue 关闭提醒',
		'',
		`> ${scope}`,
		'',
		baselineNotice.trimEnd(),
		'## 本次新关闭',
		'',
		formatReminderList(newlyClosed, '本次同步未发现新的关闭 Issue。'),
		'',
		`## 当前已关闭（${currentlyClosed.length}）`,
		'',
		formatReminderList(currentlyClosed, '当前没有符合范围的已关闭 Issue。'),
		'',
	].filter((line, index, lines) => line.length > 0 || lines[index - 1]?.length !== 0).join('\n');
}

function normalizeStartMonth(startMonth: string | undefined) {
	const normalized = startMonth?.trim() ?? '';
	return /^\d{4}-(0[1-9]|1[0-2])$/.test(normalized) ? normalized : '';
}

function normalizeClosedIssueKeys(issueKeys: string[] | undefined) {
	return [...new Set((issueKeys ?? []).filter((issueKey) => typeof issueKey === 'string' && issueKey.trim().length > 0))]
		.sort((left, right) => left.localeCompare(right));
}

function isOnOrAfterStartMonth(issue: Pick<NormalizedIssueNote, 'createdAt'>, startMonth: string) {
	if (!startMonth) {
		return true;
	}

	const createdAt = new Date(issue.createdAt).getTime();
	const startAt = new Date(`${startMonth}-01T00:00:00+08:00`).getTime();
	return Number.isFinite(createdAt) && createdAt >= startAt;
}

function isClosedIssue(issue: Pick<NormalizedIssueNote, 'state'>) {
	return issue.state.trim().toLowerCase() === 'closed';
}

function deduplicateIssues(issues: NormalizedIssueNote[]) {
	const byKey = new Map<string, NormalizedIssueNote>();

	for (const issue of issues) {
		const key = buildIssueKey(issue);
		const existingIssue = byKey.get(key);
		if (!existingIssue || issue.updatedAt > existingIssue.updatedAt) {
			byKey.set(key, issue);
		}
	}

	return [...byKey.values()];
}

function toClosedIssueReminder(issue: NormalizedIssueNote): ClosedIssueReminder {
	return {
		key: buildIssueKey(issue),
		title: issue.title,
		url: issue.webUrl,
		projectPath: issue.projectPath || issue.sourceRepo,
		state: issue.state,
		requestKind: issue.requestKind,
		updatedAt: issue.updatedAt,
	};
}

function buildIssueKey(issue: Pick<NormalizedIssueNote, 'projectPath' | 'sourceRepo' | 'iid'>) {
	const projectPath = issue.projectPath.trim() || issue.sourceRepo.trim();
	return `${projectPath}#${issue.iid}`;
}

function compareReminders(left: ClosedIssueReminder, right: ClosedIssueReminder) {
	return right.updatedAt.localeCompare(left.updatedAt) || left.key.localeCompare(right.key);
}

function formatReminderList(reminders: ClosedIssueReminder[], emptyMessage: string) {
	if (reminders.length === 0) {
		return `- ${emptyMessage}`;
	}

	return reminders.map((issue) => {
		const label = escapeMarkdownText(`${issue.key}：${issue.title}`);
		const issueLink = issue.url.trim()
			? `[${label}](<${issue.url.trim().replace(/>/g, '%3E')}>)`
			: label;

		return [
			`- ${issueLink}`,
			`  - 来源仓库：${escapeMarkdownText(issue.projectPath)}`,
			`  - 分类：${formatRequestKind(issue.requestKind)}`,
			`  - 最后更新时间：${escapeMarkdownText(issue.updatedAt)}`,
		].join('\n');
	}).join('\n');
}

function formatRequestKind(requestKind: NormalizedIssueNote['requestKind']) {
	switch (requestKind) {
		case 'bug':
			return '缺陷';
		case 'requirement':
			return '需求';
		default:
			return '未分类';
	}
}

function escapeMarkdownText(value: string) {
	return value.replace(/[\\[\]]/g, '\\$&');
}
