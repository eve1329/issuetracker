import {DailyReport} from "./daily-report-builder";

export function buildAiBriefMarkdown(report: DailyReport): string {
	const externalAuthorCounts = report.topExternalAuthors.map((username) => {
		const issueCount = report.externalAuthorIssueCounts[username] ?? 0;

		return `- ${username}: ${issueCount} issues`;
	});

	return [
		`# GitCode Issue Daily Brief - ${report.date}`,
		'',
		'## Summary Data',
		`- New bugs: ${report.newBugCount}`,
		`- New requirements: ${report.newRequirementCount}`,
		`- External bugs: ${report.externalBugCount}`,
		`- External requirements: ${report.externalRequirementCount}`,
		`- Unknown classifications: ${report.unknownClassifications}`,
		'',
		'## External Partner Focus',
		...externalAuthorCounts,
		'',
		'## New Bugs',
		...report.bugIssues.map((issue) => `- ${issue.sourceRepo} #${issue.iid}: ${issue.title}`),
		'',
		'## New Requirements',
		...report.requirementIssues.map((issue) => `- ${issue.sourceRepo} #${issue.iid}: ${issue.title}`),
		'',
		'## Notes For AI',
		'- Highlight the main issue categories by volume',
		'- Call out which repos received the most external feedback',
		'- Mention repeated themes when visible from titles',
		'- Mention unknown classifications if count > 0',
		'',
	].join('\n');
}
