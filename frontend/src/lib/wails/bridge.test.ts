import { describe, expect, test, vi } from "vitest";

import {
  cancelOAuthLoginViaWails,
  completeOAuthLoginViaWails,
  getAccountUsageViaWails,
  loadProcessStatusViaWails,
  refreshAllUsageViaWails,
  startOAuthLoginViaWails,
  switchAccountViaWails,
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
          }),
        },
      },
    };

    await expect(completeOAuthLoginViaWails()).resolves.toEqual({
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
});
