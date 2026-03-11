import { useEffect, useState } from "react";
import { I18nextProvider, useTranslation } from "react-i18next";
import type { i18n } from "i18next";

import type { BootstrapPayload } from "../lib/contracts";
import type { AppServices } from "../lib/wails/services";
import { applyBootstrapLocale } from "../i18n/createAppI18n";
import { AccountSection } from "../features/accounts/AccountSection";
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
  const [errorCode, setErrorCode] = useState<string | null>(null);
  const { t } = useTranslation(["errors", "shell"]);

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
      <AccountSection services={services} />
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
