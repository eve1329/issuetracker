import {NormalizedIssueNote} from "../Issues/issue-note";

export interface DailyReport {
	date: string;
	newBugCount: number;
	newRequirementCount: number;
	externalBugCount: number;
	externalRequirementCount: number;
	newIssueCount: number;
	externalIssueCount: number;
	repos: string[];
	topExternalAuthors: string[];
	externalAuthorIssueCounts: Record<string, number>;
	unknownClassifications: number;
	syncStatus: 'success' | 'degraded';
	bugIssues: NormalizedIssueNote[];
	requirementIssues: NormalizedIssueNote[];
	externalBugIssues: NormalizedIssueNote[];
	externalRequirementIssues: NormalizedIssueNote[];
	unknownIssues: NormalizedIssueNote[];
}

function renderYamlList(key: string, values: string[]): string[] {
	if (values.length === 0) {
		return [`${key}: []`];
	}

	return [
		`${key}:`,
		...values.map((value) => `  - ${value}`),
	];
}

function renderIssueSection(title: string, issues: NormalizedIssueNote[]): string[] {
	return [
		`## ${title}`,
		...issues.map((issue) => `- ${issue.sourceRepo} #${issue.iid}: ${issue.title}`),
		'',
	];
}

export function buildDailyReport(date: string, issues: NormalizedIssueNote[]): DailyReport {
	const sameDayIssues = issues.filter((issue) => issue.createdAt.startsWith(date));
	const bugIssues = sameDayIssues.filter((issue) => issue.requestKind === 'bug');
	const requirementIssues = sameDayIssues.filter((issue) => issue.requestKind === 'requirement');
	const unknownIssues = sameDayIssues.filter((issue) => issue.requestKind === 'unknown');
	const externalBugIssues = bugIssues.filter((issue) => !issue.isInternalAuthor);
	const externalRequirementIssues = requirementIssues.filter((issue) => !issue.isInternalAuthor);
	const externalIssues = sameDayIssues.filter((issue) => !issue.isInternalAuthor);
	const externalAuthorCounts = externalIssues.reduce<Record<string, number>>((counts, issue) => {
		counts[issue.authorUsername] = (counts[issue.authorUsername] || 0) + 1;
		return counts;
	}, {});

	return {
		date,
		newBugCount: bugIssues.length,
		newRequirementCount: requirementIssues.length,
		externalBugCount: externalBugIssues.length,
		externalRequirementCount: externalRequirementIssues.length,
		newIssueCount: sameDayIssues.length,
		externalIssueCount: externalIssues.length,
		repos: [...new Set(sameDayIssues.map((issue) => issue.sourceRepo))].sort(),
		topExternalAuthors: Object.entries(externalAuthorCounts)
			.sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]))
			.map(([username]) => username)
			.slice(0, 5),
		externalAuthorIssueCounts: externalAuthorCounts,
		unknownClassifications: unknownIssues.length,
		syncStatus: 'success',
		bugIssues,
		requirementIssues,
		externalBugIssues,
		externalRequirementIssues,
		unknownIssues,
	};
}

export function buildDailyReportMarkdown(report: DailyReport): string {
	return [
		'---',
		`date: ${report.date}`,
		`newBugCount: ${report.newBugCount}`,
		`newRequirementCount: ${report.newRequirementCount}`,
		`externalBugCount: ${report.externalBugCount}`,
		`externalRequirementCount: ${report.externalRequirementCount}`,
		`newIssueCount: ${report.newIssueCount}`,
		`externalIssueCount: ${report.externalIssueCount}`,
		...renderYamlList('repos', report.repos),
		...renderYamlList('topExternalAuthors', report.topExternalAuthors),
		`unknownClassifications: ${report.unknownClassifications}`,
		`syncStatus: ${report.syncStatus}`,
		'---',
		'',
		...renderIssueSection('New Bugs', report.bugIssues),
		...renderIssueSection('New Requirements', report.requirementIssues),
		...renderIssueSection('External Partner Bugs', report.externalBugIssues),
		...renderIssueSection('External Partner Requirements', report.externalRequirementIssues),
		...renderIssueSection('Unknown Classification', report.unknownIssues),
	].join('\n');
}
