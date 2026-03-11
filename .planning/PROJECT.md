# Codex Switch

## What This Is

这是一个基于 `Golang + Wails` 重构的本地桌面应用，用来管理多个 OpenAI Codex CLI 账号，并在不离开桌面端的前提下完成账号切换、额度查看、定时 warmup、备份恢复与安全设置。它以 `codex-switcher-origin` 为功能基线做彻底重构，但明确移除 `Add Account` 弹窗里的 `Import File` / `auth.json` 单账号导入能力，并把中英文国际化作为 v1 硬约束。

## Core Value

本地、安全、可预期地管理和切换多个 Codex 账号，同时把原项目的隐式桌面行为抽成清晰、可测试、可国际化的前后端契约。

## Requirements

### Validated

- ✓ 多账号列表、活跃账号展示与重命名/删除/信息遮罩能力已在 `codex-switcher-origin` 中存在
- ✓ ChatGPT OAuth 登录添加账号与活跃账号切换能力已在 `codex-switcher-origin` 中存在
- ✓ `~/.codex/auth.json` 改写、Codex 进程检测与切换前重启确认能力已在 `codex-switcher-origin` 中存在
- ✓ 额度查询、手动 warm-up、定时 warm-up 与错过调度补跑能力已在 `codex-switcher-origin` 中存在
- ✓ 应用级 slim/full 备份导入导出与加密安全模式能力已在 `codex-switcher-origin` 中存在

### Active

- [ ] 使用 `Golang + Wails` 重写当前桌面应用，替换 `Tauri + Rust`
- [ ] 保留现有核心用户可见能力，但不实现 `Add Account > Import File`
- [ ] 为全部用户可见文本、错误提示、状态提示接入 `zh-CN` / `en-US` 国际化
- [ ] 首次启动跟随系统语言，之后允许用户手动切换并持久化语言偏好
- [ ] 建立清晰的前后端契约、可本地化错误模型与自动化测试基线

### Out of Scope

- `Add Account` 弹窗中的 `Import File` / `auth.json` 单账号导入能力 — 用户已明确不需要，且会干扰重构范围聚焦
- 云端同步、多人共享、服务端账号池化 — 与“本地单用户桌面工具”定位冲突
- `zh-CN` / `en-US` 之外的更多语言 — 当前 v1 只聚焦双语闭环
- 把应用改造成 Web/SaaS 形态 — 当前目标是桌面本地工具重构，不扩展产品形态

## Context

当前基线来自 `codex-switcher-origin/`，它是一个 `React + Tauri/Rust` 桌面单体：前端状态主要集中在 `codex-switcher-origin/src/App.tsx`，后端系统能力分散在 `codex-switcher-origin/src-tauri/src/commands/`、`auth/`、`api/` 与 `scheduler.rs`。  
已经完成 `.planning/codebase/` 代码地图，确认现有系统的关键复杂度集中在四类边界：本地文件存储、OAuth 回调与 token refresh、OpenAI/ChatGPT usage/warmup API、本地 Codex 进程检测与重启。  
现有代码几乎没有自动化测试，且用户可见文案大量硬编码在前端和后端返回字符串里，这也是本次重构必须顺手解决的结构性问题。

## Constraints

- **Tech stack**: 必须使用 `Golang + Wails`，前端延续 `React + TypeScript` 思路以降低 UI 重写成本并便于 i18n 接入
- **Parity**: v1 以 `codex-switcher-origin` 的核心用户能力为基线，但显式排除 `Add Account > Import File`
- **I18N**: 所有用户可见文本都必须支持 `zh-CN` / `en-US`，包含后端返回到 UI 的错误与状态消息
- **Storage**: 保持本地优先，继续围绕 `~/.codex-switcher` 与 `~/.codex/auth.json` 的桌面数据模型设计
- **Security**: 不允许在新架构中继续扩散原项目的原始字符串错误模型与高噪声敏感日志方式
- **Maintainability**: 重构目标不是机械移植，而是建立清晰模块边界、事务语义和测试入口

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| 使用 `Wails v2 + Go 1.23.x + React/TypeScript` | 保持桌面本地形态，复用现有前端认知，同时避免继续背负 Tauri/Rust 代码债 | — Pending |
| 采用彻底重构而非增量迁移 | 现有 `App.tsx` 与 native command 协议耦合过重，继续局部迁移只会复制旧债 | — Pending |
| 保留应用级 slim/full 备份导入导出 | 这是现有核心能力的一部分，用户仍需要跨机器/跨版本迁移账号配置 | — Pending |
| 移除 `Add Account > Import File` | 用户已明确删减该入口，且它会引入额外的文件选择与单账号导入复杂度 | — Pending |
| 国际化覆盖前后端所有用户可见文案 | 只做前端静态文案翻译会留下大量英文错误与状态信息，体验不完整 | — Pending |
| 语言默认跟随系统并允许持久化覆盖 | 满足双语桌面应用的自然默认行为，同时允许用户固定偏好 | — Pending |

---
*Last updated: 2026-03-11 after initialization*
