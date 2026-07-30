import {NormalizedIssueNote} from "../Issues/issue-note";
import {
	buildInternalAuthorEvidenceIndex,
	findInternalIssueEvidence,
	InternalAuthorEvidence,
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
	issueStateByIssueKey?: Record<string, string>;
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
	newlyClosed: boolean;
	evidence: string;
}

export interface IssueLedgerBuildResult {
	rows: IssueLedgerRow[];
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
	'首次响应时间',
	'首次响应时长',
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
	const internalEvidenceByUsername = buildInternalAuthorEvidenceIndex(uniqueIssues, settings, startMonth);
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
	const previousIssueStates = shouldResetSerialState
		? {}
		: normalizeIssueStateByIssueKey(previousState?.issueStateByIssueKey);

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

			return buildRow(
				issue,
				serial,
				directory,
				whitelist,
				internalEvidenceByUsername,
				settings,
				isClosedIssue(issue) && previouslyTrackedIssueKeys.has(issueKey) && isOpenIssueState(previousIssueStates[issueKey]),
			);
		})
		.sort((left, right) => left.serial - right.serial || left.issueKey.localeCompare(right.issueKey));

	return {
		rows,
		serialState: {
			nextSerial,
			serialByIssueKey,
			issueStateByIssueKey: Object.fromEntries(
				eligibleIssues
					.filter((issue) => serialByIssueKey[buildIssueKey(issue)] !== undefined)
					.map((issue) => [buildIssueKey(issue), issue.state]),
			),
			...(startMonth ? {startMonth} : {}),
		},
	};
}

function isClosedIssue(issue: Pick<NormalizedIssueNote, 'state'>) {
	return issue.state.trim().toLowerCase() === 'closed';
}

function isOpenIssueState(state: string | undefined) {
	const normalizedState = state?.trim().toLowerCase();
	return normalizedState === 'open' || normalizedState === 'opened';
}

function buildRow(
	issue: NormalizedIssueNote,
	serial: number,
	directory: Map<string, string>,
	whitelist: Set<string>,
	internalEvidenceByUsername: Map<string, InternalAuthorEvidence[]>,
	settings: IssueLedgerSettings,
	newlyClosed: boolean,
): IssueLedgerRow {
	const username = normalizeUsername(issue.authorUsername);
	const directoryName = directory.get(username);
	const isWhitelisted = whitelist.has(username);
	const internalEvidence = findInternalIssueEvidence(issue.title, settings.internalReferencePrefixes)?.value;
	const relatedIdentityEvidence = findRelatedIdentityEvidence(
		internalEvidenceByUsername.get(username),
		buildIssueKey(issue),
	);
	const identity = resolveConfirmedInternalIdentity(issue, directoryName, isWhitelisted);
	const personnelType = identity?.personnelType
		?? (internalEvidence || relatedIdentityEvidence ? '内部' : '外部伙伴');
	const evidence = identity?.evidence
		?? internalEvidence
		?? (relatedIdentityEvidence ? formatRelatedIdentityEvidence(relatedIdentityEvidence) : null)
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
		firstResponseAt: formatFirstResponseAt(issue.createdAt, issue.firstResponseAt),
		firstResponseDuration: formatFirstResponseDuration(issue.createdAt, issue.firstResponseAt),
		newlyClosed,
		evidence,
	};
}

function findRelatedIdentityEvidence(
	evidence: InternalAuthorEvidence[] | undefined,
	currentIssueKey: string,
) {
	return evidence?.find((entry) => entry.issueKey !== currentIssueKey) ?? null;
}

function formatRelatedIdentityEvidence(evidence: InternalAuthorEvidence) {
	const source = evidence.state.trim().toLowerCase() === 'closed'
		? '历史关闭 Issue'
		: '已同步 Issue';
	return `${source}：${evidence.kind} ${evidence.value}（${evidence.issueKey}）`;
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

function formatFirstResponseAt(createdAt: string, firstResponseAt: string | undefined) {
	const normalizedResponseAt = firstResponseAt?.trim() ?? '';
	const createdTime = Date.parse(createdAt);
	const responseTime = Date.parse(normalizedResponseAt);
	if (!normalizedResponseAt || !Number.isFinite(createdTime) || !Number.isFinite(responseTime) || responseTime < createdTime) {
		return '';
	}

	return formatCreatedAt(normalizedResponseAt);
}

function formatFirstResponseDuration(createdAt: string, firstResponseAt: string | undefined) {
	const normalizedResponseAt = firstResponseAt?.trim() ?? '';
	if (!normalizedResponseAt) {
		return '';
	}

	const createdTime = Date.parse(createdAt);
	const responseTime = Date.parse(normalizedResponseAt);
	if (!Number.isFinite(createdTime) || !Number.isFinite(responseTime) || responseTime < createdTime) {
		return '';
	}

	let remainingMinutes = Math.floor((responseTime - createdTime) / 60_000);
	const days = Math.floor(remainingMinutes / (24 * 60));
	remainingMinutes -= days * 24 * 60;
	const hours = Math.floor(remainingMinutes / 60);
	const minutes = remainingMinutes - hours * 60;
	return [
		...(days ? [`${days}天`] : []),
		...(hours ? [`${hours}小时`] : []),
		`${minutes}分钟`,
	].join(' ');
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

function normalizeIssueStateByIssueKey(issueStateByIssueKey: Record<string, string> | undefined) {
	return Object.fromEntries(
		Object.entries(issueStateByIssueKey ?? {})
			.filter(([issueKey, state]) => issueKey.trim().length > 0 && typeof state === 'string' && state.trim().length > 0),
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
