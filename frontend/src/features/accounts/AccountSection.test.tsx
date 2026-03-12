import { I18nextProvider } from "react-i18next";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, test, vi } from "vitest";

import { AccountSection } from "./AccountSection";
import { createAppI18n } from "../../i18n/createAppI18n";
import type {
  AccountUsageSnapshot,
  AccountsSnapshot,
  ProcessStatus,
  SwitchAccountResult,
  UsageCollection,
  WarmupAccountResult,
  WarmupAllResult,
  WarmupScheduleStatus,
} from "../../lib/contracts";
import type { AppServices } from "../../lib/wails/services";

const baseSnapshot: AccountsSnapshot = {
  activeAccountId: "acc-active",
  accounts: [
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
        isAvailable: true,
      },
    },
  ],
};

const idleProcessStatus: ProcessStatus = {
  foregroundCount: 0,
  backgroundCount: 0,
  canSwitch: true,
};

const defaultWarmupScheduleStatus: WarmupScheduleStatus = {
  schedule: {
    enabled: true,
    localTime: "09:00",
    accountIds: ["acc-active", "acc-side"],
  },
  validAccountIds: ["acc-active", "acc-side"],
  missedRunToday: false,
  nextRunLocalIso: "2026-03-12T09:00:00+08:00",
};

function createServices(options?: {
  snapshot?: AccountsSnapshot;
  processStatuses?: ProcessStatus[];
  renameResult?: AccountsSnapshot;
  removeResult?: AccountsSnapshot;
  switchResult?: SwitchAccountResult;
  usageAllResult?: UsageCollection;
  usageById?: Record<string, AccountUsageSnapshot>;
  warmupById?: Record<string, WarmupAccountResult>;
  warmupAllResult?: WarmupAllResult;
  oauthStartResult?: { authUrl: string; callbackPort: number; pending: boolean };
  oauthCompleteResult?: AccountsSnapshot;
}): Pick<AppServices, "accounts" | "process" | "oauth" | "usage" | "warmup"> {
  const snapshot = options?.snapshot ?? baseSnapshot;
  const processStatuses = options?.processStatuses ?? [idleProcessStatus];
  const renameResult =
    options?.renameResult ??
    ({
      ...snapshot,
      accounts: snapshot.accounts.map((account) =>
        account.id === "acc-side" ? { ...account, displayName: "Renamed Account" } : account,
      ),
    } satisfies AccountsSnapshot);
  const removeResult =
    options?.removeResult ??
    ({
      activeAccountId: "acc-active",
      accounts: snapshot.accounts.filter((account) => account.id !== "acc-side"),
    } satisfies AccountsSnapshot);
  const switchResult =
    options?.switchResult ??
    ({
      restartPerformed: false,
      accounts: {
        activeAccountId: "acc-side",
        accounts: snapshot.accounts,
      },
    } satisfies SwitchAccountResult);
  const usageAllResult =
    options?.usageAllResult ??
    ({
      items: [
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
      ],
    } satisfies UsageCollection);
  const usageById = options?.usageById ?? {
    "acc-active": usageAllResult.items[0] as AccountUsageSnapshot,
    "acc-side": usageAllResult.items[1] as AccountUsageSnapshot,
  };
  const warmupById =
    options?.warmupById ??
    ({
      "acc-active": {
        accountId: "acc-active",
        status: "success",
        completedAt: "2026-03-11T12:00:00Z",
        availability: {
          isAvailable: true,
        },
      },
      "acc-side": {
        accountId: "acc-side",
        status: "success",
        completedAt: "2026-03-11T12:00:00Z",
        availability: {
          isAvailable: true,
        },
      },
    } satisfies Record<string, WarmupAccountResult>);
  const warmupAllResult =
    options?.warmupAllResult ??
    ({
      items: Object.values(warmupById),
      summary: {
        totalAccounts: snapshot.accounts.length,
        eligibleAccounts: snapshot.accounts.length,
        successfulAccounts: snapshot.accounts.length,
        failedAccounts: 0,
        skippedAccounts: 0,
      },
    } satisfies WarmupAllResult);
  const oauthStartResult =
    options?.oauthStartResult ?? {
      authUrl: "https://auth.openai.com/oauth/authorize?state=abc",
      callbackPort: 1455,
      pending: true,
    };
  const oauthCompleteResult =
    options?.oauthCompleteResult ??
    ({
      activeAccountId: "acc-new",
      accounts: [
        ...snapshot.accounts,
        {
          id: "acc-new",
          displayName: "New OAuth Account",
          email: "new@example.com",
          authKind: "chatgpt",
          createdAt: "2026-03-11T10:00:00Z",
          updatedAt: "2026-03-11T10:00:00Z",
          warmupAvailability: {
            isAvailable: true,
          },
        },
      ],
    } satisfies AccountsSnapshot);

  return {
    accounts: {
      load: vi.fn().mockResolvedValue(snapshot),
      rename: vi.fn().mockResolvedValue(renameResult),
      remove: vi.fn().mockResolvedValue(removeResult),
      switch: vi.fn().mockResolvedValue(switchResult),
    },
    process: {
      getStatus: vi.fn(async () => {
        if (processStatuses.length > 1) {
          return processStatuses.shift() as ProcessStatus;
        }
        return processStatuses[0] as ProcessStatus;
      }),
    },
    oauth: {
      start: vi.fn().mockResolvedValue(oauthStartResult),
      complete: vi.fn().mockResolvedValue(oauthCompleteResult),
      cancel: vi.fn().mockResolvedValue({ pending: false }),
    },
    usage: {
      get: vi.fn(async (accountId: string) => usageById[accountId]),
      refreshAll: vi.fn().mockResolvedValue(usageAllResult),
    },
    warmup: {
      run: vi.fn(async (accountId: string) => warmupById[accountId]),
      runAll: vi.fn().mockResolvedValue(warmupAllResult),
      loadScheduleStatus: vi.fn().mockResolvedValue(defaultWarmupScheduleStatus),
      saveSchedule: vi.fn().mockResolvedValue(defaultWarmupScheduleStatus),
    },
  };
}

async function renderAccountSection(
  services: Pick<AppServices, "accounts" | "process" | "oauth" | "usage" | "warmup">,
  options?: {
    useFakeTimers?: boolean;
  },
) {
  const i18n = await createAppI18n("en-US");

  render(
    <I18nextProvider i18n={i18n}>
      <AccountSection services={services} />
    </I18nextProvider>,
  );

  return {
    user: userEvent.setup(
      options?.useFakeTimers ? { advanceTimers: vi.advanceTimersByTime } : undefined,
    ),
  };
}

describe("AccountSection", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  test("warms a single account with local loading and writes back latest result", async () => {
    const warmupControl: {
      resolve?: (value: WarmupAccountResult) => void;
    } = {};
    const services = createServices();
    services.warmup.run = vi.fn(
      () =>
        new Promise<WarmupAccountResult>((resolve) => {
          warmupControl.resolve = resolve;
        }),
    );

    const { user } = await renderAccountSection(services);

    await screen.findByText("Work Account");
    await user.click(screen.getByRole("button", { name: "Warm up Side Project" }));

    expect(services.warmup.run).toHaveBeenCalledWith("acc-side");
    expect(screen.getByRole("button", { name: "Warm up Side Project" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Warm up all eligible accounts" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "Warm up Work Account" })).toBeEnabled();

    if (!warmupControl.resolve) {
      throw new Error("Warmup resolver was not captured");
    }

    warmupControl.resolve({
      accountId: "acc-side",
      status: "success",
      completedAt: "2026-03-11T12:05:00Z",
      availability: {
        isAvailable: true,
      },
    });

    expect(await screen.findByText("Warm-up sent for Side Project.")).toBeInTheDocument();
    expect(await screen.findByText("The latest manual warm-up completed successfully.")).toBeInTheDocument();
  });

  test("shows disabled reason when manual warmup is unavailable", async () => {
    const services = createServices({
      snapshot: {
        ...baseSnapshot,
        accounts: baseSnapshot.accounts.map((account) =>
          account.id === "acc-side"
            ? {
                ...account,
                warmupAvailability: {
                  isAvailable: false,
                  reasonCode: "warmup.credentials_missing",
                },
              }
            : account,
        ),
      },
    });

    await renderAccountSection(services);

    await screen.findByText("Side Project");
    expect(screen.getByRole("button", { name: "Warm up Side Project" })).toBeDisabled();
    expect(
      screen.getByText("This account does not have usable credentials for manual warm-up."),
    ).toBeInTheDocument();
  });

  test("warms all eligible accounts and writes back mixed results", async () => {
    const services = createServices({
      warmupAllResult: {
        items: [
          {
            accountId: "acc-active",
            status: "success",
            completedAt: "2026-03-11T12:10:00Z",
            availability: {
              isAvailable: true,
            },
          },
          {
            accountId: "acc-side",
            status: "failed",
            completedAt: "2026-03-11T12:10:00Z",
            availability: {
              isAvailable: true,
            },
            failureCode: "warmup.request_failed",
          },
        ],
        summary: {
          totalAccounts: 2,
          eligibleAccounts: 2,
          successfulAccounts: 1,
          failedAccounts: 1,
          skippedAccounts: 0,
        },
      },
    });
    const { user } = await renderAccountSection(services);

    await screen.findByText("Work Account");
    await user.click(screen.getByRole("button", { name: "Warm up all eligible accounts" }));

    await waitFor(() => {
      expect(services.warmup.runAll).toHaveBeenCalledTimes(1);
    });
    expect(
      await screen.findByText("Warmed 1 of 2 eligible accounts. 1 failed, 0 unavailable."),
    ).toBeInTheDocument();
    expect(
      await screen.findByText("The warm-up request did not complete successfully."),
    ).toBeInTheDocument();
  });

  test("renders active and inactive accounts with process visibility", async () => {
    const services = createServices({
      processStatuses: [
        {
          foregroundCount: 1,
          backgroundCount: 2,
          canSwitch: false,
        },
      ],
    });

    await renderAccountSection(services);

    expect(await screen.findByText("Active account")).toBeInTheDocument();
    expect(screen.getByText("Other accounts")).toBeInTheDocument();
    expect(screen.getByText("Work Account")).toBeInTheDocument();
    expect(screen.getByText("Side Project")).toBeInTheDocument();
    expect(screen.getByText("Restart required")).toBeInTheDocument();
    expect(screen.getByText("1 foreground · 2 background")).toBeInTheDocument();
    expect(await screen.findByText("5h")).toBeInTheDocument();
    expect(await screen.findByText("Weekly")).toBeInTheDocument();
  });

  test("supports inline rename and submits on Enter", async () => {
    const services = createServices();
    const { user } = await renderAccountSection(services);

    await screen.findByText("Side Project");
    await user.click(screen.getByRole("button", { name: "Edit Side Project" }));

    const input = screen.getByRole("textbox", { name: "Account name" });
    await user.clear(input);
    await user.type(input, "Renamed Account{enter}");

    await waitFor(() => {
      expect(services.accounts.rename).toHaveBeenCalledWith({
        id: "acc-side",
        displayName: "Renamed Account",
      });
    });
    expect(await screen.findByText("Renamed Account")).toBeInTheDocument();
  });

  test("requires a second delete click and resets after timeout", async () => {
    const services = createServices();
    await renderAccountSection(services);

    await screen.findByText("Side Project");
    vi.useFakeTimers();
    const deleteButton = screen.getByRole("button", { name: "Delete Side Project" });

    await act(async () => {
      fireEvent.click(deleteButton);
    });
    expect(services.accounts.remove).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "Confirm delete Side Project" })).toBeInTheDocument();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(3_000);
    });

    expect(screen.getByRole("button", { name: "Delete Side Project" })).toBeInTheDocument();

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Delete Side Project" }));
    });
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Confirm delete Side Project" }));
    });

    expect(services.accounts.remove).toHaveBeenCalledWith("acc-side");
  });

  test("blocks switching behind confirmation when process status is active", async () => {
    const services = createServices({
      processStatuses: [
        idleProcessStatus,
        {
          foregroundCount: 1,
          backgroundCount: 0,
          canSwitch: false,
        },
        {
          foregroundCount: 1,
          backgroundCount: 0,
          canSwitch: false,
        },
        idleProcessStatus,
      ],
      switchResult: {
        restartPerformed: true,
        accounts: {
          ...baseSnapshot,
          activeAccountId: "acc-side",
        },
      },
    });
    const { user } = await renderAccountSection(services);

    await screen.findByText("Side Project");
    await user.click(screen.getByRole("button", { name: "Switch to Side Project" }));

    expect(await screen.findByRole("dialog", { name: "Restart Codex before switching?" })).toBeInTheDocument();
    expect(services.accounts.switch).not.toHaveBeenCalled();

    await user.click(screen.getByRole("button", { name: "Cancel switch" }));
    expect(screen.queryByRole("dialog", { name: "Restart Codex before switching?" })).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Switch to Side Project" }));
    await user.click(await screen.findByRole("button", { name: "Restart and switch" }));

    await waitFor(() => {
      expect(services.accounts.switch).toHaveBeenCalledWith({
        accountId: "acc-side",
        confirmRestart: true,
      });
    });
  });

  test("switches directly when no process restart is required", async () => {
    const services = createServices({
      processStatuses: [idleProcessStatus, idleProcessStatus, idleProcessStatus],
    });
    const { user } = await renderAccountSection(services);

    await screen.findByText("Side Project");
    await user.click(screen.getByRole("button", { name: "Switch to Side Project" }));

    await waitFor(() => {
      expect(services.accounts.switch).toHaveBeenCalledWith({
        accountId: "acc-side",
        confirmRestart: false,
      });
    });
    expect(screen.queryByRole("dialog", { name: "Restart Codex before switching?" })).not.toBeInTheDocument();
  });

  test("applies per-account and global masking without persisting state", async () => {
    const services = createServices();
    const { user } = await renderAccountSection(services);

    await screen.findByText("Work Account");
    await user.click(screen.getByRole("button", { name: "Hide Side Project" }));

    expect(screen.queryByText("Side Project")).not.toBeInTheDocument();
    expect(screen.getAllByText("••••••••")).toHaveLength(2);

    await user.click(screen.getByRole("button", { name: "Hide all accounts" }));
    expect(screen.queryByText("Work Account")).not.toBeInTheDocument();
    expect(screen.getAllByText("••••••••")).toHaveLength(4);
  });

  test("opens an oauth-only add-account modal and cancels a pending login", async () => {
    const services = createServices();
    const { user } = await renderAccountSection(services);

    await screen.findByText("Work Account");
    await user.click(screen.getByRole("button", { name: "Add account" }));

    expect(await screen.findByRole("dialog", { name: "Add account" })).toBeInTheDocument();
    expect(screen.queryByText("Import File")).not.toBeInTheDocument();

    await user.type(screen.getByRole("textbox", { name: "New account name" }), "New OAuth Account");
    await user.click(screen.getByRole("button", { name: "Start browser login" }));

    await waitFor(() => {
      expect(services.oauth.start).toHaveBeenCalledWith({
        accountName: "New OAuth Account",
      });
    });

    expect(await screen.findByRole("button", { name: "Open browser again" })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Cancel login" }));

    await waitFor(() => {
      expect(services.oauth.cancel).toHaveBeenCalledTimes(1);
    });
  });

  test("completes oauth login and refreshes accounts process and usage", async () => {
    const services = createServices();
    const { user } = await renderAccountSection(services);

    await screen.findByText("Work Account");
    await user.click(screen.getByRole("button", { name: "Add account" }));
    await user.type(screen.getByRole("textbox", { name: "New account name" }), "New OAuth Account");
    await user.click(screen.getByRole("button", { name: "Start browser login" }));
    await user.click(await screen.findByRole("button", { name: "Complete login" }));

    await waitFor(() => {
      expect(services.oauth.complete).toHaveBeenCalledTimes(1);
    });
    await waitFor(() => {
      expect(services.usage.refreshAll).toHaveBeenCalledTimes(2);
    });
    expect(await screen.findByText("New OAuth Account")).toBeInTheDocument();
  });

  test("refreshes usage for a single account without triggering bulk refresh", async () => {
    const services = createServices();
    const { user } = await renderAccountSection(services);

    await screen.findByText("Work Account");
    expect(services.usage.refreshAll).toHaveBeenCalledTimes(1);

    await user.click(screen.getByRole("button", { name: "Refresh usage for Work Account" }));

    await waitFor(() => {
      expect(services.usage.get).toHaveBeenCalledWith("acc-active");
    });
    expect(services.usage.refreshAll).toHaveBeenCalledTimes(1);
  });
});
