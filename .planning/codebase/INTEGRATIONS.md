# External Integrations

**Analysis Date:** 2026-03-11

## APIs & External Services

**ChatGPT Usage API:**
- `chatgpt.com` backend API - Account usage and rate-limit data
  - Integration method: REST via `reqwest` in `codex-switcher-origin/src-tauri/src/api/usage.rs`
  - Auth: OAuth access token in `Authorization: Bearer ...`
  - Endpoints used: `GET https://chatgpt.com/backend-api/wham/usage`

**OpenAI API:**
- `api.openai.com` - Warm-up call for API-key accounts
  - Integration method: REST via `reqwest` in `codex-switcher-origin/src-tauri/src/api/usage.rs`
  - Auth: API key in `Authorization: Bearer ...`
  - Endpoints used: `GET https://api.openai.com/v1/models`

**OpenAI Auth:**
- `auth.openai.com` - ChatGPT OAuth login and refresh
  - Integration method: PKCE OAuth flow in `codex-switcher-origin/src-tauri/src/auth/oauth_server.rs` and `codex-switcher-origin/src-tauri/src/auth/token_refresh.rs`
  - Auth: Public client + PKCE verifier + refresh token
  - Endpoints used: `/oauth/authorize`, `/oauth/token`

## Data Storage

**Databases:**
- None - The application is file-based and does not use a relational or embedded database

**Local File Storage:**
- `~/.codex-switcher/accounts.json` - Primary account store in `codex-switcher-origin/src-tauri/src/auth/storage.rs`
- `~/.codex-switcher/settings.json` - App settings and scheduled warmup config in `codex-switcher-origin/src-tauri/src/auth/settings.rs`
- `~/.codex/auth.json` - Active Codex credential target written by `codex-switcher-origin/src-tauri/src/auth/switcher.rs`
- Backup files:
  - Slim text export/import handled in `codex-switcher-origin/src-tauri/src/commands/account.rs`
  - Full encrypted `.cswf` files handled in `codex-switcher-origin/src-tauri/src/commands/account.rs`

**Caching:**
- None - In-memory React state only; no Redis or persistent cache layer

## Authentication & Identity

**Auth Provider:**
- Custom desktop-managed auth over OpenAI credentials
  - ChatGPT OAuth accounts store `id_token`, `access_token`, `refresh_token`, and optional `account_id`
  - API key accounts store `OPENAI_API_KEY`
  - Data model lives in `codex-switcher-origin/src-tauri/src/types.rs`

**OAuth Integrations:**
- OpenAI/ChatGPT OAuth - Sign-in through a browser and local callback
  - Local callback server: `http://localhost:{port}/auth/callback`
  - Default port: `1455`, with random free-port fallback
  - Browser launch via `webbrowser` / frontend open-url helpers

## Monitoring & Observability

**Error Tracking:**
- None - No Sentry, Crashpad, or external error collector detected

**Analytics:**
- None

**Logs:**
- Local stdout/stderr logging only
- Rust debug logging uses `println!` in `codex-switcher-origin/src-tauri/src/auth/oauth_server.rs`, `codex-switcher-origin/src-tauri/src/auth/token_refresh.rs`, and `codex-switcher-origin/src-tauri/src/api/usage.rs`

## CI/CD & Deployment

**Hosting:**
- Not a hosted service; shipped as a native desktop app

**CI Pipeline:**
- GitHub Actions in `codex-switcher-origin/.github/workflows/build.yml`
  - Builds multi-target Tauri bundles
  - Publishes GitHub Releases through `softprops/action-gh-release`
  - Uses only `GITHUB_TOKEN`; no additional external deployment provider detected

## Environment Configuration

**Development:**
- No required app env vars beyond optional `CODEX_HOME`
- Rust, Node.js, pnpm, and Tauri toolchain are required
- Linux requires system WebKit/AppIndicator packages

**Staging:**
- None detected

**Production:**
- Secrets live on the user machine:
  - account JSON files
  - OS keychain entry `com.lampese.codex-switcher / full-file-export-secret`

## Webhooks & Callbacks

**Incoming:**
- Local OAuth callback: `/auth/callback` handled by `tiny_http` in `codex-switcher-origin/src-tauri/src/auth/oauth_server.rs`

**Outgoing:**
- ChatGPT usage polling and token refresh requests
- OpenAI models warm-up requests

---
*Integration audit: 2026-03-11*
*Update when adding/removing external services*
