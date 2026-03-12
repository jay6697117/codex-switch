# Phase 6: Localization Completion and Release Readiness - Context

**Gathered:** 2026-03-12
**Status:** Ready for planning

## Phase Boundary

本 phase 负责把当前 v1 收口到“可公开发布”的完成度：补齐双语覆盖与漏翻译治理，完成最终回归与打包验证，并产出首个正式对外分发的 macOS 发布物。  
不在本 phase 新增产品能力；重点是把已交付能力整理到可发布标准。

## Implementation Decisions

### 发布范围
- 首个公开版本只支持 `macOS`，不把 Windows 或 Linux 纳入 Phase 6。
- macOS 发布物固定为 `Universal`，不拆成单独的 Apple Silicon / Intel 包。
- 交付形态固定为 `DMG + App bundle`。
- 分发方式固定为 `GitHub Releases`。
- 公开发布门槛固定为“签名并公证”，不接受未签名或仅签名未公证的最终发布物。
- 发布时除安装包外，还需要附带安装/升级说明。
- 发布物需要同时提供可公开消费的校验值。

### 本地化完成标准
- 双语范围继续限定为 `zh-CN` 与 `en-US`。
- 核心路径不允许中英混杂；边缘和低频诊断信息可以在 planning 时单独审视，但不能影响主流程发布质量。
- 后端返回到 UI 的核心错误与状态必须走结构化 message key 映射，而不是直接透传英文字符串。
- 运行时遇到缺失翻译时，前端应回退到英文，同时保留可观测性，不能出现静默空白。

### 回归与发布门槛
- 发布前回归范围覆盖全部已交付核心流：账号管理、账号切换、OAuth 登录、usage、warmup、backup、settings。
- 发布放行标准固定为“自动化全绿 + 人工冒烟通过”，二者缺一不可。
- 最终发布门槛必须验证真实打包产物，而不是只验证开发态与 CI 构建。
- 不允许带着阻断级已知问题公开发布；低优先级已知问题可以保留，但需要在发布说明中可见。

### Claude's Discretion
- 缺失翻译的可观测方式由后续 planning 决定，可以是测试、日志或构建期扫描的组合。
- 人工冒烟矩阵的具体步骤、顺序和记录形式由后续 planning 决定。
- DMG 内视觉包装、图标排布和发布说明排版不作为本 context 的锁定项。

## Specific Ideas

- 发布版本的目标不是“功能继续扩张”，而是“把现有能力整理到真正可公开下载使用的质量线”。
- 首个公开版本更像工程完成度发布，而不是营销发布；因此优先保证签名、公证、回归矩阵、安装说明和校验值齐备。

## Existing Code Insights

### Reusable Assets
- `frontend/src/i18n/resources.ts`: 已经按 namespace 组织 `accounts/auth/backup/common/errors/settings/shell/usage/warmup`，可作为 Phase 6 补齐文案与扫描覆盖面的入口。
- `frontend/src/i18n/createAppI18n.ts`: 已启用 `fallbackLng: "en-US"` 和 `returnNull: false`，适合在 Phase 6 增加缺失翻译的可观测策略。
- `frontend/src/app/AppShell.tsx`: 现有 shell 已统一承接 bootstrap、accounts、warmup、settings 与 runtime feedback，适合做最终双语巡检和 release smoke 聚合。
- `.github/workflows/ci.yml`: 已包含 `go test`、`npm run typecheck`、`npm test`、`npm run build`、`npm run e2e`，可作为自动化发布门槛基线。
- `wails.json`: 当前 Wails 配置仍然是最小骨架，Phase 6 可以在此基础上补 release 所需的 packaging/signing 相关配置。

### Established Patterns
- 前端一直通过 typed Wails facade 调用后端，不允许 React 组件直接依赖 raw bindings；Phase 6 的本地化补齐也应沿用这条边界。
- 各 phase 已经把 shell 组织成独立 section，而不是 router 页面；Phase 6 的审计与回归应围绕当前单窗口信息架构进行。
- 当前 i18n 已经有 `errors` namespace，说明 backend-originated message key 覆盖应继续集中在结构化错误映射，而不是散落在业务组件里。

### Integration Points
- 发布级别的语言与回归收口会同时触达 `frontend/src/i18n/**`、`frontend/src/lib/wails/**`、`internal/contracts/**` 和 shell-level smoke tests。
- 打包与 release readiness 会连接 `wails build`、CI 工作流以及最终 DMG/App 的人工验证步骤。

## Deferred Ideas

- Windows / Linux 支持是后续 phase，不属于当前 v1 发布范围。
- 自动更新机制、托盘能力和更复杂的发布渠道不属于 Phase 6。
- 官网下载页、营销文案和完整发布站点建设不属于 Phase 6。

---

*Phase: 06-localization-completion-and-release-readiness*  
*Context gathered: 2026-03-12*
