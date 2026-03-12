---
phase: 04-warmup-automation
plan: 03
subsystem: warmup
tags: [go, wails, react, typescript, runtime-events, e2e, i18n]
requires:
  - phase: 04-warmup-automation
    provides: Manual warm-up domain service, schedule persistence, scheduler runtime, and schedule status snapshots
provides:
  - Runtime-event driven warm-up feedback across manual, scheduled, and missed-run flows
  - Missed-run prompt with `Run Now` and `Skip Today` recovery actions
  - Focused frontend and Playwright coverage for warm-up automation feedback behavior
affects: [phase-4-closeout, shell, warmup, runtime-events, e2e]
tech-stack:
  added: []
  patterns:
    - Wails runtime events are consumed as raw typed payloads, not synthetic envelopes
    - Missed-run recovery updates schedule status via typed facades while toast/recent feedback stays event-driven
key-files:
  created:
    - frontend/src/features/warmup/feedback.ts
    - frontend/src/features/warmup/feedback.test.ts
  modified:
    - app.go
    - internal/contracts/warmup_runtime.go
    - internal/scheduler/runtime.go
    - frontend/src/app/AppShell.tsx
    - frontend/src/features/accounts/AccountSection.tsx
    - frontend/src/features/warmup/WarmupSection.tsx
    - frontend/src/lib/wails/bridge.ts
    - frontend/tests/e2e/shell.smoke.spec.ts
key-decisions:
  - "Runtime events use the raw Wails payload shape, so the shell subscribes directly to `WarmupRuntimeEvent` instead of wrapping events in a synthetic envelope."
  - "Missed-run `Run Now` relies on the scheduler runtime to emit the authoritative background result event; the UI only refreshes schedule status."
  - "Manual warm-up keeps local action-triggered feedback, while scheduled and missed-run feedback comes exclusively from runtime events."
patterns-established:
  - "Feature-local feedback mapping can normalize both synchronous action results and asynchronous runtime events into one shell feedback model."
  - "Playwright smoke stubs runtime event listeners and recovery bindings so desktop event flows stay regression-tested without a live scheduler."
requirements-completed: [WARM-04, WARM-05]
duration: multi-session
completed: 2026-03-12
---

# Phase 4: Warmup Automation Summary

**Warm-up automation is now fully closed: scheduled results, missed-run recovery, and localized feedback all flow through the shell**

## Performance

- **Duration:** Multi-session
- **Started:** 2026-03-12T11:50:15+08:00
- **Completed:** 2026-03-12T11:50:35+08:00
- **Tasks:** 3
- **Files modified:** 19

## Accomplishments

- Wired normalized warm-up feedback into the shell so manual actions, scheduled runs, and catch-up runs all surface localized toast copy and recent-result state.
- Added missed-run recovery bindings and UI: the shell now blocks with `Run Now` and `Skip Today`, updates schedule status through typed facades, and preserves the product rule that ordinary manual warm-up does not consume missed-run state.
- Extended focused Playwright coverage so runtime events, missed-run recovery, OAuth/usage flows, and existing account-shell behaviors are all exercised together.

## Task Commits

Code was committed in two atomic checkpoints:

1. **Task 1: Localized shell feedback and runtime event wiring** - `453c8dd` (`feat`)
2. **Task 2 + Task 3: Missed-run recovery flows and focused e2e coverage** - `2269cac` (`feat`)

## Files Created/Modified

- `internal/contracts/warmup_runtime.go` - Runtime event payload now carries the full typed warm-up result plus completion time.
- `internal/scheduler/runtime.go` - Scheduled and missed-run executions emit the normalized runtime payload used by the shell.
- `app.go` - New Wails bindings expose `DismissMissedRunToday` and `RunMissedWarmupNow`.
- `frontend/src/features/warmup/feedback.ts` - Shared mapping from manual results and runtime events into localized shell feedback.
- `frontend/src/app/AppShell.tsx` - Runtime event subscription and top-level warm-up toast handling.
- `frontend/src/features/accounts/AccountSection.tsx` - Manual warm-up actions now publish the shared feedback model upward to the shell.
- `frontend/src/features/warmup/WarmupSection.tsx` - Recent-result panel plus missed-run prompt and recovery buttons.
- `frontend/src/lib/wails/bridge.ts` and `frontend/src/lib/wails/services.ts` - Typed runtime/recovery facades.
- `frontend/tests/e2e/shell.smoke.spec.ts` - Runtime event and missed-run recovery smoke coverage.

## Decisions Made

- Runtime event callbacks are treated as raw payload listeners because Wails `EventsOn` forwards emitted data directly instead of wrapping it in a `{name, data}` object.
- `RunMissedWarmupNow` returns refreshed schedule status for prompt visibility, but the user-visible success/failure feedback still comes from the runtime event emitted by the scheduler runtime.
- The shell keeps one shared `WarmupShellFeedback` model so AccountSection and WarmupSection can show consistent feedback without duplicating copy logic.

## Deviations from Plan

- Task 2 and Task 3 were committed together because the missed-run prompt UI, recovery facade wiring, and Playwright smoke all shared the same `WarmupSection` and runtime-event test fixtures. The implementation still preserves clear task boundaries in the summary and verification.

## Issues Encountered

- The first Playwright version for scheduled runtime feedback emitted the event before the shell subscription was ready. Resolved by waiting for shell bootstrap UI before dispatching the stubbed runtime event.
- The initial frontend event abstraction assumed a synthetic envelope. Resolved by aligning the facade and tests with the actual Wails raw-payload event behavior.

## User Setup Required

None.

## Next Phase Readiness

- Phase 4 is complete. The next work item is Phase 5 planning and implementation: backup compatibility, security-mode persistence, locale override settings, and the settings page.
- The open concern carried forward is still backup compatibility with origin exports, which should be decided before backup import/export implementation starts.

---

*Phase: 04-warmup-automation*
*Completed: 2026-03-12*
