package settings

import (
	"context"
	"encoding/json"
	"os"
	"path/filepath"
	"testing"
	"time"

	"codex-switch/internal/accounts"
	"codex-switch/internal/contracts"

	"github.com/stretchr/testify/require"
)

func TestWarmupScheduleServiceSaveRejectsInvalidLocalTime(t *testing.T) {
	t.Parallel()

	paths := newWarmupSchedulePaths(t)
	seedAccountsStore(t, paths.accounts, accounts.AccountsStore{
		Version: 1,
		Accounts: []accounts.AccountRecord{
			newScheduleAccount("acct-1", "Work Account"),
		},
	})

	service := NewWarmupScheduleService(
		NewStore(paths.preferences),
		accounts.NewFileRepository(paths.accounts),
	)

	_, err := service.Save(context.Background(), contracts.WarmupScheduleInput{
		Enabled:    true,
		LocalTime:  "25:99",
		AccountIDs: []string{"acct-1"},
	})

	require.Error(t, err)
	var appErr contracts.AppError
	require.ErrorAs(t, err, &appErr)
	require.Equal(t, "warmup.schedule_time_invalid", appErr.Code)
}

func TestWarmupScheduleServiceSaveSanitizesAccountIDsAndPreservesMarkers(t *testing.T) {
	t.Parallel()

	paths := newWarmupSchedulePaths(t)
	seedAccountsStore(t, paths.accounts, accounts.AccountsStore{
		Version: 1,
		Accounts: []accounts.AccountRecord{
			newScheduleAccount("acct-1", "Work Account"),
			newScheduleAccount("acct-2", "Side Project"),
		},
	})
	seedPreferences(t, paths.preferences, preferences{
		Locale: "zh-CN",
		WarmupSchedule: &contracts.WarmupSchedule{
			Enabled:                   true,
			LocalTime:                 "08:30",
			AccountIDs:                []string{"acct-1"},
			LastRunLocalDate:          stringPointer("2026-03-11"),
			LastMissedPromptLocalDate: stringPointer("2026-03-10"),
		},
	})

	service := NewWarmupScheduleService(
		NewStore(paths.preferences),
		accounts.NewFileRepository(paths.accounts),
	)

	schedule, err := service.Save(context.Background(), contracts.WarmupScheduleInput{
		Enabled:    false,
		LocalTime:  "09:15",
		AccountIDs: []string{"acct-2", "acct-missing", "acct-2", "", "acct-1"},
	})

	require.NoError(t, err)
	require.NotNil(t, schedule)
	require.False(t, schedule.Enabled)
	require.Equal(t, "09:15", schedule.LocalTime)
	require.Equal(t, []string{"acct-2", "acct-1"}, schedule.AccountIDs)
	require.Equal(t, "2026-03-11", dereferenceString(schedule.LastRunLocalDate))
	require.Equal(t, "2026-03-10", dereferenceString(schedule.LastMissedPromptLocalDate))

	stored := readPreferences(t, paths.preferences)
	require.Equal(t, "zh-CN", stored.Locale)
	require.NotNil(t, stored.WarmupSchedule)
	require.Equal(t, []string{"acct-2", "acct-1"}, stored.WarmupSchedule.AccountIDs)
	require.NotContains(t, string(readFile(t, paths.preferences)), "validAccountIds")
	require.NotContains(t, string(readFile(t, paths.preferences)), "missedRunToday")
	require.NotContains(t, string(readFile(t, paths.preferences)), "nextRunLocalIso")
}

func TestWarmupScheduleServiceLoadStatusComputesNextRunAndCleansStoredIDs(t *testing.T) {
	t.Parallel()

	location := time.FixedZone("UTC+8", 8*60*60)
	now := time.Date(2026, time.March, 12, 8, 30, 0, 0, location)
	sessionStartedAt := time.Date(2026, time.March, 12, 7, 0, 0, 0, location)
	paths := newWarmupSchedulePaths(t)
	seedAccountsStore(t, paths.accounts, accounts.AccountsStore{
		Version: 1,
		Accounts: []accounts.AccountRecord{
			newScheduleAccount("acct-1", "Work Account"),
		},
	})
	seedPreferences(t, paths.preferences, preferences{
		WarmupSchedule: &contracts.WarmupSchedule{
			Enabled:    true,
			LocalTime:  "09:00",
			AccountIDs: []string{"acct-missing", "acct-1"},
		},
	})

	service := NewWarmupScheduleService(
		NewStore(paths.preferences),
		accounts.NewFileRepository(paths.accounts),
	)
	service.now = func() time.Time {
		return now
	}

	status, err := service.LoadStatus(context.Background(), sessionStartedAt)

	require.NoError(t, err)
	require.NotNil(t, status.Schedule)
	require.Equal(t, []string{"acct-1"}, status.Schedule.AccountIDs)
	require.Equal(t, []string{"acct-1"}, status.ValidAccountIDs)
	require.False(t, status.MissedRunToday)
	require.Equal(t, "2026-03-12T09:00:00+08:00", dereferenceString(status.NextRunLocalISO))

	stored := readPreferences(t, paths.preferences)
	require.NotNil(t, stored.WarmupSchedule)
	require.Equal(t, []string{"acct-1"}, stored.WarmupSchedule.AccountIDs)
}

func TestWarmupScheduleServiceLoadStatusMarksMissedRunToday(t *testing.T) {
	t.Parallel()

	location := time.FixedZone("UTC+8", 8*60*60)
	now := time.Date(2026, time.March, 12, 10, 0, 0, 0, location)
	sessionStartedAt := time.Date(2026, time.March, 12, 9, 30, 0, 0, location)
	paths := newWarmupSchedulePaths(t)
	seedAccountsStore(t, paths.accounts, accounts.AccountsStore{
		Version: 1,
		Accounts: []accounts.AccountRecord{
			newScheduleAccount("acct-1", "Work Account"),
		},
	})
	seedPreferences(t, paths.preferences, preferences{
		WarmupSchedule: &contracts.WarmupSchedule{
			Enabled:    true,
			LocalTime:  "08:30",
			AccountIDs: []string{"acct-1"},
		},
	})

	service := NewWarmupScheduleService(
		NewStore(paths.preferences),
		accounts.NewFileRepository(paths.accounts),
	)
	service.now = func() time.Time {
		return now
	}

	status, err := service.LoadStatus(context.Background(), sessionStartedAt)

	require.NoError(t, err)
	require.True(t, status.MissedRunToday)
	require.Equal(t, "2026-03-13T08:30:00+08:00", dereferenceString(status.NextRunLocalISO))
}

type warmupSchedulePaths struct {
	preferences string
	accounts    string
}

func newWarmupSchedulePaths(t *testing.T) warmupSchedulePaths {
	t.Helper()

	dir := t.TempDir()
	return warmupSchedulePaths{
		preferences: filepath.Join(dir, "preferences.json"),
		accounts:    filepath.Join(dir, "accounts.json"),
	}
}

func seedAccountsStore(t *testing.T, path string, store accounts.AccountsStore) {
	t.Helper()

	require.NoError(t, os.MkdirAll(filepath.Dir(path), 0o755))

	payload, err := json.MarshalIndent(store, "", "  ")
	require.NoError(t, err)
	require.NoError(t, os.WriteFile(path, payload, 0o600))
}

func seedPreferences(t *testing.T, path string, prefs preferences) {
	t.Helper()

	require.NoError(t, os.MkdirAll(filepath.Dir(path), 0o755))

	payload, err := json.MarshalIndent(prefs, "", "  ")
	require.NoError(t, err)
	require.NoError(t, os.WriteFile(path, payload, 0o600))
}

func readPreferences(t *testing.T, path string) preferences {
	t.Helper()

	content := readFile(t, path)

	var prefs preferences
	require.NoError(t, json.Unmarshal(content, &prefs))

	return prefs
}

func readFile(t *testing.T, path string) []byte {
	t.Helper()

	content, err := os.ReadFile(path)
	require.NoError(t, err)
	return content
}

func newScheduleAccount(id string, displayName string) accounts.AccountRecord {
	createdAt := time.Date(2026, time.March, 11, 8, 0, 0, 0, time.UTC)

	return accounts.AccountRecord{
		ID:          id,
		DisplayName: displayName,
		Email:       displayName + "@example.com",
		Auth: accounts.AccountAuth{
			Kind: "chatgpt",
			ChatGPT: &accounts.ChatGPTAuth{
				IDToken:      "id-" + id,
				AccessToken:  "access-" + id,
				RefreshToken: "refresh-" + id,
				AccountID:    stringPointer(id),
			},
		},
		CreatedAt: createdAt,
		UpdatedAt: createdAt,
	}
}

func stringPointer(value string) *string {
	return &value
}

func dereferenceString(value *string) string {
	if value == nil {
		return ""
	}

	return *value
}
