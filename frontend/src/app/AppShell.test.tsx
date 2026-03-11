import { render, screen } from "@testing-library/react";
import { describe, expect, test, vi } from "vitest";

import { AppShell } from "./AppShell";
import { createAppI18n } from "../i18n/createAppI18n";
import type { AppServices } from "../lib/wails/services";

describe("AppShell", () => {
  test("renders shell title using bootstrap locale from facade", async () => {
    const i18n = await createAppI18n();
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
    };

    render(<AppShell i18n={i18n} services={services} />);

    expect(await screen.findByText("Codex Switcher")).toBeInTheDocument();
    expect(await screen.findByText("多账号管理器骨架")).toBeInTheDocument();
    expect(await screen.findByText("账号基础")).toBeInTheDocument();
    expect(await screen.findByText("还没有账号")).toBeInTheDocument();
    expect(services.bootstrap.load).toHaveBeenCalledTimes(1);
    expect(services.accounts.load).toHaveBeenCalledTimes(1);
  });
});
