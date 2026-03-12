---
phase: 05-backup-and-preference-management
plan: 01
subsystem: backup
tags: [go, backup, compatibility, settings, keychain]
completed: 2026-03-12
---

# 05-01 Summary

05-01 已完成，核心结果是把 backup/settings 的 Go 领域逻辑和 Wails surface 建起来了。

- 新增 `internal/backup`，支持 slim/full import/export、旧格式导入兼容、duplicate skip 和 active/auth.json 同步。
- 新增 `PreferencesService`，把 `localePreference` 与 `backupSecurityMode` 变成明确的 settings 入口。
- `app.go` 已暴露 backup/settings 所需的 8 个 Wails 方法。
- `backup.Service` 默认 ID 生成器改为稳定唯一值，不再使用时间戳字符串。

验证：
- `go test ./...`

关键决定：
- 新 full export 只保证新项目 round-trip 与旧格式导入兼容，不要求 origin 反向读取。
