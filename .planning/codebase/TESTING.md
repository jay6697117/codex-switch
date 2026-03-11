# Testing Patterns

**Analysis Date:** 2026-03-11

## Test Framework

**Runner:**
- None detected
- There is no `jest`, `vitest`, `playwright`, `cargo test` module coverage, or dedicated test configuration in the repository root

**Assertion Library:**
- None detected because no automated test harness is committed

**Run Commands:**
```bash
pnpm install             # Install frontend dependencies
pnpm tauri dev           # Manual desktop verification path
pnpm tauri build         # Manual release build verification path
```

## Test File Organization

**Location:**
- No `tests/`, `__tests__/`, `e2e/`, `*.test.*`, or `*.spec.*` files detected

**Naming:**
- No naming convention exists yet because no committed test suite exists

## Test Structure

**Current Reality:**
- Quality assurance appears to rely on manual desktop usage, Tauri dev runs, and release builds
- The README documents build/run instructions only in `codex-switcher-origin/README.md`

**Patterns:**
- Frontend behavior is exercised manually through the single-page UI in `codex-switcher-origin/src/App.tsx`
- Native behavior is exercised indirectly through Tauri command calls

## Mocking

**Framework:**
- None detected

**What is effectively unmocked today:**
- OpenAI/Auth network calls in `codex-switcher-origin/src-tauri/src/api/usage.rs` and `auth/oauth_server.rs`
- Local filesystem writes in `codex-switcher-origin/src-tauri/src/auth/storage.rs` and `auth/settings.rs`
- OS process control in `codex-switcher-origin/src-tauri/src/commands/process.rs`

## Fixtures and Factories

**Test Data:**
- None committed
- The only persistent data model examples live in real runtime structs under `codex-switcher-origin/src-tauri/src/types.rs`

## Coverage

**Requirements:**
- No coverage target detected
- No CI gate enforcing automated tests

**Configuration:**
- No coverage tooling configuration present

## Test Types

**Unit Tests:**
- Missing

**Integration Tests:**
- Missing

**E2E Tests:**
- Missing

## Recommended Gaps To Cover First

**High Priority:**
- Account switch transaction in `codex-switcher-origin/src-tauri/src/commands/account.rs`
- OAuth login start/complete/cancel in `codex-switcher-origin/src-tauri/src/commands/oauth.rs`
- Token refresh fallback and usage retry in `codex-switcher-origin/src-tauri/src/auth/token_refresh.rs` and `api/usage.rs`
- Scheduled warmup date/time logic in `codex-switcher-origin/src-tauri/src/scheduler.rs`
- Full/slim import-export behavior in `codex-switcher-origin/src-tauri/src/commands/account.rs`

**Why this matters for the rewrite:**
- The Go + Wails rebuild should not inherit a “manual-only” confidence model
- These flows define the minimum regression suite for feature parity

---
*Testing analysis: 2026-03-11*
*Update when test patterns change*
