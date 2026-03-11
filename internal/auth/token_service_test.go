package auth

import (
	"context"
	"strconv"
	"testing"
	"time"

	"codex-switch/internal/accounts"
	"codex-switch/internal/switching"

	"github.com/stretchr/testify/require"
)

func TestTokenServiceEnsureFreshRefreshesNearExpiryActiveAccount(t *testing.T) {
	t.Parallel()

	now := time.Date(2026, 3, 11, 18, 30, 0, 0, time.UTC)
	repository := &fakeTokenRepository{
		store: accounts.AccountsStore{
			Version:         1,
			ActiveAccountID: stringPointer("acct-active"),
			Accounts: []accounts.AccountRecord{
				{
					ID:          "acct-active",
					DisplayName: "Work Account",
					Email:       "old@example.com",
					Auth: accounts.AccountAuth{
						Kind: "chatgpt",
						ChatGPT: &accounts.ChatGPTCredentials{
							IDToken:      fakeJWT(t, `{"email":"old@example.com","https://api.openai.com/auth":{"chatgpt_account_id":"acct-openai-old"}}`),
							AccessToken:  fakeExpiringJWT(t, now.Add(30*time.Second)),
							RefreshToken: "refresh-old",
							AccountID:    stringPointer("acct-openai-old"),
						},
					},
					CreatedAt: now.Add(-time.Hour),
					UpdatedAt: now.Add(-time.Hour),
				},
			},
		},
	}
	authStore := &fakeTokenAuthStore{
		current: &switching.AuthFile{
			Tokens: &switching.TokenData{
				IDToken:      "id-old",
				AccessToken:  "access-old",
				RefreshToken: "refresh-old",
			},
		},
	}
	exchanger := &fakeRefreshExchanger{
		result: RefreshResult{
			IDToken:      stringPointer(fakeJWT(t, `{"email":"new@example.com","https://api.openai.com/auth":{"chatgpt_account_id":"acct-openai-new"}}`)),
			AccessToken:  fakeExpiringJWT(t, now.Add(2*time.Hour)),
			RefreshToken: stringPointer("refresh-new"),
		},
	}

	service := NewTokenService(repository, authStore, exchanger)
	service.now = func() time.Time { return now }

	account, err := service.EnsureFresh(context.Background(), "acct-active")
	require.NoError(t, err)
	require.Equal(t, []string{"refresh-old"}, exchanger.refreshTokens)
	require.Equal(t, "new@example.com", account.Email)
	require.Equal(t, "refresh-new", account.Auth.ChatGPT.RefreshToken)
	require.Equal(t, "acct-openai-new", dereference(account.Auth.ChatGPT.AccountID))
	require.NotNil(t, authStore.written)
	require.Equal(t, "refresh-new", authStore.written.Tokens.RefreshToken)
	require.Equal(t, "new@example.com", repository.store.Accounts[0].Email)
}

func TestTokenServiceEnsureFreshLeavesFreshTokenUntouched(t *testing.T) {
	t.Parallel()

	now := time.Date(2026, 3, 11, 18, 30, 0, 0, time.UTC)
	repository := &fakeTokenRepository{
		store: accounts.AccountsStore{
			Version: 1,
			Accounts: []accounts.AccountRecord{
				{
					ID:          "acct-active",
					DisplayName: "Work Account",
					Auth: accounts.AccountAuth{
						Kind: "chatgpt",
						ChatGPT: &accounts.ChatGPTCredentials{
							IDToken:      fakeJWT(t, `{"email":"work@example.com"}`),
							AccessToken:  fakeExpiringJWT(t, now.Add(2*time.Hour)),
							RefreshToken: "refresh-old",
						},
					},
					CreatedAt: now.Add(-time.Hour),
					UpdatedAt: now.Add(-time.Hour),
				},
			},
		},
	}
	authStore := &fakeTokenAuthStore{}
	exchanger := &fakeRefreshExchanger{}

	service := NewTokenService(repository, authStore, exchanger)
	service.now = func() time.Time { return now }

	account, err := service.EnsureFresh(context.Background(), "acct-active")
	require.NoError(t, err)
	require.Empty(t, exchanger.refreshTokens)
	require.Nil(t, authStore.written)
	require.Equal(t, "refresh-old", account.Auth.ChatGPT.RefreshToken)
}

type fakeRefreshExchanger struct {
	result        RefreshResult
	err           error
	refreshTokens []string
}

func (f *fakeRefreshExchanger) Refresh(ctx context.Context, refreshToken string) (RefreshResult, error) {
	f.refreshTokens = append(f.refreshTokens, refreshToken)
	return f.result, f.err
}

type fakeTokenRepository struct {
	store   accounts.AccountsStore
	saveErr error
}

func (r *fakeTokenRepository) Load(context.Context) (accounts.AccountsStore, error) {
	return accounts.CloneStore(r.store), nil
}

func (r *fakeTokenRepository) Save(_ context.Context, store accounts.AccountsStore) error {
	if r.saveErr != nil {
		return r.saveErr
	}
	r.store = accounts.CloneStore(store)
	return nil
}

type fakeTokenAuthStore struct {
	current  *switching.AuthFile
	written  *switching.AuthFile
	restored *switching.AuthFile
	writeErr error
}

func (s *fakeTokenAuthStore) ReadCurrent(context.Context) (*switching.AuthFile, error) {
	if s.current == nil {
		return nil, nil
	}

	copyValue := *s.current
	return &copyValue, nil
}

func (s *fakeTokenAuthStore) Write(_ context.Context, target switching.AuthFile) error {
	if s.writeErr != nil {
		return s.writeErr
	}

	copyValue := target
	s.written = &copyValue
	return nil
}

func (s *fakeTokenAuthStore) Restore(_ context.Context, previous *switching.AuthFile) error {
	if previous == nil {
		s.restored = nil
		return nil
	}

	copyValue := *previous
	s.restored = &copyValue
	return nil
}

func fakeExpiringJWT(t *testing.T, expiry time.Time) string {
	t.Helper()
	return fakeJWT(t, `{"exp":`+strconv.FormatInt(expiry.Unix(), 10)+`}`)
}
