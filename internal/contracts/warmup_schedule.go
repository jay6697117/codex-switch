package contracts

type WarmupSchedule struct {
	Enabled                   bool     `json:"enabled"`
	LocalTime                 string   `json:"localTime"`
	AccountIDs                []string `json:"accountIds"`
	LastRunLocalDate          *string  `json:"lastRunLocalDate,omitempty"`
	LastMissedPromptLocalDate *string  `json:"lastMissedPromptLocalDate,omitempty"`
}

type WarmupScheduleInput struct {
	Enabled    bool     `json:"enabled"`
	LocalTime  string   `json:"localTime"`
	AccountIDs []string `json:"accountIds"`
}

type WarmupScheduleStatus struct {
	Schedule        *WarmupSchedule `json:"schedule,omitempty"`
	ValidAccountIDs []string        `json:"validAccountIds"`
	MissedRunToday  bool            `json:"missedRunToday"`
	NextRunLocalISO *string         `json:"nextRunLocalIso,omitempty"`
}
