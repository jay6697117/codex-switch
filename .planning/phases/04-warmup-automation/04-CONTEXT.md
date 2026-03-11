# Phase 4: Warmup Automation - Context

**Gathered:** 2026-03-11
**Status:** Ready for planning

<domain>
## Phase Boundary

本阶段只交付三类能力：

- 手动 warm-up：单账号与全量 warm-up
- 定时 warm-up：用户选择本地每日时间和参与账号集合
- missed-run：当天错过后重新打开应用时的补跑提示与结果反馈

明确不扩展：

- 多条 schedule / 每账号独立 schedule
- 系统托盘常驻 / 应用关闭后继续后台执行
- 备份、设置页、更多新增能力

</domain>

<decisions>
## Implementation Decisions

### Manual warm-up actions
- 保留 origin 的双入口心智模型：账号卡片里提供单账号 warm-up，顶部工具区保留 `Warm-up All`
- 单账号 warm-up 进行中时，只局部切换该动作位到 loading / disabled，不整卡禁用，也不全局冻结其它 warm-up 动作
- 手动 warm-up 完成后的主反馈是 `toast + 轻量最近结果状态`
- 当前不能执行 warm-up 的账号仍保留动作位，但按钮需要 disabled，并明确展示原因

### Scheduled warm-up configuration
- 定时 warm-up 作为独立的 `Warmup` 区域存在，不继续堆进账号区
- Phase 4 只支持一个全局 daily schedule：用户选择一个本地时间，再选择参与的账号集合
- 账号选择使用显式多选清单，并提供 `Select All / Clear All`
- 主界面需要常驻显示 schedule 摘要：每日时间、参与账号数、`Next run`
- schedule 配置无效时阻止保存，并使用表单内联提示，不退化成 toast-only 错误

### Missed-run prompt behavior
- 当天错过 scheduled warm-up 后，重新打开应用时使用阻断式弹窗提示
- missed-run 弹窗的主动作偏向 `Run Now`，`Skip Today` 作为次动作
- `Skip Today` 只压掉当天剩余时间内的 missed-run 提示，跨天后重新按新的一天计算
- 只有自动 scheduled run，或在 missed-run 弹窗中明确执行 `Run Now`，才记为当天已完成补跑
- 普通手动 warm-up 不自动抵扣当天 missed-run

### Claude's Discretion
- 轻量最近结果状态放在卡片、Warmup 区域摘要，还是二者组合
- 手动 / 定时 / missed-run 三类反馈在视觉上如何区分
- Warmup 区域的卡片密度、图标和最近结果的排版方式
- 本地化文案的具体语气与信息层级

</decisions>

<specifics>
## Specific Ideas

- 尽量保留 origin 的高价值语义：单账号闪电动作、顶部全量 warm-up、显式的 missed-run `Run Now / Skip Today`
- 但 Phase 4 不应继续把所有编排状态堆回账号区，schedule 应成为独立的 Warmup 区域
- 结果反馈不想做成只有 toast 的一次性提示，用户应能看到最近 warm-up 的轻量状态痕迹
- 定时 warm-up 的主界面摘要至少要让用户一眼确认“每天几点、多少账号、下次何时执行”

</specifics>

<code_context>
## Existing Code Insights

### Reusable Assets
- [app.go](/Users/zhangjinhui/Desktop/codex-switch/app.go): 当前所有 Wails backend contract 的统一入口，Phase 4 的 warmup/schedule API 适合继续从这里暴露
- [frontend/src/lib/contracts.ts](/Users/zhangjinhui/Desktop/codex-switch/frontend/src/lib/contracts.ts): 前端 typed DTO 中枢，适合补 warm-up result、schedule snapshot、event payload
- [frontend/src/lib/wails/services.ts](/Users/zhangjinhui/Desktop/codex-switch/frontend/src/lib/wails/services.ts): 已有 facade 注册表，可直接扩展 `warmup` / `scheduler`
- [frontend/src/lib/wails/bridge.ts](/Users/zhangjinhui/Desktop/codex-switch/frontend/src/lib/wails/bridge.ts): 已有 envelope unwrap 和 runtime event 订阅，是 scheduled result / missed-run event 的直接接入点
- [frontend/src/features/accounts/AccountSection.tsx](/Users/zhangjinhui/Desktop/codex-switch/frontend/src/features/accounts/AccountSection.tsx): 当前最成熟的账号容器，适合接入单账号 warm-up 和顶部 `Warm-up All`
- [internal/settings/store.go](/Users/zhangjinhui/Desktop/codex-switch/internal/settings/store.go): 已是设置持久化的自然 seam，但目前只覆盖 locale，需要扩展到 schedule

### Established Patterns
- 当前新项目已经稳定采用 `Go service -> Wails binding -> typed TS facade -> React feature container`
- 用户可见结果与错误都在向结构化、可本地化的 message / error code 收敛
- 单窗口 shell 已成型，新增能力应优先挂到 feature 区域，而不是回到单页大 orchestrator

### Integration Points
- 手动 warm-up 的入口最自然地接在账号卡片动作区和顶部工具区
- schedule 摘要与配置入口更适合作为 `AppShell` 下的独立 `Warmup` feature 区域
- scheduled run / missed-run 结果应该通过 runtime event 进入前端，而不是依赖持续轮询 toast 逻辑
- origin 的行为蓝本主要来自：
  - [src-tauri/src/scheduler.rs](/Users/zhangjinhui/Desktop/codex-switch/codex-switcher-origin/src-tauri/src/scheduler.rs)
  - [src-tauri/src/auth/settings.rs](/Users/zhangjinhui/Desktop/codex-switch/codex-switcher-origin/src-tauri/src/auth/settings.rs)
  - [src/components/ScheduledWarmupsModal.tsx](/Users/zhangjinhui/Desktop/codex-switch/codex-switcher-origin/src/components/ScheduledWarmupsModal.tsx)
  - [src/components/MissedScheduledWarmupModal.tsx](/Users/zhangjinhui/Desktop/codex-switch/codex-switcher-origin/src/components/MissedScheduledWarmupModal.tsx)

</code_context>

<deferred>
## Deferred Ideas

- 多条 schedule / 每账号独立执行时间
- 应用关闭后继续在系统层后台执行 warm-up
- 系统托盘常驻与 schedule 联动
- 更重的结果历史面板或 warm-up 审计列表

</deferred>

---

*Phase: 04-warmup-automation*
*Context gathered: 2026-03-11*
