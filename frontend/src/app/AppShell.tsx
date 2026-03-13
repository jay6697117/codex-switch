import { useEffect, useRef, useState } from "react";
import { I18nextProvider, useTranslation } from "react-i18next";
import type { i18n } from "i18next";

import type {
  AccountSummary,
  AccountsSnapshot,
  BootstrapPayload,
  WarmupRuntimeEvent,
} from "../lib/contracts";
import type { AppServices } from "../lib/wails/services";
import { applyBootstrapLocale } from "../i18n/createAppI18n";
import { AccountSection, type AccountSectionHandle } from "../features/accounts/AccountSection";
import { SettingsSection } from "../features/settings/SettingsSection";
import { WarmupSection } from "../features/warmup/WarmupSection";
import {
  createRuntimeWarmupFeedback,
  type WarmupShellFeedback,
} from "../features/warmup/feedback";
import { CapabilityGrid } from "../features/shell/CapabilityGrid";

interface AppShellProps {
  i18n: i18n;
  services: AppServices;
}

interface AppShellContentProps {
  i18n: i18n;
  services: AppServices;
}

function AppShellContent({ i18n, services }: AppShellContentProps) {
  const [bootstrap, setBootstrap] = useState<BootstrapPayload | null>(null);
  const [accounts, setAccounts] = useState<AccountSummary[]>([]);
  const [errorCode, setErrorCode] = useState<string | null>(null);
  const [warmupFeedback, setWarmupFeedback] = useState<WarmupShellFeedback | null>(null);
  const [shellRevision, setShellRevision] = useState(0);
  const { t } = useTranslation(["errors", "shell", "warmup", "accounts", "auth", "usage"]);
  const accountSectionRef = useRef<AccountSectionHandle>(null);

  useEffect(() => {
    let active = true;

    const hydrate = async () => {
      try {
        const payload = await services.bootstrap.load();
        await applyBootstrapLocale(i18n, payload);
        if (!active) {
          return;
        }
        setBootstrap(payload);
        setErrorCode(null);
      } catch {
        if (!active) {
          return;
        }
        setErrorCode("errors:bootstrapFailed");
      }
    };

    void hydrate();

    return () => {
      active = false;
    };
  }, [i18n, services]);

  useEffect(() => {
    if (!services.events) {
      return undefined;
    }

    return services.events.subscribe<WarmupRuntimeEvent>(
      "warmup:scheduledResult",
      (event) => {
        setWarmupFeedback(createRuntimeWarmupFeedback(event, t));
      },
    );
  }, [services, t]);

  if (errorCode) {
    return (
      <main className="app-main">
        <section className="error-panel">{t(errorCode)}</section>
      </main>
    );
  }

  if (!bootstrap) {
    return (
      <main className="app-main">
        <section className="loading-panel">{t("shell:loading")}</section>
      </main>
    );
  }

  return (
    <div className="min-h-screen">
      {/* Sticky Header */}
      <AppHeader
        accountSectionRef={accountSectionRef}
        hasAccounts={accounts.length > 0}
        t={t}
      />

      {/* Main Content */}
      <main className="app-main">
        {warmupFeedback ? (
          <section
            className={`accounts-feedback-banner accounts-feedback-${warmupFeedback.toast.tone}`}
          >
            {warmupFeedback.toast.message}
          </section>
        ) : null}
        <div className="app-main-sections">
          <AccountSection
            ref={accountSectionRef}
            onSnapshotChange={(snapshot: AccountsSnapshot) => {
              setAccounts(snapshot.accounts);
            }}
            onWarmupFeedback={setWarmupFeedback}
            revision={shellRevision}
            services={services}
          />
          <WarmupSection accounts={accounts} feedback={warmupFeedback} services={services} />
          <SettingsSection
            onBackupImported={() => {
              setShellRevision((current) => current + 1);
            }}
            onSettingsSaved={(settingsSnapshot) => {
              void i18n.changeLanguage(settingsSnapshot.effectiveLocale);
              setBootstrap((current) =>
                current
                  ? {
                      ...current,
                      locale: settingsSnapshot.effectiveLocale,
                      hasManualOverride: settingsSnapshot.localePreference !== "system",
                    }
                  : current,
              );
            }}
            services={services}
          />
          <CapabilityGrid />
        </div>
      </main>
    </div>
  );
}

/* ========================================
   App Header（Sticky 顶部导航栏）
   ======================================== */
function AppHeader({
  accountSectionRef,
  hasAccounts,
  t,
}: {
  accountSectionRef: React.RefObject<AccountSectionHandle | null>;
  hasAccounts: boolean;
  t: (key: string, options?: Record<string, unknown>) => string;
}) {
  return (
    <header className="app-header">
      <div className="app-header-inner">
        <div className="header-brand">
          <div className="header-logo">C</div>
          <div className="header-brand-text">
            <div className="header-title-row">
              <h1>Codex Switcher</h1>
              {accountSectionRef.current?.getProcessBadge() ?? null}
            </div>
            <p className="header-subtitle">Multi-account manager for Codex CLI</p>
          </div>
        </div>

        <div className="header-actions">
          <button
            className="header-btn header-btn-secondary"
            onClick={() => accountSectionRef.current?.toggleMaskAll()}
            type="button"
          >
            <span className="header-btn-icon">
              {accountSectionRef.current?.isAllMasked() ? t("accounts:showAll") : t("accounts:hideAll")}
            </span>
          </button>
          <button
            className="header-btn header-btn-secondary"
            disabled={!hasAccounts}
            onClick={() => accountSectionRef.current?.refreshAllUsage()}
            type="button"
          >
            ↻ {t("usage:refreshAllAction")}
          </button>
          <button
            className="header-btn header-btn-secondary"
            disabled={!hasAccounts}
            onClick={() => accountSectionRef.current?.warmupAll()}
            type="button"
          >
            <span className="header-btn-icon">
              <span>⚡</span> {t("warmup:runAllAction")}
            </span>
          </button>
          <button
            className="header-btn header-btn-primary"
            onClick={() => accountSectionRef.current?.openAddAccount()}
            type="button"
          >
            + {t("auth:addToolbarAction")}
          </button>
        </div>
      </div>
    </header>
  );
}

export function AppShell({ i18n, services }: AppShellProps) {
  return (
    <I18nextProvider i18n={i18n}>
      <AppShellContent i18n={i18n} services={services} />
    </I18nextProvider>
  );
}
