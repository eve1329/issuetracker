IssueTracker for Obsidian
====

[English](#english) | [中文](#simplified-chinese)

## English

IssueTracker is a local Obsidian plugin workspace for syncing GitCode issues into your vault.

The current implementation is tailored for a GitCode-based issue workflow and adds structured daily reporting on top of plain issue sync.

### What It Does

- Sync issues from selected GitCode repositories, or from every repository under a configured organization.
- Persist each issue as a normalized Obsidian note under `GitCode Issues/issues`.
- Mark authors as internal or external by combining repository collaborator data with a manual whitelist.
- Classify issues into `bug`, `requirement`, or `unknown` using configurable prefix, keyword, and label rules.
- Generate machine-friendly daily reports and AI-friendly daily briefs.
- Persist sync metadata, degraded-sync warnings, and collaborator caches under `GitCode Issues/meta`.

### Default Output Layout

- `GitCode Issues/issues/*.md`
- `GitCode Issues/meta/internal-members.json`
- `GitCode Issues/meta/sync-state.json`
- `GitCode Issues/reports/daily/YYYY-MM-DD.md`
- `GitCode Issues/reports/daily-brief/YYYY-MM-DD-brief.md`

### Installation

This repo is set up as a local plugin workspace.

1. Run `npm install` once if dependencies are not installed yet.
2. Build the plugin with `npm run build`.
3. Copy these files into your vault plugin directory `.obsidian/plugins/issuetracker/`:
   - `manifest.json`
   - `main.js`
   - `versions.json`
4. Enable `IssueTracker` in Obsidian.

### Configuration

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

### Usage

- Click the left-ribbon `IssueTracker` icon to trigger a sync.
- Or run the command palette action `Sync IssueTracker`.
- If `Refresh issues on startup` is enabled, the plugin waits 30 seconds after launch before the first automatic sync.
- Automatic refresh runs every 15 minutes by default.

### Generated Data

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

### Dataview Example

```dataview
TABLE requestKind, isInternalAuthor, authorUsername, sourceRepo
FROM "GitCode Issues/issues"
SORT createdAt DESC
```

### API Reference

- [GitCode REST API Guide](https://docs.gitcode.com/en/docs/guide/)
- [GitCode Repositories API Docs](https://docs.gitcode.com/en/docs/repos/)
- [GitCode Issues API Docs](https://docs.gitcode.com/en/docs/repos/issues/)
- [GitCode Organizations API Docs](https://docs.gitcode.com/en/docs/orgs/)

### License

The plugin code is released under the MIT license. See [LICENSE.txt](https://github.com/eve1329/issuetracker/blob/main/LICENSE.txt).

### Reference

This workspace is adapted from the upstream [obsidian-gitlab-issues](https://github.com/benr77/obsidian-gitlab-issues) plugin and reoriented around a GitCode issue workflow.

## Simplified Chinese

IssueTracker 是一个本地 Obsidian 插件工作区，用来把 GitCode issue 同步到你的知识库。

当前实现围绕 GitCode 的 issue 工作流做了定制，并在基础同步之外补充了结构化的日报生成能力。

### 它能做什么

- 从指定的 GitCode 仓库同步 issue，或者同步某个组织下的全部仓库。
- 将每条 issue 规范化后保存为 `GitCode Issues/issues` 下的 Obsidian 笔记。
- 结合仓库协作者信息和手工白名单，把作者标记为内部或外部成员。
- 通过可配置的前缀、关键词和标签规则，把 issue 分类为 `bug`、`requirement` 或 `unknown`。
- 生成便于机器处理的日报，以及适合 AI 消费的日报摘要。
- 将同步元数据、降级同步告警和协作者缓存保存到 `GitCode Issues/meta`。

### 默认输出结构

- `GitCode Issues/issues/*.md`
- `GitCode Issues/meta/internal-members.json`
- `GitCode Issues/meta/sync-state.json`
- `GitCode Issues/reports/daily/YYYY-MM-DD.md`
- `GitCode Issues/reports/daily-brief/YYYY-MM-DD-brief.md`

### 安装

这个仓库当前按本地插件工作区来使用。

1. 如果依赖还没安装，先执行一次 `npm install`。
2. 使用 `npm run build` 构建插件。
3. 把这些文件复制到你的 vault 插件目录 `.obsidian/plugins/issuetracker/`：
   - `manifest.json`
   - `main.js`
   - `versions.json`
4. 在 Obsidian 里启用 `IssueTracker`。

### 配置

打开 `IssueTracker` 的设置页，配置以下内容：

- `GitCode instance URL`：默认是 `https://gitcode.com`
- `API Base URL`：默认是 `https://gitcode.com/api/v5`
- `Personal Access Token`：用于 API 请求的 GitCode token
- `Organization Name`：拥有目标仓库的 GitCode 组织名
- `Repository List`：当你不想同步整个组织时，每行填写一个仓库
- `Sync all organization repositories`：自动发现并同步该组织下的所有仓库
- `Internal User Whitelist`：当协作者同步不完整时，仍要视为内部成员的用户名白名单
- `Classification Rules`：把标题或标签映射到 `bug` / `requirement` 的 JSON 规则
- `Issues Folder`、`Meta Folder`、`Reports Folder`：vault 内的输出目录
- `Generate daily reports`：同步完成后生成日报和 AI 摘要

设置页里仍保留了原始导入器路径中的旧 API scope 兼容区块。这个分支当前的主要工作流仍然是上面这套 GitCode 组织 / 仓库同步模型。

### 使用方式

- 点击左侧边栏的 `IssueTracker` 图标触发同步。
- 或者在命令面板里执行 `Sync IssueTracker`。
- 如果启用了 `Refresh issues on startup`，插件会在 Obsidian 启动 30 秒后执行第一次自动同步。
- 默认情况下，自动刷新每 15 分钟执行一次。

### 生成的数据

issue 笔记属于生成产物。当前同步流程会重写规范化的 issue 文件和派生报表，所以除非你同时修改输出流程，否则对生成笔记的手工编辑都应视为可丢弃内容。

每条规范化 issue 笔记都会包含类似下面这些 frontmatter：

- `createdAt`
- `updatedAt`
- `projectPath`
- `sourceRepo`
- `authorUsername`
- `isInternalAuthor`
- `requestKind`
- `requestKindMatchedBy`
- `labels`

### Dataview 示例

```dataview
TABLE requestKind, isInternalAuthor, authorUsername, sourceRepo
FROM "GitCode Issues/issues"
SORT createdAt DESC
```

### API 参考

- [GitCode REST API Guide](https://docs.gitcode.com/en/docs/guide/)
- [GitCode Repositories API Docs](https://docs.gitcode.com/en/docs/repos/)
- [GitCode Issues API Docs](https://docs.gitcode.com/en/docs/repos/issues/)
- [GitCode Organizations API Docs](https://docs.gitcode.com/en/docs/orgs/)

### 许可证

插件代码基于 MIT 协议发布。见 [LICENSE.txt](https://github.com/eve1329/issuetracker/blob/main/LICENSE.txt)。

### 参考来源

本工作区是在上游 [obsidian-gitlab-issues](https://github.com/benr77/obsidian-gitlab-issues) 插件基础上改造的，并重新聚焦到 GitCode issue 工作流。
