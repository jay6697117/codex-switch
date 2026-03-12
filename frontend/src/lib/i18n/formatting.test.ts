import { describe, expect, test } from "vitest";

import { formatUsageResetTime, formatWarmupNextRun } from "./formatting";

describe("locale-aware formatting", () => {
  test("formats usage reset timestamps with the requested locale", () => {
    const value = "2026-03-12T09:30:00Z";

    expect(formatUsageResetTime(value, "en-US")).toBe(
      new Intl.DateTimeFormat("en-US", {
        month: "short",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit",
      }).format(new Date(value)),
    );

    expect(formatUsageResetTime(value, "zh-CN")).toBe(
      new Intl.DateTimeFormat("zh-CN", {
        month: "short",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit",
      }).format(new Date(value)),
    );
  });

  test("formats warmup next-run timestamps with the requested locale", () => {
    const value = "2026-03-12T09:30:00Z";

    expect(formatWarmupNextRun(value, "en-US")).toBe(
      new Intl.DateTimeFormat("en-US", {
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
      }).format(new Date(value)),
    );

    expect(formatWarmupNextRun(value, "zh-CN")).toBe(
      new Intl.DateTimeFormat("zh-CN", {
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
      }).format(new Date(value)),
    );
  });

  test("returns stable fallbacks for empty or invalid values", () => {
    expect(formatUsageResetTime(undefined, "en-US")).toBe("");
    expect(formatUsageResetTime("not-a-date", "en-US")).toBe("not-a-date");
    expect(formatWarmupNextRun(undefined, "en-US")).toBe("—");
    expect(formatWarmupNextRun("not-a-date", "en-US")).toBe("—");
  });
});
