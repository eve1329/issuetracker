IssueTracker for Obsidian
====

[English](https://github.com/eve1329/issuetracker/blob/main/README.md#english)

IssueTracker 是一个本地 Obsidian 插件工作区，用来把 GitHub、Gitee、GitLab 和 GitCode 的 issue 同步到你的知识库。

当前实现支持 GitHub、Gitee、GitLab 和 GitCode 的 issue 工作流，并在基础同步之外补充了结构化的日报生成能力。

## 它能做什么

- 从指定的仓库同步 issue，或者同步某个组织 / group 下的全部仓库。
- 将每条 issue 规范化后保存到配置的 issues 目录。
- 结合仓库协作者信息和手工白名单，把作者标记为内部或外部成员。
- 通过可配置的前缀、关键词和标签规则，把 issue 分类为 `bug`、`requirement` 或 `unknown`。
- 生成便于机器处理的日报，以及适合 AI 消费的日报摘要。
- 将同步元数据、降级同步告警和协作者缓存保存到配置的 meta 目录。

## 默认输出结构

- `GitCode Issues/issues/*.md`
- `GitCode Issues/meta/internal-members.json`
- `GitCode Issues/meta/sync-state.json`
- `GitCode Issues/reports/daily/YYYY-MM-DD.md`
- `GitCode Issues/reports/daily-brief/YYYY-MM-DD-brief.md`

默认输出结构仍然沿用 `GitCode Issues` 作为兼容默认值，但你可以在设置里改成适合当前主机的目录名。

## 安装

这个仓库当前按本地插件工作区来使用。

1. 如果依赖还没安装，先执行一次 `npm install`。
2. 使用 `npm run build` 构建插件。
3. 把这些文件复制到你的 vault 插件目录 `.obsidian/plugins/issuetracker/`：
   - `manifest.json`
   - `main.js`
   - `versions.json`
4. 在 Obsidian 里启用 `IssueTracker`。

## 配置

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

## 使用方式

- 点击左侧边栏的 `IssueTracker` 图标触发同步。
- 或者在命令面板里执行 `Sync IssueTracker`。
- 如果启用了 `Refresh issues on startup`，插件会在 Obsidian 启动 30 秒后执行第一次自动同步。
- 默认情况下，自动刷新每 15 分钟执行一次。

## 生成的数据

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

## Dataview 示例

```dataview
TABLE requestKind, isInternalAuthor, authorUsername, sourceRepo
FROM "GitCode Issues/issues"
SORT createdAt DESC
```

## API 参考

不同主机的 API 细节不一样，请查看你配置的平台官方 REST API 文档：

- GitHub REST API
- Gitee REST API
- GitLab REST API
- GitCode REST API

## 许可证

插件代码基于 MIT 协议发布。见 [LICENSE.txt](https://github.com/eve1329/issuetracker/blob/main/LICENSE.txt)。

## 参考来源

本工作区是在上游 [obsidian-gitlab-issues](https://github.com/benr77/obsidian-gitlab-issues) 插件基础上改造的，并重新聚焦到多主机 issue 工作流。
