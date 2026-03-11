import { describe, expect, test, vi } from "vitest";

import { loadProcessStatusViaWails, switchAccountViaWails } from "./bridge";

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
});
