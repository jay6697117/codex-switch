import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

import { SectionCard } from "../../components/SectionCard";
import type {
  AppError,
  BackupImportSummary,
  BackupSecurityMode,
  LocalePreference,
  SettingsSnapshot,
} from "../../lib/contracts";
import type { AppServices } from "../../lib/wails/services";

interface SettingsSectionProps {
  services: Pick<AppServices, "settings" | "backup">;
  onSettingsSaved?: (snapshot: SettingsSnapshot) => void;
  onBackupImported?: (summary: BackupImportSummary) => void;
}

function getErrorCode(error: unknown, fallbackCode: string): string {
  if (
    error &&
    typeof error === "object" &&
    "code" in error &&
    typeof (error as AppError).code === "string"
  ) {
    return (error as AppError).code;
  }

  return fallbackCode;
}

export function SettingsSection({
  services,
  onBackupImported,
  onSettingsSaved,
}: SettingsSectionProps) {
  const { t } = useTranslation(["backup", "errors", "settings"]);
  const [snapshot, setSnapshot] = useState<SettingsSnapshot | null>(null);
  const [errorCode, setErrorCode] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [localePreference, setLocalePreference] = useState<LocalePreference>("system");
  const [backupSecurityMode, setBackupSecurityMode] =
    useState<BackupSecurityMode>("keychain");
  const [saving, setSaving] = useState(false);
  const [slimExportPayload, setSlimExportPayload] = useState<string | null>(null);
  const [slimImportOpen, setSlimImportOpen] = useState(false);
  const [slimImportPayload, setSlimImportPayload] = useState("");
  const [fullExportPath, setFullExportPath] = useState<string | null>(null);
  const [fullExportOpen, setFullExportOpen] = useState(false);
  const [fullExportPassphrase, setFullExportPassphrase] = useState("");
  const [fullExportPassphraseConfirm, setFullExportPassphraseConfirm] = useState("");
  const [fullImportPath, setFullImportPath] = useState<string | null>(null);
  const [fullImportOpen, setFullImportOpen] = useState(false);
  const [fullImportPassphrase, setFullImportPassphrase] = useState("");
  const [validationCode, setValidationCode] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    const hydrate = async () => {
      try {
        const nextSnapshot = await services.settings.load();
        if (!active) {
          return;
        }

        setSnapshot(nextSnapshot);
        setLocalePreference(nextSnapshot.localePreference);
        setBackupSecurityMode(nextSnapshot.backupSecurityMode);
        setErrorCode(null);
      } catch (error) {
        if (!active) {
          return;
        }

        setErrorCode(getErrorCode(error, "settings.save_failed"));
      }
    };

    void hydrate();

    return () => {
      active = false;
    };
  }, [services]);

  const resetExportDialog = () => {
    setFullExportOpen(false);
    setFullExportPath(null);
    setFullExportPassphrase("");
    setFullExportPassphraseConfirm("");
    setValidationCode(null);
  };

  const resetImportDialog = () => {
    setFullImportOpen(false);
    setFullImportPath(null);
    setFullImportPassphrase("");
    setValidationCode(null);
  };

  const saveSettings = async () => {
    setSaving(true);
    setValidationCode(null);

    try {
      const nextSnapshot = await services.settings.save({
        localePreference,
        backupSecurityMode,
      });
      setSnapshot(nextSnapshot);
      setLocalePreference(nextSnapshot.localePreference);
      setBackupSecurityMode(nextSnapshot.backupSecurityMode);
      setStatusMessage(t("settings:saveSuccess"));
      setErrorCode(null);
      onSettingsSaved?.(nextSnapshot);
    } catch (error) {
      setErrorCode(getErrorCode(error, "settings.save_failed"));
    } finally {
      setSaving(false);
    }
  };

  const exportSlimText = async () => {
    try {
      const payload = await services.backup.exportSlimText();
      setSlimExportPayload(payload);
      setStatusMessage(null);
      setErrorCode(null);
    } catch (error) {
      setErrorCode(getErrorCode(error, "backup.export_failed"));
    }
  };

  const importSlimText = async () => {
    try {
      const summary = await services.backup.importSlimText(slimImportPayload.trim());
      setSlimImportOpen(false);
      setSlimImportPayload("");
      setStatusMessage(
        t("backup:importSummary", {
          imported: summary.importedCount,
          total: summary.totalInPayload,
          skipped: summary.skippedCount,
        }),
      );
      setErrorCode(null);
      onBackupImported?.(summary);
    } catch (error) {
      setErrorCode(getErrorCode(error, "backup.import_failed"));
    }
  };

  const exportFullBackup = async (path: string, passphrase?: string) => {
    try {
      await services.backup.exportFull({ path, passphrase });
      setStatusMessage(t("backup:exportFullSuccess"));
      setErrorCode(null);
      resetExportDialog();
    } catch (error) {
      const code = getErrorCode(error, "backup.export_failed");
      if (
        code === "backup.passphrase_required" ||
        code === "backup.passphrase_mismatch"
      ) {
        setValidationCode(code);
      } else {
        setErrorCode(code);
      }
    }
  };

  const startFullExport = async () => {
    try {
      const selection = await services.backup.selectFullExportPath();
      if (!selection.selected || !selection.path) {
        return;
      }

      if (backupSecurityMode === "passphrase") {
        setFullExportPath(selection.path);
        setFullExportOpen(true);
        setValidationCode(null);
        return;
      }

      await exportFullBackup(selection.path);
    } catch (error) {
      setErrorCode(getErrorCode(error, "backup.export_failed"));
    }
  };

  const submitFullExport = async () => {
    if (!fullExportPath) {
      return;
    }

    if (fullExportPassphrase !== fullExportPassphraseConfirm) {
      setValidationCode("backup.passphrase_mismatch");
      return;
    }

    await exportFullBackup(fullExportPath, fullExportPassphrase);
  };

  const runFullImport = async (path: string, passphrase?: string) => {
    try {
      const summary = await services.backup.importFull({ path, passphrase });
      setStatusMessage(
        t("backup:importSummary", {
          imported: summary.importedCount,
          total: summary.totalInPayload,
          skipped: summary.skippedCount,
        }),
      );
      setErrorCode(null);
      resetImportDialog();
      onBackupImported?.(summary);
    } catch (error) {
      const code = getErrorCode(error, "backup.import_failed");
      if (code === "backup.passphrase_required") {
        setFullImportPath(path);
        setFullImportOpen(true);
        setValidationCode(code);
        return;
      }

      setErrorCode(code);
    }
  };

  const startFullImport = async () => {
    try {
      const selection = await services.backup.selectFullImportPath();
      if (!selection.selected || !selection.path) {
        return;
      }

      await runFullImport(selection.path);
    } catch (error) {
      setErrorCode(getErrorCode(error, "backup.import_failed"));
    }
  };

  const submitFullImport = async () => {
    if (!fullImportPath) {
      return;
    }

    await runFullImport(fullImportPath, fullImportPassphrase);
  };

  return (
    <>
      <SectionCard title={t("settings:title")}>
        <div className="settings-section">
          {statusMessage ? <p className="settings-status-banner">{statusMessage}</p> : null}
          {errorCode ? <p className="accounts-error-banner">{t(`errors:${errorCode}`)}</p> : null}

          <div className="settings-grid">
            <div className="settings-block">
              <h3>{t("settings:languageSectionTitle")}</h3>
              <label className="warmup-form-row" htmlFor="settings-language">
                <span>{t("settings:languageLabel")}</span>
                <select
                  aria-label={t("settings:languageLabel")}
                  id="settings-language"
                  onChange={(event) =>
                    setLocalePreference(event.target.value as LocalePreference)
                  }
                  value={localePreference}
                >
                  <option value="system">
                    {t("settings:languageOptions.system")}
                  </option>
                  <option value="zh-CN">{t("settings:languageOptions.zh-CN")}</option>
                  <option value="en-US">{t("settings:languageOptions.en-US")}</option>
                </select>
              </label>
            </div>

            <div className="settings-block">
              <h3>{t("settings:backupSectionTitle")}</h3>
              <label className="warmup-form-row" htmlFor="settings-backup-security">
                <span>{t("settings:backupSecurityLabel")}</span>
                <select
                  aria-label={t("settings:backupSecurityLabel")}
                  id="settings-backup-security"
                  onChange={(event) =>
                    setBackupSecurityMode(event.target.value as BackupSecurityMode)
                  }
                  value={backupSecurityMode}
                >
                  <option value="keychain">
                    {t("settings:backupSecurityOptions.keychain")}
                  </option>
                  <option value="passphrase">
                    {t("settings:backupSecurityOptions.passphrase")}
                  </option>
                </select>
              </label>

              <div className="settings-actions-grid">
                <button className="secondary-button" onClick={exportSlimText} type="button">
                  {t("backup:exportSlimAction")}
                </button>
                <button
                  className="secondary-button"
                  onClick={() => setSlimImportOpen(true)}
                  type="button"
                >
                  {t("backup:importSlimAction")}
                </button>
                <button className="secondary-button" onClick={startFullExport} type="button">
                  {t("backup:exportFullAction")}
                </button>
                <button className="secondary-button" onClick={startFullImport} type="button">
                  {t("backup:importFullAction")}
                </button>
              </div>
            </div>
          </div>

          <div className="settings-footer">
            <button
              className="primary-button"
              disabled={saving || snapshot === null}
              onClick={() => {
                void saveSettings();
              }}
              type="button"
            >
              {t("settings:saveAction")}
            </button>
          </div>
        </div>
      </SectionCard>

      {slimExportPayload !== null ? (
        <div className="dialog-backdrop" role="presentation">
          <div
            aria-labelledby="slim-export-title"
            aria-modal="true"
            className="switch-dialog warmup-config-dialog"
            role="dialog"
          >
            <h3 id="slim-export-title">{t("backup:slimExportTitle")}</h3>
            <textarea
              aria-label={t("backup:slimPayloadLabel")}
              className="settings-textarea"
              readOnly
              value={slimExportPayload}
            />
            <div className="switch-dialog-actions">
              <button
                className="secondary-button"
                onClick={() => setSlimExportPayload(null)}
                type="button"
              >
                {t("backup:closeAction")}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {slimImportOpen ? (
        <div className="dialog-backdrop" role="presentation">
          <div
            aria-labelledby="slim-import-title"
            aria-modal="true"
            className="switch-dialog warmup-config-dialog"
            role="dialog"
          >
            <h3 id="slim-import-title">{t("backup:slimImportTitle")}</h3>
            <label className="warmup-form-row">
              <span>{t("backup:slimPayloadLabel")}</span>
              <textarea
                aria-label={t("backup:slimPayloadLabel")}
                className="settings-textarea"
                onChange={(event) => setSlimImportPayload(event.target.value)}
                value={slimImportPayload}
              />
            </label>
            <div className="switch-dialog-actions">
              <button
                className="secondary-button"
                onClick={() => {
                  setSlimImportOpen(false);
                  setSlimImportPayload("");
                }}
                type="button"
              >
                {t("backup:closeAction")}
              </button>
              <button
                className="primary-button"
                onClick={() => {
                  void importSlimText();
                }}
                type="button"
              >
                {t("backup:importAction")}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {fullExportOpen ? (
        <div className="dialog-backdrop" role="presentation">
          <div
            aria-labelledby="full-export-title"
            aria-modal="true"
            className="switch-dialog warmup-config-dialog"
            role="dialog"
          >
            <h3 id="full-export-title">{t("backup:fullExportTitle")}</h3>
            <label className="warmup-form-row">
              <span>{t("backup:passphraseLabel")}</span>
              <input
                aria-label={t("backup:passphraseLabel")}
                onChange={(event) => setFullExportPassphrase(event.target.value)}
                type="password"
                value={fullExportPassphrase}
              />
            </label>
            <label className="warmup-form-row">
              <span>{t("backup:confirmPassphraseLabel")}</span>
              <input
                aria-label={t("backup:confirmPassphraseLabel")}
                onChange={(event) => setFullExportPassphraseConfirm(event.target.value)}
                type="password"
                value={fullExportPassphraseConfirm}
              />
            </label>
            {validationCode ? (
              <p className="accounts-error-banner">{t(`errors:${validationCode}`)}</p>
            ) : null}
            <div className="switch-dialog-actions">
              <button className="secondary-button" onClick={resetExportDialog} type="button">
                {t("backup:closeAction")}
              </button>
              <button
                className="primary-button"
                onClick={() => {
                  void submitFullExport();
                }}
                type="button"
              >
                {t("backup:confirmExportAction")}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {fullImportOpen ? (
        <div className="dialog-backdrop" role="presentation">
          <div
            aria-labelledby="full-import-title"
            aria-modal="true"
            className="switch-dialog warmup-config-dialog"
            role="dialog"
          >
            <h3 id="full-import-title">{t("backup:fullImportTitle")}</h3>
            <label className="warmup-form-row">
              <span>{t("backup:passphraseLabel")}</span>
              <input
                aria-label={t("backup:passphraseLabel")}
                onChange={(event) => setFullImportPassphrase(event.target.value)}
                type="password"
                value={fullImportPassphrase}
              />
            </label>
            {validationCode ? (
              <p className="accounts-error-banner">{t(`errors:${validationCode}`)}</p>
            ) : null}
            <div className="switch-dialog-actions">
              <button className="secondary-button" onClick={resetImportDialog} type="button">
                {t("backup:closeAction")}
              </button>
              <button
                className="primary-button"
                onClick={() => {
                  void submitFullImport();
                }}
                type="button"
              >
                {t("backup:confirmImportAction")}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
