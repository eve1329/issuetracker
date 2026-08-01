IssueTracker for Obsidian
====

[English](#english) | [中文](#simplified-chinese)

## English

IssueTracker is a local Obsidian plugin workspace for syncing issues from Git-compatible hosts into your vault.

The current implementation is verified against GitCode and GitLab-style issue APIs, including GitLab API `v4` and GitCode API `v5`. It also includes compatibility paths for GitHub and Gitee host layouts, but those paths have not been fully tested yet. If you hit a bug on any host, please open an issue.

### What It Does

- Sync issues from selected repositories on supported hosts, or from every repository under a configured organization or group.
- Persist each issue as a normalized Obsidian note under the configured issues folder.
- Mark authors as internal or external by combining the confirmed member directory, repository collaborator data, and a manual whitelist.
- Treat authors as internal when titles match an `IR` / `SR` reference or a default workflow marker (`【fix】`, `【bug】`, `【门禁测试】`, `门禁测试`, `【release】`, `【next】`, `【需求】`), even when the account is not yet in the confirmed directory. Historical closed Issues do not receive first-time ledger rows, but their internal evidence identifies later Issues from the same account.
- Generate a roster-gap Markdown report listing title-evidence accounts missing from the confirmed directory, including reasons and related Issues.
- Classify issues into `bug`, `requirement`, or `unknown` using configurable prefix, keyword, and label rules.
- Generate machine-friendly daily reports and AI-friendly daily briefs.
- Generate a 13-column native-hyperlink XLSX issue ledger. It records the first non-author, non-system comment timestamp and elapsed response time without storing comment text. A tracked Issue that changes from open to closed is shown with a dark row for that sync; retired CSV output is removed after a successful XLSX refresh.
- Generate a separate Markdown reminder when tracked Issues close, retaining the current closed-Issue list for follow-up.
- Notify locally and through an optional Feishu group-bot webhook when internal or external Issues are newly discovered. Feishu delivery is logged only after the webhook accepts it, so a failed or unrecorded delivery remains pending for a later successful sync.
- Persist sync metadata, degraded-sync warnings, and collaborator caches under the configured meta folder.

### Default Output Layout

- `GitCode Issues/issues/*.md`
- `GitCode Issues/meta/internal-members.json`
- `GitCode Issues/meta/issue-closure-state.json`
- `GitCode Issues/meta/issue-ledger-state.json`
- `GitCode Issues/meta/issue-notification-state.json`
- `GitCode Issues/meta/sync-state.json`
- `GitCode Issues/reports/issue-ledger.xlsx`
- `GitCode Issues/reports/internal-member-identity-review.md`
- `GitCode Issues/reports/issue-close-reminders.md`
- `GitCode Issues/reports/daily/YYYY-MM-DD.md`
- `GitCode Issues/reports/daily-brief/YYYY-MM-DD-brief.md`

The default output layout still uses `GitCode Issues` for backward compatibility, but you can change it in settings if you want a host-specific folder name.

### Installation

For the release ZIP, extract the `issuetracker` folder into your vault's `.obsidian/plugins/` directory, then enable `IssueTracker` in Obsidian. The ZIP deliberately does not include `data.json`; configure your own token and settings in the plugin settings page.

For source-workspace builds:

1. Run `npm install` once if dependencies are not installed yet.
2. Build the plugin with `npm run build`.
3. Copy these files into your vault plugin directory `.obsidian/plugins/issuetracker/`:
   - `manifest.json`
   - `main.js`
   - `styles.css`
   - `versions.json`
4. Enable `IssueTracker` in Obsidian.

### Configuration

Open the `IssueTracker` settings tab and configure:

- `Git Host URL`: historical field name in code, used as the base URL for the configured host; defaults to `https://gitcode.com`
- `API Base URL`: defaults to `https://gitcode.com/api/v5`; override it to match the configured host's API root
- `Personal Access Token`: token used for API requests against the configured host
- `Organization Name`: the organization, group, or owner that owns the repositories
- `Repository List`: one repository per line when you do not sync the whole organization or group
- `Sync all organization repositories`: automatically discover repositories under the configured organization or group
- `Internal User Whitelist`: fallback usernames to treat as internal even if collaborator sync is incomplete
- `Internal Member Directory`: authoritative JSON account-to-name mapping used by ledgers, daily reports, and roster-gap review; listed accounts are confirmed internal
- `Issue Ledger Start Month`: optional `YYYY-MM` cutoff. Only issues created in that month or later enter the ledger; changing it resets ledger serial allocation
- `Classification Rules`: JSON rules for mapping titles or labels into `bug` / `requirement`
- `Issues Folder`, `Meta Folder`, `Reports Folder`: output locations inside the vault
- `Generate daily reports`: write daily summaries and AI briefs after sync
- `Show local notifications for new Issues?`: show an Obsidian notice for newly discovered internal and external Issues; each Issue is labelled with its author type; enabled by default
- `Feishu Bot Webhook`: optional Feishu group-bot URL. The plugin posts newly discovered internal and external Issues directly from Obsidian, with the author type on every item; successful delivery is recorded per Issue and pending deliveries retry after later successful syncs. Leave empty for local notices only

The settings page still keeps a legacy API-scope compatibility section from the original importer code path. The primary workflow in this fork is the repository sync path described above.

### Usage

- Click the left-ribbon `IssueTracker` icon to trigger a sync.
- Or run the command palette action `Sync IssueTracker`.
- If `Refresh issues on startup` is enabled, the plugin waits 30 seconds after launch before the first automatic sync.
- Automatic refresh runs every 15 minutes by default.
- The first successful sync silently records the current Issue set. Later successful syncs notify for newly discovered internal and external Issues; failed or degraded syncs do not advance the notification baseline. A Feishu delivery is removed from the pending queue only after the webhook responds successfully. On the first delivery-aware sync, same-day internal Issues that were already seen but have no delivery record are directly backfilled; older history is not replayed. Overlapping triggers share one in-progress sync so they cannot duplicate progress notices or compete to write the same generated files.

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

IssueTracker 是一个本地 Obsidian 插件工作区，用来把 Git 代码托管平台上的 issue 同步到你的知识库。

当前实现已经验证了 GitCode 和 GitLab 风格的 issue API，包括 GitLab API `v4` 和 GitCode API `v5`。同时也补了 GitHub 和 Gitee 的兼容路径，但这两条路径还没有完整测过；如果你遇到 bug，可以直接提 issue。

### 它能做什么

- 从指定的仓库同步 issue，或者同步某个组织 / group 下的全部仓库。
- 将每条 issue 规范化后保存到配置的 issues 目录。
- 结合内部成员目录、仓库协作者信息和手工白名单，把作者标记为内部或外部成员。
- 当标题命中 `IR` / `SR` 内部编号，或默认内部工作标记 `【fix】`、`【bug】`、`【门禁测试】`、`门禁测试`、`【release】`、`【next】`、`【需求】` 时，即使作者账号尚未进入成员目录，也按内部人员处理。历史关闭 Issue 不会首次写入台账，但其内部证据会用于识别同一账号后续的 Issue。
- 自动生成“内部人员名单收集待补全报告”，单独列出命中内部标题证据但不在已确认成员目录中的账号、原因和关联 Issue。
- 通过可配置的前缀、关键词和标签规则，把 issue 分类为 `bug`、`requirement` 或 `unknown`。
- 生成便于机器处理的日报，以及适合 AI 消费的日报摘要。
- 生成 13 列 XLSX issue 台账，使用原生超链接，导入腾讯文档后可直接点击。“首次响应时间”取非 Issue 作者、非系统事件的第一条评论时间，只保留时间元数据，不保存评论正文；已追踪 Issue 从 open 变为 closed 的当次同步会以深色整行标记。Excel 写入成功后会清理已废弃的 CSV 台账。
- 在已追踪的 issue 关闭时生成独立 Markdown 提醒，并保留当前关闭 issue 列表便于跟进。
- 对新增内部和外部 Issue 发送本机及可选飞书群机器人提醒。飞书只有在 Webhook 成功接收后才记录为已投递，失败或未记录的投递会在后续成功同步时重试。
- 将同步元数据、降级同步告警和协作者缓存保存到配置的 meta 目录。

### 默认输出结构

- `GitCode Issues/issues/*.md`
- `GitCode Issues/meta/internal-members.json`
- `GitCode Issues/meta/issue-closure-state.json`
- `GitCode Issues/meta/issue-ledger-state.json`
- `GitCode Issues/meta/issue-notification-state.json`
- `GitCode Issues/meta/sync-state.json`
- `GitCode Issues/reports/issue-ledger.xlsx`
- `GitCode Issues/reports/internal-member-identity-review.md`
- `GitCode Issues/reports/issue-close-reminders.md`
- `GitCode Issues/reports/daily/YYYY-MM-DD.md`
- `GitCode Issues/reports/daily-brief/YYYY-MM-DD-brief.md`

默认输出结构仍然沿用 `GitCode Issues` 作为兼容默认值，但你可以在设置里改成适合当前主机的目录名。

### 安装

使用发布 ZIP 时，将其中的 `issuetracker` 文件夹解压到你的 vault 的 `.obsidian/plugins/` 目录，然后在 Obsidian 中启用 `IssueTracker`。ZIP 不会包含 `data.json`，请在插件设置页填写你自己的 token 和同步配置。

从源码工作区构建时：

1. 如果依赖还没安装，先执行一次 `npm install`。
2. 使用 `npm run build` 构建插件。
3. 把这些文件复制到你的 vault 插件目录 `.obsidian/plugins/issuetracker/`：
   - `manifest.json`
   - `main.js`
   - `styles.css`
   - `versions.json`
4. 在 Obsidian 里启用 `IssueTracker`。

### 配置

打开 `IssueTracker` 的设置页，配置以下内容：

- `Git Host URL`：代码里沿用的历史字段名，本质上表示当前主机地址；默认是 `https://gitcode.com`
- `API Base URL`：默认是 `https://gitcode.com/api/v5`；需要时可按当前主机的 API 根路径覆盖
- `Personal Access Token`：用于当前主机 API 请求的 token
- `Organization Name`：拥有目标仓库的组织、group 或 owner
- `Repository List`：当你不想同步整个组织或 group 时，每行填写一个仓库
- `Sync all organization repositories`：自动发现并同步该组织或 group 下的所有仓库
- `Internal User Whitelist`：当协作者同步不完整时，仍要视为内部成员的用户名白名单
- `Internal Member Directory`：账号到姓名的权威 JSON 映射，用于台账、日报和名单待补全报告；目录中的账号均视为已确认内部人员
- `Issue Ledger Start Month`：可选 `YYYY-MM` 截止月份，只会将该月及之后创建的 issue 写入台账；修改该值会重建台账序号
- `Classification Rules`：把标题或标签映射到 `bug` / `requirement` 的 JSON 规则
- `Issues Folder`、`Meta Folder`、`Reports Folder`：vault 内的输出目录
- `Generate daily reports`：同步完成后生成日报和 AI 摘要
- `新增 Issue 时本机提醒？`：默认开启；对新增的内部和外部 Issue 显示 Obsidian 提示，并标明类型
- `飞书群机器人 Webhook`：可选的飞书群机器人地址。插件会从 Obsidian 直接发送本次新增的内部和外部 Issue，并在每条中标明类型；每条成功投递都会记录，未成功投递会在后续成功同步时重试；留空则只保留本机提示

设置页里仍保留了原始导入器路径中的旧 API scope 兼容区块。这个分支当前的主要工作流是上面这套仓库同步模型。

### 使用方式

- 点击左侧边栏的 `IssueTracker` 图标触发同步。
- 或者在命令面板里执行 `Sync IssueTracker`。
- 如果启用了 `Refresh issues on startup`，插件会在 Obsidian 启动 30 秒后执行第一次自动同步。
- 默认情况下，自动刷新每 15 分钟执行一次。
- 第一次成功同步只会静默记录当前 Issue 集合；之后的成功同步会提醒新增的内部和外部 Issue，并标明类型。飞书只有在 Webhook 成功接收后才从待投递队列移除，失败会在后续成功同步时重试。首次启用投递记录时，当天已同步但未记录投递的内部 Issue 会直接补发，较早历史不会重放。失败或降级同步不会推进通知基线。重叠的同步触发会复用同一次运行，避免重复进度条和对同一生成文件的竞争写入。

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
