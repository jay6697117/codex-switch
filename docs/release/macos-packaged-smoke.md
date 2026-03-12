# macOS Packaged Smoke Checklist

这个清单用于验证真实 DMG 产物，而不是开发态 `wails dev` 或单纯的 `wails build -clean` 输出。

## Test Metadata

- Release tag:
- Build version shown in app:
- Tester:
- Test date:
- Machine:
- macOS version:
- Result: `pass | fail | blocked`

## Installation

1. 下载对应 release draft 中的 DMG。
2. 校验 `checksums.txt` 与下载的 DMG 是否一致。
3. 打开 DMG，并将 `Codex Switch.app` 拖入 `Applications`。
4. 从 `Applications` 启动，而不是直接从挂载卷内启动。

## First Launch and Gatekeeper

1. 首次通过 Finder 打开应用。
2. 确认 Gatekeeper 没有阻断已公证产物。
3. 如果出现系统提示，记录完整文案与截图。

## Shell Readiness

1. 主窗口成功打开，没有白屏或崩溃。
2. Hero 区显示产品名与版本。
3. `Accounts` section 正常渲染。
4. `Warmup` section 正常渲染。
5. `Settings` section 正常渲染。

## Core Interactive Checks

1. 切换语言后，主界面立即切换为目标语言。
2. 重启应用后，语言偏好仍然保持。
3. 打开 backup/settings 相关 modal，没有混杂语言或占位文案。
4. 打开 Add Account modal，没有回归 `Import File` 入口。

## Version Consistency

1. app 内显示版本与 release tag 一致。
2. DMG 文件名与 release tag 一致。
3. Release notes 中的版本与产物版本一致。

## Notes

- Blockers:
- Unexpected dialogs:
- Localization issues:
- Follow-up actions:
