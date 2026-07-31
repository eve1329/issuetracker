import {NormalizedIssueNote} from '../../src/Issues/issue-note';
import {
	buildIssueNotificationState,
	findNewExternalIssues,
	formatLocalNewExternalIssueNotification,
	normalizeIssueNotificationState,
} from '../../src/Notifications/new-issue-notifications';

function makeIssue(overrides: Partial<NormalizedIssueNote> = {}): NormalizedIssueNote {
	return {
		id: 1,
		iid: 1,
		title: '新增问题',
		state: 'opened',
		createdAt: '2026-07-31T01:00:00.000Z',
		updatedAt: '2026-07-31T01:00:00.000Z',
		webUrl: 'https://gitcode.com/CPF-KMP-CMP/repo-a/issues/1',
		projectId: 1,
		projectPath: 'CPF-KMP-CMP/repo-a',
		sourceScope: 'project',
		sourceRepo: 'repo-a',
		authorUsername: 'partner_a',
		authorName: 'Partner A',
		isInternalAuthor: false,
		internalMatchedBy: 'none',
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

describe('new issue notifications', () => {
	it('treats the first valid state as a silent baseline', () => {
		expect(findNewExternalIssues([makeIssue()], null)).toEqual([]);
		expect(buildIssueNotificationState([makeIssue()], null)).toEqual({
			seenIssueKeys: ['CPF-KMP-CMP/repo-a#1'],
		});
	});

	it('returns only unseen external issues while retaining previous keys', () => {
		const previousState = {seenIssueKeys: ['CPF-KMP-CMP/repo-a#1']};
		const currentIssues = [
			makeIssue({iid: 1}),
			makeIssue({
				iid: 2,
				title: '外部新增问题',
				webUrl: 'https://gitcode.com/CPF-KMP-CMP/repo-a/issues/2',
				referencesFull: 'CPF-KMP-CMP/repo-a#2',
			}),
			makeIssue({
				iid: 3,
				title: '内部新增问题',
				isInternalAuthor: true,
				webUrl: 'https://gitcode.com/CPF-KMP-CMP/repo-a/issues/3',
				referencesFull: 'CPF-KMP-CMP/repo-a#3',
			}),
		];

		expect(findNewExternalIssues(currentIssues, previousState)).toEqual([
			expect.objectContaining({issueKey: 'CPF-KMP-CMP/repo-a#2', title: '外部新增问题'}),
		]);
		expect(buildIssueNotificationState(currentIssues, previousState)).toEqual({
			seenIssueKeys: [
				'CPF-KMP-CMP/repo-a#1',
				'CPF-KMP-CMP/repo-a#2',
				'CPF-KMP-CMP/repo-a#3',
			],
		});
	});

	it('normalizes malformed state conservatively', () => {
		expect(normalizeIssueNotificationState({seenIssueKeys: [' repo-a#1 ', 4, 'repo-a#1', '']}))
			.toEqual({seenIssueKeys: ['repo-a#1']});
		expect(normalizeIssueNotificationState({seenIssueKeys: 'repo-a#1'})).toBeNull();
	});

	it('formats a compact local notice for a batch', () => {
		const issue = {
			issueKey: 'repo-a#2',
			sourceRepo: 'repo-a',
			iid: 2,
			title: '外部新增问题',
			authorName: 'Partner A',
			authorUsername: 'partner_a',
			webUrl: 'https://gitcode.com/repo-a/issues/2',
		};
		expect(formatLocalNewExternalIssueNotification([issue])).toContain('repo-a#2');
	});
});
