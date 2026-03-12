---
phase: 6
slug: localization-completion-and-release-readiness
status: draft
nyquist_compliant: true
wave_0_complete: true
created: 2026-03-12
---

# Phase 6 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | `go test` + `vitest` + `playwright` + `wails build` |
| **Config file** | `.github/workflows/ci.yml`, `frontend/package.json`, `frontend/playwright.config.ts`, `wails.json` |
| **Quick run command** | `go test ./... && (cd frontend && npm run typecheck)` |
| **Full suite command** | `go test ./... && (cd frontend && npm run typecheck && npm test && npm run e2e) && wails build -clean` |
| **Estimated runtime** | ~90 seconds |

---

## Sampling Rate

- **After every task commit:** Run `go test ./... && (cd frontend && npm run typecheck)`
- **After every plan wave:** Run `go test ./... && (cd frontend && npm run typecheck && npm test && npm run e2e) && wails build -clean`
- **Before `$gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** 90 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 06-01-01 | 01 | 1 | I18N-02 | unit | `cd frontend && npm test` | ✅ | ⬜ pending |
| 06-01-02 | 01 | 1 | I18N-05 | unit | `go test ./... && (cd frontend && npm test)` | ✅ | ⬜ pending |
| 06-01-03 | 01 | 1 | AUTH-05, I18N-02 | integration | `cd frontend && npm test` | ✅ | ⬜ pending |
| 06-02-01 | 02 | 2 | QUAL-01 | unit | `go test ./...` | ✅ | ✅ green |
| 06-02-02 | 02 | 2 | QUAL-01, I18N-02 | component | `cd frontend && npm test` | ✅ | ✅ green |
| 06-02-03 | 02 | 2 | QUAL-01, AUTH-05 | e2e | `cd frontend && npm run e2e` | ✅ | ✅ green |
| 06-03-01 | 03 | 3 | QUAL-02 | build | `gh workflow run <macos-release-workflow> --ref <release-ref>` | ❌ W0 | ⬜ pending |
| 06-03-02 | 03 | 3 | QUAL-02 | workflow | `gh run watch <release-run-id>` | ❌ W0 | ⬜ pending |
| 06-03-03 | 03 | 3 | QUAL-02, QUAL-01 | artifact | `gh release download <tag> --pattern '*.dmg' --pattern 'checksums.txt' && shasum -a 256 -c checksums.txt` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- Existing Go / frontend / Playwright infrastructure covers 06-01 and 06-02.
- `QUAL-02` release infrastructure is intentionally delivered in 06-03:
  - macOS release workflow
  - signed/notarized universal artifact build
  - release asset publication and checksum verification
  - packaged-app smoke checklist

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Signed and notarized DMG installs cleanly on macOS and launches without Gatekeeper friction | QUAL-02 | CI can build and notarize, but final install/open experience still needs human confirmation on a real packaged artifact | Download the draft release DMG, install the app on a clean macOS machine, open it from Finder, confirm first launch succeeds and primary shell sections render |
| Release asset completeness for the public GitHub Release | QUAL-02 | Automated upload can succeed while release notes, checksums, or upgrade instructions remain incomplete | Inspect the draft GitHub Release and confirm DMG, checksum file, install/upgrade notes, and expected version tag are all present before publish |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references
- [x] No watch-mode flags
- [x] Feedback latency < 90s
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
