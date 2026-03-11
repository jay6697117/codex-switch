import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";

import { SectionCard } from "../../components/SectionCard";
import type {
  AccountSummary,
  AccountsSnapshot,
  AppError,
  ProcessStatus,
} from "../../lib/contracts";
import type { AppServices } from "../../lib/wails/services";
import { deriveAccountsView, toggleMaskedAccount } from "./model";

const DELETE_CONFIRM_TIMEOUT_MS = 3_000;
const MASKED_VALUE = "••••••••";

interface AccountSectionProps {
  services: Pick<AppServices, "accounts" | "process">;
}

interface AccountCardProps {
  account: AccountSummary;
  isActive: boolean;
  isMasked: boolean;
  isEditing: boolean;
  isDeletePending: boolean;
  isSwitching: boolean;
  renameDraft: string;
  onBeginRename: (account: AccountSummary) => void;
  onRenameDraftChange: (value: string) => void;
  onRenameCancel: () => void;
  onRenameSubmit: (accountId: string) => Promise<void>;
  onToggleMask: (accountId: string) => void;
  onDelete: (accountId: string) => void;
  onSwitch: (accountId: string) => void;
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

function getAuthKindLabel(authKind: string, t: (key: string) => string): string {
  if (authKind === "chatgpt") {
    return t("authKindChatgpt");
  }

  if (authKind === "apiKey") {
    return t("authKindApiKey");
  }

  return authKind;
}

function maskCopy(value?: string, masked = false): string | undefined {
  if (!value) {
    return undefined;
  }

  return masked ? MASKED_VALUE : value;
}

function getActionName(
  account: AccountSummary,
  masked: boolean,
  t: (key: string) => string,
): string {
  if (masked) {
    return t("maskedAccountLabel");
  }

  return account.displayName;
}

function getProcessCopy(
  status: ProcessStatus,
  t: (key: string, options?: Record<string, unknown>) => string,
) {
  const total = status.foregroundCount + status.backgroundCount;

  if (total === 0) {
    return {
      toneClass: "process-badge-safe",
      title: t("processReadyTitle"),
      body: t("processReadyBody"),
    };
  }

  return {
    toneClass: "process-badge-busy",
    title: t("processBusyTitle"),
    body: t("processBusyBody", {
      foreground: status.foregroundCount,
      background: status.backgroundCount,
    }),
  };
}

function SwitchConfirmationDialog({
  processStatus,
  onCancel,
  onConfirm,
  pending,
}: {
  processStatus: ProcessStatus;
  onCancel: () => void;
  onConfirm: () => void;
  pending: boolean;
}) {
  const { t } = useTranslation("accounts");

  return (
    <div className="dialog-backdrop" role="presentation">
      <div
        aria-labelledby="switch-confirm-title"
        aria-modal="true"
        className="switch-dialog"
        role="dialog"
      >
        <h3 id="switch-confirm-title">{t("switchConfirmTitle")}</h3>
        <p>{t("switchConfirmBody")}</p>
        <p className="switch-dialog-status">
          {t("processBusyBody", {
            foreground: processStatus.foregroundCount,
            background: processStatus.backgroundCount,
          })}
        </p>
        <div className="switch-dialog-actions">
          <button className="secondary-button" onClick={onCancel} type="button">
            {t("switchConfirmCancel")}
          </button>
          <button className="primary-button" disabled={pending} onClick={onConfirm} type="button">
            {pending ? t("switchingAction") : t("switchConfirmAction")}
          </button>
        </div>
      </div>
    </div>
  );
}

function AccountCard({
  account,
  isActive,
  isMasked,
  isEditing,
  isDeletePending,
  isSwitching,
  renameDraft,
  onBeginRename,
  onRenameDraftChange,
  onRenameCancel,
  onRenameSubmit,
  onToggleMask,
  onDelete,
  onSwitch,
}: AccountCardProps) {
  const { t } = useTranslation("accounts");
  const actionName = getActionName(account, isMasked, t);
  const title = maskCopy(account.displayName, isMasked) ?? MASKED_VALUE;
  const subtitle = maskCopy(account.email, isMasked);

  return (
    <article className={`account-card ${isActive ? "account-card-active" : ""}`}>
      <div className="account-card-header">
        <div className="account-card-title-block">
          <div className="account-badge-row">
            <span className="account-auth-badge">{getAuthKindLabel(account.authKind, t)}</span>
            {isActive ? <span className="account-active-badge">{t("activeBadge")}</span> : null}
          </div>

          {isEditing ? (
            <div className="account-rename-block">
              <label className="account-field-label" htmlFor={`rename-${account.id}`}>
                {t("renameLabel")}
              </label>
              <input
                aria-label={t("renameLabel")}
                autoFocus
                className="account-rename-input"
                id={`rename-${account.id}`}
                onBlur={() => {
                  void onRenameSubmit(account.id);
                }}
                onChange={(event) => onRenameDraftChange(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault();
                    void onRenameSubmit(account.id);
                  }

                  if (event.key === "Escape") {
                    event.preventDefault();
                    onRenameCancel();
                  }
                }}
                placeholder={t("renamePlaceholder")}
                type="text"
                value={renameDraft}
              />
              <p className="account-muted-copy">{t("renameHint")}</p>
            </div>
          ) : (
            <button
              aria-label={t("editAccount", { name: actionName })}
              className="account-title-button"
              onClick={() => onBeginRename(account)}
              type="button"
            >
              {title}
            </button>
          )}

          {subtitle ? <p className="account-subtitle">{subtitle}</p> : null}
        </div>
      </div>

      <div className="account-card-footer">
        <div className="account-visibility">
          <span>{isMasked ? t("visibilityHidden") : t("visibilityVisible")}</span>
        </div>

        <div className="account-card-actions">
          <button
            aria-label={
              isMasked
                ? t("showAccount", { name: actionName })
                : t("hideAccount", { name: actionName })
            }
            className="secondary-button"
            onClick={() => onToggleMask(account.id)}
            type="button"
          >
            {isMasked ? t("showAction") : t("hideAction")}
          </button>

          <button
            aria-label={
              isDeletePending
                ? t("confirmDeleteAccount", { name: actionName })
                : t("deleteAccount", { name: actionName })
            }
            className={isDeletePending ? "danger-button" : "secondary-button"}
            onClick={() => onDelete(account.id)}
            type="button"
          >
            {isDeletePending ? t("confirmDeleteAction") : t("deleteAction")}
          </button>

          {isActive ? null : (
            <button
              aria-label={t("switchAccount", { name: actionName })}
              className="primary-button"
              disabled={isSwitching}
              onClick={() => onSwitch(account.id)}
              type="button"
            >
              {isSwitching ? t("switchingAction") : t("switchAction")}
            </button>
          )}
        </div>
      </div>
    </article>
  );
}

export function AccountSection({ services }: AccountSectionProps) {
  const { t } = useTranslation(["accounts", "errors"]);
  const [snapshot, setSnapshot] = useState<AccountsSnapshot | null>(null);
  const [processStatus, setProcessStatus] = useState<ProcessStatus | null>(null);
  const [errorCode, setErrorCode] = useState<string | null>(null);
  const [allMasked, setAllMasked] = useState(false);
  const [maskedAccountIds, setMaskedAccountIds] = useState<Set<string>>(() => new Set());
  const [editingAccountId, setEditingAccountId] = useState<string | null>(null);
  const [renameDraft, setRenameDraft] = useState("");
  const [pendingDeleteAccountId, setPendingDeleteAccountId] = useState<string | null>(null);
  const [switchCandidateAccountId, setSwitchCandidateAccountId] = useState<string | null>(null);
  const [switchConfirmOpen, setSwitchConfirmOpen] = useState(false);
  const [switchingAccountId, setSwitchingAccountId] = useState<string | null>(null);
  const deleteTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    let active = true;

    const hydrate = async () => {
      try {
        const [nextSnapshot, nextProcessStatus] = await Promise.all([
          services.accounts.load(),
          services.process.getStatus(),
        ]);

        if (!active) {
          return;
        }

        setSnapshot(nextSnapshot);
        setProcessStatus(nextProcessStatus);
        setErrorCode(null);
      } catch (error) {
        if (!active) {
          return;
        }

        setErrorCode(getErrorCode(error, "account.load_failed"));
      }
    };

    void hydrate();

    return () => {
      active = false;

      if (deleteTimeoutRef.current) {
        clearTimeout(deleteTimeoutRef.current);
      }
    };
  }, [services]);

  const view = useMemo(
    () =>
      snapshot ? deriveAccountsView(snapshot, maskedAccountIds, allMasked) : null,
    [allMasked, maskedAccountIds, snapshot],
  );

  const refreshProcessStatus = async (): Promise<ProcessStatus | null> => {
    try {
      const nextStatus = await services.process.getStatus();
      setProcessStatus(nextStatus);
      return nextStatus;
    } catch (error) {
      setErrorCode(getErrorCode(error, "process.detect_failed"));
      return null;
    }
  };

  const clearDeleteTimeout = () => {
    if (!deleteTimeoutRef.current) {
      return;
    }

    clearTimeout(deleteTimeoutRef.current);
    deleteTimeoutRef.current = null;
  };

  const beginRename = (account: AccountSummary) => {
    setEditingAccountId(account.id);
    setRenameDraft(account.displayName);
    setErrorCode(null);
  };

  const cancelRename = () => {
    setEditingAccountId(null);
    setRenameDraft("");
  };

  const handleRenameSubmit = async (accountId: string) => {
    if (editingAccountId !== accountId) {
      return;
    }

    try {
      const nextSnapshot = await services.accounts.rename({
        id: accountId,
        displayName: renameDraft,
      });

      setSnapshot(nextSnapshot);
      setEditingAccountId(null);
      setRenameDraft("");
      setErrorCode(null);
      await refreshProcessStatus();
    } catch (error) {
      setErrorCode(getErrorCode(error, "account.rename_failed"));
    }
  };

  const handleDelete = async (accountId: string) => {
    if (pendingDeleteAccountId !== accountId) {
      clearDeleteTimeout();
      setPendingDeleteAccountId(accountId);
      deleteTimeoutRef.current = setTimeout(() => {
        setPendingDeleteAccountId((current) => (current === accountId ? null : current));
        deleteTimeoutRef.current = null;
      }, DELETE_CONFIRM_TIMEOUT_MS);
      return;
    }

    try {
      const nextSnapshot = await services.accounts.remove(accountId);
      clearDeleteTimeout();
      setPendingDeleteAccountId(null);
      setSnapshot(nextSnapshot);
      setErrorCode(null);
      await refreshProcessStatus();
    } catch (error) {
      setErrorCode(getErrorCode(error, "account.delete_failed"));
    }
  };

  const performSwitch = async (accountId: string, confirmRestart: boolean) => {
    setSwitchingAccountId(accountId);

    try {
      const result = await services.accounts.switch({
        accountId,
        confirmRestart,
      });

      setSnapshot(result.accounts);
      setSwitchCandidateAccountId(null);
      setSwitchConfirmOpen(false);
      setErrorCode(null);
      await refreshProcessStatus();
    } catch (error) {
      setErrorCode(getErrorCode(error, "switch.active_update_failed"));
    } finally {
      setSwitchingAccountId(null);
    }
  };

  const handleSwitch = async (accountId: string) => {
    const nextProcessStatus = await refreshProcessStatus();

    if (!nextProcessStatus) {
      return;
    }

    const total = nextProcessStatus.foregroundCount + nextProcessStatus.backgroundCount;

    if (total > 0) {
      setSwitchCandidateAccountId(accountId);
      setSwitchConfirmOpen(true);
      return;
    }

    await performSwitch(accountId, false);
  };

  if (!snapshot || !processStatus || !view) {
    return (
      <SectionCard title={t("accounts:title")}>
        <p>{t("accounts:loading")}</p>
      </SectionCard>
    );
  }

  const processCopy = getProcessCopy(processStatus, t);

  return (
    <SectionCard title={t("accounts:title")}>
      <div className="accounts-toolbar">
        <span>{t("accounts:count", { count: snapshot.accounts.length })}</span>
        <div className={`process-badge ${processCopy.toneClass}`}>
          <strong>{processCopy.title}</strong>
          <span>{processCopy.body}</span>
        </div>
        <button
          className="secondary-button"
          onClick={() => setAllMasked((current) => !current)}
          type="button"
        >
          {allMasked ? t("accounts:showAll") : t("accounts:hideAll")}
        </button>
      </div>

      {errorCode ? <p className="accounts-error-banner">{t(`errors:${errorCode}`)}</p> : null}

      {snapshot.accounts.length === 0 ? (
        <div className="accounts-empty-state">
          <strong>{t("accounts:emptyTitle")}</strong>
          <p>{t("accounts:emptyBody")}</p>
        </div>
      ) : (
        <div className="accounts-layout">
          {view.activeAccount ? (
            <div className="accounts-group">
              <div className="accounts-group-header">
                <h3>{t("accounts:activeTitle")}</h3>
              </div>
              <AccountCard
                account={view.activeAccount}
                isActive
                isDeletePending={pendingDeleteAccountId === view.activeAccount.id}
                isEditing={editingAccountId === view.activeAccount.id}
                isMasked={view.isMasked(view.activeAccount.id)}
                isSwitching={switchingAccountId === view.activeAccount.id}
                onBeginRename={beginRename}
                onDelete={handleDelete}
                onRenameCancel={cancelRename}
                onRenameDraftChange={setRenameDraft}
                onRenameSubmit={handleRenameSubmit}
                onSwitch={handleSwitch}
                onToggleMask={(accountId) =>
                  setMaskedAccountIds((current) => toggleMaskedAccount(current, accountId))
                }
                renameDraft={renameDraft}
              />
            </div>
          ) : null}

          <div className="accounts-group">
            <div className="accounts-group-header">
              <h3>{t("accounts:othersTitle")}</h3>
            </div>

            {view.otherAccounts.length > 0 ? (
              <div className="accounts-grid">
                {view.otherAccounts.map((account) => (
                  <AccountCard
                    key={account.id}
                    account={account}
                    isActive={false}
                    isDeletePending={pendingDeleteAccountId === account.id}
                    isEditing={editingAccountId === account.id}
                    isMasked={view.isMasked(account.id)}
                    isSwitching={switchingAccountId === account.id}
                    onBeginRename={beginRename}
                    onDelete={handleDelete}
                    onRenameCancel={cancelRename}
                    onRenameDraftChange={setRenameDraft}
                    onRenameSubmit={handleRenameSubmit}
                    onSwitch={handleSwitch}
                    onToggleMask={(accountId) =>
                      setMaskedAccountIds((current) => toggleMaskedAccount(current, accountId))
                    }
                    renameDraft={renameDraft}
                  />
                ))}
              </div>
            ) : (
              <p>{t("accounts:othersEmpty")}</p>
            )}
          </div>
        </div>
      )}

      {switchConfirmOpen && switchCandidateAccountId ? (
        <SwitchConfirmationDialog
          onCancel={() => {
            setSwitchCandidateAccountId(null);
            setSwitchConfirmOpen(false);
          }}
          onConfirm={() => {
            void performSwitch(switchCandidateAccountId, true);
          }}
          pending={switchingAccountId === switchCandidateAccountId}
          processStatus={processStatus}
        />
      ) : null}
    </SectionCard>
  );
}
