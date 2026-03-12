---
phase: 04-warmup-automation
plan: 02
subsystem: warmup
tags: [go, wails, react, typescript, scheduler, settings, i18n]
requires:
  - phase: 04-warmup-automation
    provides: Manual warm-up domain service, normalized result contracts, and account-shell warm-up actions
provides:
  - Persisted global daily warm-up schedule with derived status snapshots
  - Go scheduler runtime with same-day missed-run and completion semantics
  - Dedicated Warmup section and modal for schedule configuration through typed Wails facades
affects: [04-03, scheduler, settings, shell, warmup, i18n]
tech-stack:
  added: []
  patterns:
    - schedule persistence stores only minimal user intent and derives runtime status on read
    - shell-level data sharing passes account snapshots upward once and reuses them across feature sections
key-files:
  created:
    - frontend/src/features/warmup/WarmupSection.tsx
    - frontend/src/features/warmup/WarmupSection.test.tsx
  modified:
    - app.go
    - internal/settings/warmup_schedule.go
    - internal/scheduler/runtime.go
    - internal/contracts/warmup_schedule.go
    - internal/contracts/warmup_runtime.go
    - frontend/src/app/AppShell.tsx
    - frontend/src/features/accounts/AccountSection.tsx
    - frontend/src/lib/wails/bridge.ts
    - frontend/src/lib/wails/services.ts
    - frontend/src/styles/global.css
key-decisions:
  - "LoadWarmupScheduleStatus reads through the scheduler runtime so `nextRunLocalIso` and `missedRunToday` stay aligned with later prompt behavior."
  - "WarmupSection reuses the latest account snapshot from AppShell instead of issuing a second `accounts.load()` request."
  - "Schedule configuration validates account selection inline and keeps missed-run prompt actions out of 04-02."
patterns-established:
  - "Derived scheduler status crosses the Wails boundary as a stable snapshot, while persistence remains minimal and backend-owned."
  - "Feature containers can publish shared domain snapshots upward through lightweight callbacks without coupling sibling sections."
requirements-completed: [WARM-03]
duration: multi-session
completed: 2026-03-12
---

# Phase 4: Warmup Automation Summary

**Daily warm-up scheduling now has end-to-end persistence, runtime semantics, and a dedicated configuration area in the shell**

## Performance

- **Duration:** Multi-session
- **Started:** 2026-03-12T01:38:29+08:00
- **Completed:** 2026-03-12T10:14:54+08:00
- **Tasks:** 3
- **Files modified:** 24

## Accomplishments

- Added settings persistence for one global daily warm-up schedule, including local time, selected account IDs, same-day completion markers, and derived status snapshots.
- Implemented the Go scheduler runtime so scheduled execution, missed-run detection, and suppression/completion semantics are available before any prompt UI is added.
- Built a dedicated Warmup section in the Wails shell with typed schedule load/save facades, localized summary text, inline validation, and account multi-select controls.

## Task Commits

Each task was committed atomically:

1. **Task 1: Schedule persistence and derived status** - `9a9182c` (`feat`)
2. **Task 2: Scheduler runtime and missed-run semantics** - `f9ebc4e` (`feat`)
3. **Task 3: Warmup schedule UI and typed facades** - `7409972` (`feat`)

## Files Created/Modified

- `internal/settings/warmup_schedule.go` - Warm-up schedule persistence, validation, and derived snapshot helpers.
- `internal/scheduler/runtime.go` - Local-clock scheduler runtime, session anchor logic, and missed-run state handling.
- `internal/contracts/warmup_schedule.go` - Shared Wails-safe schedule and status DTOs.
- `internal/contracts/warmup_runtime.go` - Runtime event and status payloads needed by later prompt work.
- `app.go` - Wails bindings for loading and saving schedule status through the runtime-aware backend path.
- `frontend/src/features/warmup/WarmupSection.tsx` - Dedicated Warmup summary card and schedule configuration dialog.
- `frontend/src/app/AppShell.tsx` - Shell-level account snapshot sharing between account and warmup sections.
- `frontend/src/features/accounts/AccountSection.tsx` - Snapshot publish callback used to share the latest accounts with sibling features.
- `frontend/src/lib/wails/bridge.ts` - Typed bridge unwrap helpers for warm-up schedule load/save.
- `frontend/src/lib/wails/services.ts` - App-service facade surface for schedule status and schedule persistence.
- `frontend/src/i18n/resources/en-US/warmup.ts` and `frontend/src/i18n/resources/zh-CN/warmup.ts` - Localized schedule summary, dialog, and action copy.
- `frontend/src/styles/global.css` - Dedicated layout and dialog styling for the Warmup feature.

## Decisions Made

- Schedule persistence keeps only canonical user intent; derived fields such as `validAccountIds`, `missedRunToday`, and `nextRunLocalIso` are recomputed on load.
- Warmup schedule status is served through the scheduler runtime instead of the raw settings service so later missed-run prompt behavior can consume the same semantics.
- The shell shares account snapshots upward once and passes them into the Warmup feature, avoiding duplicated account fetches and stale selection lists.

## Deviations from Plan

None. Task 3 filled the planned UI/facade gap without adding 04-03 scope such as missed-run prompts or runtime feedback actions.

## Issues Encountered

- `WarmupSection` originally formatted `nextRunLocalIso` through `Intl.DateTimeFormat`, which made tests locale-sensitive. Resolved by switching the summary formatter to a stable `YYYY-MM-DD HH:mm` output.
- Existing account-shell tests started failing typecheck after the warmup facade expanded. Resolved by extending the mocked `warmup` service with schedule-specific methods rather than weakening types.

## User Setup Required

None.

## Next Phase Readiness

- 04-03 can now focus strictly on missed-run prompts, localized runtime feedback, and runtime-event delivery because schedule persistence and configuration are already closed.
- Remaining validation concern stays the same: packaged-runtime event delivery and local-clock edge cases still need explicit coverage when prompt wiring lands.

---

*Phase: 04-warmup-automation*
*Completed: 2026-03-12*
