package contracts

type RenameAccountInput struct {
	ID          string `json:"id"`
	DisplayName string `json:"displayName"`
}

type AccountSummary struct {
	ID          string  `json:"id"`
	DisplayName string  `json:"displayName"`
	Email       string  `json:"email,omitempty"`
	AuthKind    string  `json:"authKind"`
	CreatedAt   string  `json:"createdAt"`
	UpdatedAt   string  `json:"updatedAt"`
	LastUsedAt  *string `json:"lastUsedAt,omitempty"`
}

type AccountsSnapshot struct {
	ActiveAccountID *string          `json:"activeAccountId"`
	Accounts        []AccountSummary `json:"accounts"`
}
