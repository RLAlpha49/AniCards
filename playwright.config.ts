// playwright.config.ts
//
// Shared Playwright configuration for local development and protected preview deployments.
// When `PLAYWRIGHT_BASE_URL` is unset, the suite boots the app locally; otherwise it treats
// the provided URL as the system under test and optionally sends Vercel bypass headers.
//
// Artifacts live under `.artifacts/` so traces, videos, screenshots, and the HTML report
// are easy to collect from CI.

import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

import { defineConfig, devices } from "@playwright/test";

function loadLocalPlaywrightEnv(): void {
  for (const relativePath of [".env", ".env.local"]) {
    const absolutePath = resolve(process.cwd(), relativePath);
    if (!existsSync(absolutePath)) {
      continue;
    }

    for (const line of readFileSync(absolutePath, "utf8").split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) {
        continue;
      }

      const match = /^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/.exec(trimmed);
      if (!match) {
        continue;
      }

      const [, key, rawValue] = match;
      if (process.env[key]?.trim()) {
        continue;
      }

      const normalizedValue = rawValue.replace(/^['\"]|['\"]$/g, "").trim();
      if (normalizedValue) {
        process.env[key] = normalizedValue;
      }
    }
  }
}

loadLocalPlaywrightEnv();

const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:3000";
const automationBypassSecret = process.env.VERCEL_AUTOMATION_BYPASS_SECRET;
const playwrightArtifactsDir = "./.artifacts";
const useLocalProductionServer =
  process.env.PLAYWRIGHT_LOCAL_PRODUCTION === "1";
const includeRealHandlerIpHeader = process.env.PLAYWRIGHT_REAL_USER_E2E === "1";
const shouldLaunchLocalServer = !process.env.PLAYWRIGHT_BASE_URL;
const localServerCommand = process.env.CI
  ? "bun run start"
  : useLocalProductionServer
    ? "bun run build && bun run start"
    : "bun run dev";
// Preview deployments can be protection-gated; these headers let CI reach them
// without weakening the public site configuration.
const extraHTTPHeaders = {
  ...(automationBypassSecret
    ? {
        "x-vercel-protection-bypass": automationBypassSecret,
        "x-vercel-set-bypass-cookie": "true",
      }
    : {}),
  ...(includeRealHandlerIpHeader
    ? {
        "x-playwright-client-ip": "127.0.0.1",
      }
    : {}),
};
const resolvedExtraHTTPHeaders =
  Object.keys(extraHTTPHeaders).length > 0 ? extraHTTPHeaders : undefined;

const projects = [
  {
    name: "chromium",
    use: { ...devices["Desktop Chrome"] },
  },
  {
    name: "mobile-chrome",
    use: { ...devices["Pixel 5"] },
  },
  {
    name: "firefox",
    use: { ...devices["Desktop Firefox"] },
  },
] satisfies Parameters<typeof defineConfig>[0]["projects"];

export default defineConfig({
  testDir: "./tests/e2e",
  outputDir: `${playwrightArtifactsDir}/playwright-test-results`,
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? "50%" : 5,
  reporter: [
    ["list"],
    [
      "html",
      {
        outputFolder: `${playwrightArtifactsDir}/playwright-report`,
        open: "never",
      },
    ],
  ],
  use: {
    baseURL,
    extraHTTPHeaders: resolvedExtraHTTPHeaders,
    trace: "on-first-retry",
    screenshot: "only-on-failure",
    video: "on-first-retry",
    actionTimeout: 10000,
    navigationTimeout: 20000,
  },

  projects,

  webServer: shouldLaunchLocalServer
    ? {
        command: localServerCommand,
        url: baseURL,
        reuseExistingServer: !process.env.CI && !useLocalProductionServer,
        timeout: useLocalProductionServer ? 300 * 1000 : 120 * 1000,
      }
    : undefined,
});
