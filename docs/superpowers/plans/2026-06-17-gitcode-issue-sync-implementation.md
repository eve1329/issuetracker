# GitCode Issue Sync And Daily Reporting Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn `/Users/ming/Documents/kmp/issue` into a local Obsidian plugin workspace based on `obsidian-gitlab-issues`, extended for GitCode issue sync, internal/external author classification, and daily report generation.

**Architecture:** Initialize a local git repository, import the upstream plugin source into the current workspace, then layer GitCode-aware settings, member syncing, issue normalization, file upsert helpers, and report builders behind a new sync orchestration service. Persist normalized issues plus daily summary artifacts into the Obsidian vault so `Dataview` can query the same dataset without embedding analytics logic into the plugin UI.

**Tech Stack:** TypeScript, Obsidian Plugin API, Jest, Handlebars, npm, Git

---

## File Map

- Create: `/Users/ming/Documents/kmp/issue/.git/`
- Modify: `/Users/ming/Documents/kmp/issue/package.json`
- Modify: `/Users/ming/Documents/kmp/issue/src/main.ts`
- Modify: `/Users/ming/Documents/kmp/issue/src/filesystem.ts`
- Modify: `/Users/ming/Documents/kmp/issue/src/GitlabLoader/gitlab-api.ts`
- Modify: `/Users/ming/Documents/kmp/issue/src/GitlabLoader/gitlab-loader.ts`
- Modify: `/Users/ming/Documents/kmp/issue/src/GitlabLoader/issue-types.ts`
- Modify: `/Users/ming/Documents/kmp/issue/src/GitlabLoader/issue.ts`
- Modify: `/Users/ming/Documents/kmp/issue/src/SettingsTab/settings-types.ts`
- Modify: `/Users/ming/Documents/kmp/issue/src/SettingsTab/settings.ts`
- Modify: `/Users/ming/Documents/kmp/issue/src/SettingsTab/settings-tab.ts`
- Create: `/Users/ming/Documents/kmp/issue/src/Members/member-types.ts`
- Create: `/Users/ming/Documents/kmp/issue/src/Members/member-loader.ts`
- Create: `/Users/ming/Documents/kmp/issue/src/Classification/classification.ts`
- Create: `/Users/ming/Documents/kmp/issue/src/Issues/issue-note.ts`
- Create: `/Users/ming/Documents/kmp/issue/src/Reports/daily-report-builder.ts`
- Create: `/Users/ming/Documents/kmp/issue/src/Reports/ai-brief-builder.ts`
- Create: `/Users/ming/Documents/kmp/issue/src/Sync/sync-service.ts`
- Create: `/Users/ming/Documents/kmp/issue/tests/Members/member-loader.test.ts`
- Create: `/Users/ming/Documents/kmp/issue/tests/Classification/classification.test.ts`
- Create: `/Users/ming/Documents/kmp/issue/tests/Issues/issue-note.test.ts`
- Create: `/Users/ming/Documents/kmp/issue/tests/Reports/daily-report-builder.test.ts`
- Create: `/Users/ming/Documents/kmp/issue/tests/Reports/ai-brief-builder.test.ts`
- Create: `/Users/ming/Documents/kmp/issue/tests/Sync/sync-service.test.ts`
- Modify: `/Users/ming/Documents/kmp/issue/tests/GitlabLoader/gitlab-api.test.ts`
- Modify: `/Users/ming/Documents/kmp/issue/tests/GitlabLoader/gitlab-loader.test.ts`
- Modify: `/Users/ming/Documents/kmp/issue/tests/GitlabLoader/issue.test.ts`
- Modify: `/Users/ming/Documents/kmp/issue/tests/SettingsTab/settings.test.ts`

### Task 0: Bootstrap The Local Plugin Workspace

**Files:**
- Create: `/Users/ming/Documents/kmp/issue/.git/`
- Create: upstream plugin files copied into `/Users/ming/Documents/kmp/issue/`
- Modify: `/Users/ming/Documents/kmp/issue/.agents/state/process.md`

- [ ] **Step 1: Initialize a local git repository in the current workspace**

Run:

```bash
cd /Users/ming/Documents/kmp/issue
git init -b main
```

Expected: `Initialized empty Git repository in /Users/ming/Documents/kmp/issue/.git/`

- [ ] **Step 2: Import the upstream `obsidian-gitlab-issues` source into the current workspace without overwriting the existing handoff files**

Run:

```bash
cd /Users/ming/Documents/kmp/issue
tmpdir="$(mktemp -d)"
git clone --depth=1 https://github.com/benr77/obsidian-gitlab-issues "$tmpdir/repo"
rsync -a --exclude .git "$tmpdir/repo/" /Users/ming/Documents/kmp/issue/
```

Expected: `package.json`, `src/`, `tests/`, `manifest.json`, and upstream build files now exist under `/Users/ming/Documents/kmp/issue/`

- [ ] **Step 3: Install dependencies and run the upstream baseline tests before changing behavior**

Run:

```bash
cd /Users/ming/Documents/kmp/issue
npm ci
npm test -- --runInBand
```

Expected: the imported upstream Jest suite passes before any GitCode-specific changes

- [ ] **Step 4: Update the repo-local handoff state so the workspace no longer looks empty after resume**

Write the following update into `/Users/ming/Documents/kmp/issue/.agents/state/process.md`:

```md
## Done
- Initialized local git repository in `/Users/ming/Documents/kmp/issue`.
- Imported upstream `benr77/obsidian-gitlab-issues` into the current workspace.
- Installed npm dependencies and verified the upstream baseline test suite passes.

## Next Step
1. Extend settings and API primitives for GitCode `/api/v5`, repository lists, member whitelists, and daily report toggles.
```

- [ ] **Step 5: Commit the clean imported baseline**

Run:

```bash
cd /Users/ming/Documents/kmp/issue
git add .
git commit -m "chore: import upstream obsidian gitlab issues plugin"
```

Expected: one baseline commit containing the imported upstream plugin plus the existing spec and plan docs

### Task 1: Extend Settings And API Primitives For GitCode

**Files:**
- Modify: `/Users/ming/Documents/kmp/issue/src/SettingsTab/settings-types.ts`
- Modify: `/Users/ming/Documents/kmp/issue/src/SettingsTab/settings.ts`
- Modify: `/Users/ming/Documents/kmp/issue/src/SettingsTab/settings-tab.ts`
- Modify: `/Users/ming/Documents/kmp/issue/src/GitlabLoader/gitlab-api.ts`
- Modify: `/Users/ming/Documents/kmp/issue/tests/SettingsTab/settings.test.ts`
- Modify: `/Users/ming/Documents/kmp/issue/tests/GitlabLoader/gitlab-api.test.ts`

- [ ] **Step 1: Write failing tests for the new GitCode settings contract and paged API loader**

Add tests like these:

```ts
it('uses the explicit GitCode api base URL when provided', () => {
  const settings = {
    ...DEFAULT_SETTINGS,
    gitlabUrl: 'https://gitcode.com',
    apiBaseUrl: 'https://gitcode.com/api/v5',
  };

  expect(settings.gitlabApiUrl()).toBe('https://gitcode.com/api/v5');
});

it('defaults the GitCode-specific folders and report toggle', () => {
  expect(DEFAULT_SETTINGS.issuesFolder).toBe('GitCode Issues/issues');
  expect(DEFAULT_SETTINGS.metaFolder).toBe('GitCode Issues/meta');
  expect(DEFAULT_SETTINGS.reportsFolder).toBe('GitCode Issues/reports');
  expect(DEFAULT_SETTINGS.generateDailyReports).toBe(true);
});

it('loads all pages until an empty page is returned', async () => {
  mockRequestUrl
    .mockResolvedValueOnce({status: 200, json: [{id: 1}, {id: 2}], text: ''})
    .mockResolvedValueOnce({status: 200, json: [{id: 3}], text: ''})
    .mockResolvedValueOnce({status: 200, json: [], text: ''});

  const data = await GitlabApi.loadAllPages<{id: number}>(
    'https://gitcode.com/api/v5/repos/CPF-KMP-CMP/repo-a/issues',
    'token'
  );

  expect(data).toEqual([{id: 1}, {id: 2}, {id: 3}]);
});
```

- [ ] **Step 2: Run the targeted tests and verify they fail for missing settings fields and missing pagination support**

Run:

```bash
cd /Users/ming/Documents/kmp/issue
npm test -- tests/SettingsTab/settings.test.ts tests/GitlabLoader/gitlab-api.test.ts --runInBand
```

Expected: FAIL with messages showing missing `apiBaseUrl`, `issuesFolder`, `generateDailyReports`, or `loadAllPages`

- [ ] **Step 3: Implement the settings contract and the paged API helper**

Update `/Users/ming/Documents/kmp/issue/src/SettingsTab/settings-types.ts` to add the new configuration surface:

```ts
export type RequestKind = 'bug' | 'requirement' | 'unknown';

export interface ClassificationRules {
  titlePrefixes: Record<string, Exclude<RequestKind, 'unknown'>>;
  labels: Record<string, Exclude<RequestKind, 'unknown'>>;
}

export interface GitlabIssuesSettings {
  gitlabUrl: string;
  apiBaseUrl: string;
  gitlabToken: string;
  orgName: string;
  repoList: string[];
  internalUserWhitelist: string[];
  classificationRules: ClassificationRules;
  outputDir: string;
  issuesFolder: string;
  metaFolder: string;
  reportsFolder: string;
  issueFilter: string;
  generateDailyReports: boolean;
  purgeIssues: boolean;
  refreshOnStartup: boolean;
  intervalOfRefresh: GitlabRefreshInterval;
  showIcon: boolean;
  gitlabApiUrl(): string;
}
```

Update `/Users/ming/Documents/kmp/issue/src/SettingsTab/settings.ts` defaults:

```ts
export const DEFAULT_SETTINGS: GitlabIssuesSettings = {
  gitlabUrl: 'https://gitcode.com',
  apiBaseUrl: 'https://gitcode.com/api/v5',
  gitlabToken: '',
  orgName: 'CPF-KMP-CMP',
  repoList: [],
  internalUserWhitelist: [],
  classificationRules: {
    titlePrefixes: {
      '[BUG]': 'bug',
      '[需求]': 'requirement',
    },
    labels: {},
  },
  outputDir: 'GitCode Issues',
  issuesFolder: 'GitCode Issues/issues',
  metaFolder: 'GitCode Issues/meta',
  reportsFolder: 'GitCode Issues/reports',
  issueFilter: '',
  generateDailyReports: true,
  purgeIssues: false,
  refreshOnStartup: true,
  intervalOfRefresh: '15',
  showIcon: false,
  gitlabApiUrl(): string {
    return this.apiBaseUrl || `${this.gitlabUrl}/api/v5`;
  },
};
```

Update `/Users/ming/Documents/kmp/issue/src/GitlabLoader/gitlab-api.ts`:

```ts
static async loadAllPages<T>(baseUrl: string, gitlabToken: string): Promise<T[]> {
  const result: T[] = [];
  let page = 1;

  while (true) {
    const separator = baseUrl.includes('?') ? '&' : '?';
    const pageUrl = `${baseUrl}${separator}per_page=100&page=${page}`;
    const pageData = await GitlabApi.load<T[]>(pageUrl, gitlabToken);

    if (pageData.length === 0) {
      break;
    }

    result.push(...pageData);

    if (pageData.length < 100) {
      break;
    }

    page += 1;
  }

  return result;
}
```

Update `/Users/ming/Documents/kmp/issue/src/SettingsTab/settings-tab.ts` so the new fields are editable, using text areas for arrays and JSON:

```ts
new Setting(containerEl)
  .setName('Repository List')
  .setDesc('One repository name per line.')
  .addTextArea((text) => text
    .setValue(this.plugin.settings.repoList.join('\n'))
    .onChange(async (value) => {
      this.plugin.settings.repoList = value.split('\n').map((item) => item.trim()).filter(Boolean);
      await this.plugin.saveSettings();
    }));

new Setting(containerEl)
  .setName('Internal User Whitelist')
  .setDesc('One username per line.')
  .addTextArea((text) => text
    .setValue(this.plugin.settings.internalUserWhitelist.join('\n'))
    .onChange(async (value) => {
      this.plugin.settings.internalUserWhitelist = value.split('\n').map((item) => item.trim()).filter(Boolean);
      await this.plugin.saveSettings();
    }));
```

- [ ] **Step 4: Run the targeted tests again and verify they pass**

Run:

```bash
cd /Users/ming/Documents/kmp/issue
npm test -- tests/SettingsTab/settings.test.ts tests/GitlabLoader/gitlab-api.test.ts --runInBand
```

Expected: PASS for the settings and API pagination tests

- [ ] **Step 5: Commit the settings and API primitive changes**

Run:

```bash
cd /Users/ming/Documents/kmp/issue
git add src/SettingsTab/settings-types.ts src/SettingsTab/settings.ts src/SettingsTab/settings-tab.ts src/GitlabLoader/gitlab-api.ts tests/SettingsTab/settings.test.ts tests/GitlabLoader/gitlab-api.test.ts
git commit -m "feat: add gitcode settings and paged api loading"
```

### Task 2: Add Member Sync And Internal Author Classification

**Files:**
- Create: `/Users/ming/Documents/kmp/issue/src/Members/member-types.ts`
- Create: `/Users/ming/Documents/kmp/issue/src/Members/member-loader.ts`
- Create: `/Users/ming/Documents/kmp/issue/src/Classification/classification.ts`
- Create: `/Users/ming/Documents/kmp/issue/tests/Members/member-loader.test.ts`
- Create: `/Users/ming/Documents/kmp/issue/tests/Classification/classification.test.ts`

- [ ] **Step 1: Write failing tests for organization members, repository collaborators, whitelist merging, and internal-author matching**

Create tests like these:

```ts
it('merges org members, repo collaborators, and whitelist users into one index', async () => {
  mockLoadAllPages
    .mockResolvedValueOnce([{username: 'org_user'}])
    .mockResolvedValueOnce([{username: 'repo_user'}]);

  const loader = new MemberLoader({
    ...DEFAULT_SETTINGS,
    orgName: 'CPF-KMP-CMP',
    repoList: ['repo-a'],
    internalUserWhitelist: ['manual_user'],
  });

  const index = await loader.loadInternalMemberIndex();

  expect(index.usernames.org_user.source).toBe('org');
  expect(index.usernames.repo_user.source).toBe('repo');
  expect(index.usernames.manual_user.source).toBe('whitelist');
});

it('marks an external author as non-internal when not present in the index', () => {
  const result = matchInternalAuthor('outside_user', {
    usernames: {
      org_user: {username: 'org_user', source: 'org'},
    },
  });

  expect(result).toEqual({
    isInternalAuthor: false,
    internalMatchedBy: 'none',
  });
});
```

- [ ] **Step 2: Run the member and classification tests and verify they fail**

Run:

```bash
cd /Users/ming/Documents/kmp/issue
npm test -- tests/Members/member-loader.test.ts tests/Classification/classification.test.ts --runInBand
```

Expected: FAIL because `MemberLoader`, `loadInternalMemberIndex`, and `matchInternalAuthor` do not exist yet

- [ ] **Step 3: Implement the member loader and the internal-author matcher**

Create `/Users/ming/Documents/kmp/issue/src/Members/member-types.ts`:

```ts
export type InternalMatchSource = 'org' | 'repo' | 'whitelist' | 'none';

export interface GitCodeMember {
  username: string;
  name?: string;
}

export interface InternalMemberRecord {
  username: string;
  source: Exclude<InternalMatchSource, 'none'>;
  repo?: string;
}

export interface InternalMemberIndex {
  usernames: Record<string, InternalMemberRecord>;
}
```

Create `/Users/ming/Documents/kmp/issue/src/Members/member-loader.ts`:

```ts
export default class MemberLoader {
  constructor(private settings: GitlabIssuesSettings) {}

  async loadInternalMemberIndex(): Promise<InternalMemberIndex> {
    const usernames: InternalMemberIndex['usernames'] = {};

    const orgMembers = await GitlabApi.loadAllPages<GitCodeMember>(
      `${this.settings.gitlabApiUrl()}/orgs/${this.settings.orgName}/members`,
      this.settings.gitlabToken
    );

    orgMembers.forEach((member) => {
      usernames[member.username] = {username: member.username, source: 'org'};
    });

    for (const repoName of this.settings.repoList) {
      const collaborators = await GitlabApi.loadAllPages<GitCodeMember>(
        `${this.settings.gitlabApiUrl()}/repos/${this.settings.orgName}/${repoName}/collaborators`,
        this.settings.gitlabToken
      );

      collaborators.forEach((member) => {
        if (!usernames[member.username]) {
          usernames[member.username] = {username: member.username, source: 'repo', repo: repoName};
        }
      });
    }

    this.settings.internalUserWhitelist.forEach((username) => {
      if (!usernames[username]) {
        usernames[username] = {username, source: 'whitelist'};
      }
    });

    return {usernames};
  }
}
```

Create `/Users/ming/Documents/kmp/issue/src/Classification/classification.ts`:

```ts
export function matchInternalAuthor(username: string, index: InternalMemberIndex) {
  const match = index.usernames[username];

  if (!match) {
    return {
      isInternalAuthor: false,
      internalMatchedBy: 'none' as const,
    };
  }

  return {
    isInternalAuthor: true,
    internalMatchedBy: match.source,
  };
}
```

- [ ] **Step 4: Run the new tests and verify they pass**

Run:

```bash
cd /Users/ming/Documents/kmp/issue
npm test -- tests/Members/member-loader.test.ts tests/Classification/classification.test.ts --runInBand
```

Expected: PASS for merged member-index creation and internal/external author matching

- [ ] **Step 5: Commit the member sync and author-classification layer**

Run:

```bash
cd /Users/ming/Documents/kmp/issue
git add src/Members/member-types.ts src/Members/member-loader.ts src/Classification/classification.ts tests/Members/member-loader.test.ts tests/Classification/classification.test.ts
git commit -m "feat: add internal member sync and author classification"
```

### Task 3: Add Request Classification, Stable Issue Filenames, And Rich Issue Notes

**Files:**
- Modify: `/Users/ming/Documents/kmp/issue/src/GitlabLoader/issue-types.ts`
- Modify: `/Users/ming/Documents/kmp/issue/src/GitlabLoader/issue.ts`
- Create: `/Users/ming/Documents/kmp/issue/src/Issues/issue-note.ts`
- Modify: `/Users/ming/Documents/kmp/issue/src/filesystem.ts`
- Modify: `/Users/ming/Documents/kmp/issue/tests/GitlabLoader/issue.test.ts`
- Create: `/Users/ming/Documents/kmp/issue/tests/Issues/issue-note.test.ts`

- [ ] **Step 1: Write failing tests for title-prefix classification, stable filenames, and frontmatter rendering**

Add tests like these:

```ts
it('classifies [BUG] titles as bug before writing notes', () => {
  const result = classifyIssue(
    {title: '[BUG] 登录按钮点击无响应', labels: []},
    DEFAULT_SETTINGS.classificationRules
  );

  expect(result).toEqual({
    requestKind: 'bug',
    requestKindMatchedBy: 'title-prefix',
  });
});

it('uses org, repo, and iid in the output filename', () => {
  const issue = new GitlabIssue({
    ...mockIssue,
    iid: 78,
    title: '[BUG] 登录按钮点击无响应',
    references: {full: 'CPF-KMP-CMP/repo-a#78', short: '#78', relative: '#78'},
  }, 'CPF-KMP-CMP', 'repo-a');

  expect(issue.filename).toBe('CPF-KMP-CMP__repo-a__78');
});

it('renders the normalized frontmatter fields for Dataview', () => {
  const markdown = buildIssueNoteMarkdown({
    id: 123456,
    iid: 78,
    title: '[BUG] 登录按钮点击无响应',
    projectPath: 'CPF-KMP-CMP/repo-a',
    sourceRepo: 'repo-a',
    authorUsername: 'partner_a',
    isInternalAuthor: false,
    requestKind: 'bug',
  } as NormalizedIssueNote);

  expect(markdown).toContain('requestKind: bug');
  expect(markdown).toContain('isInternalAuthor: false');
  expect(markdown).toContain('projectPath: "CPF-KMP-CMP/repo-a"');
});
```

- [ ] **Step 2: Run the issue and note tests and verify they fail**

Run:

```bash
cd /Users/ming/Documents/kmp/issue
npm test -- tests/GitlabLoader/issue.test.ts tests/Issues/issue-note.test.ts --runInBand
```

Expected: FAIL because classification helpers, the new `GitlabIssue` constructor, and note rendering do not exist yet

- [ ] **Step 3: Implement classification, stable filenames, note rendering, and file upsert support**

Extend `/Users/ming/Documents/kmp/issue/src/Classification/classification.ts`:

```ts
export function classifyIssue(
  issue: Pick<Issue, 'title' | 'labels'>,
  rules: ClassificationRules
) {
  for (const [prefix, requestKind] of Object.entries(rules.titlePrefixes)) {
    if (issue.title.startsWith(prefix)) {
      return {
        requestKind,
        requestKindMatchedBy: 'title-prefix' as const,
      };
    }
  }

  for (const label of issue.labels) {
    if (rules.labels[label]) {
      return {
        requestKind: rules.labels[label],
        requestKindMatchedBy: 'label' as const,
      };
    }
  }

  return {
    requestKind: 'unknown' as const,
    requestKindMatchedBy: 'none' as const,
  };
}
```

Update `/Users/ming/Documents/kmp/issue/src/GitlabLoader/issue.ts`:

```ts
export class GitlabIssue {
  constructor(
    issue: Issue,
    private orgName: string,
    private repoName: string
  ) {
    Object.assign(this, issue);
  }

  get filename(): string {
    return `${this.orgName}__${this.repoName}__${this.iid}`;
  }
}
```

Create `/Users/ming/Documents/kmp/issue/src/Issues/issue-note.ts`:

```ts
export interface NormalizedIssueNote {
  id: number;
  iid: number;
  title: string;
  state: string;
  createdAt: string;
  updatedAt: string;
  webUrl: string;
  projectId: number;
  projectPath: string;
  sourceScope: string;
  sourceRepo: string;
  authorUsername: string;
  authorName: string;
  isInternalAuthor: boolean;
  internalMatchedBy: string;
  labels: string[];
  issueTypeRaw: string;
  requestKind: string;
  requestKindMatchedBy: string;
  referencesFull: string;
}

export function buildIssueNoteMarkdown(issue: NormalizedIssueNote): string {
  return `---\n` +
    `id: ${issue.id}\n` +
    `iid: ${issue.iid}\n` +
    `title: "${issue.title.replace(/"/g, '\\"')}"\n` +
    `state: ${issue.state}\n` +
    `createdAt: ${issue.createdAt}\n` +
    `updatedAt: ${issue.updatedAt}\n` +
    `webUrl: "${issue.webUrl}"\n` +
    `projectId: ${issue.projectId}\n` +
    `projectPath: "${issue.projectPath}"\n` +
    `sourceScope: "${issue.sourceScope}"\n` +
    `sourceRepo: "${issue.sourceRepo}"\n` +
    `authorUsername: "${issue.authorUsername}"\n` +
    `authorName: "${issue.authorName.replace(/"/g, '\\"')}"\n` +
    `isInternalAuthor: ${issue.isInternalAuthor}\n` +
    `internalMatchedBy: "${issue.internalMatchedBy}"\n` +
    `labels:\n${issue.labels.map((label) => `  - "${label}"`).join('\n')}\n` +
    `issueTypeRaw: "${issue.issueTypeRaw}"\n` +
    `requestKind: ${issue.requestKind}\n` +
    `requestKindMatchedBy: "${issue.requestKindMatchedBy}"\n` +
    `referencesFull: "${issue.referencesFull}"\n` +
    `---\n\n# ${issue.title}\n`;
}
```

Update `/Users/ming/Documents/kmp/issue/src/filesystem.ts` to support upserts and nested folders:

```ts
async ensureFolders(paths: string[]) {
  for (const path of paths) {
    if (!this.vault.getAbstractFileByPath(path)) {
      await this.vault.createFolder(path).catch((error) => {
        if (error.message !== 'Folder already exists.') {
          throw error;
        }
      });
    }
  }
}

async upsertTextFile(path: string, content: string) {
  const existing = this.vault.getAbstractFileByPath(path);

  if (existing instanceof TFile) {
    await this.vault.modify(existing, content);
    return;
  }

  await this.vault.create(path, content);
}
```

- [ ] **Step 4: Run the issue and note tests again and verify they pass**

Run:

```bash
cd /Users/ming/Documents/kmp/issue
npm test -- tests/GitlabLoader/issue.test.ts tests/Issues/issue-note.test.ts --runInBand
```

Expected: PASS for classification, stable filenames, and rendered frontmatter

- [ ] **Step 5: Commit the issue-normalization and note-writing layer**

Run:

```bash
cd /Users/ming/Documents/kmp/issue
git add src/GitlabLoader/issue-types.ts src/GitlabLoader/issue.ts src/Issues/issue-note.ts src/filesystem.ts src/Classification/classification.ts tests/GitlabLoader/issue.test.ts tests/Issues/issue-note.test.ts
git commit -m "feat: add normalized issue notes for dataview"
```

### Task 4: Generate Structured Daily Reports And AI-Friendly Briefs

**Files:**
- Create: `/Users/ming/Documents/kmp/issue/src/Reports/daily-report-builder.ts`
- Create: `/Users/ming/Documents/kmp/issue/src/Reports/ai-brief-builder.ts`
- Create: `/Users/ming/Documents/kmp/issue/tests/Reports/daily-report-builder.test.ts`
- Create: `/Users/ming/Documents/kmp/issue/tests/Reports/ai-brief-builder.test.ts`

- [ ] **Step 1: Write failing tests for daily counts, external counts, and brief sections**

Create tests like these:

```ts
it('groups a day of normalized issues into bug and requirement counts', () => {
  const report = buildDailyReport('2026-06-17', [
    {createdAt: '2026-06-17T09:00:00+08:00', requestKind: 'bug', isInternalAuthor: false, sourceRepo: 'repo-a', authorUsername: 'partner_a', title: '[BUG] 登录失败'} as NormalizedIssueNote,
    {createdAt: '2026-06-17T10:00:00+08:00', requestKind: 'requirement', isInternalAuthor: true, sourceRepo: 'repo-b', authorUsername: 'dev_a', title: '[需求] 增加导出'} as NormalizedIssueNote,
  ]);

  expect(report.newBugCount).toBe(1);
  expect(report.newRequirementCount).toBe(1);
  expect(report.externalBugCount).toBe(1);
  expect(report.externalRequirementCount).toBe(0);
});

it('renders a brief with summary and issue title sections', () => {
  const markdown = buildAiBriefMarkdown({
    date: '2026-06-17',
    newBugCount: 1,
    newRequirementCount: 1,
    externalBugCount: 1,
    externalRequirementCount: 0,
    unknownClassifications: 0,
    topExternalAuthors: ['partner_a'],
    bugIssues: [{sourceRepo: 'repo-a', iid: 78, title: '[BUG] 登录失败'}],
    requirementIssues: [{sourceRepo: 'repo-b', iid: 15, title: '[需求] 增加导出'}],
  } as DailyReport);

  expect(markdown).toContain('# GitCode Issue Daily Brief - 2026-06-17');
  expect(markdown).toContain('## Summary Data');
  expect(markdown).toContain('repo-a #78: [BUG] 登录失败');
});
```

- [ ] **Step 2: Run the report-builder tests and verify they fail**

Run:

```bash
cd /Users/ming/Documents/kmp/issue
npm test -- tests/Reports/daily-report-builder.test.ts tests/Reports/ai-brief-builder.test.ts --runInBand
```

Expected: FAIL because `buildDailyReport` and `buildAiBriefMarkdown` do not exist yet

- [ ] **Step 3: Implement the report builders**

Create `/Users/ming/Documents/kmp/issue/src/Reports/daily-report-builder.ts`:

```ts
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
  unknownClassifications: number;
  syncStatus: 'success' | 'degraded';
  bugIssues: NormalizedIssueNote[];
  requirementIssues: NormalizedIssueNote[];
  externalBugIssues: NormalizedIssueNote[];
  externalRequirementIssues: NormalizedIssueNote[];
  unknownIssues: NormalizedIssueNote[];
}

export function buildDailyReport(date: string, issues: NormalizedIssueNote[]): DailyReport {
  const sameDayIssues = issues.filter((issue) => issue.createdAt.startsWith(date));
  const bugIssues = sameDayIssues.filter((issue) => issue.requestKind === 'bug');
  const requirementIssues = sameDayIssues.filter((issue) => issue.requestKind === 'requirement');
  const unknownIssues = sameDayIssues.filter((issue) => issue.requestKind === 'unknown');
  const externalIssues = sameDayIssues.filter((issue) => !issue.isInternalAuthor);
  const authorCounts = Object.entries(
    externalIssues.reduce<Record<string, number>>((acc, issue) => {
      acc[issue.authorUsername] = (acc[issue.authorUsername] || 0) + 1;
      return acc;
    }, {})
  ).sort((a, b) => b[1] - a[1]);

  return {
    date,
    newBugCount: bugIssues.length,
    newRequirementCount: requirementIssues.length,
    externalBugCount: bugIssues.filter((issue) => !issue.isInternalAuthor).length,
    externalRequirementCount: requirementIssues.filter((issue) => !issue.isInternalAuthor).length,
    newIssueCount: sameDayIssues.length,
    externalIssueCount: externalIssues.length,
    repos: [...new Set(sameDayIssues.map((issue) => issue.sourceRepo))].sort(),
    topExternalAuthors: authorCounts.map(([username]) => username).slice(0, 5),
    unknownClassifications: unknownIssues.length,
    syncStatus: 'success',
    bugIssues,
    requirementIssues,
    externalBugIssues: bugIssues.filter((issue) => !issue.isInternalAuthor),
    externalRequirementIssues: requirementIssues.filter((issue) => !issue.isInternalAuthor),
    unknownIssues,
  };
}
```

Create `/Users/ming/Documents/kmp/issue/src/Reports/ai-brief-builder.ts`:

```ts
export function buildAiBriefMarkdown(report: DailyReport): string {
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
    ...report.topExternalAuthors.map((username) => `- ${username}`),
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
```

- [ ] **Step 4: Run the report-builder tests again and verify they pass**

Run:

```bash
cd /Users/ming/Documents/kmp/issue
npm test -- tests/Reports/daily-report-builder.test.ts tests/Reports/ai-brief-builder.test.ts --runInBand
```

Expected: PASS for daily counts and AI-brief rendering

- [ ] **Step 5: Commit the daily-report generation layer**

Run:

```bash
cd /Users/ming/Documents/kmp/issue
git add src/Reports/daily-report-builder.ts src/Reports/ai-brief-builder.ts tests/Reports/daily-report-builder.test.ts tests/Reports/ai-brief-builder.test.ts
git commit -m "feat: add daily issue reports and ai briefs"
```

### Task 5: Orchestrate End-To-End Sync And Persist Meta Artifacts

**Files:**
- Create: `/Users/ming/Documents/kmp/issue/src/Sync/sync-service.ts`
- Modify: `/Users/ming/Documents/kmp/issue/src/GitlabLoader/gitlab-loader.ts`
- Modify: `/Users/ming/Documents/kmp/issue/src/filesystem.ts`
- Modify: `/Users/ming/Documents/kmp/issue/src/main.ts`
- Create: `/Users/ming/Documents/kmp/issue/tests/Sync/sync-service.test.ts`
- Modify: `/Users/ming/Documents/kmp/issue/tests/GitlabLoader/gitlab-loader.test.ts`

- [ ] **Step 1: Write failing tests for repo-by-repo issue loading, sync-state writes, and degraded behavior when a repo fails**

Create tests like these:

```ts
it('loads issues from each configured repository under the configured organization', async () => {
  mockLoadAllPages.mockResolvedValue([{id: 1, iid: 78, title: '[BUG] 登录失败'}]);

  const loader = new GitlabLoader({
    ...DEFAULT_SETTINGS,
    orgName: 'CPF-KMP-CMP',
    repoList: ['repo-a', 'repo-b'],
  });

  await loader.loadRepoIssues('repo-a');

  expect(mockLoadAllPages).toHaveBeenCalledWith(
    'https://gitcode.com/api/v5/repos/CPF-KMP-CMP/repo-a/issues',
    expect.any(String)
  );
});

it('writes member cache, issue notes, daily reports, and degraded sync state when one repo fails', async () => {
  mockMemberLoader.loadInternalMemberIndex.mockResolvedValue({
    usernames: {dev_a: {username: 'dev_a', source: 'org'}},
  });
  mockIssueLoader.loadRepoIssues
    .mockResolvedValueOnce([{...issueA}])
    .mockRejectedValueOnce(new Error('repo-b timeout'));

  await new SyncService(mockApp, {
    ...DEFAULT_SETTINGS,
    orgName: 'CPF-KMP-CMP',
    repoList: ['repo-a', 'repo-b'],
  }).run();

  expect(mockFs.writeJson).toHaveBeenCalledWith(
    'GitCode Issues/meta/internal-members.json',
    expect.objectContaining({usernames: expect.any(Object)})
  );
  expect(mockFs.writeJson).toHaveBeenCalledWith(
    'GitCode Issues/meta/sync-state.json',
    expect.objectContaining({syncStatus: 'degraded', failedRepos: ['repo-b']})
  );
  expect(mockFs.upsertTextFile).toHaveBeenCalledWith(
    'GitCode Issues/reports/daily-brief/2026-06-17-brief.md',
    expect.stringContaining('# GitCode Issue Daily Brief')
  );
});
```

- [ ] **Step 2: Run the sync tests and verify they fail**

Run:

```bash
cd /Users/ming/Documents/kmp/issue
npm test -- tests/GitlabLoader/gitlab-loader.test.ts tests/Sync/sync-service.test.ts --runInBand
```

Expected: FAIL because repo-specific issue loading, sync orchestration, and meta/report writes do not exist yet

- [ ] **Step 3: Implement repo issue loading, sync orchestration, and meta persistence**

Update `/Users/ming/Documents/kmp/issue/src/GitlabLoader/gitlab-loader.ts`:

```ts
export default class GitlabLoader {
  constructor(private settings: GitlabIssuesSettings) {}

  getRepoIssuesUrl(repoName: string) {
    const query = this.settings.issueFilter ? `?${this.settings.issueFilter}` : '';
    return `${this.settings.gitlabApiUrl()}/repos/${this.settings.orgName}/${repoName}/issues${query}`;
  }

  async loadRepoIssues(repoName: string): Promise<Issue[]> {
    return GitlabApi.loadAllPages<Issue>(
      encodeURI(this.getRepoIssuesUrl(repoName)),
      this.settings.gitlabToken
    );
  }
}
```

Extend `/Users/ming/Documents/kmp/issue/src/filesystem.ts`:

```ts
async writeJson(path: string, value: unknown) {
  await this.upsertTextFile(path, JSON.stringify(value, null, 2));
}

async writeIssueNotes(notes: Array<{path: string; content: string}>) {
  for (const note of notes) {
    await this.upsertTextFile(note.path, note.content);
  }
}
```

Create `/Users/ming/Documents/kmp/issue/src/Sync/sync-service.ts`:

```ts
export default class SyncService {
  constructor(private app: App, private settings: GitlabIssuesSettings) {}

  async run() {
    const fs = new Filesystem(this.app.vault, this.settings);
    await fs.ensureFolders([
      this.settings.outputDir,
      this.settings.issuesFolder,
      this.settings.metaFolder,
      `${this.settings.reportsFolder}/daily`,
      `${this.settings.reportsFolder}/daily-brief`,
    ]);

    const memberLoader = new MemberLoader(this.settings);
    const issueLoader = new GitlabLoader(this.settings);
    const memberIndex = await memberLoader.loadInternalMemberIndex();
    await fs.writeJson(`${this.settings.metaFolder}/internal-members.json`, memberIndex);

    const normalizedIssues: NormalizedIssueNote[] = [];
    const failedRepos: string[] = [];

    for (const repoName of this.settings.repoList) {
      try {
        const rawIssues = await issueLoader.loadRepoIssues(repoName);
        normalizedIssues.push(...normalizeIssues(rawIssues, repoName, memberIndex, this.settings));
      } catch (error) {
        failedRepos.push(repoName);
      }
    }

    await fs.writeIssueNotes(
      normalizedIssues.map((issue) => ({
        path: `${this.settings.issuesFolder}/${issue.filename}.md`,
        content: buildIssueNoteMarkdown(issue),
      }))
    );

    const today = new Date().toISOString().slice(0, 10);
    const report = buildDailyReport(today, normalizedIssues);
    report.syncStatus = failedRepos.length > 0 ? 'degraded' : 'success';

    if (this.settings.generateDailyReports) {
      await fs.upsertTextFile(
        `${this.settings.reportsFolder}/daily/${today}.md`,
        buildDailyReportMarkdown(report)
      );
      await fs.upsertTextFile(
        `${this.settings.reportsFolder}/daily-brief/${today}-brief.md`,
        buildAiBriefMarkdown(report)
      );
    }

    await fs.writeJson(`${this.settings.metaFolder}/sync-state.json`, {
      syncStatus: report.syncStatus,
      failedRepos,
      lastSuccessfulSyncAt: new Date().toISOString(),
    });
  }
}
```

Update `/Users/ming/Documents/kmp/issue/src/main.ts` to invoke `SyncService` instead of the old `loadIssues()` path:

```ts
private async fetchFromGitlab() {
  new Notice('Updating issues from GitCode');
  const syncService = new SyncService(this.app, this.settings);
  await syncService.run();
}
```

- [ ] **Step 4: Run the sync tests again and verify they pass**

Run:

```bash
cd /Users/ming/Documents/kmp/issue
npm test -- tests/GitlabLoader/gitlab-loader.test.ts tests/Sync/sync-service.test.ts --runInBand
```

Expected: PASS for repo-scoped GitCode issue loading and degraded sync-state persistence

- [ ] **Step 5: Commit the orchestration layer**

Run:

```bash
cd /Users/ming/Documents/kmp/issue
git add src/Sync/sync-service.ts src/GitlabLoader/gitlab-loader.ts src/filesystem.ts src/main.ts tests/GitlabLoader/gitlab-loader.test.ts tests/Sync/sync-service.test.ts
git commit -m "feat: orchestrate gitcode sync and report generation"
```

### Task 6: Run Full Verification And Finalize The Local Workspace

**Files:**
- Modify: `/Users/ming/Documents/kmp/issue/.agents/state/process.md`

- [ ] **Step 1: Run the full test suite and verify all imported and new tests pass together**

Run:

```bash
cd /Users/ming/Documents/kmp/issue
npm test -- --runInBand
```

Expected: PASS across the original upstream tests plus all new GitCode settings, member, issue, report, and sync tests

- [ ] **Step 2: Run the TypeScript build and verify the plugin still compiles**

Run:

```bash
cd /Users/ming/Documents/kmp/issue
npm run build
```

Expected: successful TypeScript check and esbuild bundle output with no type errors

- [ ] **Step 3: Update the handoff state with exact verification evidence and the current next step**

Write the following into `/Users/ming/Documents/kmp/issue/.agents/state/process.md`:

```md
## Verification
- `npm test -- --runInBand`: PASS
- `npm run build`: PASS

## Next Step
1. Install the built plugin into an Obsidian test vault and configure `orgName`, `repoList`, and whitelist values against real GitCode data.
2. Trigger one sync and inspect `GitCode Issues/issues`, `GitCode Issues/meta`, and `GitCode Issues/reports`.
```

- [ ] **Step 4: Commit the verified end state**

Run:

```bash
cd /Users/ming/Documents/kmp/issue
git add .
git commit -m "feat: support gitcode issue sync and daily reporting"
```

Expected: one final verified commit after tests and build both pass

## Self-Review

- Spec coverage checked:
  - GitCode `/api/v5` compatibility is covered in Task 1 and Task 5.
  - Internal-member syncing from org, repo, and whitelist is covered in Task 2.
  - `bug` / `requirement` / `unknown` classification is covered in Task 3.
  - Rich frontmatter note output is covered in Task 3.
  - Structured daily reports and AI briefs are covered in Task 4.
  - Degraded sync handling and meta artifacts are covered in Task 5.
  - Full verification and handoff state are covered in Task 6.
- Placeholder scan completed: no `TODO`, `TBD`, or vague “handle appropriately” steps remain.
- Type consistency checked:
  - `GitlabIssuesSettings`, `InternalMemberIndex`, `NormalizedIssueNote`, and `DailyReport` names are used consistently across later tasks.
