# Phase 4: Warmup Automation - Research

**Researched:** 2026-03-11
**Domain:** Go/Wails 本地调度、warm-up 适配与事件驱动桌面反馈
**Confidence:** HIGH

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- 保留 origin 的双入口心智模型：账号卡片里提供单账号 warm-up，顶部工具区保留 `Warm-up All`
- 单账号 warm-up 进行中时，只局部切换该动作位到 loading / disabled，不整卡禁用，也不全局冻结其它 warm-up 动作
- 手动 warm-up 完成后的主反馈是 `toast + 轻量最近结果状态`
- 当前不能执行 warm-up 的账号仍保留动作位，但按钮需要 disabled，并明确展示原因
- 定时 warm-up 作为独立的 `Warmup` 区域存在，不继续堆进账号区
- Phase 4 只支持一个全局 daily schedule：用户选择一个本地时间，再选择参与的账号集合
- 账号选择使用显式多选清单，并提供 `Select All / Clear All`
- 主界面需要常驻显示 schedule 摘要：每日时间、参与账号数、`Next run`
- schedule 配置无效时阻止保存，并使用表单内联提示，不退化成 toast-only 错误
- 当天错过 scheduled warm-up 后，重新打开应用时使用阻断式弹窗提示
- missed-run 弹窗的主动作偏向 `Run Now`，`Skip Today` 作为次动作
- `Skip Today` 只压掉当天剩余时间内的 missed-run 提示，跨天后重新按新的一天计算
- 只有自动 scheduled run，或在 missed-run 弹窗中明确执行 `Run Now`，才记为当天已完成补跑
- 普通手动 warm-up 不自动抵扣当天 missed-run

### Claude's Discretion
- 轻量最近结果状态放在卡片、Warmup 区域摘要，还是二者组合
- 手动 / 定时 / missed-run 三类反馈在视觉上如何区分
- Warmup 区域的卡片密度、图标和最近结果的排版方式
- 本地化文案的具体语气与信息层级

### Deferred Ideas (OUT OF SCOPE)
- 多条 schedule / 每账号独立执行时间
- 应用关闭后继续在系统层后台执行 warm-up
- 系统托盘常驻与 schedule 联动
- 更重的结果历史面板或 warm-up 审计列表
</user_constraints>

<research_summary>
## Summary

Phase 4 的最佳实现路径不是引入新的通用调度框架，而是延续 origin 的真实产品语义：应用打开时由 Go 后端持有一个轻量 scheduler，每 30 秒检查一次单条本地 daily schedule；真正的 schedule 配置只保存最小字段，像 `next run`、`missed today`、`valid account ids` 这类信息都在读取时动态计算。这样最贴合现有需求，也避免为一个单条 daily schedule 提前引入 cron DSL、后台守护进程或复杂 job registry。

现有新架构已经提供了 Phase 4 需要的大部分支撑边界：`Go service -> Wails binding -> typed TS facade -> React feature container` 已在 accounts / auth / usage 上验证过，Wails v2.11 的 runtime event API 也足以承接 scheduled result 和 missed-run prompt。真正需要补的不是框架，而是两个新后端域服务：`internal/warmup` 负责单账号/全量 warm-up 执行与结果归一化；`internal/scheduler` 负责 schedule 持久化、next-run 计算、missed-run 判定和 runtime event 发射。

**Primary recommendation:** 用 Go 标准库 `time` + 现有 Wails runtime events + 扩展后的 `internal/settings` 实现单条本地 daily schedule，不新增 cron/daemon 依赖；手动 warm-up 接入账号区，定时配置和 missed-run UI 做成独立 Warmup feature。
</research_summary>

<standard_stack>
## Standard Stack

本 phase 不推荐新增新的核心依赖，优先复用当前项目与标准库。

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Go `time` | Go 1.23 | 本地时间解析、DST 感知的 next-run 计算、每日边界判断 | Go 官方时间模型足以覆盖单条本地 daily schedule，且比引入 cron 依赖更可控 |
| `github.com/wailsapp/wails/v2/pkg/runtime` | v2.11.0 | 从 Go 向前端发 scheduled result / missed-run 事件 | 当前项目已使用 Wails v2，官方 runtime events 是标准的跨边界通知手段 |
| 当前 typed Wails facade | repo-local | 让 warm-up / schedule 能力继续走 typed contract，而不是 raw binding | 已在 Phase 1-3 验证过，符合项目现有边界 |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `internal/settings` 扩展存储 | repo-local | 持久化 schedule 配置与 “今天已运行/已跳过提示” 标记 | 保存最小配置，不保存派生状态 |
| React 19 + `react-i18next` | repo-local | Warmup 区域、弹窗、最近结果状态与本地化反馈 | UI 层消费 typed facade 和 event |
| `go test` + Vitest + Playwright | repo-local | 后端调度语义、前端配置交互、event/missed-run 回归 | Phase 4 的高风险点都需要自动化覆盖 |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| 标准库 + 单条 daily schedule | `robfig/cron/v3` | `cron` 更适合多规则/cron spec；当前只是一条本地 `HH:MM` 规则，引入后会过度通用化 |
| Wails runtime events | 前端主动轮询 scheduler 状态 | 轮询会复制 origin 的高噪声模式，事件更适合 scheduled result 和 missed-run |
| 独立 Warmup feature | 继续把 schedule 状态堆进 `AccountSection` | 会把账号区重新推回巨型 orchestrator，和前几阶段的拆分方向冲突 |

**Installation:**
```bash
# No new package is required for the recommended path.
# Keep using:
go test ./...
cd frontend && npm test
```
</standard_stack>

<architecture_patterns>
## Architecture Patterns

### Recommended Project Structure
```text
internal/
├── warmup/           # Manual warm-up use cases + provider adapter
├── scheduler/        # Daily schedule config, next-run math, missed-run checks, runtime emit
├── settings/         # Persisted preference + schedule store
└── contracts/        # Warmup result, schedule snapshot, runtime event payloads

frontend/src/
├── features/accounts/  # Single-account and all-account warm-up actions
├── features/warmup/    # Schedule summary, configuration modal, missed-run prompt
├── lib/contracts.ts    # Warmup/scheduler DTOs
└── lib/wails/          # Warmup facade + runtime event bridge
```

### Pattern 1: Persist minimal schedule, derive runtime status
**What:** 设置文件只保存 `enabled`、`localTime`、`accountIds`、`lastRunLocalDate`、`lastMissedPromptLocalDate` 这类最小字段；`validAccountIds`、`missedRunToday`、`nextRunLocalISO` 在读取时动态计算。  
**When to use:** 当 schedule 规则简单、但账号集合和本地日期可能变化时。  
**Example:**
```go
type WarmupSchedule struct {
    Enabled                  bool     `json:"enabled"`
    LocalTime                string   `json:"localTime"`
    AccountIDs               []string `json:"accountIds"`
    LastRunLocalDate         *string  `json:"lastRunLocalDate,omitempty"`
    LastMissedPromptLocalDate *string `json:"lastMissedPromptLocalDate,omitempty"`
}

type WarmupScheduleStatus struct {
    Schedule        *WarmupSchedule `json:"schedule,omitempty"`
    ValidAccountIDs []string        `json:"validAccountIds"`
    MissedRunToday  bool            `json:"missedRunToday"`
    NextRunLocalISO *string         `json:"nextRunLocalIso,omitempty"`
}
```

### Pattern 2: App-open scheduler loop with session anchor
**What:** scheduler goroutine 在 app startup 后启动，用 ticker 周期检查是否该执行 scheduled warm-up；同时保存 `sessionStartedAt`，用来区分“应用当时开着但还没到点”和“今天其实错过了，后来才打开”。  
**When to use:** schedule 只要求应用打开时有效，不要求系统级后台常驻。  
**Example:**
```go
type SchedulerRuntime struct {
    SessionStartedAt time.Time
}

func (s *Service) Start(ctx context.Context) {
    ticker := time.NewTicker(30 * time.Second)
    go func() {
        defer ticker.Stop()
        for {
            select {
            case <-ctx.Done():
                return
            case <-ticker.C:
                _ = s.MaybeRunScheduledWarmup(ctx)
            }
        }
    }()
}
```

### Pattern 3: Scheduled results arrive through runtime events
**What:** Go 侧在 scheduled run 或 missed-run 补跑完成后，通过 Wails runtime event 发结果；前端 feature 订阅并转换成本地化提示和轻量状态。  
**When to use:** 后台触发的结果不是由当前按钮点击直接返回，而是异步送达 UI。  
**Example:**
```go
import wailsruntime "github.com/wailsapp/wails/v2/pkg/runtime"

func emitScheduledResult(ctx context.Context, payload WarmupResultEvent) {
    wailsruntime.EventsEmit(ctx, "warmup:result", payload)
}
```

```ts
const unsubscribe = services.events?.subscribe<WarmupResultEvent>(
  "warmup:result",
  (event) => {
    setLatestResult(event.data);
  },
);
```

### Anti-Patterns to Avoid
- **把 schedule 做成通用 cron 规则编辑器：** Phase 4 只有一条本地 daily schedule，这会把 scope 无谓抬高。
- **把派生状态落盘：** `next run`、`missed today`、`validAccountIds` 都应是运行时计算值，否则容易和账号变更、时区变化脱节。
- **把 manual / scheduled / missed-run 混成一个按钮返回路径：** 它们共享 warm-up 执行器，但 completion semantics 不同，尤其“手动 warm-up 不抵扣 missed-run”。
- **继续把 UI 编排塞回账号容器：** schedule config、missed-run prompt、event feedback 应在独立 Warmup feature 中收口。
</architecture_patterns>

<dont_hand_roll>
## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| 跨前后端后台结果通知 | 自己造前端全局事件总线 | Wails runtime events | 当前栈已经内置 Go↔JS 事件通道，减少重复协议 |
| 多规则 cron 配置器 | 自定义 cron DSL / parser | 单条 `HH:MM` local-time domain model | 当前 requirement 明确只有一个全局 daily schedule |
| schedule 派生状态缓存 | 写回 `nextRun` / `missedToday` 到设置文件 | 读取时计算的 status snapshot | 避免账号删除、日期变化、DST 后的陈旧状态 |
| schedule 与手动执行混记账 | “任何 warm-up 都算 scheduled 已跑” | 单独的 scheduled completion 标记 | 这是用户已锁定的产品语义，不能偷简化 |

**Key insight:** 在这个 phase 里，最危险的不是“功能做不出来”，而是为了通用化把简单语义做复杂。single-schedule + local-time + app-open only 是一个明确而窄的产品模型，应该直接编码成 domain 规则，而不是先抽象成更大的调度平台。
</dont_hand_roll>

<common_pitfalls>
## Common Pitfalls

### Pitfall 1: 用固定 24 小时偏移计算 next run
**What goes wrong:** DST 切换日会出现 `next run` 漂移，或者“同样的本地 09:00”在跨天后不再指向用户预期。  
**Why it happens:** 把“明天同一时刻”当成 `now + 24h`，而不是按本地日历重建当天/次日时间。  
**How to avoid:** 始终基于本地 location 和日历日期重新构造 `time.Date(...)`，跨天用 `AddDate(0, 0, 1)`。  
**Warning signs:** DST 前后 `Next run` 比 UI 设定早/晚一小时，或测试依赖固定 `24h` 才能通过。

### Pitfall 2: 把 manual warm-up 当成 scheduled completion
**What goes wrong:** 用户当天手动跑过一个账号后，missed-run 提示消失，或者 scheduled run 再也不会执行。  
**Why it happens:** 复用了同一套“今日已完成”标记，没有区分 `manual`、`scheduled`、`missed_prompt` 三种触发源。  
**How to avoid:** 把“记录今日 scheduled 已执行”限制在 scheduler 自动执行或 missed-run 明确补跑路径里。  
**Warning signs:** 手动点一次 `Warm-up` 后，当天的 missed-run 弹窗不再出现。

### Pitfall 3: 删除账号后 schedule 仍引用旧 ID
**What goes wrong:** UI 显示 schedule 正常，实际执行时只剩部分账号生效，或者保存后状态对不上。  
**Why it happens:** schedule 持久化和 account repository 不是同一份来源，老 ID 没有在读取/保存时过滤。  
**How to avoid:** schedule status 每次读取都基于当前 account store 重新算 `validAccountIds`；保存时也要清洗不存在的 ID。  
**Warning signs:** settings.json 中保留已删除 ID，`selected count` 和实际执行账号数不一致。

### Pitfall 4: scheduler 与 UI 编排过度耦合
**What goes wrong:** 一旦加 schedule config、missed-run prompt、toast、recent result，`AccountSection` 再次膨胀成巨型状态机。  
**Why it happens:** 为了少建一个 feature 容器，把所有 Phase 4 状态都塞进账号区。  
**How to avoid:** 手动 warm-up 动作留在账号区，schedule/missed-run/result summary 在独立 Warmup feature 中收口。  
**Warning signs:** 一个组件同时持有 accounts snapshot、usage、oauth、warmup、schedule、missed-run 和 toast 相关的全部状态。
</common_pitfalls>

<code_examples>
## Code Examples

Verified patterns from official and primary sources:

### Wails runtime event contract
```go
// Source: https://wails.io/docs/reference/runtime/events/
import wailsruntime "github.com/wailsapp/wails/v2/pkg/runtime"

func (s *SchedulerService) emit(ctx context.Context, payload WarmupResultEvent) {
    wailsruntime.EventsEmit(ctx, "warmup:result", payload)
}
```

```ts
// Source: https://wails.io/docs/reference/runtime/events/
const unsubscribe = window.runtime?.EventsOn?.("warmup:result", (payload) => {
  console.log(payload);
});
```

### Parse local wall-clock time in the user location
```go
// Source basis: https://pkg.go.dev/time#ParseInLocation
func parseLocalClock(value string, loc *time.Location) (int, int, error) {
    parsed, err := time.ParseInLocation("15:04", value, loc)
    if err != nil {
        return 0, 0, err
    }

    return parsed.Hour(), parsed.Minute(), nil
}
```

### Build next run from local date instead of `+24h`
```go
// Source basis: https://pkg.go.dev/time#AddDate
func nextRunAfter(now time.Time, hour int, minute int) time.Time {
    candidate := time.Date(now.Year(), now.Month(), now.Day(), hour, minute, 0, 0, now.Location())
    if now.Before(candidate) {
        return candidate
    }
    tomorrow := now.AddDate(0, 0, 1)
    return time.Date(tomorrow.Year(), tomorrow.Month(), tomorrow.Day(), hour, minute, 0, 0, now.Location())
}
```
</code_examples>

<sota_updates>
## State of the Art (2024-2025)

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| 前端自己轮询状态并手动拼事件语义 | 使用 Wails runtime events 作为 Go↔JS 的统一 pub/sub | Wails v2 文档与 2.11 现状稳定 | scheduled result / missed-run 反馈不需要额外 websocket 或 polling 协议 |
| 用固定时长近似“下一天” | 用本地 location + `AddDate` / `time.Date` 做日历计算 | Go `time` 文档长期建议，但在近年 DST 相关说明更明确 | next-run 和 missed-run 判定要按本地日历而不是 `24h` |
| 为 schedule 提前引入 cron spec | 先把单条 daily schedule 编码成显式 domain | 近年 Go cron 生态更成熟，但 Phase 4 scope 仍不需要 | 当前需求下 cron 不是标准栈，而是过度抽象 |

**New tools/patterns to consider:**
- Wails v2 runtime events：已足够承接后台结果，不需要额外事件中间层
- 结构化 DTO + localized error/message code：Phase 1-3 已验证，Phase 4 应延续到 warm-up result 和 schedule validation

**Deprecated/outdated:**
- “任何 warm-up 都算 scheduled 已完成”的偷简化：和已锁定的产品语义冲突
- 在单个大页面里同时编排 accounts/oauth/usage/warmup/schedule：和当前 feature-based shell 方向冲突
</sota_updates>

<open_questions>
## Open Questions

1. **Warm-up provider adapter 应否从 `internal/usage` 拆出来？**
   - What we know: origin 把 warm-up 放在 usage command/api 旁边，但当前新项目已经把 usage 建成独立 service
   - What's unclear: 是否完全共用同一 fetcher，还是在 Phase 4 独立 `internal/warmup`
   - Recommendation: 独立 `internal/warmup` service，必要时复用 usage/http 的低层 helper，避免 Phase 3 领域重新膨胀

2. **`Warm-up All` 的执行策略是顺序还是有限并发？**
   - What we know: origin 是顺序执行，当前 requirement 只要求可触发，不要求速度
   - What's unclear: 在账号数量增加时是否需要并发提速
   - Recommendation: Phase 4 先保持顺序或 very small bounded concurrency，优先保持 provider 风险可控与测试简单

3. **最近结果状态应该主要挂在哪里？**
   - What we know: 用户明确不想只剩 toast，希望保留轻量痕迹
   - What's unclear: 只在 Warmup 区域汇总，还是同时在账号卡片上留最后一次单账号结果
   - Recommendation: planner 在 04-03 中优先做“Warmup 区域摘要 + 单账号按钮附近轻状态”的组合，并以最小 UI 变更为目标
</open_questions>

## Validation Architecture

- Go 层需要用 fake clock、fake settings store、fake runtime emitter 覆盖 schedule 语义
- 前端需要用 stubbed typed facades 覆盖按钮 loading、schedule 表单校验、missed-run modal 和 event 驱动结果反馈
- Playwright focused smoke 应覆盖：
  - 单账号 warm-up
  - Warm-up All
  - schedule 保存后摘要显示
  - missed-run prompt 的 `Run Now / Skip Today`


<sources>
## Sources

### Primary (HIGH confidence)
- [Wails Runtime Events](https://wails.io/docs/reference/runtime/events/) — 确认 `EventsOn / EventsEmit / EventsOff` 的 Go/JS 契约（v2.11.0）
- [Go `time` package](https://pkg.go.dev/time) — 校验 `ParseInLocation`、`LoadLocation`、`AddDate` 的本地时间与 DST 语义
- [robfig/cron v3 README](https://github.com/robfig/cron) — 作为“可选但不推荐”的替代方案参考
- `codex-switcher-origin/src-tauri/src/scheduler.rs` — origin 的 schedule / missed-run 行为蓝本
- `codex-switcher-origin/src-tauri/src/auth/settings.rs` — origin 的 schedule 持久化语义
- 当前仓库 `app.go` / `frontend/src/lib/contracts.ts` / `frontend/src/lib/wails/services.ts` / `internal/settings/store.go`

### Secondary (MEDIUM confidence)
- `.planning/codebase/ARCHITECTURE.md` / `INTEGRATIONS.md` / `CONCERNS.md` — 现有 codebase map 对 warm-up、scheduler 和 risk points 的归纳
- `.planning/research/ARCHITECTURE.md` / `SUMMARY.md` — 项目级研究里关于 feature 模块与 runtime events 的建议

### Tertiary (LOW confidence - needs validation)
- 无额外低置信度来源；本 phase 主要依赖官方文档、origin 源码和当前仓库现状
</sources>

<metadata>
## Metadata

**Research scope:**
- Core technology: Go local-time scheduler + Wails runtime events + typed Wails facade
- Ecosystem: Go stdlib `time`, Wails runtime, optional `robfig/cron/v3`
- Patterns: minimal persisted schedule, app-open ticker scheduler, event-driven result delivery
- Pitfalls: DST drift, missed-run semantics, stale account IDs, giant UI orchestrator

**Confidence breakdown:**
- Standard stack: HIGH - 当前需求窄，官方文档和现有仓库边界都支持不引入新依赖
- Architecture: HIGH - 与 Phase 1-3 已建立的 typed service/facade 模式一致
- Pitfalls: HIGH - origin 代码和当前 codebase concerns 都已暴露关键风险
- Code examples: HIGH - 直接来自 Wails / Go 官方文档语义和当前项目边界

**Research date:** 2026-03-11
**Valid until:** 2026-04-10
</metadata>

---

*Phase: 04-warmup-automation*
*Research completed: 2026-03-11*
*Ready for planning: yes*
