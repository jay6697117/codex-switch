package scheduler

import (
	"context"
	"encoding/json"
	"os"
	"path/filepath"
	"testing"
	"time"

	"codex-switch/internal/accounts"
	"codex-switch/internal/contracts"
	"codex-switch/internal/settings"
	"codex-switch/internal/warmup"

	"github.com/stretchr/testify/require"
)

func TestRuntimeCheckRunsScheduledWarmupWhenAppWasOpenBeforeScheduledTime(t *testing.T) {
	t.Parallel()

	now := time.Now().Truncate(time.Minute)
	paths := newSchedulerPaths(t)
	seedSchedulerAccounts(t, paths.accounts, []string{"acct-1", "acct-2"})
	seedSchedulerSchedule(t, paths.preferences, contracts.WarmupSchedule{
		Enabled:    true,
		LocalTime:  formatClock(now.Add(-15 * time.Minute)),
		AccountIDs: []string{"acct-1", "acct-2"},
	})
	scheduleService := settings.NewWarmupScheduleService(
		settings.NewStore(paths.preferences),
		accounts.NewFileRepository(paths.accounts),
	)

	runner := &fakeWarmupRunner{
		result: warmup.WarmupAllResult{
			Items: []warmup.AccountWarmupResult{
				newWarmupResult("acct-1"),
				newWarmupResult("acct-2"),
			},
			Summary: warmup.WarmupSummary{
				TotalAccounts:      2,
				EligibleAccounts:   2,
				SuccessfulAccounts: 2,
			},
		},
	}
	emitter := &fakeEventSink{}
	runtime := newRuntime(
		scheduleService,
		runner,
		emitter,
		func() time.Time { return now },
		30*time.Second,
	)
	runtime.sessionStartedAt = now.Add(-1 * time.Hour)

	err := runtime.Check(context.Background())

	require.NoError(t, err)
	require.Equal(t, [][]string{{"acct-1", "acct-2"}}, runner.calls)
	require.Len(t, emitter.events, 1)
	require.Equal(t, WarmupRuntimeTriggerScheduled, emitter.events[0].Trigger)

	status, err := runtime.LoadStatus(context.Background())
	require.NoError(t, err)
	require.False(t, status.MissedRunToday)
	require.NotNil(t, status.Schedule)
	require.Equal(t, now.Format("2006-01-02"), dereferenceSchedulerString(status.Schedule.LastRunLocalDate))
	require.Empty(t, dereferenceSchedulerString(status.Schedule.LastMissedPromptLocalDate))
}

func TestRuntimeCheckLeavesMissedRunForPromptWhenAppOpenedLate(t *testing.T) {
	t.Parallel()

	now := time.Now().Truncate(time.Minute)
	paths := newSchedulerPaths(t)
	seedSchedulerAccounts(t, paths.accounts, []string{"acct-1"})
	seedSchedulerSchedule(t, paths.preferences, contracts.WarmupSchedule{
		Enabled:    true,
		LocalTime:  formatClock(now.Add(-30 * time.Minute)),
		AccountIDs: []string{"acct-1"},
	})
	scheduleService := settings.NewWarmupScheduleService(
		settings.NewStore(paths.preferences),
		accounts.NewFileRepository(paths.accounts),
	)
	runner := &fakeWarmupRunner{}
	runtime := newRuntime(
		scheduleService,
		runner,
		&fakeEventSink{},
		func() time.Time { return now },
		30*time.Second,
	)
	runtime.sessionStartedAt = now.Add(-10 * time.Minute)

	err := runtime.Check(context.Background())

	require.NoError(t, err)
	require.Empty(t, runner.calls)

	status, err := runtime.LoadStatus(context.Background())
	require.NoError(t, err)
	require.True(t, status.MissedRunToday)
}

func TestRuntimeDismissMissedRunSuppressesTodayOnly(t *testing.T) {
	t.Parallel()

	now := time.Now().Truncate(time.Minute)
	paths := newSchedulerPaths(t)
	seedSchedulerAccounts(t, paths.accounts, []string{"acct-1"})
	seedSchedulerSchedule(t, paths.preferences, contracts.WarmupSchedule{
		Enabled:    true,
		LocalTime:  formatClock(now.Add(-30 * time.Minute)),
		AccountIDs: []string{"acct-1"},
	})
	scheduleService := settings.NewWarmupScheduleService(
		settings.NewStore(paths.preferences),
		accounts.NewFileRepository(paths.accounts),
	)
	runtime := newRuntime(
		scheduleService,
		&fakeWarmupRunner{},
		&fakeEventSink{},
		func() time.Time { return now },
		30*time.Second,
	)
	runtime.sessionStartedAt = now.Add(-10 * time.Minute)

	err := runtime.DismissMissedRunToday(context.Background())

	require.NoError(t, err)
	status, err := runtime.LoadStatus(context.Background())
	require.NoError(t, err)
	require.False(t, status.MissedRunToday)
	require.Equal(t, now.Format("2006-01-02"), dereferenceSchedulerString(status.Schedule.LastMissedPromptLocalDate))
}

func TestRuntimeRunMissedWarmupNowMarksCompletionAndClearsSuppression(t *testing.T) {
	t.Parallel()

	now := time.Now().Truncate(time.Minute)
	paths := newSchedulerPaths(t)
	seedSchedulerAccounts(t, paths.accounts, []string{"acct-1"})
	seedSchedulerSchedule(t, paths.preferences, contracts.WarmupSchedule{
		Enabled:                   true,
		LocalTime:                 formatClock(now.Add(-30 * time.Minute)),
		AccountIDs:                []string{"acct-1"},
		LastMissedPromptLocalDate: schedulerStringPointer(now.Format("2006-01-02")),
	})
	scheduleService := settings.NewWarmupScheduleService(
		settings.NewStore(paths.preferences),
		accounts.NewFileRepository(paths.accounts),
	)
	runner := &fakeWarmupRunner{
		result: warmup.WarmupAllResult{
			Items: []warmup.AccountWarmupResult{
				newWarmupResult("acct-1"),
			},
			Summary: warmup.WarmupSummary{
				TotalAccounts:      1,
				EligibleAccounts:   1,
				SuccessfulAccounts: 1,
			},
		},
	}
	emitter := &fakeEventSink{}
	runtime := newRuntime(
		scheduleService,
		runner,
		emitter,
		func() time.Time { return now },
		30*time.Second,
	)
	runtime.sessionStartedAt = now.Add(-10 * time.Minute)

	result, err := runtime.RunMissedWarmupNow(context.Background())

	require.NoError(t, err)
	require.Equal(t, 1, result.Summary.SuccessfulAccounts)
	require.Equal(t, [][]string{{"acct-1"}}, runner.calls)
	require.Len(t, emitter.events, 1)
	require.Equal(t, WarmupRuntimeTriggerMissedPrompt, emitter.events[0].Trigger)

	status, err := runtime.LoadStatus(context.Background())
	require.NoError(t, err)
	require.False(t, status.MissedRunToday)
	require.Equal(t, now.Format("2006-01-02"), dereferenceSchedulerString(status.Schedule.LastRunLocalDate))
	require.Empty(t, dereferenceSchedulerString(status.Schedule.LastMissedPromptLocalDate))
}

type schedulerPaths struct {
	preferences string
	accounts    string
}

func newSchedulerPaths(t *testing.T) schedulerPaths {
	t.Helper()

	dir := t.TempDir()
	return schedulerPaths{
		preferences: filepath.Join(dir, "preferences.json"),
		accounts:    filepath.Join(dir, "accounts.json"),
	}
}

func seedSchedulerAccounts(t *testing.T, path string, accountIDs []string) {
	t.Helper()

	require.NoError(t, os.MkdirAll(filepath.Dir(path), 0o755))

	store := accounts.AccountsStore{
		Version:  1,
		Accounts: make([]accounts.AccountRecord, 0, len(accountIDs)),
	}
	for _, accountID := range accountIDs {
		store.Accounts = append(store.Accounts, accounts.AccountRecord{
			ID:          accountID,
			DisplayName: accountID,
			Auth: accounts.AccountAuth{
				Kind: "chatgpt",
				ChatGPT: &accounts.ChatGPTAuth{
					IDToken:      "id-" + accountID,
					AccessToken:  "access-" + accountID,
					RefreshToken: "refresh-" + accountID,
					AccountID:    schedulerStringPointer(accountID),
				},
			},
			CreatedAt: time.Date(2026, time.March, 11, 8, 0, 0, 0, time.UTC),
			UpdatedAt: time.Date(2026, time.March, 11, 8, 0, 0, 0, time.UTC),
		})
	}

	payload, err := json.MarshalIndent(store, "", "  ")
	require.NoError(t, err)
	require.NoError(t, os.WriteFile(path, payload, 0o600))
}

func seedSchedulerSchedule(t *testing.T, path string, schedule contracts.WarmupSchedule) {
	t.Helper()

	require.NoError(t, os.MkdirAll(filepath.Dir(path), 0o755))

	payload, err := json.MarshalIndent(
		map[string]any{
			"warmupSchedule": schedule,
		},
		"",
		"  ",
	)
	require.NoError(t, err)
	require.NoError(t, os.WriteFile(path, payload, 0o600))
}

type fakeWarmupRunner struct {
	result warmup.WarmupAllResult
	err    error
	calls  [][]string
}

func (f *fakeWarmupRunner) RunAccountIDs(
	_ context.Context,
	accountIDs []string,
) (warmup.WarmupAllResult, error) {
	f.calls = append(f.calls, append([]string{}, accountIDs...))
	return f.result, f.err
}

type fakeEventSink struct {
	events []contracts.WarmupRuntimeEvent
}

func (f *fakeEventSink) EmitWarmupEvent(
	_ context.Context,
	event contracts.WarmupRuntimeEvent,
) error {
	f.events = append(f.events, event)
	return nil
}

func newWarmupResult(accountID string) warmup.AccountWarmupResult {
	return warmup.AccountWarmupResult{
		AccountID: accountID,
		Status:    warmup.WarmupStatusSuccess,
		Availability: warmup.Availability{
			AccountID:   accountID,
			IsAvailable: true,
		},
		CompletedAt: time.Now().Format(time.RFC3339),
	}
}

func schedulerStringPointer(value string) *string {
	return &value
}

func dereferenceSchedulerString(value *string) string {
	if value == nil {
		return ""
	}

	return *value
}

func formatClock(value time.Time) string {
	return value.Format("15:04")
}
