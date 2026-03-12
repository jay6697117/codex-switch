# 06-02 Requirement-to-Test Matrix

## Scope

06-02 的目标不是新增产品能力，而是把已经交付的核心流提升到 release-gate 级别的显式回归覆盖。以下矩阵把本 phase 负责关闭的 requirement 映射到具体自动化验证。

## Matrix

| Requirement | Coverage | Evidence |
|-------------|----------|----------|
| `AUTH-05` | Go service regression + frontend integration + Playwright shell regression | `internal/auth/token_service_test.go` 覆盖 `auth.account_not_found` / `auth.refresh_failed`；`frontend/src/features/accounts/AccountSection.test.tsx` 覆盖 add/switch success feedback；`frontend/tests/e2e/shell.smoke.spec.ts` 覆盖 switch success banner 与 OAuth add-account success banner |
| `I18N-02` | frontend integration + locale/fallback guard | `frontend/src/features/accounts/AccountSection.test.tsx` 覆盖 `zh-CN` success feedback；`frontend/src/i18n/createAppI18n.test.ts` 覆盖英文 fallback 与 fallback observability；`frontend/src/features/settings/SettingsSection.test.tsx` 覆盖英文 full-backup success copy；`frontend/tests/e2e/shell.smoke.spec.ts` 覆盖中文 switch/add success 与英文 full-backup export success |
| `I18N-05` | i18n guardrails + locale-aware fallback verification | `frontend/src/i18n/resources.guard.test.ts` 覆盖中英文 key-shape parity 与 backend error-code coverage；`frontend/src/i18n/createAppI18n.test.ts` 覆盖 active locale 缺 key 时回退英文并输出可观测 warning |
| `QUAL-01` | Go/Vitest/Playwright parity regression matrix | `go test ./...` 覆盖 auth/switch/backup/warmup/settings service 边界； `cd frontend && npm test` 覆盖 shell/accounts/settings/warmup bridge 与 integration；`cd frontend && npm run e2e` 覆盖 mocked shell 下的核心 user flows |
| `QUAL-02` | Deferred to 06-03 | 06-02 明确不关闭 packaged release gate；真实 signed/notarized DMG、release workflow、checksum 与 packaged-app smoke 保留到 `06-03` |

## Gaps Left for 06-03

- macOS release workflow、签名、公证与 draft GitHub Release 资产验证
- packaged app manual smoke
- release artifact checksum verification
