package auth

import (
	"context"
	"errors"
	"testing"
	"time"

	"codex-switch/internal/accounts"
	"codex-switch/internal/contracts"
	"codex-switch/internal/switching"

	"github.com/stretchr/testify/require"
)

func TestServiceStartLoginReplacesPreviousPendingFlow(t *testing.T) {
	t.Parallel()

	firstPending := &fakePendingLogin{}
	secondPending := &fakePendingLogin{}
	starter := &fakeLoginStarter{
		infos: []contracts.OAuthLoginInfo{
			{AuthURL: "https://auth.example.com/one", CallbackPort: 1455},
			{AuthURL: "https://auth.example.com/two", CallbackPort: 1456},
		},
		pending: []PendingLogin{firstPending, secondPending},
	}

	service := NewService(&fakeAccountRepository{}, &fakeAuthStore{}, starter)

	firstInfo, err := service.StartLogin(context.Background(), "Work Account")
	require.NoError(t, err)
	require.Equal(t, "https://auth.example.com/one", firstInfo.AuthURL)

	secondInfo, err := service.StartLogin(context.Background(), "Side Account")
	require.NoError(t, err)
	require.Equal(t, "https://auth.example.com/two", secondInfo.AuthURL)
	require.Equal(t, 1, firstPending.cancelCalls)
	require.Equal(t, []string{"Work Account", "Side Account"}, starter.accountNames)
}

func TestServiceCompleteLoginPersistsAccountAndActivatesAuthContext(t *testing.T) {
	t.Parallel()

	repository := &fakeAccountRepository{}
	authStore := &fakeAuthStore{}
	pending := &fakePendingLogin{
		result: OAuthResult{
			AccessToken:  "access-token",
			IDToken:      fakeJWT(t, `{"email":"work@example.com","https://api.openai.com/auth":{"chatgpt_account_id":"acct-openai"}}`),
			RefreshToken: "refresh-token",
			Email:        stringPointer("work@example.com"),
			AccountID:    stringPointer("acct-openai"),
		},
	}
	starter := &fakeLoginStarter{
		infos:   []contracts.OAuthLoginInfo{{AuthURL: "https://auth.example.com/start", CallbackPort: 1455}},
		pending: []PendingLogin{pending},
	}

	service := NewService(repository, authStore, starter)
	service.now = func() time.Time {
		return time.Date(2026, 3, 11, 18, 0, 0, 0, time.UTC)
	}
	service.idGenerator = func() string {
		return "acct-new"
	}

	_, err := service.StartLogin(context.Background(), "Work Account")
	require.NoError(t, err)

	snapshot, err := service.CompleteLogin(context.Background())
	require.NoError(t, err)
	require.Equal(t, "acct-new", dereference(snapshot.ActiveAccountID))
	require.Len(t, snapshot.Accounts, 1)
	require.Equal(t, "Work Account", snapshot.Accounts[0].DisplayName)
	require.Equal(t, "work@example.com", snapshot.Accounts[0].Email)
	require.Equal(t, "chatgpt", snapshot.Accounts[0].AuthKind)
	require.NotNil(t, authStore.written)
	require.NotNil(t, authStore.written.Tokens)
	require.Equal(t, "access-token", authStore.written.Tokens.AccessToken)
	require.Equal(t, "acct-openai", dereference(authStore.written.Tokens.AccountID))
}

func TestServiceCancelLoginClearsPendingFlow(t *testing.T) {
	t.Parallel()

	pending := &fakePendingLogin{}
	service := NewService(
		&fakeAccountRepository{},
		&fakeAuthStore{},
		&fakeLoginStarter{
			infos:   []contracts.OAuthLoginInfo{{AuthURL: "https://auth.example.com/start", CallbackPort: 1455}},
			pending: []PendingLogin{pending},
		},
	)

	_, err := service.StartLogin(context.Background(), "Work Account")
	require.NoError(t, err)

	require.NoError(t, service.CancelLogin(context.Background()))
	require.Equal(t, 1, pending.cancelCalls)

	_, err = service.CompleteLogin(context.Background())
	require.Error(t, err)

	var appErr contracts.AppError
	require.ErrorAs(t, err, &appErr)
	require.Equal(t, "oauth.no_pending_login", appErr.Code)
}

func TestServiceCompleteLoginRestoresPreviousAuthWhenRepositorySaveFails(t *testing.T) {
	t.Parallel()

	repository := &fakeAccountRepository{
		saveErr: errors.New("save failed"),
	}
	authStore := &fakeAuthStore{
		current: &switching.AuthFile{
			Tokens: &switching.TokenData{
				IDToken:      "old-id",
				AccessToken:  "old-access",
				RefreshToken: "old-refresh",
			},
		},
	}
	service := NewService(
		repository,
		authStore,
		&fakeLoginStarter{
			infos: []contracts.OAuthLoginInfo{{AuthURL: "https://auth.example.com/start", CallbackPort: 1455}},
			pending: []PendingLogin{&fakePendingLogin{
				result: OAuthResult{
					AccessToken:  "new-access",
					IDToken:      fakeJWT(t, `{"email":"work@example.com"}`),
					RefreshToken: "new-refresh",
					Email:        stringPointer("work@example.com"),
				},
			}},
		},
	)
	service.idGenerator = func() string { return "acct-new" }

	_, err := service.StartLogin(context.Background(), "Work Account")
	require.NoError(t, err)

	_, err = service.CompleteLogin(context.Background())
	require.Error(t, err)

	var appErr contracts.AppError
	require.ErrorAs(t, err, &appErr)
	require.Equal(t, "oauth.persist_failed", appErr.Code)
	require.NotNil(t, authStore.restored)
	require.Equal(t, "old-id", authStore.restored.Tokens.IDToken)
	require.Empty(t, repository.store.Accounts)
}

type fakeLoginStarter struct {
	infos        []contracts.OAuthLoginInfo
	pending      []PendingLogin
	err          error
	accountNames []string
}

func (s *fakeLoginStarter) Start(_ context.Context, accountName string) (contracts.OAuthLoginInfo, PendingLogin, error) {
	s.accountNames = append(s.accountNames, accountName)
	if s.err != nil {
		return contracts.OAuthLoginInfo{}, nil, s.err
	}

	index := len(s.accountNames) - 1
	return s.infos[index], s.pending[index], nil
}

type fakePendingLogin struct {
	result      OAuthResult
	err         error
	cancelCalls int
}

func (p *fakePendingLogin) Wait(context.Context) (OAuthResult, error) {
	return p.result, p.err
}

func (p *fakePendingLogin) Cancel() {
	p.cancelCalls++
}

type fakeAccountRepository struct {
	store   accounts.AccountsStore
	saveErr error
}

func (r *fakeAccountRepository) Load(context.Context) (accounts.AccountsStore, error) {
	return accounts.CloneStore(r.store), nil
}

func (r *fakeAccountRepository) Save(_ context.Context, store accounts.AccountsStore) error {
	if r.saveErr != nil {
		return r.saveErr
	}
	r.store = accounts.CloneStore(store)
	return nil
}

type fakeAuthStore struct {
	current  *switching.AuthFile
	written  *switching.AuthFile
	restored *switching.AuthFile
	writeErr error
}

func (s *fakeAuthStore) ReadCurrent(context.Context) (*switching.AuthFile, error) {
	if s.current == nil {
		return nil, nil
	}

	copyValue := *s.current
	return &copyValue, nil
}

func (s *fakeAuthStore) Write(_ context.Context, target switching.AuthFile) error {
	if s.writeErr != nil {
		return s.writeErr
	}

	copyValue := target
	s.written = &copyValue
	return nil
}

func (s *fakeAuthStore) Restore(_ context.Context, previous *switching.AuthFile) error {
	if previous == nil {
		s.restored = nil
		return nil
	}

	copyValue := *previous
	s.restored = &copyValue
	return nil
}
