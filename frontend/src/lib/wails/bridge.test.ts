import { describe, expect, test, vi } from "vitest";

import {
  cancelOAuthLoginViaWails,
  completeOAuthLoginViaWails,
  dismissMissedRunTodayViaWails,
  exportFullBackupViaWails,
  exportSlimTextViaWails,
  getAccountUsageViaWails,
  importFullBackupViaWails,
  importSlimTextViaWails,
  loadSettingsViaWails,
  loadWarmupScheduleStatusViaWails,
  loadAccountsViaWails,
  loadProcessStatusViaWails,
  refreshAllUsageViaWails,
  runMissedWarmupNowViaWails,
  saveWarmupScheduleViaWails,
  saveSettingsViaWails,
  selectFullExportPathViaWails,
  selectFullImportPathViaWails,
  startOAuthLoginViaWails,
  switchAccountViaWails,
  warmupAccountViaWails,
  warmupAllAccountsViaWails,
} from "./bridge";

describe("wails bridge", () => {
  test("unwraps process status envelopes", async () => {
    window.go = {
      main: {
        App: {
          GetProcessStatus: vi.fn().mockResolvedValue({
            data: {
              foregroundCount: 1,
              backgroundCount: 2,
              canSwitch: false,
            },
          }),
        },
      },
    };

    await expect(loadProcessStatusViaWails()).resolves.toEqual({
      foregroundCount: 1,
      backgroundCount: 2,
      canSwitch: false,
    });
  });

  test("throws structured errors for switch failures", async () => {
    window.go = {
      main: {
        App: {
          SwitchAccount: vi.fn().mockResolvedValue({
            error: {
              code: "switch.confirmation_required",
              args: {
                foregroundCount: "1",
              },
            },
          }),
        },
      },
    };

    await expect(
      switchAccountViaWails({
        accountId: "acct-2",
        confirmRestart: false,
      }),
    ).rejects.toEqual({
      code: "switch.confirmation_required",
      args: {
        foregroundCount: "1",
      },
    });
  });

  test("preserves success messages for switch envelopes", async () => {
    window.go = {
      main: {
        App: {
          SwitchAccount: vi.fn().mockResolvedValue({
            data: {
              restartPerformed: false,
              accounts: {
                activeAccountId: "acct-2",
                accounts: [
                  {
                    id: "acct-2",
                    displayName: "Side Project",
                    authKind: "chatgpt",
                    createdAt: "2026-03-11T00:00:00Z",
                    updatedAt: "2026-03-11T00:00:00Z",
                    warmupAvailability: {
                      isAvailable: true,
                    },
                  },
                ],
              },
            },
            message: {
              code: "accounts.switch_success",
              args: {
                name: "Side Project",
              },
            },
          }),
        },
      },
    };

    await expect(
      switchAccountViaWails({
        accountId: "acct-2",
        confirmRestart: false,
      }),
    ).resolves.toEqual({
      data: {
        restartPerformed: false,
        accounts: {
          activeAccountId: "acct-2",
          accounts: [
            {
              id: "acct-2",
              displayName: "Side Project",
              authKind: "chatgpt",
              createdAt: "2026-03-11T00:00:00Z",
              updatedAt: "2026-03-11T00:00:00Z",
              warmupAvailability: {
                isAvailable: true,
              },
            },
          ],
        },
      },
      message: {
        code: "accounts.switch_success",
        args: {
          name: "Side Project",
        },
      },
    });
  });

  test("unwraps oauth start envelopes", async () => {
    window.go = {
      main: {
        App: {
          StartOAuthLogin: vi.fn().mockResolvedValue({
            data: {
              authUrl: "https://auth.openai.com/oauth/authorize?state=abc",
              callbackPort: 1455,
              pending: true,
            },
          }),
        },
      },
    };

    await expect(
      startOAuthLoginViaWails({
        accountName: "Work Account",
      }),
    ).resolves.toEqual({
      authUrl: "https://auth.openai.com/oauth/authorize?state=abc",
      callbackPort: 1455,
      pending: true,
    });
  });

  test("unwraps oauth completion envelopes", async () => {
    window.go = {
      main: {
        App: {
          CompleteOAuthLogin: vi.fn().mockResolvedValue({
            data: {
              activeAccountId: "acct-new",
              accounts: [
                {
                  id: "acct-new",
                  displayName: "Work Account",
                  authKind: "chatgpt",
                  createdAt: "2026-03-11T00:00:00Z",
                  updatedAt: "2026-03-11T00:00:00Z",
                },
              ],
            },
            message: {
              code: "auth.account_added",
              args: {
                name: "Work Account",
              },
            },
          }),
        },
      },
    };

    await expect(completeOAuthLoginViaWails()).resolves.toEqual({
      data: {
        activeAccountId: "acct-new",
        accounts: [
          {
            id: "acct-new",
            displayName: "Work Account",
            authKind: "chatgpt",
            createdAt: "2026-03-11T00:00:00Z",
            updatedAt: "2026-03-11T00:00:00Z",
          },
        ],
      },
      message: {
        code: "auth.account_added",
        args: {
          name: "Work Account",
        },
      },
    });
  });

  test("unwraps oauth cancel envelopes", async () => {
    window.go = {
      main: {
        App: {
          CancelOAuthLogin: vi.fn().mockResolvedValue({
            data: {
              pending: false,
            },
          }),
        },
      },
    };

    await expect(cancelOAuthLoginViaWails()).resolves.toEqual({
      pending: false,
    });
  });

  test("unwraps account snapshots with warmup availability", async () => {
    window.go = {
      main: {
        App: {
          LoadAccounts: vi.fn().mockResolvedValue({
            data: {
              activeAccountId: "acct-1",
              accounts: [
                {
                  id: "acct-1",
                  displayName: "Work Account",
                  authKind: "chatgpt",
                  createdAt: "2026-03-11T00:00:00Z",
                  updatedAt: "2026-03-11T00:00:00Z",
                  warmupAvailability: {
                    isAvailable: true,
                  },
                },
                {
                  id: "acct-2",
                  displayName: "API Account",
                  authKind: "apiKey",
                  createdAt: "2026-03-11T00:00:00Z",
                  updatedAt: "2026-03-11T00:00:00Z",
                  warmupAvailability: {
                    isAvailable: false,
                    reasonCode: "warmup.credentials_missing",
                  },
                },
              ],
            },
          }),
        },
      },
    };

    await expect(loadAccountsViaWails()).resolves.toEqual({
      activeAccountId: "acct-1",
      accounts: [
        {
          id: "acct-1",
          displayName: "Work Account",
          authKind: "chatgpt",
          createdAt: "2026-03-11T00:00:00Z",
          updatedAt: "2026-03-11T00:00:00Z",
          warmupAvailability: {
            isAvailable: true,
          },
        },
        {
          id: "acct-2",
          displayName: "API Account",
          authKind: "apiKey",
          createdAt: "2026-03-11T00:00:00Z",
          updatedAt: "2026-03-11T00:00:00Z",
          warmupAvailability: {
            isAvailable: false,
            reasonCode: "warmup.credentials_missing",
          },
        },
      ],
    });
  });

  test("unwraps single-account usage envelopes", async () => {
    window.go = {
      main: {
        App: {
          GetAccountUsage: vi.fn().mockResolvedValue({
            data: {
              accountId: "acct-1",
              status: "supported",
              planType: "team",
              refreshedAt: "2026-03-11T20:00:00Z",
              fiveHour: {
                usedPercent: 21,
                windowMinutes: 300,
              },
            },
          }),
        },
      },
    };

    await expect(getAccountUsageViaWails("acct-1")).resolves.toEqual({
      accountId: "acct-1",
      status: "supported",
      planType: "team",
      refreshedAt: "2026-03-11T20:00:00Z",
      fiveHour: {
        usedPercent: 21,
        windowMinutes: 300,
      },
    });
  });

  test("unwraps bulk usage envelopes", async () => {
    window.go = {
      main: {
        App: {
          RefreshAllUsage: vi.fn().mockResolvedValue({
            data: {
              items: [
                {
                  accountId: "acct-1",
                  status: "supported",
                  refreshedAt: "2026-03-11T20:00:00Z",
                },
                {
                  accountId: "acct-2",
                  status: "unsupported",
                  reasonCode: "usage.unsupported_api_key",
                  refreshedAt: "2026-03-11T20:00:00Z",
                },
              ],
            },
          }),
        },
      },
    };

    await expect(refreshAllUsageViaWails()).resolves.toEqual({
      items: [
        {
          accountId: "acct-1",
          status: "supported",
          refreshedAt: "2026-03-11T20:00:00Z",
        },
        {
          accountId: "acct-2",
          status: "unsupported",
          reasonCode: "usage.unsupported_api_key",
          refreshedAt: "2026-03-11T20:00:00Z",
        },
      ],
    });
  });

  test("unwraps settings envelopes", async () => {
    window.go = {
      main: {
        App: {
          LoadSettings: vi.fn().mockResolvedValue({
            data: {
              localePreference: "system",
              effectiveLocale: "en-US",
              backupSecurityMode: "keychain",
            },
          }),
          SaveSettings: vi.fn().mockResolvedValue({
            data: {
              localePreference: "zh-CN",
              effectiveLocale: "zh-CN",
              backupSecurityMode: "passphrase",
            },
          }),
        },
      },
    };

    await expect(loadSettingsViaWails()).resolves.toEqual({
      localePreference: "system",
      effectiveLocale: "en-US",
      backupSecurityMode: "keychain",
    });

    await expect(
      saveSettingsViaWails({
        localePreference: "zh-CN",
        backupSecurityMode: "passphrase",
      }),
    ).resolves.toEqual({
      localePreference: "zh-CN",
      effectiveLocale: "zh-CN",
      backupSecurityMode: "passphrase",
    });
  });

  test("unwraps backup path selection and export flows", async () => {
    window.go = {
      main: {
        App: {
          ExportSlimText: vi.fn().mockResolvedValue({
            data: "css1.payload",
          }),
          SelectFullExportPath: vi.fn().mockResolvedValue({
            data: {
              selected: true,
              path: "/tmp/export.cswf",
            },
          }),
          ExportFullBackup: vi.fn().mockResolvedValue({
            data: true,
          }),
        },
      },
    };

    await expect(exportSlimTextViaWails()).resolves.toBe("css1.payload");
    await expect(selectFullExportPathViaWails()).resolves.toEqual({
      selected: true,
      path: "/tmp/export.cswf",
    });
    await expect(
      exportFullBackupViaWails({
        path: "/tmp/export.cswf",
        passphrase: "secret",
      }),
    ).resolves.toBe(true);
  });

  test("passes structured backup import errors through unchanged", async () => {
    window.go = {
      main: {
        App: {
          SelectFullImportPath: vi.fn().mockResolvedValue({
            data: {
              selected: true,
              path: "/tmp/import.cswf",
            },
          }),
          ImportFullBackup: vi.fn().mockResolvedValue({
            error: {
              code: "backup.passphrase_required",
            },
          }),
          ImportSlimText: vi.fn().mockResolvedValue({
            error: {
              code: "backup.keychain_unavailable",
            },
          }),
        },
      },
    };

    await expect(selectFullImportPathViaWails()).resolves.toEqual({
      selected: true,
      path: "/tmp/import.cswf",
    });

    await expect(
      importFullBackupViaWails({
        path: "/tmp/import.cswf",
      }),
    ).rejects.toEqual({
      code: "backup.passphrase_required",
    });

    await expect(importSlimTextViaWails("css1.payload")).rejects.toEqual({
      code: "backup.keychain_unavailable",
    });
  });

  test("unwraps single-account warmup envelopes", async () => {
    window.go = {
      main: {
        App: {
          WarmupAccount: vi.fn().mockResolvedValue({
            data: {
              accountId: "acct-1",
              status: "success",
              completedAt: "2026-03-11T20:00:00Z",
              availability: {
                isAvailable: true,
              },
            },
          }),
        },
      },
    };

    await expect(warmupAccountViaWails("acct-1")).resolves.toEqual({
      accountId: "acct-1",
      status: "success",
      completedAt: "2026-03-11T20:00:00Z",
      availability: {
        isAvailable: true,
      },
    });
  });

  test("unwraps bulk warmup envelopes", async () => {
    window.go = {
      main: {
        App: {
          WarmupAllAccounts: vi.fn().mockResolvedValue({
            data: {
              items: [
                {
                  accountId: "acct-1",
                  status: "success",
                  completedAt: "2026-03-11T20:00:00Z",
                  availability: {
                    isAvailable: true,
                  },
                },
                {
                  accountId: "acct-2",
                  status: "skipped",
                  completedAt: "2026-03-11T20:00:00Z",
                  availability: {
                    isAvailable: false,
                    reasonCode: "warmup.unsupported_auth_kind",
                  },
                },
              ],
              summary: {
                totalAccounts: 2,
                eligibleAccounts: 1,
                successfulAccounts: 1,
                failedAccounts: 0,
                skippedAccounts: 1,
              },
            },
          }),
        },
      },
    };

    await expect(warmupAllAccountsViaWails()).resolves.toEqual({
      items: [
        {
          accountId: "acct-1",
          status: "success",
          completedAt: "2026-03-11T20:00:00Z",
          availability: {
            isAvailable: true,
          },
        },
        {
          accountId: "acct-2",
          status: "skipped",
          completedAt: "2026-03-11T20:00:00Z",
          availability: {
            isAvailable: false,
            reasonCode: "warmup.unsupported_auth_kind",
          },
        },
      ],
      summary: {
        totalAccounts: 2,
        eligibleAccounts: 1,
        successfulAccounts: 1,
        failedAccounts: 0,
        skippedAccounts: 1,
      },
    });
  });

  test("unwraps warmup schedule status envelopes", async () => {
    window.go = {
      main: {
        App: {
          LoadWarmupScheduleStatus: vi.fn().mockResolvedValue({
            data: {
              schedule: {
                enabled: true,
                localTime: "09:15",
                accountIds: ["acct-1", "acct-2"],
              },
              validAccountIds: ["acct-1", "acct-2"],
              missedRunToday: false,
              nextRunLocalIso: "2026-03-12T09:15:00+08:00",
            },
          }),
        },
      },
    };

    await expect(loadWarmupScheduleStatusViaWails()).resolves.toEqual({
      schedule: {
        enabled: true,
        localTime: "09:15",
        accountIds: ["acct-1", "acct-2"],
      },
      validAccountIds: ["acct-1", "acct-2"],
      missedRunToday: false,
      nextRunLocalIso: "2026-03-12T09:15:00+08:00",
    });
  });

  test("unwraps warmup schedule save envelopes", async () => {
    window.go = {
      main: {
        App: {
          SaveWarmupSchedule: vi.fn().mockResolvedValue({
            data: {
              schedule: {
                enabled: true,
                localTime: "10:00",
                accountIds: ["acct-1"],
              },
              validAccountIds: ["acct-1"],
              missedRunToday: false,
              nextRunLocalIso: "2026-03-12T10:00:00+08:00",
            },
          }),
        },
      },
    };

    await expect(
      saveWarmupScheduleViaWails({
        enabled: true,
        localTime: "10:00",
        accountIds: ["acct-1"],
      }),
    ).resolves.toEqual({
      schedule: {
        enabled: true,
        localTime: "10:00",
        accountIds: ["acct-1"],
      },
      validAccountIds: ["acct-1"],
      missedRunToday: false,
      nextRunLocalIso: "2026-03-12T10:00:00+08:00",
    });
  });

  test("unwraps missed-run dismiss envelopes", async () => {
    window.go = {
      main: {
        App: {
          DismissMissedRunToday: vi.fn().mockResolvedValue({
            data: {
              schedule: {
                enabled: true,
                localTime: "10:00",
                accountIds: ["acct-1"],
              },
              validAccountIds: ["acct-1"],
              missedRunToday: false,
              nextRunLocalIso: "2026-03-13T10:00:00+08:00",
            },
          }),
        },
      },
    };

    await expect(dismissMissedRunTodayViaWails()).resolves.toEqual({
      schedule: {
        enabled: true,
        localTime: "10:00",
        accountIds: ["acct-1"],
      },
      validAccountIds: ["acct-1"],
      missedRunToday: false,
      nextRunLocalIso: "2026-03-13T10:00:00+08:00",
    });
  });

  test("unwraps missed-run run-now envelopes", async () => {
    window.go = {
      main: {
        App: {
          RunMissedWarmupNow: vi.fn().mockResolvedValue({
            data: {
              schedule: {
                enabled: true,
                localTime: "10:00",
                accountIds: ["acct-1"],
                lastRunLocalDate: "2026-03-12",
              },
              validAccountIds: ["acct-1"],
              missedRunToday: false,
              nextRunLocalIso: "2026-03-13T10:00:00+08:00",
            },
          }),
        },
      },
    };

    await expect(runMissedWarmupNowViaWails()).resolves.toEqual({
      schedule: {
        enabled: true,
        localTime: "10:00",
        accountIds: ["acct-1"],
        lastRunLocalDate: "2026-03-12",
      },
      validAccountIds: ["acct-1"],
      missedRunToday: false,
      nextRunLocalIso: "2026-03-13T10:00:00+08:00",
    });
  });
});
