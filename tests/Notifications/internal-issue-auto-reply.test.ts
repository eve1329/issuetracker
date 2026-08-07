import {NormalizedIssueNote} from '../../src/Issues/issue-note';
import {isIssueInternal} from '../../src/Classification/internal-identity';
import {
	appendInternalIssueAutoReplyMarker,
	buildInternalIssueAutoReplyBaseline,
	buildInternalIssueAutoReplyMarker,
	findPendingInternalIssueAutoReplies,
	formatInternalIssueAutoReply,
	getInternalIssueAutoReplyDueAt,
	INTERNAL_ISSUE_AUTO_REPLY_TRACKING_VERSION,
	markInternalIssueAutoRepliesDelivered,
	migrateInternalIssueAutoReplyState,
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
	it('baselines historical overdue Issues but tracks in-flight and newly discovered unanswered Issues', () => {
		const historicalOverdue = makeIssue({
			createdAt: '2026-08-04T01:00:00.000Z',
		});
		const inFlight = makeIssue({
			iid: 2,
			title: '尚未到期的内部问题',
			createdAt: '2026-08-06T02:30:00.000Z',
			webUrl: 'https://gitcode.com/CPF-KMP-CMP/repo-a/issues/2',
			referencesFull: 'CPF-KMP-CMP/repo-a#2',
		});
		const baseline = buildInternalIssueAutoReplyBaseline(
			[historicalOverdue, inFlight],
			'2026-08-06T03:00:00.000Z',
			24,
		);

		expect(baseline).toEqual(expect.objectContaining({
			trackingVersion: INTERNAL_ISSUE_AUTO_REPLY_TRACKING_VERSION,
			observedUnansweredIssueKeys: ['CPF-KMP-CMP/repo-a#1'],
			pendingIssues: [expect.objectContaining({
				issueKey: 'CPF-KMP-CMP/repo-a#2',
				createdAt: inFlight.createdAt,
			})],
		}));

		const newlyDiscovered = makeIssue({
			iid: 3,
			title: '后来发现的内部问题',
			createdAt: '2026-08-06T02:45:00.000Z',
			webUrl: 'https://gitcode.com/CPF-KMP-CMP/repo-a/issues/3',
			referencesFull: 'CPF-KMP-CMP/repo-a#3',
		});
		const queued = queueInternalIssueAutoReplies(baseline, [historicalOverdue, inFlight, newlyDiscovered]);

		expect(getInternalIssueAutoReplyDueAt(inFlight.createdAt, 24)).toBe('2026-08-07T02:30:00.000Z');
		expect(findPendingInternalIssueAutoReplies(queued, '2026-08-07T02:44:59.999Z', 24)).toEqual([
			expect.objectContaining({issueKey: 'CPF-KMP-CMP/repo-a#2', iid: 2}),
		]);
		expect(findPendingInternalIssueAutoReplies(queued, '2026-08-07T02:45:00.000Z', 24)).toEqual([
			expect.objectContaining({issueKey: 'CPF-KMP-CMP/repo-a#2', iid: 2}),
			expect.objectContaining({issueKey: 'CPF-KMP-CMP/repo-a#3', iid: 3}),
		]);
	});

	it('stops tracking a pending Issue when it is closed or receives a non-author response', () => {
		const issue = makeIssue();
		const queued = queueInternalIssueAutoReplies(
			buildInternalIssueAutoReplyBaseline([], '2026-08-06T01:00:00.000Z', 24),
			[issue],
		);

		expect(queueInternalIssueAutoReplies(queued, [
			{...issue, firstResponseAt: '2026-08-06T02:00:00.000Z'},
		])).toEqual(expect.objectContaining({pendingIssues: []}));
		expect(queueInternalIssueAutoReplies(queued, [
			{...issue, state: 'closed'},
		])).toEqual(expect.objectContaining({pendingIssues: []}));
	});

	it('tracks a title-only internal Issue when it has no roster or collaborator match', () => {
		const titleOnlyIssue = makeIssue({
			title: '门禁测试',
			authorUsername: 'liaoyiming365',
			authorName: 'liaoyiming',
			isInternalAuthor: false,
			internalMatchedBy: 'none',
		});
		const isInternalIssue = (issue: NormalizedIssueNote) => isIssueInternal(issue, new Set());
		const queued = queueInternalIssueAutoReplies(
			buildInternalIssueAutoReplyBaseline([], '2026-08-06T01:00:00.000Z', 24, isInternalIssue),
			[titleOnlyIssue],
			isInternalIssue,
		);

		expect(queued.pendingIssues).toEqual([
			expect.objectContaining({issueKey: 'CPF-KMP-CMP/repo-a#1', title: '门禁测试'}),
		]);
	});

	it('migrates current-week unanswered Issues without replaying older overdue history and preserves deliveries', () => {
		const legacyState = normalizeInternalIssueAutoReplyState({
			initialized: true,
			observedFirstResponseIssueKeys: ['CPF-KMP-CMP/repo-a#1'],
			pendingIssues: [],
			deliveries: {
				'CPF-KMP-CMP/repo-a#99': {deliveredAt: '2026-08-05T01:00:00.000Z'},
			},
		});
		const historicalOverdue = makeIssue({createdAt: '2026-07-28T01:00:00.000Z'});
		const currentWeekOverdue = makeIssue({
			iid: 2,
			createdAt: '2026-08-04T01:00:00.000Z',
			webUrl: 'https://gitcode.com/CPF-KMP-CMP/repo-a/issues/2',
			referencesFull: 'CPF-KMP-CMP/repo-a#2',
		});
		const inFlight = makeIssue({
			iid: 3,
			createdAt: '2026-08-06T02:30:00.000Z',
			webUrl: 'https://gitcode.com/CPF-KMP-CMP/repo-a/issues/3',
			referencesFull: 'CPF-KMP-CMP/repo-a#3',
		});

		expect(legacyState).toEqual(expect.objectContaining({trackingVersion: 1}));
		expect(migrateInternalIssueAutoReplyState(
			legacyState!,
			[historicalOverdue, currentWeekOverdue, inFlight],
			'2026-08-06T03:00:00.000Z',
			24,
		)).toEqual(expect.objectContaining({
			trackingVersion: INTERNAL_ISSUE_AUTO_REPLY_TRACKING_VERSION,
			observedUnansweredIssueKeys: ['CPF-KMP-CMP/repo-a#1'],
			pendingIssues: [
				expect.objectContaining({issueKey: 'CPF-KMP-CMP/repo-a#2'}),
				expect.objectContaining({issueKey: 'CPF-KMP-CMP/repo-a#3'}),
			],
			deliveries: {'CPF-KMP-CMP/repo-a#99': {deliveredAt: '2026-08-05T01:00:00.000Z'}},
		}));
	});

	it('keeps a failed candidate pending and records successful delivery once', () => {
		const issue = makeIssue();
		const queued = queueInternalIssueAutoReplies(
			buildInternalIssueAutoReplyBaseline([], '2026-08-06T01:00:00.000Z', 24),
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
		const issue = makeIssue();

		expect(formatInternalIssueAutoReply(
			'{{author}} {{repo}}#{{iid}} {{title}} {{url}} {{authorUsername}} {{createdAt}} {{unknown}}',
			{
				sourceRepo: issue.sourceRepo,
				iid: issue.iid,
				title: issue.title,
				webUrl: issue.webUrl,
				authorName: issue.authorName,
				authorUsername: issue.authorUsername,
				createdAt: issue.createdAt,
				firstResponseAt: issue.firstResponseAt,
			},
		)).toBe('开发甲 repo-a#1 内部问题 https://gitcode.com/CPF-KMP-CMP/repo-a/issues/1 dev_a 2026-08-06T01:00:00.000Z {{unknown}}');
		expect(buildInternalIssueAutoReplyMarker('repo-a#1')).toBe('<!-- issuetracker-auto-reply:repo-a#1 -->');
		expect(appendInternalIssueAutoReplyMarker('已收到', 'repo-a#1')).toBe(
			'已收到\n\n<!-- issuetracker-auto-reply:repo-a#1 -->',
		);
	});

	it('rejects malformed persisted state', () => {
		expect(normalizeInternalIssueAutoReplyState({initialized: 'yes'})).toBeNull();
		expect(normalizeInternalIssueAutoReplyState({initialized: true})).toEqual({
			trackingVersion: 1,
			initialized: true,
			observedUnansweredIssueKeys: [],
			pendingIssues: [],
			deliveries: {},
		});
	});
});
