import { describe, expect, test } from "vitest";

import { createAppI18n } from "./createAppI18n";

describe("createAppI18n", () => {
  test("loads shell namespace and falls back to english", async () => {
    const i18n = await createAppI18n();

    await i18n.changeLanguage("fr-FR");

    expect(i18n.t("shell:title")).toBe("Codex Switcher");
    expect(i18n.t("shell:subtitle")).toBe("Multi-account manager skeleton");
  });
});
