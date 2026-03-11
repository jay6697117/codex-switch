import { describe, expect, test } from "vitest";

import type { AccountsSnapshot } from "../../lib/contracts";
import { deriveAccountsView, toggleMaskedAccount } from "./model";

const snapshot: AccountsSnapshot = {
  activeAccountId: "acct-2",
  accounts: [
    {
      id: "acct-1",
      displayName: "Work",
      email: "work@example.com",
      authKind: "chatgpt",
      createdAt: "2026-03-11T08:00:00.000Z",
      updatedAt: "2026-03-11T08:00:00.000Z",
      warmupAvailability: {
        isAvailable: true,
      },
    },
    {
      id: "acct-2",
      displayName: "Personal",
      email: "personal@example.com",
      authKind: "chatgpt",
      createdAt: "2026-03-11T08:00:00.000Z",
      updatedAt: "2026-03-11T08:00:00.000Z",
      warmupAvailability: {
        isAvailable: true,
      },
    },
    {
      id: "acct-3",
      displayName: "Team",
      email: "team@example.com",
      authKind: "apiKey",
      createdAt: "2026-03-11T08:00:00.000Z",
      updatedAt: "2026-03-11T08:00:00.000Z",
      warmupAvailability: {
        isAvailable: false,
        reasonCode: "warmup.credentials_missing",
      },
    },
  ],
};

describe("accounts model", () => {
  test("derives active and other accounts from snapshot", () => {
    const view = deriveAccountsView(snapshot, new Set(["acct-1"]), false);

    expect(view.activeAccount?.id).toBe("acct-2");
    expect(view.otherAccounts.map((account) => account.id)).toEqual([
      "acct-1",
      "acct-3",
    ]);
    expect(view.isMasked("acct-1")).toBe(true);
    expect(view.isMasked("acct-2")).toBe(false);
  });

  test("global mask overrides per-account visibility", () => {
    const masked = toggleMaskedAccount(new Set<string>(), "acct-2");
    const view = deriveAccountsView(snapshot, masked, true);

    expect(view.isMasked("acct-1")).toBe(true);
    expect(view.isMasked("acct-2")).toBe(true);
    expect(view.isMasked("acct-3")).toBe(true);
  });
});
