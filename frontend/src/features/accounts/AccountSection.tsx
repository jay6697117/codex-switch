import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";

import { SectionCard } from "../../components/SectionCard";
import { AddAccountModal, type OAuthPhase } from "../auth/AddAccountModal";
import { openBrowserUrl } from "../auth/browser";
import { UsageSummary } from "../usage/UsageSummary";
import type {
  AccountSummary,
  AccountUsageSnapshot,
  AccountsSnapshot,
  AppError,
  ProcessStatus,
  UsageCollection,
  WarmupAccountResult,
  WarmupAllResult,
} from "../../lib/contracts";
import type { AppServices } from "../../lib/wails/services";
import { deriveAccountsView, toggleMaskedAccount } from "./model";

const DELETE_CONFIRM_TIMEOUT_MS = 3_000;
const MASKED_VALUE = "••••••••";

interface AccountSectionProps {
  services: Pick<AppServices, "accounts" | "oauth" | "process" | "usage" | "warmup">;
  onSnapshotChange?: (snapshot: AccountsSnapshot) => void;
}

interface WarmupFeedback {
  message: string;
  tone: "success" | "error" | "info";
}

interface AccountCardProps {
  account: AccountSummary;
  isActive: boolean;
  isMasked: boolean;
  isEditing: boolean;
  isDeletePending: boolean;
  isSwitching: boolean;
  isUsageLoading: boolean;
  isWarmupPending: boolean;
  renameDraft: string;
  latestWarmup?: WarmupAccountResult;
  usage?: AccountUsageSnapshot;
  onBeginRename: (account: AccountSummary) => void;
  onDelete: (accountId: string) => void;
  onRefreshUsage: (accountId: string) => void;
  onRenameCancel: () => void;
  onRenameDraftChange: (value: string) => void;
  onRenameSubmit: (accountId: string) => Promise<void>;
  onSwitch: (accountId: string) => void;
  onToggleMask: (accountId: string) => void;
  onWarmup: (accountId: string) => void;
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

function mapUsageCollection(
  collection: UsageCollection,
  snapshot: AccountsSnapshot,
): Record<string, AccountUsageSnapshot> {
  const accountIds = new Set(snapshot.accounts.map((account) => account.id));
  const nextUsageByAccountId: Record<string, AccountUsageSnapshot> = {};

  for (const item of collection.items) {
    if (accountIds.has(item.accountId)) {
      nextUsageByAccountId[item.accountId] = item;
    }
  }

  return nextUsageByAccountId;
}

function pruneUsageMap(
  usageByAccountId: Record<string, AccountUsageSnapshot>,
  snapshot: AccountsSnapshot,
): Record<string, AccountUsageSnapshot> {
  const accountIds = new Set(snapshot.accounts.map((account) => account.id));

  return Object.fromEntries(
    Object.entries(usageByAccountId).filter(([accountId]) => accountIds.has(accountId)),
  );
}

function pruneMaskedAccounts(
  maskedAccountIds: Set<string>,
  snapshot: AccountsSnapshot,
): Set<string> {
  const accountIds = new Set(snapshot.accounts.map((account) => account.id));

  return new Set([...maskedAccountIds].filter((accountId) => accountIds.has(accountId)));
}

function getWarmupInfoCopy(
  result: WarmupAccountResult | undefined,
  unavailableReasonCode: string | undefined,
  t: (key: string, options?: Record<string, unknown>) => string,
): WarmupFeedback | null {
  if (result?.status === "success") {
    return {
      message: t("warmup:latestSuccessBody"),
      tone: "success",
    };
  }

  if (result?.status === "failed") {
    return {
      message: t(`errors:${result.failureCode ?? "warmup.request_failed"}`),
      tone: "error",
    };
  }

  const reasonCode = result?.availability.reasonCode ?? unavailableReasonCode;
  if (!reasonCode) {
    return null;
  }

  return {
    message: t(`errors:${reasonCode}`),
    tone: "info",
  };
}

function getSingleWarmupFeedback(
  result: WarmupAccountResult,
  accountName: string,
  t: (key: string, options?: Record<string, unknown>) => string,
): WarmupFeedback {
  if (result.status === "success") {
    return {
      message: t("warmup:feedbackSuccessSingle", { name: accountName }),
      tone: "success",
    };
  }

  if (result.status === "failed") {
    return {
      message: t("warmup:feedbackFailedSingle", { name: accountName }),
      tone: "error",
    };
  }

  return {
    message: t("warmup:feedbackSkippedSingle", { name: accountName }),
    tone: "info",
  };
}

function getAllWarmupFeedback(
  result: WarmupAllResult,
  t: (key: string, options?: Record<string, unknown>) => string,
): WarmupFeedback {
  if (result.summary.eligibleAccounts === 0) {
    return {
      message: t("warmup:runAllUnavailable"),
      tone: "info",
    };
  }

  if (result.summary.failedAccounts === 0 && result.summary.skippedAccounts === 0) {
    return {
      message: t("warmup:feedbackSuccessAll", {
        successful: result.summary.successfulAccounts,
      }),
      tone: "success",
    };
  }

  return {
    message: t("warmup:feedbackMixedAll", {
      successful: result.summary.successfulAccounts,
      eligible: result.summary.eligibleAccounts,
      failed: result.summary.failedAccounts,
      skipped: result.summary.skippedAccounts,
    }),
    tone: result.summary.successfulAccounts > 0 ? "info" : "error",
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
  isUsageLoading,
  isWarmupPending,
  renameDraft,
  latestWarmup,
  usage,
  onBeginRename,
  onDelete,
  onRefreshUsage,
  onRenameCancel,
  onRenameDraftChange,
  onRenameSubmit,
  onSwitch,
  onToggleMask,
  onWarmup,
}: AccountCardProps) {
  const { t } = useTranslation(["accounts", "errors", "usage", "warmup"]);
  const actionName = getActionName(account, isMasked, t);
  const title = maskCopy(account.displayName, isMasked) ?? MASKED_VALUE;
  const subtitle = maskCopy(account.email, isMasked);
  const warmupInfo = getWarmupInfoCopy(
    latestWarmup,
    account.warmupAvailability.reasonCode,
    t,
  );

  return (
    <article className={`account-card ${isActive ? "account-card-active" : ""}`}>
      <div className="account-card-header">
        <div className="account-card-title-block">
          <div className="account-badge-row">
            <span className="account-auth-badge">{getAuthKindLabel(account.authKind, t)}</span>
            {isActive ? <span className="account-active-badge">{t("accounts:activeBadge")}</span> : null}
          </div>

          {isEditing ? (
            <div className="account-rename-block">
              <label className="account-field-label" htmlFor={`rename-${account.id}`}>
                {t("accounts:renameLabel")}
              </label>
              <input
                aria-label={t("accounts:renameLabel")}
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
                placeholder={t("accounts:renamePlaceholder")}
                type="text"
                value={renameDraft}
              />
              <p className="account-muted-copy">{t("accounts:renameHint")}</p>
            </div>
          ) : (
            <button
              aria-label={t("accounts:editAccount", { name: actionName })}
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

      <UsageSummary loading={isUsageLoading} usage={usage} />

      {warmupInfo ? (
        <div className={`warmup-result-panel warmup-result-${warmupInfo.tone}`}>
          <strong>
            {latestWarmup
              ? latestWarmup.status === "success"
                ? t("warmup:latestSuccessTitle")
                : latestWarmup.status === "failed"
                  ? t("warmup:latestFailedTitle")
                  : t("warmup:unavailableTitle")
              : t("warmup:unavailableTitle")}
          </strong>
          <p>{warmupInfo.message}</p>
        </div>
      ) : null}

      <div className="account-card-footer">
        <div className="account-visibility">
          <span>{isMasked ? t("accounts:visibilityHidden") : t("accounts:visibilityVisible")}</span>
        </div>

        <div className="account-card-actions">
          <button
            aria-label={t("usage:refreshUsageAccount", { name: actionName })}
            className="secondary-button"
            disabled={isUsageLoading}
            onClick={() => onRefreshUsage(account.id)}
            type="button"
          >
            {t("usage:refreshAction")}
          </button>

          <button
            aria-label={t("warmup:runAccount", { name: actionName })}
            className="secondary-button"
            disabled={isWarmupPending || !account.warmupAvailability.isAvailable}
            onClick={() => onWarmup(account.id)}
            title={
              account.warmupAvailability.isAvailable
                ? undefined
                : t(`errors:${account.warmupAvailability.reasonCode ?? "warmup.load_failed"}`)
            }
            type="button"
          >
            {isWarmupPending ? t("warmup:runningAction") : t("warmup:runAction")}
          </button>

          <button
            aria-label={
              isMasked
                ? t("accounts:showAccount", { name: actionName })
                : t("accounts:hideAccount", { name: actionName })
            }
            className="secondary-button"
            onClick={() => onToggleMask(account.id)}
            type="button"
          >
            {isMasked ? t("accounts:showAction") : t("accounts:hideAction")}
          </button>

          <button
            aria-label={
              isDeletePending
                ? t("accounts:confirmDeleteAccount", { name: actionName })
                : t("accounts:deleteAccount", { name: actionName })
            }
            className={isDeletePending ? "danger-button" : "secondary-button"}
            onClick={() => onDelete(account.id)}
            type="button"
          >
            {isDeletePending ? t("accounts:confirmDeleteAction") : t("accounts:deleteAction")}
          </button>

          {isActive ? null : (
            <button
              aria-label={t("accounts:switchAccount", { name: actionName })}
              className="primary-button"
              disabled={isSwitching}
              onClick={() => onSwitch(account.id)}
              type="button"
            >
              {isSwitching ? t("accounts:switchingAction") : t("accounts:switchAction")}
            </button>
          )}
        </div>
      </div>
    </article>
  );
}

export function AccountSection({ services, onSnapshotChange }: AccountSectionProps) {
  const { t } = useTranslation(["accounts", "auth", "errors", "usage", "warmup"]);
  const [snapshot, setSnapshot] = useState<AccountsSnapshot | null>(null);
  const [processStatus, setProcessStatus] = useState<ProcessStatus | null>(null);
  const [usageByAccountId, setUsageByAccountId] = useState<Record<string, AccountUsageSnapshot>>(
    {},
  );
  const [latestWarmupByAccountId, setLatestWarmupByAccountId] = useState<
    Record<string, WarmupAccountResult>
  >({});
  const [errorCode, setErrorCode] = useState<string | null>(null);
  const [warmupFeedback, setWarmupFeedback] = useState<WarmupFeedback | null>(null);
  const [allMasked, setAllMasked] = useState(false);
  const [maskedAccountIds, setMaskedAccountIds] = useState<Set<string>>(() => new Set());
  const [editingAccountId, setEditingAccountId] = useState<string | null>(null);
  const [renameDraft, setRenameDraft] = useState("");
  const [pendingDeleteAccountId, setPendingDeleteAccountId] = useState<string | null>(null);
  const [switchCandidateAccountId, setSwitchCandidateAccountId] = useState<string | null>(null);
  const [switchConfirmOpen, setSwitchConfirmOpen] = useState(false);
  const [switchingAccountId, setSwitchingAccountId] = useState<string | null>(null);
  const [warmupPendingAccountIds, setWarmupPendingAccountIds] = useState<Set<string>>(
    () => new Set(),
  );
  const [warmupAllPending, setWarmupAllPending] = useState(false);
  const [usageLoadingAccountIds, setUsageLoadingAccountIds] = useState<Set<string>>(
    () => new Set(),
  );
  const [refreshAllUsagePending, setRefreshAllUsagePending] = useState(false);
  const [addAccountOpen, setAddAccountOpen] = useState(false);
  const [oauthPhase, setOAuthPhase] = useState<OAuthPhase>("idle");
  const [oauthAuthUrl, setOAuthAuthUrl] = useState<string | null>(null);
  const deleteTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const applySnapshot = (nextSnapshot: AccountsSnapshot) => {
    setSnapshot(nextSnapshot);
    onSnapshotChange?.(nextSnapshot);
    setUsageByAccountId((current) => pruneUsageMap(current, nextSnapshot));
    setMaskedAccountIds((current) => pruneMaskedAccounts(current, nextSnapshot));
    setLatestWarmupByAccountId((current) =>
      Object.fromEntries(
        Object.entries(current).filter(([accountId]) =>
          nextSnapshot.accounts.some((account) => account.id === accountId),
        ),
      ),
    );
  };

  const resetOAuthState = () => {
    setAddAccountOpen(false);
    setOAuthPhase("idle");
    setOAuthAuthUrl(null);
  };

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

  const refreshAllUsage = async (targetSnapshot: AccountsSnapshot) => {
    if (targetSnapshot.accounts.length === 0) {
      setUsageByAccountId({});
      return;
    }

    setRefreshAllUsagePending(true);

    try {
      const collection = await services.usage.refreshAll();
      setUsageByAccountId(mapUsageCollection(collection, targetSnapshot));
      setErrorCode(null);
    } catch (error) {
      setErrorCode(getErrorCode(error, "usage.load_failed"));
    } finally {
      setRefreshAllUsagePending(false);
    }
  };

  const refreshUsageForAccount = async (
    accountId: string,
    targetSnapshot?: AccountsSnapshot | null,
  ) => {
    const nextSnapshot = targetSnapshot ?? snapshot;

    if (!nextSnapshot || !nextSnapshot.accounts.some((account) => account.id === accountId)) {
      return;
    }

    setUsageLoadingAccountIds((current) => {
      const next = new Set(current);
      next.add(accountId);
      return next;
    });

    try {
      const usage = await services.usage.get(accountId);
      setUsageByAccountId((current) => {
        if (!nextSnapshot.accounts.some((account) => account.id === accountId)) {
          return current;
        }

        return {
          ...current,
          [accountId]: usage,
        };
      });
      setErrorCode(null);
    } catch (error) {
      setErrorCode(getErrorCode(error, "usage.load_failed"));
    } finally {
      setUsageLoadingAccountIds((current) => {
        const next = new Set(current);
        next.delete(accountId);
        return next;
      });
    }
  };

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

        applySnapshot(nextSnapshot);
        setProcessStatus(nextProcessStatus);
        setErrorCode(null);

        try {
          const collection = await services.usage.refreshAll();

          if (!active) {
            return;
          }

          setUsageByAccountId(mapUsageCollection(collection, nextSnapshot));
        } catch (error) {
          if (!active) {
            return;
          }

          setErrorCode(getErrorCode(error, "usage.load_failed"));
        }
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
    () => (snapshot ? deriveAccountsView(snapshot, maskedAccountIds, allMasked) : null),
    [allMasked, maskedAccountIds, snapshot],
  );

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

      applySnapshot(nextSnapshot);
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
      applySnapshot(nextSnapshot);
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

      applySnapshot(result.accounts);
      setSwitchCandidateAccountId(null);
      setSwitchConfirmOpen(false);
      setErrorCode(null);
      await Promise.all([refreshProcessStatus(), refreshUsageForAccount(accountId, result.accounts)]);
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

  const handleStartOAuthLogin = async (accountName: string) => {
    const normalizedAccountName = accountName.trim();

    if (!normalizedAccountName) {
      setErrorCode("oauth.name_required");
      return;
    }

    setOAuthPhase("starting");
    setErrorCode(null);

    try {
      const result = await services.oauth.start({
        accountName: normalizedAccountName,
      });

      setOAuthAuthUrl(result.authUrl);
      setOAuthPhase("waiting");
      openBrowserUrl(result.authUrl);
    } catch (error) {
      setOAuthPhase("idle");
      setErrorCode(getErrorCode(error, "oauth.start_failed"));
    }
  };

  const handleOpenBrowserAgain = () => {
    if (!oauthAuthUrl) {
      return;
    }

    openBrowserUrl(oauthAuthUrl);
  };

  const handleCancelOAuthLogin = async () => {
    if (oauthPhase === "idle" || oauthPhase === "starting") {
      resetOAuthState();
      return;
    }

    setOAuthPhase("cancelling");

    try {
      await services.oauth.cancel();
      setErrorCode(null);
      resetOAuthState();
    } catch (error) {
      setOAuthPhase("waiting");
      setErrorCode(getErrorCode(error, "oauth.cancel_failed"));
    }
  };

  const handleCloseAddAccount = async () => {
    if (oauthPhase === "waiting" || oauthPhase === "completing" || oauthPhase === "cancelling") {
      await handleCancelOAuthLogin();
      return;
    }

    setErrorCode(null);
    resetOAuthState();
  };

  const handleCompleteOAuthLogin = async () => {
    setOAuthPhase("completing");

    try {
      const nextSnapshot = await services.oauth.complete();
      applySnapshot(nextSnapshot);
      await Promise.all([refreshProcessStatus(), refreshAllUsage(nextSnapshot)]);
      setErrorCode(null);
      resetOAuthState();
    } catch (error) {
      setOAuthPhase("waiting");
      setErrorCode(getErrorCode(error, "oauth.complete_failed"));
    }
  };

  const handleWarmupAccount = async (account: AccountSummary) => {
    if (!account.warmupAvailability.isAvailable) {
      return;
    }

    setWarmupPendingAccountIds((current) => {
      const next = new Set(current);
      next.add(account.id);
      return next;
    });

    try {
      const result = await services.warmup.run(account.id);
      setLatestWarmupByAccountId((current) => ({
        ...current,
        [account.id]: result,
      }));
      setWarmupFeedback(
        getSingleWarmupFeedback(
          result,
          getActionName(account, allMasked || maskedAccountIds.has(account.id), t),
          t,
        ),
      );
      setErrorCode(null);
    } catch (error) {
      setErrorCode(getErrorCode(error, "warmup.execute_failed"));
    } finally {
      setWarmupPendingAccountIds((current) => {
        const next = new Set(current);
        next.delete(account.id);
        return next;
      });
    }
  };

  const handleWarmupAll = async () => {
    if (!snapshot) {
      return;
    }

    const hasEligibleAccount = snapshot.accounts.some(
      (account) => account.warmupAvailability.isAvailable,
    );
    if (!hasEligibleAccount) {
      setWarmupFeedback(getAllWarmupFeedback({ items: [], summary: {
        totalAccounts: snapshot.accounts.length,
        eligibleAccounts: 0,
        successfulAccounts: 0,
        failedAccounts: 0,
        skippedAccounts: snapshot.accounts.length,
      } }, t));
      return;
    }

    setWarmupAllPending(true);

    try {
      const result = await services.warmup.runAll();
      setLatestWarmupByAccountId((current) => {
        const next = { ...current };
        for (const item of result.items) {
          next[item.accountId] = item;
        }
        return next;
      });
      setWarmupFeedback(getAllWarmupFeedback(result, t));
      setErrorCode(null);
    } catch (error) {
      setErrorCode(getErrorCode(error, "warmup.execute_failed"));
    } finally {
      setWarmupAllPending(false);
    }
  };

  if (!snapshot || !processStatus || !view) {
    return (
      <SectionCard title={t("accounts:title")}>
        <p>{t("accounts:loading")}</p>
      </SectionCard>
    );
  }

  const processCopy = getProcessCopy(processStatus, t);
  const eligibleWarmupCount = snapshot.accounts.filter(
    (account) => account.warmupAvailability.isAvailable,
  ).length;
  const warmupAllDisabled = warmupAllPending || eligibleWarmupCount === 0;

  return (
    <SectionCard title={t("accounts:title")}>
      <div className="accounts-toolbar">
        <span>{t("accounts:count", { count: snapshot.accounts.length })}</span>
        <div className={`process-badge ${processCopy.toneClass}`}>
          <strong>{processCopy.title}</strong>
          <span>{processCopy.body}</span>
        </div>
        <div className="accounts-toolbar-actions">
          <button
            aria-label={t("warmup:runAllAccounts")}
            className="secondary-button"
            disabled={warmupAllDisabled}
            onClick={() => {
              void handleWarmupAll();
            }}
            title={eligibleWarmupCount === 0 ? t("warmup:runAllUnavailable") : undefined}
            type="button"
          >
            {warmupAllPending ? t("warmup:runningAction") : t("warmup:runAllAction")}
          </button>
          <button
            aria-label={t("usage:refreshAllAccounts")}
            className="secondary-button"
            disabled={refreshAllUsagePending}
            onClick={() => {
              void refreshAllUsage(snapshot);
            }}
            type="button"
          >
            {t("usage:refreshAllAction")}
          </button>
          <button
            aria-label={t("auth:addToolbarAction")}
            className="primary-button"
            onClick={() => {
              setErrorCode(null);
              setAddAccountOpen(true);
            }}
            type="button"
          >
            {t("auth:addToolbarAction")}
          </button>
          <button
            className="secondary-button"
            onClick={() => setAllMasked((current) => !current)}
            type="button"
          >
            {allMasked ? t("accounts:showAll") : t("accounts:hideAll")}
          </button>
        </div>
      </div>

      {errorCode ? <p className="accounts-error-banner">{t(`errors:${errorCode}`)}</p> : null}
      {warmupFeedback ? (
        <p className={`accounts-feedback-banner accounts-feedback-${warmupFeedback.tone}`}>
          {warmupFeedback.message}
        </p>
      ) : null}

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
                isUsageLoading={
                  refreshAllUsagePending || usageLoadingAccountIds.has(view.activeAccount.id)
                }
                isWarmupPending={
                  warmupAllPending || warmupPendingAccountIds.has(view.activeAccount.id)
                }
                latestWarmup={latestWarmupByAccountId[view.activeAccount.id]}
                onBeginRename={beginRename}
                onDelete={handleDelete}
                onRefreshUsage={(accountId) => {
                  void refreshUsageForAccount(accountId);
                }}
                onRenameCancel={cancelRename}
                onRenameDraftChange={setRenameDraft}
                onRenameSubmit={handleRenameSubmit}
                onSwitch={handleSwitch}
                onToggleMask={(accountId) =>
                  setMaskedAccountIds((current) => toggleMaskedAccount(current, accountId))
                }
                onWarmup={(accountId) => {
                  const account = snapshot.accounts.find((item) => item.id === accountId);
                  if (!account) {
                    return;
                  }
                  void handleWarmupAccount(account);
                }}
                renameDraft={renameDraft}
                usage={usageByAccountId[view.activeAccount.id]}
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
                    isUsageLoading={
                      refreshAllUsagePending || usageLoadingAccountIds.has(account.id)
                    }
                    isWarmupPending={warmupAllPending || warmupPendingAccountIds.has(account.id)}
                    latestWarmup={latestWarmupByAccountId[account.id]}
                    onBeginRename={beginRename}
                    onDelete={handleDelete}
                    onRefreshUsage={(accountId) => {
                      void refreshUsageForAccount(accountId);
                    }}
                    onRenameCancel={cancelRename}
                    onRenameDraftChange={setRenameDraft}
                    onRenameSubmit={handleRenameSubmit}
                    onSwitch={handleSwitch}
                    onToggleMask={(accountId) =>
                      setMaskedAccountIds((current) => toggleMaskedAccount(current, accountId))
                    }
                    onWarmup={(accountId) => {
                      const currentAccount = snapshot.accounts.find((item) => item.id === accountId);
                      if (!currentAccount) {
                        return;
                      }
                      void handleWarmupAccount(currentAccount);
                    }}
                    renameDraft={renameDraft}
                    usage={usageByAccountId[account.id]}
                  />
                ))}
              </div>
            ) : (
              <p>{t("accounts:othersEmpty")}</p>
            )}
          </div>
        </div>
      )}

      {switchConfirmOpen && processStatus && switchCandidateAccountId ? (
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

      <AddAccountModal
        authUrl={oauthAuthUrl}
        errorCode={errorCode}
        isOpen={addAccountOpen}
        onCancel={handleCancelOAuthLogin}
        onClose={handleCloseAddAccount}
        onComplete={handleCompleteOAuthLogin}
        onOpenBrowserAgain={handleOpenBrowserAgain}
        onStart={handleStartOAuthLogin}
        phase={oauthPhase}
      />
    </SectionCard>
  );
}
