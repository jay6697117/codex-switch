package main

import (
	"context"
	"path/filepath"
	"testing"

	"codex-switch/internal/contracts"
	"codex-switch/internal/settings"
)

type staticLocaleDetector struct {
	locale string
}

func (d staticLocaleDetector) DetectLocale(context.Context) (string, error) {
	return d.locale, nil
}

func TestActiveAccountMessageArgs(t *testing.T) {
	t.Parallel()

	activeAccountID := "acc-1"
	args := activeAccountMessageArgs(contracts.AccountsSnapshot{
		ActiveAccountID: &activeAccountID,
		Accounts: []contracts.AccountSummary{
			{
				ID:          "acc-1",
				DisplayName: "Work Account",
			},
			{
				ID:          "acc-2",
				DisplayName: "Side Project",
			},
		},
	})

	if args["name"] != "Work Account" {
		t.Fatalf("expected active account name to be preserved, got %q", args["name"])
	}
}

func TestFullBackupDialogCopyUsesEffectiveLocale(t *testing.T) {
	t.Parallel()

	store := settings.NewStore(filepath.Join(t.TempDir(), "preferences.json"))
	service := settings.NewPreferencesService(store, staticLocaleDetector{locale: "en-US"})
	ctx := context.Background()

	_, err := service.Save(ctx, contracts.SaveSettingsInput{
		LocalePreference:   contracts.LocalePreferenceZhCN,
		BackupSecurityMode: contracts.BackupSecurityModeKeychain,
	})
	if err != nil {
		t.Fatalf("save preferences: %v", err)
	}

	app := &App{
		preferencesService: service,
	}

	copy := app.fullBackupDialogCopy(ctx)
	if copy.ExportTitle != "导出完整加密备份" {
		t.Fatalf("expected zh-CN export title, got %q", copy.ExportTitle)
	}
	if copy.ImportTitle != "导入完整加密备份" {
		t.Fatalf("expected zh-CN import title, got %q", copy.ImportTitle)
	}
	if copy.FilterLabel != "Codex Switch 完整备份 (*.cswf)" {
		t.Fatalf("expected zh-CN filter label, got %q", copy.FilterLabel)
	}
}

func TestFullBackupDialogCopyFallsBackToEnglish(t *testing.T) {
	t.Parallel()

	app := &App{}
	copy := app.fullBackupDialogCopy(context.Background())

	if copy.ExportTitle != "Export Full Encrypted Backup" {
		t.Fatalf("expected english export title, got %q", copy.ExportTitle)
	}
	if copy.ImportTitle != "Import Full Encrypted Backup" {
		t.Fatalf("expected english import title, got %q", copy.ImportTitle)
	}
	if copy.FilterLabel != "Codex Switch Full Backup (*.cswf)" {
		t.Fatalf("expected english filter label, got %q", copy.FilterLabel)
	}
}
