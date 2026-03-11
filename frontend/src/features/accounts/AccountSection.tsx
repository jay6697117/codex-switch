import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";

import type { AccountsSnapshot } from "../../lib/contracts";
import { SectionCard } from "../../components/SectionCard";
import { deriveAccountsView, toggleMaskedAccount } from "./model";

interface AccountSectionProps {
  snapshot: AccountsSnapshot;
}

function AccountRow({
  id,
  title,
  subtitle,
  masked,
  onToggleMask,
}: {
  id: string;
  title: string;
  subtitle?: string;
  masked: boolean;
  onToggleMask: (accountId: string) => void;
}) {
  const { t } = useTranslation("accounts");

  return (
    <article className="account-row">
      <div>
        <strong>{title}</strong>
        {subtitle ? <p>{subtitle}</p> : null}
      </div>
      <div className="account-row-actions">
        <span className="account-visibility">
          {masked ? t("visibilityHidden") : t("visibilityVisible")}
        </span>
        <button className="secondary-button" onClick={() => onToggleMask(id)} type="button">
          {masked ? t("showOne") : t("hideOne")}
        </button>
      </div>
    </article>
  );
}

export function AccountSection({ snapshot }: AccountSectionProps) {
  const { t } = useTranslation("accounts");
  const [allMasked, setAllMasked] = useState(false);
  const [maskedAccountIds, setMaskedAccountIds] = useState<Set<string>>(() => new Set());

  const view = useMemo(
    () => deriveAccountsView(snapshot, maskedAccountIds, allMasked),
    [allMasked, maskedAccountIds, snapshot],
  );

  const toggleMask = (accountId: string) => {
    setMaskedAccountIds((current) => toggleMaskedAccount(current, accountId));
  };

  if (snapshot.accounts.length === 0) {
    return (
      <SectionCard title={t("title")}>
        <div className="accounts-empty-state">
          <strong>{t("emptyTitle")}</strong>
          <p>{t("emptyBody")}</p>
        </div>
      </SectionCard>
    );
  }

  return (
    <SectionCard title={t("title")}>
      <div className="accounts-toolbar">
        <span>{t("count", { count: snapshot.accounts.length })}</span>
        <button
          className="secondary-button"
          onClick={() => setAllMasked((current) => !current)}
          type="button"
        >
          {allMasked ? t("showAll") : t("hideAll")}
        </button>
      </div>

      {view.activeAccount ? (
        <div className="accounts-group">
          <h3>{t("activeTitle")}</h3>
          <AccountRow
            id={view.activeAccount.id}
            masked={view.isMasked(view.activeAccount.id)}
            onToggleMask={toggleMask}
            subtitle={view.activeAccount.email}
            title={view.activeAccount.displayName}
          />
        </div>
      ) : null}

      <div className="accounts-group">
        <h3>{t("othersTitle")}</h3>
        {view.otherAccounts.length > 0 ? (
          view.otherAccounts.map((account) => (
            <AccountRow
              key={account.id}
              id={account.id}
              masked={view.isMasked(account.id)}
              onToggleMask={toggleMask}
              subtitle={account.email}
              title={account.displayName}
            />
          ))
        ) : (
          <p>{t("othersEmpty")}</p>
        )}
      </div>
    </SectionCard>
  );
}
