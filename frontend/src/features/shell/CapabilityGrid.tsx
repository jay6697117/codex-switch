import { useTranslation } from "react-i18next";

const moduleKeys = ["accounts", "auth", "warmup", "backup"] as const;

export function CapabilityGrid() {
  const { t } = useTranslation(["shell", "common"]);

  return (
    <section className="module-grid-wrapper">
      <div className="module-grid-header">
        <span>{t("common:phase")} 2-5</span>
        <h2>{t("shell:moduleTitle")}</h2>
      </div>
      <div className="module-grid">
        {moduleKeys.map((moduleKey, index) => (
          <article key={moduleKey} className="module-card">
            <span className="module-index">{`0${index + 2}`}</span>
            <strong>{t(`shell:modules.${moduleKey}`)}</strong>
          </article>
        ))}
      </div>
    </section>
  );
}
