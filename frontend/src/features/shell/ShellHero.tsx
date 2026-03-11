import { useTranslation } from "react-i18next";

import type { BootstrapPayload } from "../../lib/contracts";
import { SectionCard } from "../../components/SectionCard";

interface ShellHeroProps {
  bootstrap: BootstrapPayload;
}

export function ShellHero({ bootstrap }: ShellHeroProps) {
  const { t } = useTranslation(["shell", "common"]);

  return (
    <div className="hero-grid">
      <section className="hero-panel">
        <span className="eyebrow">{t("shell:eyebrow")}</span>
        <h1>{t("shell:title")}</h1>
        <p>{t("shell:subtitle")}</p>
        <p className="hero-readiness">{t("shell:readiness")}</p>
      </section>

      <SectionCard title={t("shell:runtimeTitle")}>
        <p>{t("shell:runtimeBody")}</p>
        <div className="pill-row">
          <span className="pill">
            {t("common:localeLabel")}: {bootstrap.locale}
          </span>
          <span className="pill">
            {bootstrap.hasManualOverride
              ? t("common:manualOverride")
              : t("common:systemDefault")}
          </span>
        </div>
      </SectionCard>

      <SectionCard title={t("shell:localeTitle")}>
        <p>{t("shell:localeBody")}</p>
        <p className="supported-locales">
          {t("common:supportedLocalesLabel")}: {bootstrap.supportedLocales.join(" / ")}
        </p>
      </SectionCard>
    </div>
  );
}
