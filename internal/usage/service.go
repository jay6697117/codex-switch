package usage

import (
	"context"
	"errors"
	"time"

	"codex-switch/internal/accounts"
	"codex-switch/internal/contracts"
)

var ErrUnauthorized = errors.New("usage unauthorized")

type ChatGPTUsageRequest struct {
	AccessToken string
	AccountID   *string
}

type ProviderWindow struct {
	UsedPercent   int
	WindowMinutes int
	ResetsAt      *time.Time
}

type ProviderUsage struct {
	PlanType string
	FiveHour *ProviderWindow
	Weekly   *ProviderWindow
}

type FetchResult struct {
	Payload ProviderUsage
	Err     error
}

type TokenManager interface {
	EnsureFresh(ctx context.Context, accountID string) (accounts.AccountRecord, error)
	Refresh(ctx context.Context, accountID string) (accounts.AccountRecord, error)
}

type ChatGPTUsageFetcher interface {
	FetchChatGPTUsage(ctx context.Context, request ChatGPTUsageRequest) (ProviderUsage, error)
}

type Service struct {
	repository accounts.Repository
	tokens     TokenManager
	fetcher    ChatGPTUsageFetcher
	now        func() time.Time
}

func NewService(
	repository accounts.Repository,
	tokens TokenManager,
	fetcher ChatGPTUsageFetcher,
) *Service {
	return &Service{
		repository: repository,
		tokens:     tokens,
		fetcher:    fetcher,
		now:        time.Now().UTC,
	}
}

func (s *Service) GetAccountUsage(
	ctx context.Context,
	accountID string,
) (contracts.AccountUsageSnapshot, error) {
	store, err := s.repository.Load(ctx)
	if err != nil {
		return contracts.AccountUsageSnapshot{}, contracts.AppError{Code: "usage.load_failed"}
	}

	for _, account := range store.Accounts {
		if account.ID == accountID {
			return s.snapshotForAccount(ctx, account)
		}
	}

	return contracts.AccountUsageSnapshot{}, contracts.AppError{Code: "usage.account_not_found"}
}

func (s *Service) RefreshAllUsage(ctx context.Context) (contracts.UsageCollection, error) {
	store, err := s.repository.Load(ctx)
	if err != nil {
		return contracts.UsageCollection{}, contracts.AppError{Code: "usage.load_failed"}
	}

	items := make([]contracts.AccountUsageSnapshot, 0, len(store.Accounts))
	for _, account := range store.Accounts {
		snapshot, snapshotErr := s.snapshotForAccount(ctx, account)
		if snapshotErr != nil {
			return contracts.UsageCollection{}, snapshotErr
		}
		items = append(items, snapshot)
	}

	return contracts.UsageCollection{Items: items}, nil
}

func (s *Service) snapshotForAccount(
	ctx context.Context,
	account accounts.AccountRecord,
) (contracts.AccountUsageSnapshot, error) {
	switch account.Auth.Kind {
	case "apiKey":
		return s.unsupportedSnapshot(account.ID), nil
	case "chatgpt":
		return s.chatGPTSnapshot(ctx, account.ID)
	default:
		return s.unavailableSnapshot(account.ID), nil
	}
}

func (s *Service) chatGPTSnapshot(
	ctx context.Context,
	accountID string,
) (contracts.AccountUsageSnapshot, error) {
	account, err := s.tokens.EnsureFresh(ctx, accountID)
	if err != nil {
		return s.unavailableSnapshot(accountID), nil
	}

	payload, err := s.fetcher.FetchChatGPTUsage(ctx, buildUsageRequest(account))
	if errors.Is(err, ErrUnauthorized) {
		account, err = s.tokens.Refresh(ctx, accountID)
		if err != nil {
			return s.unavailableSnapshot(accountID), nil
		}
		payload, err = s.fetcher.FetchChatGPTUsage(ctx, buildUsageRequest(account))
	}

	if err != nil {
		return s.unavailableSnapshot(accountID), nil
	}

	return s.supportedSnapshot(account.ID, payload), nil
}

func buildUsageRequest(account accounts.AccountRecord) ChatGPTUsageRequest {
	accountID := copyString(account.Auth.ChatGPT.AccountID)
	return ChatGPTUsageRequest{
		AccessToken: account.Auth.ChatGPT.AccessToken,
		AccountID:   accountID,
	}
}

func (s *Service) supportedSnapshot(
	accountID string,
	payload ProviderUsage,
) contracts.AccountUsageSnapshot {
	return contracts.AccountUsageSnapshot{
		AccountID:   accountID,
		PlanType:    optionalString(payload.PlanType),
		Status:      "supported",
		FiveHour:    normalizeWindow(payload.FiveHour),
		Weekly:      normalizeWindow(payload.Weekly),
		RefreshedAt: s.now().Format(time.RFC3339),
	}
}

func (s *Service) unsupportedSnapshot(accountID string) contracts.AccountUsageSnapshot {
	return contracts.AccountUsageSnapshot{
		AccountID:   accountID,
		Status:      "unsupported",
		ReasonCode:  stringValuePointer("usage.unsupported_api_key"),
		RefreshedAt: s.now().Format(time.RFC3339),
	}
}

func (s *Service) unavailableSnapshot(accountID string) contracts.AccountUsageSnapshot {
	return contracts.AccountUsageSnapshot{
		AccountID:   accountID,
		Status:      "unavailable",
		ReasonCode:  stringValuePointer("usage.unavailable"),
		RefreshedAt: s.now().Format(time.RFC3339),
	}
}

func normalizeWindow(window *ProviderWindow) *contracts.UsageWindowSnapshot {
	if window == nil {
		return nil
	}

	return &contracts.UsageWindowSnapshot{
		UsedPercent:   intPointer(window.UsedPercent),
		WindowMinutes: window.WindowMinutes,
		ResetsAt:      formatTimePointer(window.ResetsAt),
	}
}

func formatTimePointer(value *time.Time) *string {
	if value == nil {
		return nil
	}

	formatted := value.UTC().Format(time.RFC3339)
	return &formatted
}

func intPointer(value int) *int {
	return &value
}

func optionalString(value string) *string {
	if value == "" {
		return nil
	}

	return &value
}

func stringValuePointer(value string) *string {
	return &value
}

func copyString(value *string) *string {
	if value == nil {
		return nil
	}

	copyValue := *value
	return &copyValue
}
