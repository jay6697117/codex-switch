# 03-03 Summary

## Outcome

03-03 已完成。账号工作区现在已经把 OAuth-only Add Account 流程和 usage 展示/刷新能力接入到 Wails shell 中，且保持了 `AppShell` 只负责 bootstrap、`AccountSection` 负责 orchestration 的边界。

## Delivered

- 在账号工具区加入 `Add Account` 和 `Refresh All` 动作
- 新增 OAuth-only modal，支持开始登录、再次打开浏览器、完成登录、取消登录
- 明确保持不支持 `Import File`
- 在账号卡片中接入 usage 面板，显示 `5h` / `Weekly` 窗口
- 支持单账号 usage 刷新和全量 usage 刷新
- 在 OAuth 完成、账号切换、账号删除后同步维护 usage 缓存
- 补齐 `auth` / `usage` namespace 与对应错误码映射
- 更新前端单测与 Playwright smoke，覆盖 OAuth modal、usage 渲染和刷新路径

## Verification

- `cd frontend && npm run typecheck`
- `cd frontend && npm test`
- `cd frontend && npm run e2e`
- `go test ./...`
- `wails build -clean`

## Notes

- 03-03 没有新增 Go/Wails backend API，只消费现有 typed facades
- 浏览器跳转通过 Wails runtime `BrowserOpenURL()` 完成，没有回退到 `window.open`
- 新增账号后默认执行一次全量 usage 刷新，保证新卡片立刻拥有 usage 状态
