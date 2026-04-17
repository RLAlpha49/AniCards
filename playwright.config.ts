// playwright.config.ts
//
// Shared Playwright configuration for local development, CI browser coverage,
// and protected preview deployments. Environment loading intentionally uses
// Next.js' own loader so `.env*` precedence matches the app runtime.

import { loadEnvConfig } from "@next/env";
import { defineConfig, devices } from "@playwright/test";

import {
  buildPlaywrightAutomationBypassHeaders,
  DEFAULT_PLAYWRIGHT_BASE_URL,
  resolvePlaywrightBaseUrl,
} from "./lib/playwright-base-url";

export * from "./lib/playwright-base-url";

type PlaywrightConfigShape = Parameters<typeof defineConfig>[0];
type PlaywrightProjects = NonNullable<PlaywrightConfigShape["projects"]>;
type PlaywrightProject = PlaywrightProjects[number];
type PlaywrightEnv = Readonly<Record<string, string | undefined>>;

export const PLAYWRIGHT_ARTIFACTS_DIR = "./.artifacts";
export const PLAYWRIGHT_MOBILE_ONLY_TEST_MATCH =
  /tests[\\/]e2e[\\/]user[\\/]user-mobile\.spec\.[jt]sx?$/;

const PLAYWRIGHT_STANDARD_TEST_IGNORE = [
  PLAYWRIGHT_MOBILE_ONLY_TEST_MATCH,
] as const;

function readOptionalEnvValue(
  env: PlaywrightEnv,
  key: string,
): string | undefined {
  const value = env[key]?.trim();
  return value || undefined;
}

function isEnabledFlag(value: string | undefined): boolean {
  return value === "1" || value?.toLowerCase() === "true";
}

export function loadPlaywrightEnv(projectDir = process.cwd()) {
  return loadEnvConfig(
    projectDir,
    process.env.NODE_ENV !== "production",
    console,
    true,
  );
}

function getLocalServerCommand(
  env: PlaywrightEnv,
  useLocalProductionServer: boolean,
): string {
  if (readOptionalEnvValue(env, "CI")) {
    return "bun run start";
  }

  if (useLocalProductionServer) {
    return "bun run build && bun run start";
  }

  return "bun run dev";
}

function createStandardProjects(
  includeFullMatrix: boolean,
): PlaywrightProjects {
  const chromiumProject = {
    name: "chromium",
    testIgnore: [...PLAYWRIGHT_STANDARD_TEST_IGNORE],
    use: { ...devices["Desktop Chrome"] },
  } satisfies PlaywrightProject;

  const mobileChromeProject = {
    name: "mobile-chrome",
    use: { ...devices["Pixel 5"] },
  } satisfies PlaywrightProject;

  const firefoxProject = {
    name: "firefox",
    testIgnore: [...PLAYWRIGHT_STANDARD_TEST_IGNORE],
    use: { ...devices["Desktop Firefox"] },
  } satisfies PlaywrightProject;

  return includeFullMatrix
    ? [chromiumProject, mobileChromeProject, firefoxProject]
    : [chromiumProject];
}

export function createPlaywrightConfig(
  env: PlaywrightEnv = process.env,
): PlaywrightConfigShape {
  const resolvedBaseUrl = resolvePlaywrightBaseUrl(
    readOptionalEnvValue(env, "PLAYWRIGHT_BASE_URL"),
  );
  const baseURL = resolvedBaseUrl?.origin ?? DEFAULT_PLAYWRIGHT_BASE_URL;
  const automationBypassSecret = readOptionalEnvValue(
    env,
    "VERCEL_AUTOMATION_BYPASS_SECRET",
  );
  const useLocalProductionServer = isEnabledFlag(
    readOptionalEnvValue(env, "PLAYWRIGHT_LOCAL_PRODUCTION"),
  );
  const includeFullMatrix =
    Boolean(readOptionalEnvValue(env, "CI")) ||
    isEnabledFlag(readOptionalEnvValue(env, "PLAYWRIGHT_FULL_MATRIX"));
  const isCi = Boolean(readOptionalEnvValue(env, "CI"));
  const shouldLaunchLocalServer = !resolvedBaseUrl;
  const projects = createStandardProjects(includeFullMatrix);
  const resolvedExtraHTTPHeaders = buildPlaywrightAutomationBypassHeaders({
    automationBypassSecret,
    resolvedBaseUrl,
  });

  return {
    testDir: "./tests/e2e",
    outputDir: `${PLAYWRIGHT_ARTIFACTS_DIR}/playwright-test-results`,
    fullyParallel: true,
    forbidOnly: isCi,
    retries: isCi ? 2 : 0,
    workers: isCi ? "50%" : 5,
    reporter: [
      ["list"],
      [
        "html",
        {
          outputFolder: `${PLAYWRIGHT_ARTIFACTS_DIR}/playwright-report`,
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
          command: getLocalServerCommand(env, useLocalProductionServer),
          url: baseURL,
          reuseExistingServer: !isCi && !useLocalProductionServer,
          timeout: useLocalProductionServer ? 300 * 1000 : 120 * 1000,
        }
      : undefined,
  };
}

if (process.env.PLAYWRIGHT_SKIP_ENV_AUTOLOAD !== "1") {
  loadPlaywrightEnv();
}

const playwrightConfig = createPlaywrightConfig();

export default defineConfig(playwrightConfig);
