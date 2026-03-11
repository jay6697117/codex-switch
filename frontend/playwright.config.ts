import { defineConfig } from "@playwright/test";
import { fileURLToPath } from "node:url";

const currentDir = fileURLToPath(new URL(".", import.meta.url));

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: false,
  use: {
    baseURL: "http://127.0.0.1:34115",
    headless: true,
  },
  webServer: {
    command: "npm run dev -- --host 127.0.0.1",
    url: "http://127.0.0.1:34115",
    cwd: currentDir,
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
  },
});
