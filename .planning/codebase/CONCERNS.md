# Codebase Concerns

**Analysis Date:** 2026-03-11

## Tech Debt

**Single-page orchestration in `codex-switcher-origin/src/App.tsx`:**
- Issue: One page owns account list state, process polling, warmup feedback, import/export flows, security onboarding, schedule configuration, and multiple modal lifecycles
- Why: MVP-stage implementation centralized most UI coordination in one file
- Impact: Hard to reuse behavior, easy to introduce coupling during rewrites, difficult to localize or modularize
- Fix approach: Split by feature domain in the new Wails frontend and define explicit backend contracts first

**Thin boundary but implicit protocol:**
- Issue: `codex-switcher-origin/src/hooks/useAccounts.ts` mirrors many backend commands but there is no typed error code or command-domain separation
- Why: Fast iteration through direct `invoke` wrappers
- Impact: The current frontend/native protocol is discoverable only from code, not a defined contract
- Fix approach: Define stable Go service interfaces and localized error/status payloads before implementing Wails UI flows

## Known Bugs / Risky Behaviors

**Account switching can leave partial side effects:**
- Symptoms: Process stop/restart, auth rewrite, and active-account update happen in one user action
- Trigger: Any failure in `switch_account` around process control or file writes
- Workaround: None in code; caller only logs failures
- Root cause: Multi-step transaction in `codex-switcher-origin/src-tauri/src/commands/account.rs` + `commands/process.rs` + `auth/switcher.rs`

**Scheduled warmup timing is implicit and time-sensitive:**
- Symptoms: Potential duplicate run, missed run, or DST/local-time edge-case drift
- Trigger: App restart timing, local clock changes, or daylight saving transitions
- Workaround: Manual “run now” prompt in the UI
- Root cause: Polling/date comparison logic in `codex-switcher-origin/src-tauri/src/scheduler.rs`

## Security Considerations

**Verbose native logging near sensitive flows:**
- Risk: OAuth and usage modules log account names, URLs, retry behavior, and partial auth-flow context
- Current mitigation: No structured redaction layer
- Recommendations: Introduce log levels, redact tokens/secrets, and disable verbose logs by default in the rewrite

**Static fallback secret for “less secure” backup mode:**
- Risk: `FULL_PRESET_PASSPHRASE` in `codex-switcher-origin/src-tauri/src/commands/account.rs` means one built-in secret can decrypt all backups generated in that mode
- Current mitigation: Users may choose keychain or custom passphrase instead
- Recommendations: Remove or quarantine compatibility-only mode in the Go rewrite

**Unverified JWT claim parsing:**
- Risk: `codex-switcher-origin/src-tauri/src/auth/switcher.rs` and `auth/token_refresh.rs` decode JWT payloads without signature validation
- Current mitigation: Claims are mainly used for display metadata
- Recommendations: Treat decoded claims as display hints only, or add explicit validation if future logic depends on them

## Performance Bottlenecks

**Frequent polling from the desktop app:**
- Problem: `codex-switcher-origin/src/App.tsx` checks Codex processes every 3 seconds and refreshes usage on intervals
- Cause: UI relies on polling instead of event-driven state or adaptive refresh
- Improvement path: Add throttling, visibility-aware refresh, and backend batching in the rewrite

**Sequential warmup / usage fan-out:**
- Problem: `codex-switcher-origin/src-tauri/src/commands/usage.rs` and `api/usage.rs` iterate accounts sequentially
- Cause: Simpler MVP implementation
- Improvement path: Introduce controlled concurrency and backoff rules in the new backend

## Fragile Areas

**`~/.codex/auth.json` rewrite path:**
- Why fragile: It mutates another tool’s live credential file and must coordinate with running processes
- Common failures: Partial switch, stale active account, or mismatch between UI state and Codex runtime state
- Safe modification: Treat switch as an explicit transaction with rollback/confirmation points
- Test coverage: None

**OAuth callback server:**
- Why fragile: Local ports, browser flow, PKCE state, and callback timing all interact
- Common failures: Occupied port, cancelled login, timeout, or state mismatch
- Safe modification: Keep the callback logic isolated and integration-tested
- Test coverage: None

## Dependencies at Risk

**Custom crypto/export format:**
- Risk: Hand-rolled backup format in `codex-switcher-origin/src-tauri/src/commands/account.rs` is tightly coupled to current Rust implementation details
- Impact: Compatibility work is required if the Go rewrite must read old backups
- Migration plan: Define whether the new app preserves `.cswf` compatibility or ships a migration utility

## Missing Critical Features

**Automated regression suite:**
- Problem: There is no committed automated test harness for any critical flow
- Current workaround: Manual runs and visual verification
- Blocks: Safe large-scale refactors, parity verification, and schedule/process edge-case confidence
- Implementation complexity: Medium, but mandatory for the rewrite

## Test Coverage Gaps

**Untested high-risk flows:**
- What's not tested: OAuth completion/cancel, token refresh retry, account switching with running Codex, scheduler date logic, encrypted import/export, slim import reconstruction
- Risk: Regressions can silently break the core value of the app
- Priority: High
- Difficulty to test: Medium to high because flows span filesystem, processes, and external APIs

---
*Concerns audit: 2026-03-11*
*Update as issues are fixed or new ones discovered*
