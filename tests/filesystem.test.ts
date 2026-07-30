import Filesystem from "../src/filesystem";
import {normalizeSettings} from "../src/SettingsTab/settings";
import {GitlabIssuesSettings} from "../src/SettingsTab/settings-types";
import {TFile, TFolder} from "obsidian";

function makeSettings(overrides: Partial<GitlabIssuesSettings> = {}): GitlabIssuesSettings {
	return normalizeSettings({
		gitlabUrl: 'https://gitcode.com',
		apiBaseUrl: 'https://gitcode.com/api/v5',
		gitlabToken: 'test-token',
		gitlabIssuesLevel: 'project',
		orgName: 'CPF-KMP-CMP',
		repoList: ['repo-a'],
		syncAllOrgRepos: false,
		gitlabAppId: '',
		internalUserWhitelist: [],
		classificationRules: {
			titlePrefixes: {
				'[BUG]': 'bug',
				'[需求]': 'requirement',
			},
			labels: {},
		},
		templateFile: 'template.md',
		outputDir: 'GitCode Issues',
		issuesFolder: 'GitCode Issues/issues',
		metaFolder: 'GitCode Issues/meta',
		reportsFolder: 'GitCode Issues/reports',
		issueFilter: '',
		filter: '',
		generateDailyReports: true,
		showIcon: false,
		purgeIssues: false,
		refreshOnStartup: false,
		intervalOfRefresh: 'off',
		...overrides,
	});
}

describe('Filesystem', () => {
	it('removes a retired report file only when it exists', async () => {
		const existingFile = Object.assign(new TFile(), {
			path: 'GitCode Issues/reports/issue-ledger.csv',
			name: 'issue-ledger.csv',
			basename: 'issue-ledger',
			extension: 'csv',
		});
		const vault = {
			getAbstractFileByPath: jest.fn().mockReturnValue(existingFile),
			delete: jest.fn().mockResolvedValue(undefined),
		} as any;

		await new Filesystem(vault, makeSettings()).removeFileIfExists(existingFile.path);
		await new Filesystem({...vault, getAbstractFileByPath: jest.fn().mockReturnValue(null)}, makeSettings())
			.removeFileIfExists(existingFile.path);

		expect(vault.delete).toHaveBeenCalledWith(existingFile);
		expect(vault.delete).toHaveBeenCalledTimes(1);
	});

	it('reads issue note content from the latest vault file contents instead of stale cached text', async () => {
		const noteFile = Object.assign(new TFile(), {
			path: 'GitCode Issues/issues/CPF-KMP-CMP__repo-a__81.md',
			name: 'CPF-KMP-CMP__repo-a__81.md',
			basename: 'CPF-KMP-CMP__repo-a__81',
			extension: 'md',
		});
		const issueFolder = Object.assign(new TFolder(), {
			path: 'GitCode Issues/issues',
			name: 'issues',
			children: [noteFile],
		});
		const cachedMarkdown = `---
id: 222
iid: 81
title: "没有前缀的标题"
state: open
createdAt: 2026-07-01T09:00:00+08:00
updatedAt: 2026-07-01T09:00:00+08:00
webUrl: "https://gitcode.com/CPF-KMP-CMP/repo-a/issues/81"
projectId: 1001
projectPath: "CPF-KMP-CMP/repo-a"
sourceScope: "project"
sourceRepo: "repo-a"
authorUsername: "partner_a"
authorName: "Partner A"
isInternalAuthor: false
internalMatchedBy: "none"
labels: []
issueTypeRaw: ""
requestKind: unknown
requestKindMatchedBy: "none"
referencesFull: "CPF-KMP-CMP/repo-a#81"
---
`;
		const latestMarkdown = cachedMarkdown
			.replace('requestKind: unknown', 'requestKind: requirement')
			.replace('requestKindMatchedBy: "none"', 'requestKindMatchedBy: "title"');
		const vault = {
			getAbstractFileByPath: jest.fn().mockReturnValue(issueFolder),
			cachedRead: jest.fn().mockResolvedValue(cachedMarkdown),
			read: jest.fn().mockResolvedValue(latestMarkdown),
		} as any;

		const filesystem = new Filesystem(vault, makeSettings());

		await expect(filesystem.readIssueNotes()).resolves.toEqual([
			expect.objectContaining({
				iid: 81,
				requestKind: 'requirement',
				requestKindMatchedBy: 'title',
			}),
		]);
	});
});
