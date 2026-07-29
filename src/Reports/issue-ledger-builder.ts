import {NormalizedIssueNote} from "../Issues/issue-note";

export interface IssueLedgerSerialState {
	nextSerial: number;
	serialByIssueKey: Record<string, number>;
	startMonth?: string;
}

export interface IssueLedgerSettings {
	internalMemberDirectory?: Record<string, string>;
	internalUserWhitelist?: string[];
	internalReferencePrefixes?: string[];
	startMonth?: string;
}

export interface IssueLedgerRow {
	serial: number;
	issueKey: string;
	title: string;
	url: string;
	responsible: string;
	category: string;
	state: string;
	createdAt: string;
	username: string;
	name: string;
	personnelType: '内部' | '外部伙伴';
	department: string;
	firstResponseAt: string;
	firstResponseDuration: string;
	evidence: string;
}

export interface IssueLedgerBuildResult {
	rows: IssueLedgerRow[];
	csv: string;
	serialState: IssueLedgerSerialState;
}

export const ISSUE_LEDGER_HEADERS = [
	'序号',
	'问题',
	'链接',
	'响应人/责任人',
	'分类',
	'状态',
	'Issue来源方',
	'code账号',
	'姓名',
	'公司部门',
	'创建时间',
	'首次相应时间',
	'首次相应时长格式',
];
const DEFAULT_INTERNAL_REFERENCE_PREFIXES = ['IR', 'SR'];
const DEFAULT_INTERNAL_TITLE_MARKERS = ['【fix】', '【门禁测试】', '【release】', '【next】', '【需求】'];
const CREATED_AT_FORMATTER = new Intl.DateTimeFormat('en-US', {
	timeZone: 'Asia/Shanghai',
	year: 'numeric',
	month: 'numeric',
	day: 'numeric',
	hour: '2-digit',
	minute: '2-digit',
	second: '2-digit',
	hourCycle: 'h23',
});

export function buildIssueLedger(
	issues: NormalizedIssueNote[],
	settings: IssueLedgerSettings,
	previousState?: IssueLedgerSerialState | null,
): IssueLedgerBuildResult {
	const directory = normalizeDirectory(settings.internalMemberDirectory);
	const whitelist = new Set((settings.internalUserWhitelist ?? []).map(normalizeUsername).filter(Boolean));
	for (const username of directory.keys()) {
		whitelist.add(username);
	}

	const uniqueIssues = deduplicateIssues(issues);
	const startMonth = normalizeStartMonth(settings.startMonth);
	const eligibleIssues = uniqueIssues.filter((issue) => isOnOrAfterStartMonth(issue, startMonth));
	const eligibleIssueKeys = new Set(eligibleIssues.map(buildIssueKey));
	const shouldResetSerialState = normalizeStartMonth(previousState?.startMonth) !== startMonth;
	const serialByIssueKey = shouldResetSerialState
		? {}
		: Object.fromEntries(
			Object.entries(normalizeSerialByIssueKey(previousState?.serialByIssueKey))
				.filter(([issueKey]) => eligibleIssueKeys.has(issueKey)),
		);
	let nextSerial = shouldResetSerialState
		? 1
		: resolveNextSerial(previousState?.nextSerial, serialByIssueKey);
	const previouslyTrackedIssueKeys = new Set(Object.keys(serialByIssueKey));

	for (const issue of [...eligibleIssues].filter((issue) => !isClosedIssue(issue)).sort(compareNewIssues)) {
		const issueKey = buildIssueKey(issue);
		if (!serialByIssueKey[issueKey]) {
			serialByIssueKey[issueKey] = nextSerial;
			nextSerial += 1;
		}
	}

	const rows = eligibleIssues
		.filter((issue) => !isClosedIssue(issue) || previouslyTrackedIssueKeys.has(buildIssueKey(issue)))
		.map((issue) => {
			const issueKey = buildIssueKey(issue);
			const serial = serialByIssueKey[issueKey];
			if (serial === undefined) {
				throw new Error(`Missing ledger serial for ${issueKey}`);
			}

			return buildRow(issue, serial, directory, whitelist, settings);
		})
		.sort((left, right) => left.serial - right.serial || left.issueKey.localeCompare(right.issueKey));

	return {
		rows,
		csv: buildCsv(rows),
		serialState: {
			nextSerial,
			serialByIssueKey,
			...(startMonth ? {startMonth} : {}),
		},
	};
}

function normalizeStartMonth(startMonth: string | undefined) {
	const normalized = startMonth?.trim() ?? '';
	return /^\d{4}-(0[1-9]|1[0-2])$/.test(normalized) ? normalized : '';
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

function buildRow(
	issue: NormalizedIssueNote,
	serial: number,
	directory: Map<string, string>,
	whitelist: Set<string>,
	settings: IssueLedgerSettings,
): IssueLedgerRow {
	const username = normalizeUsername(issue.authorUsername);
	const directoryName = directory.get(username);
	const isWhitelisted = whitelist.has(username);
	const identity = resolvePersonnelType(issue, username, directoryName, isWhitelisted);
	const internalEvidence = findInternalReference(issue.title, settings.internalReferencePrefixes)
		?? findInternalTitleMarker(issue.title);
	const personnelType = identity?.personnelType
		?? (internalEvidence ? '内部' : '外部伙伴');
	const evidence = identity?.evidence
		?? internalEvidence
		?? '未提供账号，未命中内部编号或工作标记';

	return {
		serial,
		issueKey: buildIssueKey(issue),
		title: issue.title,
		url: issue.webUrl,
		responsible: '',
		category: formatCategory(issue.requestKind),
		state: issue.state,
		createdAt: formatCreatedAt(issue.createdAt),
		username: issue.authorUsername,
		name: directoryName || issue.authorName,
		personnelType,
		department: '',
		firstResponseAt: '',
		firstResponseDuration: '',
		evidence,
	};
}

function resolvePersonnelType(
	issue: Pick<NormalizedIssueNote, 'isInternalAuthor' | 'internalMatchedBy'>,
	username: string,
	directoryName: string | undefined,
	isWhitelisted: boolean,
): {personnelType: IssueLedgerRow['personnelType']; evidence: string} | null {
	if (directoryName !== undefined) {
		return {personnelType: '内部', evidence: '成员目录'};
	}

	if (isWhitelisted) {
		return {personnelType: '内部', evidence: '白名单'};
	}

	if (issue.isInternalAuthor) {
		return {personnelType: '内部', evidence: `协作者目录:${issue.internalMatchedBy}`};
	}

	// A supplied account has an identity classification. Title markers cannot overwrite it.
	if (username) {
		return {personnelType: '外部伙伴', evidence: '外部账号'};
	}

	return null;
}

function formatCreatedAt(createdAt: string) {
	const date = new Date(createdAt);
	if (Number.isNaN(date.getTime())) {
		return createdAt;
	}

	const parts = new Map(
		CREATED_AT_FORMATTER.formatToParts(date)
			.map((part) => [part.type, part.value]),
	);
	return `${parts.get('year')}/${Number(parts.get('month'))}/${Number(parts.get('day'))}`
		+ ` ${parts.get('hour')}:${parts.get('minute')}:${parts.get('second')}`;
}

function formatCategory(requestKind: NormalizedIssueNote['requestKind']) {
	switch (requestKind) {
		case 'bug':
			return '缺陷';
		case 'requirement':
			return '需求';
		default:
			return '';
	}
}

function buildIssueKey(issue: Pick<NormalizedIssueNote, 'projectPath' | 'sourceRepo' | 'iid'>) {
	const projectPath = issue.projectPath.trim() || issue.sourceRepo.trim();
	return `${projectPath}#${issue.iid}`;
}

function normalizeDirectory(directory: Record<string, string> | undefined) {
	const result = new Map<string, string>();

	for (const [username, name] of Object.entries(directory ?? {})) {
		const normalizedUsername = normalizeUsername(username);
		if (normalizedUsername) {
			result.set(normalizedUsername, typeof name === 'string' ? name.trim() : '');
		}
	}

	return result;
}

function normalizeUsername(username: string) {
	return username.trim().toLowerCase();
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

function normalizeSerialByIssueKey(serialByIssueKey: Record<string, number> | undefined) {
	return Object.fromEntries(
		Object.entries(serialByIssueKey ?? {}).filter(([, serial]) => Number.isSafeInteger(serial) && serial > 0),
	);
}

function resolveNextSerial(nextSerial: number | undefined, serialByIssueKey: Record<string, number>): number {
	const maximumExistingSerial = Math.max(0, ...Object.values(serialByIssueKey));
	const candidate = typeof nextSerial === 'number' ? nextSerial : 0;
	return Number.isSafeInteger(candidate) && candidate > maximumExistingSerial
		? candidate
		: maximumExistingSerial + 1;
}

function deduplicateIssues(issues: NormalizedIssueNote[]) {
	const byIssueKey = new Map<string, NormalizedIssueNote>();

	for (const issue of issues) {
		const issueKey = buildIssueKey(issue);
		const existingIssue = byIssueKey.get(issueKey);
		if (!existingIssue || issue.updatedAt > existingIssue.updatedAt) {
			byIssueKey.set(issueKey, issue);
		}
	}

	return [...byIssueKey.values()];
}

function compareNewIssues(left: NormalizedIssueNote, right: NormalizedIssueNote) {
	return left.createdAt.localeCompare(right.createdAt) || buildIssueKey(left).localeCompare(buildIssueKey(right));
}

function buildCsv(rows: IssueLedgerRow[]) {
	return [
		ISSUE_LEDGER_HEADERS.join(','),
		...rows.map((row) => [
			row.serial,
			row.title,
			row.url,
			row.responsible,
			row.category,
			row.state,
			row.personnelType,
			row.username,
			row.name,
			row.department,
			row.createdAt,
			row.firstResponseAt,
			row.firstResponseDuration,
		].map(escapeCsvField).join(',')),
	].join('\n');
}

function escapeCsvField(value: string | number) {
	const stringValue = String(value);
	return /[",\r\n]/.test(stringValue)
		? `"${stringValue.replace(/"/g, '""')}"`
		: stringValue;
}

function escapeRegExp(value: string) {
	return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
