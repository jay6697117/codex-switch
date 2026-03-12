package main

import (
	"context"
	"errors"
	"time"

	"codex-switch/internal/accounts"
	"codex-switch/internal/auth"
	"codex-switch/internal/bootstrap"
	"codex-switch/internal/contracts"
	platformlocale "codex-switch/internal/platform/locale"
	platformprocess "codex-switch/internal/platform/process"
	"codex-switch/internal/scheduler"
	"codex-switch/internal/settings"
	"codex-switch/internal/switching"
	"codex-switch/internal/usage"
	"codex-switch/internal/warmup"

	wailsruntime "github.com/wailsapp/wails/v2/pkg/runtime"
)

type App struct {
	ctx              context.Context
	bootstrapService *bootstrap.Service
	accountService   *accounts.Service
	authService      *auth.Service
	tokenService     *auth.TokenService
	switchService    *switching.Service
	usageService     *usage.Service
	warmupService    *warmup.Service
	scheduleService  *settings.WarmupScheduleService
	schedulerRuntime *scheduler.Runtime
}

func NewApp() *App {
	repository := accounts.DefaultFileRepository()
	authStore := switching.DefaultFileAuthStore()
	tokenService := auth.NewTokenService(
		repository,
		authStore,
		auth.DefaultHTTPRefreshExchanger(),
	)
	warmupService := warmup.NewService(
		repository,
		tokenService,
		warmup.DefaultHTTPProvider(),
	)
	scheduleService := settings.NewWarmupScheduleService(
		settings.DefaultStore(),
		repository,
	)
	schedulerRuntime := scheduler.NewRuntime(
		scheduleService,
		scheduler.NewWarmupServiceRunner(warmupService),
		scheduler.FuncEventSink(func(ctx context.Context, event contracts.WarmupRuntimeEvent) error {
			if ctx == nil {
				return nil
			}

			wailsruntime.EventsEmit(ctx, contracts.WarmupRuntimeEventName, event)
			return nil
		}),
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
		warmupService:    warmupService,
		scheduleService:  scheduleService,
		schedulerRuntime: schedulerRuntime,
	}
}

func (a *App) startup(ctx context.Context) {
	a.ctx = ctx
	if a.schedulerRuntime != nil {
		a.schedulerRuntime.Start(ctx)
	}
}

func (a *App) LoadBootstrap() (contracts.BootstrapPayload, error) {
	if a.ctx == nil {
		return a.bootstrapService.Load(context.Background())
	}

	return a.bootstrapService.Load(a.ctx)
}

func (a *App) LoadAccounts() contracts.ResultEnvelope[contracts.AccountsSnapshot] {
	snapshot, err := a.accountService.LoadAccounts(a.requestContext())
	if err == nil {
		snapshot = a.decorateAccountsSnapshot(snapshot)
	}
	return wrapResult(snapshot, err, "account.load_failed")
}

func (a *App) RenameAccount(input contracts.RenameAccountInput) contracts.ResultEnvelope[contracts.AccountsSnapshot] {
	snapshot, err := a.accountService.RenameAccount(a.requestContext(), input.ID, input.DisplayName)
	if err == nil {
		snapshot = a.decorateAccountsSnapshot(snapshot)
	}
	return wrapResult(snapshot, err, "account.rename_failed")
}

func (a *App) DeleteAccount(accountID string) contracts.ResultEnvelope[contracts.AccountsSnapshot] {
	snapshot, err := a.accountService.DeleteAccount(a.requestContext(), accountID)
	if err == nil {
		snapshot = a.decorateAccountsSnapshot(snapshot)
	}
	return wrapResult(snapshot, err, "account.delete_failed")
}

func (a *App) GetProcessStatus() contracts.ResultEnvelope[contracts.ProcessStatus] {
	status, err := a.switchService.GetProcessStatus(a.requestContext())
	return wrapResult(status, err, "process.detect_failed")
}

func (a *App) SwitchAccount(input contracts.SwitchAccountInput) contracts.ResultEnvelope[contracts.SwitchAccountResult] {
	result, err := a.switchService.SwitchAccount(a.requestContext(), input)
	if err == nil {
		result.Accounts = a.decorateAccountsSnapshot(result.Accounts)
	}
	return wrapResult(result, err, "switch.active_update_failed")
}

func (a *App) StartOAuthLogin(input contracts.StartOAuthLoginInput) contracts.ResultEnvelope[contracts.OAuthLoginInfo] {
	info, err := a.authService.StartLogin(a.requestContext(), input.AccountName)
	return wrapResult(info, err, "oauth.start_failed")
}

func (a *App) CompleteOAuthLogin() contracts.ResultEnvelope[contracts.AccountsSnapshot] {
	snapshot, err := a.authService.CompleteLogin(a.requestContext())
	if err == nil {
		snapshot = a.decorateAccountsSnapshot(snapshot)
	}
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

func (a *App) WarmupAccount(accountID string) contracts.ResultEnvelope[contracts.WarmupAccountResult] {
	result, err := a.warmupService.WarmupAccount(a.requestContext(), accountID)
	return wrapResult(mapWarmupAccountResult(result), err, "warmup.execute_failed")
}

func (a *App) WarmupAllAccounts() contracts.ResultEnvelope[contracts.WarmupAllResult] {
	result, err := a.warmupService.WarmupAllAccounts(a.requestContext())
	return wrapResult(mapWarmupAllResult(result), err, "warmup.execute_failed")
}

func (a *App) LoadWarmupScheduleStatus() contracts.ResultEnvelope[contracts.WarmupScheduleStatus] {
	status, err := a.loadWarmupScheduleStatus(a.requestContext())
	return wrapResult(status, err, "warmup.schedule_load_failed")
}

func (a *App) SaveWarmupSchedule(
	input contracts.WarmupScheduleInput,
) contracts.ResultEnvelope[contracts.WarmupScheduleStatus] {
	if _, err := a.scheduleService.Save(a.requestContext(), input); err != nil {
		return wrapResult(contracts.WarmupScheduleStatus{}, err, "warmup.schedule_load_failed")
	}

	status, err := a.loadWarmupScheduleStatus(a.requestContext())
	return wrapResult(status, err, "warmup.schedule_load_failed")
}

func (a *App) DismissMissedRunToday() contracts.ResultEnvelope[contracts.WarmupScheduleStatus] {
	if a.schedulerRuntime == nil {
		status, err := a.loadWarmupScheduleStatus(a.requestContext())
		return wrapResult(status, err, "warmup.schedule_load_failed")
	}

	if err := a.schedulerRuntime.DismissMissedRunToday(a.requestContext()); err != nil {
		return wrapResult(contracts.WarmupScheduleStatus{}, err, "warmup.schedule_load_failed")
	}

	status, err := a.loadWarmupScheduleStatus(a.requestContext())
	return wrapResult(status, err, "warmup.schedule_load_failed")
}

func (a *App) RunMissedWarmupNow() contracts.ResultEnvelope[contracts.WarmupScheduleStatus] {
	if a.schedulerRuntime == nil {
		return wrapResult(
			contracts.WarmupScheduleStatus{},
			contracts.AppError{Code: "warmup.execute_failed"},
			"warmup.execute_failed",
		)
	}

	if _, err := a.schedulerRuntime.RunMissedWarmupNow(a.requestContext()); err != nil {
		return wrapResult(contracts.WarmupScheduleStatus{}, err, "warmup.execute_failed")
	}

	status, err := a.loadWarmupScheduleStatus(a.requestContext())
	return wrapResult(status, err, "warmup.execute_failed")
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

func (a *App) loadWarmupScheduleStatus(
	ctx context.Context,
) (contracts.WarmupScheduleStatus, error) {
	if a.schedulerRuntime != nil {
		return a.schedulerRuntime.LoadStatus(ctx)
	}

	return a.scheduleService.LoadStatus(ctx, time.Now())
}

func (a *App) decorateAccountsSnapshot(snapshot contracts.AccountsSnapshot) contracts.AccountsSnapshot {
	availabilityItems, err := a.warmupService.ListAvailability(a.requestContext())
	if err != nil {
		for index := range snapshot.Accounts {
			snapshot.Accounts[index].WarmupAvailability = contracts.WarmupAvailability{
				IsAvailable: false,
				ReasonCode:  stringPointer("warmup.load_failed"),
			}
		}

		return snapshot
	}

	availabilityByAccountID := make(map[string]contracts.WarmupAvailability, len(availabilityItems))
	for _, item := range availabilityItems {
		availabilityByAccountID[item.AccountID] = mapWarmupAvailability(item)
	}

	for index := range snapshot.Accounts {
		availability, ok := availabilityByAccountID[snapshot.Accounts[index].ID]
		if !ok {
			snapshot.Accounts[index].WarmupAvailability = contracts.WarmupAvailability{
				IsAvailable: false,
				ReasonCode:  stringPointer("warmup.load_failed"),
			}
			continue
		}

		snapshot.Accounts[index].WarmupAvailability = availability
	}

	return snapshot
}

func mapWarmupAllResult(input warmup.WarmupAllResult) contracts.WarmupAllResult {
	items := make([]contracts.WarmupAccountResult, 0, len(input.Items))
	for _, item := range input.Items {
		items = append(items, mapWarmupAccountResult(item))
	}

	return contracts.WarmupAllResult{
		Items: items,
		Summary: contracts.WarmupSummary{
			TotalAccounts:      input.Summary.TotalAccounts,
			EligibleAccounts:   input.Summary.EligibleAccounts,
			SuccessfulAccounts: input.Summary.SuccessfulAccounts,
			FailedAccounts:     input.Summary.FailedAccounts,
			SkippedAccounts:    input.Summary.SkippedAccounts,
		},
	}
}

func mapWarmupAccountResult(input warmup.AccountWarmupResult) contracts.WarmupAccountResult {
	return contracts.WarmupAccountResult{
		AccountID:    input.AccountID,
		Availability: mapWarmupAvailability(input.Availability),
		Status:       input.Status,
		FailureCode:  copyString(input.FailureCode),
		CompletedAt:  input.CompletedAt,
	}
}

func mapWarmupAvailability(input warmup.Availability) contracts.WarmupAvailability {
	return contracts.WarmupAvailability{
		IsAvailable: input.IsAvailable,
		ReasonCode:  copyString(input.ReasonCode),
	}
}

func copyString(value *string) *string {
	if value == nil {
		return nil
	}

	copyValue := *value
	return &copyValue
}

func stringPointer(value string) *string {
	return &value
}
