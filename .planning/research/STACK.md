# Stack Research

**Domain:** 基于 Go + Wails 的 Codex CLI 多账号桌面管理器
**Researched:** 2026-03-11
**Confidence:** HIGH

## Recommended Stack

### Core Technologies

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| Go | 1.23.x | 原生桌面后端、文件/进程/网络/调度逻辑 | Wails 官方安装要求 Go 1.21+，且 macOS 15+ 需要 1.23.3+；`wails/v2@v2.11.0` 的模块基线也兼容这一路线 |
| Wails | v2.11.0 | 桌面壳、Go↔JS 绑定、事件桥接、打包 | 当前稳定版，能保留“本地系统服务 + Web UI”模式，同时避免 Wails v3 仍在演进中的不确定性 |
| React | 19.2.4 | 前端 UI 视图层 | 与 origin 的 React 心智保持一致，最适合承接现有交互与逐步模块化改造 |
| TypeScript | 5.9.3 | 前端类型安全与契约建模 | 对 Wails 生成绑定、DTO、i18n key 和 UI 状态都更稳 |
| Vite | 7.3.1 | 前端开发与构建 | 与 React 19 配合成熟，Wails 官方模板也围绕现代前端构建链设计 |
| Tailwind CSS | 4.2.1 | UI 样式系统 | 能最快复刻 origin 风格，同时便于做双语界面排版调整 |
| i18next | 25.8.17 | 国际化引擎与资源管理 | 官方配置能力完整，天然支持 `fallbackLng`、命名空间与运行时切换 |
| react-i18next | 16.5.6 | React 层翻译 hook/context | 官方 `useTranslation` 模式成熟，适合在组件层最小侵入接入 |

### Supporting Libraries

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| i18next-browser-languagedetector | 8.2.1 | 首次启动时读取 WebView/系统语言 | 用于“默认跟随系统语言”，随后由持久化设置覆盖 |
| github.com/zalando/go-keyring | v0.2.6 | OS keychain 接入 | 用于 full backup keychain 模式，替代明文或静态内置 secret |
| github.com/stretchr/testify | v1.11.1 | Go 单元测试断言 | 用于 service、repository、adapter 层测试 |
| Vitest | 4.0.18 | 前端单元/组件测试 | 用于 hooks、view-model、i18n 资源装载测试 |
| @testing-library/react | 16.3.2 | React 组件行为测试 | 用于表单、模态框、语言切换、错误提示等可观察行为测试 |
| @testing-library/user-event | 14.6.1 | 用户交互模拟 | 用于点击、输入、切换语言、确认对话流 |
| Playwright | 1.58.2 | 前端/桌面关键流程回归测试 | 用于 OAuth 启动前后的 UI 流程、设置页、备份导入导出等高价值路径 |

### Development Tools

| Tool | Purpose | Notes |
|------|---------|-------|
| `wails` CLI | 初始化、开发运行、打包 | 固定在 `github.com/wailsapp/wails/v2/cmd/wails@v2.11.0` |
| `go test` | Go 服务层与适配层测试 | 优先覆盖账号切换、调度、导入导出、错误映射 |
| Vitest | 前端 hook / 组件测试 | 与 React Testing Library 搭配 |
| Playwright | 关键端到端回归 | 只覆盖高风险桌面流程，不做海量 UI 快照 |
| GitHub Actions | 多平台构建与发布 | 延续 origin 的跨平台 bundle 思路，但要补测试门禁 |

## Installation

```bash
# Core
go install github.com/wailsapp/wails/v2/cmd/wails@v2.11.0
npm install react@19.2.4 react-dom@19.2.4 i18next@25.8.17 react-i18next@16.5.6 i18next-browser-languagedetector@8.2.1

# Supporting
go get github.com/zalando/go-keyring@v0.2.6
go get github.com/stretchr/testify@v1.11.1

# Dev dependencies
npm install -D typescript@5.9.3 vite@7.3.1 tailwindcss@4.2.1 vitest@4.0.18 @testing-library/react@16.3.2 @testing-library/user-event@14.6.1 playwright@1.58.2
```

## Alternatives Considered

| Recommended | Alternative | When to Use Alternative |
|-------------|-------------|-------------------------|
| Wails v2.11.0 | Wails v3 预览版 | 只有在你愿意接受 API/生态仍在变化的前提下才考虑 |
| React + TypeScript | Vue/Svelte 模板 | 仅当你明确要放弃 origin 的 React 资产与组件迁移经验 |
| i18next + react-i18next | 手写字典映射 | 只适合很小的一次性工具；这里需要 fallback、命名空间和运行时切换，不适合手写方案 |
| OS keychain + passphrase | 本地静态 secret | 只适合 throwaway prototype；生产工具不应延续 origin 的弱兼容模式 |

## What NOT to Use

| Avoid | Why | Use Instead |
|-------|-----|-------------|
| Wails v3 prerelease | 当前重构目标是稳定交付，不该引入框架层额外变数 | Wails v2.11.0 |
| 原项目式的单文件页面编排 | 会把 `App.tsx` 的状态耦合和流程耦合原样复制过去 | 分层的 feature hooks + app services + Go domain services |
| 只在前端做国际化 | 会留下大量原生错误/状态英文文案，双语体验不闭环 | 前后端共同使用 message key / localized copy 方案 |
| 依赖要求更高 Go 版本的新库作为基础设施默认选项 | 会抬高项目最低门槛并偏离当前环境 | 先选 Go 1.23.x 兼容方案，能用标准库就不用额外依赖 |

## Stack Patterns by Variant

**If preserving origin interaction speed is the priority:**
- Use `React + Tailwind + feature hooks`
- Because it minimizes UI rewrite friction while still allowing module拆分

**If backup compatibility with old `.cswf` files is required:**
- Isolate backup crypto and file-format parsing behind a dedicated Go adapter
- Because backup compatibility is a boundary problem, not a UI problem

**If localized error handling is a first-class goal:**
- Return typed status/error codes from Go, then map them to i18n keys in the frontend
- Because directly surfacing raw backend strings breaks bilingual consistency

## Version Compatibility

| Package A | Compatible With | Notes |
|-----------|-----------------|-------|
| `github.com/wailsapp/wails/v2@v2.11.0` | Go 1.23.x | 官方安装文档要求 Go 1.21+，macOS 15+ 需要 1.23.3+；本项目基线定在 1.23.x |
| `react@19.2.4` | `vite@7.3.1` | 当前前端主流稳定组合 |
| `i18next@25.8.17` | `react-i18next@16.5.6` | 官方推荐搭配，支持 hooks 模式 |
| `playwright@1.58.2` | Node 20+ | 适合作为桌面流程的最外层回归工具 |

## Sources

- Wails Installation — https://wails.io/docs/gettingstarted/installation/ — 校验 Wails 安装方式与 Go 版本要求
- Wails First Project — https://wails.io/docs/gettingstarted/firstproject/ — 校验官方支持的前端模板与项目形态
- Wails How Does It Work — https://wails.io/docs/howdoesitwork/ — 校验 Go/JS 绑定与“前端可自由选择框架”模式
- Wails Runtime Events — https://wails.io/docs/reference/runtime/events/ — 校验事件驱动适合承接定时 warmup 通知
- react-i18next `useTranslation` — https://react.i18next.com/latest/usetranslation-hook — 校验 React 侧国际化接入方式
- i18next configuration options — https://www.i18next.com/overview/configuration-options — 校验 `fallbackLng`、`supportedLngs` 等能力
- npm registry (`npm view`) — 校验 React、TypeScript、Vite、Tailwind、i18next、Vitest、Playwright 当前版本
- Go module registry (`go list -m`) — 校验 `wails/v2`、`testify`、`go-keyring` 当前模块版本

---
*Stack research for: Go + Wails Codex account desktop app*
*Researched: 2026-03-11*
