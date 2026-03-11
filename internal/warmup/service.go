package warmup

import (
	"context"
	"errors"
	"strings"
	"time"

	"codex-switch/internal/accounts"
	"codex-switch/internal/contracts"
)

const (
	WarmupStatusSuccess = "success"
	WarmupStatusFailed  = "failed"
	WarmupStatusSkipped = "skipped"
)

var ErrUnauthorized = errors.New("warmup unauthorized")

type ChatGPTWarmupRequest struct {
	AccessToken string
	AccountID   *string
}

type APIKeyWarmupRequest struct {
	APIKey string
}

type Availability struct {
	AccountID   string  `json:"accountId"`
	IsAvailable bool    `json:"isAvailable"`
	ReasonCode  *string `json:"reasonCode,omitempty"`
}

type AccountWarmupResult struct {
	AccountID    string       `json:"accountId"`
	Availability Availability `json:"availability"`
	Status       string       `json:"status"`
	FailureCode  *string      `json:"failureCode,omitempty"`
	CompletedAt  string       `json:"completedAt"`
}

type WarmupSummary struct {
	TotalAccounts      int `json:"totalAccounts"`
	EligibleAccounts   int `json:"eligibleAccounts"`
	SuccessfulAccounts int `json:"successfulAccounts"`
	FailedAccounts     int `json:"failedAccounts"`
	SkippedAccounts    int `json:"skippedAccounts"`
}

type WarmupAllResult struct {
	Items   []AccountWarmupResult `json:"items"`
	Summary WarmupSummary         `json:"summary"`
}

type TokenManager interface {
	EnsureFresh(ctx context.Context, accountID string) (accounts.AccountRecord, error)
	Refresh(ctx context.Context, accountID string) (accounts.AccountRecord, error)
}

type Provider interface {
	WarmChatGPT(ctx context.Context, request ChatGPTWarmupRequest) error
	WarmAPIKey(ctx context.Context, request APIKeyWarmupRequest) error
}

type Service struct {
	repository accounts.Repository
	tokens     TokenManager
	provider   Provider
	now        func() time.Time
}

func NewService(
	repository accounts.Repository,
	tokens TokenManager,
	provider Provider,
) *Service {
	if provider == nil {
		provider = DefaultHTTPProvider()
	}

	return &Service{
		repository: repository,
		tokens:     tokens,
		provider:   provider,
		now:        time.Now().UTC,
	}
}

func (s *Service) GetAvailability(ctx context.Context, accountID string) (Availability, error) {
	store, err := s.repository.Load(ctx)
	if err != nil {
		return Availability{}, contracts.AppError{Code: "warmup.load_failed"}
	}

	account := findAccountByID(store, accountID)
	if account == nil {
		return unavailableAvailability(accountID, "warmup.account_not_found"), nil
	}

	return availabilityForAccount(*account), nil
}

func (s *Service) ListAvailability(ctx context.Context) ([]Availability, error) {
	store, err := s.repository.Load(ctx)
	if err != nil {
		return nil, contracts.AppError{Code: "warmup.load_failed"}
	}

	items := make([]Availability, 0, len(store.Accounts))
	for _, account := range store.Accounts {
		items = append(items, availabilityForAccount(account))
	}

	return items, nil
}

func (s *Service) WarmupAccount(ctx context.Context, accountID string) (AccountWarmupResult, error) {
	store, err := s.repository.Load(ctx)
	if err != nil {
		return AccountWarmupResult{}, contracts.AppError{Code: "warmup.load_failed"}
	}

	account := findAccountByID(store, accountID)
	if account == nil {
		return skippedResult(unavailableAvailability(accountID, "warmup.account_not_found"), s.now()), nil
	}

	return s.warmupLoadedAccount(ctx, *account), nil
}

func (s *Service) WarmupAllAccounts(ctx context.Context) (WarmupAllResult, error) {
	store, err := s.repository.Load(ctx)
	if err != nil {
		return WarmupAllResult{}, contracts.AppError{Code: "warmup.load_failed"}
	}

	return s.warmupAccounts(ctx, store.Accounts), nil
}

func (s *Service) WarmupAccounts(ctx context.Context, accountIDs []string) (WarmupAllResult, error) {
	store, err := s.repository.Load(ctx)
	if err != nil {
		return WarmupAllResult{}, contracts.AppError{Code: "warmup.load_failed"}
	}

	selectedAccounts := selectAccountsByID(store, accountIDs)
	return s.warmupAccounts(ctx, selectedAccounts), nil
}

func (s *Service) warmupAccounts(
	ctx context.Context,
	selectedAccounts []accounts.AccountRecord,
) WarmupAllResult {
	items := make([]AccountWarmupResult, 0, len(selectedAccounts))
	summary := WarmupSummary{
		TotalAccounts: len(selectedAccounts),
	}

	for _, account := range selectedAccounts {
		result := s.warmupLoadedAccount(ctx, account)
		items = append(items, result)

		if result.Availability.IsAvailable {
			summary.EligibleAccounts++
		}

		switch result.Status {
		case WarmupStatusSuccess:
			summary.SuccessfulAccounts++
		case WarmupStatusFailed:
			summary.FailedAccounts++
		case WarmupStatusSkipped:
			summary.SkippedAccounts++
		}
	}

	return WarmupAllResult{
		Items:   items,
		Summary: summary,
	}
}

func (s *Service) warmupLoadedAccount(
	ctx context.Context,
	account accounts.AccountRecord,
) AccountWarmupResult {
	availability := availabilityForAccount(account)
	if !availability.IsAvailable {
		return skippedResult(availability, s.now())
	}

	switch account.Auth.Kind {
	case "chatgpt":
		return s.warmupChatGPTAccount(ctx, account, availability)
	case "apiKey":
		return s.warmupAPIKeyAccount(ctx, account, availability)
	default:
		return skippedResult(availability, s.now())
	}
}

func (s *Service) warmupChatGPTAccount(
	ctx context.Context,
	account accounts.AccountRecord,
	availability Availability,
) AccountWarmupResult {
	readyAccount, err := s.prepareChatGPTAccount(ctx, account)
	if err != nil {
		return failedResult(account.ID, availability, "warmup.refresh_failed", s.now())
	}

	err = s.provider.WarmChatGPT(ctx, buildChatGPTRequest(readyAccount))
	if errors.Is(err, ErrUnauthorized) {
		readyAccount, err = s.tokens.Refresh(ctx, account.ID)
		if err != nil {
			return failedResult(account.ID, availability, "warmup.refresh_failed", s.now())
		}

		err = s.provider.WarmChatGPT(ctx, buildChatGPTRequest(readyAccount))
	}

	if err != nil {
		return failedResult(account.ID, availability, "warmup.request_failed", s.now())
	}

	return successResult(account.ID, availability, s.now())
}

func (s *Service) warmupAPIKeyAccount(
	ctx context.Context,
	account accounts.AccountRecord,
	availability Availability,
) AccountWarmupResult {
	err := s.provider.WarmAPIKey(ctx, APIKeyWarmupRequest{
		APIKey: strings.TrimSpace(account.Auth.APIKey.APIKey),
	})
	if err != nil {
		return failedResult(account.ID, availability, "warmup.request_failed", s.now())
	}

	return successResult(account.ID, availability, s.now())
}

func (s *Service) prepareChatGPTAccount(
	ctx context.Context,
	account accounts.AccountRecord,
) (accounts.AccountRecord, error) {
	if account.Auth.ChatGPT == nil {
		return accounts.AccountRecord{}, errors.New("missing credentials")
	}

	if strings.TrimSpace(account.Auth.ChatGPT.AccessToken) == "" {
		if strings.TrimSpace(account.Auth.ChatGPT.RefreshToken) == "" {
			return accounts.AccountRecord{}, errors.New("missing credentials")
		}

		refreshedAccount, err := s.tokens.Refresh(ctx, account.ID)
		if err != nil {
			return accounts.AccountRecord{}, err
		}

		if !hasUsableChatGPTCredentials(refreshedAccount) {
			return accounts.AccountRecord{}, errors.New("missing credentials")
		}

		return refreshedAccount, nil
	}

	readyAccount, err := s.tokens.EnsureFresh(ctx, account.ID)
	if err != nil {
		return accounts.AccountRecord{}, err
	}

	if !hasUsableChatGPTCredentials(readyAccount) {
		return accounts.AccountRecord{}, errors.New("missing credentials")
	}

	return readyAccount, nil
}

func selectAccountsByID(
	store accounts.AccountsStore,
	accountIDs []string,
) []accounts.AccountRecord {
	if len(accountIDs) == 0 {
		return []accounts.AccountRecord{}
	}

	accountsByID := make(map[string]accounts.AccountRecord, len(store.Accounts))
	for _, account := range store.Accounts {
		accountsByID[account.ID] = account
	}

	seen := make(map[string]struct{}, len(accountIDs))
	selected := make([]accounts.AccountRecord, 0, len(accountIDs))
	for _, accountID := range accountIDs {
		if _, ok := seen[accountID]; ok {
			continue
		}
		account, ok := accountsByID[accountID]
		if !ok {
			continue
		}

		seen[accountID] = struct{}{}
		selected = append(selected, account)
	}

	return selected
}

func availabilityForAccount(account accounts.AccountRecord) Availability {
	switch account.Auth.Kind {
	case "chatgpt":
		if !hasUsableChatGPTCredentials(account) {
			return unavailableAvailability(account.ID, "warmup.credentials_missing")
		}

		return Availability{
			AccountID:   account.ID,
			IsAvailable: true,
		}
	case "apiKey":
		if account.Auth.APIKey == nil || strings.TrimSpace(account.Auth.APIKey.APIKey) == "" {
			return unavailableAvailability(account.ID, "warmup.credentials_missing")
		}

		return Availability{
			AccountID:   account.ID,
			IsAvailable: true,
		}
	default:
		return unavailableAvailability(account.ID, "warmup.unsupported_auth_kind")
	}
}

func hasUsableChatGPTCredentials(account accounts.AccountRecord) bool {
	if account.Auth.ChatGPT == nil {
		return false
	}

	return strings.TrimSpace(account.Auth.ChatGPT.AccessToken) != "" ||
		strings.TrimSpace(account.Auth.ChatGPT.RefreshToken) != ""
}

func buildChatGPTRequest(account accounts.AccountRecord) ChatGPTWarmupRequest {
	accountID := copyString(account.Auth.ChatGPT.AccountID)
	return ChatGPTWarmupRequest{
		AccessToken: strings.TrimSpace(account.Auth.ChatGPT.AccessToken),
		AccountID:   accountID,
	}
}

func successResult(accountID string, availability Availability, completedAt time.Time) AccountWarmupResult {
	return AccountWarmupResult{
		AccountID:    accountID,
		Availability: availability,
		Status:       WarmupStatusSuccess,
		CompletedAt:  completedAt.Format(time.RFC3339),
	}
}

func failedResult(
	accountID string,
	availability Availability,
	failureCode string,
	completedAt time.Time,
) AccountWarmupResult {
	return AccountWarmupResult{
		AccountID:    accountID,
		Availability: availability,
		Status:       WarmupStatusFailed,
		FailureCode:  stringPointer(failureCode),
		CompletedAt:  completedAt.Format(time.RFC3339),
	}
}

func skippedResult(availability Availability, completedAt time.Time) AccountWarmupResult {
	return AccountWarmupResult{
		AccountID:    availability.AccountID,
		Availability: availability,
		Status:       WarmupStatusSkipped,
		CompletedAt:  completedAt.Format(time.RFC3339),
	}
}

func unavailableAvailability(accountID string, reasonCode string) Availability {
	return Availability{
		AccountID:   accountID,
		IsAvailable: false,
		ReasonCode:  stringPointer(reasonCode),
	}
}

func findAccountByID(store accounts.AccountsStore, accountID string) *accounts.AccountRecord {
	for index := range store.Accounts {
		if store.Accounts[index].ID == accountID {
			return &store.Accounts[index]
		}
	}

	return nil
}

func stringPointer(value string) *string {
	return &value
}

func copyString(value *string) *string {
	if value == nil {
		return nil
	}

	copyValue := *value
	return &copyValue
}
