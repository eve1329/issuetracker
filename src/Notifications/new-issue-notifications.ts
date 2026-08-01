import {NormalizedIssueNote} from '../Issues/issue-note';
import {buildIssueKey, deduplicateIssues} from '../Issues/issue-scope';

export type IssueAuthorType = 'internal' | 'external';

export interface NewIssue {
	issueKey: string;
	sourceRepo: string;
	iid: number;
	title: string;
	createdAt: string;
	authorName: string;
	authorUsername: string;
	webUrl: string;
	authorType: IssueAuthorType;
}

export interface FeishuDeliveryRecord {
	deliveredAt: string;
	authorType: IssueAuthorType;
}

export interface FeishuDeliveryState {
	pendingIssues: NewIssue[];
	deliveries: Record<string, FeishuDeliveryRecord>;
	sameDayInternalBackfillCheckedAt?: string;
}

export interface IssueNotificationState {
	seenIssueKeys: string[];
	feishuDelivery?: FeishuDeliveryState;
}

export function normalizeIssueNotificationState(value: unknown): IssueNotificationState | null {
	if (!value || typeof value !== 'object' || Array.isArray(value)) {
		return null;
	}

	const seenIssueKeys = (value as {seenIssueKeys?: unknown}).seenIssueKeys;
	if (!Array.isArray(seenIssueKeys)) {
		return null;
	}

	const state: IssueNotificationState = {
		seenIssueKeys: Array.from(new Set(
			seenIssueKeys
				.filter((issueKey): issueKey is string => typeof issueKey === 'string')
				.map((issueKey) => issueKey.trim())
				.filter(Boolean),
		)).sort(),
	};
	const feishuDelivery = normalizeFeishuDeliveryState((value as {feishuDelivery?: unknown}).feishuDelivery);
	if (feishuDelivery) {
		state.feishuDelivery = feishuDelivery;
	}
	return state;
}

export function buildIssueNotificationState(
	issues: NormalizedIssueNote[],
	previousState: IssueNotificationState | null,
): IssueNotificationState {
	const seenIssueKeys = new Set(previousState?.seenIssueKeys ?? []);
	for (const issue of deduplicateIssues(issues)) {
		seenIssueKeys.add(buildIssueKey(issue));
	}

	const state: IssueNotificationState = {seenIssueKeys: Array.from(seenIssueKeys).sort()};
	if (previousState?.feishuDelivery) {
		state.feishuDelivery = cloneFeishuDeliveryState(previousState.feishuDelivery);
	}
	return state;
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
		.map(toNewIssue);
}

export function queueFeishuIssueDeliveries(
	state: IssueNotificationState,
	issues: NewIssue[],
	sameDayInternalBackfillCheckedAt?: string,
): IssueNotificationState {
	const previousDelivery = state.feishuDelivery ?? {pendingIssues: [], deliveries: {}};
	const pendingByKey = new Map(
		previousDelivery.pendingIssues
			.filter((issue) => !previousDelivery.deliveries[issue.issueKey])
			.map((issue) => [issue.issueKey, issue]),
	);

	for (const issue of issues) {
		if (!previousDelivery.deliveries[issue.issueKey]) {
			pendingByKey.set(issue.issueKey, issue);
		}
	}

	return {
		...state,
		feishuDelivery: {
			pendingIssues: Array.from(pendingByKey.values()).sort((left, right) => left.issueKey.localeCompare(right.issueKey)),
			deliveries: {...previousDelivery.deliveries},
			...(sameDayInternalBackfillCheckedAt
				? {sameDayInternalBackfillCheckedAt}
				: previousDelivery.sameDayInternalBackfillCheckedAt
					? {sameDayInternalBackfillCheckedAt: previousDelivery.sameDayInternalBackfillCheckedAt}
					: {}),
		},
	};
}

export function findPendingFeishuIssues(state: IssueNotificationState): NewIssue[] {
	return state.feishuDelivery?.pendingIssues ?? [];
}

export function markFeishuIssuesDelivered(
	state: IssueNotificationState,
	issues: NewIssue[],
	deliveredAt: string,
): IssueNotificationState {
	const previousDelivery = state.feishuDelivery ?? {pendingIssues: [], deliveries: {}};
	const deliveredKeys = new Set(issues.map((issue) => issue.issueKey));
	const deliveries = {...previousDelivery.deliveries};
	for (const issue of issues) {
		deliveries[issue.issueKey] = {deliveredAt, authorType: issue.authorType};
	}

	return {
		...state,
		feishuDelivery: {
			...previousDelivery,
			deliveries,
			pendingIssues: previousDelivery.pendingIssues.filter((issue) => !deliveredKeys.has(issue.issueKey)),
		},
	};
}

export function findSameDayInternalFeishuBackfillIssues(
	issues: NormalizedIssueNote[],
	state: IssueNotificationState | null,
	now: string,
): NewIssue[] {
	if (!state || state.feishuDelivery?.sameDayInternalBackfillCheckedAt) {
		return [];
	}

	const seenIssueKeys = new Set(state.seenIssueKeys);
	return deduplicateIssues(issues)
		.filter((issue) => issue.isInternalAuthor
			&& seenIssueKeys.has(buildIssueKey(issue))
			&& isSameLocalDay(issue.createdAt, now))
		.map(toNewIssue);
}

export function formatIssueAuthorType(issue: Pick<NewIssue, 'authorType'>) {
	return issue.authorType === 'internal' ? '内部' : '外部';
}

export function formatNewIssueCounts(issues: NewIssue[]) {
	const internalCount = issues.filter((issue) => issue.authorType === 'internal').length;
	return `内部 ${internalCount} / 外部 ${issues.length - internalCount}`;
}

function toNewIssue(issue: NormalizedIssueNote): NewIssue {
	return {
		issueKey: buildIssueKey(issue),
		sourceRepo: issue.sourceRepo,
		iid: issue.iid,
		title: issue.title,
		createdAt: issue.createdAt,
		authorName: issue.authorName,
		authorUsername: issue.authorUsername,
		webUrl: issue.webUrl,
		authorType: issue.isInternalAuthor ? 'internal' : 'external',
	};
}

function normalizeFeishuDeliveryState(value: unknown): FeishuDeliveryState | null {
	if (!value || typeof value !== 'object' || Array.isArray(value)) {
		return null;
	}

	const rawState = value as {pendingIssues?: unknown; deliveries?: unknown; sameDayInternalBackfillCheckedAt?: unknown};
	const pendingIssues = Array.isArray(rawState.pendingIssues)
		? rawState.pendingIssues.map(normalizeNewIssue).filter((issue): issue is NewIssue => issue !== null)
		: [];
	const deliveries = normalizeFeishuDeliveries(rawState.deliveries);
	const state: FeishuDeliveryState = {
		pendingIssues: pendingIssues.filter((issue) => !deliveries[issue.issueKey]),
		deliveries,
	};
	if (typeof rawState.sameDayInternalBackfillCheckedAt === 'string' && rawState.sameDayInternalBackfillCheckedAt.trim()) {
		state.sameDayInternalBackfillCheckedAt = rawState.sameDayInternalBackfillCheckedAt;
	}
	return state;
}

function normalizeNewIssue(value: unknown): NewIssue | null {
	if (!value || typeof value !== 'object' || Array.isArray(value)) {
		return null;
	}

	const issue = value as Partial<NewIssue>;
	if (typeof issue.issueKey !== 'string' || !issue.issueKey.trim()
		|| typeof issue.sourceRepo !== 'string'
		|| typeof issue.iid !== 'number'
		|| typeof issue.title !== 'string'
		|| typeof issue.createdAt !== 'string'
		|| typeof issue.authorName !== 'string'
		|| typeof issue.authorUsername !== 'string'
		|| typeof issue.webUrl !== 'string'
		|| (issue.authorType !== 'internal' && issue.authorType !== 'external')) {
		return null;
	}

	return {
		issueKey: issue.issueKey.trim(),
		sourceRepo: issue.sourceRepo,
		iid: issue.iid,
		title: issue.title,
		createdAt: issue.createdAt,
		authorName: issue.authorName,
		authorUsername: issue.authorUsername,
		webUrl: issue.webUrl,
		authorType: issue.authorType,
	};
}

function normalizeFeishuDeliveries(value: unknown): Record<string, FeishuDeliveryRecord> {
	if (!value || typeof value !== 'object' || Array.isArray(value)) {
		return {};
	}

	const deliveries: Record<string, FeishuDeliveryRecord> = {};
	for (const [issueKey, rawRecord] of Object.entries(value as Record<string, unknown>)) {
		if (!issueKey.trim() || !rawRecord || typeof rawRecord !== 'object' || Array.isArray(rawRecord)) {
			continue;
		}
		const record = rawRecord as Partial<FeishuDeliveryRecord>;
		if (typeof record.deliveredAt !== 'string'
			|| (record.authorType !== 'internal' && record.authorType !== 'external')) {
			continue;
		}
		deliveries[issueKey.trim()] = {deliveredAt: record.deliveredAt, authorType: record.authorType};
	}
	return deliveries;
}

function cloneFeishuDeliveryState(state: FeishuDeliveryState): FeishuDeliveryState {
	return {
		pendingIssues: [...state.pendingIssues],
		deliveries: {...state.deliveries},
		...(state.sameDayInternalBackfillCheckedAt
			? {sameDayInternalBackfillCheckedAt: state.sameDayInternalBackfillCheckedAt}
			: {}),
	};
}

function isSameLocalDay(left: string, right: string) {
	const leftDate = new Date(left);
	const rightDate = new Date(right);
	return Number.isFinite(leftDate.getTime())
		&& Number.isFinite(rightDate.getTime())
		&& leftDate.getFullYear() === rightDate.getFullYear()
		&& leftDate.getMonth() === rightDate.getMonth()
		&& leftDate.getDate() === rightDate.getDate();
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
