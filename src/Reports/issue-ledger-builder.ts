import {NormalizedIssueNote} from "../Issues/issue-note";
import {
	findInternalIssueEvidence,
	normalizeInternalMemberDirectory,
	normalizeUsername,
} from '../Classification/internal-identity';
import {
	buildIssueKey,
	deduplicateIssues,
	isOnOrAfterStartMonth,
	normalizeStartMonth,
} from '../Issues/issue-scope';

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
	const directory = normalizeInternalMemberDirectory(settings.internalMemberDirectory);
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
	const internalEvidence = findInternalIssueEvidence(issue.title, settings.internalReferencePrefixes)?.value;
	const identity = resolveConfirmedInternalIdentity(issue, directoryName, isWhitelisted);
	const personnelType = identity?.personnelType
		?? (internalEvidence ? '内部' : '外部伙伴');
	const evidence = identity?.evidence
		?? internalEvidence
		?? (username ? '外部账号' : '未提供账号，未命中内部编号或工作标记');

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
		name: personnelType === '内部' ? (directoryName || issue.authorName).trim() : '',
		personnelType,
		department: '',
		firstResponseAt: '',
		firstResponseDuration: '',
		evidence,
	};
}

function resolveConfirmedInternalIdentity(
	issue: Pick<NormalizedIssueNote, 'isInternalAuthor' | 'internalMatchedBy'>,
	directoryName: string | undefined,
	isWhitelisted: boolean,
): {personnelType: '内部'; evidence: string} | null {
	if (directoryName !== undefined) {
		return {personnelType: '内部', evidence: '成员目录'};
	}

	if (isWhitelisted) {
		return {personnelType: '内部', evidence: '白名单'};
	}

	if (issue.isInternalAuthor) {
		return {personnelType: '内部', evidence: `协作者目录:${issue.internalMatchedBy}`};
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
