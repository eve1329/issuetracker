import {
	buildIssueClosureNotice,
	IssueClosureState,
} from '../../src/Reports/issue-closure-notice-builder';
import {NormalizedIssueNote} from '../../src/Issues/issue-note';

function makeIssue(overrides: Partial<NormalizedIssueNote> = {}): NormalizedIssueNote {
	return {
		id: 78,
		iid: 78,
		title: '[BUG] 登录失败',
		state: 'closed',
		createdAt: '2026-06-17T09:12:00+08:00',
		updatedAt: '2026-06-18T10:05:00+08:00',
		webUrl: 'https://gitcode.com/CPF-KMP-CMP/repo-a/issues/78',
		projectId: 1001,
		projectPath: 'CPF-KMP-CMP/repo-a',
		sourceScope: 'project',
		sourceRepo: 'repo-a',
		authorUsername: 'partner_a',
		authorName: 'Partner A',
		isInternalAuthor: false,
		internalMatchedBy: 'none',
		labels: [],
		issueTypeRaw: 'issue',
		requestKind: 'bug',
		requestKindMatchedBy: 'title-prefix',
		referencesFull: 'CPF-KMP-CMP/repo-a#78',
		...overrides,
	};
}

describe('buildIssueClosureNotice', () => {
	it('uses currently closed issues as the initial reminder baseline', () => {
		const notice = buildIssueClosureNotice([makeIssue()], null, {startMonth: '2026-05'});

		expect(notice.newlyClosed).toHaveLength(1);
		expect(notice.currentlyClosed).toHaveLength(1);
		expect(notice.state).toEqual({
			closedIssueKeys: ['CPF-KMP-CMP/repo-a#78'],
			startMonth: '2026-05',
		});
		expect(notice.markdown).toContain('# Issue 关闭提醒');
		expect(notice.markdown).toContain('首次建立提醒基线');
		expect(notice.markdown).toContain('[CPF-KMP-CMP/repo-a#78：\\[BUG\\] 登录失败](<https://gitcode.com/CPF-KMP-CMP/repo-a/issues/78>)');
		expect(notice.markdown).toContain('- 分类：缺陷');
	});

	it('does not repeat a closure until the issue reopens and closes again', () => {
		const initialState: IssueClosureState = {
			closedIssueKeys: ['CPF-KMP-CMP/repo-a#78'],
			startMonth: '2026-05',
		};
		const unchanged = buildIssueClosureNotice([makeIssue()], initialState, {startMonth: '2026-05'});
		const reopened = buildIssueClosureNotice([
			makeIssue({state: 'opened', updatedAt: '2026-06-19T09:00:00+08:00'}),
		], unchanged.state, {startMonth: '2026-05'});
		const closedAgain = buildIssueClosureNotice([
			makeIssue({updatedAt: '2026-06-20T09:00:00+08:00'}),
		], reopened.state, {startMonth: '2026-05'});

		expect(unchanged.newlyClosed).toEqual([]);
		expect(reopened.state.closedIssueKeys).toEqual([]);
		expect(closedAgain.newlyClosed.map((issue) => issue.key)).toEqual(['CPF-KMP-CMP/repo-a#78']);
	});

	it('filters issues before the configured start month and resets its baseline when the month changes', () => {
		const state: IssueClosureState = {
			closedIssueKeys: ['CPF-KMP-CMP/repo-a#78'],
			startMonth: '2026-05',
		};
		const notice = buildIssueClosureNotice([
			makeIssue({iid: 77, createdAt: '2026-04-30T23:59:59+08:00'}),
			makeIssue(),
		], state, {startMonth: '2026-06'});

		expect(notice.newlyClosed.map((issue) => issue.key)).toEqual(['CPF-KMP-CMP/repo-a#78']);
		expect(notice.currentlyClosed.map((issue) => issue.key)).toEqual(['CPF-KMP-CMP/repo-a#78']);
		expect(notice.state.startMonth).toBe('2026-06');
	});
});
