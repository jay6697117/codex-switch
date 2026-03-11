package bootstrap

import (
	"context"
	"testing"

	"codex-switch/internal/contracts"

	"github.com/stretchr/testify/require"
)

type fakeLocaleDetector struct {
	locale string
	err    error
}

func (f fakeLocaleDetector) DetectLocale(context.Context) (string, error) {
	return f.locale, f.err
}

type fakePreferenceStore struct {
	locale string
	ok     bool
	err    error
}

func (f fakePreferenceStore) LoadLocalePreference(context.Context) (string, bool, error) {
	return f.locale, f.ok, f.err
}

func TestServiceLoadUsesManualOverrideWhenPresent(t *testing.T) {
	t.Parallel()

	service := NewService(
		fakePreferenceStore{locale: "en-US", ok: true},
		fakeLocaleDetector{locale: "zh-CN"},
	)

	payload, err := service.Load(context.Background())

	require.NoError(t, err)
	require.Equal(t, contracts.LocaleEnUS, payload.Locale)
	require.True(t, payload.HasManualOverride)
	require.Equal(t, []contracts.LocaleCode{contracts.LocaleZhCN, contracts.LocaleEnUS}, payload.SupportedLocales)
}

func TestServiceLoadNormalizesSupportedLocaleFamilies(t *testing.T) {
	t.Parallel()

	service := NewService(
		fakePreferenceStore{},
		fakeLocaleDetector{locale: "zh-HK"},
	)

	payload, err := service.Load(context.Background())

	require.NoError(t, err)
	require.Equal(t, contracts.LocaleZhCN, payload.Locale)
	require.False(t, payload.HasManualOverride)
}

func TestServiceLoadFallsBackToEnglishForUnsupportedLocales(t *testing.T) {
	t.Parallel()

	service := NewService(
		fakePreferenceStore{},
		fakeLocaleDetector{locale: "fr-FR"},
	)

	payload, err := service.Load(context.Background())

	require.NoError(t, err)
	require.Equal(t, contracts.LocaleEnUS, payload.Locale)
}
