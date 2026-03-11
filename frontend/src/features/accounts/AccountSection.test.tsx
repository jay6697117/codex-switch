import { I18nextProvider } from "react-i18next";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, test, vi } from "vitest";

import { AccountSection } from "./AccountSection";
import { createAppI18n } from "../../i18n/createAppI18n";
import type {
  AccountsSnapshot,
  ProcessStatus,
  SwitchAccountResult,
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
    },
    {
      id: "acc-side",
      displayName: "Side Project",
      email: "side@example.com",
      authKind: "apiKey",
      createdAt: "2026-03-11T08:00:00Z",
      updatedAt: "2026-03-11T08:00:00Z",
    },
  ],
};

const idleProcessStatus: ProcessStatus = {
  foregroundCount: 0,
  backgroundCount: 0,
  canSwitch: true,
};

function createServices(options?: {
  snapshot?: AccountsSnapshot;
  processStatuses?: ProcessStatus[];
  renameResult?: AccountsSnapshot;
  removeResult?: AccountsSnapshot;
  switchResult?: SwitchAccountResult;
}): Pick<AppServices, "accounts" | "process"> {
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
  };
}

async function renderAccountSection(
  services: Pick<AppServices, "accounts" | "process">,
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
});
