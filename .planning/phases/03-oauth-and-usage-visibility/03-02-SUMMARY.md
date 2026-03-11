# 03-02 Summary

## Outcome

Implemented usage normalization, refresh-aware ChatGPT usage fetching, and typed single-account/bulk usage facades.

## Delivered

- Added `internal/usage/` with normalized `supported / unsupported / unavailable` snapshots, 5-hour and weekly window mapping, and bulk refresh aggregation.
- Added `internal/auth/token_service.go` plus an HTTP refresh exchanger so near-expiry ChatGPT tokens refresh through the shared account repository and keep active `auth.json` in sync.
- Implemented `401 -> refresh -> retry once` inside the Go usage service instead of leaking retry semantics into the frontend.
- Expanded `app.go` with `GetAccountUsage` and `RefreshAllUsage`, and extended frontend typed contracts/facades for usage snapshots and bulk refresh results.
- Regenerated Wails bindings so the new usage methods are available through generated app bindings.

## Verification

- `go test ./...`
- `cd frontend && npm run typecheck`
- `cd frontend && npm test`
- `wails build -clean`
