import { useTranslation } from "react-i18next";

import type { AccountUsageSnapshot } from "../../lib/contracts";

interface UsageSummaryProps {
  usage?: AccountUsageSnapshot;
  loading: boolean;
}

function formatResetTime(value?: string): string {
  if (!value) {
    return "";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

function UsageWindow({
  label,
  usedPercent,
  windowMinutes,
  resetsAt,
}: {
  label: string;
  usedPercent?: number;
  windowMinutes: number;
  resetsAt?: string;
}) {
  const { t } = useTranslation("usage");
  const width = Math.max(0, Math.min(usedPercent ?? 0, 100));

  return (
    <div className="usage-window">
      <div className="usage-window-header">
        <strong>{label}</strong>
        <span>{t("windowUsage", { percent: usedPercent ?? 0, minutes: windowMinutes })}</span>
      </div>
      <div className="usage-track" role="presentation">
        <div className="usage-fill" style={{ width: `${width}%` }} />
      </div>
      {resetsAt ? <p>{t("resetsAt", { value: formatResetTime(resetsAt) })}</p> : null}
    </div>
  );
}

export function UsageSummary({ usage, loading }: UsageSummaryProps) {
  const { t } = useTranslation(["usage", "errors"]);

  if (loading) {
    return (
      <div className="usage-panel usage-panel-loading">
        <strong>{t("usage:title")}</strong>
        <p>{t("usage:loading")}</p>
      </div>
    );
  }

  if (!usage) {
    return (
      <div className="usage-panel">
        <strong>{t("usage:title")}</strong>
        <p>{t("usage:loading")}</p>
      </div>
    );
  }

  if (usage.status === "unsupported" || usage.status === "unavailable") {
    const fallbackKey = usage.reasonCode ? `errors:${usage.reasonCode}` : "usage:unavailableFallback";
    return (
      <div className="usage-panel">
        <strong>{t("usage:title")}</strong>
        <p>{t(fallbackKey)}</p>
      </div>
    );
  }

  if (!usage.fiveHour && !usage.weekly) {
    return (
      <div className="usage-panel">
        <strong>{t("usage:title")}</strong>
        <p>{t("usage:empty")}</p>
      </div>
    );
  }

  return (
    <div className="usage-panel">
      <div className="usage-header">
        <strong>{t("usage:title")}</strong>
        {usage.planType ? <span className="usage-plan-pill">{usage.planType}</span> : null}
      </div>

      {usage.fiveHour ? (
        <UsageWindow
          label={t("usage:fiveHourLabel")}
          resetsAt={usage.fiveHour.resetsAt}
          usedPercent={usage.fiveHour.usedPercent}
          windowMinutes={usage.fiveHour.windowMinutes}
        />
      ) : null}

      {usage.weekly ? (
        <UsageWindow
          label={t("usage:weeklyLabel")}
          resetsAt={usage.weekly.resetsAt}
          usedPercent={usage.weekly.usedPercent}
          windowMinutes={usage.weekly.windowMinutes}
        />
      ) : null}
    </div>
  );
}
