package settings

import (
	"context"
	"time"

	"codex-switch/internal/accounts"
	"codex-switch/internal/contracts"
)

type WarmupScheduleService struct {
	store      Store
	repository accounts.Repository
	now        func() time.Time
}

func NewWarmupScheduleService(store Store, repository accounts.Repository) *WarmupScheduleService {
	return &WarmupScheduleService{
		store:      store,
		repository: repository,
		now:        time.Now,
	}
}

func (s *WarmupScheduleService) Load(ctx context.Context) (*contracts.WarmupSchedule, error) {
	return s.loadAndSanitize(ctx)
}

func (s *WarmupScheduleService) Save(
	ctx context.Context,
	input contracts.WarmupScheduleInput,
) (*contracts.WarmupSchedule, error) {
	normalizedTime, err := normalizeLocalTime(input.LocalTime)
	if err != nil {
		return nil, contracts.AppError{Code: "warmup.schedule_time_invalid"}
	}

	validAccountIDs, err := s.loadValidAccountIDs(ctx)
	if err != nil {
		return nil, contracts.AppError{Code: "warmup.schedule_load_failed"}
	}

	sanitizedAccountIDs := sanitizeAccountIDs(input.AccountIDs, validAccountIDs)
	if len(sanitizedAccountIDs) == 0 {
		return nil, contracts.AppError{Code: "warmup.schedule_accounts_required"}
	}

	prefs, err := s.store.UpdatePreferences(ctx, func(prefs *preferences) error {
		lastRunLocalDate, lastMissedPromptLocalDate := carryForwardMarkers(prefs.WarmupSchedule)

		prefs.WarmupSchedule = &contracts.WarmupSchedule{
			Enabled:                   input.Enabled,
			LocalTime:                 normalizedTime,
			AccountIDs:                sanitizedAccountIDs,
			LastRunLocalDate:          lastRunLocalDate,
			LastMissedPromptLocalDate: lastMissedPromptLocalDate,
		}

		return nil
	})
	if err != nil {
		return nil, err
	}

	return cloneWarmupSchedule(prefs.WarmupSchedule), nil
}

func (s *WarmupScheduleService) LoadStatus(
	ctx context.Context,
	sessionStartedAt time.Time,
) (contracts.WarmupScheduleStatus, error) {
	schedule, err := s.loadAndSanitize(ctx)
	if err != nil {
		return contracts.WarmupScheduleStatus{}, err
	}
	if schedule == nil {
		return contracts.WarmupScheduleStatus{
			ValidAccountIDs: []string{},
		}, nil
	}

	now := s.now().In(sessionStartedAt.Location())
	validAccountIDs, err := s.validAccountIDs(ctx, schedule.AccountIDs)
	if err != nil {
		return contracts.WarmupScheduleStatus{}, contracts.AppError{Code: "warmup.schedule_load_failed"}
	}

	nextRunLocalISO, err := computeNextRunLocalISO(*schedule, now)
	if err != nil {
		return contracts.WarmupScheduleStatus{}, contracts.AppError{Code: "warmup.schedule_time_invalid"}
	}

	missedRunToday, err := isMissedRunToday(*schedule, validAccountIDs, sessionStartedAt, now)
	if err != nil {
		return contracts.WarmupScheduleStatus{}, contracts.AppError{Code: "warmup.schedule_time_invalid"}
	}

	return contracts.WarmupScheduleStatus{
		Schedule:        cloneWarmupSchedule(schedule),
		ValidAccountIDs: validAccountIDs,
		MissedRunToday:  missedRunToday,
		NextRunLocalISO: nextRunLocalISO,
	}, nil
}

func (s *WarmupScheduleService) MarkCompleted(ctx context.Context, localDate string) error {
	_, err := s.store.UpdatePreferences(ctx, func(prefs *preferences) error {
		if prefs.WarmupSchedule == nil {
			return nil
		}

		prefs.WarmupSchedule.LastRunLocalDate = localDatePointer(localDate)
		prefs.WarmupSchedule.LastMissedPromptLocalDate = nil
		return nil
	})

	return err
}

func (s *WarmupScheduleService) SuppressMissedPrompt(ctx context.Context, localDate string) error {
	_, err := s.store.UpdatePreferences(ctx, func(prefs *preferences) error {
		if prefs.WarmupSchedule == nil {
			return nil
		}

		prefs.WarmupSchedule.LastMissedPromptLocalDate = localDatePointer(localDate)
		return nil
	})

	return err
}

func (s *WarmupScheduleService) loadAndSanitize(ctx context.Context) (*contracts.WarmupSchedule, error) {
	validAccountIDs, err := s.loadValidAccountIDs(ctx)
	if err != nil {
		return nil, contracts.AppError{Code: "warmup.schedule_load_failed"}
	}

	prefs, err := s.store.UpdatePreferences(ctx, func(prefs *preferences) error {
		if prefs.WarmupSchedule == nil {
			return nil
		}

		prefs.WarmupSchedule.AccountIDs = sanitizeAccountIDs(
			prefs.WarmupSchedule.AccountIDs,
			validAccountIDs,
		)

		if prefs.WarmupSchedule.LocalTime == "" {
			return nil
		}

		normalizedTime, err := normalizeLocalTime(prefs.WarmupSchedule.LocalTime)
		if err != nil {
			return contracts.AppError{Code: "warmup.schedule_time_invalid"}
		}
		prefs.WarmupSchedule.LocalTime = normalizedTime
		return nil
	})
	if err != nil {
		return nil, err
	}

	return cloneWarmupSchedule(prefs.WarmupSchedule), nil
}

func (s *WarmupScheduleService) validAccountIDs(ctx context.Context, requested []string) ([]string, error) {
	validAccountIDs, err := s.loadValidAccountIDs(ctx)
	if err != nil {
		return nil, err
	}

	return sanitizeAccountIDs(requested, validAccountIDs), nil
}

func (s *WarmupScheduleService) loadValidAccountIDs(ctx context.Context) (map[string]struct{}, error) {
	store, err := s.repository.Load(ctx)
	if err != nil {
		return nil, err
	}

	validAccountIDs := make(map[string]struct{}, len(store.Accounts))
	for _, account := range store.Accounts {
		validAccountIDs[account.ID] = struct{}{}
	}

	return validAccountIDs, nil
}

func normalizeLocalTime(value string) (string, error) {
	parsed, err := time.Parse("15:04", value)
	if err != nil {
		return "", err
	}

	return parsed.Format("15:04"), nil
}

func sanitizeAccountIDs(accountIDs []string, validAccountIDs map[string]struct{}) []string {
	if len(accountIDs) == 0 {
		return []string{}
	}

	seen := make(map[string]struct{}, len(accountIDs))
	sanitized := make([]string, 0, len(accountIDs))
	for _, accountID := range accountIDs {
		if accountID == "" {
			continue
		}

		if _, ok := validAccountIDs[accountID]; !ok {
			continue
		}

		if _, ok := seen[accountID]; ok {
			continue
		}

		seen[accountID] = struct{}{}
		sanitized = append(sanitized, accountID)
	}

	return sanitized
}

func computeNextRunLocalISO(
	schedule contracts.WarmupSchedule,
	now time.Time,
) (*string, error) {
	hour, minute, err := parseLocalTime(schedule.LocalTime)
	if err != nil {
		return nil, err
	}

	candidate := time.Date(
		now.Year(),
		now.Month(),
		now.Day(),
		hour,
		minute,
		0,
		0,
		now.Location(),
	)

	if !candidate.After(now) {
		nextDay := now.AddDate(0, 0, 1)
		candidate = time.Date(
			nextDay.Year(),
			nextDay.Month(),
			nextDay.Day(),
			hour,
			minute,
			0,
			0,
			now.Location(),
		)
	}

	value := candidate.Format(time.RFC3339)
	return &value, nil
}

func isMissedRunToday(
	schedule contracts.WarmupSchedule,
	validAccountIDs []string,
	sessionStartedAt time.Time,
	now time.Time,
) (bool, error) {
	if !schedule.Enabled || len(validAccountIDs) == 0 {
		return false, nil
	}

	hour, minute, err := parseLocalTime(schedule.LocalTime)
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
	today := now.Format("2006-01-02")

	return !now.Before(scheduledAt) &&
		sessionStartedAt.After(scheduledAt) &&
		stringValue(schedule.LastRunLocalDate) != today &&
		stringValue(schedule.LastMissedPromptLocalDate) != today, nil
}

func parseLocalTime(value string) (int, int, error) {
	parsed, err := time.Parse("15:04", value)
	if err != nil {
		return 0, 0, err
	}

	return parsed.Hour(), parsed.Minute(), nil
}

func carryForwardMarkers(
	schedule *contracts.WarmupSchedule,
) (*string, *string) {
	if schedule == nil {
		return nil, nil
	}

	return copyString(schedule.LastRunLocalDate), copyString(schedule.LastMissedPromptLocalDate)
}

func cloneWarmupSchedule(schedule *contracts.WarmupSchedule) *contracts.WarmupSchedule {
	if schedule == nil {
		return nil
	}

	cloned := *schedule
	cloned.AccountIDs = append([]string{}, schedule.AccountIDs...)
	cloned.LastRunLocalDate = copyString(schedule.LastRunLocalDate)
	cloned.LastMissedPromptLocalDate = copyString(schedule.LastMissedPromptLocalDate)
	return &cloned
}

func copyString(value *string) *string {
	if value == nil {
		return nil
	}

	copied := *value
	return &copied
}

func localDatePointer(value string) *string {
	return &value
}

func stringValue(value *string) string {
	if value == nil {
		return ""
	}

	return *value
}
