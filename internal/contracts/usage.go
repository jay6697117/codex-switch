package contracts

type UsageWindowSnapshot struct {
	UsedPercent   *int    `json:"usedPercent,omitempty"`
	WindowMinutes int     `json:"windowMinutes"`
	ResetsAt      *string `json:"resetsAt,omitempty"`
}

type AccountUsageSnapshot struct {
	AccountID   string               `json:"accountId"`
	PlanType    *string              `json:"planType,omitempty"`
	Status      string               `json:"status"`
	ReasonCode  *string              `json:"reasonCode,omitempty"`
	FiveHour    *UsageWindowSnapshot `json:"fiveHour,omitempty"`
	Weekly      *UsageWindowSnapshot `json:"weekly,omitempty"`
	RefreshedAt string               `json:"refreshedAt"`
}

type UsageCollection struct {
	Items []AccountUsageSnapshot `json:"items"`
}
