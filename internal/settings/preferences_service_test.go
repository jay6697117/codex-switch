package settings

import (
	"context"
	"encoding/json"
	"os"
	"path/filepath"
	"testing"

	"codex-switch/internal/contracts"

	"github.com/stretchr/testify/require"
)

func TestPreferencesServiceLoadUsesSystemLocaleAndDefaultSecurityMode(t *testing.T) {
	t.Parallel()

	store := NewStore(filepath.Join(t.TempDir(), "preferences.json"))
	service := NewPreferencesService(store, fakeLocaleDetector{locale: "zh_CN.UTF-8"})

	snapshot, err := service.Load(context.Background())

	require.NoError(t, err)
	require.Equal(t, contracts.LocalePreferenceSystem, snapshot.LocalePreference)
	require.Equal(t, contracts.LocaleZhCN, snapshot.EffectiveLocale)
	require.Equal(t, contracts.BackupSecurityModeKeychain, snapshot.BackupSecurityMode)
}

func TestPreferencesServiceSavePersistsExplicitLocaleAndSecurityMode(t *testing.T) {
	t.Parallel()

	path := filepath.Join(t.TempDir(), "preferences.json")
	store := NewStore(path)
	service := NewPreferencesService(store, fakeLocaleDetector{locale: "en-US"})

	snapshot, err := service.Save(context.Background(), contracts.SaveSettingsInput{
		LocalePreference:   contracts.LocalePreferenceZhCN,
		BackupSecurityMode: contracts.BackupSecurityModePassphrase,
	})

	require.NoError(t, err)
	require.Equal(t, contracts.LocalePreferenceZhCN, snapshot.LocalePreference)
	require.Equal(t, contracts.LocaleZhCN, snapshot.EffectiveLocale)
	require.Equal(t, contracts.BackupSecurityModePassphrase, snapshot.BackupSecurityMode)

	var persisted preferences
	content, err := os.ReadFile(path)
	require.NoError(t, err)
	require.NoError(t, json.Unmarshal(content, &persisted))
	require.Equal(t, "zh-CN", persisted.Locale)
	require.Equal(t, "passphrase", persisted.BackupSecurityMode)
}

func TestPreferencesServiceSaveSystemLocaleClearsStoredOverride(t *testing.T) {
	t.Parallel()

	path := filepath.Join(t.TempDir(), "preferences.json")
	store := NewStore(path)
	service := NewPreferencesService(store, fakeLocaleDetector{locale: "en-US"})

	_, err := service.Save(context.Background(), contracts.SaveSettingsInput{
		LocalePreference:   contracts.LocalePreferenceEnUS,
		BackupSecurityMode: contracts.BackupSecurityModeKeychain,
	})
	require.NoError(t, err)

	snapshot, err := service.Save(context.Background(), contracts.SaveSettingsInput{
		LocalePreference:   contracts.LocalePreferenceSystem,
		BackupSecurityMode: contracts.BackupSecurityModeKeychain,
	})

	require.NoError(t, err)
	require.Equal(t, contracts.LocalePreferenceSystem, snapshot.LocalePreference)
	require.Equal(t, contracts.LocaleEnUS, snapshot.EffectiveLocale)

	var persisted preferences
	content, err := os.ReadFile(path)
	require.NoError(t, err)
	require.NoError(t, json.Unmarshal(content, &persisted))
	require.Empty(t, persisted.Locale)
	require.Equal(t, "keychain", persisted.BackupSecurityMode)
}

type fakeLocaleDetector struct {
	locale string
	err    error
}

func (f fakeLocaleDetector) DetectLocale(context.Context) (string, error) {
	return f.locale, f.err
}
