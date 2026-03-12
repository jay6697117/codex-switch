# 06-03 Summary

## Outcome

06-03 的实现层已经完成。本轮把 macOS release 所需的版本注入、Universal 构建脚本、独立 release workflow、release 文档和 packaged-app smoke checklist 全部落到了仓库里，并且完成了本地构建与自动化验证。当前仍未把 `QUAL-02` 标记为关闭，因为真实的 signed/notarized DMG、GitHub Release draft 和 packaged-app smoke 还需要外部 secrets 与人工验证。

## Delivered

- 新增统一 build metadata：
  - `internal/buildinfo/buildinfo.go`
  - backend bootstrap version 改为 build-time injectable
  - usage / warmup HTTP client 的 `User-Agent` 改为复用统一版本源
- 更新 macOS release metadata：
  - `wails.json` 增加 `info.companyName` / `productName` / `productVersion`
  - `build/darwin/Info.plist` 与 `Info.dev.plist` 统一为 release bundle identifier
- 新增 release build script：
  - `scripts/build_macos_release.sh`
  - 在构建期注入 `wails.json.info.productVersion`
  - 使用 `VITE_APP_VERSION` 和 Go `ldflags` 注入统一版本
  - 本地已验证可生成 universal app
- 新增独立 macOS release workflow：
  - `.github/workflows/macos-release.yml`
  - 支持 `workflow_dispatch` 与 `v*` tag push
  - 支持 universal build、DMG、checksum、draft release
  - 在 secrets 齐备时执行 `codesign -> notarytool submit -> staple -> verify`
- 新增 release 文档：
  - `docs/release/macos-release.md`
  - `docs/release/macos-packaged-smoke.md`
- frontend 开发态版本默认值同步为 `0.1.0-dev`

## Verification

- `go test ./internal/bootstrap ./...`
- `cd frontend && npx vitest run src/lib/wails/bridge.test.ts`
- `go test ./...`
- `cd frontend && npm run typecheck`
- `cd frontend && npm test`
- `cd frontend && npm run e2e`
- `wails build -clean`
- `APP_VERSION=0.1.0-dev bash scripts/build_macos_release.sh`

## Notes

- 真实签名、公证和 GitHub Release draft 仍依赖以下外部条件：
  - Apple signing / notarization secrets
  - GitHub Actions workflow 实际执行
  - 真实 DMG 产物上的 packaged-app manual smoke
- 因为上述外部验证尚未发生，`QUAL-02` 继续保持未关闭状态
- 06-03 当前应视为 `implementation ready, external verification pending`
