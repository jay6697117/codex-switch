import { useTranslation } from "react-i18next";

import type { AccountUsageSnapshot } from "../../lib/contracts";
import { formatUsageResetTime } from "../../lib/i18n/formatting";

interface UsageSummaryProps {
  usage?: AccountUsageSnapshot;
  loading: boolean;
}

function getPlanTypeLabel(
  planType: string | undefined,
  t: (key: string) => string,
): string | null {
  if (!planType) {
    return null;
  }

  switch (planType.trim().toLowerCase()) {
    case "free":
      return t("planTypeFree");
    case "plus":
      return t("planTypePlus");
    case "pro":
      return t("planTypePro");
    case "team":
      return t("planTypeTeam");
    default:
      return t("planTypeUnknown");
  }
}

function UsageWindow({
  label,
  locale,
  usedPercent,
  windowMinutes,
  resetsAt,
}: {
  label: string;
  locale: string;
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
      {resetsAt ? <p>{t("resetsAt", { value: formatUsageResetTime(resetsAt, locale) })}</p> : null}
    </div>
  );
}

export function UsageSummary({ usage, loading }: UsageSummaryProps) {
  const { i18n, t } = useTranslation(["usage", "errors"]);
  const planTypeLabel = getPlanTypeLabel(usage?.planType, t);

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
        {planTypeLabel ? <span className="usage-plan-pill">{planTypeLabel}</span> : null}
      </div>

      {usage.fiveHour ? (
        <UsageWindow
          label={t("usage:fiveHourLabel")}
          locale={i18n.language}
          resetsAt={usage.fiveHour.resetsAt}
          usedPercent={usage.fiveHour.usedPercent}
          windowMinutes={usage.fiveHour.windowMinutes}
        />
      ) : null}

      {usage.weekly ? (
        <UsageWindow
          label={t("usage:weeklyLabel")}
          locale={i18n.language}
          resetsAt={usage.weekly.resetsAt}
          usedPercent={usage.weekly.usedPercent}
          windowMinutes={usage.weekly.windowMinutes}
        />
      ) : null}
    </div>
  );
}
