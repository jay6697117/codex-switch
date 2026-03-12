# macOS Release Workflow

本项目的公开发布目标是 `macOS Universal DMG`，通过 GitHub Actions 生成 `.app`、`.dmg`、`checksums.txt` 和 GitHub Release draft。签名与公证使用 Apple 的 `notarytool`，认证方式固定为 `App Store Connect API Key`。

## Release Outputs

- `codex-switch-<version>.dmg`
- `checksums.txt`
- GitHub Release draft
- Release notes with install and upgrade guidance

## Workflow Triggers

发布 workflow 位于 `.github/workflows/macos-release.yml`，支持两种触发方式：

1. 推送 `v*` tag，例如 `v0.1.0`
2. 手动 `workflow_dispatch`

手动触发时可提供 `release_version`，格式不带 `v` 前缀。

## Secret Contract

release workflow 固定依赖以下 secrets：

- `APPLE_CERTIFICATE_P12_BASE64`
- `APPLE_CERTIFICATE_PASSWORD`
- `APPLE_SIGNING_IDENTITY`
- `APPLE_TEAM_ID`
- `APPLE_NOTARY_KEY_ID`
- `APPLE_NOTARY_ISSUER_ID`
- `APPLE_NOTARY_PRIVATE_KEY`

这些 secret 缺失时，workflow 仍会完成 universal build、DMG 和 checksum 生成，并创建/更新 draft release，但不会执行真正的 codesign、公证、staple 或 Gatekeeper 验证。

## Version Injection

版本是 build-time source of truth，不再依赖源码里的固定字符串：

- Go backend uses `-ldflags "-X codex-switch/internal/buildinfo.Version=<version>"`
- Frontend fallback bootstrap uses `VITE_APP_VERSION=<version>`
- `wails.json` 的 `info.productVersion` 由 `scripts/build_macos_release.sh` 在构建期临时注入

本地非 release 构建默认回退为 `0.1.0-dev`。

## Local Verification Boundary

在没有 release secrets 的本地环境里，可验证这些事项：

- `go test ./...`
- `cd frontend && npm run typecheck`
- `cd frontend && npm test`
- `cd frontend && npm run e2e`
- `wails build -clean`
- `APP_VERSION=0.1.0-dev bash scripts/build_macos_release.sh`

这些检查只能证明构建链路与产物生成逻辑可用，不能证明签名、公证和 GitHub draft release 已真正成功。

## Release Assets

GitHub Release draft 必须至少包含：

- DMG
- checksum 文件
- install notes
- upgrade notes

发布前还必须执行 packaged-app smoke checklist，见 `docs/release/macos-packaged-smoke.md`。
