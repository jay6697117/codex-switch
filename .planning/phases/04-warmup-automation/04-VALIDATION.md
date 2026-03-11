---
phase: 4
slug: warmup-automation
status: draft
nyquist_compliant: true
wave_0_complete: true
created: 2026-03-11
---

# Phase 4 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | `go test` + `vitest` + `playwright` |
| **Config file** | `frontend/package.json`, `frontend/playwright.config.ts`, repo `go test` conventions |
| **Quick run command** | `go test ./... && (cd frontend && npm run typecheck)` |
| **Full suite command** | `go test ./... && (cd frontend && npm run typecheck && npm test && npm run e2e) && wails build -clean` |
| **Estimated runtime** | ~20 seconds |

---

## Sampling Rate

- **After every task commit:** Run `go test ./... && (cd frontend && npm run typecheck)`
- **After every plan wave:** Run `go test ./... && (cd frontend && npm run typecheck && npm test && npm run e2e) && wails build -clean`
- **Before `$gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** 20 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 04-01-01 | 01 | 1 | WARM-01 | unit | `go test ./...` | ✅ | ⬜ pending |
| 04-01-02 | 01 | 1 | WARM-01, WARM-02 | contract | `go test ./... && (cd frontend && npm run typecheck)` | ✅ | ⬜ pending |
| 04-01-03 | 01 | 1 | WARM-01, WARM-02 | component | `cd frontend && npm test` | ✅ | ⬜ pending |
| 04-02-01 | 02 | 2 | WARM-03 | unit | `go test ./...` | ✅ | ⬜ pending |
| 04-02-02 | 02 | 2 | WARM-03 | unit | `go test ./...` | ✅ | ⬜ pending |
| 04-02-03 | 02 | 2 | WARM-03 | component | `cd frontend && npm test` | ✅ | ⬜ pending |
| 04-03-01 | 03 | 3 | WARM-05 | component | `cd frontend && npm test` | ✅ | ⬜ pending |
| 04-03-02 | 03 | 3 | WARM-04 | component | `cd frontend && npm test` | ✅ | ⬜ pending |
| 04-03-03 | 03 | 3 | WARM-04, WARM-05 | e2e | `cd frontend && npm run e2e` | ✅ | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

Existing infrastructure covers all phase requirements.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| DST / local-clock boundary sanity for next-run display | WARM-03 | Timezone and DST edge cases are cumbersome to cover end-to-end in desktop packaging | Set local schedule near a DST boundary, inspect `Next run` before and after clock/date transition |
| Packaged app receives scheduled result events while open | WARM-05 | Playwright smoke covers shell logic, but not the packaged Wails event loop | Run packaged app, trigger a fake or real scheduled event path, verify localized feedback appears |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references
- [x] No watch-mode flags
- [x] Feedback latency < 20s
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
