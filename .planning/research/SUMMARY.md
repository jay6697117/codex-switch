# Project Research Summary

**Project:** Codex Switch
**Domain:** 本地桌面 Codex CLI 多账号管理器重构
**Researched:** 2026-03-11
**Confidence:** HIGH

## Executive Summary

这类产品最合适的形态仍然是“本地系统服务 + Web UI 的桌面单体”，而不是服务端化或继续沿用旧 Tauri/Rust 代码结构。对当前项目来说，`Go + Wails v2 + React + TypeScript + i18next` 是最稳的技术组合：它既保留了 origin 的桌面能力边界，也最适合承接“完整功能对齐、显式移除 Add Account > Import File、全量双语国际化”的目标。

研究结果最明确的结论有三个。第一，真正需要重构的不是 UI 外观，而是 origin 中隐式存在的协议边界：账号切换事务、OAuth/refresh 适配、usage/warmup API、调度事件、备份格式与安全模式。第二，国际化不能只做前端字符串翻译，Go 后端必须改成返回可本地化的 message code / args。第三，当前代码库几乎没有自动化测试，新的 roadmap 必须把契约测试和高风险流程测试提前，而不是最后补。

- 产品类型：本地单用户桌面工具，不扩展为云端共享服务
- 推荐方法：Wails v2 稳定栈 + feature-based React frontend + Go domain services
- 核心风险：切换事务边界、外部 OpenAI/Auth 适配脆弱、半成品 i18n、无测试重构

## Key Findings

### Recommended Stack

推荐栈是 `Go 1.23.x + Wails v2.11.0 + React 19.2.4 + TypeScript 5.9.3 + Vite 7.3.1 + Tailwind CSS 4.2.1 + i18next/react-i18next`。Wails 负责桌面壳、绑定和事件，React/TypeScript 负责 UI 与契约承接，i18next 负责系统语言默认值、fallback 和运行时切换。  
为了不抬高 Go 最低版本门槛，后端应尽量优先标准库与少量稳定依赖；keychain 用 `github.com/zalando/go-keyring`，测试用 `testify`，前端测试用 `Vitest + Testing Library`，关键流程回归用 `Playwright`。

**Core technologies:**
- **Go 1.23.x**: 后端服务与本地系统集成 — 满足 Wails 版本与当前环境约束
- **Wails v2.11.0**: 桌面壳、Go/JS 绑定、事件 — 稳定且贴合当前重构目标
- **React + TypeScript**: 前端承接 origin 交互与可维护性改造 — 降低 UI 重写摩擦
- **i18next + react-i18next**: 双语资源、fallback、运行时切换 — 满足完整国际化要求

### Expected Features

这个品类的 table stakes 是：多账号本地管理、OAuth 添加账号、活跃账号切换、usage 查看、warm-up、定时 warm-up、备份导入导出和设置页。对本项目来说，双语国际化不是加分项，而是 launch blocker。  
明确不做的能力也同样重要：`Add Account > Import File` 单账号导入、云端同步/共享、第三语言和常驻后台守护进程都不属于 v1。

**Must have (table stakes):**
- 多账号本地存储与活跃账号切换
- OAuth 添加账号、usage 查看、warm-up、scheduled warm-up
- slim/full 备份导入导出
- `zh-CN` / `en-US` 国际化与语言持久化

**Should have (competitive):**
- 本地化错误/状态模型
- 更安全的切换事务语义
- 更克制的 polling 与更清晰的前后端契约

**Defer (v2+):**
- 系统托盘/后台常驻
- 第三语言
- 云端同步/多人共享

### Architecture Approach

推荐架构是“React feature UI → frontend app services/facade → Wails bindings/events → Go domain services → storage/platform/openai adapters”。这条链路的关键不在于文件夹长什么样，而在于：组件不能直接碰 native binding，Go 不能直接返回英文字符串，切换/OAuth/usage/backup/scheduler 都必须以 service + adapter 形式隔离。

**Major components:**
1. **Frontend feature modules** — 账号、usage、warmup、备份、设置与 i18n
2. **Go domain services** — 切换、OAuth、usage、调度、备份、安全设置
3. **Platform/OpenAI adapters** — 文件、keychain、进程、HTTP 与事件桥接

### Critical Pitfalls

1. **重建另一个巨型 `App.tsx`** — 通过 feature modules + facade 分层避免
2. **把账号切换当成普通文件写入** — 通过事务语义、失败模型和测试避免
3. **国际化只做前端静态文案** — 通过 message code / args 契约避免
4. **继续依赖高频轮询** — 通过事件驱动和节流策略避免
5. **不先定义旧备份兼容策略** — 在备份 phase 前先锁兼容边界

## Implications for Roadmap

Based on research, suggested phase structure:

### Phase 1: Foundation and Contracts
**Rationale:** 先解决结构和国际化基础设施，否则后续所有功能都会继续长在旧耦合上。
**Delivers:** Wails skeleton、frontend feature shell、typed contracts、i18n bootstrapping、测试骨架
**Addresses:** 前后端边界、双语基础、无测试开局
**Avoids:** 巨型页面编排复刻、半成品 i18n

### Phase 2: Accounts and Safe Switching
**Rationale:** 账号模型、active account 和 `auth.json` 切换是产品核心价值，必须最早稳定。
**Delivers:** 本地账号存储、重命名/删除/遮罩、进程检测、安全切换事务
**Uses:** Go domain services + platform adapters
**Implements:** accounts / switching / process boundaries

### Phase 3: OAuth and Usage Pipeline
**Rationale:** 没有 OAuth 添加账号和 usage 查询，产品只能展示空壳。
**Delivers:** OAuth 登录、取消/超时恢复、token refresh、usage refresh、失败态
**Uses:** OpenAI/Auth adapters
**Implements:** auth / usage components

### Phase 4: Warmup Automation
**Rationale:** warm-up 与 scheduled warm-up 是 origin 的高价值差异化能力，需要独立处理调度与事件。
**Delivers:** 单账号/全量 warm-up、定时调度、错过补跑、事件反馈
**Uses:** Wails events + scheduler service

### Phase 5: Backup, Settings, and Localization Completion
**Rationale:** 备份、安全模式、语言设置和本地化消息模型都跨多个子系统，适合单独收口。
**Delivers:** slim/full 导入导出、安全模式、locale 持久化、后端 message code 本地化
**Uses:** backup / settings / i18n integration

### Phase 6: Parity Verification and Release Readiness
**Rationale:** 需要显式做一次功能对齐、语言覆盖、跨平台打包和高风险回归，而不是假设“已经差不多”。
**Delivers:** parity sweep、双语冒烟、关键回归、CI/release hardening

### Phase Ordering Rationale

- 先基础设施再功能迁移，避免后续反复返工前后端契约和 i18n 结构
- 先切换核心，再 OAuth/usage，再调度，再备份/设置，符合依赖链和风险排序
- 把国际化分成“基础设施”与“全面覆盖”两段，是为了避免最后一刻大规模文案回填

### Research Flags

Phases likely needing deeper research during planning:
- **Phase 3:** OpenAI/Auth 边界变化风险高，需要以接口与 fixture 为中心做补充研究
- **Phase 5:** 如果要兼容旧 `.cswf`，需要单独研究旧备份格式的迁移边界

Phases with standard patterns (skip research-phase):
- **Phase 1:** Wails + React + i18next 的基础设施模式相对成熟
- **Phase 6:** 主要是验证与发布收尾，不需要额外领域研究

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | 关键版本来自官方文档、npm registry 和 go module registry |
| Features | HIGH | 现有 origin 功能已清晰，可直接作为基线 |
| Architecture | HIGH | 这是典型桌面单体重构问题，边界非常明确 |
| Pitfalls | HIGH | 既有代码债和目标约束都非常具体，不是泛泛而谈 |

**Overall confidence:** HIGH

### Gaps to Address

- **旧备份兼容策略:** 是否必须兼容 origin 现有 full/slim 备份格式，需要在 Phase 5 开始前明确
- **桌面级 E2E 策略:** Playwright 覆盖到什么粒度，需要在 Phase 1 规划时锁定

## Sources

### Primary (HIGH confidence)
- Wails docs — installation / firstproject / howdoesitwork / runtime events
- react-i18next docs — `useTranslation` hook
- i18next docs — configuration options
- npm registry / Go module registry — 当前稳定版本

### Secondary (MEDIUM confidence)
- `codex-switcher-origin` 代码库与 `.planning/codebase/` 代码地图

---
*Research completed: 2026-03-11*
*Ready for roadmap: yes*
