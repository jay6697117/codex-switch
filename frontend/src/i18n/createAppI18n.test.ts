import { afterEach, describe, expect, test, vi } from "vitest";

import { createAppI18n } from "./createAppI18n";

describe("createAppI18n", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  test("loads shell namespace and falls back to english", async () => {
    const i18n = await createAppI18n();

    await i18n.changeLanguage("fr-FR");

    expect(i18n.t("shell:title")).toBe("Codex Switcher");
    expect(i18n.t("shell:subtitle")).toBe("Multi-account manager skeleton");
  });

  test("warns when the active locale falls back to english for a missing key", async () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const i18n = await createAppI18n("zh-CN");

    i18n.addResource("en-US", "shell", "phase6FallbackOnly", "English fallback copy");

    expect(i18n.t("shell:phase6FallbackOnly")).toBe("English fallback copy");
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining("shell:phase6FallbackOnly"),
    );
  });
});
