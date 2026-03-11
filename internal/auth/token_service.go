package auth

import (
	"context"
	"encoding/base64"
	"encoding/json"
	"time"

	"codex-switch/internal/accounts"
	"codex-switch/internal/contracts"
	"codex-switch/internal/switching"
)

const tokenExpirySkew = time.Minute

type RefreshResult struct {
	IDToken      *string
	AccessToken  string
	RefreshToken *string
}

type TokenExchanger interface {
	Refresh(ctx context.Context, refreshToken string) (RefreshResult, error)
}

type TokenService struct {
	repository accounts.Repository
	authStore  switching.AuthFileStore
	exchanger  TokenExchanger
	now        func() time.Time
}

func NewTokenService(
	repository accounts.Repository,
	authStore switching.AuthFileStore,
	exchanger TokenExchanger,
) *TokenService {
	return &TokenService{
		repository: repository,
		authStore:  authStore,
		exchanger:  exchanger,
		now:        time.Now().UTC,
	}
}

func (s *TokenService) EnsureFresh(ctx context.Context, accountID string) (accounts.AccountRecord, error) {
	store, index, account, err := s.loadAccount(ctx, accountID)
	if err != nil {
		return accounts.AccountRecord{}, err
	}

	if account.Auth.Kind != "chatgpt" || account.Auth.ChatGPT == nil {
		return account, nil
	}

	if !tokenExpiredOrNearExpiry(account.Auth.ChatGPT.AccessToken, s.now()) {
		return account, nil
	}

	return s.refreshLoaded(ctx, store, index, account)
}

func (s *TokenService) Refresh(ctx context.Context, accountID string) (accounts.AccountRecord, error) {
	store, index, account, err := s.loadAccount(ctx, accountID)
	if err != nil {
		return accounts.AccountRecord{}, err
	}

	if account.Auth.Kind != "chatgpt" || account.Auth.ChatGPT == nil {
		return account, nil
	}

	return s.refreshLoaded(ctx, store, index, account)
}

func (s *TokenService) loadAccount(
	ctx context.Context,
	accountID string,
) (accounts.AccountsStore, int, accounts.AccountRecord, error) {
	store, err := s.repository.Load(ctx)
	if err != nil {
		return accounts.AccountsStore{}, -1, accounts.AccountRecord{}, contracts.AppError{Code: "auth.refresh_failed"}
	}

	for index, account := range store.Accounts {
		if account.ID == accountID {
			return store, index, account, nil
		}
	}

	return accounts.AccountsStore{}, -1, accounts.AccountRecord{}, contracts.AppError{Code: "auth.account_not_found"}
}

func (s *TokenService) refreshLoaded(
	ctx context.Context,
	store accounts.AccountsStore,
	index int,
	account accounts.AccountRecord,
) (accounts.AccountRecord, error) {
	chatGPT := account.Auth.ChatGPT
	if chatGPT == nil || chatGPT.RefreshToken == "" {
		return accounts.AccountRecord{}, contracts.AppError{Code: "auth.refresh_failed"}
	}

	refreshResult, err := s.exchanger.Refresh(ctx, chatGPT.RefreshToken)
	if err != nil {
		return accounts.AccountRecord{}, contracts.AppError{Code: "auth.refresh_failed"}
	}

	nextIDToken := chatGPT.IDToken
	if refreshResult.IDToken != nil && *refreshResult.IDToken != "" {
		nextIDToken = *refreshResult.IDToken
	}

	nextRefreshToken := chatGPT.RefreshToken
	if refreshResult.RefreshToken != nil && *refreshResult.RefreshToken != "" {
		nextRefreshToken = *refreshResult.RefreshToken
	}

	email, accountID := parseIDTokenClaims(nextIDToken)
	now := s.now()

	updatedStore := accounts.CloneStore(store)
	updatedAccount := updatedStore.Accounts[index]
	updatedAccount.Email = dereferenceString(email)
	updatedAccount.UpdatedAt = now
	updatedAccount.Auth.ChatGPT = &accounts.ChatGPTCredentials{
		IDToken:      nextIDToken,
		AccessToken:  refreshResult.AccessToken,
		RefreshToken: nextRefreshToken,
		AccountID:    copyString(accountID),
	}
	updatedStore.Accounts[index] = updatedAccount

	isActive := updatedStore.ActiveAccountID != nil && *updatedStore.ActiveAccountID == updatedAccount.ID

	var previousAuth *switching.AuthFile
	if isActive {
		previousAuth, err = s.authStore.ReadCurrent(ctx)
		if err != nil {
			return accounts.AccountRecord{}, contracts.AppError{Code: "auth.refresh_failed"}
		}

		if err := s.authStore.Write(ctx, buildChatGPTAuthFile(updatedAccount, now)); err != nil {
			return accounts.AccountRecord{}, contracts.AppError{Code: "auth.refresh_failed"}
		}
	}

	if err := s.repository.Save(ctx, updatedStore); err != nil {
		if isActive {
			_ = s.authStore.Restore(ctx, previousAuth)
		}
		return accounts.AccountRecord{}, contracts.AppError{Code: "auth.refresh_failed"}
	}

	return updatedAccount, nil
}

func tokenExpiredOrNearExpiry(token string, now time.Time) bool {
	expiry, ok := parseTokenExpiry(token)
	if !ok {
		return false
	}

	return !expiry.After(now.Add(tokenExpirySkew))
}

func parseTokenExpiry(token string) (time.Time, bool) {
	parts := splitToken(token)
	if len(parts) != 3 {
		return time.Time{}, false
	}

	payload, err := base64.RawURLEncoding.DecodeString(parts[1])
	if err != nil {
		return time.Time{}, false
	}

	var decoded struct {
		Exp int64 `json:"exp"`
	}
	if err := json.Unmarshal(payload, &decoded); err != nil {
		return time.Time{}, false
	}
	if decoded.Exp == 0 {
		return time.Time{}, false
	}

	return time.Unix(decoded.Exp, 0).UTC(), true
}

func splitToken(token string) []string {
	return splitByDot(token)
}

func splitByDot(value string) []string {
	var result []string
	start := 0
	for index := 0; index < len(value); index++ {
		if value[index] != '.' {
			continue
		}
		result = append(result, value[start:index])
		start = index + 1
	}
	result = append(result, value[start:])
	return result
}
