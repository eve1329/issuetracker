
import * as Utils from '../../src/utils/utils';
import { Issue } from '../../src/GitlabLoader/issue-types';
import {GitlabIssue} from "../../src/GitlabLoader/issue";
import {classifyIssue} from "../../src/Classification/classification";
import {DEFAULT_SETTINGS} from "../../src/SettingsTab/settings";



const mockIssue: Issue = {
	id: 1,
	title: 'Test Issue',
	description: 'This is a test issue',
	due_date: '2024-12-31',
	web_url: 'https://gitlab.com/test/test-issue',
	references: 'test-ref',

	_links: {
		self: 'self-link',
		notes: 'notes-link',
		award_emoji: 'award-emoji-link',
		project: 'project-link',
		closed_as_duplicate_of: 'closed-duplicate-link'
	},
	assignees: [],
	author: { id: 1, name: 'author', username: 'author', state: 'active', avatar_url: '', web_url: '', locked: false },
	closed_by: { id: 2, name: 'closer', username: 'closer', state: 'active', avatar_url: '', web_url: '', locked: false },
	confidential: false,
	created_at: '2024-01-01',
	discussion_locked: false,
	downvotes: 0,
	epic: { id: 1, iid: 1, title: 'Epic', group_id: 9, url: "" },
	has_tasks: false,
	iid: 1,
	imported: false,
	imported_from: '',
	issue_type: 'issue',
	labels: ['bug'],
	merge_requests_count: 0,
	milestone: { id: 1, iid: 1, title: 'Milestone', updated_at: '', created_at: "", description: "", due_date: "", project_id:8, state:"" },
	project_id: 1,
	severity: 'low',
	state: 'opened',
	task_completion_status: { count: 0, completed_count: 0 },
	task_status: 'open',
	time_stats: { time_estimate: 0, total_time_spent: 0, human_time_spent: 7, human_total_time_spent: 8 },
	updated_at: '2024-01-02',
	upvotes: 1,
	user_notes_count: 0
};

describe('GitlabIssue', () => {
	afterEach(() => {
		jest.restoreAllMocks();
	});

	it('should correctly assign properties from the issue object', () => {
		const gitlabIssue = new GitlabIssue(mockIssue);

		expect(gitlabIssue.id).toEqual(mockIssue.id);
		expect(gitlabIssue.title).toEqual(mockIssue.title);
		expect(gitlabIssue.description).toEqual(mockIssue.description);
		expect(gitlabIssue.due_date).toEqual(mockIssue.due_date);
		expect(gitlabIssue.web_url).toEqual(mockIssue.web_url);
		expect(gitlabIssue.references).toEqual(mockIssue.references);
		expect(gitlabIssue._links).toEqual(mockIssue._links);
		expect(gitlabIssue.assignees).toEqual(mockIssue.assignees);
		expect(gitlabIssue.author).toEqual(mockIssue.author);
		expect(gitlabIssue.closed_by).toEqual(mockIssue.closed_by);
		expect(gitlabIssue.confidential).toEqual(mockIssue.confidential);
		expect(gitlabIssue.created_at).toEqual(mockIssue.created_at);
		expect(gitlabIssue.discussion_locked).toEqual(mockIssue.discussion_locked);
		expect(gitlabIssue.downvotes).toEqual(mockIssue.downvotes);
		expect(gitlabIssue.epic).toEqual(mockIssue.epic);
		expect(gitlabIssue.has_tasks).toEqual(mockIssue.has_tasks);
		expect(gitlabIssue.iid).toEqual(mockIssue.iid);
		expect(gitlabIssue.imported).toEqual(mockIssue.imported);
		expect(gitlabIssue.imported_from).toEqual(mockIssue.imported_from);
		expect(gitlabIssue.issue_type).toEqual(mockIssue.issue_type);
		expect(gitlabIssue.labels).toEqual(mockIssue.labels);
		expect(gitlabIssue.merge_requests_count).toEqual(mockIssue.merge_requests_count);
		expect(gitlabIssue.milestone).toEqual(mockIssue.milestone);
		expect(gitlabIssue.project_id).toEqual(mockIssue.project_id);
		expect(gitlabIssue.severity).toEqual(mockIssue.severity);
		expect(gitlabIssue.state).toEqual(mockIssue.state);
		expect(gitlabIssue.task_completion_status).toEqual(mockIssue.task_completion_status);
		expect(gitlabIssue.task_status).toEqual(mockIssue.task_status);
		expect(gitlabIssue.time_stats).toEqual(mockIssue.time_stats);
		expect(gitlabIssue.updated_at).toEqual(mockIssue.updated_at);
		expect(gitlabIssue.upvotes).toEqual(mockIssue.upvotes);
		expect(gitlabIssue.user_notes_count).toEqual(mockIssue.user_notes_count);
	});

	it('should correctly sanitize the filename using the title', () => {
		const mockSanitizeFileName = jest.spyOn(Utils, "sanitizeFileName").mockReturnValue('sanitized-Test');
		const gitlabIssue = new GitlabIssue(mockIssue);
		expect(gitlabIssue.filename).toEqual(`sanitized-Test`);
		expect(mockSanitizeFileName).toHaveBeenCalledWith(mockIssue.title);
	});

	it('classifies [BUG] titles using title prefixes before writing notes', () => {
		const result = classifyIssue(
			{
				title: '[BUG] 登录按钮点击无响应',
				labels: ['enhancement'],
			},
			DEFAULT_SETTINGS.classificationRules,
		);

		expect(result).toEqual({
			requestKind: 'bug',
			requestKindMatchedBy: 'title-prefix',
		});
	});

	it('uses org, repo, and iid in the output filename when repository context is provided', () => {
		const gitlabIssue = new GitlabIssue(
			{
				...mockIssue,
				iid: 78,
				title: '[BUG] 登录按钮点击无响应',
				references: {
					full: 'CPF-KMP-CMP/repo-a#78',
					short: '#78',
					relative: '#78',
				},
			},
			'CPF-KMP-CMP',
			'repo-a',
		);

		expect(gitlabIssue.filename).toBe('CPF-KMP-CMP__repo-a__78');
	});

	it('keeps nested group project paths distinct from hyphenated top-level names', () => {
		const nestedGroupIssue = new GitlabIssue(
			{
				...mockIssue,
				iid: 78,
				references: {
					full: 'CPF-KMP-CMP/subgroup/repo-a#78',
					short: '#78',
					relative: '#78',
				},
			},
			'CPF-KMP-CMP/subgroup',
			'repo-a',
		);
		const hyphenatedTopLevelIssue = new GitlabIssue(
			{
				...mockIssue,
				iid: 78,
				references: {
					full: 'CPF-KMP-CMP-subgroup/repo-a#78',
					short: '#78',
					relative: '#78',
				},
			},
			'CPF-KMP-CMP-subgroup',
			'repo-a',
		);

		expect(nestedGroupIssue.filename).toBe('CPF-KMP-CMP%2Fsubgroup__repo-a__78');
		expect(hyphenatedTopLevelIssue.filename).toBe('CPF-KMP-CMP-subgroup__repo-a__78');
		expect(nestedGroupIssue.filename).not.toBe(hyphenatedTopLevelIssue.filename);
	});

	it('derives the stable filename from references.full for raw issues', () => {
		const gitlabIssue = new GitlabIssue({
			...mockIssue,
			iid: 78,
			references: {
				full: 'CPF-KMP-CMP/repo-a#78',
				short: '#78',
				relative: '#78',
			},
			web_url: 'https://gitlab.com/CPF-KMP-CMP/repo-a/-/issues/78',
		});

		expect(gitlabIssue.filename).toBe('CPF-KMP-CMP__repo-a__78');
		expect(gitlabIssue.filename).not.toContain('/');
	});

	it('falls back to web_url for raw issues when references.full is unavailable', () => {
		const gitlabIssue = new GitlabIssue({
			...mockIssue,
			iid: 78,
			references: 'CPF-KMP-CMP/repo-a#78',
			web_url: 'https://gitlab.com/CPF-KMP-CMP/repo-a/-/issues/78',
		});

		expect(gitlabIssue.filename).toBe('CPF-KMP-CMP__repo-a__78');
		expect(gitlabIssue.filename).not.toContain('/');
	});

	it('parses web_url routes when the namespace contains a literal issues segment', () => {
		const gitlabIssue = new GitlabIssue({
			...mockIssue,
			iid: 78,
			references: 'acme/issues/repo#78',
			web_url: 'https://gitlab.com/acme/issues/repo/-/issues/78',
		});

		expect(gitlabIssue.filename).toBe('acme%2Fissues__repo__78');
		expect(gitlabIssue.filename).not.toContain('/');
	});
});
