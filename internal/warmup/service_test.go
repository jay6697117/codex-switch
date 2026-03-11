package warmup

import (
	"context"
	"errors"
	"testing"
	"time"

	"codex-switch/internal/accounts"

	"github.com/stretchr/testify/require"
)

func TestServiceWarmupAccountRetriesChatGPTAfterUnauthorized(t *testing.T) {
	t.Parallel()

	now := time.Date(2026, 3, 12, 1, 0, 0, 0, time.UTC)
	repository := &fakeWarmupRepository{
		store: accounts.AccountsStore{
			Version: 1,
			Accounts: []accounts.AccountRecord{
				chatGPTWarmupAccount("acct-chatgpt", "Work Account", "access-stale", "refresh-current", "acct-openai"),
			},
		},
	}
	tokens := &fakeWarmupTokenManager{
		ensureFreshResult: chatGPTWarmupAccount("acct-chatgpt", "Work Account", "access-stale", "refresh-current", "acct-openai"),
		refreshResult:     chatGPTWarmupAccount("acct-chatgpt", "Work Account", "access-fresh", "refresh-next", "acct-openai"),
	}
	provider := &fakeProvider{
		chatGPTResults: []error{ErrUnauthorized, nil},
	}
	service := NewService(repository, tokens, provider)
	service.now = func() time.Time { return now }

	result, err := service.WarmupAccount(context.Background(), "acct-chatgpt")
	require.NoError(t, err)
	require.Equal(t, "acct-chatgpt", result.AccountID)
	require.True(t, result.Availability.IsAvailable)
	require.Equal(t, WarmupStatusSuccess, result.Status)
	require.Nil(t, result.FailureCode)
	require.Equal(t, "2026-03-12T01:00:00Z", result.CompletedAt)
	require.Equal(t, []string{"acct-chatgpt"}, tokens.ensureFreshIDs)
	require.Equal(t, []string{"acct-chatgpt"}, tokens.refreshIDs)
	require.Len(t, provider.chatGPTRequests, 2)
	require.Equal(t, "access-stale", provider.chatGPTRequests[0].AccessToken)
	require.Equal(t, "access-fresh", provider.chatGPTRequests[1].AccessToken)
}

func TestServiceWarmupAccountUsesAPIKeyProvider(t *testing.T) {
	t.Parallel()

	repository := &fakeWarmupRepository{
		store: accounts.AccountsStore{
			Version: 1,
			Accounts: []accounts.AccountRecord{
				apiKeyWarmupAccount("acct-api", "Side Project", "sk-test"),
			},
		},
	}
	provider := &fakeProvider{}
	service := NewService(repository, &fakeWarmupTokenManager{}, provider)

	result, err := service.WarmupAccount(context.Background(), "acct-api")
	require.NoError(t, err)
	require.Equal(t, WarmupStatusSuccess, result.Status)
	require.True(t, result.Availability.IsAvailable)
	require.Len(t, provider.apiKeyRequests, 1)
	require.Equal(t, "sk-test", provider.apiKeyRequests[0].APIKey)
}

func TestServiceGetAvailabilityNormalizesIneligibleReasons(t *testing.T) {
	t.Parallel()

	repository := &fakeWarmupRepository{
		store: accounts.AccountsStore{
			Version: 1,
			Accounts: []accounts.AccountRecord{
				chatGPTWarmupAccount("acct-chatgpt-missing", "Missing ChatGPT", "", "", "acct-openai"),
				{
					ID:          "acct-unsupported",
					DisplayName: "Unsupported",
					Auth: accounts.AccountAuth{
						Kind: "session",
					},
					CreatedAt: time.Date(2026, 3, 11, 18, 0, 0, 0, time.UTC),
					UpdatedAt: time.Date(2026, 3, 11, 18, 0, 0, 0, time.UTC),
				},
			},
		},
	}
	service := NewService(repository, &fakeWarmupTokenManager{}, &fakeProvider{})

	testCases := []struct {
		name       string
		accountID  string
		reasonCode string
	}{
		{
			name:       "missing credentials",
			accountID:  "acct-chatgpt-missing",
			reasonCode: "warmup.credentials_missing",
		},
		{
			name:       "unsupported auth kind",
			accountID:  "acct-unsupported",
			reasonCode: "warmup.unsupported_auth_kind",
		},
		{
			name:       "missing account",
			accountID:  "acct-missing",
			reasonCode: "warmup.account_not_found",
		},
	}

	for _, testCase := range testCases {
		t.Run(testCase.name, func(t *testing.T) {
			availability, err := service.GetAvailability(context.Background(), testCase.accountID)
			require.NoError(t, err)
			require.Equal(t, testCase.accountID, availability.AccountID)
			require.False(t, availability.IsAvailable)
			require.Equal(t, testCase.reasonCode, dereferenceWarmup(availability.ReasonCode))
		})
	}
}

func TestServiceWarmupAllAccountsAggregatesSummary(t *testing.T) {
	t.Parallel()

	now := time.Date(2026, 3, 12, 2, 30, 0, 0, time.UTC)
	repository := &fakeWarmupRepository{
		store: accounts.AccountsStore{
			Version: 1,
			Accounts: []accounts.AccountRecord{
				chatGPTWarmupAccount("acct-chatgpt", "Work Account", "access-current", "refresh-current", "acct-openai"),
				apiKeyWarmupAccount("acct-api", "API Account", "sk-live"),
				apiKeyWarmupAccount("acct-api-missing", "Missing Key", ""),
				{
					ID:          "acct-unsupported",
					DisplayName: "Unsupported",
					Auth: accounts.AccountAuth{
						Kind: "session",
					},
					CreatedAt: now.Add(-time.Hour),
					UpdatedAt: now.Add(-time.Hour),
				},
			},
		},
	}
	tokens := &fakeWarmupTokenManager{
		ensureFreshResult: chatGPTWarmupAccount("acct-chatgpt", "Work Account", "access-current", "refresh-current", "acct-openai"),
	}
	provider := &fakeProvider{
		apiKeyResults: []error{errors.New("provider down")},
	}
	service := NewService(repository, tokens, provider)
	service.now = func() time.Time { return now }

	result, err := service.WarmupAllAccounts(context.Background())
	require.NoError(t, err)
	require.Len(t, result.Items, 4)
	require.Equal(t, 4, result.Summary.TotalAccounts)
	require.Equal(t, 2, result.Summary.EligibleAccounts)
	require.Equal(t, 1, result.Summary.SuccessfulAccounts)
	require.Equal(t, 1, result.Summary.FailedAccounts)
	require.Equal(t, 2, result.Summary.SkippedAccounts)
	require.Equal(t, WarmupStatusSuccess, result.Items[0].Status)
	require.Equal(t, WarmupStatusFailed, result.Items[1].Status)
	require.Equal(t, "warmup.request_failed", dereferenceWarmup(result.Items[1].FailureCode))
	require.Equal(t, WarmupStatusSkipped, result.Items[2].Status)
	require.Equal(t, "warmup.credentials_missing", dereferenceWarmup(result.Items[2].Availability.ReasonCode))
	require.Equal(t, WarmupStatusSkipped, result.Items[3].Status)
	require.Equal(t, "warmup.unsupported_auth_kind", dereferenceWarmup(result.Items[3].Availability.ReasonCode))
}

type fakeWarmupRepository struct {
	store accounts.AccountsStore
}

func (r *fakeWarmupRepository) Load(context.Context) (accounts.AccountsStore, error) {
	return accounts.CloneStore(r.store), nil
}

func (r *fakeWarmupRepository) Save(context.Context, accounts.AccountsStore) error {
	return nil
}

type fakeWarmupTokenManager struct {
	ensureFreshResult accounts.AccountRecord
	ensureFreshErr    error
	refreshResult     accounts.AccountRecord
	refreshErr        error
	ensureFreshIDs    []string
	refreshIDs        []string
}

func (m *fakeWarmupTokenManager) EnsureFresh(ctx context.Context, accountID string) (accounts.AccountRecord, error) {
	m.ensureFreshIDs = append(m.ensureFreshIDs, accountID)
	return m.ensureFreshResult, m.ensureFreshErr
}

func (m *fakeWarmupTokenManager) Refresh(ctx context.Context, accountID string) (accounts.AccountRecord, error) {
	m.refreshIDs = append(m.refreshIDs, accountID)
	return m.refreshResult, m.refreshErr
}

type fakeProvider struct {
	chatGPTResults  []error
	apiKeyResults   []error
	chatGPTRequests []ChatGPTWarmupRequest
	apiKeyRequests  []APIKeyWarmupRequest
}

func (p *fakeProvider) WarmChatGPT(ctx context.Context, request ChatGPTWarmupRequest) error {
	p.chatGPTRequests = append(p.chatGPTRequests, request)
	if len(p.chatGPTResults) == 0 {
		return nil
	}

	result := p.chatGPTResults[0]
	p.chatGPTResults = p.chatGPTResults[1:]
	return result
}

func (p *fakeProvider) WarmAPIKey(ctx context.Context, request APIKeyWarmupRequest) error {
	p.apiKeyRequests = append(p.apiKeyRequests, request)
	if len(p.apiKeyResults) == 0 {
		return nil
	}

	result := p.apiKeyResults[0]
	p.apiKeyResults = p.apiKeyResults[1:]
	return result
}

func chatGPTWarmupAccount(
	id string,
	name string,
	accessToken string,
	refreshToken string,
	accountID string,
) accounts.AccountRecord {
	now := time.Date(2026, 3, 11, 18, 0, 0, 0, time.UTC)
	return accounts.AccountRecord{
		ID:          id,
		DisplayName: name,
		Auth: accounts.AccountAuth{
			Kind: "chatgpt",
			ChatGPT: &accounts.ChatGPTCredentials{
				IDToken:      "id-token",
				AccessToken:  accessToken,
				RefreshToken: refreshToken,
				AccountID:    stringPointerWarmup(accountID),
			},
		},
		CreatedAt: now,
		UpdatedAt: now,
	}
}

func apiKeyWarmupAccount(id string, name string, apiKey string) accounts.AccountRecord {
	now := time.Date(2026, 3, 11, 18, 0, 0, 0, time.UTC)
	return accounts.AccountRecord{
		ID:          id,
		DisplayName: name,
		Auth: accounts.AccountAuth{
			Kind: "apiKey",
			APIKey: &accounts.APIKeyCredentials{
				APIKey: apiKey,
			},
		},
		CreatedAt: now,
		UpdatedAt: now,
	}
}

func stringPointerWarmup(value string) *string {
	return &value
}

func dereferenceWarmup(value *string) string {
	if value == nil {
		return ""
	}

	return *value
}
