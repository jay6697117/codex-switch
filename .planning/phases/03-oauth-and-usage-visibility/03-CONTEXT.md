# Phase 3: OAuth and Usage Visibility - Context

## Why this phase exists

Phase 2 已经把本地账号仓库、`auth.json` 安全切换、进程确认和账号壳层 UI 打稳，但产品仍然缺少两条决定可用性的核心链路：

1. 新账号无法通过 ChatGPT OAuth 加入本地仓库；
2. 账号即使存在，也看不到 5 小时 / 周 usage 和刷新结果。

Phase 3 的目标不是“再加几个按钮”，而是把 OAuth / token refresh / usage 这三段最不稳定的外部边界，抽成可测试、可本地化、可在前端安全消费的服务契约。

## Scope

Phase 3 负责：

- ChatGPT OAuth 添加账号
- OAuth 取消 / 超时 / 端口占用恢复
- ChatGPT token refresh 与账号材料化
- 单账号 / 全量 usage refresh
- 5 小时 / 周 usage 数据的归一化展示
- usage 不可用 / 不支持时的本地化 fallback

Phase 3 不负责：

- `Add Account > Import File`
- warm-up / scheduled warm-up
- 备份与设置
- 全量 success/failure 文案扫尾（这是 Phase 6）

## Requirements mapping

- `AUTH-01`: ChatGPT OAuth 添加账号
- `AUTH-02`: OAuth 取消或中断后不会留下坏状态
- `USAGE-01`: 展示 5 小时 usage
- `USAGE-02`: 展示 weekly usage
- `USAGE-03`: 支持单账号 / 全量 refresh
- `USAGE-04`: usage unavailable / unsupported 有本地化 fallback

## Current codebase anchor

当前新项目里已存在这些稳定边界，可直接作为 Phase 3 的落点：

- `internal/accounts/`: 本地账号仓库、stable ID、rename/delete、active fallback
- `internal/switching/`: `auth.json` 写入与切换事务
- `internal/contracts/`: 结构化 DTO / `AppError` / `ResultEnvelope`
- `app.go`: Wails bindings 的统一入口
- `frontend/src/lib/contracts.ts`: 前端 typed contract
- `frontend/src/lib/wails/services.ts`: typed facade 边界
- `frontend/src/features/accounts/`: Phase 2 已完成的账号展示与切换 UI

这意味着 Phase 3 不应该绕过现有 facade，也不应该把 OAuth/usage 逻辑塞回 `AppShell` 或某个大组件状态机里。

## Origin reference points

origin 中与本 phase 最相关的模块如下：

- `codex-switcher-origin/src-tauri/src/commands/oauth.rs`
  - 管理 pending OAuth flow
  - `start_login / complete_login / cancel_login`
- `codex-switcher-origin/src-tauri/src/auth/oauth_server.rs`
  - PKCE 生成
  - 默认端口 `1455`，端口占用时 fallback
  - 本地 callback server
  - state 校验 / token exchange / 成功页返回
- `codex-switcher-origin/src-tauri/src/auth/token_refresh.rs`
  - 判断 access token 是否临近过期
  - 使用 refresh token 拉新 token
  - active account 时同步 `auth.json`
- `codex-switcher-origin/src-tauri/src/api/usage.rs`
  - ChatGPT usage API 调用
  - `401 -> refresh -> retry once`
  - API key 账号直接标记 unsupported
- `codex-switcher-origin/src/components/AddAccountModal.tsx`
  - OAuth tab 的最小交互骨架
  - 当前新项目必须保留 OAuth 添加账号，但不能重带 Import File tab
- `codex-switcher-origin/src/components/UsageBar.tsx`
  - usage bar 的基础信息架构：5h、weekly、reset time、fallback

## Constraints and decisions

- 继续沿用当前架构：`Go service/adapters -> Wails bindings -> typed TS facade -> React features`
- 不允许 React 组件直接依赖 raw Wails bindings
- backend 不能裸回英文错误字符串；对前端暴露 message/error code + args
- OAuth pending flow 必须是单实例语义；新请求要能取消旧 pending flow
- 默认 callback 端口优先 `1455`，但必须允许 fallback 到随机空闲端口
- `Add Account > Import File` 继续 out-of-scope
- API key 账号不做“新增入口”，但 usage adapter 需要能明确返回 unsupported fallback
- usage refresh 不能把 network / retry / token refresh 逻辑塞进前端

## Risks carried into Phase 3

1. OAuth callback 生命周期容易做成全局脆弱状态
   - 需要明确 pending flow manager 与 cancel/timeout 语义
2. token refresh 与 active-account auth 同步容易破坏 Phase 2 的切换边界
   - 需要把“active account refresh 后同步 `auth.json`”封在 service 层
3. usage API 是高不稳定外部边界
   - 需要 isolate adapter、统一 fallback、单次 refresh-retry 策略
4. 前端很容易把 add-account / usage 再做成大一统状态机
   - 必须拆到独立 feature 容器和 typed facade

## Phase split rationale

### 03-01 OAuth callback and account creation

先把最难回滚的 OAuth 入口、pending flow、callback server、账号落库链路独立出来，避免 UI 开发时反向牵引 service 设计。

### 03-02 Usage adapters and token freshness

把 usage 查询、refresh、unsupported fallback、401 refresh retry 的领域规则先在 Go 层做稳，确保前端拿到的是稳定快照而不是一堆 provider 细节。

### 03-03 OAuth and usage frontend integration

最后把 Add Account OAuth flow、usage card/refresh、fallback UI 接到现有 account shell 上，保持单窗口架构，不重新引入 monolithic page。

## Expected Phase 3 outputs

- `internal/auth/` 或等价目录，承载 OAuth / refresh / add-account 服务
- `internal/usage/` 或等价目录，承载 usage adapter / normalization
- 新的 Go + TS contracts：OAuth flow、usage snapshot、refresh results
- 新的 frontend features：add-account OAuth UI、usage presentation、refresh interactions
- Go tests + frontend tests + focused e2e for OAuth/usage shell flows
