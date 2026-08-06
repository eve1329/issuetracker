import {NormalizedIssueNote} from '../Issues/issue-note';
import {buildIssueKey, deduplicateIssues} from '../Issues/issue-scope';

export const DEFAULT_INTERNAL_ISSUE_AUTO_REPLY_TEMPLATE = '已收到，感谢反馈，我们会尽快跟进。';
export const DEFAULT_INTERNAL_ISSUE_AUTO_REPLY_DELAY_HOURS = 24;

export function buildInternalIssueAutoReplyMarker(issueKey: string) {
	return `<!-- issuetracker-auto-reply:${issueKey} -->`;
}

export function appendInternalIssueAutoReplyMarker(body: string, issueKey: string) {
	return `${body.trim()}\n\n${buildInternalIssueAutoReplyMarker(issueKey)}`;
}

export interface InternalIssueAutoReplyCandidate {
	issueKey: string;
	sourceRepo: string;
	iid: number;
	title: string;
	webUrl: string;
	authorName: string;
	authorUsername: string;
	firstResponseAt: string;
}

export interface InternalIssueAutoReplyDeliveryRecord {
	deliveredAt: string;
}

export interface InternalIssueAutoReplyState {
	initialized: boolean;
	observedFirstResponseIssueKeys: string[];
	pendingIssues: InternalIssueAutoReplyCandidate[];
	deliveries: Record<string, InternalIssueAutoReplyDeliveryRecord>;
}

export function normalizeInternalIssueAutoReplyState(value: unknown): InternalIssueAutoReplyState | null {
	if (!value || typeof value !== 'object' || Array.isArray(value)) {
		return null;
	}

	const rawState = value as {
		initialized?: unknown;
		observedFirstResponseIssueKeys?: unknown;
		pendingIssues?: unknown;
		deliveries?: unknown;
	};
	if (typeof rawState.initialized !== 'boolean') {
		return null;
	}

	const deliveries = normalizeDeliveries(rawState.deliveries);
	const pendingIssues = Array.isArray(rawState.pendingIssues)
		? rawState.pendingIssues
			.map(normalizeCandidate)
			.filter((issue): issue is InternalIssueAutoReplyCandidate => issue !== null)
			.filter((issue) => !deliveries[issue.issueKey])
		: [];
	const observedFirstResponseIssueKeys = Array.isArray(rawState.observedFirstResponseIssueKeys)
		? Array.from(new Set(
			rawState.observedFirstResponseIssueKeys
				.filter((issueKey): issueKey is string => typeof issueKey === 'string')
				.map((issueKey) => issueKey.trim())
				.filter(Boolean),
		)).sort()
		: [];

	return {
		initialized: rawState.initialized,
		observedFirstResponseIssueKeys,
		pendingIssues: sortCandidates(pendingIssues),
		deliveries,
	};
}

export function buildInternalIssueAutoReplyBaseline(
	issues: NormalizedIssueNote[],
): InternalIssueAutoReplyState {
	const observedFirstResponseIssueKeys = Array.from(new Set(
		deduplicateIssues(issues)
			.filter((issue) => issue.isInternalAuthor && Boolean(issue.firstResponseAt.trim()))
			.map(buildIssueKey),
	)).sort();

	return {
		initialized: true,
		observedFirstResponseIssueKeys,
		pendingIssues: [],
		deliveries: {},
	};
}

export function queueInternalIssueAutoReplies(
	state: InternalIssueAutoReplyState,
	issues: NormalizedIssueNote[],
): InternalIssueAutoReplyState {
	if (!state.initialized) {
		return buildInternalIssueAutoReplyBaseline(issues);
	}

	const observedFirstResponseIssueKeys = new Set(state.observedFirstResponseIssueKeys);
	const pendingByKey = new Map(
		state.pendingIssues
			.filter((issue) => !state.deliveries[issue.issueKey])
			.map((issue) => [issue.issueKey, issue]),
	);

	for (const issue of deduplicateIssues(issues)) {
		if (!issue.isInternalAuthor || !issue.firstResponseAt.trim()) {
			continue;
		}

		const issueKey = buildIssueKey(issue);
		if (observedFirstResponseIssueKeys.has(issueKey) || state.deliveries[issueKey]) {
			continue;
		}

		observedFirstResponseIssueKeys.add(issueKey);
		pendingByKey.set(issueKey, toCandidate(issue));
	}

	return {
		initialized: true,
		observedFirstResponseIssueKeys: Array.from(observedFirstResponseIssueKeys).sort(),
		pendingIssues: sortCandidates(Array.from(pendingByKey.values())),
		deliveries: {...state.deliveries},
	};
}

export function findPendingInternalIssueAutoReplies(
	state: InternalIssueAutoReplyState,
	now = new Date().toISOString(),
	delayHours = DEFAULT_INTERNAL_ISSUE_AUTO_REPLY_DELAY_HOURS,
): InternalIssueAutoReplyCandidate[] {
	const nowTime = Date.parse(now);
	if (!Number.isFinite(nowTime)) {
		return [];
	}

	return state.pendingIssues.filter((issue) => {
		const dueAt = getInternalIssueAutoReplyDueAt(issue.firstResponseAt, delayHours);
		return Boolean(dueAt) && Date.parse(dueAt) <= nowTime;
	});
}

export function getInternalIssueAutoReplyDueAt(firstResponseAt: string, delayHours: unknown) {
	const firstResponseTime = Date.parse(firstResponseAt);
	if (!Number.isFinite(firstResponseTime)) {
		return '';
	}

	const normalizedDelayHours = normalizeInternalIssueAutoReplyDelayHours(delayHours);
	return new Date(firstResponseTime + normalizedDelayHours * 60 * 60 * 1000).toISOString();
}

export function normalizeInternalIssueAutoReplyDelayHours(value: unknown) {
	const rawValue = typeof value === 'string' ? value.trim() : value;
	if (rawValue === '' || (typeof rawValue !== 'number' && typeof rawValue !== 'string')) {
		return DEFAULT_INTERNAL_ISSUE_AUTO_REPLY_DELAY_HOURS;
	}

	const delayHours = Number(rawValue);
	return Number.isFinite(delayHours) && delayHours >= 0
		? delayHours
		: DEFAULT_INTERNAL_ISSUE_AUTO_REPLY_DELAY_HOURS;
}

export function markInternalIssueAutoRepliesDelivered(
	state: InternalIssueAutoReplyState,
	issues: InternalIssueAutoReplyCandidate[],
	deliveredAt: string,
): InternalIssueAutoReplyState {
	const deliveredKeys = new Set(issues.map((issue) => issue.issueKey));
	const deliveries = {...state.deliveries};
	for (const issue of issues) {
		deliveries[issue.issueKey] = {deliveredAt};
	}

	return {
		...state,
		deliveries,
		pendingIssues: state.pendingIssues.filter((issue) => !deliveredKeys.has(issue.issueKey)),
	};
}

export function formatInternalIssueAutoReply(
	template: string,
	issue: Pick<InternalIssueAutoReplyCandidate, 'sourceRepo' | 'iid' | 'title' | 'webUrl' | 'authorName' | 'authorUsername' | 'firstResponseAt'>,
): string {
	const content = template.trim() || DEFAULT_INTERNAL_ISSUE_AUTO_REPLY_TEMPLATE;
	const replacements: Record<string, string> = {
		repo: issue.sourceRepo,
		iid: String(issue.iid),
		title: issue.title,
		url: issue.webUrl,
		author: issue.authorName || issue.authorUsername,
		authorUsername: issue.authorUsername,
		firstResponseAt: issue.firstResponseAt,
	};

	return content.replace(/\{\{\s*([a-zA-Z]+)\s*\}\}/g, (match, key: string) => (
		Object.prototype.hasOwnProperty.call(replacements, key) ? replacements[key] : match
	));
}

function toCandidate(issue: NormalizedIssueNote): InternalIssueAutoReplyCandidate {
	return {
		issueKey: buildIssueKey(issue),
		sourceRepo: issue.sourceRepo,
		iid: issue.iid,
		title: issue.title,
		webUrl: issue.webUrl,
		authorName: issue.authorName,
		authorUsername: issue.authorUsername,
		firstResponseAt: issue.firstResponseAt,
	};
}

function normalizeCandidate(value: unknown): InternalIssueAutoReplyCandidate | null {
	if (!value || typeof value !== 'object' || Array.isArray(value)) {
		return null;
	}

	const issue = value as Partial<InternalIssueAutoReplyCandidate>;
	if (typeof issue.issueKey !== 'string' || !issue.issueKey.trim()
		|| typeof issue.sourceRepo !== 'string'
		|| typeof issue.iid !== 'number' || !Number.isFinite(issue.iid)
		|| typeof issue.title !== 'string'
		|| typeof issue.webUrl !== 'string'
		|| typeof issue.authorName !== 'string'
		|| typeof issue.authorUsername !== 'string'
		|| typeof issue.firstResponseAt !== 'string') {
		return null;
	}

	return {
		issueKey: issue.issueKey.trim(),
		sourceRepo: issue.sourceRepo,
		iid: issue.iid,
		title: issue.title,
		webUrl: issue.webUrl,
		authorName: issue.authorName,
		authorUsername: issue.authorUsername,
		firstResponseAt: issue.firstResponseAt,
	};
}

function normalizeDeliveries(value: unknown): Record<string, InternalIssueAutoReplyDeliveryRecord> {
	if (!value || typeof value !== 'object' || Array.isArray(value)) {
		return {};
	}

	const deliveries: Record<string, InternalIssueAutoReplyDeliveryRecord> = {};
	for (const [issueKey, rawRecord] of Object.entries(value as Record<string, unknown>)) {
		if (!issueKey.trim() || !rawRecord || typeof rawRecord !== 'object' || Array.isArray(rawRecord)) {
			continue;
		}

		const record = rawRecord as Partial<InternalIssueAutoReplyDeliveryRecord>;
		if (typeof record.deliveredAt !== 'string' || !record.deliveredAt.trim()) {
			continue;
		}
		deliveries[issueKey.trim()] = {deliveredAt: record.deliveredAt};
	}
	return deliveries;
}

function sortCandidates(candidates: InternalIssueAutoReplyCandidate[]) {
	return candidates.sort((left, right) => left.issueKey.localeCompare(right.issueKey));
}
