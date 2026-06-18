export interface Assignee {
	readonly avatar_url: string;
	readonly id: number;
	readonly locked: boolean;
	readonly name: string;
	readonly state: string;
	readonly username: string;
	readonly web_url: string;
}

export interface GitCodeUser {
	readonly avatar_url?: string;
	readonly html_url?: string;
	readonly id: number | string;
	readonly login: string;
	readonly name: string;
}

export interface GitCodeRepository {
	readonly id: number;
	readonly full_name: string;
	readonly path: string;
	readonly name: string;
}

export interface GitCodeOrgRepository {
	readonly id: number;
	readonly path: string;
	readonly name: string;
	readonly full_name?: string;
	readonly open_issues_count?: number;
}

export interface Epic {
	readonly id: number,
	readonly iid: number,
	readonly title: string,
	readonly url: string,
	readonly group_id: number
}

export interface References {
	readonly short: string,
	readonly relative: string,
	readonly full: string
}

export interface TimeStats {
	readonly time_estimate: number;
	readonly total_time_spent: number;
	readonly human_time_spent: number;
	readonly human_total_time_spent: number;
}

export interface ShortIssue {
	readonly  due_date: string,
	readonly project_id: number,
	readonly state: string,
	readonly description: string,
	readonly iid: number,
	readonly id: number,
	readonly title: string,
	readonly created_at: string,
	readonly updated_at: string
	readonly number?: number | string,
}

export interface Issue extends ShortIssue {
	readonly web_url: string;
	readonly html_url?: string;
	readonly references: string | References;

	readonly assignees: Assignee[];
	readonly author: Assignee;
	readonly user?: GitCodeUser;
	readonly closed_by: Assignee;
	readonly epic: Epic;
	readonly labels: string[];
	readonly upvotes: number;
	readonly downvotes: number;
	readonly merge_requests_count: number;
	readonly user_notes_count: number;
	readonly imported: boolean;
	readonly imported_from: string;
	readonly has_tasks: boolean
	readonly task_status: string,
	readonly confidential: boolean,
	readonly discussion_locked: boolean
	readonly issue_type: string,
	readonly    time_stats: TimeStats,
	readonly severity: string,
	readonly _links: {
		self: string,
		notes: string,
		award_emoji: string,
		project: string,
		closed_as_duplicate_of: string
	},
	readonly task_completion_status: {
		count: number,
		completed_count: number
	}
	readonly milestone: ShortIssue
	readonly repository?: GitCodeRepository;
}

export interface ObsidianIssue extends Issue {
	filename: string
}
