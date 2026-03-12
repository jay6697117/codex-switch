package scheduler

import (
	"context"
	"sync"
	"time"

	"codex-switch/internal/contracts"
	"codex-switch/internal/settings"
	"codex-switch/internal/warmup"
)

const (
	WarmupRuntimeTriggerScheduled    = contracts.WarmupRuntimeTriggerScheduled
	WarmupRuntimeTriggerMissedPrompt = contracts.WarmupRuntimeTriggerMissedPrompt
)

type WarmupRunner interface {
	RunAccountIDs(ctx context.Context, accountIDs []string) (warmup.WarmupAllResult, error)
}

type EventSink interface {
	EmitWarmupEvent(ctx context.Context, event contracts.WarmupRuntimeEvent) error
}

type Runtime struct {
	schedules        *settings.WarmupScheduleService
	runner           WarmupRunner
	eventSink        EventSink
	now              func() time.Time
	tickInterval     time.Duration
	sessionStartedAt time.Time
	startOnce        sync.Once
}

type warmupServiceRunner struct {
	service *warmup.Service
}

type FuncEventSink func(ctx context.Context, event contracts.WarmupRuntimeEvent) error

func NewRuntime(
	schedules *settings.WarmupScheduleService,
	runner WarmupRunner,
	eventSink EventSink,
) *Runtime {
	return newRuntime(schedules, runner, eventSink, time.Now, 30*time.Second)
}

func NewWarmupServiceRunner(service *warmup.Service) WarmupRunner {
	return warmupServiceRunner{service: service}
}

func (f FuncEventSink) EmitWarmupEvent(
	ctx context.Context,
	event contracts.WarmupRuntimeEvent,
) error {
	return f(ctx, event)
}

func (r *Runtime) Start(ctx context.Context) {
	r.startOnce.Do(func() {
		ticker := time.NewTicker(r.tickInterval)
		go func() {
			defer ticker.Stop()

			for {
				select {
				case <-ctx.Done():
					return
				case <-ticker.C:
					_ = r.Check(ctx)
				}
			}
		}()
	})
}

func (r *Runtime) SessionStartedAt() time.Time {
	return r.sessionStartedAt
}

func (r *Runtime) LoadStatus(ctx context.Context) (contracts.WarmupScheduleStatus, error) {
	return r.schedules.LoadStatusAt(ctx, r.sessionStartedAt, r.now())
}

func (r *Runtime) Check(ctx context.Context) error {
	status, err := r.LoadStatus(ctx)
	if err != nil {
		return err
	}

	shouldRun, err := shouldRunScheduledNow(status, r.sessionStartedAt, r.now())
	if err != nil {
		return err
	}
	if !shouldRun {
		return nil
	}

	result, err := r.runner.RunAccountIDs(ctx, status.ValidAccountIDs)
	if err != nil {
		return err
	}
	if result.Summary.TotalAccounts == 0 {
		return nil
	}

	if err := r.schedules.MarkCompleted(ctx, localDateString(r.now())); err != nil {
		return err
	}

	return r.eventSink.EmitWarmupEvent(ctx, contracts.WarmupRuntimeEvent{
		Trigger:     WarmupRuntimeTriggerScheduled,
		CompletedAt: r.now().Format(time.RFC3339),
		Result:      mapWarmupAllResult(result),
	})
}

func (r *Runtime) DismissMissedRunToday(ctx context.Context) error {
	return r.schedules.SuppressMissedPrompt(ctx, localDateString(r.now()))
}

func (r *Runtime) RunMissedWarmupNow(ctx context.Context) (warmup.WarmupAllResult, error) {
	status, err := r.LoadStatus(ctx)
	if err != nil {
		return warmup.WarmupAllResult{}, err
	}

	if status.Schedule == nil || !status.Schedule.Enabled {
		return warmup.WarmupAllResult{}, contracts.AppError{Code: "warmup.schedule_disabled"}
	}
	if len(status.ValidAccountIDs) == 0 {
		return warmup.WarmupAllResult{}, contracts.AppError{Code: "warmup.schedule_accounts_required"}
	}

	result, err := r.runner.RunAccountIDs(ctx, status.ValidAccountIDs)
	if err != nil {
		return warmup.WarmupAllResult{}, err
	}
	if result.Summary.TotalAccounts == 0 {
		return result, nil
	}

	if err := r.schedules.MarkCompleted(ctx, localDateString(r.now())); err != nil {
		return warmup.WarmupAllResult{}, err
	}
	if err := r.eventSink.EmitWarmupEvent(ctx, contracts.WarmupRuntimeEvent{
		Trigger:     WarmupRuntimeTriggerMissedPrompt,
		CompletedAt: r.now().Format(time.RFC3339),
		Result:      mapWarmupAllResult(result),
	}); err != nil {
		return warmup.WarmupAllResult{}, err
	}

	return result, nil
}

func (r warmupServiceRunner) RunAccountIDs(
	ctx context.Context,
	accountIDs []string,
) (warmup.WarmupAllResult, error) {
	return r.service.WarmupAccounts(ctx, accountIDs)
}

func newRuntime(
	schedules *settings.WarmupScheduleService,
	runner WarmupRunner,
	eventSink EventSink,
	now func() time.Time,
	tickInterval time.Duration,
) *Runtime {
	if eventSink == nil {
		eventSink = FuncEventSink(func(context.Context, contracts.WarmupRuntimeEvent) error {
			return nil
		})
	}

	return &Runtime{
		schedules:        schedules,
		runner:           runner,
		eventSink:        eventSink,
		now:              now,
		tickInterval:     tickInterval,
		sessionStartedAt: now(),
	}
}

func shouldRunScheduledNow(
	status contracts.WarmupScheduleStatus,
	sessionStartedAt time.Time,
	now time.Time,
) (bool, error) {
	if status.Schedule == nil || !status.Schedule.Enabled || len(status.ValidAccountIDs) == 0 {
		return false, nil
	}

	if dereferenceDate(status.Schedule.LastRunLocalDate) == localDateString(now) {
		return false, nil
	}

	hour, minute, err := parseClock(status.Schedule.LocalTime)
	if err != nil {
		return false, err
	}

	scheduledAt := time.Date(
		now.Year(),
		now.Month(),
		now.Day(),
		hour,
		minute,
		0,
		0,
		now.Location(),
	)

	if sessionStartedAt.After(scheduledAt) {
		return false, nil
	}

	return !now.Before(scheduledAt), nil
}

func mapWarmupSummary(input warmup.WarmupSummary) contracts.WarmupSummary {
	return contracts.WarmupSummary{
		TotalAccounts:      input.TotalAccounts,
		EligibleAccounts:   input.EligibleAccounts,
		SuccessfulAccounts: input.SuccessfulAccounts,
		FailedAccounts:     input.FailedAccounts,
		SkippedAccounts:    input.SkippedAccounts,
	}
}

func mapWarmupAllResult(input warmup.WarmupAllResult) contracts.WarmupAllResult {
	items := make([]contracts.WarmupAccountResult, 0, len(input.Items))
	for _, item := range input.Items {
		items = append(items, contracts.WarmupAccountResult{
			AccountID: item.AccountID,
			Availability: contracts.WarmupAvailability{
				IsAvailable: item.Availability.IsAvailable,
				ReasonCode:  copyString(item.Availability.ReasonCode),
			},
			Status:      item.Status,
			FailureCode: copyString(item.FailureCode),
			CompletedAt: item.CompletedAt,
		})
	}

	return contracts.WarmupAllResult{
		Items:   items,
		Summary: mapWarmupSummary(input.Summary),
	}
}

func localDateString(value time.Time) string {
	return value.Format("2006-01-02")
}

func parseClock(value string) (int, int, error) {
	parsed, err := time.Parse("15:04", value)
	if err != nil {
		return 0, 0, err
	}

	return parsed.Hour(), parsed.Minute(), nil
}

func dereferenceDate(value *string) string {
	if value == nil {
		return ""
	}

	return *value
}

func copyString(value *string) *string {
	if value == nil {
		return nil
	}

	copyValue := *value
	return &copyValue
}
