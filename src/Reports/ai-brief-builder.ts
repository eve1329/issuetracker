import {DailyReport} from "./daily-report-builder";

export function buildAiBriefMarkdown(report: DailyReport): string {
	const externalAuthorCounts = report.topExternalAuthors.map((username) => {
		const issueCount = report.externalAuthorIssueCounts[username] ?? 0;

		return `- ${username}: ${issueCount} issues`;
	});

	const unknownIssues = report.unknownIssues.map((issue) => `- ${issue.sourceRepo} #${issue.iid}: ${issue.title}`);

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
		'## Unknown Classification',
		...unknownIssues,
		'',
	].join('\n');
}
