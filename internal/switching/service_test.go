package switching

import (
	"context"
	"errors"
	"testing"
	"time"

	"codex-switch/internal/accounts"
	"codex-switch/internal/contracts"
	platformprocess "codex-switch/internal/platform/process"

	"github.com/stretchr/testify/require"
)

func TestSwitchAccountRequiresConfirmationWhenProcessesAreRunning(t *testing.T) {
	t.Parallel()

	repo := &fakeRepository{
		store: accounts.AccountsStore{
			Version:         1,
			ActiveAccountID: stringPointer("acct-active"),
			Accounts: []accounts.AccountRecord{
				newChatGPTAccount("acct-active", "Primary"),
				newChatGPTAccount("acct-target", "Target"),
			},
		},
	}

	processes := []platformprocess.Descriptor{
		{PID: 10, Command: "codex", IsBackground: false},
	}

	service := NewService(repo, &fakeAuthFileStore{}, &fakeProcessController{detected: processes})

	_, err := service.SwitchAccount(context.Background(), contracts.SwitchAccountInput{
		AccountID:      "acct-target",
		ConfirmRestart: false,
	})

	require.Error(t, err)
	var appErr contracts.AppError
	require.ErrorAs(t, err, &appErr)
	require.Equal(t, "switch.confirmation_required", appErr.Code)
	require.Equal(t, "1", appErr.Args["foregroundCount"])
}

func TestSwitchAccountWritesAuthFileAndUpdatesActiveAccount(t *testing.T) {
	t.Parallel()

	repo := &fakeRepository{
		store: accounts.AccountsStore{
			Version:         1,
			ActiveAccountID: stringPointer("acct-active"),
			Accounts: []accounts.AccountRecord{
				newChatGPTAccount("acct-active", "Primary"),
				newAPIKeyAccount("acct-target", "Target"),
			},
		},
	}

	authStore := &fakeAuthFileStore{
		current: &AuthFile{
			Tokens: &TokenData{
				IDToken:      "old-id",
				AccessToken:  "old-access",
				RefreshToken: "old-refresh",
			},
		},
	}

	service := NewService(repo, authStore, &fakeProcessController{})

	result, err := service.SwitchAccount(context.Background(), contracts.SwitchAccountInput{
		AccountID:      "acct-target",
		ConfirmRestart: true,
	})

	require.NoError(t, err)
	require.False(t, result.RestartPerformed)
	require.Equal(t, "acct-target", dereference(result.Accounts.ActiveAccountID))
	require.NotNil(t, authStore.written)
	require.Equal(t, "sk-live-target", dereference(authStore.written.OpenAIAPIKey))
	require.Nil(t, authStore.written.Tokens)
}

func TestSwitchAccountRollsBackWhenRestartFails(t *testing.T) {
	t.Parallel()

	originalUpdatedAt := time.Date(2026, time.March, 11, 8, 0, 0, 0, time.UTC)
	repo := &fakeRepository{
		store: accounts.AccountsStore{
			Version:         1,
			ActiveAccountID: stringPointer("acct-active"),
			Accounts: []accounts.AccountRecord{
				newChatGPTAccountWithUpdatedAt("acct-active", "Primary", originalUpdatedAt),
				newChatGPTAccount("acct-target", "Target"),
			},
		},
	}

	authStore := &fakeAuthFileStore{
		current: &AuthFile{
			Tokens: &TokenData{
				IDToken:      "old-id",
				AccessToken:  "old-access",
				RefreshToken: "old-refresh",
			},
		},
	}
	processController := &fakeProcessController{
		detected: []platformprocess.Descriptor{
			{PID: 10, Command: "codex", IsBackground: false},
		},
		restartErrs: []error{errors.New("restart failed"), nil},
	}

	service := NewService(repo, authStore, processController)

	_, err := service.SwitchAccount(context.Background(), contracts.SwitchAccountInput{
		AccountID:      "acct-target",
		ConfirmRestart: true,
	})

	require.Error(t, err)
	var appErr contracts.AppError
	require.ErrorAs(t, err, &appErr)
	require.Equal(t, "process.restart_failed", appErr.Code)
	require.Equal(t, "acct-active", dereference(repo.store.ActiveAccountID))
	require.NotNil(t, authStore.restored)
	require.Equal(t, "old-id", authStore.restored.Tokens.IDToken)
}

func TestSwitchAccountRollsBackWhenActiveAccountSaveFails(t *testing.T) {
	t.Parallel()

	repo := &fakeRepository{
		store: accounts.AccountsStore{
			Version:         1,
			ActiveAccountID: stringPointer("acct-active"),
			Accounts: []accounts.AccountRecord{
				newChatGPTAccount("acct-active", "Primary"),
				newChatGPTAccount("acct-target", "Target"),
			},
		},
		saveErrs: []error{errors.New("save failed"), nil},
	}

	authStore := &fakeAuthFileStore{
		current: &AuthFile{
			Tokens: &TokenData{
				IDToken:      "old-id",
				AccessToken:  "old-access",
				RefreshToken: "old-refresh",
			},
		},
	}

	service := NewService(repo, authStore, &fakeProcessController{})

	_, err := service.SwitchAccount(context.Background(), contracts.SwitchAccountInput{
		AccountID:      "acct-target",
		ConfirmRestart: true,
	})

	require.Error(t, err)
	var appErr contracts.AppError
	require.ErrorAs(t, err, &appErr)
	require.Equal(t, "switch.active_update_failed", appErr.Code)
	require.Equal(t, "acct-active", dereference(repo.store.ActiveAccountID))
	require.NotNil(t, authStore.restored)
	require.Equal(t, "old-id", authStore.restored.Tokens.IDToken)
}

func TestSwitchAccountRejectsPlaceholderCredentials(t *testing.T) {
	t.Parallel()

	repo := &fakeRepository{
		store: accounts.AccountsStore{
			Version:         1,
			ActiveAccountID: stringPointer("acct-active"),
			Accounts: []accounts.AccountRecord{
				newChatGPTAccount("acct-active", "Primary"),
				{
					ID:          "acct-target",
					DisplayName: "Placeholder",
					Auth: accounts.AccountAuth{
						Kind: "chatgpt",
						ChatGPT: &accounts.ChatGPTCredentials{
							AccountID: testStringPointer("acct-target"),
						},
					},
					CreatedAt: time.Date(2026, time.March, 11, 8, 0, 0, 0, time.UTC),
					UpdatedAt: time.Date(2026, time.March, 11, 8, 0, 0, 0, time.UTC),
				},
			},
		},
	}

	service := NewService(repo, &fakeAuthFileStore{}, &fakeProcessController{})

	_, err := service.SwitchAccount(context.Background(), contracts.SwitchAccountInput{
		AccountID:      "acct-target",
		ConfirmRestart: true,
	})

	require.Error(t, err)
	var appErr contracts.AppError
	require.ErrorAs(t, err, &appErr)
	require.Equal(t, "switch.credentials_missing", appErr.Code)
}

type fakeRepository struct {
	store    accounts.AccountsStore
	saveErr  error
	saveErrs []error
}

func (f *fakeRepository) Load(context.Context) (accounts.AccountsStore, error) {
	return f.store, nil
}

func (f *fakeRepository) Save(_ context.Context, store accounts.AccountsStore) error {
	if len(f.saveErrs) > 0 {
		err := f.saveErrs[0]
		f.saveErrs = f.saveErrs[1:]
		if err != nil {
			return err
		}
	}
	if f.saveErr != nil {
		return f.saveErr
	}

	f.store = store
	return nil
}

type fakeAuthFileStore struct {
	current    *AuthFile
	written    *AuthFile
	restored   *AuthFile
	writeErr   error
	restoreErr error
}

func (f *fakeAuthFileStore) ReadCurrent(context.Context) (*AuthFile, error) {
	return cloneAuthFile(f.current), nil
}

func (f *fakeAuthFileStore) Write(_ context.Context, target AuthFile) error {
	if f.writeErr != nil {
		return f.writeErr
	}

	f.written = cloneAuthFile(&target)
	return nil
}

func (f *fakeAuthFileStore) Restore(_ context.Context, previous *AuthFile) error {
	if f.restoreErr != nil {
		return f.restoreErr
	}

	f.restored = cloneAuthFile(previous)
	return nil
}

type fakeProcessController struct {
	detected    []platformprocess.Descriptor
	detectErr   error
	stopErr     error
	restartErr  error
	restartErrs []error
}

func (f *fakeProcessController) Detect(context.Context) ([]platformprocess.Descriptor, error) {
	if f.detectErr != nil {
		return nil, f.detectErr
	}

	return append([]platformprocess.Descriptor(nil), f.detected...), nil
}

func (f *fakeProcessController) Stop(context.Context, []platformprocess.Descriptor) error {
	return f.stopErr
}

func (f *fakeProcessController) Restart(context.Context, []platformprocess.Descriptor) error {
	if len(f.restartErrs) > 0 {
		err := f.restartErrs[0]
		f.restartErrs = f.restartErrs[1:]
		return err
	}
	return f.restartErr
}

func newChatGPTAccount(id string, name string) accounts.AccountRecord {
	return newChatGPTAccountWithUpdatedAt(
		id,
		name,
		time.Date(2026, time.March, 11, 8, 0, 0, 0, time.UTC),
	)
}

func newChatGPTAccountWithUpdatedAt(id string, name string, updatedAt time.Time) accounts.AccountRecord {
	return accounts.AccountRecord{
		ID:          id,
		DisplayName: name,
		Auth: accounts.AccountAuth{
			Kind: "chatgpt",
			ChatGPT: &accounts.ChatGPTCredentials{
				IDToken:      "id-" + id,
				AccessToken:  "access-" + id,
				RefreshToken: "refresh-" + id,
				AccountID:    testStringPointer(id),
			},
		},
		CreatedAt: updatedAt,
		UpdatedAt: updatedAt,
	}
}

func newAPIKeyAccount(id string, name string) accounts.AccountRecord {
	createdAt := time.Date(2026, time.March, 11, 8, 0, 0, 0, time.UTC)
	return accounts.AccountRecord{
		ID:          id,
		DisplayName: name,
		Auth: accounts.AccountAuth{
			Kind: "apiKey",
			APIKey: &accounts.APIKeyCredentials{
				APIKey: "sk-live-target",
			},
		},
		CreatedAt: createdAt,
		UpdatedAt: createdAt,
	}
}

func cloneAuthFile(source *AuthFile) *AuthFile {
	if source == nil {
		return nil
	}

	clone := *source
	if source.OpenAIAPIKey != nil {
		value := *source.OpenAIAPIKey
		clone.OpenAIAPIKey = &value
	}
	if source.Tokens != nil {
		tokenCopy := *source.Tokens
		if source.Tokens.AccountID != nil {
			accountID := *source.Tokens.AccountID
			tokenCopy.AccountID = &accountID
		}
		clone.Tokens = &tokenCopy
	}
	return &clone
}

func testStringPointer(value string) *string {
	return &value
}

func dereference(value *string) string {
	if value == nil {
		return ""
	}
	return *value
}
