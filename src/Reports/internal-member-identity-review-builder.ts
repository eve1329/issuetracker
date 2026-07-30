import {NormalizedIssueNote} from '../Issues/issue-note';
import {
	findInternalIssueEvidence,
	InternalIssueEvidence,
	normalizeInternalMemberDirectory,
	normalizeUsername,
} from '../Classification/internal-identity';
import {
	buildIssueKey,
	deduplicateIssues,
	isOnOrAfterStartMonth,
	normalizeStartMonth,
} from '../Issues/issue-scope';

export interface InternalMemberIdentityReviewSettings {
	internalMemberDirectory?: Record<string, string>;
	internalReferencePrefixes?: string[];
	startMonth?: string;
}

export interface InternalMemberIdentityReviewIssue {
	issueKey: string;
	title: string;
	url: string;
	createdAt: string;
	state: string;
	evidence: string;
	evidenceKind: InternalIssueEvidence['kind'];
	collaboratorEvidence: string;
}

export interface InternalMemberIdentityReviewCandidate {
	username: string;
	displayNames: string[];
	issues: InternalMemberIdentityReviewIssue[];
}

export interface InternalMemberIdentityReview {
	directoryAccountCount: number;
	eligibleIssueCount: number;
	evidenceIssueCount: number;
	candidates: InternalMemberIdentityReviewCandidate[];
	markdown: string;
}

export function buildInternalMemberIdentityReview(
	issues: NormalizedIssueNote[],
	settings: InternalMemberIdentityReviewSettings,
): InternalMemberIdentityReview {
	const directoryAccounts = new Set(normalizeInternalMemberDirectory(settings.internalMemberDirectory).keys());
	const startMonth = normalizeStartMonth(settings.startMonth);
	const eligibleIssues = deduplicateIssues(issues)
		.filter((issue) => isOnOrAfterStartMonth(issue, startMonth));
	const evidenceIssues = eligibleIssues
		.map((issue) => ({
			issue,
			evidence: findInternalIssueEvidence(issue.title, settings.internalReferencePrefixes),
		}))
		.filter((item): item is {issue: NormalizedIssueNote; evidence: InternalIssueEvidence} => item.evidence !== null);
	const candidatesByUsername = new Map<string, {
		displayNames: Set<string>;
		issues: InternalMemberIdentityReviewIssue[];
	}>();

	for (const {issue, evidence} of evidenceIssues) {
		const username = normalizeUsername(issue.authorUsername);
		if (!username || directoryAccounts.has(username)) {
			continue;
		}

		const candidate = candidatesByUsername.get(username) ?? {
			displayNames: new Set<string>(),
			issues: [],
		};
		const displayName = issue.authorName.trim();
		if (displayName) {
			candidate.displayNames.add(displayName);
		}
		candidate.issues.push({
			issueKey: buildIssueKey(issue),
			title: issue.title,
			url: issue.webUrl,
			createdAt: issue.createdAt,
			state: issue.state,
			evidence: evidence.value,
			evidenceKind: evidence.kind,
			collaboratorEvidence: issue.isInternalAuthor
				? `协作者目录:${issue.internalMatchedBy}`
				: '',
		});
		candidatesByUsername.set(username, candidate);
	}

	const candidates = [...candidatesByUsername.entries()]
		.map(([username, candidate]) => ({
			username,
			displayNames: [...candidate.displayNames].sort((left, right) => left.localeCompare(right)),
			issues: candidate.issues.sort(compareReviewIssues),
		}))
		.sort((left, right) => left.username.localeCompare(right.username));
	const result = {
		directoryAccountCount: directoryAccounts.size,
		eligibleIssueCount: eligibleIssues.length,
		evidenceIssueCount: evidenceIssues.length,
		candidates,
	};

	return {
		...result,
		markdown: buildInternalMemberIdentityReviewMarkdown(result, startMonth),
	};
}

function buildInternalMemberIdentityReviewMarkdown(
	review: Omit<InternalMemberIdentityReview, 'markdown'>,
	startMonth: string,
) {
	const candidateIssueCount = review.candidates.reduce((count, candidate) => count + candidate.issues.length, 0);
	const scope = startMonth
		? `${startMonth} 及之后创建的 Issue`
		: '全部创建时间范围内的 Issue';

	return [
		'# 内部人员名单收集待补全报告',
		'',
		'> 本报告用于补全内部人员账号目录，不代表对人员配合情况的评价。',
		'',
		'## 口径说明',
		'',
		`- 当前已确认内部成员目录：**${review.directoryAccountCount} 个唯一账号**。`,
		`- 统计范围：${scope}，共 ${review.eligibleIssueCount} 条。`,
		`- 标题命中内部编号或内部工作标记：${review.evidenceIssueCount} 条。`,
		`- 待补全账号：**${review.candidates.length} 个 / ${candidateIssueCount} 条 Issue**。`,
		'- 只有标题命中内部编号或内部工作标记、作者账号存在且不在已确认目录时，才进入待补全名单。已关闭 Issue 不进入首次台账，但会保留为内部身份判定证据。协作者信息仅作为补充证据。',
		'',
		'## 待补全账号',
		'',
		...(review.candidates.length > 0
			? review.candidates.flatMap(renderCandidate)
			: ['- 当前没有需要补全的账号。', '']),
	].join('\n');
}

function renderCandidate(candidate: InternalMemberIdentityReviewCandidate) {
	const issueLabel = candidate.issues.length === 1 ? '1 条 Issue' : `${candidate.issues.length} 条 Issue`;
	const displayNames = candidate.displayNames.length > 0
		? candidate.displayNames.map((name) => escapeMarkdownText(name)).join('、')
		: '未提供';
	const reasons = summarizeReasons(candidate.issues);

	return [
		`### \`${candidate.username}\`（${issueLabel}）`,
		'',
		`- API 显示名：${displayNames}`,
		`- 为什么可能是内部人员：${reasons}`,
		'- 名单缺口：该 GitCode 账号不在当前已确认内部成员目录中，需要确认对应人员并补充账号或别名。',
		'',
		'关联 Issue：',
		'',
		...candidate.issues.flatMap((issue) => [
			`- ${formatIssueLink(issue)}`,
			`  - 证据：标题命中${issue.evidenceKind} \`${escapeInlineCode(issue.evidence)}\``,
			...(issue.collaboratorEvidence
				? [`  - 补充证据：${escapeMarkdownText(issue.collaboratorEvidence)}`]
				: []),
			`  - 创建时间：${escapeMarkdownText(issue.createdAt)}；状态：${escapeMarkdownText(issue.state)}`,
		]),
		'',
	];
}

function summarizeReasons(issues: InternalMemberIdentityReviewIssue[]) {
	const byKind = new Map<InternalIssueEvidence['kind'], string[]>();
	for (const issue of issues) {
		const values = byKind.get(issue.evidenceKind) ?? [];
		if (!values.includes(issue.evidence)) {
			values.push(issue.evidence);
		}
		byKind.set(issue.evidenceKind, values);
	}

	return [...byKind.entries()]
		.map(([kind, values]) => `标题命中${kind} ${values.map((value) => `\`${escapeInlineCode(value)}\``).join('、')}`)
		.join('；');
}

function formatIssueLink(issue: InternalMemberIdentityReviewIssue) {
	const label = escapeMarkdownText(`${issue.issueKey}：${issue.title}`);
	const url = issue.url.trim();
	return url ? `[${label}](<${url.replace(/>/g, '%3E')}>)` : label;
}

function compareReviewIssues(left: InternalMemberIdentityReviewIssue, right: InternalMemberIdentityReviewIssue) {
	return left.createdAt.localeCompare(right.createdAt) || left.issueKey.localeCompare(right.issueKey);
}

function escapeMarkdownText(value: string) {
	return value.replace(/[\\[\]]/g, '\\$&');
}

function escapeInlineCode(value: string) {
	return value.replace(/`/g, '\\`');
}
