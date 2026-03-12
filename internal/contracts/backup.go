package contracts

type BackupImportSummary struct {
	TotalInPayload int `json:"totalInPayload"`
	ImportedCount  int `json:"importedCount"`
	SkippedCount   int `json:"skippedCount"`
}

type PathSelectionResult struct {
	Selected bool    `json:"selected"`
	Path     *string `json:"path,omitempty"`
}

type ExportFullBackupInput struct {
	Path       string  `json:"path"`
	Passphrase *string `json:"passphrase,omitempty"`
}

type ImportFullBackupInput struct {
	Path       string  `json:"path"`
	Passphrase *string `json:"passphrase,omitempty"`
}
