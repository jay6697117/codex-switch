import type { TFunction } from "i18next";

import type {
  WarmupAccountResult,
  WarmupAllResult,
  WarmupRuntimeEvent,
} from "../../lib/contracts";

export type WarmupFeedbackTone = "success" | "error" | "info";

export interface WarmupShellFeedback {
  toast: {
    message: string;
    tone: WarmupFeedbackTone;
  };
  recent: {
    title: string;
    body: string;
    tone: WarmupFeedbackTone;
  };
  trigger: "manual" | "scheduled" | "missed_prompt";
}

function summarizeWarmupTone(summary: WarmupAllResult["summary"]): WarmupFeedbackTone {
  if (summary.failedAccounts === 0 && summary.skippedAccounts === 0) {
    return "success";
  }

  if (summary.successfulAccounts > 0) {
    return "info";
  }

  return "error";
}

export function createManualAccountWarmupFeedback(
  result: WarmupAccountResult,
  accountName: string,
  t: TFunction<["errors", "warmup"]>,
): WarmupShellFeedback {
  if (result.status === "success") {
    return {
      toast: {
        message: t("warmup:feedbackSuccessSingle", { name: accountName }),
        tone: "success",
      },
      recent: {
        title: t("warmup:latestSuccessTitle"),
        body: t("warmup:latestSuccessBody"),
        tone: "success",
      },
      trigger: "manual",
    };
  }

  if (result.status === "failed") {
    return {
      toast: {
        message: t("warmup:feedbackFailedSingle", { name: accountName }),
        tone: "error",
      },
      recent: {
        title: t("warmup:latestFailedTitle"),
        body: t(`errors:${result.failureCode ?? "warmup.request_failed"}`),
        tone: "error",
      },
      trigger: "manual",
    };
  }

  return {
    toast: {
      message: t("warmup:feedbackSkippedSingle", { name: accountName }),
      tone: "info",
    },
    recent: {
      title: t("warmup:unavailableTitle"),
      body: t(`errors:${result.availability.reasonCode ?? "warmup.load_failed"}`),
      tone: "info",
    },
    trigger: "manual",
  };
}

export function createManualAllWarmupFeedback(
  result: WarmupAllResult,
  t: TFunction<["errors", "warmup"]>,
): WarmupShellFeedback {
  const tone = summarizeWarmupTone(result.summary);
  if (result.summary.eligibleAccounts === 0) {
    return {
      toast: {
        message: t("warmup:runAllUnavailable"),
        tone: "info",
      },
      recent: {
        title: t("warmup:latestSuccessTitle"),
        body: t("warmup:runAllUnavailable"),
        tone: "info",
      },
      trigger: "manual",
    };
  }

  if (tone === "success") {
    return {
      toast: {
        message: t("warmup:feedbackSuccessAll", {
          successful: result.summary.successfulAccounts,
        }),
        tone,
      },
      recent: {
        title: t("warmup:latestSuccessTitle"),
        body: t("warmup:latestSuccessBody"),
        tone,
      },
      trigger: "manual",
    };
  }

  return {
    toast: {
      message: t("warmup:feedbackMixedAll", {
        successful: result.summary.successfulAccounts,
        eligible: result.summary.eligibleAccounts,
        failed: result.summary.failedAccounts,
        skipped: result.summary.skippedAccounts,
      }),
      tone,
    },
    recent: {
      title: t("warmup:latestFailedTitle"),
      body: t("warmup:feedbackMixedAll", {
        successful: result.summary.successfulAccounts,
        eligible: result.summary.eligibleAccounts,
        failed: result.summary.failedAccounts,
        skipped: result.summary.skippedAccounts,
      }),
      tone,
    },
    trigger: "manual",
  };
}

export function createRuntimeWarmupFeedback(
  event: WarmupRuntimeEvent,
  t: TFunction<["errors", "warmup"]>,
): WarmupShellFeedback {
  const tone = summarizeWarmupTone(event.result.summary);
  const isMissedPrompt = event.trigger === "missed_prompt";
  const toastPrefix = isMissedPrompt ? "warmup:feedbackMissed" : "warmup:feedbackScheduled";
  const recentPrefix = isMissedPrompt ? "warmup:recentMissed" : "warmup:recentScheduled";

  if (event.result.summary.eligibleAccounts === 0) {
    return {
      toast: {
        message: t(`${toastPrefix}Unavailable`),
        tone: "info",
      },
      recent: {
        title: t(`${recentPrefix}Title`),
        body: t(`${recentPrefix}Unavailable`),
        tone: "info",
      },
      trigger: event.trigger,
    };
  }

  if (tone === "success") {
    return {
      toast: {
        message: t(`${toastPrefix}Success`, {
          successful: event.result.summary.successfulAccounts,
        }),
        tone,
      },
      recent: {
        title: t(`${recentPrefix}Title`),
        body: t(`${recentPrefix}SuccessBody`, {
          eligible: event.result.summary.eligibleAccounts,
        }),
        tone,
      },
      trigger: event.trigger,
    };
  }

  return {
    toast: {
      message: t(`${toastPrefix}Mixed`, {
        eligible: event.result.summary.eligibleAccounts,
        successful: event.result.summary.successfulAccounts,
        failed: event.result.summary.failedAccounts,
        skipped: event.result.summary.skippedAccounts,
      }),
      tone,
    },
    recent: {
      title: t(`${recentPrefix}Title`),
      body: t(`${recentPrefix}MixedBody`, {
        eligible: event.result.summary.eligibleAccounts,
        successful: event.result.summary.successfulAccounts,
        failed: event.result.summary.failedAccounts,
        skipped: event.result.summary.skippedAccounts,
      }),
      tone,
    },
    trigger: event.trigger,
  };
}
