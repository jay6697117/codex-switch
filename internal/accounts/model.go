package accounts

import (
	"time"

	"codex-switch/internal/contracts"
)

const storeVersion = 1

type AccountsStore struct {
	Version         int             `json:"version"`
	ActiveAccountID *string         `json:"activeAccountId"`
	Accounts        []AccountRecord `json:"accounts"`
}

type AccountRecord struct {
	ID          string      `json:"id"`
	DisplayName string      `json:"displayName"`
	Email       string      `json:"email,omitempty"`
	PlanType    *string     `json:"planType,omitempty"`
	Auth        AccountAuth `json:"auth"`
	CreatedAt   time.Time   `json:"createdAt"`
	UpdatedAt   time.Time   `json:"updatedAt"`
	LastUsedAt  *time.Time  `json:"lastUsedAt,omitempty"`
}

type AccountAuth struct {
	Kind    string              `json:"kind"`
	ChatGPT *ChatGPTCredentials `json:"chatgpt,omitempty"`
	APIKey  *APIKeyCredentials  `json:"apiKey,omitempty"`
}

type ChatGPTCredentials struct {
	IDToken      string  `json:"idToken,omitempty"`
	AccessToken  string  `json:"accessToken,omitempty"`
	RefreshToken string  `json:"refreshToken,omitempty"`
	AccountID    *string `json:"accountId,omitempty"`
}

type APIKeyCredentials struct {
	APIKey string `json:"apiKey,omitempty"`
	Label  string `json:"label,omitempty"`
}

func defaultStore() AccountsStore {
	return AccountsStore{
		Version:         storeVersion,
		ActiveAccountID: nil,
		Accounts:        []AccountRecord{},
	}
}

type ChatGPTAuth = ChatGPTCredentials
type APIKeyAuth = APIKeyCredentials

func CloneStore(store AccountsStore) AccountsStore {
	clonedAccounts := make([]AccountRecord, 0, len(store.Accounts))
	for _, account := range store.Accounts {
		clonedAccounts = append(clonedAccounts, cloneAccountRecord(account))
	}

	return AccountsStore{
		Version:         store.Version,
		ActiveAccountID: copyStringPointer(store.ActiveAccountID),
		Accounts:        clonedAccounts,
	}
}

func SnapshotFromStore(store AccountsStore) contracts.AccountsSnapshot {
	accountsList := make([]contracts.AccountSummary, 0, len(store.Accounts))
	for _, account := range store.Accounts {
		accountsList = append(accountsList, contracts.AccountSummary{
			ID:          account.ID,
			DisplayName: account.DisplayName,
			Email:       account.Email,
			AuthKind:    account.Auth.Kind,
			CreatedAt:   account.CreatedAt.Format(time.RFC3339Nano),
			UpdatedAt:   account.UpdatedAt.Format(time.RFC3339Nano),
			LastUsedAt:  formatTimePointer(account.LastUsedAt),
		})
	}

	return contracts.AccountsSnapshot{
		ActiveAccountID: copyStringPointer(store.ActiveAccountID),
		Accounts:        accountsList,
	}
}

func cloneAccountRecord(account AccountRecord) AccountRecord {
	cloned := account
	cloned.PlanType = copyStringPointer(account.PlanType)
	cloned.LastUsedAt = copyTimePointer(account.LastUsedAt)

	if account.Auth.ChatGPT != nil {
		chatGPT := *account.Auth.ChatGPT
		chatGPT.AccountID = copyStringPointer(account.Auth.ChatGPT.AccountID)
		cloned.Auth.ChatGPT = &chatGPT
	}

	if account.Auth.APIKey != nil {
		apiKey := *account.Auth.APIKey
		cloned.Auth.APIKey = &apiKey
	}

	return cloned
}

func copyStringPointer(value *string) *string {
	if value == nil {
		return nil
	}

	copyValue := *value
	return &copyValue
}

func copyTimePointer(value *time.Time) *time.Time {
	if value == nil {
		return nil
	}

	copyValue := *value
	return &copyValue
}

func formatTimePointer(value *time.Time) *string {
	if value == nil {
		return nil
	}

	formatted := value.Format(time.RFC3339Nano)
	return &formatted
}
