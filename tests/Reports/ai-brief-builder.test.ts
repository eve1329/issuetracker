import {buildAiBriefMarkdown} from "../../src/Reports/ai-brief-builder";
import {DailyReport} from "../../src/Reports/daily-report-builder";

describe('buildAiBriefMarkdown', () => {
	it('renders a markdown brief with summary, partner focus, and issue sections', () => {
		const markdown = buildAiBriefMarkdown({
			date: '2026-06-17',
			newBugCount: 1,
			newRequirementCount: 1,
			externalBugCount: 1,
			externalRequirementCount: 0,
			newIssueCount: 2,
			externalIssueCount: 1,
			repos: ['repo-a', 'repo-b'],
			topExternalAuthors: ['partner_a'],
			externalAuthorIssueCounts: {partner_a: 1},
			unknownClassifications: 0,
			syncStatus: 'success',
			bugIssues: [
				{sourceRepo: 'repo-a', iid: 78, title: '[BUG] 登录失败'} as DailyReport['bugIssues'][number],
			],
			requirementIssues: [
				{sourceRepo: 'repo-b', iid: 15, title: '[需求] 增加导出'} as DailyReport['requirementIssues'][number],
			],
			externalBugIssues: [],
			externalRequirementIssues: [],
			unknownIssues: [],
		} as DailyReport);

		expect(markdown).toContain('# GitCode Issue Daily Brief - 2026-06-17');
		expect(markdown).toContain('## Summary Data');
		expect(markdown).toContain('- New bugs: 1');
		expect(markdown).toContain('- External bugs: 1');
		expect(markdown).toContain('## External Partner Focus');
		expect(markdown).toContain('- partner_a: 1 issues');
		expect(markdown).toContain('## New Bugs');
		expect(markdown).toContain('repo-a #78: [BUG] 登录失败');
		expect(markdown).toContain('## New Requirements');
		expect(markdown).toContain('repo-b #15: [需求] 增加导出');
		expect(markdown).not.toContain('## Notes For AI');
	});

	it('leaves empty sections blank instead of inserting fake none bullets', () => {
		const markdown = buildAiBriefMarkdown({
			date: '2026-06-18',
			newBugCount: 0,
			newRequirementCount: 0,
			externalBugCount: 0,
			externalRequirementCount: 0,
			newIssueCount: 0,
			externalIssueCount: 0,
			repos: [],
			topExternalAuthors: [],
			externalAuthorIssueCounts: {},
			unknownClassifications: 0,
			syncStatus: 'success',
			bugIssues: [],
			requirementIssues: [],
			externalBugIssues: [],
			externalRequirementIssues: [],
			unknownIssues: [],
		} as DailyReport);

		expect(markdown).toContain('## External Partner Focus');
		expect(markdown).toContain('## New Bugs');
		expect(markdown).toContain('## New Requirements');
		expect(markdown).toContain('## Unknown Classification');
		expect(markdown).not.toContain('- None');
	});

	it('renders unknown issues in the brief when classifications are unknown', () => {
		const markdown = buildAiBriefMarkdown({
			date: '2026-06-22',
			newBugCount: 0,
			newRequirementCount: 0,
			externalBugCount: 0,
			externalRequirementCount: 0,
			newIssueCount: 2,
			externalIssueCount: 1,
			repos: ['kmp-cmp-example', 'kotlin'],
			topExternalAuthors: ['panyang123'],
			externalAuthorIssueCounts: {panyang123: 1},
			unknownClassifications: 2,
			syncStatus: 'success',
			bugIssues: [],
			requirementIssues: [],
			externalBugIssues: [],
			externalRequirementIssues: [],
			unknownIssues: [
				{
					sourceRepo: 'kotlin',
					iid: 188,
					title: 'refactor(KN): adapt CRT/CMC for macos_arm64 target',
				} as DailyReport['unknownIssues'][number],
				{
					sourceRepo: 'kmp-cmp-example',
					iid: 3,
					title: 'harmonyApp 改用 OHPM @cpf-kmp-cmp/compose 包替换本地 compose.har 依赖',
				} as DailyReport['unknownIssues'][number],
			],
		} as DailyReport);

		expect(markdown).toContain('- Unknown classifications: 2');
		expect(markdown).toContain('## Unknown Classification');
		expect(markdown).toContain('kotlin #188: refactor(KN): adapt CRT/CMC for macos_arm64 target');
		expect(markdown).toContain('kmp-cmp-example #3: harmonyApp 改用 OHPM @cpf-kmp-cmp/compose 包替换本地 compose.har 依赖');
	});
});
