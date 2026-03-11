# Feature Research

**Domain:** 本地桌面多账号 Codex CLI 管理器
**Researched:** 2026-03-11
**Confidence:** HIGH

## Feature Landscape

### Table Stakes (Users Expect These)

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| 多账号本地存储与列表展示 | 这是产品存在的最小前提 | LOW | 需要明确 active/inactive 状态与最近使用信息 |
| ChatGPT OAuth 添加账号 | 用户不想手工搬 token | MEDIUM | 依赖浏览器拉起、本地回调、取消/超时恢复 |
| 活跃账号切换并同步 Codex CLI | 没有切换就没有产品价值 | HIGH | 涉及 `~/.codex/auth.json`、运行中进程和回滚语义 |
| 额度/使用量查看 | 用户选择账号依赖额度信息 | MEDIUM | 需要 5h / weekly / credits 的可视化与失败态 |
| 单账号/全量 warm-up | 这是现有产品的核心使用路径之一 | MEDIUM | 需要 API key 与 OAuth 两种路径 |
| 定时 warm-up | 多账号用户会期望自动化维持活跃 | HIGH | 依赖本地时间、调度、事件反馈和错过任务补跑 |
| 应用级备份导入导出 | 多设备/重装场景需要迁移配置 | HIGH | 必须保留 slim/full 两条能力链 |
| 设置页与安全模式 | 备份策略、调度、语言都需要设置入口 | MEDIUM | 首版必须包含 keychain/passphrase 路线 |
| 中英文界面切换与持久化 | 这是本项目显式需求，缺失就不是合格 v1 | MEDIUM | 必须覆盖前端和后端消息回传 |

### Differentiators (Competitive Advantage)

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| 本地化错误/状态模型 | 双语体验完整、减少原生英文泄漏 | MEDIUM | 需要 Go 错误码 → 前端 i18n key 映射 |
| 更安全的账号切换事务 | 降低切换失败后进入中间态的概率 | HIGH | 需要拆清进程、文件和状态更新边界 |
| 与 origin 数据/备份兼容 | 降低迁移成本，方便老用户切换新版本 | HIGH | 需明确是否兼容旧 `.cswf` 与 slim payload |
| 更克制的轮询与事件驱动 | 降低桌面资源消耗，提升稳定性 | MEDIUM | 用事件/可见性策略替代粗暴高频 polling |
| 可测试的前后端契约 | 后续演进速度更快，回归更稳 | HIGH | 不直接给用户“新功能”，但决定长期质量 |

### Anti-Features (Commonly Requested, Often Problematic)

| Feature | Why Requested | Why Problematic | Alternative |
|---------|---------------|-----------------|-------------|
| `Add Account > Import File` | 看起来能快速导入单个 `auth.json` | 用户已明确不需要，且会扩展 UI/后端边界并稀释重构重点 | 仅保留应用级 slim/full 备份导入导出 |
| 云端同步/多人共享 | 方便多机共享账号池 | 与“本地单用户桌面工具”冲突，安全与合规风险高 | 保持本地导出/导入迁移 |
| v1 支持更多语言 | 看起来能扩大受众 | 会拖慢双语闭环落地，且文案治理成本急剧上升 | 首版只做 `zh-CN` / `en-US` |
| 永久在线后台守护进程 | 似乎能让调度更可靠 | 会抬高系统复杂度、资源占用和跨平台维护成本 | 先保留“应用打开时工作”的模型 |

## Feature Dependencies

```text
[OAuth Add Account]
    └──requires──> [Account Store]
                          └──requires──> [Settings and Security Model]

[Account Switching]
    ├──requires──> [Account Store]
    ├──requires──> [auth.json Writer]
    └──requires──> [Codex Process Detection]

[Usage Dashboard]
    └──requires──> [OAuth/API Key Credential Management]

[Scheduled Warmup]
    ├──requires──> [Warmup API Adapter]
    ├──requires──> [Settings Persistence]
    └──requires──> [Desktop Eventing]

[Full Bilingual UX]
    ├──requires──> [Translation Resources]
    ├──requires──> [Locale Persistence]
    └──requires──> [Localized Backend Status Model]
```

### Dependency Notes

- **账号切换 requires 进程检测:** 切换不仅是写配置文件，还要决定是否安全处理运行中的 Codex 进程。
- **Scheduled Warmup requires Desktop Eventing:** 需要把后台调度结果回推到 UI，而不是只靠轮询。
- **完整国际化 requires Localized Backend Status Model:** 只翻译静态界面文案无法覆盖真实错误路径。
- **备份导入导出 enhances 账号管理:** 它不是账号 CRUD 的前提，但它决定老用户是否能顺利迁移。

## MVP Definition

### Launch With (v1)

- [ ] 多账号本地存储、列表、重命名、删除、遮罩
- [ ] ChatGPT OAuth 添加账号
- [ ] 活跃账号切换、`auth.json` 同步、进程冲突确认
- [ ] usage 查看与单账号/全量 refresh
- [ ] 单账号/全量 warm-up
- [ ] 定时 warm-up 与错过补跑
- [ ] slim/full 备份导入导出
- [ ] 备份安全模式设置
- [ ] `zh-CN` / `en-US` 国际化、系统语言检测、手动切换与持久化

### Add After Validation (v1.x)

- [ ] 更细粒度的刷新策略与性能优化
- [ ] 老备份格式迁移向导/兼容检测助手
- [ ] 更丰富的账号筛选、排序与批量操作

### Future Consideration (v2+)

- [ ] 系统托盘/后台常驻模式
- [ ] 第三种以上语言
- [ ] 云端同步或团队共享能力

## Feature Prioritization Matrix

| Feature | User Value | Implementation Cost | Priority |
|---------|------------|---------------------|----------|
| 多账号与切换 | HIGH | HIGH | P1 |
| OAuth 添加账号 | HIGH | MEDIUM | P1 |
| usage 查看 | HIGH | MEDIUM | P1 |
| warm-up 与定时 warm-up | HIGH | HIGH | P1 |
| slim/full 备份导入导出 | HIGH | HIGH | P1 |
| 双语国际化 | HIGH | MEDIUM | P1 |
| 更克制的轮询/事件驱动 | MEDIUM | MEDIUM | P2 |
| 旧备份兼容/迁移助手 | MEDIUM | HIGH | P2 |
| 系统托盘 | LOW | MEDIUM | P3 |

**Priority key:**
- P1: Must have for launch
- P2: Should have, add when possible
- P3: Nice to have, future consideration

## Competitor Feature Analysis

| Feature | `codex-switcher-origin` | 典型桌面账号管理器 | Our Approach |
|---------|-------------------------|-------------------|--------------|
| 多账号 + 切换 | 已实现，但事务边界隐式 | 通常支持 | 保留能力，重构成显式 Go 服务边界 |
| OAuth 添加账号 | 已实现 | 视产品而定 | 保留并做更稳的取消/超时处理 |
| 单账号文件导入 | 已实现 | 常见但非必要 | 明确移除，不纳入 v1 |
| 定时 warm-up | 已实现 | 不一定有 | 保留并强化事件/测试闭环 |
| 双语国际化 | 基本没有 | 取决于产品定位 | 作为 v1 硬约束实现 |

## Sources

- `codex-switcher-origin` 代码地图与现有能力分析
- Wails 官方文档（项目形态、事件、安装）
- i18next / react-i18next 官方文档（语言切换、fallback、hook 用法）

---
*Feature research for: local Codex multi-account desktop manager*
*Researched: 2026-03-11*
