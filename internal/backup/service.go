package backup

import (
	"bytes"
	"compress/zlib"
	"context"
	"crypto/rand"
	"crypto/sha256"
	"encoding/base64"
	"encoding/json"
	"errors"
	"io"
	"os"
	"path/filepath"
	"strings"
	"time"

	"codex-switch/internal/accounts"
	"codex-switch/internal/auth"
	"codex-switch/internal/contracts"
	"codex-switch/internal/settings"
	"codex-switch/internal/switching"

	"github.com/google/uuid"
	"golang.org/x/crypto/chacha20poly1305"
	"golang.org/x/crypto/pbkdf2"
)

const (
	slimExportPrefix  = "css1."
	slimFormatVersion = 1
	slimAuthAPIKey    = 0
	slimAuthChatGPT   = 1

	legacyFullVersion            = 2
	legacyFullSecurityLessSecure = 0
	legacyFullSecurityPassphrase = 1
	legacyFullSecurityKeychain   = 2
	legacyPresetPassphrase       = "gT7kQ9mV2xN4pL8sR1dH6zW3cB5yF0uJ_aE7nK2tP9vM4rX1"

	fullSaltLength   = 16
	fullNonceLength  = 24
	fullKeyLength    = 32
	fullIterations   = 210000
	maxImportJSONLen = 2 * 1024 * 1024
	maxImportFileLen = 8 * 1024 * 1024
)

var fullFileMagic = [4]byte{'C', 'S', 'W', 'F'}

type Keychain interface {
	Get(ctx context.Context) (string, error)
	GetOrCreate(ctx context.Context) (string, error)
}

type Service struct {
	repository         accounts.Repository
	authStore          switching.AuthFileStore
	preferencesService *settings.PreferencesService
	keychain           Keychain
	tokenExchanger     auth.TokenExchanger
	now                func() time.Time
	idGenerator        func() string
}

func NewService(
	repository accounts.Repository,
	authStore switching.AuthFileStore,
	preferencesService *settings.PreferencesService,
	keychain Keychain,
	tokenExchanger auth.TokenExchanger,
) *Service {
	return &Service{
		repository:         repository,
		authStore:          authStore,
		preferencesService: preferencesService,
		keychain:           keychain,
		tokenExchanger:     tokenExchanger,
		now:                time.Now().UTC,
		idGenerator:        uuid.NewString,
	}
}

func (s *Service) ExportSlimText(ctx context.Context) (string, error) {
	store, err := s.repository.Load(ctx)
	if err != nil {
		return "", contracts.AppError{Code: "backup.export_failed"}
	}

	payload, err := encodeSlimPayload(legacyStoreFromCurrent(store))
	if err != nil {
		return "", contracts.AppError{Code: "backup.export_failed"}
	}

	return payload, nil
}

func (s *Service) ImportSlimText(
	ctx context.Context,
	payload string,
) (contracts.BackupImportSummary, error) {
	currentStore, err := s.repository.Load(ctx)
	if err != nil {
		return contracts.BackupImportSummary{}, contracts.AppError{Code: "backup.import_failed"}
	}

	parsed, err := decodeSlimPayload(payload)
	if err != nil {
		return contracts.BackupImportSummary{}, contracts.AppError{Code: "backup.slim_invalid"}
	}

	importedStore, err := s.restoreSlimPayload(ctx, currentStore, parsed)
	if err != nil {
		return contracts.BackupImportSummary{}, err
	}

	summary, err := s.mergeAndPersist(ctx, currentStore, importedStore)
	if err != nil {
		return contracts.BackupImportSummary{}, err
	}

	summary.TotalInPayload = len(parsed.Accounts)
	summary.SkippedCount = summary.TotalInPayload - summary.ImportedCount
	return summary, nil
}

func (s *Service) ExportFull(ctx context.Context, input contracts.ExportFullBackupInput) error {
	if strings.TrimSpace(input.Path) == "" {
		return contracts.AppError{Code: "backup.full_invalid"}
	}

	store, err := s.repository.Load(ctx)
	if err != nil {
		return contracts.AppError{Code: "backup.export_failed"}
	}

	mode, err := s.preferencesService.EnsureBackupSecurityMode(ctx)
	if err != nil {
		return contracts.AppError{Code: "backup.export_failed"}
	}

	secret, modeByte, err := s.resolveExportSecret(ctx, mode, input.Passphrase)
	if err != nil {
		return err
	}

	content, err := encodeFullStore(store, modeByte, secret)
	if err != nil {
		return contracts.AppError{Code: "backup.export_failed"}
	}

	if err := writeBytesAtomic(input.Path, content); err != nil {
		return contracts.AppError{Code: "backup.export_failed"}
	}

	return nil
}

func (s *Service) ImportFull(
	ctx context.Context,
	input contracts.ImportFullBackupInput,
) (contracts.BackupImportSummary, error) {
	if strings.TrimSpace(input.Path) == "" {
		return contracts.BackupImportSummary{}, contracts.AppError{Code: "backup.full_invalid"}
	}

	currentStore, err := s.repository.Load(ctx)
	if err != nil {
		return contracts.BackupImportSummary{}, contracts.AppError{Code: "backup.import_failed"}
	}

	content, err := os.ReadFile(input.Path)
	if err != nil {
		return contracts.BackupImportSummary{}, contracts.AppError{Code: "backup.import_failed"}
	}
	if len(content) > maxImportFileLen {
		return contracts.BackupImportSummary{}, contracts.AppError{Code: "backup.full_invalid"}
	}

	importedStore, err := s.decodeFullStore(ctx, content, input.Passphrase)
	if err != nil {
		return contracts.BackupImportSummary{}, err
	}

	return s.mergeAndPersist(ctx, currentStore, importedStore)
}

func (s *Service) restoreSlimPayload(
	ctx context.Context,
	currentStore accounts.AccountsStore,
	payload slimPayload,
) (accounts.AccountsStore, error) {
	existingNames := make(map[string]struct{}, len(currentStore.Accounts))
	for _, account := range currentStore.Accounts {
		existingNames[account.DisplayName] = struct{}{}
	}

	now := s.now()
	importedAccounts := make([]accounts.AccountRecord, 0, len(payload.Accounts))
	var importedActiveID *string

	for _, entry := range payload.Accounts {
		if _, ok := existingNames[entry.Name]; ok {
			continue
		}

		account, err := s.restoreSlimAccount(ctx, entry, now)
		if err != nil {
			return accounts.AccountsStore{}, err
		}
		importedAccounts = append(importedAccounts, account)

		if payload.ActiveName != nil && *payload.ActiveName == entry.Name {
			importedActiveID = stringPointer(account.ID)
		}
	}

	if importedActiveID == nil && len(importedAccounts) > 0 {
		importedActiveID = stringPointer(importedAccounts[0].ID)
	}

	return accounts.AccountsStore{
		Version:         1,
		ActiveAccountID: importedActiveID,
		Accounts:        importedAccounts,
	}, nil
}

func (s *Service) restoreSlimAccount(
	ctx context.Context,
	entry slimAccountEntry,
	now time.Time,
) (accounts.AccountRecord, error) {
	switch entry.AuthType {
	case slimAuthAPIKey:
		if entry.APIKey == nil || strings.TrimSpace(*entry.APIKey) == "" {
			return accounts.AccountRecord{}, contracts.AppError{Code: "backup.slim_invalid"}
		}
		return accounts.AccountRecord{
			ID:          s.idGenerator(),
			DisplayName: entry.Name,
			Auth: accounts.AccountAuth{
				Kind: "apiKey",
				APIKey: &accounts.APIKeyCredentials{
					APIKey: *entry.APIKey,
				},
			},
			CreatedAt: now,
			UpdatedAt: now,
		}, nil
	case slimAuthChatGPT:
		if entry.RefreshToken == nil || strings.TrimSpace(*entry.RefreshToken) == "" {
			return accounts.AccountRecord{}, contracts.AppError{Code: "backup.slim_invalid"}
		}
		if s.tokenExchanger == nil {
			return accounts.AccountRecord{}, contracts.AppError{Code: "backup.import_failed"}
		}

		refreshResult, err := s.tokenExchanger.Refresh(ctx, *entry.RefreshToken)
		if err != nil || strings.TrimSpace(refreshResult.AccessToken) == "" {
			return accounts.AccountRecord{}, contracts.AppError{Code: "backup.import_failed"}
		}
		if refreshResult.IDToken == nil || strings.TrimSpace(*refreshResult.IDToken) == "" {
			return accounts.AccountRecord{}, contracts.AppError{Code: "backup.import_failed"}
		}

		nextRefreshToken := *entry.RefreshToken
		if refreshResult.RefreshToken != nil && strings.TrimSpace(*refreshResult.RefreshToken) != "" {
			nextRefreshToken = *refreshResult.RefreshToken
		}

		email, accountID := parseIDTokenClaims(*refreshResult.IDToken)
		return accounts.AccountRecord{
			ID:          s.idGenerator(),
			DisplayName: entry.Name,
			Email:       dereferenceString(email),
			Auth: accounts.AccountAuth{
				Kind: "chatgpt",
				ChatGPT: &accounts.ChatGPTCredentials{
					IDToken:      *refreshResult.IDToken,
					AccessToken:  refreshResult.AccessToken,
					RefreshToken: nextRefreshToken,
					AccountID:    copyStringPointer(accountID),
				},
			},
			CreatedAt:  now,
			UpdatedAt:  now,
			LastUsedAt: timePointer(now),
		}, nil
	default:
		return accounts.AccountRecord{}, contracts.AppError{Code: "backup.slim_invalid"}
	}
}

func (s *Service) mergeAndPersist(
	ctx context.Context,
	currentStore accounts.AccountsStore,
	importedStore accounts.AccountsStore,
) (contracts.BackupImportSummary, error) {
	mergedStore, summary, activeChanged := mergeAccountsStore(currentStore, importedStore)

	previousAuth, err := s.authStore.ReadCurrent(ctx)
	if err != nil {
		return contracts.BackupImportSummary{}, contracts.AppError{Code: "backup.import_failed"}
	}

	if activeChanged {
		if err := s.syncActiveAuthFile(ctx, mergedStore); err != nil {
			return contracts.BackupImportSummary{}, err
		}
	}

	if err := s.repository.Save(ctx, mergedStore); err != nil {
		if activeChanged {
			_ = s.authStore.Restore(ctx, previousAuth)
		}
		return contracts.BackupImportSummary{}, contracts.AppError{Code: "backup.import_failed"}
	}

	return summary, nil
}

func (s *Service) syncActiveAuthFile(ctx context.Context, store accounts.AccountsStore) error {
	if store.ActiveAccountID == nil {
		if err := s.authStore.Restore(ctx, nil); err != nil {
			return contracts.AppError{Code: "backup.import_failed"}
		}
		return nil
	}

	for _, account := range store.Accounts {
		if account.ID != *store.ActiveAccountID {
			continue
		}

		authFile, err := switching.BuildAuthFile(account, s.now())
		if err != nil {
			return contracts.AppError{Code: "backup.import_failed"}
		}
		if err := s.authStore.Write(ctx, *authFile); err != nil {
			return contracts.AppError{Code: "backup.import_failed"}
		}
		return nil
	}

	return nil
}

func (s *Service) resolveExportSecret(
	ctx context.Context,
	mode contracts.BackupSecurityMode,
	passphrase *string,
) (string, byte, error) {
	switch mode {
	case contracts.BackupSecurityModePassphrase:
		if passphrase == nil || strings.TrimSpace(*passphrase) == "" {
			return "", 0, contracts.AppError{Code: "backup.passphrase_required"}
		}
		return *passphrase, legacyFullSecurityPassphrase, nil
	default:
		if s.keychain == nil {
			return "", 0, contracts.AppError{Code: "backup.keychain_unavailable"}
		}
		secret, err := s.keychain.GetOrCreate(ctx)
		if err != nil || strings.TrimSpace(secret) == "" {
			return "", 0, contracts.AppError{Code: "backup.keychain_unavailable"}
		}
		return secret, legacyFullSecurityKeychain, nil
	}
}

func (s *Service) resolveImportSecret(
	ctx context.Context,
	mode byte,
	passphrase *string,
) (string, error) {
	switch mode {
	case legacyFullSecurityLessSecure:
		return legacyPresetPassphrase, nil
	case legacyFullSecurityPassphrase:
		if passphrase == nil || strings.TrimSpace(*passphrase) == "" {
			return "", contracts.AppError{Code: "backup.passphrase_required"}
		}
		return *passphrase, nil
	case legacyFullSecurityKeychain:
		if s.keychain == nil {
			return "", contracts.AppError{Code: "backup.keychain_unavailable"}
		}
		secret, err := s.keychain.Get(ctx)
		if err != nil || strings.TrimSpace(secret) == "" {
			return "", contracts.AppError{Code: "backup.keychain_unavailable"}
		}
		return secret, nil
	default:
		return "", contracts.AppError{Code: "backup.full_invalid"}
	}
}

func (s *Service) decodeFullStore(
	ctx context.Context,
	content []byte,
	passphrase *string,
) (accounts.AccountsStore, error) {
	if len(content) < 4+1+fullSaltLength+fullNonceLength {
		return accounts.AccountsStore{}, contracts.AppError{Code: "backup.full_invalid"}
	}
	if !bytes.Equal(content[:4], fullFileMagic[:]) {
		return accounts.AccountsStore{}, contracts.AppError{Code: "backup.full_invalid"}
	}

	version := content[4]
	mode := byte(legacyFullSecurityLessSecure)
	saltStart := 5
	if version == legacyFullVersion {
		if len(content) < 4+1+1+fullSaltLength+fullNonceLength {
			return accounts.AccountsStore{}, contracts.AppError{Code: "backup.full_invalid"}
		}
		mode = content[5]
		saltStart = 6
	} else if version != 1 {
		return accounts.AccountsStore{}, contracts.AppError{Code: "backup.full_invalid"}
	}

	secret, err := s.resolveImportSecret(ctx, mode, passphrase)
	if err != nil {
		return accounts.AccountsStore{}, err
	}

	nonceStart := saltStart + fullSaltLength
	ciphertextStart := nonceStart + fullNonceLength
	if len(content) <= ciphertextStart {
		return accounts.AccountsStore{}, contracts.AppError{Code: "backup.full_invalid"}
	}

	key := deriveEncryptionKey(secret, content[saltStart:nonceStart])
	cipher, err := chacha20poly1305.NewX(key[:])
	if err != nil {
		return accounts.AccountsStore{}, contracts.AppError{Code: "backup.full_invalid"}
	}

	compressed, err := cipher.Open(nil, content[nonceStart:ciphertextStart], content[ciphertextStart:], nil)
	if err != nil {
		return accounts.AccountsStore{}, contracts.AppError{Code: "backup.full_invalid"}
	}

	jsonPayload, err := decompressWithLimit(compressed, maxImportJSONLen)
	if err != nil {
		return accounts.AccountsStore{}, contracts.AppError{Code: "backup.full_invalid"}
	}

	if legacyStore, err := decodeLegacyAccountsStore(jsonPayload); err == nil {
		return legacyStore, nil
	}

	var currentStore accounts.AccountsStore
	if err := json.Unmarshal(jsonPayload, &currentStore); err != nil {
		return accounts.AccountsStore{}, contracts.AppError{Code: "backup.full_invalid"}
	}
	if err := validateCurrentAccountsStore(currentStore); err != nil {
		return accounts.AccountsStore{}, contracts.AppError{Code: "backup.full_invalid"}
	}
	if currentStore.Version == 0 {
		currentStore.Version = 1
	}
	if currentStore.Accounts == nil {
		currentStore.Accounts = []accounts.AccountRecord{}
	}

	return currentStore, nil
}

func mergeAccountsStore(
	current accounts.AccountsStore,
	imported accounts.AccountsStore,
) (accounts.AccountsStore, contracts.BackupImportSummary, bool) {
	merged := accounts.CloneStore(current)
	previousActive := copyStringPointer(merged.ActiveAccountID)

	existingIDs := make(map[string]struct{}, len(merged.Accounts))
	existingNames := make(map[string]struct{}, len(merged.Accounts))
	for _, account := range merged.Accounts {
		existingIDs[account.ID] = struct{}{}
		existingNames[account.DisplayName] = struct{}{}
	}

	importedCount := 0
	for _, account := range imported.Accounts {
		if _, ok := existingIDs[account.ID]; ok {
			continue
		}
		if _, ok := existingNames[account.DisplayName]; ok {
			continue
		}

		existingIDs[account.ID] = struct{}{}
		existingNames[account.DisplayName] = struct{}{}
		merged.Accounts = append(merged.Accounts, account)
		importedCount++
	}

	merged.Version = maxInt(maxInt(merged.Version, imported.Version), 1)
	currentActiveValid := merged.ActiveAccountID != nil && accountExists(merged.Accounts, *merged.ActiveAccountID)
	if !currentActiveValid {
		switch {
		case imported.ActiveAccountID != nil && accountExists(merged.Accounts, *imported.ActiveAccountID):
			merged.ActiveAccountID = copyStringPointer(imported.ActiveAccountID)
		case len(merged.Accounts) > 0:
			merged.ActiveAccountID = stringPointer(merged.Accounts[0].ID)
		default:
			merged.ActiveAccountID = nil
		}
	}

	return merged, contracts.BackupImportSummary{
		TotalInPayload: len(imported.Accounts),
		ImportedCount:  importedCount,
		SkippedCount:   len(imported.Accounts) - importedCount,
	}, !sameStringPointers(previousActive, merged.ActiveAccountID)
}

func accountExists(accountsList []accounts.AccountRecord, accountID string) bool {
	for _, account := range accountsList {
		if account.ID == accountID {
			return true
		}
	}
	return false
}

func sameStringPointers(left *string, right *string) bool {
	switch {
	case left == nil && right == nil:
		return true
	case left == nil || right == nil:
		return false
	default:
		return *left == *right
	}
}

func encodeSlimPayload(store legacyAccountsStore) (string, error) {
	activeName := legacyActiveName(store)
	items := make([]slimAccountEntry, 0, len(store.Accounts))
	for _, account := range store.Accounts {
		switch account.AuthMode {
		case "api_key":
			items = append(items, slimAccountEntry{
				Name:     account.Name,
				AuthType: slimAuthAPIKey,
				APIKey:   stringPointer(account.AuthData.Key),
			})
		case "chat_gpt":
			items = append(items, slimAccountEntry{
				Name:         account.Name,
				AuthType:     slimAuthChatGPT,
				RefreshToken: stringPointer(account.AuthData.RefreshToken),
			})
		default:
			return "", errors.New("unsupported auth mode")
		}
	}

	jsonPayload, err := json.Marshal(slimPayload{
		Version:    slimFormatVersion,
		ActiveName: activeName,
		Accounts:   items,
	})
	if err != nil {
		return "", err
	}
	compressed, err := compressBytes(jsonPayload)
	if err != nil {
		return "", err
	}
	return slimExportPrefix + base64.RawURLEncoding.EncodeToString(compressed), nil
}

func decodeSlimPayload(payload string) (slimPayload, error) {
	normalized := strings.Map(func(r rune) rune {
		switch r {
		case ' ', '\n', '\r', '\t':
			return -1
		default:
			return r
		}
	}, payload)
	if normalized == "" {
		return slimPayload{}, errors.New("empty slim payload")
	}

	normalized = strings.TrimPrefix(normalized, slimExportPrefix)
	compressed, err := base64.RawURLEncoding.DecodeString(normalized)
	if err != nil {
		return slimPayload{}, err
	}
	jsonPayload, err := decompressWithLimit(compressed, maxImportJSONLen)
	if err != nil {
		return slimPayload{}, err
	}

	var decoded slimPayload
	if err := json.Unmarshal(jsonPayload, &decoded); err != nil {
		return slimPayload{}, err
	}
	if err := validateSlimPayload(decoded); err != nil {
		return slimPayload{}, err
	}
	return decoded, nil
}

func validateSlimPayload(payload slimPayload) error {
	if payload.Version != slimFormatVersion {
		return errors.New("unsupported version")
	}

	names := map[string]struct{}{}
	for _, entry := range payload.Accounts {
		if strings.TrimSpace(entry.Name) == "" {
			return errors.New("empty name")
		}
		if _, ok := names[entry.Name]; ok {
			return errors.New("duplicate name")
		}
		names[entry.Name] = struct{}{}

		switch entry.AuthType {
		case slimAuthAPIKey:
			if entry.APIKey == nil || strings.TrimSpace(*entry.APIKey) == "" {
				return errors.New("missing api key")
			}
		case slimAuthChatGPT:
			if entry.RefreshToken == nil || strings.TrimSpace(*entry.RefreshToken) == "" {
				return errors.New("missing refresh token")
			}
		default:
			return errors.New("unsupported auth type")
		}
	}

	if payload.ActiveName != nil {
		if _, ok := names[*payload.ActiveName]; !ok {
			return errors.New("missing active name")
		}
	}
	return nil
}

func encodeFullStore(store accounts.AccountsStore, mode byte, secret string) ([]byte, error) {
	jsonPayload, err := json.Marshal(store)
	if err != nil {
		return nil, err
	}
	compressed, err := compressBytes(jsonPayload)
	if err != nil {
		return nil, err
	}

	salt := make([]byte, fullSaltLength)
	if _, err := rand.Read(salt); err != nil {
		return nil, err
	}
	nonce := make([]byte, fullNonceLength)
	if _, err := rand.Read(nonce); err != nil {
		return nil, err
	}

	key := deriveEncryptionKey(secret, salt)
	cipher, err := chacha20poly1305.NewX(key[:])
	if err != nil {
		return nil, err
	}
	ciphertext := cipher.Seal(nil, nonce, compressed, nil)

	out := make([]byte, 0, 4+1+1+fullSaltLength+fullNonceLength+len(ciphertext))
	out = append(out, fullFileMagic[:]...)
	out = append(out, legacyFullVersion)
	out = append(out, mode)
	out = append(out, salt...)
	out = append(out, nonce...)
	out = append(out, ciphertext...)
	return out, nil
}

func compressBytes(payload []byte) ([]byte, error) {
	var buffer bytes.Buffer
	writer := zlib.NewWriter(&buffer)
	if _, err := writer.Write(payload); err != nil {
		_ = writer.Close()
		return nil, err
	}
	if err := writer.Close(); err != nil {
		return nil, err
	}
	return buffer.Bytes(), nil
}

func decompressWithLimit(payload []byte, limit int64) ([]byte, error) {
	reader, err := zlib.NewReader(bytes.NewReader(payload))
	if err != nil {
		return nil, err
	}
	defer reader.Close()

	limited := io.LimitReader(reader, limit+1)
	result, err := io.ReadAll(limited)
	if err != nil {
		return nil, err
	}
	if int64(len(result)) > limit {
		return nil, errors.New("payload too large")
	}
	return result, nil
}

func deriveEncryptionKey(secret string, salt []byte) [fullKeyLength]byte {
	derived := pbkdf2.Key([]byte(secret), salt, fullIterations, fullKeyLength, sha256.New)
	var key [fullKeyLength]byte
	copy(key[:], derived)
	return key
}

func writeBytesAtomic(path string, content []byte) error {
	if err := os.MkdirAll(filepath.Dir(path), 0o755); err != nil {
		return err
	}

	tempFile, err := os.CreateTemp(filepath.Dir(path), "backup-*.tmp")
	if err != nil {
		return err
	}
	tempPath := tempFile.Name()
	if _, err := tempFile.Write(content); err != nil {
		_ = tempFile.Close()
		_ = os.Remove(tempPath)
		return err
	}
	if err := tempFile.Close(); err != nil {
		_ = os.Remove(tempPath)
		return err
	}
	if err := os.Chmod(tempPath, 0o600); err != nil {
		_ = os.Remove(tempPath)
		return err
	}
	if err := os.Rename(tempPath, path); err != nil {
		_ = os.Remove(tempPath)
		return err
	}
	return nil
}

func parseIDTokenClaims(idToken string) (*string, *string) {
	parts := strings.Split(idToken, ".")
	if len(parts) != 3 {
		return nil, nil
	}

	payload, err := base64.RawURLEncoding.DecodeString(parts[1])
	if err != nil {
		return nil, nil
	}

	var decoded struct {
		Email string `json:"email"`
		Auth  struct {
			AccountID string `json:"chatgpt_account_id"`
		} `json:"https://api.openai.com/auth"`
	}
	if err := json.Unmarshal(payload, &decoded); err != nil {
		return nil, nil
	}

	var email *string
	if strings.TrimSpace(decoded.Email) != "" {
		email = stringPointer(decoded.Email)
	}
	var accountID *string
	if strings.TrimSpace(decoded.Auth.AccountID) != "" {
		accountID = stringPointer(decoded.Auth.AccountID)
	}
	return email, accountID
}

func copyStringPointer(value *string) *string {
	if value == nil {
		return nil
	}
	copyValue := *value
	return &copyValue
}

func stringPointer(value string) *string {
	return &value
}

func timePointer(value time.Time) *time.Time {
	return &value
}

func dereferenceString(value *string) string {
	if value == nil {
		return ""
	}
	return *value
}
