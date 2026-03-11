# Architecture

**Analysis Date:** 2026-03-11

## Pattern Overview

**Overall:** React + Tauri desktop monolith with native command bridge

**Key Characteristics:**
- Single desktop window with one page orchestrator in `codex-switcher-origin/src/App.tsx`
- Native backend exposed as Tauri commands from `codex-switcher-origin/src-tauri/src/lib.rs`
- File-based persistence under the user home directory
- Event-driven background scheduler for daily warmups

## Layers

**Frontend Presentation Layer:**
- Purpose: Render account lists, modals, toasts, and configuration flows
- Contains: `codex-switcher-origin/src/App.tsx`, `codex-switcher-origin/src/components/*.tsx`, `codex-switcher-origin/src/App.css`
- Depends on: frontend hook layer, Tauri API packages, browser APIs
- Used by: desktop window runtime

**Frontend Command Adapter Layer:**
- Purpose: Convert UI actions into Tauri `invoke` calls and normalize returned state
- Contains: `codex-switcher-origin/src/hooks/useAccounts.ts`, `codex-switcher-origin/src/types/index.ts`
- Depends on: `@tauri-apps/api/core`
- Used by: `src/App.tsx` and modal/card components

**Native Command Layer:**
- Purpose: Define the frontend/backend API surface
- Contains: `codex-switcher-origin/src-tauri/src/commands/account.rs`, `oauth.rs`, `process.rs`, `usage.rs`
- Depends on: auth, API, scheduler, and type modules
- Used by: Tauri invoke handler in `codex-switcher-origin/src-tauri/src/lib.rs`

**Native Service Layer:**
- Purpose: Implement storage, auth, usage, scheduling, and process control
- Contains: `codex-switcher-origin/src-tauri/src/auth/*.rs`, `codex-switcher-origin/src-tauri/src/api/usage.rs`, `codex-switcher-origin/src-tauri/src/scheduler.rs`
- Depends on: filesystem, HTTP clients, OS process commands, keychain, crypto
- Used by: command layer

## Data Flow

**Interactive UI Command Flow:**
1. User interacts with `codex-switcher-origin/src/App.tsx` or a component such as `src/components/AddAccountModal.tsx`
2. The component calls a hook method from `codex-switcher-origin/src/hooks/useAccounts.ts`
3. The hook sends a Tauri `invoke("...")` request
4. The matching Rust command executes native logic
5. Native services read/write JSON files, call OpenAI/Auth endpoints, or inspect local processes
6. Results return to the hook and update React state
7. `src/App.tsx` re-renders cards, toasts, and modal state

**Scheduled Warmup Flow:**
1. `codex-switcher-origin/src-tauri/src/lib.rs` spawns the scheduler during app setup
2. `codex-switcher-origin/src-tauri/src/scheduler.rs` polls every 30 seconds
3. Scheduler reads persisted settings and account store
4. Eligible account IDs are warmed through `commands::warmup_accounts_by_ids`
5. Scheduler emits a `scheduled-warmup-result` event
6. `src/App.tsx` listens to the event and updates UI feedback

**State Management:**
- Persistent state: JSON files under `~/.codex-switcher` and `~/.codex`
- In-memory state: React component state + Tauri runtime state for scheduler session start
- No centralized frontend store; `src/App.tsx` is the effective UI state root

## Key Abstractions

**StoredAccount / AccountsStore:**
- Purpose: Canonical account persistence model
- Examples: `StoredAccount`, `AccountsStore`, `AuthData` in `codex-switcher-origin/src-tauri/src/types.rs`
- Pattern: Serializable domain objects

**Command Boundary:**
- Purpose: Stable bridge between frontend and native backend
- Examples: `list_accounts`, `switch_account`, `start_login`, `refresh_all_accounts_usage`
- Pattern: Thin command wrapper around service modules

**System Service Modules:**
- Purpose: Isolate side effects by domain
- Examples: `auth/storage.rs`, `auth/switcher.rs`, `auth/oauth_server.rs`, `api/usage.rs`, `scheduler.rs`
- Pattern: Module-level services rather than instantiated classes

## Entry Points

**Frontend Entry:**
- Location: `codex-switcher-origin/src/main.tsx`
- Triggers: Tauri window loads the React bundle
- Responsibilities: Mount `App` and load styles

**Native Entry:**
- Location: `codex-switcher-origin/src-tauri/src/main.rs`
- Triggers: Tauri desktop binary starts
- Responsibilities: Call `codex_switcher_lib::run()`

**Tauri Runtime Assembly:**
- Location: `codex-switcher-origin/src-tauri/src/lib.rs`
- Triggers: Native bootstrap
- Responsibilities: Register plugins, scheduler state, and command handlers

## Error Handling

**Strategy:** Service modules return `anyhow::Result`; Tauri commands stringify errors for the frontend; the frontend logs and either throws or turns failures into local UI state

**Patterns:**
- Rust command boundaries use `map_err(|e| e.to_string())`
- Frontend hook methods either rethrow or `console.error` and continue
- There is no typed cross-boundary error code model

## Cross-Cutting Concerns

**Logging:**
- Mostly ad-hoc `println!` in Rust and `console.error` in React

**Validation:**
- Frontend validates user input in modal handlers
- Native code validates file formats, account uniqueness, time strings, and encryption payloads

**Authentication:**
- ChatGPT OAuth with PKCE and token refresh
- API-key path for warm-up and import/export compatibility

---
*Architecture analysis: 2026-03-11*
*Update when major patterns change*
