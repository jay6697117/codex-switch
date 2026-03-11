# Requirements: Codex Switch

**Defined:** 2026-03-11
**Core Value:** 本地、安全、可预期地管理和切换多个 Codex 账号，同时把原项目的隐式桌面行为抽成清晰、可测试、可国际化的前后端契约

## v1 Requirements

### Accounts

- [ ] **ACCT-01**: User can view the active account and all other locally stored accounts in the desktop app
- [ ] **ACCT-02**: User can rename an existing account without breaking the stored account identity
- [ ] **ACCT-03**: User can delete an existing account and the app selects a valid fallback active account when needed
- [ ] **ACCT-04**: User can hide and reveal sensitive account display information in the UI

### Auth & Switching

- [ ] **AUTH-01**: User can add a new account through ChatGPT OAuth browser login
- [ ] **AUTH-02**: User can cancel or recover from an interrupted OAuth login without leaving broken pending state
- [ ] **AUTH-03**: User can switch the active account and the app updates the Codex CLI auth context on disk
- [ ] **AUTH-04**: User receives a safe confirmation flow when Codex processes are already running before a switch
- [ ] **AUTH-05**: User sees localized success and failure feedback for account add and account switch flows

### Usage

- [ ] **USAGE-01**: User can view 5-hour usage data for supported accounts
- [ ] **USAGE-02**: User can view weekly usage data for supported accounts
- [ ] **USAGE-03**: User can refresh usage for one account or all accounts on demand
- [ ] **USAGE-04**: User sees a localized fallback state when usage data is unavailable or unsupported
- [ ] **USAGE-05**: User can see whether foreground or background Codex processes are currently running

### Warmup

- [ ] **WARM-01**: User can trigger a warm-up for a single account
- [ ] **WARM-02**: User can trigger a warm-up for all available accounts
- [ ] **WARM-03**: User can schedule a daily warm-up at a chosen local time for selected accounts
- [ ] **WARM-04**: User is prompted to catch up a missed scheduled warm-up later the same day
- [ ] **WARM-05**: User sees localized result feedback after manual or scheduled warm-up completes

### Backup & Security

- [ ] **BACK-01**: User can export a slim text backup of accounts
- [ ] **BACK-02**: User can import a slim text backup without overwriting existing accounts of the same name
- [ ] **BACK-03**: User can export a full encrypted backup file using the configured security mode
- [ ] **BACK-04**: User can import a full encrypted backup file and complete the required passphrase or keychain flow
- [ ] **BACK-05**: User can choose and persist a backup security mode before using full backups

### Internationalization & Settings

- [ ] **I18N-01**: User can use the application in `zh-CN` or `en-US`
- [ ] **I18N-02**: User sees localized text across the shell, account cards, modals, forms, empty states, and toast/status feedback
- [ ] **I18N-03**: User gets the initial language from system locale on first launch when no manual preference exists
- [ ] **I18N-04**: User can manually switch language in settings and the app persists that preference across restarts
- [ ] **I18N-05**: User sees backend-originated errors and statuses through localized message keys instead of raw English strings

### Quality & Delivery

- [ ] **QUAL-01**: User-critical flows are protected by automated Go service tests, frontend tests, and targeted end-to-end regression checks
- [ ] **QUAL-02**: User can install and run packaged desktop builds for the supported operating systems defined by the release workflow

## v2 Requirements

### Platform Enhancements

- **PLAT-01**: User can keep the app available from the system tray without leaving the main window open
- **PLAT-02**: User can use a dedicated migration assistant for old backup formats and cross-version compatibility checks
- **PLAT-03**: User can choose a third language beyond `zh-CN` and `en-US`

## Out of Scope

| Feature | Reason |
|---------|--------|
| `Add Account > Import File` / single `auth.json` import | User explicitly removed this entry from v1 scope |
| Cloud sync or shared account pools | Conflicts with the local single-user desktop-tool positioning |
| More than two locales in v1 | Would dilute the required zh/en quality bar |
| Web/SaaS deployment shape | Current scope is native desktop only |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| ACCT-01 | Phase 2 | Pending |
| ACCT-02 | Phase 2 | Pending |
| ACCT-03 | Phase 2 | Pending |
| ACCT-04 | Phase 2 | Pending |
| AUTH-01 | Phase 3 | Pending |
| AUTH-02 | Phase 3 | Pending |
| AUTH-03 | Phase 2 | Pending |
| AUTH-04 | Phase 2 | Pending |
| AUTH-05 | Phase 6 | Pending |
| USAGE-01 | Phase 3 | Pending |
| USAGE-02 | Phase 3 | Pending |
| USAGE-03 | Phase 3 | Pending |
| USAGE-04 | Phase 3 | Pending |
| USAGE-05 | Phase 2 | Pending |
| WARM-01 | Phase 4 | Pending |
| WARM-02 | Phase 4 | Pending |
| WARM-03 | Phase 4 | Pending |
| WARM-04 | Phase 4 | Pending |
| WARM-05 | Phase 4 | Pending |
| BACK-01 | Phase 5 | Pending |
| BACK-02 | Phase 5 | Pending |
| BACK-03 | Phase 5 | Pending |
| BACK-04 | Phase 5 | Pending |
| BACK-05 | Phase 5 | Pending |
| I18N-01 | Phase 1 | Pending |
| I18N-02 | Phase 6 | Pending |
| I18N-03 | Phase 1 | Pending |
| I18N-04 | Phase 5 | Pending |
| I18N-05 | Phase 6 | Pending |
| QUAL-01 | Phase 6 | Pending |
| QUAL-02 | Phase 6 | Pending |

**Coverage:**
- v1 requirements: 31 total
- Mapped to phases: 31
- Unmapped: 0 ✓

---
*Requirements defined: 2026-03-11*
*Last updated: 2026-03-11 after roadmap creation*
