import { act, render, screen, waitFor, within } from "@testing-library/react";
import { I18nextProvider } from "react-i18next";
import userEvent from "@testing-library/user-event";
import { describe, expect, test, vi } from "vitest";

import { createAppI18n } from "../../i18n/createAppI18n";
import type {
  BackupImportSummary,
  SettingsSnapshot,
} from "../../lib/contracts";
import type { AppServices } from "../../lib/wails/services";
import { SettingsSection } from "./SettingsSection";

const baseSettings: SettingsSnapshot = {
  localePreference: "system",
  effectiveLocale: "en-US",
  backupSecurityMode: "keychain",
};

function buildSettingsServices(options?: {
  settingsSnapshot?: SettingsSnapshot;
  slimPayload?: string;
  slimImportSummary?: BackupImportSummary;
  fullImportSummary?: BackupImportSummary;
}) {
  const settingsSnapshot = options?.settingsSnapshot ?? baseSettings;
  const slimImportSummary = options?.slimImportSummary ?? {
    totalInPayload: 3,
    importedCount: 2,
    skippedCount: 1,
  };
  const fullImportSummary = options?.fullImportSummary ?? {
    totalInPayload: 2,
    importedCount: 2,
    skippedCount: 0,
  };

  const importFull = vi
    .fn()
    .mockRejectedValueOnce({ code: "backup.passphrase_required" })
    .mockResolvedValue(fullImportSummary);

  return {
    settings: {
      load: vi.fn().mockResolvedValue(settingsSnapshot),
      save: vi.fn(async (input) => ({
        localePreference: input.localePreference,
        effectiveLocale:
          input.localePreference === "system" ? "en-US" : input.localePreference,
        backupSecurityMode: input.backupSecurityMode,
      })),
    },
    backup: {
      exportSlimText: vi.fn().mockResolvedValue(options?.slimPayload ?? "css1.payload"),
      importSlimText: vi.fn().mockResolvedValue(slimImportSummary),
      selectFullExportPath: vi.fn().mockResolvedValue({
        selected: true,
        path: "/tmp/export.cswf",
      }),
      exportFull: vi.fn().mockResolvedValue(true),
      selectFullImportPath: vi.fn().mockResolvedValue({
        selected: true,
        path: "/tmp/import.cswf",
      }),
      importFull,
    },
  } satisfies Pick<AppServices, "settings" | "backup">;
}

async function renderSettingsSection(
  services: Pick<AppServices, "settings" | "backup"> = buildSettingsServices(),
  callbacks?: {
    onBackupImported?: (summary: BackupImportSummary) => void;
    onSettingsSaved?: (snapshot: SettingsSnapshot) => void;
  },
) {
  const i18n = await createAppI18n("en-US");

  await act(async () => {
    render(
      <I18nextProvider i18n={i18n}>
        <SettingsSection
          onBackupImported={callbacks?.onBackupImported}
          onSettingsSaved={callbacks?.onSettingsSaved}
          services={services}
        />
      </I18nextProvider>,
    );
  });

  return {
    i18n,
    services,
    user: userEvent.setup(),
  };
}

describe("SettingsSection", () => {
  test("renders locale and backup security settings from the typed facade and saves changes", async () => {
    const services = buildSettingsServices();
    const onSettingsSaved = vi.fn();
    const { user } = await renderSettingsSection(services, { onSettingsSaved });

    expect(await screen.findByText("Settings")).toBeInTheDocument();
    expect(screen.getByLabelText("Language")).toHaveValue("system");
    expect(screen.getByLabelText("Backup security")).toHaveValue("keychain");

    await user.selectOptions(screen.getByLabelText("Language"), "zh-CN");
    await user.selectOptions(screen.getByLabelText("Backup security"), "passphrase");
    await user.click(screen.getByRole("button", { name: "Save preferences" }));

    expect(services.settings.save).toHaveBeenCalledWith({
      localePreference: "zh-CN",
      backupSecurityMode: "passphrase",
    });
    await waitFor(() => {
      expect(onSettingsSaved).toHaveBeenCalledWith({
        localePreference: "zh-CN",
        effectiveLocale: "zh-CN",
        backupSecurityMode: "passphrase",
      });
    });
  });

  test("exports and imports slim backup text only through the typed facade", async () => {
    const services = buildSettingsServices();
    const onBackupImported = vi.fn();
    const { user } = await renderSettingsSection(services, { onBackupImported });

    await user.click(await screen.findByRole("button", { name: "Export slim text" }));
    expect(services.backup.exportSlimText).toHaveBeenCalledTimes(1);
    expect(await screen.findByRole("dialog", { name: "Slim backup text" })).toBeInTheDocument();
    expect(screen.getByDisplayValue("css1.payload")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Close" }));
    await user.click(screen.getByRole("button", { name: "Import slim text" }));
    const importDialog = await screen.findByRole("dialog", { name: "Import slim text" });
    await user.type(within(importDialog).getByLabelText("Slim backup payload"), "css1.import");
    await user.click(
      within(importDialog).getByRole("button", { name: "Import slim text" }),
    );

    expect(services.backup.importSlimText).toHaveBeenCalledWith("css1.import");
    await waitFor(() => {
      expect(onBackupImported).toHaveBeenCalledWith({
        totalInPayload: 3,
        importedCount: 2,
        skippedCount: 1,
      });
    });
    expect(await screen.findByText("Imported 2 of 3 accounts. Skipped 1.")).toBeInTheDocument();
  });

  test("blocks full export when passphrase confirmation does not match", async () => {
    const services = buildSettingsServices({
      settingsSnapshot: {
        localePreference: "system",
        effectiveLocale: "en-US",
        backupSecurityMode: "passphrase",
      },
    });
    const { user } = await renderSettingsSection(services);

    await user.click(await screen.findByRole("button", { name: "Export full backup" }));

    const dialog = await screen.findByRole("dialog", { name: "Export full backup" });
    await user.type(within(dialog).getByLabelText("Passphrase"), "secret-one");
    await user.type(within(dialog).getByLabelText("Confirm passphrase"), "secret-two");
    await user.click(within(dialog).getByRole("button", { name: "Export full backup" }));

    expect(services.backup.exportFull).not.toHaveBeenCalled();
    expect(await screen.findByText("Passphrases do not match.")).toBeInTheDocument();
  });

  test("retries full import with the same path after passphrase is required", async () => {
    const services = buildSettingsServices();
    const onBackupImported = vi.fn();
    const { user } = await renderSettingsSection(services, { onBackupImported });

    await user.click(await screen.findByRole("button", { name: "Import full backup" }));

    expect(services.backup.selectFullImportPath).toHaveBeenCalledTimes(1);
    expect(services.backup.importFull).toHaveBeenNthCalledWith(1, {
      path: "/tmp/import.cswf",
    });

    const dialog = await screen.findByRole("dialog", { name: "Import full backup" });
    await user.type(within(dialog).getByLabelText("Passphrase"), "secret-value");
    await user.click(within(dialog).getByRole("button", { name: "Import full backup" }));

    expect(services.backup.importFull).toHaveBeenNthCalledWith(2, {
      path: "/tmp/import.cswf",
      passphrase: "secret-value",
    });
    await waitFor(() => {
      expect(onBackupImported).toHaveBeenCalledWith({
        totalInPayload: 2,
        importedCount: 2,
        skippedCount: 0,
      });
    });
  });
});
