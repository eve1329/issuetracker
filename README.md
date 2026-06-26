IssueTracker for Obsidian
====

[English](#english) | [中文](#simplified-chinese)

## English

IssueTracker is a local Obsidian plugin workspace for syncing issues from GitHub, Gitee, GitLab, and GitCode into your vault.

The current implementation supports GitHub, Gitee, GitLab, and GitCode-compatible issue workflows. It adds structured daily reporting on top of plain issue sync.

### What It Does

- Sync issues from selected repositories on supported hosts, or from every repository under a configured organization or group.
- Persist each issue as a normalized Obsidian note under the configured issues folder.
- Mark authors as internal or external by combining repository collaborator data with a manual whitelist.
- Classify issues into `bug`, `requirement`, or `unknown` using configurable prefix, keyword, and label rules.
- Generate machine-friendly daily reports and AI-friendly daily briefs.
- Persist sync metadata, degraded-sync warnings, and collaborator caches under the configured meta folder.

### Default Output Layout

- `GitCode Issues/issues/*.md`
- `GitCode Issues/meta/internal-members.json`
- `GitCode Issues/meta/sync-state.json`
- `GitCode Issues/reports/daily/YYYY-MM-DD.md`
- `GitCode Issues/reports/daily-brief/YYYY-MM-DD-brief.md`

The default output layout still uses `GitCode Issues` for backward compatibility, but you can change it in settings if you want a host-specific folder name.

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

- `GitCode instance URL`: historical field name for the host URL; defaults to `https://gitcode.com` but can point to GitHub, Gitee, GitLab, or GitCode
- `API Base URL`: defaults to `https://gitcode.com/api/v5`; override it to match the configured host's API root
- `Personal Access Token`: token used for API requests against the configured host
- `Organization Name`: the organization, group, or owner that owns the repositories
- `Repository List`: one repository per line when you do not sync the whole organization or group
- `Sync all organization repositories`: automatically discover repositories under the configured organization or group
- `Internal User Whitelist`: fallback usernames to treat as internal even if collaborator sync is incomplete
- `Classification Rules`: JSON rules for mapping titles or labels into `bug` / `requirement`
- `Issues Folder`, `Meta Folder`, `Reports Folder`: output locations inside the vault
- `Generate daily reports`: write daily summaries and AI briefs after sync

The settings page still keeps a legacy API-scope compatibility section from the original importer code path. The primary workflow in this fork is the multi-host repository sync described above.

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

API details vary by host. Consult the official REST API documentation for the provider you are configuring:

- GitHub REST API
- Gitee REST API
- GitLab REST API
- GitCode REST API

### License

The plugin code is released under the MIT license. See [LICENSE.txt](https://github.com/eve1329/issuetracker/blob/main/LICENSE.txt).

### Reference

This workspace is adapted from the upstream [obsidian-gitlab-issues](https://github.com/benr77/obsidian-gitlab-issues) plugin and reoriented around a multi-host issue workflow.

## Simplified Chinese

IssueTracker 是一个本地 Obsidian 插件工作区，用来把 GitHub、Gitee、GitLab 和 GitCode 的 issue 同步到你的知识库。

当前实现支持 GitHub、Gitee、GitLab 和 GitCode 的 issue 工作流，并在基础同步之外补充了结构化的日报生成能力。

### 它能做什么

- 从指定的仓库同步 issue，或者同步某个组织 / group 下的全部仓库。
- 将每条 issue 规范化后保存到配置的 issues 目录。
- 结合仓库协作者信息和手工白名单，把作者标记为内部或外部成员。
- 通过可配置的前缀、关键词和标签规则，把 issue 分类为 `bug`、`requirement` 或 `unknown`。
- 生成便于机器处理的日报，以及适合 AI 消费的日报摘要。
- 将同步元数据、降级同步告警和协作者缓存保存到配置的 meta 目录。

### 默认输出结构

- `GitCode Issues/issues/*.md`
- `GitCode Issues/meta/internal-members.json`
- `GitCode Issues/meta/sync-state.json`
- `GitCode Issues/reports/daily/YYYY-MM-DD.md`
- `GitCode Issues/reports/daily-brief/YYYY-MM-DD-brief.md`

默认输出结构仍然沿用 `GitCode Issues` 作为兼容默认值，但你可以在设置里改成适合当前主机的目录名。

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

- `GitCode instance URL`：历史字段名，表示主机地址；默认是 `https://gitcode.com`，也可以填写 GitHub、Gitee、GitLab 或 GitCode
- `API Base URL`：默认是 `https://gitcode.com/api/v5`；需要时可按当前主机的 API 根路径覆盖
- `Personal Access Token`：用于当前主机 API 请求的 token
- `Organization Name`：拥有目标仓库的组织、group 或 owner
- `Repository List`：当你不想同步整个组织或 group 时，每行填写一个仓库
- `Sync all organization repositories`：自动发现并同步该组织或 group 下的所有仓库
- `Internal User Whitelist`：当协作者同步不完整时，仍要视为内部成员的用户名白名单
- `Classification Rules`：把标题或标签映射到 `bug` / `requirement` 的 JSON 规则
- `Issues Folder`、`Meta Folder`、`Reports Folder`：vault 内的输出目录
- `Generate daily reports`：同步完成后生成日报和 AI 摘要

设置页里仍保留了原始导入器路径中的旧 API scope 兼容区块。这个分支当前的主要工作流是上面这套多主机仓库同步模型。

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

不同主机的 API 细节不一样，请查看你配置的平台官方 REST API 文档：

- GitHub REST API
- Gitee REST API
- GitLab REST API
- GitCode REST API

### 许可证

插件代码基于 MIT 协议发布。见 [LICENSE.txt](https://github.com/eve1329/issuetracker/blob/main/LICENSE.txt)。

### 参考来源

本工作区是在上游 [obsidian-gitlab-issues](https://github.com/benr77/obsidian-gitlab-issues) 插件基础上改造的，并重新聚焦到多主机 issue 工作流。
