package accounts

import (
	"context"
	"encoding/json"
	"os"
	"path/filepath"
	"testing"
	"time"

	"codex-switch/internal/contracts"

	"github.com/stretchr/testify/require"
)

func TestLoadAccountsReturnsEmptySnapshotWhenStoreMissing(t *testing.T) {
	t.Parallel()

	service := NewService(NewFileRepository(filepath.Join(t.TempDir(), "accounts.json")))

	snapshot, err := service.LoadAccounts(context.Background())

	require.NoError(t, err)
	require.Nil(t, snapshot.ActiveAccountID)
	require.Empty(t, snapshot.Accounts)
}

func TestRenameAccountPreservesIDAndUpdatesSnapshot(t *testing.T) {
	t.Parallel()

	repository := NewFileRepository(filepath.Join(t.TempDir(), "accounts.json"))
	service := NewService(repository)
	seedStore(t, repository.path, AccountsStore{
		Version:         1,
		ActiveAccountID: stringPointer("acct-1"),
		Accounts: []AccountRecord{
			newAccountRecord("acct-1", "Work", "work@example.com"),
			newAccountRecord("acct-2", "Personal", "personal@example.com"),
		},
	})

	before, err := service.LoadAccounts(context.Background())
	require.NoError(t, err)
	require.Equal(t, "acct-1", before.Accounts[0].ID)

	snapshot, err := service.RenameAccount(context.Background(), "acct-1", "Work Renamed")

	require.NoError(t, err)
	require.Equal(t, "acct-1", snapshot.Accounts[0].ID)
	require.Equal(t, "Work Renamed", snapshot.Accounts[0].DisplayName)
	require.Equal(t, before.Accounts[0].CreatedAt, snapshot.Accounts[0].CreatedAt)
	require.NotEqual(t, before.Accounts[0].UpdatedAt, snapshot.Accounts[0].UpdatedAt)
}

func TestRenameAccountRejectsDuplicateNames(t *testing.T) {
	t.Parallel()

	repository := NewFileRepository(filepath.Join(t.TempDir(), "accounts.json"))
	service := NewService(repository)
	seedStore(t, repository.path, AccountsStore{
		Version:         1,
		ActiveAccountID: stringPointer("acct-1"),
		Accounts: []AccountRecord{
			newAccountRecord("acct-1", "Work", "work@example.com"),
			newAccountRecord("acct-2", "Personal", "personal@example.com"),
		},
	})

	_, err := service.RenameAccount(context.Background(), "acct-1", "Personal")

	require.Error(t, err)
	var appErr contracts.AppError
	require.ErrorAs(t, err, &appErr)
	require.Equal(t, "account.name_conflict", appErr.Code)
}

func TestDeleteAccountPromotesNextRemainingActiveAccount(t *testing.T) {
	t.Parallel()

	repository := NewFileRepository(filepath.Join(t.TempDir(), "accounts.json"))
	service := NewService(repository)
	seedStore(t, repository.path, AccountsStore{
		Version:         1,
		ActiveAccountID: stringPointer("acct-2"),
		Accounts: []AccountRecord{
			newAccountRecord("acct-1", "One", "one@example.com"),
			newAccountRecord("acct-2", "Two", "two@example.com"),
			newAccountRecord("acct-3", "Three", "three@example.com"),
		},
	})

	snapshot, err := service.DeleteAccount(context.Background(), "acct-2")

	require.NoError(t, err)
	require.Equal(t, "acct-3", dereference(snapshot.ActiveAccountID))
	require.Len(t, snapshot.Accounts, 2)
	require.Equal(t, "acct-3", snapshot.Accounts[1].ID)
}

func TestDeleteLastAccountClearsActiveState(t *testing.T) {
	t.Parallel()

	repository := NewFileRepository(filepath.Join(t.TempDir(), "accounts.json"))
	service := NewService(repository)
	seedStore(t, repository.path, AccountsStore{
		Version:         1,
		ActiveAccountID: stringPointer("acct-1"),
		Accounts: []AccountRecord{
			newAccountRecord("acct-1", "Solo", "solo@example.com"),
		},
	})

	snapshot, err := service.DeleteAccount(context.Background(), "acct-1")

	require.NoError(t, err)
	require.Nil(t, snapshot.ActiveAccountID)
	require.Empty(t, snapshot.Accounts)
}

func seedStore(t *testing.T, path string, store AccountsStore) {
	t.Helper()

	require.NoError(t, os.MkdirAll(filepath.Dir(path), 0o755))

	payload, err := json.MarshalIndent(store, "", "  ")
	require.NoError(t, err)
	require.NoError(t, os.WriteFile(path, payload, 0o600))
}

func newAccountRecord(id string, displayName string, email string) AccountRecord {
	createdAt := time.Date(2026, time.March, 11, 8, 0, 0, 0, time.UTC)

	return AccountRecord{
		ID:          id,
		DisplayName: displayName,
		Email:       email,
		Auth: AccountAuth{
			Kind: "chatgpt",
			ChatGPT: &ChatGPTAuth{
				IDToken:      "id-" + id,
				AccessToken:  "access-" + id,
				RefreshToken: "refresh-" + id,
				AccountID:    stringPointer(id),
			},
		},
		CreatedAt: createdAt,
		UpdatedAt: createdAt,
	}
}

func stringPointer(value string) *string {
	return &value
}

func dereference(value *string) string {
	if value == nil {
		return ""
	}

	return *value
}
