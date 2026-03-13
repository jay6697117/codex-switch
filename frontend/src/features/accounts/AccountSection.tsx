import { forwardRef, useEffect, useImperativeHandle, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";

import { AddAccountModal, type OAuthPhase, type ImportPhase } from "../auth/AddAccountModal";
import { openBrowserUrl } from "../auth/browser";
import type {
  AccountSummary,
  AccountUsageSnapshot,
  AccountsSnapshot,
  AppError,
  AppMessage,
  ProcessStatus,
  UsageCollection,
  WarmupAccountResult,
  WarmupAllResult,
} from "../../lib/contracts";
import type { AppServices } from "../../lib/wails/services";
import { deriveAccountsView, toggleMaskedAccount } from "./model";
import {
  createManualAccountWarmupFeedback,
  createManualAllWarmupFeedback,
  type WarmupShellFeedback,
} from "../warmup/feedback";

const DELETE_CONFIRM_TIMEOUT_MS = 3_000;

// 排序类型
type SortKey = "deadline_asc" | "deadline_desc" | "remaining_desc" | "remaining_asc";

// 暴露给 AppHeader 的方法
export interface AccountSectionHandle {
  warmupAll: () => void;
  refreshAllUsage: () => void;
  toggleMaskAll: () => void;
  openAddAccount: () => void;
  isAllMasked: () => boolean;
  getProcessBadge: () => React.ReactNode | null;
}

interface AccountSectionProps {
  services: Pick<AppServices, "accounts" | "oauth" | "process" | "usage" | "warmup">;
  onSnapshotChange?: (snapshot: AccountsSnapshot) => void;
  onWarmupFeedback?: (feedback: WarmupShellFeedback) => void;
  revision?: number;
}

interface SectionFeedback {
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

// 计划类型 Badge 颜色映射
function getPlanBadgeClass(planType?: string, authKind?: string): string {
  if (!planType) {
    return authKind === "apiKey" ? "plan-badge plan-badge-api" : "plan-badge plan-badge-free";
  }
  const key = planType.toLowerCase();
  const map: Record<string, string> = {
    pro: "plan-badge plan-badge-pro",
    plus: "plan-badge plan-badge-plus",
    team: "plan-badge plan-badge-team",
    enterprise: "plan-badge plan-badge-enterprise",
    free: "plan-badge plan-badge-free",
  };
  return map[key] ?? "plan-badge plan-badge-free";
}

function getPlanDisplayName(planType?: string, authKind?: string): string {
  if (planType) {
    return planType.charAt(0).toUpperCase() + planType.slice(1);
  }
  return authKind === "apiKey" ? "API Key" : "Unknown";
}

function getProcessCopy(
  status: ProcessStatus,
  t: (key: string, options?: Record<string, unknown>) => string,
) {
  const total = status.foregroundCount + status.backgroundCount;

  if (total === 0) {
    return {
      toneClass: "safe",
      title: t("processReadyTitle"),
      body: t("processReadyBody"),
    };
  }

  return {
    toneClass: "busy",
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
): SectionFeedback | null {
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
): SectionFeedback {
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
): SectionFeedback {
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

function translateAppMessage(
  message: AppMessage | undefined,
  t: (key: string, options?: Record<string, unknown>) => string,
): string | null {
  if (!message?.code) {
    return null;
  }

  const separatorIndex = message.code.indexOf(".");
  if (separatorIndex <= 0 || separatorIndex === message.code.length - 1) {
    return t(message.code, message.args);
  }

  const namespace = message.code.slice(0, separatorIndex);
  const key = message.code.slice(separatorIndex + 1);

  return t(`${namespace}:${key}`, message.args);
}

// 格式化最后刷新时间
function formatLastRefresh(date: Date | null): string {
  if (!date) return "Never";
  const now = new Date();
  const diff = Math.floor((now.getTime() - date.getTime()) / 1000);
  if (diff < 5) return "Just now";
  if (diff < 60) return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return date.toLocaleDateString();
}

// CSS Blur 文字组件
function BlurredText({ children, blur }: { children: React.ReactNode; blur: boolean }) {
  return (
    <span
      className={`blurred-text ${blur ? "blurred-text-active" : ""}`}
      style={blur ? { userSelect: "none" } : undefined}
    >
      {children}
    </span>
  );
}

// 确认切换对话框
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
        <div style={{ padding: 20 }}>
          <h3 id="switch-confirm-title">{t("switchConfirmTitle")}</h3>
          <p>{t("switchConfirmBody")}</p>
          <p className="switch-dialog-status">
            {t("processBusyBody", {
              foreground: processStatus.foregroundCount,
              background: processStatus.backgroundCount,
            })}
          </p>
        </div>
        <div className="switch-dialog-actions">
          <button className="dialog-btn dialog-btn-secondary" onClick={onCancel} type="button">
            {t("switchConfirmCancel")}
          </button>
          <button className="dialog-btn dialog-btn-primary" disabled={pending} onClick={onConfirm} type="button">
            {pending ? t("switchingAction") : t("switchConfirmAction")}
          </button>
        </div>
      </div>
    </div>
  );
}

// 眼睛图标 SVG
function EyeIcon({ masked }: { masked: boolean }) {
  if (masked) {
    return (
      <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
      </svg>
    );
  }
  return (
    <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
    </svg>
  );
}

// 单个 RateLimitBar（对齐原始项目风格）
function RateLimitBar({
  label,
  usedPercent,
  resetsAt,
}: {
  label: string;
  usedPercent?: number;
  resetsAt?: string;
}) {
  const remainPercent = Math.max(0, 100 - (usedPercent ?? 0));
  const colorClass =
    remainPercent <= 10 ? "usage-bar-fill-red" :
    remainPercent <= 30 ? "usage-bar-fill-amber" :
    "usage-bar-fill-green";

  // 计算 reset 倒计时
  let resetLabel = "";
  if (resetsAt) {
    const resetMs = new Date(resetsAt).getTime();
    const nowMs = Date.now();
    const diffSec = Math.max(0, Math.floor((resetMs - nowMs) / 1000));
    if (diffSec <= 0) resetLabel = "now";
    else if (diffSec < 60) resetLabel = `${diffSec}s`;
    else if (diffSec < 3600) resetLabel = `${Math.floor(diffSec / 60)}m`;
    else resetLabel = `${Math.floor(diffSec / 3600)}h ${Math.floor((diffSec % 3600) / 60)}m`;
  }

  return (
    <div className="usage-bar-row">
      <div className="usage-bar-header">
        <span>{label}</span>
        <span>
          {remainPercent.toFixed(0)}% left
          {resetLabel ? ` • resets ${resetLabel}` : ""}
        </span>
      </div>
      <div className="usage-bar-track">
        <div className={`usage-bar-fill ${colorClass}`} style={{ width: `${remainPercent}%` }} />
      </div>
    </div>
  );
}

// UsageBar 组件（对齐原始项目风格）
function UsageBar({ usage, loading }: { usage?: AccountUsageSnapshot; loading?: boolean }) {
  if (loading) {
    return (
      <div className="usage-area">
        <div className="usage-bar-row">
          <div className="usage-bar-track" style={{ opacity: 0.5 }}>
            <div className="usage-bar-fill usage-bar-fill-green" style={{ width: "66%" }} />
          </div>
        </div>
        <div className="usage-bar-row">
          <div className="usage-bar-track" style={{ opacity: 0.5 }}>
            <div className="usage-bar-fill usage-bar-fill-green" style={{ width: "50%" }} />
          </div>
        </div>
      </div>
    );
  }

  if (!usage || usage.status === "unsupported" || usage.status === "unavailable") {
    return <div className="usage-unavailable">{usage?.reasonCode ? "Error loading usage" : "Usage unavailable"}</div>;
  }

  if (!usage.fiveHour && !usage.weekly) {
    return <div className="usage-unavailable">No rate limit data</div>;
  }

  return (
    <div className="usage-area">
      {usage.fiveHour && (
        <RateLimitBar
          label="5h Limit"
          usedPercent={usage.fiveHour.usedPercent}
          resetsAt={usage.fiveHour.resetsAt}
        />
      )}
      {usage.weekly && (
        <RateLimitBar
          label="Weekly Limit"
          usedPercent={usage.weekly.usedPercent}
          resetsAt={usage.weekly.resetsAt}
        />
      )}
    </div>
  );
}

// 账户卡片（对齐原始项目风格）
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
  const warmupInfo = getWarmupInfoCopy(
    latestWarmup,
    account.warmupAvailability.reasonCode,
    t,
  );
  const [lastRefresh, setLastRefresh] = useState<Date | null>(
    usage && usage.status !== "unsupported" && usage.status !== "unavailable" ? new Date() : null,
  );
  const inputRef = useRef<HTMLInputElement>(null);

  // 自动聚焦重命名输入框
  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);

  // usage 刷新时更新时间戳
  useEffect(() => {
    if (usage && usage.status !== "unsupported" && usage.status !== "unavailable") {
      setLastRefresh(new Date());
    }
  }, [usage]);

  const planBadgeClass = getPlanBadgeClass(usage?.planType, account.authKind);
  const planDisplay = getPlanDisplayName(usage?.planType, account.authKind);

  return (
    <article className={`account-card ${isActive ? "account-card-active" : ""}`}>
      {/* Header: 名称 + 徽章 */}
      <div className="account-card-header">
        <div className="account-card-info">
          <div className="account-name-row">
            {isActive && (
              <span className="active-pulse">
                <span className="active-pulse-ring" />
                <span className="active-pulse-dot" />
              </span>
            )}
            {isEditing ? (
              <input
                ref={inputRef}
                className="account-rename-input"
                onBlur={() => {
                  void onRenameSubmit(account.id);
                }}
                onChange={(e) => onRenameDraftChange(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    void onRenameSubmit(account.id);
                  }
                  if (e.key === "Escape") {
                    e.preventDefault();
                    onRenameCancel();
                  }
                }}
                type="text"
                value={renameDraft}
              />
            ) : (
              <h3
                className="account-title-button"
                onClick={() => {
                  if (isMasked) return;
                  onBeginRename(account);
                }}
                title={isMasked ? undefined : "Click to rename"}
                style={{ cursor: isMasked ? "default" : "pointer" }}
              >
                <BlurredText blur={isMasked}>{account.displayName}</BlurredText>
              </h3>
            )}
          </div>
          {account.email && (
            <p className="account-subtitle">
              <BlurredText blur={isMasked}>{account.email}</BlurredText>
            </p>
          )}
        </div>

        <div className="account-header-right">
          {/* 眼睛切换 */}
          <button
            className="eye-toggle-btn"
            onClick={() => onToggleMask(account.id)}
            title={isMasked ? "Show info" : "Hide info"}
            type="button"
          >
            <EyeIcon masked={isMasked} />
          </button>
          {/* Plan Badge */}
          <span className={planBadgeClass}>{planDisplay}</span>
        </div>
      </div>

      {/* Usage 进度条 */}
      <UsageBar loading={isUsageLoading} usage={usage} />

      {/* Last updated */}
      <div className="last-updated">
        Last updated: {formatLastRefresh(lastRefresh)}
      </div>

      {/* Warmup 信息 */}
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

      {/* 操作栏（对齐原始项目图标按钮风格） */}
      <div className="account-actions">
        {isActive ? (
          <button className="action-btn-switch action-btn-switch-active" disabled type="button">
            ✓ Active
          </button>
        ) : (
          <button
            className="action-btn-switch action-btn-switch-idle"
            disabled={isSwitching}
            onClick={() => onSwitch(account.id)}
            type="button"
          >
            {isSwitching ? "Switching..." : "Switch"}
          </button>
        )}
        <button
          className={`icon-action-btn ${isWarmupPending ? "icon-action-warm-active" : "icon-action-warm"}`}
          disabled={isWarmupPending || !account.warmupAvailability.isAvailable}
          onClick={() => onWarmup(account.id)}
          title={isWarmupPending ? "Sending warm-up request..." : "Send minimal warm-up request"}
          type="button"
        >
          ⚡
        </button>
        <button
          className="icon-action-btn icon-action-refresh"
          disabled={isUsageLoading}
          onClick={() => onRefreshUsage(account.id)}
          title="Refresh usage"
          type="button"
        >
          <span className={isUsageLoading ? "spin-animation" : ""} style={{ display: "inline-block" }}>↻</span>
        </button>
        <button
          className={`icon-action-btn ${isDeletePending ? "icon-action-delete" : "icon-action-delete"}`}
          onClick={() => onDelete(account.id)}
          title="Remove account"
          type="button"
          style={isDeletePending ? { background: "var(--red-100)", fontWeight: 700 } : undefined}
        >
          ✕
        </button>
      </div>
    </article>
  );
}

export const AccountSection = forwardRef<AccountSectionHandle, AccountSectionProps>(
  function AccountSection(
    { services, onSnapshotChange, onWarmupFeedback, revision = 0 },
    ref,
  ) {
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
    const [sectionFeedback, setSectionFeedback] = useState<SectionFeedback | null>(null);
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
    const [importPhase, setImportPhase] = useState<ImportPhase>("idle");
    const [importFilePath, setImportFilePath] = useState<string | null>(null);
    const [otherAccountsSort, setOtherAccountsSort] = useState<SortKey>("deadline_asc");
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
      setImportPhase("idle");
      setImportFilePath(null);
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

    const refreshAllUsageImpl = async (targetSnapshot: AccountsSnapshot) => {
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
    }, [revision, services]);

    const view = useMemo(
      () => (snapshot ? deriveAccountsView(snapshot, maskedAccountIds, allMasked) : null),
      [allMasked, maskedAccountIds, snapshot],
    );

    // 排序 Other Accounts
    const sortedOtherAccounts = useMemo(() => {
      if (!view) return [];
      const accounts = [...view.otherAccounts];

      // 获取首个 reset 时间戳（优先 fiveHour，其次 weekly）
      const getResetMs = (u?: AccountUsageSnapshot): number | null => {
        const raw = u?.fiveHour?.resetsAt ?? u?.weekly?.resetsAt;
        if (!raw) return null;
        return new Date(raw).getTime();
      };

      // 获取用量百分比（优先 fiveHour）
      const getUsedPercent = (u?: AccountUsageSnapshot): number | null => {
        return u?.fiveHour?.usedPercent ?? u?.weekly?.usedPercent ?? null;
      };

      accounts.sort((a, b) => {
        const usageA = usageByAccountId[a.id];
        const usageB = usageByAccountId[b.id];

        switch (otherAccountsSort) {
          case "deadline_asc": {
            const resetA = getResetMs(usageA) ?? Infinity;
            const resetB = getResetMs(usageB) ?? Infinity;
            return resetA - resetB;
          }
          case "deadline_desc": {
            const resetA = getResetMs(usageA) ?? -Infinity;
            const resetB = getResetMs(usageB) ?? -Infinity;
            return resetB - resetA;
          }
          case "remaining_desc": {
            const pctA = getUsedPercent(usageA);
            const pctB = getUsedPercent(usageB);
            const remA = pctA != null ? (100 - pctA) : -1;
            const remB = pctB != null ? (100 - pctB) : -1;
            return remB - remA;
          }
          case "remaining_asc": {
            const pctA = getUsedPercent(usageA);
            const pctB = getUsedPercent(usageB);
            const remA = pctA != null ? (100 - pctA) : Infinity;
            const remB = pctB != null ? (100 - pctB) : Infinity;
            return remA - remB;
          }
          default:
            return 0;
        }
      });
      return accounts;
    }, [view, otherAccountsSort, usageByAccountId]);

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

        applySnapshot(result.data.accounts);
        setSwitchCandidateAccountId(null);
        setSwitchConfirmOpen(false);
        const successMessage = translateAppMessage(result.message, t);
        if (successMessage) {
          setSectionFeedback({
            message: successMessage,
            tone: "success",
          });
        }
        setErrorCode(null);
        await Promise.all([
          refreshProcessStatus(),
          refreshUsageForAccount(accountId, result.data.accounts),
        ]);
      } catch (error) {
        setSectionFeedback(null);
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
      setSectionFeedback(null);
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
        applySnapshot(nextSnapshot.data);
        await Promise.all([refreshProcessStatus(), refreshAllUsageImpl(nextSnapshot.data)]);
        const successMessage = translateAppMessage(nextSnapshot.message, t);
        if (successMessage) {
          setSectionFeedback({
            message: successMessage,
            tone: "success",
          });
        }
        setErrorCode(null);
        resetOAuthState();
      } catch (error) {
        setOAuthPhase("waiting");
        setSectionFeedback(null);
        setErrorCode(getErrorCode(error, "oauth.complete_failed"));
      }
    };

    const handleSelectAuthFile = async () => {
      try {
        const result = await services.oauth.selectAuthFilePath();
        if (result.selected && result.path) {
          setImportFilePath(result.path);
          setErrorCode(null);
        }
      } catch (error) {
        setErrorCode(getErrorCode(error, "auth.import_failed"));
      }
    };

    const handleImportFromFile = async (accountName: string) => {
      const normalizedName = accountName.trim();
      if (!normalizedName) {
        setErrorCode("oauth.name_required");
        return;
      }

      if (!importFilePath) {
        setErrorCode("auth.file_invalid");
        return;
      }

      setImportPhase("importing");
      setSectionFeedback(null);
      setErrorCode(null);

      try {
        const result = await services.oauth.importFromFile({
          accountName: normalizedName,
          filePath: importFilePath,
        });
        applySnapshot(result.data);
        await Promise.all([refreshProcessStatus(), refreshAllUsageImpl(result.data)]);
        const successMessage = translateAppMessage(result.message, t);
        if (successMessage) {
          setSectionFeedback({
            message: successMessage,
            tone: "success",
          });
        }
        setErrorCode(null);
        resetOAuthState();
      } catch (error) {
        setImportPhase("idle");
        setSectionFeedback(null);
        setErrorCode(getErrorCode(error, "auth.import_failed"));
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
        const feedback = createManualAccountWarmupFeedback(
          result,
          getActionName(account, allMasked || maskedAccountIds.has(account.id), t),
          t,
        );
        setSectionFeedback(feedback.toast);
        onWarmupFeedback?.(feedback);
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
        setSectionFeedback(getAllWarmupFeedback({ items: [], summary: {
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
        const feedback = createManualAllWarmupFeedback(result, t);
        setSectionFeedback(feedback.toast);
        onWarmupFeedback?.(feedback);
        setErrorCode(null);
      } catch (error) {
        setErrorCode(getErrorCode(error, "warmup.execute_failed"));
      } finally {
        setWarmupAllPending(false);
      }
    };

    // 暴露方法给 AppHeader
    useImperativeHandle(ref, () => ({
      warmupAll: () => {
        void handleWarmupAll();
      },
      refreshAllUsage: () => {
        if (snapshot) {
          void refreshAllUsageImpl(snapshot);
        }
      },
      toggleMaskAll: () => {
        setAllMasked((current) => !current);
      },
      openAddAccount: () => {
        setErrorCode(null);
        setAddAccountOpen(true);
      },
      isAllMasked: () => allMasked,
      getProcessBadge: () => {
        if (!processStatus) return null;
        const copy = getProcessCopy(processStatus, t);
        return (
          <span className={`process-badge-inline process-badge-inline-${copy.toneClass}`}>
            <span className={`process-dot process-dot-${copy.toneClass}`} />
            {copy.title}
          </span>
        );
      },
    }));

    if (!snapshot || !processStatus || !view) {
      return (
        <div className="accounts-section">
          <p>{t("accounts:loading")}</p>
        </div>
      );
    }

    return (
      <div className="accounts-section">
        {errorCode ? <p className="accounts-error-banner">{t(`errors:${errorCode}`)}</p> : null}
        {sectionFeedback ? (
          <p className={`accounts-feedback-banner accounts-feedback-${sectionFeedback.tone}`}>
            {sectionFeedback.message}
          </p>
        ) : null}

        {snapshot.accounts.length === 0 ? (
          <div className="accounts-empty-state">
            <div className="accounts-empty-icon">
              <span>👤</span>
            </div>
            <h2>No accounts yet</h2>
            <p>Add your first Codex account to get started</p>
            <button
              className="primary-button"
              onClick={() => {
                setErrorCode(null);
                setAddAccountOpen(true);
              }}
              type="button"
            >
              Add Account
            </button>
          </div>
        ) : (
          <>
            {/* Active Account */}
            {view.activeAccount ? (
              <section>
                <div className="accounts-group-header">
                  <h2>{t("accounts:activeTitle")}</h2>
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
              </section>
            ) : null}

            {/* Other Accounts */}
            {sortedOtherAccounts.length > 0 && (
              <section>
                <div className="accounts-group-header">
                  <h2>Other Accounts ({sortedOtherAccounts.length})</h2>
                  <div className="sort-control">
                    <label className="sort-label" htmlFor="other-accounts-sort">
                      Sort
                    </label>
                    <div className="sort-select-wrapper">
                      <select
                        className="sort-select"
                        id="other-accounts-sort"
                        value={otherAccountsSort}
                        onChange={(e) => setOtherAccountsSort(e.target.value as SortKey)}
                      >
                        <option value="deadline_asc">Reset: earliest to latest</option>
                        <option value="deadline_desc">Reset: latest to earliest</option>
                        <option value="remaining_desc">% remaining: highest to lowest</option>
                        <option value="remaining_asc">% remaining: lowest to highest</option>
                      </select>
                      <span className="sort-select-arrow">
                        <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M6 8l4 4 4-4" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      </span>
                    </div>
                  </div>
                </div>
                <div className="accounts-grid">
                  {sortedOtherAccounts.map((account) => (
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
              </section>
            )}
          </>
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
          importFilePath={importFilePath}
          importPhase={importPhase}
          isOpen={addAccountOpen}
          onCancel={handleCancelOAuthLogin}
          onClose={handleCloseAddAccount}
          onComplete={handleCompleteOAuthLogin}
          onImportFile={handleImportFromFile}
          onOpenBrowserAgain={handleOpenBrowserAgain}
          onSelectFile={handleSelectAuthFile}
          onStart={handleStartOAuthLogin}
          phase={oauthPhase}
        />
      </div>
    );
  },
);
