package backup

import (
	"encoding/json"
	"errors"
	"strings"
	"time"

	"codex-switch/internal/accounts"
)

type slimPayload struct {
	Version    int                `json:"v"`
	ActiveName *string            `json:"a,omitempty"`
	Accounts   []slimAccountEntry `json:"c"`
}

type slimAccountEntry struct {
	Name         string  `json:"n"`
	AuthType     int     `json:"t"`
	APIKey       *string `json:"k,omitempty"`
	RefreshToken *string `json:"r,omitempty"`
}

type legacyAccountsStore struct {
	Version         int                 `json:"version"`
	Accounts        []legacyStoredAccount `json:"accounts"`
	ActiveAccountID *string             `json:"active_account_id,omitempty"`
}

type legacyStoredAccount struct {
	ID         string         `json:"id"`
	Name       string         `json:"name"`
	Email      *string        `json:"email,omitempty"`
	PlanType   *string        `json:"plan_type,omitempty"`
	AuthMode   string         `json:"auth_mode"`
	AuthData   legacyAuthData `json:"auth_data"`
	CreatedAt  time.Time      `json:"created_at"`
	LastUsedAt *time.Time     `json:"last_used_at,omitempty"`
}

type legacyAuthData struct {
	Type         string  `json:"type"`
	Key          string  `json:"key,omitempty"`
	IDToken      string  `json:"id_token,omitempty"`
	AccessToken  string  `json:"access_token,omitempty"`
	RefreshToken string  `json:"refresh_token,omitempty"`
	AccountID    *string `json:"account_id,omitempty"`
}

func legacyStoreFromCurrent(store accounts.AccountsStore) legacyAccountsStore {
	legacyAccounts := make([]legacyStoredAccount, 0, len(store.Accounts))
	for _, account := range store.Accounts {
		entry := legacyStoredAccount{
			ID:         account.ID,
			Name:       account.DisplayName,
			Email:      optionalString(account.Email),
			PlanType:   copyStringPointer(account.PlanType),
			CreatedAt:  account.CreatedAt,
			LastUsedAt: copyTimePointer(account.LastUsedAt),
		}

		switch account.Auth.Kind {
		case "apiKey":
			entry.AuthMode = "api_key"
			if account.Auth.APIKey != nil {
				entry.AuthData = legacyAuthData{
					Type: "api_key",
					Key:  account.Auth.APIKey.APIKey,
				}
			}
		default:
			entry.AuthMode = "chat_gpt"
			if account.Auth.ChatGPT != nil {
				entry.AuthData = legacyAuthData{
					Type:         "chat_gpt",
					IDToken:      account.Auth.ChatGPT.IDToken,
					AccessToken:  account.Auth.ChatGPT.AccessToken,
					RefreshToken: account.Auth.ChatGPT.RefreshToken,
					AccountID:    copyStringPointer(account.Auth.ChatGPT.AccountID),
				}
			}
		}

		legacyAccounts = append(legacyAccounts, entry)
	}

	return legacyAccountsStore{
		Version:         maxInt(store.Version, 1),
		Accounts:        legacyAccounts,
		ActiveAccountID: copyStringPointer(store.ActiveAccountID),
	}
}

func decodeLegacyAccountsStore(content []byte) (accounts.AccountsStore, error) {
	var legacyStore legacyAccountsStore
	if err := json.Unmarshal(content, &legacyStore); err != nil {
		return accounts.AccountsStore{}, err
	}
	if err := validateLegacyAccountsStore(legacyStore); err != nil {
		return accounts.AccountsStore{}, err
	}

	currentAccounts := make([]accounts.AccountRecord, 0, len(legacyStore.Accounts))
	for _, account := range legacyStore.Accounts {
		entry := accounts.AccountRecord{
			ID:          account.ID,
			DisplayName: account.Name,
			Email:       dereferenceString(account.Email),
			PlanType:    copyStringPointer(account.PlanType),
			CreatedAt:   account.CreatedAt,
			UpdatedAt:   account.CreatedAt,
			LastUsedAt:  copyTimePointer(account.LastUsedAt),
		}

		switch account.AuthMode {
		case "api_key":
			entry.Auth = accounts.AccountAuth{
				Kind: "apiKey",
				APIKey: &accounts.APIKeyCredentials{
					APIKey: account.AuthData.Key,
				},
			}
		case "chat_gpt":
			entry.Auth = accounts.AccountAuth{
				Kind: "chatgpt",
				ChatGPT: &accounts.ChatGPTCredentials{
					IDToken:      account.AuthData.IDToken,
					AccessToken:  account.AuthData.AccessToken,
					RefreshToken: account.AuthData.RefreshToken,
					AccountID:    copyStringPointer(account.AuthData.AccountID),
				},
			}
		default:
			return accounts.AccountsStore{}, errors.New("unsupported legacy auth mode")
		}

		currentAccounts = append(currentAccounts, entry)
	}

	return accounts.AccountsStore{
		Version:         maxInt(legacyStore.Version, 1),
		Accounts:        currentAccounts,
		ActiveAccountID: copyStringPointer(legacyStore.ActiveAccountID),
	}, nil
}

func validateLegacyAccountsStore(store legacyAccountsStore) error {
	ids := map[string]struct{}{}
	names := map[string]struct{}{}

	for _, account := range store.Accounts {
		if strings.TrimSpace(account.ID) == "" || strings.TrimSpace(account.Name) == "" {
			return errors.New("invalid legacy account")
		}
		if _, ok := ids[account.ID]; ok {
			return errors.New("duplicate legacy id")
		}
		if _, ok := names[account.Name]; ok {
			return errors.New("duplicate legacy name")
		}
		ids[account.ID] = struct{}{}
		names[account.Name] = struct{}{}

		switch account.AuthMode {
		case "api_key":
			if strings.TrimSpace(account.AuthData.Key) == "" {
				return errors.New("missing api key")
			}
		case "chat_gpt":
			if strings.TrimSpace(account.AuthData.IDToken) == "" ||
				strings.TrimSpace(account.AuthData.AccessToken) == "" ||
				strings.TrimSpace(account.AuthData.RefreshToken) == "" {
				return errors.New("missing oauth tokens")
			}
		default:
			return errors.New("unsupported auth mode")
		}
	}

	if store.ActiveAccountID != nil {
		if _, ok := ids[*store.ActiveAccountID]; !ok {
			return errors.New("missing active account")
		}
	}

	return nil
}

func validateCurrentAccountsStore(store accounts.AccountsStore) error {
	ids := map[string]struct{}{}
	names := map[string]struct{}{}

	for _, account := range store.Accounts {
		if strings.TrimSpace(account.ID) == "" || strings.TrimSpace(account.DisplayName) == "" {
			return errors.New("invalid account")
		}
		if _, ok := ids[account.ID]; ok {
			return errors.New("duplicate id")
		}
		if _, ok := names[account.DisplayName]; ok {
			return errors.New("duplicate name")
		}
		ids[account.ID] = struct{}{}
		names[account.DisplayName] = struct{}{}
	}

	if store.ActiveAccountID != nil {
		if _, ok := ids[*store.ActiveAccountID]; !ok {
			return errors.New("missing active account")
		}
	}

	return nil
}

func legacyActiveName(store legacyAccountsStore) *string {
	if store.ActiveAccountID == nil {
		return nil
	}
	for _, account := range store.Accounts {
		if account.ID == *store.ActiveAccountID {
			return stringPointer(account.Name)
		}
	}
	return nil
}

func optionalString(value string) *string {
	if strings.TrimSpace(value) == "" {
		return nil
	}
	return stringPointer(value)
}

func copyTimePointer(value *time.Time) *time.Time {
	if value == nil {
		return nil
	}
	copyValue := *value
	return &copyValue
}

func maxInt(left int, right int) int {
	if left > right {
		return left
	}
	return right
}
