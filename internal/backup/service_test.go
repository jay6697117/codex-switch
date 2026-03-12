package backup

import (
	"bytes"
	"compress/zlib"
	"context"
	"encoding/base64"
	"encoding/json"
	"os"
	"path/filepath"
	"testing"
	"time"

	"codex-switch/internal/accounts"
	"codex-switch/internal/auth"
	"codex-switch/internal/contracts"
	"codex-switch/internal/settings"
	"codex-switch/internal/switching"

	"github.com/stretchr/testify/require"
	"golang.org/x/crypto/chacha20poly1305"
)

func TestImportSlimTextSkipsDuplicatesAndActivatesImportedAccountWhenNoActiveExists(t *testing.T) {
	t.Parallel()

	paths := newBackupPaths(t)
	repository := accounts.NewFileRepository(paths.accounts)
	store := settings.NewStore(paths.preferences)
	authStore := switching.NewFileAuthStore(switching.StaticHomeResolver{Path: paths.codexHome})

	seedAccountsStore(t, paths.accounts, accounts.AccountsStore{
		Version: 1,
		Accounts: []accounts.AccountRecord{
			newAPIKeyAccount("acct-existing", "Work", "existing-key"),
		},
	})

	service := NewService(
		repository,
		authStore,
		settings.NewPreferencesService(store, fakeBackupLocaleDetector{locale: "en-US"}),
		fakeKeychain{},
		fakeTokenExchanger{
			result: auth.RefreshResult{
				IDToken:      stringPointer(fakeJWT(t, `{"email":"travel@example.com","https://api.openai.com/auth":{"chatgpt_account_id":"acct-openai"}}`)),
				AccessToken:  "travel-access",
				RefreshToken: stringPointer("travel-refresh-next"),
			},
		},
	)
	service.now = func() time.Time {
		return time.Date(2026, 3, 12, 10, 0, 0, 0, time.UTC)
	}
	service.idGenerator = func() string {
		return "acct-imported"
	}

	summary, err := service.ImportSlimText(context.Background(), buildSlimPayload(t, slimPayload{
		Version:    1,
		ActiveName: stringPointer("Travel"),
		Accounts: []slimAccountEntry{
			{Name: "Work", AuthType: slimAuthAPIKey, APIKey: stringPointer("ignored-key")},
			{Name: "Travel", AuthType: slimAuthChatGPT, RefreshToken: stringPointer("travel-refresh")},
		},
	}))

	require.NoError(t, err)
	require.Equal(t, contracts.BackupImportSummary{
		TotalInPayload: 2,
		ImportedCount:  1,
		SkippedCount:   1,
	}, summary)

	storeAfter, err := repository.Load(context.Background())
	require.NoError(t, err)
	require.Equal(t, "acct-imported", dereference(storeAfter.ActiveAccountID))
	require.Len(t, storeAfter.Accounts, 2)
	require.Equal(t, "Travel", storeAfter.Accounts[1].DisplayName)
	require.Equal(t, "travel@example.com", storeAfter.Accounts[1].Email)
	require.Equal(t, "travel-refresh-next", storeAfter.Accounts[1].Auth.ChatGPT.RefreshToken)

	authFile, err := authStore.ReadCurrent(context.Background())
	require.NoError(t, err)
	require.NotNil(t, authFile)
	require.NotNil(t, authFile.Tokens)
	require.Equal(t, "travel-access", authFile.Tokens.AccessToken)
}

func TestImportFullFileAcceptsLegacyLessSecureFileAndPreservesCurrentActiveAccount(t *testing.T) {
	t.Parallel()

	paths := newBackupPaths(t)
	repository := accounts.NewFileRepository(paths.accounts)
	store := settings.NewStore(paths.preferences)
	authStore := switching.NewFileAuthStore(switching.StaticHomeResolver{Path: paths.codexHome})

	activeAccount := newChatGPTAccount(
		"acct-active",
		"Primary",
		"primary@example.com",
		"primary-id",
		"primary-access",
		"primary-refresh",
	)
	activeAccount.PlanType = stringPointer("team")
	seedAccountsStore(t, paths.accounts, accounts.AccountsStore{
		Version:         1,
		ActiveAccountID: stringPointer("acct-active"),
		Accounts:        []accounts.AccountRecord{activeAccount},
	})
	require.NoError(t, authStore.Write(context.Background(), switching.AuthFile{
		Tokens: &switching.TokenData{
			IDToken:      "primary-id",
			AccessToken:  "primary-access",
			RefreshToken: "primary-refresh",
		},
	}))

	service := NewService(
		repository,
		authStore,
		settings.NewPreferencesService(store, fakeBackupLocaleDetector{locale: "en-US"}),
		fakeKeychain{},
		fakeTokenExchanger{},
	)

	legacyStore := legacyAccountsStore{
		Version:         1,
		ActiveAccountID: stringPointer("legacy-imported"),
		Accounts: []legacyStoredAccount{
			{
				ID:       "legacy-imported",
				Name:     "Imported Account",
				Email:    stringPointer("imported@example.com"),
				PlanType: stringPointer("plus"),
				AuthMode: "chat_gpt",
				AuthData: legacyAuthData{
					Type:         "chat_gpt",
					IDToken:      "import-id",
					AccessToken:  "import-access",
					RefreshToken: "import-refresh",
				},
				CreatedAt: time.Date(2026, 3, 10, 9, 0, 0, 0, time.UTC),
			},
		},
	}
	fullFilePath := filepath.Join(t.TempDir(), "origin-less-secure.cswf")
	require.NoError(t, os.WriteFile(
		fullFilePath,
		mustEncodeLegacyFullFile(t, legacyStore, legacyFullSecurityLessSecure, legacyPresetPassphrase),
		0o600,
	))

	summary, err := service.ImportFull(context.Background(), contracts.ImportFullBackupInput{
		Path: fullFilePath,
	})

	require.NoError(t, err)
	require.Equal(t, 1, summary.ImportedCount)

	storeAfter, err := repository.Load(context.Background())
	require.NoError(t, err)
	require.Equal(t, "acct-active", dereference(storeAfter.ActiveAccountID))
	require.Len(t, storeAfter.Accounts, 2)
	require.Equal(t, "plus", dereference(storeAfter.Accounts[1].PlanType))

	authFile, err := authStore.ReadCurrent(context.Background())
	require.NoError(t, err)
	require.NotNil(t, authFile)
	require.NotNil(t, authFile.Tokens)
	require.Equal(t, "primary-access", authFile.Tokens.AccessToken)
}

func TestExportFullAndImportRoundTripWithPassphraseMode(t *testing.T) {
	t.Parallel()

	exportPaths := newBackupPaths(t)
	exportRepository := accounts.NewFileRepository(exportPaths.accounts)
	exportStore := settings.NewStore(exportPaths.preferences)
	authStore := switching.NewFileAuthStore(switching.StaticHomeResolver{Path: exportPaths.codexHome})

	seedAccountsStore(t, exportPaths.accounts, accounts.AccountsStore{
		Version:         1,
		ActiveAccountID: stringPointer("acct-roundtrip"),
		Accounts: []accounts.AccountRecord{
			newAPIKeyAccount("acct-roundtrip", "Roundtrip", "roundtrip-key"),
		},
	})
	_, err := settings.NewPreferencesService(exportStore, fakeBackupLocaleDetector{locale: "en-US"}).Save(
		context.Background(),
		contracts.SaveSettingsInput{
			LocalePreference:   contracts.LocalePreferenceSystem,
			BackupSecurityMode: contracts.BackupSecurityModePassphrase,
		},
	)
	require.NoError(t, err)

	exportService := NewService(
		exportRepository,
		authStore,
		settings.NewPreferencesService(exportStore, fakeBackupLocaleDetector{locale: "en-US"}),
		fakeKeychain{},
		fakeTokenExchanger{},
	)

	fullFilePath := filepath.Join(t.TempDir(), "roundtrip.cswf")
	require.NoError(t, exportService.ExportFull(context.Background(), contracts.ExportFullBackupInput{
		Path:       fullFilePath,
		Passphrase: stringPointer("portable-secret"),
	}))

	importPaths := newBackupPaths(t)
	importRepository := accounts.NewFileRepository(importPaths.accounts)
	importStore := settings.NewStore(importPaths.preferences)
	importAuthStore := switching.NewFileAuthStore(switching.StaticHomeResolver{Path: importPaths.codexHome})
	importService := NewService(
		importRepository,
		importAuthStore,
		settings.NewPreferencesService(importStore, fakeBackupLocaleDetector{locale: "en-US"}),
		fakeKeychain{},
		fakeTokenExchanger{},
	)

	summary, err := importService.ImportFull(context.Background(), contracts.ImportFullBackupInput{
		Path:       fullFilePath,
		Passphrase: stringPointer("portable-secret"),
	})

	require.NoError(t, err)
	require.Equal(t, 1, summary.ImportedCount)

	storeAfter, err := importRepository.Load(context.Background())
	require.NoError(t, err)
	require.Equal(t, "acct-roundtrip", dereference(storeAfter.ActiveAccountID))
	require.Len(t, storeAfter.Accounts, 1)
	require.Equal(t, "Roundtrip", storeAfter.Accounts[0].DisplayName)
}

type fakeTokenExchanger struct {
	result auth.RefreshResult
	err    error
}

func (f fakeTokenExchanger) Refresh(context.Context, string) (auth.RefreshResult, error) {
	return f.result, f.err
}

type fakeKeychain struct {
	secret string
	err    error
}

func (f fakeKeychain) Get(context.Context) (string, error) {
	if f.err != nil {
		return "", f.err
	}
	if f.secret == "" {
		return "device-secret", nil
	}
	return f.secret, nil
}

func (f fakeKeychain) GetOrCreate(ctx context.Context) (string, error) {
	return f.Get(ctx)
}

type backupPaths struct {
	accounts    string
	preferences string
	codexHome   string
}

func newBackupPaths(t *testing.T) backupPaths {
	t.Helper()

	dir := t.TempDir()
	return backupPaths{
		accounts:    filepath.Join(dir, "accounts.json"),
		preferences: filepath.Join(dir, "preferences.json"),
		codexHome:   filepath.Join(dir, ".codex"),
	}
}

func seedAccountsStore(t *testing.T, path string, store accounts.AccountsStore) {
	t.Helper()

	require.NoError(t, os.MkdirAll(filepath.Dir(path), 0o755))
	payload, err := json.MarshalIndent(store, "", "  ")
	require.NoError(t, err)
	require.NoError(t, os.WriteFile(path, payload, 0o600))
}

func newAPIKeyAccount(id string, name string, apiKey string) accounts.AccountRecord {
	now := time.Date(2026, 3, 12, 8, 0, 0, 0, time.UTC)
	return accounts.AccountRecord{
		ID:          id,
		DisplayName: name,
		Auth: accounts.AccountAuth{
			Kind: "apiKey",
			APIKey: &accounts.APIKeyCredentials{
				APIKey: apiKey,
				Label:  "Imported",
			},
		},
		CreatedAt: now,
		UpdatedAt: now,
	}
}

func newChatGPTAccount(
	id string,
	name string,
	email string,
	idToken string,
	accessToken string,
	refreshToken string,
) accounts.AccountRecord {
	now := time.Date(2026, 3, 12, 8, 0, 0, 0, time.UTC)
	return accounts.AccountRecord{
		ID:          id,
		DisplayName: name,
		Email:       email,
		Auth: accounts.AccountAuth{
			Kind: "chatgpt",
			ChatGPT: &accounts.ChatGPTCredentials{
				IDToken:      idToken,
				AccessToken:  accessToken,
				RefreshToken: refreshToken,
			},
		},
		CreatedAt: now,
		UpdatedAt: now,
	}
}

func buildSlimPayload(t *testing.T, payload slimPayload) string {
	t.Helper()

	wire := map[string]any{
		"v": payload.Version,
		"c": payload.Accounts,
	}
	if payload.ActiveName != nil {
		wire["a"] = *payload.ActiveName
	}

	jsonBytes, err := json.Marshal(wire)
	require.NoError(t, err)

	var compressed bytes.Buffer
	writer := zlib.NewWriter(&compressed)
	_, err = writer.Write(jsonBytes)
	require.NoError(t, err)
	require.NoError(t, writer.Close())

	return "css1." + base64.RawURLEncoding.EncodeToString(compressed.Bytes())
}

func mustEncodeLegacyFullFile(
	t *testing.T,
	store legacyAccountsStore,
	mode byte,
	secret string,
) []byte {
	t.Helper()

	jsonPayload, err := json.Marshal(store)
	require.NoError(t, err)

	var compressed bytes.Buffer
	writer := zlib.NewWriter(&compressed)
	_, err = writer.Write(jsonPayload)
	require.NoError(t, err)
	require.NoError(t, writer.Close())

	salt := bytes.Repeat([]byte{1}, fullSaltLength)
	nonce := bytes.Repeat([]byte{2}, fullNonceLength)
	key := deriveEncryptionKey(secret, salt)

	cipher, err := chacha20poly1305.NewX(key[:])
	require.NoError(t, err)
	ciphertext := cipher.Seal(nil, nonce, compressed.Bytes(), nil)

	out := make([]byte, 0, 4+1+1+fullSaltLength+fullNonceLength+len(ciphertext))
	out = append(out, fullFileMagic[:]...)
	out = append(out, legacyFullVersion)
	out = append(out, mode)
	out = append(out, salt...)
	out = append(out, nonce...)
	out = append(out, ciphertext...)
	return out
}

func fakeJWT(t *testing.T, claims string) string {
	t.Helper()

	header := base64.RawURLEncoding.EncodeToString([]byte(`{"alg":"none","typ":"JWT"}`))
	payload := base64.RawURLEncoding.EncodeToString([]byte(claims))
	return header + "." + payload + ".signature"
}

type fakeBackupLocaleDetector struct {
	locale string
	err    error
}

func (f fakeBackupLocaleDetector) DetectLocale(context.Context) (string, error) {
	return f.locale, f.err
}

func dereference(value *string) string {
	if value == nil {
		return ""
	}
	return *value
}
