package main

import (
	"context"
	"errors"

	"codex-switch/internal/accounts"
	"codex-switch/internal/auth"
	"codex-switch/internal/bootstrap"
	"codex-switch/internal/contracts"
	platformlocale "codex-switch/internal/platform/locale"
	platformprocess "codex-switch/internal/platform/process"
	"codex-switch/internal/settings"
	"codex-switch/internal/switching"
	"codex-switch/internal/usage"
)

type App struct {
	ctx              context.Context
	bootstrapService *bootstrap.Service
	accountService   *accounts.Service
	authService      *auth.Service
	tokenService     *auth.TokenService
	switchService    *switching.Service
	usageService     *usage.Service
}

func NewApp() *App {
	repository := accounts.DefaultFileRepository()
	authStore := switching.DefaultFileAuthStore()
	tokenService := auth.NewTokenService(
		repository,
		authStore,
		auth.DefaultHTTPRefreshExchanger(),
	)

	return &App{
		bootstrapService: bootstrap.NewService(
			settings.DefaultStore(),
			platformlocale.NewDetector(),
		),
		accountService: accounts.NewService(repository),
		authService: auth.NewService(
			repository,
			authStore,
			auth.DefaultLocalStarter(),
		),
		tokenService: tokenService,
		switchService: switching.NewService(
			repository,
			authStore,
			platformprocess.NewOSController(),
		),
		usageService: usage.NewService(
			repository,
			tokenService,
			usage.DefaultHTTPFetcher(),
		),
	}
}

func (a *App) startup(ctx context.Context) {
	a.ctx = ctx
}

func (a *App) LoadBootstrap() (contracts.BootstrapPayload, error) {
	if a.ctx == nil {
		return a.bootstrapService.Load(context.Background())
	}

	return a.bootstrapService.Load(a.ctx)
}

func (a *App) LoadAccounts() contracts.ResultEnvelope[contracts.AccountsSnapshot] {
	snapshot, err := a.accountService.LoadAccounts(a.requestContext())
	return wrapResult(snapshot, err, "account.load_failed")
}

func (a *App) RenameAccount(input contracts.RenameAccountInput) contracts.ResultEnvelope[contracts.AccountsSnapshot] {
	snapshot, err := a.accountService.RenameAccount(a.requestContext(), input.ID, input.DisplayName)
	return wrapResult(snapshot, err, "account.rename_failed")
}

func (a *App) DeleteAccount(accountID string) contracts.ResultEnvelope[contracts.AccountsSnapshot] {
	snapshot, err := a.accountService.DeleteAccount(a.requestContext(), accountID)
	return wrapResult(snapshot, err, "account.delete_failed")
}

func (a *App) GetProcessStatus() contracts.ResultEnvelope[contracts.ProcessStatus] {
	status, err := a.switchService.GetProcessStatus(a.requestContext())
	return wrapResult(status, err, "process.detect_failed")
}

func (a *App) SwitchAccount(input contracts.SwitchAccountInput) contracts.ResultEnvelope[contracts.SwitchAccountResult] {
	result, err := a.switchService.SwitchAccount(a.requestContext(), input)
	return wrapResult(result, err, "switch.active_update_failed")
}

func (a *App) StartOAuthLogin(input contracts.StartOAuthLoginInput) contracts.ResultEnvelope[contracts.OAuthLoginInfo] {
	info, err := a.authService.StartLogin(a.requestContext(), input.AccountName)
	return wrapResult(info, err, "oauth.start_failed")
}

func (a *App) CompleteOAuthLogin() contracts.ResultEnvelope[contracts.AccountsSnapshot] {
	snapshot, err := a.authService.CompleteLogin(a.requestContext())
	return wrapResult(snapshot, err, "oauth.complete_failed")
}

func (a *App) CancelOAuthLogin() contracts.ResultEnvelope[contracts.OAuthCancelResult] {
	err := a.authService.CancelLogin(a.requestContext())
	return wrapResult(contracts.OAuthCancelResult{Pending: false}, err, "oauth.cancel_failed")
}

func (a *App) GetAccountUsage(accountID string) contracts.ResultEnvelope[contracts.AccountUsageSnapshot] {
	snapshot, err := a.usageService.GetAccountUsage(a.requestContext(), accountID)
	return wrapResult(snapshot, err, "usage.load_failed")
}

func (a *App) RefreshAllUsage() contracts.ResultEnvelope[contracts.UsageCollection] {
	result, err := a.usageService.RefreshAllUsage(a.requestContext())
	return wrapResult(result, err, "usage.load_failed")
}

func (a *App) requestContext() context.Context {
	if a.ctx != nil {
		return a.ctx
	}

	return context.Background()
}

func wrapResult[T any](data T, err error, fallbackCode string) contracts.ResultEnvelope[T] {
	if err == nil {
		return contracts.ResultEnvelope[T]{Data: data}
	}

	var appErr contracts.AppError
	if errors.As(err, &appErr) {
		return contracts.ResultEnvelope[T]{Error: &appErr}
	}

	return contracts.ResultEnvelope[T]{
		Error: &contracts.AppError{Code: fallbackCode},
	}
}
