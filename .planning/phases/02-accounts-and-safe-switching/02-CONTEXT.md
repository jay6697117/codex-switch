# Phase 2: Accounts and Safe Switching - Context

**Gathered:** 2026-03-11
**Status:** Ready for planning

<domain>
## Phase Boundary

本阶段只交付本地账号仓库、active/inactive 账号展示、重命名/删除/遮罩、运行中 Codex 进程检测，以及带确认的 `auth.json` 安全切换事务。

明确不包含：OAuth 添加账号、usage 获取/刷新、warm-up、备份、安全模式和设置页。

</domain>

<decisions>
## Implementation Decisions

### Account lifecycle and fallback
- 保留 origin 的“Active Account + Other Accounts”心智模型，active 账号单独展示，其他账号集中展示。
- 每个账号必须有稳定内部 ID；重命名只能改显示名，不能改变身份、token 关联或 active 引用。
- 删除当前 active account 时自动切换到下一个可用账号；如果没有剩余账号，则进入空状态。

### Switch safety
- 检测到运行中的 Codex 进程时，默认不允许直接切换，必须走显式确认。
- 用户确认后，由应用负责优雅停止相关进程、改写 `auth.json`、更新 active account，再重启先前运行的进程。
- 不允许静默覆盖运行中 Codex 的认证上下文。

### Privacy and visibility
- 账号名称和邮箱默认可见，保留 origin 的信息密度。
- 支持单账号遮罩和“Hide All / Show All”全局遮罩。
- Phase 2 不做 usage-based sort、refresh、warm-up 操作入口；这些能力留给后续 phase。

### Claude's Discretion
- 账号列表在当前单窗口 shell 里的具体版式和卡片密度
- 删除确认与切换确认的具体文案样式
- Go 侧仓库与切换服务的包内文件拆分

</decisions>

<specifics>
## Specific Ideas

- 尽量保留 origin `AccountCard` 的交互速度：卡片视图、inline rename、active/other 分区、遮罩切换。
- 切换确认应该是阻断式确认流，不要退化成后台 toast。
- 当前 Phase 1 已经有单窗口 shell，所以 Phase 2 应直接把 accounts feature 接到现有 shell，而不是引入 router。

</specifics>

<code_context>
## Existing Code Insights

### Reusable Assets
- `codex-switcher-origin/src/components/AccountCard.tsx`: 已验证的卡片交互模型，包含 inline rename、active badge、mask toggle 和动作位布局。
- `codex-switcher-origin/src-tauri/src/commands/process.rs`: 已有 foreground/background Codex 检测、优雅停止和重启语义，可迁移到 Go adapter/service。
- `codex-switcher-origin/src-tauri/src/auth/switcher.rs`: 已有 `CODEX_HOME` 解析、`auth.json` 原子写入、文件锁和 Unix 权限处理逻辑，可作为 Go 侧切换事务参考。

### Established Patterns
- `frontend/src/lib/wails/services.ts`: React 组件已经通过 typed facade 访问 runtime，新增 accounts/process/switch 服务应延续这条边界。
- `internal/bootstrap/service.go` 与 `internal/contracts/bootstrap.go`: Go 侧已经建立结构化 contract 模式；Phase 2 的 account/process/switch DTO 与错误码应沿用。
- `frontend/src/app/AppShell.tsx`: 当前单窗口 shell 已就位，Phase 2 只需要扩展 feature 区域，不要重新改成大一统页面状态机。

### Integration Points
- 新账号仓库和切换服务应挂到 `app.go` 的 Wails binding surface 上，继续通过 facade 暴露给前端。
- 新的 accounts feature 需要接入当前 shell，并逐步替换 Phase 1 的 placeholder cards。
- 进程检测状态应作为 UI 顶部或账户区的可见状态输入，服务层负责提供结构化进程信息。

</code_context>

<deferred>
## Deferred Ideas

- OAuth 添加账号与 ChatGPT 登录链路 — Phase 3
- usage 展示、refresh 与排序策略 — Phase 3
- warm-up 手动/定时能力 — Phase 4
- 备份、安全模式和语言偏好设置 — Phase 5
- 全量 backend message localization sweep — Phase 6

</deferred>

---

*Phase: 02-accounts-and-safe-switching*
*Context gathered: 2026-03-11*
