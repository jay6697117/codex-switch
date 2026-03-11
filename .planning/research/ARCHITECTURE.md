# Architecture Research

**Domain:** Go + Wails 本地桌面账号管理工具
**Researched:** 2026-03-11
**Confidence:** HIGH

## Standard Architecture

### System Overview

```text
┌─────────────────────────────────────────────────────────────┐
│                    React / TypeScript UI                    │
├─────────────────────────────────────────────────────────────┤
│  Accounts UI  Usage UI  Warmup UI  Backup UI  Settings UI  │
└──────────────┬──────────────┬──────────────┬────────────────┘
               │              │              │
┌──────────────┴──────────────────────────────────────────────┐
│           Frontend App Services / Wails Binding Facade      │
├──────────────────────────────────────────────────────────────┤
│  accounts  auth  usage  scheduler  backup  settings  i18n   │
└──────────────┬──────────────────────────────────────────────┘
               │ generated bindings / events
┌──────────────┴──────────────────────────────────────────────┐
│                    Go Domain Services                        │
├──────────────────────────────────────────────────────────────┤
│ accounts  switching  oauth  usage  warmup  backup  locale   │
└───────┬───────────────┬───────────────┬─────────────────────┘
        │               │               │
┌───────┴───────┐ ┌─────┴────────┐ ┌────┴────────────────────┐
│ Local Storage │ │ OS Integrat. │ │ External OpenAI/Auth API │
│ JSON / lock   │ │ keychain/proc│ │ usage / oauth / refresh  │
└───────────────┘ └──────────────┘ └──────────────────────────┘
```

### Component Responsibilities

| Component | Responsibility | Typical Implementation |
|-----------|----------------|------------------------|
| React feature UI | 展示账户、模态框、设置、错误和双语文案 | `frontend/src/features/*` 中的组件与 hooks |
| Frontend app service | 屏蔽 Wails 绑定细节、统一 DTO/错误映射 | `frontend/src/lib/wails/` + feature services |
| Go domain service | 处理账号切换、OAuth、usage、备份、调度 | `internal/accounts`、`internal/auth`、`internal/usage` 等 |
| Repository / adapter | 处理 JSON 存储、keychain、进程、HTTP | `internal/storage`、`internal/platform`、`internal/openai` |
| Localization layer | 管理 locale、message key 和 fallback | `frontend/src/i18n` + `internal/contracts/messages` |

## Recommended Project Structure

```text
.
├── main.go                    # Wails entry
├── app.go                     # Root app wiring
├── internal/
│   ├── accounts/              # Account models, use cases, repositories
│   ├── auth/                  # OAuth, token refresh, auth.json switching
│   ├── usage/                 # Usage and warm-up adapters
│   ├── scheduler/             # Daily warm-up scheduling and events
│   ├── backup/                # Slim/full import-export and crypto adapters
│   ├── settings/              # Security mode, locale, and app preferences
│   ├── platform/              # Keychain, file lock, process control, filesystem
│   └── contracts/             # DTOs, status codes, event payloads
├── frontend/
│   ├── src/
│   │   ├── app/               # Shell, layout, route-level composition
│   │   ├── features/          # Accounts, usage, warmup, backup, settings
│   │   ├── components/        # Shared presentation components
│   │   ├── lib/wails/         # Generated bindings wrapper and event helpers
│   │   ├── i18n/              # Resources, locale bootstrapping, message keys
│   │   └── styles/            # Design tokens and global styles
│   └── package.json
└── tests/                     # End-to-end or desktop contract smoke tests
```

### Structure Rationale

- **`internal/*`:** 用 Go 的业务模块边界替代 origin 中“按 command 暴露、实现细节散落”的组织方式。
- **`frontend/src/features/*`:** 直接按产品能力拆 UI，避免把所有状态重新堆进一个 `App.tsx`。
- **`internal/contracts` + `frontend/src/lib/wails`:** 这是前后端契约层，必须把状态码、事件 payload、DTO 和 message key 统一起来。
- **`frontend/src/i18n`:** 让 i18n 从一开始就是基础设施，而不是末尾补丁。

## Architectural Patterns

### Pattern 1: App Service Facade

**What:** 前端组件永远不直接调用 Wails 生成绑定，而是通过一层 app service/facade。
**When to use:** 所有跨 Go/TS 的调用。
**Trade-offs:** 多一层封装，但能统一错误翻译、loading、DTO 转换和 future refactor。

**Example:**
```typescript
export async function switchAccount(input: SwitchAccountInput) {
  const result = await accountApi.switchAccount(input);
  return mapAccountResult(result);
}
```

### Pattern 2: Domain Service + Adapter Boundary

**What:** Go 业务逻辑只依赖接口，不直接把文件系统、keychain、HTTP 细节写进 use case。
**When to use:** 账号切换、OAuth、usage、备份、调度等所有 side-effect heavy 场景。
**Trade-offs:** 初期文件更多，但测试和替换能力大幅提升。

**Example:**
```go
type AuthWriter interface {
    WriteActiveAuth(ctx context.Context, account Account) error
}

type SwitchService struct {
    store      AccountStore
    authWriter AuthWriter
    procCtl    ProcessController
}
```

### Pattern 3: Localized Message Contract

**What:** Go 返回 message code / args，前端用 i18n 资源生成最终文案。
**When to use:** 所有用户可见错误、提示、状态 toast。
**Trade-offs:** 比直接返回字符串多一点建模成本，但国际化和一致性最稳。

**Example:**
```go
type AppError struct {
    Code string            `json:"code"`
    Args map[string]string `json:"args,omitempty"`
}
```

### Pattern 4: Event-Driven Background Updates

**What:** 调度器、长任务完成、后台状态变化通过 Wails events 推 UI，而不是靠高频轮询。
**When to use:** scheduled warmup、bulk refresh、long-running backup/import feedback。
**Trade-offs:** 事件协议需要建模，但能显著降低无意义 polling。

## Data Flow

### Request Flow

```text
[User Action]
    ↓
[React Component]
    ↓
[Frontend App Service]
    ↓
[Wails Binding]
    ↓
[Go Use Case]
    ↓
[Repository / Adapter]
    ↓
[Localized Result DTO]
    ↓
[React State + i18n Render]
```

### State Management

```text
[Feature Hooks / Local UI State]
          ↓
[App Service Result]
          ↓
[Feature Slice Refresh]
          ↓
[React Components]
```

### Key Data Flows

1. **账号切换流:** UI 发起切换 → Go 检查运行中进程 → 必要时执行安全停止 → 写入 `auth.json` → 更新 active account → 返回结构化结果。
2. **定时 warm-up 流:** 设置页保存本地时间和账号集合 → Go scheduler 驱动 → 成功/失败通过 event 发送到 UI → UI 用 i18n toast 呈现。
3. **国际化流:** 首次启动读取系统 locale → 前端选择受支持语言 → 用户手动切换时持久化设置 → 后续启动优先读取用户覆盖值。

## Scaling Considerations

| Scale | Architecture Adjustments |
|-------|--------------------------|
| 1-20 个账号 | 单体本地架构完全足够，优先保证边界清晰 |
| 20-100 个账号 | 增加批量刷新节流、受控并发和缓存，避免顺序网络风暴 |
| 100+ 个账号 | 不是当前产品目标；若出现，先优化 polling/concurrency，再考虑更强本地索引 |

### Scaling Priorities

1. **First bottleneck:** usage / warm-up 对外部 API 的批量调用频率，而不是 UI 渲染。
2. **Second bottleneck:** 账号切换与调度相关的本地文件/进程协调，而不是数据量本身。

## Anti-Patterns

### Anti-Pattern 1: Rebuild Another Giant `App.tsx`

**What people do:** 把 origin 的页面级状态和所有交互流程直接搬进新的 Wails frontend shell。
**Why it's wrong:** 只是把旧耦合从 Tauri 页面挪到 Wails 页面，根因没有解决。
**Do this instead:** 用 feature modules + app services + shared components 重新拆边界。

### Anti-Pattern 2: Return Raw Backend Strings

**What people do:** Go 服务直接返回英文错误文案，前端原样展示。
**Why it's wrong:** 双语需求会立刻失效，且后续文案治理不可控。
**Do this instead:** 返回 typed codes，再由前端 i18n 渲染。

### Anti-Pattern 3: Treat `auth.json` Switching as a Utility Function

**What people do:** 把切换实现成一个简单的“写文件 helper”。
**Why it's wrong:** 实际上它横跨进程、文件、状态和 UI 反馈，是事务边界。
**Do this instead:** 为切换链路建单独 service 和 failure model。

## Integration Points

### External Services

| Service | Integration Pattern | Notes |
|---------|---------------------|-------|
| OpenAI Auth | PKCE OAuth + local callback server | 需要端口冲突、取消、超时与 refresh 处理 |
| ChatGPT usage API | HTTP adapter + retry/refresh | 这是最不稳定的外部边界之一，必须隔离 |
| OS keychain | platform adapter | 平台差异必须藏在 adapter 后面 |
| Local process control | platform adapter | 只暴露“检测/停止/重启 Codex”领域语义给 use case |

### Internal Boundaries

| Boundary | Communication | Notes |
|----------|---------------|-------|
| React UI ↔ app services | typed TS functions | 组件不直接碰 Wails binding |
| app services ↔ Wails bindings | generated bindings + wrappers | 集中处理 DTO/错误转换 |
| Go use cases ↔ adapters | interfaces | 确保可测试和可替换 |
| scheduler ↔ frontend | typed events | 所有后台结果都走事件契约 |

## Sources

- Wails 官方文档：installation / firstproject / howdoesitwork / runtime events
- `codex-switcher-origin` 代码地图与现有架构分析
- i18next / react-i18next 官方文档

---
*Architecture research for: Wails desktop account manager*
*Researched: 2026-03-11*
