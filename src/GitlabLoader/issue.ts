import {sanitizeFileName} from '../utils/utils';
import {Assignee, Epic, Issue, ObsidianIssue, References, ShortIssue, TimeStats} from "./issue-types";

export class GitlabIssue implements ObsidianIssue {

	private readonly orgName?: string;
	private readonly repoName?: string;

	id: number;
	title: string;
	description: string;
	due_date: string;
	web_url: string;
	references: string | References;

	get filename() {
		if (this.orgName && this.repoName) {
			return `${this.encodePathForFilename(this.orgName)}__${this.encodePathForFilename(this.repoName)}__${this.iid}`;
		}

		return sanitizeFileName(this.title);
	}

	constructor(issue: Issue, orgName?: string, repoName?: string) {
		Object.assign(this, issue);
		const resolvedContext = this.resolveRepositoryContext(issue, orgName, repoName);

		this.orgName = resolvedContext.orgName;
		this.repoName = resolvedContext.repoName;
	}

	_links: {
		self: string;
		notes: string;
		award_emoji: string;
		project: string;
		closed_as_duplicate_of: string
	};
	assignees: Assignee[];
	author: Assignee;
	closed_by: Assignee;
	confidential: boolean;
	created_at: string;
	discussion_locked: boolean;
	downvotes: number;
	epic: Epic;
	has_tasks: boolean;
	iid: number;
	imported: boolean;
	imported_from: string;
	issue_type: string;
	labels: string[];
	merge_requests_count: number;
	milestone: ShortIssue;
	project_id: number;
	severity: string;
	state: string;
	task_completion_status: { count: number; completed_count: number };
	task_status: string;
	time_stats: TimeStats;
	updated_at: string;
	upvotes: number;
	user_notes_count: number;

	private resolveRepositoryContext(issue: Issue, orgName?: string, repoName?: string) {
		const referenceContext = this.parseProjectPath(
			typeof issue.references === 'string' ? undefined : issue.references.full,
		);
		const urlContext = this.parseProjectUrl(issue.web_url);

		return {
			orgName: this.pickProvidedValue(orgName, referenceContext?.orgName, urlContext?.orgName),
			repoName: this.pickProvidedValue(repoName, referenceContext?.repoName, urlContext?.repoName),
		};
	}

	private pickProvidedValue(...values: Array<string | undefined>) {
		return values.find((value) => Boolean(value?.trim()));
	}

	private encodePathForFilename(value: string) {
		return value
			.split('/')
			.filter(Boolean)
			.map((segment) => sanitizeFileName(encodeURIComponent(segment)))
			.join('%2F');
	}

	private parseProjectPath(referenceFull?: string) {
		if (!referenceFull) {
			return;
		}

		const [projectPath] = referenceFull.split('#');
		const pathSegments = projectPath.split('/').filter(Boolean);

		if (pathSegments.length < 2) {
			return;
		}

		return {
			orgName: pathSegments.slice(0, -1).join('/'),
			repoName: pathSegments[pathSegments.length - 1],
		};
	}

	private parseProjectUrl(webUrl: string) {
		try {
			const url = new URL(webUrl);
			const pathSegments = url.pathname.split('/').filter(Boolean);
			const issuesSegmentIndex = pathSegments.lastIndexOf('issues');

			if (issuesSegmentIndex < 2) {
				return;
			}

			const projectEndIndex = pathSegments[issuesSegmentIndex - 1] === '-'
				? issuesSegmentIndex - 1
				: issuesSegmentIndex;
			const projectSegments = pathSegments.slice(0, projectEndIndex);

			if (projectSegments.length < 2) {
				return;
			}

			return {
				orgName: projectSegments.slice(0, -1).join('/'),
				repoName: projectSegments[projectSegments.length - 1],
			};
		} catch (error) {
			return;
		}
	}
}
