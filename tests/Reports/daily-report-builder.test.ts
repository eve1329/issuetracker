import {buildDailyReport, buildDailyReportMarkdown} from "../../src/Reports/daily-report-builder";
import {NormalizedIssueNote} from "../../src/Issues/issue-note";

function makeIssue(partial: Partial<NormalizedIssueNote>): NormalizedIssueNote {
	return {
		id: 1,
		iid: 1,
		title: '[BUG] 登录失败',
		state: 'opened',
		createdAt: '2026-06-17T09:00:00+08:00',
		updatedAt: '2026-06-17T09:00:00+08:00',
		webUrl: 'https://gitcode.com/repo-a/issues/1',
		projectId: 1,
		projectPath: 'repo-a',
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
		referencesFull: 'repo-a#1',
		...partial,
	};
}

describe('buildDailyReport', () => {
	it('groups same-day normalized issues into bug and requirement counts', () => {
		const report = buildDailyReport('2026-06-17', [
			makeIssue({
				iid: 78,
				title: '[BUG] 登录失败',
				createdAt: '2026-06-17T09:00:00+08:00',
				requestKind: 'bug',
				sourceRepo: 'repo-a',
				authorUsername: 'partner_a',
				isInternalAuthor: false,
				referencesFull: 'CPF-KMP-CMP/repo-a#78',
			}),
			makeIssue({
				iid: 15,
				title: '[需求] 增加导出',
				createdAt: '2026-06-17T10:00:00+08:00',
				requestKind: 'requirement',
				sourceRepo: 'repo-b',
				authorUsername: 'dev_a',
				isInternalAuthor: true,
				referencesFull: 'CPF-KMP-CMP/repo-b#15',
			}),
			makeIssue({
				iid: 99,
				title: '[BUG] 昨日问题',
				createdAt: '2026-06-16T18:30:00+08:00',
				requestKind: 'bug',
				sourceRepo: 'repo-c',
				authorUsername: 'partner_c',
				isInternalAuthor: false,
				referencesFull: 'CPF-KMP-CMP/repo-c#99',
			}),
		]);

		expect(report.date).toBe('2026-06-17');
		expect(report.newBugCount).toBe(1);
		expect(report.newRequirementCount).toBe(1);
		expect(report.externalBugCount).toBe(1);
		expect(report.externalRequirementCount).toBe(0);
		expect(report.newIssueCount).toBe(2);
		expect(report.externalIssueCount).toBe(1);
		expect(report.repos).toEqual(['repo-a', 'repo-b']);
		expect(report.topExternalAuthors).toEqual(['partner_a']);
		expect(report.externalAuthorIssueCounts).toEqual({partner_a: 1});
		expect(report.unknownClassifications).toBe(0);
		expect(report.syncStatus).toBe('success');
		expect(report.bugIssues).toHaveLength(1);
		expect(report.requirementIssues).toHaveLength(1);
		expect(report.externalBugIssues).toHaveLength(1);
		expect(report.externalRequirementIssues).toHaveLength(0);
		expect(report.unknownIssues).toHaveLength(0);
	});

	it('computes external counts and ranks external authors by frequency', () => {
		const report = buildDailyReport('2026-06-17', [
			makeIssue({
				iid: 1,
				title: '[BUG] A',
				authorUsername: 'partner_b',
				sourceRepo: 'repo-b',
				isInternalAuthor: false,
				requestKind: 'bug',
				createdAt: '2026-06-17T08:00:00+08:00',
			}),
			makeIssue({
				iid: 2,
				title: '[BUG] B',
				authorUsername: 'partner_a',
				sourceRepo: 'repo-a',
				isInternalAuthor: false,
				requestKind: 'bug',
				createdAt: '2026-06-17T09:00:00+08:00',
			}),
			makeIssue({
				iid: 3,
				title: '[需求] C',
				authorUsername: 'partner_a',
				sourceRepo: 'repo-c',
				isInternalAuthor: false,
				requestKind: 'requirement',
				createdAt: '2026-06-17T10:00:00+08:00',
			}),
			makeIssue({
				iid: 4,
				title: '[BUG] D',
				authorUsername: 'partner_c',
				sourceRepo: 'repo-d',
				isInternalAuthor: false,
				requestKind: 'bug',
				createdAt: '2026-06-17T11:00:00+08:00',
			}),
			makeIssue({
				iid: 5,
				title: '[BUG] E',
				authorUsername: 'partner_d',
				sourceRepo: 'repo-e',
				isInternalAuthor: false,
				requestKind: 'bug',
				createdAt: '2026-06-17T12:00:00+08:00',
			}),
			makeIssue({
				iid: 6,
				title: '[BUG] F',
				authorUsername: 'partner_e',
				sourceRepo: 'repo-f',
				isInternalAuthor: false,
				requestKind: 'bug',
				createdAt: '2026-06-17T13:00:00+08:00',
			}),
			makeIssue({
				iid: 7,
				title: '[BUG] G',
				authorUsername: 'partner_f',
				sourceRepo: 'repo-g',
				isInternalAuthor: false,
				requestKind: 'bug',
				createdAt: '2026-06-17T14:00:00+08:00',
			}),
		]);

		expect(report.externalBugCount).toBe(6);
		expect(report.externalRequirementCount).toBe(1);
		expect(report.externalIssueCount).toBe(7);
		expect(report.topExternalAuthors).toEqual(['partner_a', 'partner_b', 'partner_c', 'partner_d', 'partner_e']);
		expect(report.externalAuthorIssueCounts).toEqual({
			partner_a: 2,
			partner_b: 1,
			partner_c: 1,
			partner_d: 1,
			partner_e: 1,
			partner_f: 1,
		});
	});

	it('renders a structured daily markdown report with frontmatter and grouped sections', () => {
		const report = buildDailyReport('2026-06-17', [
			makeIssue({
				iid: 78,
				title: '[BUG] 登录失败',
				authorUsername: 'partner_a',
				sourceRepo: 'repo-a',
				isInternalAuthor: false,
				requestKind: 'bug',
				createdAt: '2026-06-17T09:00:00+08:00',
			}),
			makeIssue({
				iid: 15,
				title: '[需求] 增加导出',
				authorUsername: 'partner_b',
				sourceRepo: 'repo-b',
				isInternalAuthor: false,
				requestKind: 'requirement',
				createdAt: '2026-06-17T10:00:00+08:00',
			}),
			makeIssue({
				iid: 16,
				title: '未分类问题',
				authorUsername: 'dev_a',
				sourceRepo: 'repo-c',
				isInternalAuthor: true,
				requestKind: 'unknown',
				requestKindMatchedBy: 'none',
				createdAt: '2026-06-17T11:00:00+08:00',
			}),
		]);

		const markdown = buildDailyReportMarkdown(report);

		expect(markdown).toContain('---');
		expect(markdown).toContain('date: 2026-06-17');
		expect(markdown).toContain('newBugCount: 1');
		expect(markdown).toContain('externalRequirementCount: 1');
		expect(markdown).toContain('repos:');
		expect(markdown).toContain('  - repo-a');
		expect(markdown).toContain('  - repo-b');
		expect(markdown).toContain('  - repo-c');
		expect(markdown).toContain('topExternalAuthors:');
		expect(markdown).toContain('  - partner_a');
		expect(markdown).toContain('  - partner_b');
		expect(markdown).toContain('## New Bugs');
		expect(markdown).toContain('- repo-a #78: [BUG] 登录失败');
		expect(markdown).toContain('## New Requirements');
		expect(markdown).toContain('- repo-b #15: [需求] 增加导出');
		expect(markdown).toContain('## External Partner Bugs');
		expect(markdown).toContain('## External Partner Requirements');
		expect(markdown).toContain('## Unknown Classification');
		expect(markdown).toContain('- repo-c #16: 未分类问题');
	});

	it('renders empty frontmatter lists as yaml arrays when no issues exist for the day', () => {
		const report = buildDailyReport('2026-06-18', [
			makeIssue({
				createdAt: '2026-06-17T09:00:00+08:00',
				isInternalAuthor: true,
				sourceRepo: 'repo-a',
				authorUsername: 'dev_a',
			}),
		]);

		const markdown = buildDailyReportMarkdown(report);

		expect(markdown).toContain('repos: []');
		expect(markdown).toContain('topExternalAuthors: []');
	});

	it('does not render synthetic none bullets for empty issue sections', () => {
		const report = buildDailyReport('2026-06-18', []);

		const markdown = buildDailyReportMarkdown(report);

		expect(markdown).toContain('## New Bugs');
		expect(markdown).toContain('## New Requirements');
		expect(markdown).not.toContain('- None');
	});
});
