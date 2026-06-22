IssueTracker for Obsidian
====

[中文](README.zh-CN.md)

IssueTracker is a local Obsidian plugin workspace for syncing GitCode issues into your vault.

The current implementation is tailored for a GitCode-based issue workflow and adds structured daily reporting on top of plain issue sync.

## What It Does

- Sync issues from selected GitCode repositories, or from every repository under a configured organization.
- Persist each issue as a normalized Obsidian note under `GitCode Issues/issues`.
- Mark authors as internal or external by combining repository collaborator data with a manual whitelist.
- Classify issues into `bug`, `requirement`, or `unknown` using configurable prefix, keyword, and label rules.
- Generate machine-friendly daily reports and AI-friendly daily briefs.
- Persist sync metadata, degraded-sync warnings, and collaborator caches under `GitCode Issues/meta`.

## Default Output Layout

- `GitCode Issues/issues/*.md`
- `GitCode Issues/meta/internal-members.json`
- `GitCode Issues/meta/sync-state.json`
- `GitCode Issues/reports/daily/YYYY-MM-DD.md`
- `GitCode Issues/reports/daily-brief/YYYY-MM-DD-brief.md`

## Installation

This repo is set up as a local plugin workspace.

1. Run `npm install` once if dependencies are not installed yet.
2. Build the plugin with `npm run build`.
3. Copy these files into your vault plugin directory `.obsidian/plugins/issuetracker/`:
   - `manifest.json`
   - `main.js`
   - `versions.json`
4. Enable `IssueTracker` in Obsidian.

## Configuration

Open the `IssueTracker` settings tab and configure:

- `GitCode instance URL`: defaults to `https://gitcode.com`
- `API Base URL`: defaults to `https://gitcode.com/api/v5`
- `Personal Access Token`: GitCode token used for API requests
- `Organization Name`: the GitCode organization that owns the repositories
- `Repository List`: one repository per line when you do not sync the whole organization
- `Sync all organization repositories`: automatically discover repositories under the configured organization
- `Internal User Whitelist`: fallback usernames to treat as internal even if collaborator sync is incomplete
- `Classification Rules`: JSON rules for mapping titles or labels into `bug` / `requirement`
- `Issues Folder`, `Meta Folder`, `Reports Folder`: output locations inside the vault
- `Generate daily reports`: write daily summaries and AI briefs after sync

The settings page still keeps a legacy API-scope compatibility section from the original importer code path. The primary workflow in this fork is the GitCode organization and repository sync described above.

## Usage

- Click the left-ribbon `IssueTracker` icon to trigger a sync.
- Or run the command palette action `Sync IssueTracker`.
- If `Refresh issues on startup` is enabled, the plugin waits 30 seconds after launch before the first automatic sync.
- Automatic refresh runs every 15 minutes by default.

## Generated Data

Issue notes are generated artifacts. The current sync flow rewrites normalized issue files and derived reports, so manual edits inside generated notes should be treated as disposable unless you change the output process.

Each normalized issue note includes frontmatter such as:

- `createdAt`
- `updatedAt`
- `projectPath`
- `sourceRepo`
- `authorUsername`
- `isInternalAuthor`
- `requestKind`
- `requestKindMatchedBy`
- `labels`

## Dataview Example

```dataview
TABLE requestKind, isInternalAuthor, authorUsername, sourceRepo
FROM "GitCode Issues/issues"
SORT createdAt DESC
```

## API Reference

- [GitCode REST API Guide](https://docs.gitcode.com/en/docs/guide/)
- [GitCode Repositories API Docs](https://docs.gitcode.com/en/docs/repos/)
- [GitCode Issues API Docs](https://docs.gitcode.com/en/docs/repos/issues/)
- [GitCode Organizations API Docs](https://docs.gitcode.com/en/docs/orgs/)

## License

The plugin code is released under the MIT license. See [LICENSE.txt](LICENSE.txt).
