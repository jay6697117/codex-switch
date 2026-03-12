package settings

import (
	"context"
	"strings"

	"codex-switch/internal/contracts"
	platformlocale "codex-switch/internal/platform/locale"
)

type LocaleDetector interface {
	DetectLocale(ctx context.Context) (string, error)
}

type PreferencesService struct {
	store    Store
	detector LocaleDetector
}

func NewPreferencesService(store Store, detector LocaleDetector) *PreferencesService {
	return &PreferencesService{
		store:    store,
		detector: detector,
	}
}

func (s *PreferencesService) Load(ctx context.Context) (contracts.SettingsSnapshot, error) {
	prefs, err := s.store.LoadPreferences(ctx)
	if err != nil {
		return contracts.SettingsSnapshot{}, err
	}

	localePreference := normalizeLocalePreference(prefs.Locale)
	effectiveLocale, err := s.resolveEffectiveLocale(ctx, localePreference)
	if err != nil {
		return contracts.SettingsSnapshot{}, err
	}

	return contracts.SettingsSnapshot{
		LocalePreference:   localePreference,
		EffectiveLocale:    effectiveLocale,
		BackupSecurityMode: normalizeBackupSecurityMode(prefs.BackupSecurityMode),
	}, nil
}

func (s *PreferencesService) Save(
	ctx context.Context,
	input contracts.SaveSettingsInput,
) (contracts.SettingsSnapshot, error) {
	localePreference, ok := validateLocalePreference(input.LocalePreference)
	if !ok {
		return contracts.SettingsSnapshot{}, contracts.AppError{Code: "settings.locale_invalid"}
	}

	backupSecurityMode, ok := validateBackupSecurityMode(input.BackupSecurityMode)
	if !ok {
		return contracts.SettingsSnapshot{}, contracts.AppError{Code: "settings.save_failed"}
	}

	prefs, err := s.store.UpdatePreferences(ctx, func(prefs *preferences) error {
		if localePreference == contracts.LocalePreferenceSystem {
			prefs.Locale = ""
		} else {
			prefs.Locale = string(localePreference)
		}

		prefs.BackupSecurityMode = string(backupSecurityMode)
		return nil
	})
	if err != nil {
		return contracts.SettingsSnapshot{}, contracts.AppError{Code: "settings.save_failed"}
	}

	effectiveLocale, err := s.resolveEffectiveLocale(ctx, normalizeLocalePreference(prefs.Locale))
	if err != nil {
		return contracts.SettingsSnapshot{}, contracts.AppError{Code: "settings.save_failed"}
	}

	return contracts.SettingsSnapshot{
		LocalePreference:   normalizeLocalePreference(prefs.Locale),
		EffectiveLocale:    effectiveLocale,
		BackupSecurityMode: normalizeBackupSecurityMode(prefs.BackupSecurityMode),
	}, nil
}

func (s *PreferencesService) LoadBackupSecurityMode(ctx context.Context) (contracts.BackupSecurityMode, error) {
	prefs, err := s.store.LoadPreferences(ctx)
	if err != nil {
		return "", err
	}

	return normalizeBackupSecurityMode(prefs.BackupSecurityMode), nil
}

func (s *PreferencesService) EnsureBackupSecurityMode(ctx context.Context) (contracts.BackupSecurityMode, error) {
	prefs, err := s.store.UpdatePreferences(ctx, func(prefs *preferences) error {
		if strings.TrimSpace(prefs.BackupSecurityMode) == "" {
			prefs.BackupSecurityMode = string(contracts.BackupSecurityModeKeychain)
		}
		return nil
	})
	if err != nil {
		return "", err
	}

	return normalizeBackupSecurityMode(prefs.BackupSecurityMode), nil
}

func (s *PreferencesService) resolveEffectiveLocale(
	ctx context.Context,
	preference contracts.LocalePreference,
) (contracts.LocaleCode, error) {
	switch preference {
	case contracts.LocalePreferenceZhCN:
		return contracts.LocaleZhCN, nil
	case contracts.LocalePreferenceEnUS:
		return contracts.LocaleEnUS, nil
	default:
		if s.detector == nil {
			return contracts.LocaleEnUS, nil
		}

		detected, err := s.detector.DetectLocale(ctx)
		if err != nil {
			return contracts.LocaleEnUS, nil
		}

		return platformlocale.ResolveSupportedLocale(detected), nil
	}
}

func normalizeLocalePreference(raw string) contracts.LocalePreference {
	switch strings.TrimSpace(raw) {
	case string(contracts.LocaleZhCN):
		return contracts.LocalePreferenceZhCN
	case string(contracts.LocaleEnUS):
		return contracts.LocalePreferenceEnUS
	}

	return contracts.LocalePreferenceSystem
}

func validateLocalePreference(
	preference contracts.LocalePreference,
) (contracts.LocalePreference, bool) {
	switch preference {
	case contracts.LocalePreferenceSystem, contracts.LocalePreferenceZhCN, contracts.LocalePreferenceEnUS:
		return preference, true
	default:
		return "", false
	}
}

func normalizeBackupSecurityMode(raw string) contracts.BackupSecurityMode {
	if raw == string(contracts.BackupSecurityModePassphrase) {
		return contracts.BackupSecurityModePassphrase
	}

	return contracts.BackupSecurityModeKeychain
}

func validateBackupSecurityMode(
	mode contracts.BackupSecurityMode,
) (contracts.BackupSecurityMode, bool) {
	switch mode {
	case contracts.BackupSecurityModeKeychain, contracts.BackupSecurityModePassphrase:
		return mode, true
	default:
		return "", false
	}
}
