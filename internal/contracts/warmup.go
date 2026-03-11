package contracts

type WarmupAvailability struct {
	IsAvailable bool    `json:"isAvailable"`
	ReasonCode  *string `json:"reasonCode,omitempty"`
}

type WarmupAccountResult struct {
	AccountID    string             `json:"accountId"`
	Availability WarmupAvailability `json:"availability"`
	Status       string             `json:"status"`
	FailureCode  *string            `json:"failureCode,omitempty"`
	CompletedAt  string             `json:"completedAt"`
}

type WarmupSummary struct {
	TotalAccounts      int `json:"totalAccounts"`
	EligibleAccounts   int `json:"eligibleAccounts"`
	SuccessfulAccounts int `json:"successfulAccounts"`
	FailedAccounts     int `json:"failedAccounts"`
	SkippedAccounts    int `json:"skippedAccounts"`
}

type WarmupAllResult struct {
	Items   []WarmupAccountResult `json:"items"`
	Summary WarmupSummary         `json:"summary"`
}
