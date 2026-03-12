# Phase 5 Context: Backup and Preference Management

## Goal

在现有 Wails 单窗口 shell 中补齐三类能力：origin 兼容的 slim/full 备份导入、full backup 的安全模式与文件流、以及 locale/security mode 的持久化设置。

## Locked Decisions

- 兼容 `codex-switcher-origin` 的旧 `slim` 与 `full` 导入格式。
- full backup 的新导出只保留 `keychain` 与 `passphrase` 两种安全模式，不再导出 `less_secure`。
- legacy `less_secure` 只允许导入，不再作为产品面暴露。
- `full import` 遇到重复 `id` 或 `displayName` 一律跳过，不覆盖本地账号。
- `Settings` 继续作为当前单窗口 shell 里的独立 section，不引入 router。
- 语言切换是三态：`system / zh-CN / en-US`。
- slim/full 导入成功后通过 shell-level revision 触发账号区重新 hydrate；`WarmupSection` 继续只消费 shell 传下来的账号快照。

## Implementation Shape

- Go 侧增加 `internal/backup` codec/service、`PreferencesService`、keychain adapter，以及 backup/settings 的 Wails bindings。
- 前端通过 typed `settings` / `backup` facade 接入，不允许组件直接调用 raw Wails bindings。
- full backup 统一走两段式交互：先选路径，再根据模式决定是否需要应用内 passphrase 对话框。

## Non-Goals

- 不要求新项目导出的 full backup 能被 origin 反向读取。
- 不把 `Import File` 带回 Add Account。
- 不把 warmup 配置重新搬回 settings。
