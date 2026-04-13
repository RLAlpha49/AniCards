// playwright.config.ts
//
// Shared Playwright configuration for local development, CI browser coverage,
// and protected preview deployments. Environment loading intentionally uses
// Next.js' own loader so `.env*` precedence matches the app runtime.

import { loadEnvConfig } from "@next/env";
import { defineConfig, devices } from "@playwright/test";

type PlaywrightConfigShape = Parameters<typeof defineConfig>[0];
type PlaywrightProjects = NonNullable<PlaywrightConfigShape["projects"]>;
type PlaywrightProject = PlaywrightProjects[number];
type PlaywrightEnv = Readonly<Record<string, string | undefined>>;

export const DEFAULT_PLAYWRIGHT_BASE_URL = "http://localhost:3000";
export const PLAYWRIGHT_ARTIFACTS_DIR = "./.artifacts";
export const ANICARDS_PRODUCTION_HOST = "anicards.alpha49.com";
export const ANICARDS_VERCEL_PREVIEW_HOST_PATTERN =
  /^anicards(?:-[a-z0-9-]+)+\.vercel\.app$/;
export const PLAYWRIGHT_LABS_TEST_MATCH =
  /tests[\\/]e2e[\\/]labs[\\/].+\.spec\.[jt]sx?$/;
export const PLAYWRIGHT_MOBILE_ONLY_TEST_MATCH =
  /tests[\\/]e2e[\\/]user[\\/]user-mobile\.spec\.[jt]sx?$/;

const PLAYWRIGHT_STANDARD_TEST_IGNORE = [
  PLAYWRIGHT_LABS_TEST_MATCH,
  PLAYWRIGHT_MOBILE_ONLY_TEST_MATCH,
] as const;

const PLAYWRIGHT_MOBILE_TEST_IGNORE = [PLAYWRIGHT_LABS_TEST_MATCH] as const;

function readOptionalEnvValue(
  env: PlaywrightEnv,
  key: string,
): string | undefined {
  const value = env[key]?.trim();
  return value ? value : undefined;
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

export function parsePlaywrightBaseUrl(rawBaseUrl?: string): URL | undefined {
  const trimmedBaseUrl = rawBaseUrl?.trim();
  if (!trimmedBaseUrl) {
    return undefined;
  }

  let parsedBaseUrl: URL;
  try {
    parsedBaseUrl = new URL(trimmedBaseUrl);
  } catch {
    throw new Error(
      `PLAYWRIGHT_BASE_URL must be a valid absolute http(s) URL: ${trimmedBaseUrl}`,
    );
  }

  if (!/^https?:$/.test(parsedBaseUrl.protocol)) {
    throw new Error(`PLAYWRIGHT_BASE_URL must use http(s): ${trimmedBaseUrl}`);
  }

  if (parsedBaseUrl.username || parsedBaseUrl.password) {
    throw new Error(
      "PLAYWRIGHT_BASE_URL must not include embedded credentials.",
    );
  }

  return parsedBaseUrl;
}

export function isTrustedAniCardsHost(hostname: string): boolean {
  const normalizedHostname = hostname.trim().toLowerCase();

  return (
    normalizedHostname === ANICARDS_PRODUCTION_HOST ||
    ANICARDS_VERCEL_PREVIEW_HOST_PATTERN.test(normalizedHostname)
  );
}

export function isTrustedAniCardsPreviewHost(hostname: string): boolean {
  return ANICARDS_VERCEL_PREVIEW_HOST_PATTERN.test(
    hostname.trim().toLowerCase(),
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
    testIgnore: [...PLAYWRIGHT_MOBILE_TEST_IGNORE],
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

function createLabsProjects(includeFullMatrix: boolean): PlaywrightProjects {
  return createStandardProjects(includeFullMatrix).map((project) => ({
    name: `${project.name}-labs`,
    testMatch: PLAYWRIGHT_LABS_TEST_MATCH,
    use: project.use,
  }));
}

function buildExtraHttpHeaders(options: {
  automationBypassSecret?: string;
  includeRealHandlerIpHeader: boolean;
  parsedBaseUrl?: URL;
}): Record<string, string> | undefined {
  const { automationBypassSecret, includeRealHandlerIpHeader, parsedBaseUrl } =
    options;
  const shouldSendBypassHeaders = Boolean(
    automationBypassSecret &&
    parsedBaseUrl &&
    isTrustedAniCardsPreviewHost(parsedBaseUrl.hostname),
  );

  const extraHTTPHeaders = {
    ...(shouldSendBypassHeaders
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

export function createPlaywrightConfig(
  env: PlaywrightEnv = process.env,
): PlaywrightConfigShape {
  const parsedBaseUrl = parsePlaywrightBaseUrl(
    readOptionalEnvValue(env, "PLAYWRIGHT_BASE_URL"),
  );
  const baseURL = parsedBaseUrl?.origin ?? DEFAULT_PLAYWRIGHT_BASE_URL;
  const automationBypassSecret = readOptionalEnvValue(
    env,
    "VERCEL_AUTOMATION_BYPASS_SECRET",
  );
  const useLocalProductionServer = isEnabledFlag(
    readOptionalEnvValue(env, "PLAYWRIGHT_LOCAL_PRODUCTION"),
  );
  const includeRealHandlerIpHeader = isEnabledFlag(
    readOptionalEnvValue(env, "PLAYWRIGHT_REAL_USER_E2E"),
  );
  const includeFullMatrix =
    Boolean(readOptionalEnvValue(env, "CI")) ||
    isEnabledFlag(readOptionalEnvValue(env, "PLAYWRIGHT_FULL_MATRIX"));
  const labsOnly = isEnabledFlag(
    readOptionalEnvValue(env, "PLAYWRIGHT_ONLY_LABS"),
  );
  const isCi = Boolean(readOptionalEnvValue(env, "CI"));
  const shouldLaunchLocalServer = !parsedBaseUrl;
  const projects = labsOnly
    ? createLabsProjects(includeFullMatrix)
    : createStandardProjects(includeFullMatrix);
  const resolvedExtraHTTPHeaders = buildExtraHttpHeaders({
    automationBypassSecret,
    includeRealHandlerIpHeader,
    parsedBaseUrl,
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
