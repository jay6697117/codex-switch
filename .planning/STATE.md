# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-03-11)

**Core value:** 本地、安全、可预期地管理和切换多个 Codex 账号，同时把原项目的隐式桌面行为抽成清晰、可测试、可国际化的前后端契约
**Current focus:** Phase 4 - Warmup Automation

## Current Position

Phase: 4 of 6 (Warmup Automation)
Plan: 0 of 3 in current phase
Status: Phase 3 delivered; ready to start warmup services, scheduler, and UI wiring
Last activity: 2026-03-11 — Completed 03-03 with OAuth-only add-account shell integration and localized usage presentation

Progress: [██████░░░░] 58%

## Performance Metrics

**Velocity:**
- Total plans completed: 11
- Average duration: n/a
- Total execution time: n/a

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| 1 | 4 | n/a | n/a |
| 2 | 3 | n/a | n/a |
| 3 | 3 | n/a | n/a |
| 4 | 0 | n/a | n/a |

**Recent Trend:**
- Last 5 plans: 02-02, 02-03, 03-01, 03-02, 03-03
- Trend: Steady

## Accumulated Context

### Decisions

Decisions are logged in PROJECT.md Key Decisions table.
Recent decisions affecting current work:

- [Init]: Use `Golang + Wails + React/TypeScript` instead of continuing `Tauri + Rust`
- [Init]: Keep core parity with `codex-switcher-origin` but drop `Add Account > Import File`
- [Init]: Treat full bilingual UX as a v1 hard requirement, including backend-originated statuses
- [Phase 2]: Deleting the active account auto-promotes the next available account
- [Phase 2]: Switching while Codex is running requires explicit confirmation and graceful restart handling
- [Phase 2]: Account name/email stay visible by default, with per-account and global masking controls
- [Phase 2]: Account switching rewrites `auth.json` canonically and rolls back on synchronous failure
- [Phase 2]: The Wails shell hosts account cards and blocks switch actions behind a first-class confirmation dialog
- [Phase 3]: Add Account remains OAuth-only and continues to exclude `Import File`
- [Phase 3]: Usage state is stored separately from account snapshots and refreshed explicitly per-account or globally
- [Phase 3]: OAuth browser navigation is triggered through Wails runtime `BrowserOpenURL()`

### Pending Todos

- Plan 04-01: implement warmup adapters, single/all warmup execution, and typed service contracts

### Blockers/Concerns

- Backup compatibility with old origin exports must be decided before Phase 5 implementation starts
- Warmup scheduling still needs a clear policy for catch-up, retry bounds, and foreground feedback in Phase 4

## Session Continuity

Last session: 2026-03-11 23:00 CST
Stopped at: 03-03 implementation complete and verified
Resume file: None
