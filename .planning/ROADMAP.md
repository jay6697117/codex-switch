# Roadmap: Codex Switch

## Overview

这次 v1 不是在 origin 上继续堆功能，而是把现有桌面工具的核心价值拆成一条清晰的重构路径：先搭好 `Wails + Go + React/TypeScript + i18n` 的基础骨架和契约层，再依次迁移账号切换、OAuth/usage、warmup、备份/设置，最后做完整国际化覆盖、回归验证和发布准备。phase 顺序完全按依赖链和风险排序设计，避免把高耦合逻辑直接搬进新架构。

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

- [x] **Phase 1: Foundation and Locale Bootstrap** - 建立 Wails 工程骨架、前后端契约和双语基础设施
- [x] **Phase 2: Accounts and Safe Switching** - 落地本地账号仓库、进程检测和安全切换事务
- [x] **Phase 3: OAuth and Usage Visibility** - 完成 OAuth 添加账号、token refresh 与 usage 可视化
- [ ] **Phase 4: Warmup Automation** - 迁移单账号/全量 warm-up、定时调度和错过补跑
- [ ] **Phase 5: Backup and Preference Management** - 完成 slim/full 备份、安全模式、语言偏好与设置能力
- [ ] **Phase 6: Localization Completion and Release Readiness** - 完整补齐双语覆盖、回归测试、打包与发布质量

## Phase Details

### Phase 1: Foundation and Locale Bootstrap
**Goal**: 建立新的 Wails 工程骨架、feature-based 前端结构、Go contracts、基础测试工具链和语言启动逻辑。  
**Depends on**: Nothing (first phase)  
**Requirements**: [I18N-01, I18N-03]  
**Success Criteria** (what must be TRUE):
  1. App boots through Wails with a modular frontend/backend structure instead of a single giant page orchestrator
  2. The shell can start in `zh-CN` or `en-US` based on system locale when no user override exists
  3. Frontend components consume typed app-service contracts instead of calling raw Wails bindings directly
  4. Base test tooling for Go and frontend runs successfully in the new project
**Plans**: 4 plans

Plans:
- [x] 01-01: Scaffold the Wails project, root wiring, and feature-first frontend directory layout
- [x] 01-02: Define shared DTOs, event payloads, and frontend app-service facades
- [x] 01-03: Bootstrap i18n resources, locale detection, and translation loading
- [x] 01-04: Add baseline Go/frontend test tooling and CI checks for the new skeleton

### Phase 2: Accounts and Safe Switching
**Goal**: 迁移本地账号存储、账户管理界面、进程检测和 `auth.json` 安全切换事务。  
**Depends on**: Phase 1  
**Requirements**: [ACCT-01, ACCT-02, ACCT-03, ACCT-04, AUTH-03, AUTH-04, USAGE-05]  
**Success Criteria** (what must be TRUE):
  1. User can view active and inactive accounts from the new local store in the Wails app
  2. User can rename, delete, and hide account information without corrupting stored identities
  3. User can see current Codex process state before switching accounts
  4. User can switch accounts through a process-aware flow that updates the Codex auth context safely
**Plans**: 3 plans

Plans:
- [x] 02-01: Implement account repository, settings primitives, and account CRUD use cases
- [x] 02-02: Implement process detection, switch transaction, and auth.json writer adapters
- [x] 02-03: Build account list, account card, and switch confirmation flows in the new frontend

### Phase 3: OAuth and Usage Visibility
**Goal**: 完成 OAuth 添加账号链路、取消/恢复语义、token refresh 和 usage 展示。  
**Depends on**: Phase 2  
**Requirements**: [AUTH-01, AUTH-02, USAGE-01, USAGE-02, USAGE-03, USAGE-04]  
**Success Criteria** (what must be TRUE):
  1. User can add a new account through ChatGPT OAuth and recover cleanly from cancel/timeout cases
  2. User can refresh usage for one account or all accounts and see 5-hour and weekly data when available
  3. User sees localized fallback states when usage is unavailable or unsupported
  4. OAuth, refresh, and usage adapters are isolated from the UI layer and covered by tests
**Plans**: 3 plans

Plans:
- [x] 03-01: Implement OAuth callback server, token refresh, and account creation services
- [x] 03-02: Implement usage adapters, retry/refresh handling, and result normalization
- [x] 03-03: Build add-account OAuth flow and usage presentation in the frontend

### Phase 4: Warmup Automation
**Goal**: 迁移 manual warm-up、scheduled warm-up、错过补跑与结果事件反馈。  
**Depends on**: Phase 3  
**Requirements**: [WARM-01, WARM-02, WARM-03, WARM-04, WARM-05]  
**Success Criteria** (what must be TRUE):
  1. User can warm a single account or all accounts from the new UI
  2. User can configure daily scheduled warm-ups for selected accounts at a local time
  3. User is prompted to catch up a missed scheduled run later the same day
  4. Warm-up results arrive in the UI through localized status feedback
**Plans**: 3 plans

Plans:
- [ ] 04-01: Implement warm-up service adapters and single/all warm-up flows
- [ ] 04-02: Implement scheduler, local-time persistence, and missed-run recovery logic
- [ ] 04-03: Implement warm-up events, UI configuration, and localized feedback flows

### Phase 5: Backup and Preference Management
**Goal**: 完成应用级 slim/full 备份、安全模式、语言偏好持久化和设置页闭环。  
**Depends on**: Phase 4  
**Requirements**: [BACK-01, BACK-02, BACK-03, BACK-04, BACK-05, I18N-04]  
**Success Criteria** (what must be TRUE):
  1. User can export and import slim backups without overwriting existing accounts unexpectedly
  2. User can export and import full encrypted backups through the configured keychain/passphrase flow
  3. User can choose and persist backup security mode from settings
  4. User can manually switch language in settings and the preference survives restart
**Plans**: 3 plans

Plans:
- [ ] 05-01: Implement slim/full backup domain logic and compatibility decision boundaries
- [ ] 05-02: Implement security mode persistence, keychain integration, and full-backup UX flows
- [ ] 05-03: Implement settings page, locale override persistence, and settings state synchronization

### Phase 6: Localization Completion and Release Readiness
**Goal**: 完整补齐双语覆盖、localized backend messaging、功能对齐回归、CI/release hardening。  
**Depends on**: Phase 5  
**Requirements**: [AUTH-05, I18N-02, I18N-05, QUAL-01, QUAL-02]  
**Success Criteria** (what must be TRUE):
  1. User sees localized shell, cards, modals, forms, toasts, and backend-driven statuses across all core flows
  2. User sees localized success/failure feedback for account add and account switch flows
  3. Automated tests cover the critical desktop flows that define feature parity
  4. Supported packaged builds can be produced through the release pipeline
**Plans**: 3 plans

Plans:
- [ ] 06-01: Complete localized message mapping and full UI copy coverage sweep
- [ ] 06-02: Add parity regression tests across Go services, frontend behaviors, and critical end-to-end flows
- [ ] 06-03: Harden CI, packaging, and release verification for supported platforms

## Progress

**Execution Order:**
Phases execute in numeric order: 1 → 2 → 3 → 4 → 5 → 6

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Foundation and Locale Bootstrap | 4/4 | Complete | 2026-03-11 |
| 2. Accounts and Safe Switching | 3/3 | Complete | 2026-03-11 |
| 3. OAuth and Usage Visibility | 3/3 | Complete | 2026-03-11 |
| 4. Warmup Automation | 0/3 | Not started | - |
| 5. Backup and Preference Management | 0/3 | Not started | - |
| 6. Localization Completion and Release Readiness | 0/3 | Not started | - |
