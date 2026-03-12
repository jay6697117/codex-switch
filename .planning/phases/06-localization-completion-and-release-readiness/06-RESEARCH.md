# Phase 6: Localization Completion and Release Readiness - Research

**Researched:** 2026-03-12  
**Domain:** i18n 覆盖收口、回归矩阵加固、macOS 公开发布链路  
**Confidence:** HIGH

## User Constraints (from CONTEXT.md)

### Locked Decisions
- 首个公开版本只支持 `macOS`，发布物固定为 `Universal`。
- 交付形态固定为 `DMG + App bundle`，分发方式固定为 `GitHub Releases`。
- 公开发布门槛必须包含签名与公证。
- 发布物除安装包外，还需要安装/升级说明与校验值。
- 双语范围固定为 `zh-CN` 与 `en-US`。
- 核心路径不允许中英混杂。
- backend-originated 核心错误与状态必须走结构化 message key，而不是 raw English。
- 发布前必须覆盖全部核心流，并满足“自动化全绿 + 人工冒烟通过 + 打包产物验证”。

### Claude's Discretion
- 缺失翻译的可观测方式可以是测试、日志、构建扫描或其组合。
- 人工冒烟矩阵的组织方式、执行顺序与记录格式由 planning 决定。
- DMG 的视觉包装与发布说明文案风格不在本 phase 锁定。

## Summary

Phase 6 不需要重构现有架构，最佳路径是沿着当前边界做“三段式收口”：

1. **06-01 本地化收口**  
   当前资源文件的中英 key 集已经对齐，风险不在 namespace 结构，而在“是否所有核心流都真正走到了这些 key 上”。本轮应把 UI copy 审计、backend error/status code 差集补齐，以及 `AUTH-05` 需要的 add/switch 成功失败反馈一起收口。

2. **06-02 回归矩阵加固**  
   当前项目已经有较好的 Go/Vitest/Playwright 基线，但它仍偏向“功能开发烟测”，还不是“公开发布前的 parity regression”。本轮应把现有自动化整理成按 requirement 驱动的完整回归矩阵，覆盖账号、切换、OAuth、usage、warmup、backup、settings。

3. **06-03 发布链路成型**  
   目前仓库只有 `wails build` 和 Ubuntu CI 校验，没有真正的 `macOS universal + DMG + signing + notarization + GitHub Releases` 流水线。公开发布的主要缺口不在业务代码，而在打包资产、签名公证配置、release workflow、checksum 和 packaged-app 冒烟。

**Primary recommendation:** 把 Phase 6 拆成 `localization closure -> regression hardening -> release pipeline` 三步，不再加新功能；同时把 `ResultEnvelope.message` / `AppError.code` 真正作为 backend-originated copy contract 用起来，避免临近发布时继续靠前端临时拼文案。

## Current State Audit

### 1. Localization assets are structurally ready

当前 i18n 资源已经覆盖这些 namespace：
- `accounts`
- `auth`
- `backup`
- `common`
- `errors`
- `settings`
- `shell`
- `usage`
- `warmup`

从资源键对比结果看，`en-US` 与 `zh-CN` 在所有 namespace 上的 key 数量和 key 集完全一致，说明当前问题**不是字典结构失衡**，而是**覆盖闭环是否完整**。

### 2. Backend error/status coverage still has visible gaps

基于 `internal/**` 和 `app.go` 里实际出现的 `contracts.AppError{Code: ...}` 做差集后，当前至少还有这些后端错误码未进入前端 `errors` namespace：

- `auth.account_not_found`
- `auth.refresh_failed`
- `process.restart_failed`
- `process.stop_failed`

这意味着即使资源文件结构已齐，也仍存在部分核心失败路径会退化成 fallback code 或 generic error 的风险。

### 3. `AUTH-05` still needs explicit success/failure UX closure

现有账户区和 OAuth modal 已有失败 banner，但“账号添加成功”和“账号切换成功”的显式成功反馈并未形成稳定、结构化、双语一致的闭环：

- `frontend/src/features/auth/AddAccountModal.tsx`
- `frontend/src/features/accounts/AccountSection.tsx`

这与 `AUTH-05` 的 requirement 仍有距离。Phase 6 应显式收口 add/switch 的 success and failure feedback，而不是把它留在隐式状态变化里。

### 4. Some user-visible values still bypass app-locale semantics

除了 `errors` 字典差集之外，当前还有几类“看起来已经国际化，但实际没有完全受 app locale 控制”的输出：

- full backup 导入/导出的原生文件对话框标题和过滤器文案仍在 `app.go` 中硬编码英文
- `usage.planType` 仍直接展示 backend/provider 返回值
- usage reset time 仍按 `Intl.DateTimeFormat(undefined, ...)` 走系统/浏览器 locale，而不是 app locale
- warmup schedule 的 `next run` 仍使用固定字符串格式，而不是 locale-aware formatter

这些不会在资源 key 对比里暴露，但会直接影响“核心路径零混杂”的发布标准。

### 5. `AppMessage` channel exists but is not yet an active contract

当前 contracts 已经预留了：

- `AppMessage`
- `ResultEnvelope.message`
- `EventEnvelope.message`

但现有前后端主路径基本只消费：

- `AppError.code`
- 结构化 `status / reasonCode / failureCode`

所以 release-ready 的 backend-originated success/status contract 还没有真正启用。Phase 6 最自然的收口方式，是把 add/switch 这类 requirement 明确要求成功反馈的 flows 先接入 `message code`，而不是继续让成功提示停留在前端局部拼文案。

### 6. Automated testing baseline is good, but not yet release-grade

当前已有自动化基础：

- Go service tests：`internal/*_test.go`
- Frontend tests：
  - `frontend/src/app/AppShell.test.tsx`
  - `frontend/src/features/accounts/AccountSection.test.tsx`
  - `frontend/src/features/settings/SettingsSection.test.tsx`
  - `frontend/src/features/warmup/WarmupSection.test.tsx`
  - `frontend/src/lib/wails/bridge.test.ts`
  - `frontend/src/i18n/createAppI18n.test.ts`
- Playwright smoke：
  - `frontend/tests/e2e/shell.smoke.spec.ts`

现有 smoke 已覆盖：
- active/inactive account rendering
- switch confirmation
- OAuth add-account flow
- usage refresh
- scheduled warmup feedback
- missed-run recovery
- locale change + slim import refresh
- full backup import passphrase retry

但这层 Playwright 目前仍运行在 Vite dev server 上，并通过假的 `window.go` / `window.runtime` 注入来模拟 Wails bridge；它不是最终桌面产物上的真实 E2E。  
这已经足以支撑 06-02，但还需要从“按功能烟测”升级到“按发布门槛回归”。

### 7. Release pipeline is still mostly absent

当前仓库的发布相关现状：

- `wails.json` 仍是最小配置骨架
- `.github/workflows/ci.yml` 只在 `ubuntu-latest` 上执行通用验证
- 仓库中还没有明确的：
  - `macos-latest` release job
  - universal build workflow
  - DMG 产物生成链路
  - codesign / notarization 配置
  - release draft / asset upload
  - checksum generation
  - packaged-app manual smoke checklist
- 当前 app version 仍是开发态常量，而不是明确的 release source of truth

也就是说，`QUAL-02` 当前基本还处于“可本地构建 app”而不是“可公开发布安装包”的阶段。

## Standard Stack

本 phase 不需要引入新的前端框架或桌面运行时，重点是补齐 release 与 validation 所需的标准工具。

| Tool / Source | Purpose | Planning Implication |
|---------------|---------|----------------------|
| Existing `react-i18next` resource model | 双语收口与 fallback 策略 | 继续按 namespace 扩展，不改 i18n 技术栈 |
| Existing `go test` + `vitest` + `playwright` | 发布前自动化回归 | 06-02 直接在现有工具上扩矩阵，不另起测试栈 |
| [Wails build docs](https://wails.io/docs/gettingstarted/building/) | 生产构建与 `build/bin` 产物约定 | 06-03 继续以 `wails build` 为 release pipeline 的核心构建动作 |
| [Wails crossplatform build guide](https://wails.io/docs/guides/crossplatform-build/) | GitHub Actions 中的 `darwin/universal` 构建思路 | 06-03 应拆出独立的 macOS release workflow，而不是继续挤在现有 Ubuntu verify job 里 |
| [Wails code signing guide](https://wails.io/docs/v2.10/guides/signing/) | macOS 签名、公证与 `build/darwin` 资产布局 | 06-03 应补 `Info.plist`、signing config、证书导入和 notarization 步骤 |
| [Apple notarization workflow](https://developer.apple.com/documentation/security/customizing-the-notarization-workflow) | 官方 `notarytool` 流程 | 公开发布必须基于 `notarytool`，不能再考虑废弃的 `altool` 路径 |
| [GitHub Releases docs](https://docs.github.com/en/repositories/releasing-projects-on-github/managing-releases-in-a-repository) | draft release、asset attachment、release notes | 06-03 应以 draft release 作为发布终点，先挂齐 DMG / checksums / notes 再发布 |

## Architecture Patterns

### Pattern 1: Translation inventory first, copy rewrite second
**What:** 先用资源 key 对比、error code 差集、核心流组件清单建立翻译 inventory，再补具体文案。  
**Why:** 当前 key 结构已齐，Phase 6 的风险在 coverage，不在资源体系。  
**Use in planning:** 06-01 先做审计和差集收口，再做零散 copy polish。

### Pattern 2: Treat `AppError.code` and `ResultEnvelope.message` as the release-grade copy contract
**What:** failure 路径继续用 `AppError.code`，success / status 路径开始明确使用 `message code` 或可稳定映射的 structured result。  
**Why:** 这能让 `AUTH-05` 和 `I18N-05` 有统一出口，而不是每个组件自己决定成功提示怎么写。  
**Use in planning:** 06-01 重点收口 add/switch；其余 flows 按是否真正属于 backend-originated status 决定是否跟进。

### Pattern 2.5: Separate dictionary parity from locale-aware formatting
**What:** 资源 key 对齐只能证明“翻译表结构完整”，不能证明时间、日期、plan label、native dialog copy 已真正跟随 app locale。  
**Why:** 当前最容易被漏掉的不是 `t("...")`，而是 `Intl.DateTimeFormat(undefined, ...)`、原始 provider 字段和 Go 侧原生对话框文案。  
**Use in planning:** 06-01 应把 locale-aware formatting 和 native dialog copy 作为独立 deliverable，而不是附带修补。

### Pattern 3: Layered regression, not one giant smoke
**What:** Go service tests 兜服务语义，Vitest 兜组件与 facade，Playwright 兜跨 section 核心流，packaged-app smoke 兜发布物真实可用性。  
**Why:** 现有 smoke 已经不算弱，但它不是发布门槛的全部。  
**Use in planning:** 06-02 不要把所有回归都继续堆进 `shell.smoke.spec.ts`。

### Pattern 4: Release workflow must be separate from everyday CI verify
**What:** 现有 `.github/workflows/ci.yml` 继续承担开发态验证；公开发布链路单独做 macOS release workflow。  
**Why:** release 需要 Apple 证书、notary credentials、asset upload、draft release，这些都不适合常规每次 push 的 verify job。  
**Use in planning:** 06-03 应新增独立 release workflow，而不是把 secrets-heavy 步骤直接混进现有 CI。

## Validation Architecture

Phase 6 适合按 3 个 plan 做验证分层：

- **06-01**
  - resource parity check
  - backend error-code coverage audit
  - add/switch localized feedback integration tests
- **06-02**
  - Go regression for auth/switch/backup/warmup edge semantics
  - frontend regression for dual-locale rendering, fallback observability, settings-driven locale changes
  - Playwright regression for end-to-end core flows
- **06-03**
  - macOS universal build verification
  - signing/notarization workflow verification
  - packaged-app manual smoke checklist
  - release asset completeness verification (`DMG`, checksums, notes)

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| 缺失翻译治理 | 纯人工 eyeballing | key-diff + code inventory + focused tests | Phase 6 的规模已经适合半自动审计 |
| backend success copy | 每个组件本地拼成功提示 | `ResultEnvelope.message` 或稳定结构化映射 | 便于统一双语和回归 |
| 发布流程 | 在本机手工重复打包并口头确认 | GitHub Actions + draft release + manual checklist | 公开发布需要可重复的 release 流程 |
| macOS 公证 | 继续参考 `altool` 老流程 | `notarytool` 官方流程 | Apple 已废弃 `altool` 公证路径 |

## Common Pitfalls

### Pitfall 1: 资源 key 对齐就以为本地化完成
**What goes wrong:** 字典文件看起来完整，但某些核心流仍在走 fallback code、generic error 或硬编码文案。  
**How to avoid:** 除了比对 key 集，还要对 `AppError.code`、成功反馈、modal copy 和 critical path 做逐流验证。

### Pitfall 2: 只补失败文案，不补成功反馈
**What goes wrong:** `AUTH-05` 在错误态看起来已覆盖，但用户完成 add/switch 后没有明确成功提示。  
**How to avoid:** 06-01 把 add/switch success feedback 当成一级 deliverable，而不是 UI polish。

### Pitfall 3: 把 Ubuntu CI 绿灯当成发布就绪
**What goes wrong:** 核心功能都能在测试里跑通，但真正的 macOS app bundle / DMG / Gatekeeper / notarization 没被验证。  
**How to avoid:** 06-03 明确加入 macOS package smoke 和 signed/notarized artifact gate。

### Pitfall 4: 把 release workflow 混进常规 CI
**What goes wrong:** 每次 push 都要依赖 Apple secrets 和 release assets，成本高且容易脆。  
**How to avoid:** 保持日常 verify 和正式 release workflow 分离。

## Recommended Plan Split

### 06-01 — Localized Message and Copy Closure
- 收口 UI copy coverage
- 补齐 backend error/status code 差集
- 给 add/switch flows 补显式 localized success/failure feedback
- 把 native dialog copy、时间日期格式和 raw backend display fields 统一纳入 app-locale 策略
- 增加翻译缺失可观测机制

### 06-02 — Parity Regression Matrix
- 扩 Go service regressions
- 扩 frontend integration regressions
- 扩 Playwright end-to-end core flow coverage
- 把 requirement 到 test 的映射整理清楚

### 06-03 — macOS Release Pipeline
- 新增 universal macOS release workflow
- 补 `build/darwin` / `wails.json` release 所需资产
- 生成 DMG、签名、公证、checksums
- 通过 GitHub Releases 草稿交付资产与说明

---

*Research note:* 当前结论同时基于仓库现状审计和官方一手资料：Wails build/signing 文档、Apple notarization 文档、GitHub Releases 文档。  
