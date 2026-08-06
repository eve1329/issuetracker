import {NormalizedIssueNote} from '../../src/Issues/issue-note';
import {
	buildInternalIssueAutoReplyBaseline,
	buildInternalIssueAutoReplyMarker,
	appendInternalIssueAutoReplyMarker,
	findPendingInternalIssueAutoReplies,
	formatInternalIssueAutoReply,
	getInternalIssueAutoReplyDueAt,
	markInternalIssueAutoRepliesDelivered,
	normalizeInternalIssueAutoReplyState,
	queueInternalIssueAutoReplies,
} from '../../src/Notifications/internal-issue-auto-reply';

function makeIssue(overrides: Partial<NormalizedIssueNote> = {}): NormalizedIssueNote {
	return {
		id: 1,
		iid: 1,
		title: '内部问题',
		state: 'opened',
		createdAt: '2026-08-06T01:00:00.000Z',
		updatedAt: '2026-08-06T01:00:00.000Z',
		webUrl: 'https://gitcode.com/CPF-KMP-CMP/repo-a/issues/1',
		projectId: 1,
		projectPath: 'CPF-KMP-CMP/repo-a',
		sourceScope: 'project',
		sourceRepo: 'repo-a',
		authorUsername: 'dev_a',
		authorName: '开发甲',
		isInternalAuthor: true,
		internalMatchedBy: 'org',
		firstResponseAt: '',
		firstResponseCheckedAt: '',
		labels: [],
		issueTypeRaw: 'issue',
		requestKind: 'unknown',
		requestKindMatchedBy: 'none',
		referencesFull: 'CPF-KMP-CMP/repo-a#1',
		...overrides,
	};
}

describe('internal Issue auto-reply state', () => {
	it('establishes a silent baseline and only queues later internal first responses', () => {
		const existingInternal = makeIssue({firstResponseAt: '2026-08-06T02:00:00.000Z'});
		const baseline = buildInternalIssueAutoReplyBaseline([existingInternal]);

		const queued = queueInternalIssueAutoReplies(baseline, [
			makeIssue({iid: 1, firstResponseAt: existingInternal.firstResponseAt}),
			makeIssue({
				iid: 2,
				title: '后来出现的内部问题',
				webUrl: 'https://gitcode.com/CPF-KMP-CMP/repo-a/issues/2',
				referencesFull: 'CPF-KMP-CMP/repo-a#2',
				firstResponseAt: '2026-08-06T03:00:00.000Z',
			}),
			makeIssue({
				iid: 3,
				title: '外部问题',
				webUrl: 'https://gitcode.com/CPF-KMP-CMP/repo-a/issues/3',
				referencesFull: 'CPF-KMP-CMP/repo-a#3',
				authorUsername: 'partner_a',
				authorName: '外部用户',
				isInternalAuthor: false,
				internalMatchedBy: 'none',
				firstResponseAt: '2026-08-06T03:00:00.000Z',
			}),
		]);

		expect(getInternalIssueAutoReplyDueAt('2026-08-06T03:00:00.000Z', 24)).toBe('2026-08-07T03:00:00.000Z');
		expect(findPendingInternalIssueAutoReplies(queued, '2026-08-07T02:59:59.999Z', 24)).toEqual([]);
		expect(findPendingInternalIssueAutoReplies(queued, '2026-08-07T03:00:00.000Z', 24)).toEqual([
			expect.objectContaining({issueKey: 'CPF-KMP-CMP/repo-a#2', iid: 2}),
		]);
		expect(findPendingInternalIssueAutoReplies(queued, '2026-08-06T03:00:00.000Z', 0)).toEqual([
			expect.objectContaining({issueKey: 'CPF-KMP-CMP/repo-a#2', iid: 2}),
		]);
	});

	it('keeps a failed candidate pending and records successful delivery once', () => {
		const issue = makeIssue({firstResponseAt: '2026-08-06T03:00:00.000Z'});
		const queued = queueInternalIssueAutoReplies(
			buildInternalIssueAutoReplyBaseline([]),
			[issue],
		);
		const delivered = markInternalIssueAutoRepliesDelivered(
			queued,
			queued.pendingIssues,
			'2026-08-06T04:00:00.000Z',
		);

		expect(delivered.pendingIssues).toEqual([]);
		expect(delivered.deliveries).toEqual({
			'CPF-KMP-CMP/repo-a#1': {deliveredAt: '2026-08-06T04:00:00.000Z'},
		});
	});

	it('formats supported placeholders without changing unknown placeholders', () => {
		const issue = makeIssue({firstResponseAt: '2026-08-06T03:00:00.000Z'});

		expect(formatInternalIssueAutoReply(
			'{{author}} {{repo}}#{{iid}} {{title}} {{url}} {{authorUsername}} {{firstResponseAt}} {{unknown}}',
			{
				sourceRepo: issue.sourceRepo,
				iid: issue.iid,
				title: issue.title,
				webUrl: issue.webUrl,
				authorName: issue.authorName,
				authorUsername: issue.authorUsername,
				firstResponseAt: issue.firstResponseAt,
			},
		)).toBe('开发甲 repo-a#1 内部问题 https://gitcode.com/CPF-KMP-CMP/repo-a/issues/1 dev_a 2026-08-06T03:00:00.000Z {{unknown}}');
		expect(buildInternalIssueAutoReplyMarker('repo-a#1')).toBe('<!-- issuetracker-auto-reply:repo-a#1 -->');
		expect(appendInternalIssueAutoReplyMarker('已收到', 'repo-a#1')).toBe(
			'已收到\n\n<!-- issuetracker-auto-reply:repo-a#1 -->',
		);
	});

	it('rejects malformed persisted state', () => {
		expect(normalizeInternalIssueAutoReplyState({initialized: 'yes'})).toBeNull();
		expect(normalizeInternalIssueAutoReplyState({initialized: true})).toEqual({
		initialized: true,
		observedFirstResponseIssueKeys: [],
		pendingIssues: [],
		deliveries: {},
	});
	});
});
