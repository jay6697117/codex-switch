package contracts

type BackupSecurityMode string

const (
	BackupSecurityModeKeychain   BackupSecurityMode = "keychain"
	BackupSecurityModePassphrase BackupSecurityMode = "passphrase"
)

type LocalePreference string

const (
	LocalePreferenceSystem LocalePreference = "system"
	LocalePreferenceZhCN   LocalePreference = "zh-CN"
	LocalePreferenceEnUS   LocalePreference = "en-US"
)

type SettingsSnapshot struct {
	LocalePreference   LocalePreference   `json:"localePreference"`
	EffectiveLocale    LocaleCode         `json:"effectiveLocale"`
	BackupSecurityMode BackupSecurityMode `json:"backupSecurityMode"`
}

type SaveSettingsInput struct {
	LocalePreference   LocalePreference   `json:"localePreference"`
	BackupSecurityMode BackupSecurityMode `json:"backupSecurityMode"`
}
