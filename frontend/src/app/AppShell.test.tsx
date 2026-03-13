import { act, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, test, vi } from "vitest";

import { AppShell } from "./AppShell";
import { createAppI18n } from "../i18n/createAppI18n";
import type { WarmupRuntimeEvent } from "../lib/contracts";
import type { AppServices } from "../lib/wails/services";

describe("AppShell", () => {
  test("renders shell title using bootstrap locale from facade", async () => {
    const i18n = await createAppI18n();
    let runtimeHandler: ((payload: WarmupRuntimeEvent) => void) | undefined;
    const services: AppServices = {
      bootstrap: {
        load: vi.fn().mockResolvedValue({
          locale: "zh-CN",
          supportedLocales: ["zh-CN", "en-US"],
          hasManualOverride: false,
          app: {
            name: "Codex Switch",
            version: "0.1.0",
          },
        }),
      },
      accounts: {
        load: vi.fn().mockResolvedValue({
          activeAccountId: null,
          accounts: [],
        }),
        rename: vi.fn(),
        remove: vi.fn(),
        switch: vi.fn(),
      },
      process: {
        getStatus: vi.fn().mockResolvedValue({
          foregroundCount: 0,
          backgroundCount: 0,
          canSwitch: true,
        }),
      },
      oauth: {
        start: vi.fn(),
        complete: vi.fn(),
        cancel: vi.fn(),
        selectAuthFilePath: vi.fn(),
        importFromFile: vi.fn(),
      },
      usage: {
        get: vi.fn(),
        refreshAll: vi.fn(),
      },
      warmup: {
        run: vi.fn(),
        runAll: vi.fn(),
        loadScheduleStatus: vi.fn().mockResolvedValue({
          schedule: {
            enabled: true,
            localTime: "09:30",
            accountIds: [],
          },
          validAccountIDs: [],
          validAccountIds: [],
          missedRunToday: false,
          nextRunLocalIso: "2026-03-12T09:30:00+08:00",
        }),
        saveSchedule: vi.fn(),
        dismissMissedRunToday: vi.fn(),
        runMissedWarmupNow: vi.fn(),
      },
      settings: {
        load: vi.fn().mockResolvedValue({
          localePreference: "system",
          effectiveLocale: "zh-CN",
          backupSecurityMode: "keychain",
        }),
        save: vi.fn().mockResolvedValue({
          localePreference: "en-US",
          effectiveLocale: "en-US",
          backupSecurityMode: "keychain",
        }),
      },
      backup: {
        exportSlimText: vi.fn().mockResolvedValue("css1.payload"),
        importSlimText: vi.fn().mockResolvedValue({
          totalInPayload: 1,
          importedCount: 1,
          skippedCount: 0,
        }),
        selectFullExportPath: vi.fn().mockResolvedValue({
          selected: true,
          path: "/tmp/export.cswf",
        }),
        exportFull: vi.fn().mockResolvedValue(true),
        selectFullImportPath: vi.fn().mockResolvedValue({
          selected: true,
          path: "/tmp/import.cswf",
        }),
        importFull: vi.fn().mockResolvedValue({
          totalInPayload: 1,
          importedCount: 1,
          skippedCount: 0,
        }),
      },
      events: {
        subscribe: vi.fn((_eventName, handler) => {
          runtimeHandler = handler as (payload: WarmupRuntimeEvent) => void;
          return () => undefined;
        }),
      },
    };

    render(<AppShell i18n={i18n} services={services} />);

    expect(await screen.findByText("Codex Switcher")).toBeInTheDocument();
    expect(await screen.findByText("多账号管理器骨架")).toBeInTheDocument();
    expect(await screen.findByText("账号工作区")).toBeInTheDocument();
    expect(await screen.findByText("每日 warm-up 计划")).toBeInTheDocument();
    expect(await screen.findByText("设置")).toBeInTheDocument();
    expect(await screen.findByText("还没有账号")).toBeInTheDocument();
    expect(services.bootstrap.load).toHaveBeenCalledTimes(1);
    expect(services.accounts.load).toHaveBeenCalledTimes(1);
    expect(services.process.getStatus).toHaveBeenCalledTimes(1);
    expect(services.warmup.loadScheduleStatus).toHaveBeenCalledTimes(1);
    expect(services.settings.load).toHaveBeenCalledTimes(1);

    expect(runtimeHandler).toBeDefined();

    await act(async () => {
      runtimeHandler?.({
        trigger: "scheduled",
        completedAt: "2026-03-12T09:15:00+08:00",
        result: {
          items: [],
          summary: {
            totalAccounts: 2,
            eligibleAccounts: 2,
            successfulAccounts: 2,
            failedAccounts: 0,
            skippedAccounts: 0,
          },
        },
      });
    });

    expect(
      await screen.findByText("已为全部 2 个可用账号发送定时 warm-up 请求。"),
    ).toBeInTheDocument();
    expect(await screen.findByText("最近一次定时 warm-up")).toBeInTheDocument();
    expect(
      await screen.findByText("本次每日 warm-up 已完成，共处理 2 个可用账号。"),
    ).toBeInTheDocument();
  });

  test("applies saved locale immediately and refreshes accounts after slim import", async () => {
    const i18n = await createAppI18n();
    const user = userEvent.setup();
    const services: AppServices = {
      bootstrap: {
        load: vi.fn().mockResolvedValue({
          locale: "en-US",
          supportedLocales: ["zh-CN", "en-US"],
          hasManualOverride: false,
          app: {
            name: "Codex Switch",
            version: "0.1.0",
          },
        }),
      },
      accounts: {
        load: vi
          .fn()
          .mockResolvedValueOnce({
            activeAccountId: null,
            accounts: [],
          })
          .mockResolvedValue({
            activeAccountId: "acc-imported",
            accounts: [
              {
                id: "acc-imported",
                displayName: "Imported Account",
                authKind: "chatgpt",
                createdAt: "2026-03-12T00:00:00Z",
                updatedAt: "2026-03-12T00:00:00Z",
                warmupAvailability: {
                  isAvailable: true,
                },
              },
            ],
          }),
        rename: vi.fn(),
        remove: vi.fn(),
        switch: vi.fn(),
      },
      process: {
        getStatus: vi.fn().mockResolvedValue({
          foregroundCount: 0,
          backgroundCount: 0,
          canSwitch: true,
        }),
      },
      oauth: {
        start: vi.fn(),
        complete: vi.fn(),
        cancel: vi.fn(),
        selectAuthFilePath: vi.fn(),
        importFromFile: vi.fn(),
      },
      usage: {
        get: vi.fn(),
        refreshAll: vi.fn().mockResolvedValue({
          items: [],
        }),
      },
      warmup: {
        run: vi.fn(),
        runAll: vi.fn(),
        loadScheduleStatus: vi.fn().mockResolvedValue({
          schedule: {
            enabled: true,
            localTime: "09:30",
            accountIds: [],
          },
          validAccountIds: [],
          missedRunToday: false,
        }),
        saveSchedule: vi.fn(),
        dismissMissedRunToday: vi.fn(),
        runMissedWarmupNow: vi.fn(),
      },
      settings: {
        load: vi.fn().mockResolvedValue({
          localePreference: "system",
          effectiveLocale: "en-US",
          backupSecurityMode: "keychain",
        }),
        save: vi.fn().mockResolvedValue({
          localePreference: "zh-CN",
          effectiveLocale: "zh-CN",
          backupSecurityMode: "keychain",
        }),
      },
      backup: {
        exportSlimText: vi.fn().mockResolvedValue("css1.payload"),
        importSlimText: vi.fn().mockResolvedValue({
          totalInPayload: 1,
          importedCount: 1,
          skippedCount: 0,
        }),
        selectFullExportPath: vi.fn(),
        exportFull: vi.fn(),
        selectFullImportPath: vi.fn(),
        importFull: vi.fn(),
      },
    };

    render(<AppShell i18n={i18n} services={services} />);

    expect(await screen.findByText("Settings")).toBeInTheDocument();

    await user.selectOptions(await screen.findByLabelText("Language"), "zh-CN");
    await user.click(screen.getByRole("button", { name: "Save preferences" }));
    expect(await screen.findByText("设置")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "导入 slim 文本" }));
    const importDialog = await screen.findByRole("dialog", { name: "导入 slim 文本" });
    await user.type(within(importDialog).getByLabelText("Slim 备份内容"), "css1.newpayload");
    await user.click(within(importDialog).getByRole("button", { name: "导入 slim 文本" }));

    expect(services.backup.importSlimText).toHaveBeenCalledWith("css1.newpayload");
    expect(await screen.findByText("Imported Account")).toBeInTheDocument();
    expect(services.accounts.load).toHaveBeenCalledTimes(2);
  });
});
