# 06-01 Summary

## Outcome

06-01 已完成。本轮把 Phase 6 的本地化闭环真正接通了：后端成功态开始通过 `ResultEnvelope.message` 向前端传递结构化消息，账号区复用了现有 banner 反馈面展示 add/switch 成功文案，usage 和 warmup 的时间展示改成显式绑定 app locale，full-backup 文件对话框文案也改为由 Go 侧按有效 locale 决定。

## Delivered

- 激活 `ResultEnvelope.message`，并在 `CompleteOAuthLogin` / `SwitchAccount` 成功时返回结构化 success message
- 前端 bridge / services 保留 success message，不再在 facade 层静默丢弃
- `AccountSection` 复用现有 section-level feedback banner 展示 add-account / switch 成功反馈
- 新增 locale-aware formatting helper，替换 usage reset time 和 warmup next-run 的默认/固定格式
- 去除 usage 卡片对 `planType` 原始字符串的直出，改为受控映射
- full-backup 的导入/导出文件对话框标题与过滤器文案改为后端按 `effectiveLocale` 返回
- 补齐前端 `errors` namespace 中缺失的 backend error code：
  - `auth.account_not_found`
  - `auth.refresh_failed`
  - `process.stop_failed`
  - `process.restart_failed`
- 新增两条 guardrail：
  - backend `AppError.code` 与前端 `errors` 字典覆盖校验
  - `zh-CN` / `en-US` 资源 key shape 一致性校验

## Verification

- `go test ./...`
- `cd frontend && npm run typecheck`
- `cd frontend && npm test`
- `wails build -clean`

## Notes

- 06-01 没有引入新的 toast 系统，继续复用账号区和现有 modal/banner 反馈面
- 成功消息目前先覆盖 add-account 和 account-switch 两条主链，符合本 plan 的最小闭环目标
- 发布版本号 build-time 注入和 macOS release workflow 仍留在 06-03 处理
