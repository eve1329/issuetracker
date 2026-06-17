# GitCode Issue Sync And Daily Reporting Design

Date: 2026-06-17
Workspace: `/Users/ming/Documents/kmp/issue`
Status: Draft approved in chat, written for user review

## Context

The target is to adapt `obsidian-gitlab-issues` into a GitCode-oriented sync plugin for the `CPF-KMP-CMP` organization and its selected repositories.

The user needs two stable daily metrics inside Obsidian:

1. How many new `bug` and `requirement` issues were created each day.
2. How many of those issues were created by external partners rather than internal members.

The user also wants a daily reporting artifact that can be directly consumed by AI for summarization, rather than only raw tables.

## Goals

- Reuse the existing `obsidian-gitlab-issues` sync model instead of building a separate reporting system from scratch.
- Support GitCode REST API usage for issues and members.
- Materialize enough issue metadata into Markdown frontmatter so that Obsidian `Dataview` can compute stable statistics.
- Produce a machine-friendly daily report page and an AI-friendly daily brief page.
- Keep classification rules and internal-member recognition configurable.

## Non-Goals

- Do not turn the plugin into a full analytics UI.
- Do not make the plugin call external AI models directly.
- Do not hardcode business-specific report wording into plugin logic.
- Do not infer hidden semantics from issue content beyond the configured rules.

## Recommended Approach

Use `obsidian-gitlab-issues` as the synchronization layer and extend it in four areas:

1. GitCode API compatibility
2. Internal-member synchronization
3. Rich issue metadata materialization
4. Daily report artifact generation

The plugin remains responsible for fetching, normalization, and file output. Obsidian `Dataview` remains responsible for statistics and dashboards.

## Architecture

The system is split into the following responsibilities:

- Sync layer
  - Pull issues from GitCode organization or configured repositories.
  - Pull internal-member data from organization members, repository collaborators, and manual whitelist entries.
- Normalization layer
  - Convert raw GitCode issue payloads into a stable local issue model.
  - Derive `requestKind` and `isInternalAuthor`.
- Storage layer
  - Write issue notes into the vault with complete frontmatter.
  - Write member cache and sync-state metadata files.
  - Write daily structured report files and AI-brief files.
- Query layer
  - `Dataview` pages compute counts and trends from synchronized notes.

## Configuration Model

The plugin configuration should support the following fields:

```json
{
  "baseUrl": "https://gitcode.com",
  "apiBaseUrl": "https://gitcode.com/api/v5",
  "token": "",
  "orgName": "CPF-KMP-CMP",
  "scope": "org-and-repos",
  "repoList": [
    "repo-a",
    "repo-b"
  ],
  "outputFolder": "GitCode Issues",
  "issuesFolder": "GitCode Issues/issues",
  "metaFolder": "GitCode Issues/meta",
  "reportsFolder": "GitCode Issues/reports",
  "purgeIssues": false,
  "refreshMinutes": 15,
  "internalUserWhitelist": [
    "manual_user_a",
    "manual_user_b"
  ],
  "classificationRules": {
    "titlePrefixes": {
      "[BUG]": "bug",
      "[需求]": "requirement"
    },
    "labels": {}
  },
  "issueFilter": "",
  "generateDailyReports": true
}
```

## Internal-Member Definition

An issue author is considered internal when the username exists in:

- The `CPF-KMP-CMP` organization member set
- The collaborator set of any configured repository
- The manual internal whitelist

An author is considered external when the username is not present in the union of those three sets.

The plugin should persist the source of the match for traceability:

- `org`
- `repo`
- `whitelist`
- `none`

## Issue Classification Rules

The first implementation should use deterministic rules only.

Classification order:

1. Match title prefixes from configuration
2. Match labels from configuration
3. Otherwise classify as `unknown`

The initial approved mapping is:

- `[BUG]` -> `bug`
- `[需求]` -> `requirement`

This logic should produce two fields:

- `requestKind`: `bug | requirement | unknown`
- `requestKindMatchedBy`: `title-prefix | label | none`

## Issue Note Model

Each synchronized issue note should be written into `GitCode Issues/issues/` and contain frontmatter like:

```yaml
id: 123456
iid: 78
title: "[BUG] 登录按钮点击无响应"
state: opened
createdAt: 2026-06-17T09:12:00+08:00
updatedAt: 2026-06-17T10:05:00+08:00
webUrl: "https://gitcode.com/CPF-KMP-CMP/repo-a/issues/78"

projectId: 1001
projectPath: "CPF-KMP-CMP/repo-a"
sourceScope: "project"
sourceRepo: "repo-a"

authorUsername: "partner_a"
authorName: "张三"
isInternalAuthor: false
internalMatchedBy: "none"

labels:
  - "P1"
  - "login"

issueTypeRaw: "issue"
requestKind: "bug"
requestKindMatchedBy: "title-prefix"

referencesFull: "CPF-KMP-CMP/repo-a#78"
```

### Required Fields

- `id`
- `iid`
- `title`
- `state`
- `createdAt`
- `updatedAt`
- `webUrl`
- `projectId`
- `projectPath`
- `sourceScope`
- `sourceRepo`
- `authorUsername`
- `authorName`
- `isInternalAuthor`
- `internalMatchedBy`
- `labels`
- `issueTypeRaw`
- `requestKind`
- `requestKindMatchedBy`
- `referencesFull`

### File Naming

Issue note filenames should be stable and collision-safe. Recommended format:

`CPF-KMP-CMP__repo-a__78.md`

This is preferred over title-only filenames because titles are not unique and may change.

## Output Structure

```text
GitCode Issues/
  issues/
    CPF-KMP-CMP__repo-a__78.md
    CPF-KMP-CMP__repo-b__102.md
  meta/
    internal-members.json
    sync-state.json
  reports/
    daily/
      2026-06-17.md
    daily-brief/
      2026-06-17-brief.md
```

### Meta Files

`internal-members.json` stores the normalized internal-member set and source annotations.

`sync-state.json` stores:

- last successful sync time
- member sync status
- repository sync status
- failed repository names
- warning messages

## Daily Structured Report

For each day, generate a structured report file:

`GitCode Issues/reports/daily/YYYY-MM-DD.md`

Suggested frontmatter:

```yaml
date: 2026-06-17
newBugCount: 12
newRequirementCount: 5
externalBugCount: 7
externalRequirementCount: 3
newIssueCount: 17
externalIssueCount: 10
repos:
  - repo-a
  - repo-b
  - repo-c
topExternalAuthors:
  - partner_a
  - partner_b
unknownClassifications: 1
syncStatus: success
```

Suggested body sections:

- New Bugs
- New Requirements
- External Partner Bugs
- External Partner Requirements
- Unknown Classification

The purpose of this file is stable machine-readable daily statistics plus a quick human-readable list.

## AI-Friendly Daily Brief

For each day, generate a second file:

`GitCode Issues/reports/daily-brief/YYYY-MM-DD-brief.md`

This file should be optimized for downstream AI summarization and include:

- summary counts
- grouped issue titles
- external partner focus
- repeated themes or visible clusters when deterministically derivable
- explicit notes for AI consumers

Suggested structure:

```md
# GitCode Issue Daily Brief - 2026-06-17

## Summary Data
- New bugs: 12
- New requirements: 5
- External bugs: 7
- External requirements: 3
- Unknown classifications: 1

## External Partner Focus
- partner_a: 3 issues
- partner_b: 2 issues

## New Bugs
- repo-a #78: [BUG] 登录按钮点击无响应
- repo-b #102: [BUG] 大对象跨语言传递卡顿

## New Requirements
- repo-c #15: [需求] 支持日报导出

## Notes For AI
- Highlight the main issue categories by volume
- Call out which repos received the most external feedback
- Mention repeated themes when visible from titles
- Mention unknown classifications if count > 0
```

The plugin does not call AI directly. It only prepares a clean summary substrate for downstream AI summarization.

## Dataview Usage

The synchronized issue notes must support at least the following Dataview views.

### Daily New Bugs And Requirements

```dataview
TABLE dateformat(date(createdAt), "yyyy-MM-dd") AS Day,
      requestKind AS Type,
      length(rows) AS Count
FROM "GitCode Issues/issues"
WHERE requestKind = "bug" OR requestKind = "requirement"
GROUP BY dateformat(date(createdAt), "yyyy-MM-dd") + " | " + requestKind
SORT Day DESC
```

### Daily External Partner Bugs And Requirements

```dataview
TABLE dateformat(date(createdAt), "yyyy-MM-dd") AS Day,
      requestKind AS Type,
      length(rows) AS Count
FROM "GitCode Issues/issues"
WHERE isInternalAuthor = false
AND (requestKind = "bug" OR requestKind = "requirement")
GROUP BY dateformat(date(createdAt), "yyyy-MM-dd") + " | " + requestKind
SORT Day DESC
```

The plugin may also generate report template notes that already embed these queries.

## Failure Handling

The system should be conservative. It must prefer stale-but-explicit data over silently wrong statistics.

### Member Sync Failure

- Keep the last successful `internal-members.json`
- Continue issue sync using the last known internal-member set
- Record failure details in `sync-state.json`
- Mark report `syncStatus` as degraded when needed

### Repository Issue Sync Failure

- Do not purge old issue notes for failed repositories
- Record failed repositories in `sync-state.json`
- Keep existing issue notes available for Dataview and reporting

### Classification Failure

- Set `requestKind: unknown`
- Set `requestKindMatchedBy: none`
- Do not guess between bug and requirement

## Verification Strategy

Verification should cover four layers.

### API Layer

- organization members can be fetched
- repository collaborators can be fetched
- issues can be fetched for configured scope

### Rule Layer

- `[BUG]` maps to `bug`
- `[需求]` maps to `requirement`
- internal-member detection correctly uses `org ∪ repo ∪ whitelist`
- unmatched issues become `unknown`

### Storage Layer

- frontmatter fields are complete
- filenames are stable and collision-safe
- meta files are updated as expected

### Display Layer

- Dataview report pages produce counts
- daily structured report files are generated
- daily AI brief files are generated
- degraded sync states remain visible rather than silently disappearing

## Implementation Notes

- The upstream `obsidian-gitlab-issues` currently defaults to `${gitlabUrl}/api/v4`; this design requires configurable API base URL support and GitCode `/api/v5` compatibility.
- The upstream issue model already contains `author`, `created_at`, `labels`, and `issue_type`; these should be exposed in frontmatter rather than dropped.
- Repository and organization member sync are new responsibilities not present in the upstream plugin flow.

## Constraints

- The current workspace `/Users/ming/Documents/kmp/issue` is not a git repository.
- This design document can be written locally, but it cannot be committed from this workspace unless the target repository is later provided.

## Open Decisions Intentionally Deferred

These items are intentionally deferred to implementation planning, not left ambiguous:

- exact settings UI layout in Obsidian
- exact GitCode pagination strategy
- whether daily reports regenerate only for the current day or for a configurable recent window
- whether report generation is triggered on every sync or by a separate command

These do not affect the approved architecture or data contract.
