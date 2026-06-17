import {buildIssueNoteMarkdown, NormalizedIssueNote} from "../../src/Issues/issue-note";

describe('buildIssueNoteMarkdown', () => {
	it('renders the normalized frontmatter fields required by Dataview', () => {
		const markdown = buildIssueNoteMarkdown({
			id: 123456,
			iid: 78,
			title: '[BUG] 登录按钮点击无响应',
			state: 'opened',
			createdAt: '2026-06-17T09:12:00+08:00',
			updatedAt: '2026-06-17T10:05:00+08:00',
			webUrl: 'https://gitcode.com/CPF-KMP-CMP/repo-a/issues/78',
			projectId: 1001,
			projectPath: 'CPF-KMP-CMP/repo-a',
			sourceScope: 'project',
			sourceRepo: 'repo-a',
			authorUsername: 'partner_a',
			authorName: '张三',
			isInternalAuthor: false,
			internalMatchedBy: 'none',
			labels: ['P1', 'login'],
			issueTypeRaw: 'issue',
			requestKind: 'bug',
			requestKindMatchedBy: 'title-prefix',
			referencesFull: 'CPF-KMP-CMP/repo-a#78',
		} as NormalizedIssueNote);

		expect(markdown).toContain('id: 123456');
		expect(markdown).toContain('iid: 78');
		expect(markdown).toContain('title: "[BUG] 登录按钮点击无响应"');
		expect(markdown).toContain('state: opened');
		expect(markdown).toContain('createdAt: 2026-06-17T09:12:00+08:00');
		expect(markdown).toContain('updatedAt: 2026-06-17T10:05:00+08:00');
		expect(markdown).toContain('webUrl: "https://gitcode.com/CPF-KMP-CMP/repo-a/issues/78"');
		expect(markdown).toContain('projectId: 1001');
		expect(markdown).toContain('projectPath: "CPF-KMP-CMP/repo-a"');
		expect(markdown).toContain('sourceScope: "project"');
		expect(markdown).toContain('sourceRepo: "repo-a"');
		expect(markdown).toContain('authorUsername: "partner_a"');
		expect(markdown).toContain('authorName: "张三"');
		expect(markdown).toContain('isInternalAuthor: false');
		expect(markdown).toContain('internalMatchedBy: "none"');
		expect(markdown).toContain('labels:\n  - "P1"\n  - "login"');
		expect(markdown).toContain('issueTypeRaw: "issue"');
		expect(markdown).toContain('requestKind: bug');
		expect(markdown).toContain('requestKindMatchedBy: "title-prefix"');
		expect(markdown).toContain('referencesFull: "CPF-KMP-CMP/repo-a#78"');
		expect(markdown).toContain('\n# [BUG] 登录按钮点击无响应\n');
	});
});
