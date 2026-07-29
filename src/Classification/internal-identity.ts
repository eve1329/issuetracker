import {NormalizedIssueNote} from '../Issues/issue-note';

export interface InternalIdentitySettings {
	internalMemberDirectory?: Record<string, string>;
	internalUserWhitelist?: string[];
	internalReferencePrefixes?: string[];
}

export interface InternalIssueEvidence {
	kind: '内部编号' | '内部工作标记';
	value: string;
}

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

export function isIssueInternal(
	issue: NormalizedIssueNote,
	knownInternalUsernames: Set<string>,
	configuredPrefixes?: string[],
) {
	return issue.isInternalAuthor
		|| knownInternalUsernames.has(normalizeUsername(issue.authorUsername))
		|| Boolean(findInternalIssueEvidence(issue.title, configuredPrefixes));
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
