import { expect, test } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    const accounts = [
      {
        id: "acc-active",
        displayName: "Work Account",
        email: "work@example.com",
        authKind: "chatgpt",
        createdAt: "2026-03-11T08:00:00Z",
        updatedAt: "2026-03-11T08:00:00Z",
        lastUsedAt: "2026-03-11T08:10:00Z",
      },
      {
        id: "acc-side",
        displayName: "Side Project",
        email: "side@example.com",
        authKind: "apiKey",
        createdAt: "2026-03-11T08:00:00Z",
        updatedAt: "2026-03-11T08:00:00Z",
      },
    ];

    let processStatusCalls = 0;
    const switchCalls: Array<{ accountId: string; confirmRestart: boolean }> = [];
    const browserOpens: string[] = [];
    const usageRefreshes: string[] = [];
    let usageItems = [
      {
        accountId: "acc-active",
        status: "supported",
        planType: "team",
        refreshedAt: "2026-03-11T12:00:00Z",
        fiveHour: {
          usedPercent: 21,
          windowMinutes: 300,
          resetsAt: "2026-03-11T16:00:00Z",
        },
        weekly: {
          usedPercent: 62,
          windowMinutes: 10080,
          resetsAt: "2026-03-17T16:00:00Z",
        },
      },
      {
        accountId: "acc-side",
        status: "unsupported",
        reasonCode: "usage.unsupported_api_key",
        refreshedAt: "2026-03-11T12:00:00Z",
      },
    ];

    Object.assign(window, {
      __switchCalls: switchCalls,
      __browserOpens: browserOpens,
      __usageRefreshes: usageRefreshes,
      runtime: {
        BrowserOpenURL: (url: string) => {
          browserOpens.push(url);
        },
      },
      go: {
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
            LoadAccounts: async () => ({
              data: {
                activeAccountId: "acc-active",
                accounts,
              },
            }),
            RenameAccount: async (input: { id: string; displayName: string }) => ({
              data: {
                activeAccountId: "acc-active",
                accounts: accounts.map((account) =>
                  account.id === input.id
                    ? {
                        ...account,
                        displayName: input.displayName,
                      }
                    : account,
                ),
              },
            }),
            DeleteAccount: async (accountId: string) => ({
              data: {
                activeAccountId: "acc-active",
                accounts: accounts.filter((account) => account.id !== accountId),
              },
            }),
            GetProcessStatus: async () => {
              processStatusCalls += 1;

              if (processStatusCalls <= 2) {
                return {
                  data: {
                    foregroundCount: 0,
                    backgroundCount: 0,
                    canSwitch: true,
                  },
                };
              }

              return {
                data: {
                  foregroundCount: 1,
                  backgroundCount: 1,
                  canSwitch: false,
                },
              };
            },
            SwitchAccount: async (input: { accountId: string; confirmRestart: boolean }) => {
              switchCalls.push(input);

              return {
                data: {
                  restartPerformed: input.confirmRestart,
                  accounts: {
                    activeAccountId: input.accountId,
                    accounts,
                  },
                },
              };
            },
            StartOAuthLogin: async (input: { accountName: string }) => ({
              data: {
                authUrl: `https://auth.openai.com/oauth/authorize?account=${encodeURIComponent(input.accountName)}`,
                callbackPort: 1455,
                pending: true,
              },
            }),
            CompleteOAuthLogin: async () => {
              accounts.push({
                id: "acc-new",
                displayName: "New OAuth Account",
                email: "new@example.com",
                authKind: "chatgpt",
                createdAt: "2026-03-11T09:00:00Z",
                updatedAt: "2026-03-11T09:00:00Z",
              });
              usageItems = [
                ...usageItems,
                {
                  accountId: "acc-new",
                  status: "supported",
                  planType: "plus",
                  refreshedAt: "2026-03-11T12:05:00Z",
                },
              ];
              return {
                data: {
                  activeAccountId: "acc-active",
                  accounts,
                },
              };
            },
            CancelOAuthLogin: async () => ({
              data: {
                pending: false,
              },
            }),
            GetAccountUsage: async (accountId: string) => {
              usageRefreshes.push(accountId);
              return {
                data: usageItems.find((item) => item.accountId === accountId),
              };
            },
            RefreshAllUsage: async () => ({
              data: {
                items: usageItems,
              },
            }),
          },
        },
      },
    });
  });
});

test("renders active and inactive account groups from typed Wails bindings", async ({ page }) => {
  await page.goto("/");

  await expect(page.getByRole("heading", { name: "Codex Switcher" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "当前账号" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "其他账号" })).toBeVisible();
  await expect(page.getByRole("button", { name: "编辑 Work Account" })).toBeVisible();
  await expect(page.getByRole("button", { name: "编辑 Side Project" })).toBeVisible();
  await expect(page.getByText("可安全切换")).toBeVisible();
});

test("blocks switching until confirmation and does not perform a silent switch", async ({ page }) => {
  await page.goto("/");

  await page.getByRole("button", { name: "切换到 Side Project" }).click();

  const dialog = page.getByRole("dialog", { name: "切换前先重启 Codex？" });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByText("前台 1 个 · 后台 1 个")).toBeVisible();
  await expect(
    page.evaluate(() => (window as typeof window & { __switchCalls: unknown[] }).__switchCalls.length),
  ).resolves.toBe(0);

  await page.getByRole("button", { name: "重启并切换" }).click();

  await expect(
    page.evaluate(
      () =>
        (window as typeof window & {
          __switchCalls: Array<{ accountId: string; confirmRestart: boolean }>;
        }).__switchCalls,
    ),
  ).resolves.toEqual([{ accountId: "acc-side", confirmRestart: true }]);
});

test("supports oauth add-account flow and usage refresh from the shell", async ({ page }) => {
  await page.goto("/");

  await page.getByRole("button", { name: "添加账号" }).click();
  await expect(page.getByRole("dialog", { name: "添加账号" })).toBeVisible();
  await expect(page.getByText("Import File")).toHaveCount(0);

  await page.getByRole("textbox", { name: "新账号名称" }).fill("New OAuth Account");
  await page.getByRole("button", { name: "开始浏览器登录" }).click();

  await expect(
    page.evaluate(
      () => (window as typeof window & { __browserOpens: string[] }).__browserOpens.length,
    ),
  ).resolves.toBe(1);

  await page.getByRole("button", { name: "完成登录" }).click();
  await expect(page.getByText("New OAuth Account")).toBeVisible();

  await page.getByRole("button", { name: "刷新 Work Account 的用量" }).click();
  await expect(
    page.evaluate(
      () => (window as typeof window & { __usageRefreshes: string[] }).__usageRefreshes,
    ),
  ).resolves.toContain("acc-active");
});
