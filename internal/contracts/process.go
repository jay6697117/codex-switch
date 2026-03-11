package contracts

type ProcessStatus struct {
	ForegroundCount int  `json:"foregroundCount"`
	BackgroundCount int  `json:"backgroundCount"`
	CanSwitch       bool `json:"canSwitch"`
}

type SwitchAccountInput struct {
	AccountID      string `json:"accountId"`
	ConfirmRestart bool   `json:"confirmRestart"`
}

type SwitchAccountResult struct {
	Accounts         AccountsSnapshot `json:"accounts"`
	RestartPerformed bool             `json:"restartPerformed"`
}
