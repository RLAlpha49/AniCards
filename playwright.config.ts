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

function normalizeLocalEnvValue(rawValue: string): string {
  const trimmed = rawValue.trim();
  if (trimmed.length < 2) {
    return trimmed;
  }

  const hasMatchingSingleQuotes =
    trimmed.startsWith("'") && trimmed.endsWith("'");
  const hasMatchingDoubleQuotes =
    trimmed.startsWith('"') && trimmed.endsWith('"');

  return hasMatchingSingleQuotes || hasMatchingDoubleQuotes
    ? trimmed.slice(1, -1).trim()
    : trimmed;
}

function applyLocalPlaywrightEnvLine(line: string): void {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith("#")) {
    return;
  }

  const match = /^([A-Za-z_]\w*)=(.*)$/.exec(trimmed);
  if (!match) {
    return;
  }

  const [, key, rawValue] = match;
  if (process.env[key]?.trim()) {
    return;
  }

  const normalizedValue = normalizeLocalEnvValue(rawValue);
  if (normalizedValue) {
    process.env[key] = normalizedValue;
  }
}

function loadLocalPlaywrightEnvFile(relativePath: string): void {
  const absolutePath = resolve(process.cwd(), relativePath);
  if (!existsSync(absolutePath)) {
    return;
  }

  for (const line of readFileSync(absolutePath, "utf8").split(/\r?\n/)) {
    applyLocalPlaywrightEnvLine(line);
  }
}

function loadLocalPlaywrightEnv(): void {
  for (const relativePath of [".env", ".env.local"]) {
    loadLocalPlaywrightEnvFile(relativePath);
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

function getLocalServerCommand(): string {
  if (process.env.CI) {
    return "bun run start";
  }

  if (useLocalProductionServer) {
    return "bun run build && bun run start";
  }

  return "bun run dev";
}

// Preview deployments can be protection-gated; these headers let CI reach them
// without weakening the public site configuration.
function buildExtraHttpHeaders(): Record<string, string> | undefined {
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

  return Object.keys(extraHTTPHeaders).length > 0
    ? extraHTTPHeaders
    : undefined;
}

function buildWebServerConfig() {
  if (!shouldLaunchLocalServer) {
    return undefined;
  }

  return {
    command: getLocalServerCommand(),
    url: baseURL,
    reuseExistingServer: !process.env.CI && !useLocalProductionServer,
    timeout: useLocalProductionServer ? 300 * 1000 : 120 * 1000,
  };
}

const resolvedExtraHTTPHeaders = buildExtraHttpHeaders();

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

  webServer: buildWebServerConfig(),
});
