import { describe, expect, test } from "vitest";

import { createAppI18n } from "../../i18n/createAppI18n";
import type { WarmupAccountResult, WarmupRuntimeEvent } from "../../lib/contracts";
import {
  createManualAccountWarmupFeedback,
  createRuntimeWarmupFeedback,
} from "./feedback";

describe("warmup feedback mapping", () => {
  test("maps a manual account result to localized toast and recent status", async () => {
    const i18n = await createAppI18n("en-US");
    const t = i18n.getFixedT("en-US", ["errors", "warmup"]);
    const result: WarmupAccountResult = {
      accountId: "acc-work",
      availability: {
        isAvailable: true,
      },
      status: "success",
      completedAt: "2026-03-12T09:00:00Z",
    };

    const feedback = createManualAccountWarmupFeedback(result, "Work Account", t);

    expect(feedback.toast.message).toBe("Warm-up sent for Work Account.");
    expect(feedback.toast.tone).toBe("success");
    expect(feedback.recent.title).toBe("Latest manual warm-up");
    expect(feedback.recent.body).toBe("The latest manual warm-up completed successfully.");
  });

  test("maps a scheduled runtime event to localized toast and recent status", async () => {
    const i18n = await createAppI18n("en-US");
    const t = i18n.getFixedT("en-US", ["errors", "warmup"]);
    const event: WarmupRuntimeEvent = {
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
    };

    const feedback = createRuntimeWarmupFeedback(event, t);

    expect(feedback.toast.message).toBe("Scheduled warm-up sent for all 2 eligible accounts.");
    expect(feedback.toast.tone).toBe("success");
    expect(feedback.recent.title).toBe("Latest scheduled warm-up");
    expect(feedback.recent.body).toBe("The daily warm-up completed for 2 eligible accounts.");
  });
});
