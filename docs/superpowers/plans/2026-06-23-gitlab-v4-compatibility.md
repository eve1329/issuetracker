# GitLab v4 Compatibility Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add GitLab API v4 routing for repo issue sync, organization repo discovery, and collaborator sync while keeping the current GitCode v5 behavior unchanged.

**Architecture:** `settings.ts` owns API base URL resolution and version detection. `GitlabLoader` and `MemberLoader` branch on that version when they build repo, group, and member URLs, but they keep the existing issue-list path logic intact. Tests lock the helper exports and both routing families so the v4 change stays localized and safe.

**Tech Stack:** TypeScript, Jest, Obsidian plugin runtime.

---

### Task 1: Add settings helpers for API base URL resolution and version detection

**Files:**
- Modify: `/Users/ming/Documents/kmp/issue/src/SettingsTab/settings.ts`
- Modify: `/Users/ming/Documents/kmp/issue/tests/SettingsTab/settings.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
it('defaults to v5 when the API base URL does not contain an explicit version', () => {
	expect(getGitlabApiVersion('https://gitlab.example.com/api')).toBe('v5');
	expect(resolveGitlabApiBaseUrl('https://gitlab.example.com/', '')).toBe('https://gitlab.example.com/api/v5');
});
```

- [ ] **Step 2: Run the focused test file and verify it fails**

Run: `npm test -- --runInBand tests/SettingsTab/settings.test.ts`
Expected: FAIL at compile time until `getGitlabApiVersion` and `resolveGitlabApiBaseUrl` are exported.

- [ ] **Step 3: Write the minimal implementation**

```typescript
export function getGitlabApiVersion(apiBaseUrl: string): 'v4' | 'v5' {
	return /\/api\/v4(?:\/|$)/.test(apiBaseUrl.trim()) ? 'v4' : 'v5';
}

export function resolveGitlabApiBaseUrl(gitlabUrl: string, apiBaseUrl?: string) {
	const explicitApiBaseUrl = apiBaseUrl?.trim();

	if (explicitApiBaseUrl) {
		return explicitApiBaseUrl.replace(/\/+$/, '');
	}

	return `${gitlabUrl.replace(/\/+$/, '')}/api/v5`;
}
```

Update `DEFAULT_SETTINGS.gitlabApiUrl()` to call `resolveGitlabApiBaseUrl(this.gitlabUrl, this.apiBaseUrl)`.

- [ ] **Step 4: Run the focused test file and verify it passes**

Run: `npm test -- --runInBand tests/SettingsTab/settings.test.ts`
Expected: PASS with the new helper assertions green.

### Task 2: Route repo and organization URLs by API version in `GitlabLoader`

**Files:**
- Modify: `/Users/ming/Documents/kmp/issue/src/GitlabLoader/gitlab-loader.ts`
- Modify: `/Users/ming/Documents/kmp/issue/tests/GitlabLoader/gitlab-loader.test.ts`

- [ ] **Step 1: Write the failing tests**

```typescript
it('loads repo issues from the GitLab project endpoint on v4', async () => {
	mockSettings.gitlabUrl = 'https://gitlab.example.com';
	mockSettings.apiBaseUrl = 'https://gitlab.example.com/api/v4';
	mockLoadAllPages.mockResolvedValueOnce([]);

	await gitlabLoader.loadRepoIssues('repo-a');

	expect(mockLoadAllPages).toHaveBeenCalledWith(
		'https://gitlab.example.com/api/v4/projects/CPF-KMP-CMP%2Frepo-a/issues',
		mockSettings.gitlabToken,
	);
});

it('loads organization repositories from the GitLab group projects endpoint on v4', async () => {
	mockSettings.gitlabUrl = 'https://gitlab.example.com';
	mockSettings.apiBaseUrl = 'https://gitlab.example.com/api/v4';
	mockSettings.syncAllOrgRepos = true;
	mockLoadAllPages.mockResolvedValueOnce([{path: 'repo-a', name: 'repo-a'}] as any);

	await gitlabLoader.loadOrgRepos();

	expect(mockLoadAllPages).toHaveBeenCalledWith(
		'https://gitlab.example.com/api/v4/groups/CPF-KMP-CMP/projects',
		mockSettings.gitlabToken,
	);
});
```

- [ ] **Step 2: Run the focused test file and verify it fails**

Run: `npm test -- --runInBand tests/GitlabLoader/gitlab-loader.test.ts`
Expected: FAIL until the loader chooses `/projects` and `/groups` for v4.

- [ ] **Step 3: Write the minimal implementation**

```typescript
import {getGitlabApiVersion} from "../SettingsTab/settings";

private getApiBaseUrl() {
	return this.settings.gitlabApiUrl().replace(/\/+$/, '');
}

private getApiVersion() {
	return getGitlabApiVersion(this.getApiBaseUrl());
}

getRepoIssuesUrl(repoName: string) {
	const apiBaseUrl = this.getApiBaseUrl();
	const filter = this.settings.issueFilter.trim();

	if (this.getApiVersion() === 'v4') {
		const projectId = encodeURIComponent(`${this.settings.orgName}/${repoName}`);
		return `${apiBaseUrl}/projects/${projectId}/issues${filter ? `?${encodeURI(filter)}` : ''}`;
	}

	const encodedOrgName = encodeURIComponent(this.settings.orgName);
	const encodedRepoName = encodeURIComponent(repoName);
	const baseUrl = `${apiBaseUrl}/repos/${encodedOrgName}/${encodedRepoName}/issues`;
	return filter ? `${baseUrl}?${encodeURI(filter)}` : baseUrl;
}

getOrgReposUrl() {
	const apiBaseUrl = this.getApiBaseUrl();

	if (this.getApiVersion() === 'v4') {
		return `${apiBaseUrl}/groups/${encodeURIComponent(this.settings.orgName)}/projects`;
	}

	return `${apiBaseUrl}/orgs/${encodeURIComponent(this.settings.orgName)}/repos`;
}
```

Keep `getUrl()` and `loadIssues()` behavior unchanged except for encoding the project/group ID where needed.

- [ ] **Step 4: Run the focused test file and verify it passes**

Run: `npm test -- --runInBand tests/GitlabLoader/gitlab-loader.test.ts`
Expected: PASS, with both v4 and existing v5 assertions green.

### Task 3: Route collaborator sync by API version in `MemberLoader`

**Files:**
- Modify: `/Users/ming/Documents/kmp/issue/src/Members/member-loader.ts`
- Modify: `/Users/ming/Documents/kmp/issue/tests/Members/member-loader.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
it('loads repo collaborators from the GitLab project members endpoint on v4', async () => {
	mockLoadAllPages.mockResolvedValueOnce([{username: 'repo_user'}]);

	const loader = new MemberLoader({
		...DEFAULT_SETTINGS,
		gitlabUrl: 'https://gitlab.example.com',
		apiBaseUrl: 'https://gitlab.example.com/api/v4',
		orgName: 'CPF-KMP-CMP',
		repoList: ['repo-a'],
		internalUserWhitelist: [],
	});

	await loader.loadInternalMemberIndex();

	expect(mockLoadAllPages).toHaveBeenCalledWith(
		'https://gitlab.example.com/api/v4/projects/CPF-KMP-CMP%2Frepo-a/members/all',
		'',
	);
});
```

- [ ] **Step 2: Run the focused test file and verify it fails**

Run: `npm test -- --runInBand tests/Members/member-loader.test.ts`
Expected: FAIL until the loader switches from `/collaborators` to `/members/all` on v4.

- [ ] **Step 3: Write the minimal implementation**

```typescript
import {getGitlabApiVersion} from "../SettingsTab/settings";

private getApiBaseUrl() {
	return this.settings.gitlabApiUrl().replace(/\/+$/, '');
}

private getRepoCollaboratorsUrl(repoName: string) {
	const apiBaseUrl = this.getApiBaseUrl();

	if (getGitlabApiVersion(apiBaseUrl) === 'v4') {
		const projectId = encodeURIComponent(`${this.settings.orgName}/${repoName}`);
		return `${apiBaseUrl}/projects/${projectId}/members/all`;
	}

	return `${apiBaseUrl}/repos/${encodeURIComponent(this.settings.orgName)}/${encodeURIComponent(repoName)}/collaborators`;
}
```

Use the helper inside `loadInternalMemberIndex()` so the rest of the sync state handling stays untouched.

- [ ] **Step 4: Run the focused test file and verify it passes**

Run: `npm test -- --runInBand tests/Members/member-loader.test.ts`
Expected: PASS, with the existing v5 collaborator assertions still green.

### Task 4: Run end-to-end verification and capture the final state

**Files:**
- Modify: `/Users/ming/Documents/kmp/issue/.agents/state/process.md`
- Modify: `/Users/ming/Documents/kmp/issue/.agents/state/tasks/issue-kmp/process.md`

- [ ] **Step 1: Run the combined regression tests**

Run: `npm test -- --runInBand tests/SettingsTab/settings.test.ts tests/GitlabLoader/gitlab-loader.test.ts tests/Members/member-loader.test.ts tests/Sync/sync-service.test.ts`
Expected: PASS with no failing suites.

- [ ] **Step 2: Run the build**

Run: `npm run build`
Expected: PASS with TypeScript and esbuild both clean.

- [ ] **Step 3: Update the task handoff files**

Record the final implementation state, the exact verification commands, and any remaining constraints in:
- `/Users/ming/Documents/kmp/issue/.agents/state/process.md`
- `/Users/ming/Documents/kmp/issue/.agents/state/tasks/issue-kmp/process.md`

- [ ] **Step 4: Commit the source changes**

```bash
git add /Users/ming/Documents/kmp/issue/src/SettingsTab/settings.ts \
	/Users/ming/Documents/kmp/issue/src/GitlabLoader/gitlab-loader.ts \
	/Users/ming/Documents/kmp/issue/src/Members/member-loader.ts \
	/Users/ming/Documents/kmp/issue/tests/SettingsTab/settings.test.ts \
	/Users/ming/Documents/kmp/issue/tests/GitlabLoader/gitlab-loader.test.ts \
	/Users/ming/Documents/kmp/issue/tests/Members/member-loader.test.ts \
	/Users/ming/Documents/kmp/issue/docs/superpowers/plans/2026-06-23-gitlab-v4-compatibility.md
git commit -m "fix: add GitLab v4 routing"
```

