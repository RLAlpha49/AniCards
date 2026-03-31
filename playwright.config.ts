// playwright.config.ts
//
// Shared Playwright configuration for local development and protected preview deployments.
// When `PLAYWRIGHT_BASE_URL` is unset, the suite boots the app locally; otherwise it treats
// the provided URL as the system under test and optionally sends Vercel bypass headers.
//
// Artifacts live under `.artifacts/` so traces, videos, screenshots, and the HTML report
// are easy to collect from CI.

import { defineConfig, devices } from "@playwright/test";

const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:3000";
const automationBypassSecret = process.env.VERCEL_AUTOMATION_BYPASS_SECRET;
const playwrightArtifactsDir = "./.artifacts";
const shouldLaunchLocalServer = !process.env.PLAYWRIGHT_BASE_URL;
// Preview deployments can be protection-gated; these headers let CI reach them
// without weakening the public site configuration.
const extraHTTPHeaders = automationBypassSecret
  ? {
      "x-vercel-protection-bypass": automationBypassSecret,
      "x-vercel-set-bypass-cookie": "true",
    }
  : undefined;

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
    extraHTTPHeaders,
    trace: "on-first-retry",
    screenshot: "only-on-failure",
    video: "on-first-retry",
    actionTimeout: 10000,
    navigationTimeout: 20000,
  },

  projects,

  webServer: shouldLaunchLocalServer
    ? {
        command: process.env.CI ? "bun run start" : "bun run dev",
        url: baseURL,
        reuseExistingServer: !process.env.CI,
        timeout: 120 * 1000,
      }
    : undefined,
});
