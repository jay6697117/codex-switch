import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";

import { SectionCard } from "../../components/SectionCard";
import type {
  AccountSummary,
  AppError,
  WarmupScheduleInput,
  WarmupScheduleStatus,
} from "../../lib/contracts";
import type { AppServices } from "../../lib/wails/services";

interface WarmupSectionProps {
  accounts: AccountSummary[];
  services: Pick<AppServices, "warmup">;
}

interface FormState {
  enabled: boolean;
  localTime: string;
  accountIds: string[];
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

function deriveInitialFormState(status?: WarmupScheduleStatus): FormState {
  return {
    enabled: status?.schedule?.enabled ?? true,
    localTime: status?.schedule?.localTime ?? "09:00",
    accountIds: status?.schedule?.accountIds ?? [],
  };
}

function formatNextRun(
  nextRunLocalIso: string | undefined,
  _locale: string,
): string {
  if (!nextRunLocalIso) {
    return "—";
  }

  const date = new Date(nextRunLocalIso);
  if (Number.isNaN(date.getTime())) {
    return "—";
  }

  const year = String(date.getFullYear());
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const hour = String(date.getHours()).padStart(2, "0");
  const minute = String(date.getMinutes()).padStart(2, "0");

  return `${year}-${month}-${day} ${hour}:${minute}`;
}

export function WarmupSection({ accounts, services }: WarmupSectionProps) {
  const { i18n, t } = useTranslation(["errors", "warmup"]);
  const [status, setStatus] = useState<WarmupScheduleStatus | null>(null);
  const [errorCode, setErrorCode] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formState, setFormState] = useState<FormState>(deriveInitialFormState());
  const [validationCode, setValidationCode] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    const hydrate = async () => {
      try {
        const nextStatus = await services.warmup.loadScheduleStatus();
        if (!active) {
          return;
        }

        setStatus(nextStatus);
        setFormState(deriveInitialFormState(nextStatus));
        setErrorCode(null);
      } catch (error) {
        if (!active) {
          return;
        }

        setErrorCode(getErrorCode(error, "warmup.schedule_load_failed"));
      }
    };

    void hydrate();

    return () => {
      active = false;
    };
  }, [services]);

  const accountOptions = useMemo(
    () =>
      accounts.map((account) => ({
        id: account.id,
        label: account.displayName,
      })),
    [accounts],
  );

  const selectedCount = status?.schedule?.accountIds.length ?? 0;
  const nextRunLabel = formatNextRun(status?.nextRunLocalIso, i18n.language);

  const openDialog = () => {
    setFormState(deriveInitialFormState(status ?? undefined));
    setValidationCode(null);
    setDialogOpen(true);
  };

  const closeDialog = () => {
    setDialogOpen(false);
    setValidationCode(null);
  };

  const toggleAccount = (accountId: string) => {
    setFormState((current) => {
      const isSelected = current.accountIds.includes(accountId);
      return {
        ...current,
        accountIds: isSelected
          ? current.accountIds.filter((id) => id !== accountId)
          : [...current.accountIds, accountId],
      };
    });
  };

  const saveSchedule = async () => {
    if (formState.accountIds.length === 0) {
      setValidationCode("warmup.schedule_accounts_required");
      return;
    }

    setSaving(true);
    setValidationCode(null);

    try {
      const input: WarmupScheduleInput = {
        enabled: formState.enabled,
        localTime: formState.localTime,
        accountIds: formState.accountIds,
      };
      const nextStatus = await services.warmup.saveSchedule(input);
      setStatus(nextStatus);
      setFormState(deriveInitialFormState(nextStatus));
      setErrorCode(null);
      setDialogOpen(false);
    } catch (error) {
      const code = getErrorCode(error, "warmup.schedule_load_failed");
      if (code === "warmup.schedule_accounts_required" || code === "warmup.schedule_time_invalid") {
        setValidationCode(code);
      } else {
        setErrorCode(code);
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <SectionCard title={t("warmup:scheduleTitle")}>
        <div className="warmup-section">
          <div aria-label={t("warmup:scheduleSummaryLabel")} className="warmup-summary-card">
            <div className="warmup-summary-item">
              <span className="warmup-summary-label">{t("warmup:summaryTime")}</span>
              <strong>{status?.schedule?.localTime ?? "—"}</strong>
            </div>
            <div className="warmup-summary-item">
              <span className="warmup-summary-label">{t("warmup:summaryAccounts")}</span>
              <strong>{selectedCount}</strong>
            </div>
            <div className="warmup-summary-item">
              <span className="warmup-summary-label">{t("warmup:summaryNextRun")}</span>
              <strong>{nextRunLabel}</strong>
            </div>
          </div>

          {errorCode ? <p className="accounts-error-banner">{t(`errors:${errorCode}`)}</p> : null}

          <div className="warmup-section-actions">
            <button className="secondary-button" onClick={openDialog} type="button">
              {t("warmup:configureAction")}
            </button>
          </div>
        </div>
      </SectionCard>

      {dialogOpen ? (
        <div className="dialog-backdrop" role="presentation">
          <div
            aria-labelledby="warmup-config-title"
            aria-modal="true"
            className="switch-dialog warmup-config-dialog"
            role="dialog"
          >
            <h3 id="warmup-config-title">{t("warmup:configureTitle")}</h3>

            <label className="warmup-form-row">
              <span>{t("warmup:enableLabel")}</span>
              <input
                checked={formState.enabled}
                onChange={(event) =>
                  setFormState((current) => ({ ...current, enabled: event.target.checked }))
                }
                type="checkbox"
              />
            </label>

            <label className="warmup-form-row">
              <span>{t("warmup:localTimeLabel")}</span>
              <input
                aria-label={t("warmup:localTimeLabel")}
                className="account-rename-input"
                onChange={(event) =>
                  setFormState((current) => ({ ...current, localTime: event.target.value }))
                }
                type="time"
                value={formState.localTime}
              />
            </label>

            <div className="warmup-form-row warmup-form-row-column">
              <div className="warmup-form-header">
                <span>{t("warmup:accountsLabel")}</span>
                <div className="warmup-inline-actions">
                  <button
                    className="secondary-button"
                    onClick={() =>
                      setFormState((current) => ({
                        ...current,
                        accountIds: accountOptions.map((account) => account.id),
                      }))
                    }
                    type="button"
                  >
                    {t("warmup:selectAllAction")}
                  </button>
                  <button
                    className="secondary-button"
                    onClick={() =>
                      setFormState((current) => ({
                        ...current,
                        accountIds: [],
                      }))
                    }
                    type="button"
                  >
                    {t("warmup:clearAllAction")}
                  </button>
                </div>
              </div>

              <div className="warmup-account-list">
                {accountOptions.map((account) => (
                  <label className="warmup-account-option" key={account.id}>
                    <input
                      checked={formState.accountIds.includes(account.id)}
                      name={account.label}
                      onChange={() => toggleAccount(account.id)}
                      type="checkbox"
                    />
                    <span>{account.label}</span>
                  </label>
                ))}
              </div>

              {validationCode ? (
                <p className="warmup-validation">{t(`errors:${validationCode}`)}</p>
              ) : null}
            </div>

            <div className="switch-dialog-actions">
              <button className="secondary-button" onClick={closeDialog} type="button">
                {t("warmup:cancelAction")}
              </button>
              <button
                className="primary-button"
                disabled={saving}
                onClick={() => {
                  void saveSchedule();
                }}
                type="button"
              >
                {saving ? t("warmup:savingAction") : t("warmup:saveAction")}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
