import {NormalizedIssueNote} from '../Issues/issue-note';
import {
	buildIssueKey,
	deduplicateIssues,
	isOnOrAfterStartMonth,
	normalizeStartMonth,
} from '../Issues/issue-scope';

export interface InternalIdentitySettings {
	internalMemberDirectory?: Record<string, string>;
	internalUserWhitelist?: string[];
	internalReferencePrefixes?: string[];
}

export interface InternalIssueEvidence {
	kind: '内部编号' | '内部工作标记';
	value: string;
}

export interface InternalAuthorEvidence {
	issueKey: string;
	createdAt: string;
	state: string;
	kind: InternalIssueEvidence['kind'] | '协作者目录';
	value: string;
}

export type InternalIssuePredicate = (issue: NormalizedIssueNote) => boolean;

const DEFAULT_INTERNAL_REFERENCE_PREFIXES = ['IR', 'SR'];
export const DEFAULT_INTERNAL_TITLE_MARKERS = [
	'【fix】',
	'【bug】',
	'【门禁测试】',
	'门禁测试',
	'【release】',
	'【next】',
	'【需求】',
];

export function normalizeUsername(username: string) {
	return username.trim().toLowerCase();
}

export function normalizeInternalMemberDirectory(directory: Record<string, string> | undefined) {
	const result = new Map<string, string>();

	for (const [username, name] of Object.entries(directory ?? {})) {
		const normalizedUsername = normalizeUsername(username);
		if (normalizedUsername) {
			result.set(normalizedUsername, typeof name === 'string' ? name.trim() : '');
		}
	}

	return result;
}

export function buildKnownInternalUsernameSet(settings: InternalIdentitySettings) {
	return new Set([
		...normalizeInternalMemberDirectory(settings.internalMemberDirectory).keys(),
		...(settings.internalUserWhitelist ?? []).map(normalizeUsername),
	].filter(Boolean));
}

export function findInternalIssueEvidence(
	title: string,
	configuredPrefixes?: string[],
): InternalIssueEvidence | null {
	const internalReference = findInternalReference(title, configuredPrefixes);
	if (internalReference) {
		return {kind: '内部编号', value: internalReference};
	}

	const titleMarker = findInternalTitleMarker(title);
	return titleMarker ? {kind: '内部工作标记', value: titleMarker} : null;
}

/**
 * Indexes account-level identity evidence from every retained Issue revision.
 * Closed Issues remain evidence here even when callers choose not to render
 * them in a user-facing ledger.
 */
export function buildInternalAuthorEvidenceIndex(
	issues: NormalizedIssueNote[],
	settings: InternalIdentitySettings,
	startMonth?: string,
) {
	const evidenceByUsername = new Map<string, InternalAuthorEvidence[]>();
	const normalizedStartMonth = normalizeStartMonth(startMonth);

	for (const issue of deduplicateIssues(issues)) {
		if (!isOnOrAfterStartMonth(issue, normalizedStartMonth)) {
			continue;
		}

		const username = normalizeUsername(issue.authorUsername);
		if (!username) {
			continue;
		}

		const entries = evidenceByUsername.get(username) ?? [];
		const titleEvidence = findInternalIssueEvidence(issue.title, settings.internalReferencePrefixes);
		if (titleEvidence) {
			entries.push({
				issueKey: buildIssueKey(issue),
				createdAt: issue.createdAt,
				state: issue.state,
				kind: titleEvidence.kind,
				value: titleEvidence.value,
			});
		}

		if (issue.isInternalAuthor) {
			entries.push({
				issueKey: buildIssueKey(issue),
				createdAt: issue.createdAt,
				state: issue.state,
				kind: '协作者目录',
				value: formatCollaboratorEvidence(issue.internalMatchedBy),
			});
		}

		if (entries.length > 0) {
			evidenceByUsername.set(username, entries);
		}
	}

	for (const entries of evidenceByUsername.values()) {
		entries.sort(compareInternalAuthorEvidence);
	}

	return evidenceByUsername;
}

export function isIssueInternal(
	issue: NormalizedIssueNote,
	internalUsernames: Set<string>,
	configuredPrefixes?: string[],
) {
	return issue.isInternalAuthor
		|| internalUsernames.has(normalizeUsername(issue.authorUsername))
		|| Boolean(findInternalIssueEvidence(issue.title, configuredPrefixes));
}

function formatCollaboratorEvidence(internalMatchedBy: string) {
	const matchedBy = internalMatchedBy.trim();
	return matchedBy && matchedBy !== 'none'
		? `协作者目录:${matchedBy}`
		: '协作者目录';
}

function compareInternalAuthorEvidence(left: InternalAuthorEvidence, right: InternalAuthorEvidence) {
	const leftTime = Date.parse(left.createdAt);
	const rightTime = Date.parse(right.createdAt);
	if (Number.isFinite(leftTime) && Number.isFinite(rightTime) && leftTime !== rightTime) {
		return leftTime - rightTime;
	}
	if (Number.isFinite(leftTime) !== Number.isFinite(rightTime)) {
		return Number.isFinite(leftTime) ? -1 : 1;
	}
	return left.issueKey.localeCompare(right.issueKey)
		|| left.kind.localeCompare(right.kind)
		|| left.value.localeCompare(right.value);
}

function findInternalReference(title: string, configuredPrefixes: string[] | undefined) {
	const prefixes = (configuredPrefixes ?? DEFAULT_INTERNAL_REFERENCE_PREFIXES)
		.map((prefix) => prefix.trim())
		.filter((prefix) => /^[A-Za-z0-9]+$/.test(prefix));

	if (prefixes.length === 0) {
		return null;
	}

	const prefixPattern = prefixes.map(escapeRegExp).join('|');
	const pattern = new RegExp(`(?<![A-Za-z0-9])(?:${prefixPattern})[-_ ]?\\d+(?![A-Za-z0-9])`, 'i');
	return title.match(pattern)?.[0] ?? null;
}

function findInternalTitleMarker(title: string) {
	const normalizedTitle = title.toLocaleLowerCase();
	return DEFAULT_INTERNAL_TITLE_MARKERS.find((marker) => normalizedTitle.includes(marker.toLocaleLowerCase())) ?? null;
}

function escapeRegExp(value: string) {
	return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
