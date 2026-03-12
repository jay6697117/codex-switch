import { act, render, screen, waitFor, within } from "@testing-library/react";
import { I18nextProvider } from "react-i18next";
import userEvent from "@testing-library/user-event";
import { describe, expect, test, vi } from "vitest";

import type {
  AccountSummary,
  WarmupScheduleInput,
  WarmupScheduleStatus,
} from "../../lib/contracts";
import type { AppServices } from "../../lib/wails/services";
import { createAppI18n } from "../../i18n/createAppI18n";
import { WarmupSection } from "./WarmupSection";

const accountFixtures: AccountSummary[] = [
  {
    id: "acct-work",
    displayName: "Work Account",
    email: "work@example.com",
    authKind: "chatgpt",
    createdAt: "2026-03-11T08:00:00Z",
    updatedAt: "2026-03-11T08:00:00Z",
    warmupAvailability: {
      isAvailable: true,
    },
  },
  {
    id: "acct-side",
    displayName: "Side Project",
    email: "side@example.com",
    authKind: "apiKey",
    createdAt: "2026-03-11T09:00:00Z",
    updatedAt: "2026-03-11T09:00:00Z",
    warmupAvailability: {
      isAvailable: true,
    },
  },
];

function buildStatus(
  overrides?: Partial<WarmupScheduleStatus>,
): WarmupScheduleStatus {
  return {
    schedule: {
      enabled: true,
      localTime: "07:45",
      accountIds: ["acct-work", "acct-side"],
    },
    validAccountIds: ["acct-work", "acct-side"],
    missedRunToday: false,
    nextRunLocalIso: "2026-03-12T07:45:00+08:00",
    ...overrides,
  };
}

function buildWarmupService(
  status: WarmupScheduleStatus = buildStatus(),
): Pick<
  AppServices,
  "warmup"
>["warmup"] {
  return {
    run: vi.fn(),
    runAll: vi.fn(),
    loadScheduleStatus: vi.fn().mockResolvedValue(status),
    saveSchedule: vi.fn(async (input: WarmupScheduleInput) =>
      buildStatus({
        schedule: {
          enabled: input.enabled,
          localTime: input.localTime,
          accountIds: input.accountIds,
        },
        validAccountIds: input.accountIds,
        nextRunLocalIso: `2026-03-12T${input.localTime}:00+08:00`,
      }),
    ),
    dismissMissedRunToday: vi.fn().mockResolvedValue({
      ...status,
      missedRunToday: false,
    }),
    runMissedWarmupNow: vi.fn().mockResolvedValue({
      ...status,
      missedRunToday: false,
      schedule: status.schedule
        ? {
            ...status.schedule,
            lastRunLocalDate: "2026-03-12",
          }
        : undefined,
    }),
  };
}

async function renderWarmupSection(
  service: Pick<AppServices, "warmup">["warmup"] = buildWarmupService(),
) {
  const i18n = await createAppI18n();
  await i18n.changeLanguage("en-US");

  await act(async () => {
    render(
      <I18nextProvider i18n={i18n}>
        <WarmupSection accounts={accountFixtures} services={{ warmup: service }} />
      </I18nextProvider>,
    );
  });

  return {
    service,
    user: userEvent.setup(),
  };
}

describe("WarmupSection", () => {
  test("renders the saved schedule summary from the typed facade", async () => {
    await renderWarmupSection();

    expect(await screen.findByText("Daily warm-up schedule")).toBeInTheDocument();

    const summary = await screen.findByLabelText("warmup schedule summary");
    expect(within(summary).getByText("07:45")).toBeInTheDocument();
    expect(within(summary).getByText("2")).toBeInTheDocument();
    expect(within(summary).getByText("2026-03-12 07:45")).toBeInTheDocument();
  });

  test("shows inline validation and select-all controls inside the schedule dialog", async () => {
    const { service, user } = await renderWarmupSection();

    await user.click(await screen.findByRole("button", { name: "Configure schedule" }));
    await user.click(screen.getByRole("button", { name: "Clear All" }));
    await user.click(screen.getByRole("button", { name: "Save schedule" }));

    expect(await screen.findByText("Select at least one account for the daily schedule.")).toBeInTheDocument();
    expect(service.saveSchedule).not.toHaveBeenCalled();

    await user.click(screen.getByRole("button", { name: "Select All" }));
    expect(screen.getByRole("checkbox", { name: "Work Account" })).toBeChecked();
    expect(screen.getByRole("checkbox", { name: "Side Project" })).toBeChecked();
  });

  test("saves the edited schedule and refreshes the summary", async () => {
    const { service, user } = await renderWarmupSection();

    await user.click(await screen.findByRole("button", { name: "Configure schedule" }));
    await user.clear(screen.getByLabelText("Local time"));
    await user.type(screen.getByLabelText("Local time"), "08:30");
    await user.click(screen.getByRole("checkbox", { name: "Side Project" }));
    await user.click(screen.getByRole("button", { name: "Save schedule" }));

    expect(service.saveSchedule).toHaveBeenCalledWith({
      enabled: true,
      localTime: "08:30",
      accountIds: ["acct-work"],
    });

    const summary = await screen.findByLabelText("warmup schedule summary");
    expect(within(summary).getByText("08:30")).toBeInTheDocument();
    expect(within(summary).getByText("1")).toBeInTheDocument();
    expect(within(summary).getByText("2026-03-12 08:30")).toBeInTheDocument();
    expect(screen.queryByRole("dialog", { name: "Configure daily warm-up" })).not.toBeInTheDocument();
  });

  test("shows the missed-run prompt and dismisses it for today through the typed facade", async () => {
    const status = buildStatus({
      missedRunToday: true,
    });
    const service = buildWarmupService(status);
    const { user } = await renderWarmupSection(service);

    expect(await screen.findByRole("dialog", { name: "Missed scheduled warm-up" })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Skip Today" }));

    expect(service.dismissMissedRunToday).toHaveBeenCalledTimes(1);
    await waitFor(() => {
      expect(screen.queryByRole("dialog", { name: "Missed scheduled warm-up" })).not.toBeInTheDocument();
    });
  });

  test("runs the missed warm-up now through the typed facade", async () => {
    const status = buildStatus({
      missedRunToday: true,
    });
    const service = buildWarmupService(status);
    const { user } = await renderWarmupSection(service);

    expect(await screen.findByRole("dialog", { name: "Missed scheduled warm-up" })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Run Warmup Now" }));

    expect(service.runMissedWarmupNow).toHaveBeenCalledTimes(1);
    await waitFor(() => {
      expect(screen.queryByRole("dialog", { name: "Missed scheduled warm-up" })).not.toBeInTheDocument();
    });
  });

  test("shows the prompt again when a later load reports another missed day", async () => {
    const initialStatus = buildStatus({
      missedRunToday: true,
    });
    const firstService = buildWarmupService(initialStatus);
    const firstRender = await renderWarmupSection(firstService);

    expect(await screen.findByRole("dialog", { name: "Missed scheduled warm-up" })).toBeInTheDocument();
    await firstRender.user.click(screen.getByRole("button", { name: "Skip Today" }));

    await waitFor(() => {
      expect(screen.queryByRole("dialog", { name: "Missed scheduled warm-up" })).not.toBeInTheDocument();
    });

    const laterService = buildWarmupService(
      buildStatus({
        missedRunToday: true,
        schedule: {
          enabled: true,
          localTime: "07:45",
          accountIds: ["acct-work", "acct-side"],
          lastMissedPromptLocalDate: "2026-03-12",
        },
      }),
    );
    const laterRender = await renderWarmupSection(laterService);

    expect(await screen.findByRole("dialog", { name: "Missed scheduled warm-up" })).toBeInTheDocument();
    await laterRender.user.click(screen.getByRole("button", { name: "Skip Today" }));
    expect(laterService.dismissMissedRunToday).toHaveBeenCalledTimes(1);
  });
});
