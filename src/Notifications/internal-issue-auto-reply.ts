import {NormalizedIssueNote} from '../Issues/issue-note';
import {buildIssueKey, deduplicateIssues} from '../Issues/issue-scope';

export const DEFAULT_INTERNAL_ISSUE_AUTO_REPLY_TEMPLATE = '已收到，感谢反馈，我们会尽快跟进。';
export const DEFAULT_INTERNAL_ISSUE_AUTO_REPLY_DELAY_HOURS = 24;
export const INTERNAL_ISSUE_AUTO_REPLY_TRACKING_VERSION = 2;

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
	createdAt: string;
	firstResponseAt: string;
}

export interface InternalIssueAutoReplyDeliveryRecord {
	deliveredAt: string;
}

export interface InternalIssueAutoReplyState {
	trackingVersion: number;
	initialized: boolean;
	observedUnansweredIssueKeys: string[];
	pendingIssues: InternalIssueAutoReplyCandidate[];
	deliveries: Record<string, InternalIssueAutoReplyDeliveryRecord>;
}

export function normalizeInternalIssueAutoReplyState(value: unknown): InternalIssueAutoReplyState | null {
	if (!value || typeof value !== 'object' || Array.isArray(value)) {
		return null;
	}

	const rawState = value as {
		trackingVersion?: unknown;
		initialized?: unknown;
		observedUnansweredIssueKeys?: unknown;
		pendingIssues?: unknown;
		deliveries?: unknown;
	};
	if (typeof rawState.initialized !== 'boolean') {
		return null;
	}

	const deliveries = normalizeDeliveries(rawState.deliveries);
	const trackingVersion = rawState.trackingVersion === INTERNAL_ISSUE_AUTO_REPLY_TRACKING_VERSION
		? INTERNAL_ISSUE_AUTO_REPLY_TRACKING_VERSION
		: 1;
	const pendingIssues = Array.isArray(rawState.pendingIssues)
		? rawState.pendingIssues
			.map(normalizeCandidate)
			.filter((issue): issue is InternalIssueAutoReplyCandidate => issue !== null)
			.filter((issue) => !deliveries[issue.issueKey])
		: [];
	const observedUnansweredIssueKeys = trackingVersion === INTERNAL_ISSUE_AUTO_REPLY_TRACKING_VERSION
		&& Array.isArray(rawState.observedUnansweredIssueKeys)
		? Array.from(new Set(
			rawState.observedUnansweredIssueKeys
				.filter((issueKey): issueKey is string => typeof issueKey === 'string')
				.map((issueKey) => issueKey.trim())
				.filter(Boolean),
		)).sort()
		: [];

	return {
		trackingVersion,
		initialized: rawState.initialized,
		observedUnansweredIssueKeys,
		pendingIssues: sortCandidates(pendingIssues),
		deliveries,
	};
}

export function buildInternalIssueAutoReplyBaseline(
	issues: NormalizedIssueNote[],
	now = new Date().toISOString(),
	delayHours = DEFAULT_INTERNAL_ISSUE_AUTO_REPLY_DELAY_HOURS,
): InternalIssueAutoReplyState {
	const baselineCandidates = deduplicateIssues(issues)
		.filter(isUnansweredInternalOpenIssue);
	const nowTime = Date.parse(now);
	const pendingIssues = baselineCandidates
		.filter((issue) => {
			const dueAt = getInternalIssueAutoReplyDueAt(issue.createdAt, delayHours);
			return Boolean(dueAt) && Number.isFinite(nowTime) && Date.parse(dueAt) > nowTime;
		})
		.map(toCandidate);
	const pendingKeys = new Set(pendingIssues.map((issue) => issue.issueKey));
	const observedUnansweredIssueKeys = baselineCandidates
		.map(buildIssueKey)
		.filter((issueKey) => !pendingKeys.has(issueKey))
		.sort();

	return {
		trackingVersion: INTERNAL_ISSUE_AUTO_REPLY_TRACKING_VERSION,
		initialized: true,
		observedUnansweredIssueKeys,
		pendingIssues: sortCandidates(pendingIssues),
		deliveries: {},
	};
}

export function migrateInternalIssueAutoReplyState(
	state: InternalIssueAutoReplyState,
	issues: NormalizedIssueNote[],
	now = new Date().toISOString(),
	delayHours = DEFAULT_INTERNAL_ISSUE_AUTO_REPLY_DELAY_HOURS,
): InternalIssueAutoReplyState {
	if (state.trackingVersion === INTERNAL_ISSUE_AUTO_REPLY_TRACKING_VERSION) {
		return state;
	}

	const baseline = buildInternalIssueAutoReplyBaseline(issues, now, delayHours);
	const currentWeekStart = getCurrentShanghaiWeekStart(now);
	const pendingByKey = new Map(
		baseline.pendingIssues
			.filter((issue) => !state.deliveries[issue.issueKey])
			.map((issue) => [issue.issueKey, issue]),
	);
	if (Number.isFinite(currentWeekStart)) {
		for (const issue of deduplicateIssues(issues)) {
			const issueKey = buildIssueKey(issue);
			if (
				isUnansweredInternalOpenIssue(issue)
				&& !state.deliveries[issueKey]
				&& Date.parse(issue.createdAt) >= currentWeekStart
			) {
				pendingByKey.set(issueKey, toCandidate(issue));
			}
		}
	}
	const pendingIssues = sortCandidates(Array.from(pendingByKey.values()));
	const pendingIssueKeys = new Set(pendingIssues.map((issue) => issue.issueKey));

	return {
		...baseline,
		observedUnansweredIssueKeys: baseline.observedUnansweredIssueKeys
			.filter((issueKey) => !pendingIssueKeys.has(issueKey)),
		pendingIssues,
		deliveries: {...state.deliveries},
	};
}

export function queueInternalIssueAutoReplies(
	state: InternalIssueAutoReplyState,
	issues: NormalizedIssueNote[],
): InternalIssueAutoReplyState {
	if (!state.initialized) {
		return buildInternalIssueAutoReplyBaseline(issues);
	}

	const observedUnansweredIssueKeys = new Set(state.observedUnansweredIssueKeys);
	const candidatesByKey = new Map(
		deduplicateIssues(issues)
			.filter(isUnansweredInternalOpenIssue)
			.map((issue) => [buildIssueKey(issue), toCandidate(issue)]),
	);
	const pendingByKey = new Map(
		state.pendingIssues
			.filter((issue) => !state.deliveries[issue.issueKey] && candidatesByKey.has(issue.issueKey))
			.map((issue) => [issue.issueKey, issue]),
	);

	for (const [issueKey, candidate] of candidatesByKey) {
		if (
			observedUnansweredIssueKeys.has(issueKey)
			|| state.deliveries[issueKey]
			|| pendingByKey.has(issueKey)
		) {
			continue;
		}

		observedUnansweredIssueKeys.add(issueKey);
		pendingByKey.set(issueKey, candidate);
	}

	return {
		trackingVersion: INTERNAL_ISSUE_AUTO_REPLY_TRACKING_VERSION,
		initialized: true,
		observedUnansweredIssueKeys: Array.from(observedUnansweredIssueKeys).sort(),
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
		const dueAt = getInternalIssueAutoReplyDueAt(issue.createdAt, delayHours);
		return Boolean(dueAt) && Date.parse(dueAt) <= nowTime;
	});
}

export function getInternalIssueAutoReplyDueAt(createdAt: string, delayHours: unknown) {
	const createdTime = Date.parse(createdAt);
	if (!Number.isFinite(createdTime)) {
		return '';
	}

	const normalizedDelayHours = normalizeInternalIssueAutoReplyDelayHours(delayHours);
	return new Date(createdTime + normalizedDelayHours * 60 * 60 * 1000).toISOString();
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
	issue: Pick<InternalIssueAutoReplyCandidate, 'sourceRepo' | 'iid' | 'title' | 'webUrl' | 'authorName' | 'authorUsername' | 'createdAt' | 'firstResponseAt'>,
): string {
	const content = template.trim() || DEFAULT_INTERNAL_ISSUE_AUTO_REPLY_TEMPLATE;
	const replacements: Record<string, string> = {
		repo: issue.sourceRepo,
		iid: String(issue.iid),
		title: issue.title,
		url: issue.webUrl,
		author: issue.authorName || issue.authorUsername,
		authorUsername: issue.authorUsername,
		createdAt: issue.createdAt,
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
		createdAt: issue.createdAt,
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
		|| typeof issue.createdAt !== 'string'
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
		createdAt: issue.createdAt,
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

function isUnansweredInternalOpenIssue(issue: NormalizedIssueNote) {
	return issue.isInternalAuthor
		&& ['open', 'opened'].includes(issue.state.trim().toLowerCase())
		&& !issue.firstResponseAt.trim();
}

function getCurrentShanghaiWeekStart(now: string) {
	const nowTime = Date.parse(now);
	if (!Number.isFinite(nowTime)) {
		return Number.NaN;
	}

	// Asia/Shanghai has a fixed UTC+08:00 offset for all supported Issue dates.
	const shanghaiTime = new Date(nowTime + 8 * 60 * 60 * 1000);
	const daysSinceMonday = (shanghaiTime.getUTCDay() + 6) % 7;
	return Date.UTC(
		shanghaiTime.getUTCFullYear(),
		shanghaiTime.getUTCMonth(),
		shanghaiTime.getUTCDate() - daysSinceMonday,
	) - 8 * 60 * 60 * 1000;
}
