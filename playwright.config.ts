import { defineConfig, devices } from "@playwright/test";

const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:3000";
const automationBypassSecret = process.env.VERCEL_AUTOMATION_BYPASS_SECRET;
const playwrightArtifactsDir = "./.artifacts";
const shouldLaunchLocalServer = !process.env.PLAYWRIGHT_BASE_URL;
const extraHTTPHeaders = automationBypassSecret
  ? {
      "x-vercel-protection-bypass": automationBypassSecret,
      "x-vercel-set-bypass-cookie": "true",
    }
  : undefined;

export default defineConfig({
  testDir: "./tests/e2e",
  outputDir: `${playwrightArtifactsDir}/playwright-test-results`,
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? "50%" : 6,
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
    navigationTimeout: 30000,
  },

  projects: [
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
    {
      name: "webkit",
      use: { ...devices["Desktop Safari"] },
    },
  ],

  webServer: shouldLaunchLocalServer
    ? {
        command: process.env.CI ? "bun run start" : "bun run dev",
        url: baseURL,
        reuseExistingServer: !process.env.CI,
        timeout: 120 * 1000,
      }
    : undefined,
});
