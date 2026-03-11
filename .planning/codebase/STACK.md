# Technology Stack

**Analysis Date:** 2026-03-11

## Languages

**Primary:**
- TypeScript 5.8.x - React desktop frontend in `codex-switcher-origin/src/`
- Rust 2021 - Tauri desktop backend and system integration in `codex-switcher-origin/src-tauri/src/`

**Secondary:**
- Shell - Local helper script in `codex-switcher-origin/scripts/tauri.sh`
- YAML/JSON - Build, packaging, and config files in `.github/workflows/`, `src-tauri/tauri.conf.json`, and TypeScript config files

## Runtime

**Environment:**
- Node.js 20.x - Frontend development/build runtime in `.github/workflows/build.yml`
- Tauri v2 desktop runtime - Window shell and frontend/backend bridge from `codex-switcher-origin/src-tauri/Cargo.toml`
- Rust stable toolchain - Native build target for macOS, Linux, and Windows in `.github/workflows/build.yml`

**Package Manager:**
- pnpm 9 - CI package manager in `.github/workflows/build.yml`
- npm scripts are still the user-facing entrypoints in `codex-switcher-origin/package.json`
- Lockfiles: `codex-switcher-origin/pnpm-lock.yaml` and `codex-switcher-origin/package-lock.json` are both present

## Frameworks

**Core:**
- React 19.x - UI rendering in `codex-switcher-origin/src/main.tsx` and `codex-switcher-origin/src/App.tsx`
- Vite 7.x - Frontend bundling and dev server in `codex-switcher-origin/vite.config.ts`
- Tailwind CSS v4 - Styling entry via `codex-switcher-origin/src/App.css`
- Tauri 2.x - Desktop command bridge, eventing, packaging, and plugins in `codex-switcher-origin/src-tauri/src/lib.rs`

**Testing:**
- None detected - `codex-switcher-origin/package.json` has no test scripts, and the repo contains no test files

**Build/Dev:**
- TypeScript compiler - `codex-switcher-origin/tsconfig.json`
- `@vitejs/plugin-react` - Vite React integration in `codex-switcher-origin/vite.config.ts`
- `tauri-apps/tauri-action` - Multi-platform release builds in `.github/workflows/build.yml`

## Key Dependencies

**Critical:**
- `@tauri-apps/api` 2.9.1 - Frontend invokes native commands and subscribes to events
- `@tauri-apps/plugin-dialog` 2.5.0 - Native open/save dialogs for import/export and backups
- `reqwest` 0.12 - Rust HTTP client for OAuth, usage, and warmup requests
- `tiny_http` 0.12 - Local callback server for ChatGPT OAuth in `codex-switcher-origin/src-tauri/src/auth/oauth_server.rs`
- `keyring` 3 - OS keychain integration for backup secret storage in `codex-switcher-origin/src-tauri/src/auth/settings.rs`
- `chacha20poly1305` 0.10 + `pbkdf2` 0.12 - Full-backup encryption in `codex-switcher-origin/src-tauri/src/commands/account.rs`

**Infrastructure:**
- `tokio` 1 - Async runtime for network requests and scheduler tasks
- `chrono` 0.4 - Local-time scheduling and timestamps
- `dirs` 6 - Resolves `~/.codex-switcher` and `~/.codex`
- `uuid` 1 - Account identifiers in `codex-switcher-origin/src-tauri/src/types.rs`

## Configuration

**Environment:**
- No `.env`-driven app config detected
- `CODEX_HOME` can override the target Codex auth directory in `codex-switcher-origin/src-tauri/src/auth/switcher.rs`
- Most behavior is configured through persisted JSON files in the user home directory

**Build:**
- `codex-switcher-origin/package.json` - Frontend scripts and dependencies
- `codex-switcher-origin/vite.config.ts` - Vite/Tauri dev-server behavior
- `codex-switcher-origin/src-tauri/Cargo.toml` - Native dependencies
- `codex-switcher-origin/src-tauri/tauri.conf.json` - Desktop window and bundle config
- `.github/workflows/build.yml` - Release build pipeline

## Platform Requirements

**Development:**
- macOS/Linux/Windows supported through Tauri targets
- Rust toolchain is required; `codex-switcher-origin/scripts/tauri.sh` bootstraps `cargo` lookup
- Linux builds require `libwebkit2gtk-4.1-dev`, `libappindicator3-dev`, `librsvg2-dev`, and `patchelf` per `.github/workflows/build.yml`

**Production:**
- Bundled as native desktop installers via Tauri release bundles
- Shipping targets include `.dmg`, `.deb`, `.AppImage`, `.exe`, and `.msi`

---
*Stack analysis: 2026-03-11*
*Update after major dependency changes*
