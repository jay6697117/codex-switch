import { useEffect, useState } from "react";
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
import { AccountSection } from "../features/accounts/AccountSection";
import { WarmupSection } from "../features/warmup/WarmupSection";
import {
  createRuntimeWarmupFeedback,
  type WarmupShellFeedback,
} from "../features/warmup/feedback";
import { CapabilityGrid } from "../features/shell/CapabilityGrid";
import { ShellHero } from "../features/shell/ShellHero";

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
  const { t } = useTranslation(["errors", "shell", "warmup"]);

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
      <main className="app-shell">
        <section className="error-panel">{t(errorCode)}</section>
      </main>
    );
  }

  if (!bootstrap) {
    return (
      <main className="app-shell">
        <section className="loading-panel">{t("shell:loading")}</section>
      </main>
    );
  }

  return (
    <main className="app-shell">
      <ShellHero bootstrap={bootstrap} />
      {warmupFeedback ? (
        <section
          className={`accounts-feedback-banner accounts-feedback-${warmupFeedback.toast.tone}`}
        >
          {warmupFeedback.toast.message}
        </section>
      ) : null}
      <AccountSection
        onSnapshotChange={(snapshot: AccountsSnapshot) => {
          setAccounts(snapshot.accounts);
        }}
        onWarmupFeedback={setWarmupFeedback}
        services={services}
      />
      <WarmupSection accounts={accounts} feedback={warmupFeedback} services={services} />
      <CapabilityGrid />
    </main>
  );
}

export function AppShell({ i18n, services }: AppShellProps) {
  return (
    <I18nextProvider i18n={i18n}>
      <AppShellContent i18n={i18n} services={services} />
    </I18nextProvider>
  );
}
