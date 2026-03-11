package usage

import (
	"context"
	"errors"
	"testing"
	"time"

	"codex-switch/internal/accounts"
	"codex-switch/internal/contracts"

	"github.com/stretchr/testify/require"
)

func TestServiceGetAccountUsageReturnsUnsupportedForAPIKeyAccount(t *testing.T) {
	t.Parallel()

	service := NewService(
		&fakeUsageRepository{
			store: accounts.AccountsStore{
				Version: 1,
				Accounts: []accounts.AccountRecord{
					apiKeyAccount("acct-api", "Side Key"),
				},
			},
		},
		&fakeTokenManager{},
		&fakeUsageFetcher{},
	)
	service.now = func() time.Time { return time.Date(2026, 3, 11, 19, 0, 0, 0, time.UTC) }

	snapshot, err := service.GetAccountUsage(context.Background(), "acct-api")
	require.NoError(t, err)
	require.Equal(t, "unsupported", snapshot.Status)
	require.Equal(t, "usage.unsupported_api_key", dereference(snapshot.ReasonCode))
}

func TestServiceGetAccountUsageNormalizesSupportedPayload(t *testing.T) {
	t.Parallel()

	now := time.Date(2026, 3, 11, 19, 0, 0, 0, time.UTC)
	repository := &fakeUsageRepository{
		store: accounts.AccountsStore{
			Version: 1,
			Accounts: []accounts.AccountRecord{
				chatGPTAccount("acct-chatgpt", "Work Account", "access-current", "refresh-current", "acct-openai"),
			},
		},
	}
	tokenManager := &fakeTokenManager{
		ensureFreshResult: chatGPTAccount("acct-chatgpt", "Work Account", "access-current", "refresh-current", "acct-openai"),
	}
	fetcher := &fakeUsageFetcher{
		results: []FetchResult{
			{
				Payload: ProviderUsage{
					PlanType: "team",
					FiveHour: &ProviderWindow{
						UsedPercent:   24,
						WindowMinutes: 300,
						ResetsAt:      timePointer(now.Add(4 * time.Hour)),
					},
					Weekly: &ProviderWindow{
						UsedPercent:   63,
						WindowMinutes: 10080,
						ResetsAt:      timePointer(now.Add(6 * 24 * time.Hour)),
					},
				},
			},
		},
	}
	service := NewService(repository, tokenManager, fetcher)
	service.now = func() time.Time { return now }

	snapshot, err := service.GetAccountUsage(context.Background(), "acct-chatgpt")
	require.NoError(t, err)
	require.Equal(t, "supported", snapshot.Status)
	require.Equal(t, "team", dereference(snapshot.PlanType))
	require.Equal(t, 24, dereferenceInt(snapshot.FiveHour.UsedPercent))
	require.Equal(t, 300, snapshot.FiveHour.WindowMinutes)
	require.Equal(t, 63, dereferenceInt(snapshot.Weekly.UsedPercent))
	require.Equal(t, []string{"acct-chatgpt"}, tokenManager.ensureFreshIDs)
	require.Equal(t, "access-current", fetcher.requests[0].AccessToken)
	require.Equal(t, "2026-03-11T19:00:00Z", snapshot.RefreshedAt)
}

func TestServiceGetAccountUsageRetriesOnceAfterUnauthorized(t *testing.T) {
	t.Parallel()

	tokenManager := &fakeTokenManager{
		ensureFreshResult: chatGPTAccount("acct-chatgpt", "Work Account", "access-stale", "refresh-current", "acct-openai"),
		refreshResult:     chatGPTAccount("acct-chatgpt", "Work Account", "access-fresh", "refresh-next", "acct-openai"),
	}
	repository := &fakeUsageRepository{
		store: accounts.AccountsStore{
			Version: 1,
			Accounts: []accounts.AccountRecord{
				chatGPTAccount("acct-chatgpt", "Work Account", "access-stale", "refresh-current", "acct-openai"),
			},
		},
	}
	fetcher := &fakeUsageFetcher{
		results: []FetchResult{
			{Err: ErrUnauthorized},
			{
				Payload: ProviderUsage{
					PlanType: "plus",
				},
			},
		},
	}
	service := NewService(repository, tokenManager, fetcher)

	snapshot, err := service.GetAccountUsage(context.Background(), "acct-chatgpt")
	require.NoError(t, err)
	require.Equal(t, "supported", snapshot.Status)
	require.Equal(t, []string{"acct-chatgpt"}, tokenManager.refreshIDs)
	require.Len(t, fetcher.requests, 2)
	require.Equal(t, "access-stale", fetcher.requests[0].AccessToken)
	require.Equal(t, "access-fresh", fetcher.requests[1].AccessToken)
}

func TestServiceGetAccountUsageSupportsEmptyPayload(t *testing.T) {
	t.Parallel()

	repository := &fakeUsageRepository{
		store: accounts.AccountsStore{
			Version: 1,
			Accounts: []accounts.AccountRecord{
				chatGPTAccount("acct-chatgpt", "Work Account", "access-current", "refresh-current", "acct-openai"),
			},
		},
	}
	tokenManager := &fakeTokenManager{
		ensureFreshResult: chatGPTAccount("acct-chatgpt", "Work Account", "access-current", "refresh-current", "acct-openai"),
	}
	fetcher := &fakeUsageFetcher{
		results: []FetchResult{
			{Payload: ProviderUsage{}},
		},
	}
	service := NewService(repository, tokenManager, fetcher)

	snapshot, err := service.GetAccountUsage(context.Background(), "acct-chatgpt")
	require.NoError(t, err)
	require.Equal(t, "supported", snapshot.Status)
	require.Nil(t, snapshot.PlanType)
	require.Nil(t, snapshot.FiveHour)
	require.Nil(t, snapshot.Weekly)
}

func TestServiceGetAccountUsageReturnsUnavailableFallbackOnProviderFailure(t *testing.T) {
	t.Parallel()

	tokenManager := &fakeTokenManager{
		ensureFreshResult: chatGPTAccount("acct-chatgpt", "Work Account", "access-current", "refresh-current", "acct-openai"),
	}
	repository := &fakeUsageRepository{
		store: accounts.AccountsStore{
			Version: 1,
			Accounts: []accounts.AccountRecord{
				chatGPTAccount("acct-chatgpt", "Work Account", "access-current", "refresh-current", "acct-openai"),
			},
		},
	}
	fetcher := &fakeUsageFetcher{
		results: []FetchResult{
			{Err: errors.New("provider down")},
		},
	}
	service := NewService(repository, tokenManager, fetcher)

	snapshot, err := service.GetAccountUsage(context.Background(), "acct-chatgpt")
	require.NoError(t, err)
	require.Equal(t, "unavailable", snapshot.Status)
	require.Equal(t, "usage.unavailable", dereference(snapshot.ReasonCode))
	require.Nil(t, snapshot.FiveHour)
	require.Nil(t, snapshot.Weekly)
}

func TestServiceRefreshAllUsageAggregatesSnapshots(t *testing.T) {
	t.Parallel()

	repository := &fakeUsageRepository{
		store: accounts.AccountsStore{
			Version: 1,
			Accounts: []accounts.AccountRecord{
				apiKeyAccount("acct-api", "API"),
				chatGPTAccount("acct-chatgpt", "Work", "access-current", "refresh-current", "acct-openai"),
			},
		},
	}
	tokenManager := &fakeTokenManager{
		ensureFreshResult: chatGPTAccount("acct-chatgpt", "Work", "access-current", "refresh-current", "acct-openai"),
	}
	fetcher := &fakeUsageFetcher{
		results: []FetchResult{
			{Payload: ProviderUsage{PlanType: "team"}},
		},
	}
	service := NewService(repository, tokenManager, fetcher)

	result, err := service.RefreshAllUsage(context.Background())
	require.NoError(t, err)
	require.Len(t, result.Items, 2)
	require.Equal(t, "acct-api", result.Items[0].AccountID)
	require.Equal(t, "unsupported", result.Items[0].Status)
	require.Equal(t, "acct-chatgpt", result.Items[1].AccountID)
	require.Equal(t, "supported", result.Items[1].Status)
}

type fakeUsageRepository struct {
	store accounts.AccountsStore
}

func (r *fakeUsageRepository) Load(context.Context) (accounts.AccountsStore, error) {
	return accounts.CloneStore(r.store), nil
}

func (r *fakeUsageRepository) Save(context.Context, accounts.AccountsStore) error {
	return nil
}

type fakeTokenManager struct {
	ensureFreshResult accounts.AccountRecord
	ensureFreshErr    error
	refreshResult     accounts.AccountRecord
	refreshErr        error
	ensureFreshIDs    []string
	refreshIDs        []string
}

func (m *fakeTokenManager) EnsureFresh(ctx context.Context, accountID string) (accounts.AccountRecord, error) {
	m.ensureFreshIDs = append(m.ensureFreshIDs, accountID)
	return m.ensureFreshResult, m.ensureFreshErr
}

func (m *fakeTokenManager) Refresh(ctx context.Context, accountID string) (accounts.AccountRecord, error) {
	m.refreshIDs = append(m.refreshIDs, accountID)
	return m.refreshResult, m.refreshErr
}

type fakeUsageFetcher struct {
	results  []FetchResult
	requests []ChatGPTUsageRequest
}

func (f *fakeUsageFetcher) FetchChatGPTUsage(
	ctx context.Context,
	request ChatGPTUsageRequest,
) (ProviderUsage, error) {
	f.requests = append(f.requests, request)
	result := f.results[0]
	f.results = f.results[1:]
	return result.Payload, result.Err
}

func chatGPTAccount(
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
				AccountID:    stringPointer(accountID),
			},
		},
		CreatedAt: now,
		UpdatedAt: now,
	}
}

func apiKeyAccount(id string, name string) accounts.AccountRecord {
	now := time.Date(2026, 3, 11, 18, 0, 0, 0, time.UTC)
	return accounts.AccountRecord{
		ID:          id,
		DisplayName: name,
		Auth: accounts.AccountAuth{
			Kind: "apiKey",
			APIKey: &accounts.APIKeyCredentials{
				APIKey: "sk-test",
			},
		},
		CreatedAt: now,
		UpdatedAt: now,
	}
}

func dereference(value *string) string {
	if value == nil {
		return ""
	}

	return *value
}

func dereferenceInt(value *int) int {
	if value == nil {
		return 0
	}

	return *value
}

func stringPointer(value string) *string {
	return &value
}

func timePointer(value time.Time) *time.Time {
	return &value
}

var _ contracts.AccountUsageSnapshot
