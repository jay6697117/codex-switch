import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, test } from "vitest";

import { resources } from "./resources";

function flattenKeys(input: unknown, prefix = ""): string[] {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    return prefix ? [prefix] : [];
  }

  return Object.entries(input as Record<string, unknown>).flatMap(([key, value]) => {
    const nextPrefix = prefix ? `${prefix}.${key}` : key;
    return flattenKeys(value, nextPrefix);
  });
}

function collectGoFiles(root: string): string[] {
  return readdirSync(root).flatMap((entry) => {
    const path = join(root, entry);
    const stats = statSync(path);

    if (stats.isDirectory()) {
      return collectGoFiles(path);
    }

    if (!path.endsWith(".go") || path.endsWith("_test.go")) {
      return [];
    }

    return [path];
  });
}

function collectBackendErrorCodes(): string[] {
  const repoRoot = join(process.cwd(), "..");
  const files = [join(repoRoot, "app.go"), ...collectGoFiles(join(repoRoot, "internal"))];
  const codes = new Set<string>();
  const matcher = /AppError\s*\{[\s\S]{0,200}?Code:\s*"([^"]+)"/g;

  for (const file of files) {
    const source = readFileSync(file, "utf8");
    for (const match of source.matchAll(matcher)) {
      codes.add(match[1]);
    }
  }

  return [...codes].sort();
}

describe("i18n guardrails", () => {
  test("keeps zh-CN and en-US resource key shapes aligned", () => {
    for (const namespace of Object.keys(resources["en-US"])) {
      expect(
        flattenKeys(resources["zh-CN"][namespace as keyof (typeof resources)["zh-CN"]]).sort(),
      ).toEqual(
        flattenKeys(resources["en-US"][namespace as keyof (typeof resources)["en-US"]]).sort(),
      );
    }
  });

  test("covers every backend AppError code in the frontend errors dictionary", () => {
    const backendCodes = collectBackendErrorCodes();
    const errorKeys = new Set(Object.keys(resources["en-US"].errors));
    const missing = backendCodes.filter((code) => !errorKeys.has(code));

    expect(missing).toEqual([]);
  });
});
