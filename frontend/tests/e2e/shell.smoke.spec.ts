import { expect, test } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    const initialMissedRunToday = new URL(window.location.href).searchParams.get("missedPrompt");
    const accounts = [
      {
        id: "acc-active",
        displayName: "Work Account",
        email: "work@example.com",
        authKind: "chatgpt",
        createdAt: "2026-03-11T08:00:00Z",
        updatedAt: "2026-03-11T08:00:00Z",
        lastUsedAt: "2026-03-11T08:10:00Z",
        warmupAvailability: {
          isAvailable: true,
        },
      },
      {
        id: "acc-side",
        displayName: "Side Project",
        email: "side@example.com",
        authKind: "apiKey",
        createdAt: "2026-03-11T08:00:00Z",
        updatedAt: "2026-03-11T08:00:00Z",
        warmupAvailability: {
          isAvailable: false,
          reasonCode: "warmup.unsupported_auth_kind",
        },
      },
    ];

    let processStatusCalls = 0;
    const switchCalls: Array<{ accountId: string; confirmRestart: boolean }> = [];
    const browserOpens: string[] = [];
    const fullImportCalls: Array<{ path: string; passphrase?: string }> = [];
    const usageRefreshes: string[] = [];
    const eventHandlers = new Map<string, Array<(payload: unknown) => void>>();
    let settingsSnapshot = {
      localePreference: "system",
      effectiveLocale: "zh-CN",
      backupSecurityMode: "keychain",
    };
    let warmupScheduleStatus = {
      schedule: {
        enabled: true,
        localTime: "09:30",
        accountIds: ["acc-active"],
      },
      validAccountIds: ["acc-active"],
      missedRunToday: initialMissedRunToday === "1",
      nextRunLocalIso: "2026-03-12T09:30:00+08:00",
    };
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

    const emitRuntimeEvent = (eventName: string, payload: unknown) => {
      const handlers = eventHandlers.get(eventName) ?? [];
      handlers.forEach((handler) => handler(payload));
    };

    Object.assign(window, {
      __switchCalls: switchCalls,
      __fullImportCalls: fullImportCalls,
      __browserOpens: browserOpens,
      __usageRefreshes: usageRefreshes,
      __emitWarmupEvent: (payload: unknown) => emitRuntimeEvent("warmup:scheduledResult", payload),
      runtime: {
        BrowserOpenURL: (url: string) => {
          browserOpens.push(url);
        },
        EventsOn: (eventName: string, callback: (payload: unknown) => void) => {
          const current = eventHandlers.get(eventName) ?? [];
          current.push(callback);
          eventHandlers.set(eventName, current);

          return () => {
            const next = (eventHandlers.get(eventName) ?? []).filter(
              (handler) => handler !== callback,
            );
            eventHandlers.set(eventName, next);
          };
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
            LoadSettings: async () => ({
              data: settingsSnapshot,
            }),
            SaveSettings: async (input: {
              localePreference: "system" | "zh-CN" | "en-US";
              backupSecurityMode: "keychain" | "passphrase";
            }) => {
              settingsSnapshot = {
                localePreference: input.localePreference,
                effectiveLocale:
                  input.localePreference === "system" ? "zh-CN" : input.localePreference,
                backupSecurityMode: input.backupSecurityMode,
              };

              return {
                data: settingsSnapshot,
              };
            },
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
                message: {
                  code: "accounts.switch_success",
                  args: {
                    name:
                      accounts.find((account) => account.id === input.accountId)?.displayName ??
                      input.accountId,
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
                warmupAvailability: {
                  isAvailable: true,
                },
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
                message: {
                  code: "auth.account_added",
                  args: {
                    name: "New OAuth Account",
                  },
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
            ExportSlimText: async () => ({
              data: "css1.payload",
            }),
            ImportSlimText: async (payload: string) => {
              if (payload.trim()) {
                accounts.push({
                  id: "acc-imported",
                  displayName: "Imported Account",
                  email: "imported@example.com",
                  authKind: "chatgpt",
                  createdAt: "2026-03-12T10:30:00Z",
                  updatedAt: "2026-03-12T10:30:00Z",
                  warmupAvailability: {
                    isAvailable: true,
                  },
                });
              }

              return {
                data: {
                  totalInPayload: 1,
                  importedCount: 1,
                  skippedCount: 0,
                },
              };
            },
            SelectFullExportPath: async () => ({
              data: {
                selected: true,
                path: "/tmp/export.cswf",
              },
            }),
            ExportFullBackup: async () => ({
              data: true,
            }),
            SelectFullImportPath: async () => ({
              data: {
                selected: true,
                path: "/tmp/import.cswf",
              },
            }),
            ImportFullBackup: async (input: { path: string; passphrase?: string }) => {
              fullImportCalls.push(input);

              if (!input.passphrase) {
                return {
                  error: {
                    code: "backup.passphrase_required",
                  },
                };
              }

              accounts.push({
                id: "acc-full",
                displayName: "Full Backup Account",
                email: "full@example.com",
                authKind: "chatgpt",
                createdAt: "2026-03-12T11:00:00Z",
                updatedAt: "2026-03-12T11:00:00Z",
                warmupAvailability: {
                  isAvailable: true,
                },
              });

              return {
                data: {
                  totalInPayload: 1,
                  importedCount: 1,
                  skippedCount: 0,
                },
              };
            },
            LoadWarmupScheduleStatus: async () => ({
              data: warmupScheduleStatus,
            }),
            SaveWarmupSchedule: async (input: {
              enabled: boolean;
              localTime: string;
              accountIds: string[];
            }) => {
              warmupScheduleStatus = {
                schedule: {
                  enabled: input.enabled,
                  localTime: input.localTime,
                  accountIds: input.accountIds,
                },
                validAccountIds: input.accountIds,
                missedRunToday: false,
                nextRunLocalIso: `2026-03-13T${input.localTime}:00+08:00`,
              };

              return {
                data: warmupScheduleStatus,
              };
            },
            DismissMissedRunToday: async () => {
              warmupScheduleStatus = {
                ...warmupScheduleStatus,
                missedRunToday: false,
                schedule: warmupScheduleStatus.schedule
                  ? {
                      ...warmupScheduleStatus.schedule,
                      lastMissedPromptLocalDate: "2026-03-12",
                    }
                  : undefined,
              };

              return {
                data: warmupScheduleStatus,
              };
            },
            RunMissedWarmupNow: async () => {
              warmupScheduleStatus = {
                ...warmupScheduleStatus,
                missedRunToday: false,
                schedule: warmupScheduleStatus.schedule
                  ? {
                      ...warmupScheduleStatus.schedule,
                      lastRunLocalDate: "2026-03-12",
                    }
                  : undefined,
              };

              emitRuntimeEvent("warmup:scheduledResult", {
                trigger: "missed_prompt",
                completedAt: "2026-03-12T10:00:00+08:00",
                result: {
                  items: [
                    {
                      accountId: "acc-active",
                      status: "success",
                      completedAt: "2026-03-12T10:00:00+08:00",
                      availability: {
                        isAvailable: true,
                      },
                    },
                  ],
                  summary: {
                    totalAccounts: 1,
                    eligibleAccounts: 1,
                    successfulAccounts: 1,
                    failedAccounts: 0,
                    skippedAccounts: 0,
                  },
                },
              });

              return {
                data: warmupScheduleStatus,
              };
            },
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
  await expect(page.getByText("当前活跃账号已切换为 Side Project。")).toBeVisible();
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
  await expect(page.getByRole("button", { name: "编辑 New OAuth Account" })).toBeVisible();
  await expect(page.getByText("已将 New OAuth Account 添加到本地账号仓库。")).toBeVisible();

  await page.getByRole("button", { name: "刷新 Work Account 的用量" }).click();
  await expect(
    page.evaluate(
      () => (window as typeof window & { __usageRefreshes: string[] }).__usageRefreshes,
    ),
  ).resolves.toContain("acc-active");
});

test("surfaces scheduled runtime events through localized shell feedback", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Codex Switcher" })).toBeVisible();
  await expect(page.getByText("每日 warm-up 计划")).toBeVisible();

  await page.evaluate(() => {
    (
      window as typeof window & {
        __emitWarmupEvent: (payload: unknown) => void;
      }
    ).__emitWarmupEvent({
      trigger: "scheduled",
      completedAt: "2026-03-12T09:45:00+08:00",
      result: {
        items: [],
        summary: {
          totalAccounts: 1,
          eligibleAccounts: 1,
          successfulAccounts: 1,
          failedAccounts: 0,
          skippedAccounts: 0,
        },
      },
    });
  });

  await expect(page.getByText("已为全部 1 个可用账号发送定时 warm-up 请求。")).toBeVisible();
  await expect(page.getByText("最近一次定时 warm-up")).toBeVisible();
});

test("shows missed-run recovery and keeps shell feedback in sync after run-now", async ({ page }) => {
  await page.goto("/?missedPrompt=1");

  await expect(page.getByRole("dialog", { name: "错过了今日定时 warm-up" })).toBeVisible();
  await page.getByRole("button", { name: "立即补跑" }).click();

  await expect(page.getByRole("dialog", { name: "错过了今日定时 warm-up" })).toHaveCount(0);
  await expect(page.getByText("已为全部 1 个可用账号发送补跑 warm-up 请求。")).toBeVisible();
  await expect(page.getByText("最近一次补跑 warm-up")).toBeVisible();
});

test("applies locale changes and refreshes accounts after slim backup import", async ({ page }) => {
  await page.goto("/");

  await page.getByLabel("语言").selectOption("en-US");
  await page.getByRole("button", { name: "保存偏好设置" }).click();
  await expect(page.getByRole("heading", { name: "Settings" })).toBeVisible();

  await page.getByRole("button", { name: "Import slim text" }).click();
  const dialog = page.getByRole("dialog", { name: "Import slim text" });
  await dialog.getByLabel("Slim backup payload").fill("css1.newpayload");
  await dialog.getByRole("button", { name: "Import slim text" }).click();

  await expect(page.getByText("Imported Account")).toBeVisible();
  await expect(page.getByText("Imported 1 of 1 accounts. Skipped 0.")).toBeVisible();
});

test("retries full backup import with the same path after passphrase is required", async ({ page }) => {
  await page.goto("/");

  await page.getByLabel("语言").selectOption("en-US");
  await page.getByRole("button", { name: "保存偏好设置" }).click();
  await expect(page.getByRole("heading", { name: "Settings" })).toBeVisible();

  await page.getByRole("button", { name: "Import full backup" }).click();
  await expect(
    page.evaluate(
      () =>
        (window as typeof window & {
          __fullImportCalls: Array<{ path: string; passphrase?: string }>;
        }).__fullImportCalls,
    ),
  ).resolves.toEqual([{ path: "/tmp/import.cswf" }]);

  const dialog = page.getByRole("dialog", { name: "Import full backup" });
  await dialog.getByLabel("Passphrase").fill("secret-value");
  await dialog.getByRole("button", { name: "Import full backup" }).click();

  await expect(
    page.evaluate(
      () =>
        (window as typeof window & {
          __fullImportCalls: Array<{ path: string; passphrase?: string }>;
        }).__fullImportCalls,
    ),
  ).resolves.toEqual([
    { path: "/tmp/import.cswf" },
    { path: "/tmp/import.cswf", passphrase: "secret-value" },
  ]);
  await expect(page.getByText("Full Backup Account")).toBeVisible();
});

test("exports a full backup after switching locale to english", async ({ page }) => {
  await page.goto("/");

  await page.getByLabel("语言").selectOption("en-US");
  await page.getByRole("button", { name: "保存偏好设置" }).click();
  await expect(page.getByRole("heading", { name: "Settings" })).toBeVisible();

  await page.getByRole("button", { name: "Export full backup" }).click();
  await expect(page.getByText("Full backup exported successfully.")).toBeVisible();
});
