package bootstrap

import (
	"context"

	"codex-switch/internal/buildinfo"
	"codex-switch/internal/contracts"
	platformlocale "codex-switch/internal/platform/locale"
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
			Name:    buildinfo.AppName,
			Version: buildinfo.Version,
		},
	}
}

func (s *Service) Load(ctx context.Context) (contracts.BootstrapPayload, error) {
	override, hasOverride, err := s.store.LoadLocalePreference(ctx)
	if err != nil {
		return contracts.BootstrapPayload{}, err
	}

	if hasOverride {
		return s.payload(platformlocale.ResolveSupportedLocale(override), true), nil
	}

	locale, err := s.detector.DetectLocale(ctx)
	if err != nil {
		locale = string(contracts.LocaleEnUS)
	}

	return s.payload(platformlocale.ResolveSupportedLocale(locale), false), nil
}

func (s *Service) payload(locale contracts.LocaleCode, hasManualOverride bool) contracts.BootstrapPayload {
	return contracts.BootstrapPayload{
		Locale:            locale,
		SupportedLocales:  append([]contracts.LocaleCode(nil), contracts.SupportedLocales...),
		HasManualOverride: hasManualOverride,
		App:               s.appInfo,
	}
}
