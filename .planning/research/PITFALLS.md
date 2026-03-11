# Pitfalls Research

**Domain:** Go + Wails 本地桌面多账号管理器
**Researched:** 2026-03-11
**Confidence:** HIGH

## Critical Pitfalls

### Pitfall 1: 把 origin 的页面状态整块平移到新前端

**What goes wrong:**
新的 Wails 前端依然出现一个超大页面 orchestrator，账号、usage、warmup、备份、设置、i18n 全部耦合在一起。

**Why it happens:**
“先做功能对齐”很容易演变成“按旧文件结构重写”。

**How to avoid:**
从 Phase 1 就先定 feature modules、app service facade 和 Go contracts，不允许组件直接穿透到 native binding。

**Warning signs:**
- 单个页面文件快速膨胀
- 组件里直接调用多个 Wails bindings
- i18n、toast、业务状态都堆在同一个 hook 里

**Phase to address:**
Phase 1

---

### Pitfall 2: 把账号切换当成“写一个文件”这么简单

**What goes wrong:**
切换过程中出现 UI 已切换、`auth.json` 未切换，或进程已停止但未恢复的中间态。

**Why it happens:**
切换链路同时涉及进程检测、进程停止、`auth.json` 改写、active state 更新和用户确认。

**How to avoid:**
为切换设计显式事务步骤、失败状态和回滚/恢复语义；切换 service 必须单独测试。

**Warning signs:**
- 同一个函数里混着进程控制、文件写入和 UI 字符串
- 失败后只能 `log + return error`

**Phase to address:**
Phase 2

---

### Pitfall 3: 国际化只覆盖前端静态文案

**What goes wrong:**
主界面是中文/英文切换的，但错误提示、toast、调度结果和后端失败信息仍然是英文原串。

**Why it happens:**
项目团队把 i18n 当成“前端字典替换”，忽略了 native backend 也是文案来源。

**How to avoid:**
Go 只返回 message code / args；前端统一用 i18n 资源生成可见文案。

**Warning signs:**
- 后端接口返回 `message: "..."` 形式的最终文案
- UI 里存在大量 `err.message` 直出

**Phase to address:**
Phase 1 and Phase 5

---

### Pitfall 4: 继续沿用高频轮询

**What goes wrong:**
桌面应用长期高频检查进程、刷新 usage，账号数量一多就增加 CPU、网络和电量消耗。

**Why it happens:**
轮询是最快做出 MVP 的方法，但会在桌面端持续付出运行时成本。

**How to avoid:**
将后台调度和长任务结果改成事件驱动；对 usage/process refresh 做节流和用户触发优先策略。

**Warning signs:**
- 固定短周期定时器很多
- bulk refresh 没有并发控制
- UI 空闲时仍频繁打 API

**Phase to address:**
Phase 3 and Phase 4

---

### Pitfall 5: 不先决定旧备份/旧数据兼容策略

**What goes wrong:**
项目后期才发现新版本打不开旧 `.cswf` 或 slim payload，或者为了兼容把不安全设计又带回来了。

**Why it happens:**
团队默认“以后再兼容”，结果备份格式和加密语义已经固化。

**How to avoid:**
在备份 phase 前明确：保留哪些旧格式兼容、丢弃哪些旧安全债、是否需要迁移向导。

**Warning signs:**
- 备份格式实现直接复制 origin 常量和分支
- 没有 compatibility matrix

**Phase to address:**
Phase 5

---

### Pitfall 6: 假设 OpenAI/Auth 边界是稳定的

**What goes wrong:**
OAuth、usage 或 token refresh 逻辑因为外部接口变化而脆断，整个桌面工具失效。

**Why it happens:**
这些能力不是你控制的后端，且 origin 已经说明它依赖多个桌面端隐式流程。

**How to avoid:**
把 OpenAI/Auth 全部隔离在 adapter 层；为关键响应解析、401 refresh、回退状态和用户提示做单独测试。

**Warning signs:**
- 外部 JSON 结构直接穿透到 UI
- 没有 401 refresh retry 和降级状态

**Phase to address:**
Phase 3

## Technical Debt Patterns

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|----------|-------------------|----------------|-----------------|
| 组件直接调用 Wails binding | 开发快 | 组件与 native 协议深耦合 | Never |
| 后端直接返回英文字符串 | 初期最省事 | i18n 永远补不干净 | Never |
| 先不做切换事务模型 | 早期能跑通主流程 | 后续很难补测试和恢复语义 | 仅在 throwaway demo，当前项目不接受 |
| 高密度 polling 替代事件 | MVP 易实现 | 桌面运行时成本高，后期难收敛 | 只允许作为短期过渡，不作为最终设计 |

## Integration Gotchas

| Integration | Common Mistake | Correct Approach |
|-------------|----------------|------------------|
| Wails bindings | Go 签名改了却没有同步前端 facade | 所有 binding 只在 facade 层暴露，变更统一收口 |
| OAuth callback | 假设固定端口总能用 | 保留默认端口，但必须支持 fallback 和取消/超时 |
| OS keychain | 把 keychain 异常当成普通字符串错误 | 为 keychain 不可用场景定义显式状态与 UI 提示 |
| ChatGPT usage API | 401 直接报错退出 | 先尝试 refresh，再返回可本地化失败结果 |
| 备份兼容 | 先做新格式，旧格式以后再说 | 先写 compatibility decision，再实现 |

## Performance Traps

| Trap | Symptoms | Prevention | When It Breaks |
|------|----------|------------|----------------|
| 全量顺序刷新 usage | 多账号时刷新明显变慢 | 受控并发 + 节流 + 手动优先 | 10+ 账号后明显感知 |
| 高频进程 polling | 桌面常驻时无意义 CPU 消耗 | 拉长周期，结合用户操作和事件 | 长时间打开应用时 |
| 全局状态驱动整页刷新 | 一次小变更带来大范围 rerender | feature-scoped state + memoized lists | 账号列表和 toast 数量上来后 |

## Security Mistakes

| Mistake | Risk | Prevention |
|---------|------|------------|
| 打印敏感登录/usage 上下文 | 泄漏账号和认证细节 | 日志脱敏 + 级别控制 |
| 延续静态 fallback passphrase | 所有弱模式备份共享同一秘密 | 默认 keychain/passphrase，弱模式仅兼容且默认禁用 |
| 把未验签 JWT claim 用于关键授权 | 伪造 claim 导致错误决策 | claim 只做显示或显式校验 |
| 文件权限和锁语义不明确 | 本地 secrets 与并发写入风险 | 显式 lock + restrictive permissions |

## UX Pitfalls

| Pitfall | User Impact | Better Approach |
|---------|-------------|-----------------|
| 语言切换只改主界面 | 用户感觉产品“半翻译” | 所有可见路径都走统一 i18n key |
| 切换账号时不解释进程影响 | 用户不理解为什么失败或为何要重启 | 明确展示前景/后台 Codex 进程状态与确认文案 |
| 定时 warm-up 配置状态不透明 | 用户不知道有没有成功保存和何时执行 | 显示下次执行时间、错过补跑提示与最近结果 |
| 备份安全模式解释不清 | 用户误选弱模式或忘记 passphrase | 设置页明确比较安全级别和恢复前提 |

## "Looks Done But Isn't" Checklist

- [ ] **国际化:** 常见错误、toast、模态框按钮、设置说明都已双语化，不只是主界面标题
- [ ] **账号切换:** 已验证进程运行中、拒绝重启、重启成功、重启失败这几条路径
- [ ] **调度:** 已覆盖本地时间、重启后错过任务、禁用后再启用的行为
- [ ] **备份:** 已覆盖 passphrase 不匹配、keychain 不可用、重复导入跳过策略
- [ ] **功能裁剪:** `Add Account > Import File` 在新产品中确实不存在，后端也没有等价入口

## Recovery Strategies

| Pitfall | Recovery Cost | Recovery Steps |
|---------|---------------|----------------|
| 切换事务设计错误 | HIGH | 回退到上一个稳定的 auth/process model，补事务测试后重做 |
| i18n 只做了一半 | MEDIUM | 收敛所有用户可见消息来源，统一改成 message key |
| 外部 API 适配脆弱 | MEDIUM | 隔离 adapter，补 response fixture 和 retry/failure tests |
| 旧备份兼容遗漏 | HIGH | 增加迁移脚本或兼容层，不要在 UI 里临时 patch |

## Pitfall-to-Phase Mapping

| Pitfall | Prevention Phase | Verification |
|---------|------------------|--------------|
| 巨型页面编排复刻 | Phase 1 | 代码结构与 facade/contract 已落地 |
| 切换事务中间态 | Phase 2 | 切换链路单测 + 集成测试通过 |
| 外部 API 边界脆断 | Phase 3 | 401/timeout/retry fixture 覆盖 |
| 轮询过重 | Phase 4 | 调度与刷新策略改成事件/节流后仍满足 UX |
| 备份兼容与弱安全模式 | Phase 5 | 兼容策略文档、导入导出测试、弱模式默认关闭 |
| 半成品 i18n | Phase 5 / Phase 6 | 双语冒烟检查覆盖所有核心路径 |

## Sources

- `codex-switcher-origin` 风险与代码地图分析
- Wails 官方文档（事件、项目结构、安装）
- i18next / react-i18next 官方文档
- 当前 npm / Go module 版本查询结果

---
*Pitfalls research for: Wails desktop account manager*
*Researched: 2026-03-11*
