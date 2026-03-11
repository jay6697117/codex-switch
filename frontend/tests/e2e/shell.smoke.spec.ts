import { expect, test } from "@playwright/test";

test("boots the shell with a Wails bootstrap payload", async ({ page }) => {
  await page.addInitScript(() => {
    window.go = {
      main: {
        App: {
          LoadBootstrap: async () => ({
            locale: "zh-CN",
            supportedLocales: ["zh-CN", "en-US"],
            hasManualOverride: false,
            app: {
              name: "Codex Switch",
              version: "0.1.0",
            },
          }),
        },
      },
    };
  });

  await page.goto("/");

  await expect(page.getByRole("heading", { name: "Codex Switcher" })).toBeVisible();
  await expect(page.getByText("多账号管理器骨架")).toBeVisible();
  await expect(page.getByText(/当前语言: zh-CN/)).toBeVisible();
  await expect(page.getByText(/支持语言: zh-CN \/ en-US/)).toBeVisible();
});
