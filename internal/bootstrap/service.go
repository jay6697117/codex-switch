package bootstrap

import (
	"context"
	"strings"

	"codex-switch/internal/contracts"
)

type LocaleDetector interface {
	DetectLocale(ctx context.Context) (string, error)
}

type PreferenceStore interface {
	LoadLocalePreference(ctx context.Context) (string, bool, error)
}

type Service struct {
	store    PreferenceStore
	detector LocaleDetector
	appInfo  contracts.AppInfo
}

func NewService(store PreferenceStore, detector LocaleDetector) *Service {
	return &Service{
		store:    store,
		detector: detector,
		appInfo: contracts.AppInfo{
			Name:    "Codex Switch",
			Version: "0.1.0",
		},
	}
}

func (s *Service) Load(ctx context.Context) (contracts.BootstrapPayload, error) {
	override, hasOverride, err := s.store.LoadLocalePreference(ctx)
	if err != nil {
		return contracts.BootstrapPayload{}, err
	}

	if hasOverride {
		return s.payload(resolveLocale(override), true), nil
	}

	locale, err := s.detector.DetectLocale(ctx)
	if err != nil {
		locale = string(contracts.LocaleEnUS)
	}

	return s.payload(resolveLocale(locale), false), nil
}

func (s *Service) payload(locale contracts.LocaleCode, hasManualOverride bool) contracts.BootstrapPayload {
	return contracts.BootstrapPayload{
		Locale:            locale,
		SupportedLocales:  append([]contracts.LocaleCode(nil), contracts.SupportedLocales...),
		HasManualOverride: hasManualOverride,
		App:               s.appInfo,
	}
}

func resolveLocale(raw string) contracts.LocaleCode {
	normalized := strings.TrimSpace(strings.ToLower(raw))
	normalized = strings.ReplaceAll(normalized, "_", "-")

	if idx := strings.Index(normalized, "."); idx >= 0 {
		normalized = normalized[:idx]
	}

	switch {
	case strings.HasPrefix(normalized, "zh"):
		return contracts.LocaleZhCN
	case strings.HasPrefix(normalized, "en"):
		return contracts.LocaleEnUS
	default:
		return contracts.LocaleEnUS
	}
}
