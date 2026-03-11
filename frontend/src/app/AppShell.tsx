import { useEffect, useState } from "react";
import { I18nextProvider, useTranslation } from "react-i18next";
import type { i18n } from "i18next";

import type { AccountsSnapshot, BootstrapPayload } from "../lib/contracts";
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
  const [accountsSnapshot, setAccountsSnapshot] = useState<AccountsSnapshot | null>(null);
  const [errorCode, setErrorCode] = useState<string | null>(null);
  const { t } = useTranslation(["errors"]);

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
      } catch {
        if (!active) {
          return;
        }
        setErrorCode("errors:bootstrapFailed");
        return;
      }

      try {
        const accounts = await services.accounts.load();
        if (!active) {
          return;
        }
        setAccountsSnapshot(accounts);
        setErrorCode(null);
      } catch {
        if (!active) {
          return;
        }
        setErrorCode("errors:accountLoadFailed");
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

  if (!bootstrap || !accountsSnapshot) {
    return (
      <main className="app-shell">
        <section className="loading-panel">Loading foundation...</section>
      </main>
    );
  }

  return (
    <main className="app-shell">
      <ShellHero bootstrap={bootstrap} />
      <AccountSection snapshot={accountsSnapshot} />
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
