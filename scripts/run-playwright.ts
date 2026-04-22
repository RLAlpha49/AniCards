import {
  buildPlaywrightAutomationBypassHeaders,
  type ResolvedPlaywrightBaseUrl,
  resolveTrustedAniCardsBaseUrl,
} from "../lib/playwright-base-url";

export const PLAYWRIGHT_RUN_MODES = [
  "test-e2e",
  "matrix-lite",
  "local-prod",
  "deployed-smoke",
] as const;

type PlaywrightRunMode = (typeof PLAYWRIGHT_RUN_MODES)[number];
type PlaywrightMatrixMode = "default" | "matrix-lite" | "full-matrix";
type PlaywrightEnv = Readonly<Record<string, string | undefined>>;

type PlaywrightRunConfiguration = {
  defaultArgs?: string[];
  deployedSmokeTarget?: ResolvedPlaywrightBaseUrl;
  envOverrides?: Record<string, string | undefined>;
};

type DeployedSmokeReadinessStatus =
  | "ready"
  | "pending"
  | "protected"
  | "http-error"
  | "network-error";

type WaitForDeployedSmokeReadinessOptions = {
  fetchFn?: (input: string, init?: RequestInit) => Promise<Response>;
  logger?: Pick<Console, "info">;
  now?: () => number;
  sleep?: (ms: number) => Promise<void>;
  timeoutMs?: number;
};

export const DEPLOYED_SMOKE_TEST_GREP = "@deployed-smoke";

const DEPLOYED_SMOKE_READY_TIMEOUT_MS = 240_000;
const DEPLOYED_SMOKE_REQUEST_TIMEOUT_MS = 15_000;
const DEPLOYED_SMOKE_INITIAL_RETRY_DELAY_MS = 1_000;
const DEPLOYED_SMOKE_MAX_RETRY_DELAY_MS = 15_000;
const RETRYABLE_DEPLOYED_SMOKE_STATUSES = new Set([
  404, 408, 425, 429, 500, 502, 503, 504,
]);
const MATRIX_LITE_PROJECTS = new Set(["chromium", "mobile-chrome", "firefox"]);

function formatSupportedRunModes(): string {
  return PLAYWRIGHT_RUN_MODES.join(", ");
}

function trimEnvValue(value: string | undefined): string | undefined {
  const trimmedValue = value?.trim();
  return trimmedValue || undefined;
}

function getRequestedProjects(argv: readonly string[]): string[] {
  const requestedProjects: string[] = [];

  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];

    if (argument === "--project") {
      const projectName = argv[index + 1]?.trim();

      if (projectName) {
        requestedProjects.push(projectName);
        index += 1;
      }

      continue;
    }

    if (argument.startsWith("--project=")) {
      const projectName = argument.slice("--project=".length).trim();

      if (projectName) {
        requestedProjects.push(projectName);
      }
    }
  }

  return requestedProjects;
}

export function resolveRequestedProjectMatrix(
  argv: readonly string[],
): PlaywrightMatrixMode {
  const requestedProjects = getRequestedProjects(argv);

  if (
    requestedProjects.length === 0 ||
    requestedProjects.every((projectName) => projectName === "chromium")
  ) {
    return "default";
  }

  return requestedProjects.every((projectName) =>
    MATRIX_LITE_PROJECTS.has(projectName),
  )
    ? "matrix-lite"
    : "full-matrix";
}

export function resolvePlaywrightRunMode(
  rawMode: string | undefined,
): PlaywrightRunMode {
  if (!rawMode) {
    throw new Error(
      `Missing Playwright run mode. Expected one of: ${formatSupportedRunModes()}.`,
    );
  }

  if ((PLAYWRIGHT_RUN_MODES as readonly string[]).includes(rawMode)) {
    return rawMode as PlaywrightRunMode;
  }

  throw new Error(
    `Invalid Playwright run mode \"${rawMode}\". Expected one of: ${formatSupportedRunModes()}.`,
  );
}

function getMatrixEnvOverrides(
  matrixMode: PlaywrightMatrixMode,
): Record<string, string | undefined> {
  switch (matrixMode) {
    case "matrix-lite":
      return {
        PLAYWRIGHT_MATRIX_LITE: "1",
      };

    case "full-matrix":
      return {
        PLAYWRIGHT_FULL_MATRIX: "1",
      };

    default:
      return {};
  }
}

function createRunConfiguration(
  envOverrides: Record<string, string | undefined>,
): PlaywrightRunConfiguration {
  return Object.keys(envOverrides).length === 0 ? {} : { envOverrides };
}

function createSpawnEnvironment(
  overrides: Record<string, string | undefined>,
): Record<string, string> {
  const resolvedEnv = {
    ...process.env,
    ...overrides,
  };

  return Object.fromEntries(
    Object.entries(resolvedEnv).filter(
      (entry): entry is [string, string] => typeof entry[1] === "string",
    ),
  );
}

function runPlaywright(options: {
  defaultArgs?: string[];
  envOverrides?: Record<string, string | undefined>;
  passthroughArgs?: readonly string[];
}): never {
  const result = Bun.spawnSync({
    cmd: [
      "bunx",
      "playwright",
      "test",
      ...(options.defaultArgs ?? []),
      ...(options.passthroughArgs ?? []),
    ],
    env: createSpawnEnvironment(options.envOverrides ?? {}),
    stdin: "inherit",
    stderr: "inherit",
    stdout: "inherit",
  });

  process.exit(result.exitCode ?? 1);
}

export function resolveDeployedSmokeTarget(
  env: PlaywrightEnv = process.env,
): ResolvedPlaywrightBaseUrl {
  const rawBaseUrl = trimEnvValue(env.PLAYWRIGHT_BASE_URL);
  if (!rawBaseUrl) {
    throw new Error("PLAYWRIGHT_BASE_URL is required for deployed smoke runs.");
  }

  return resolveTrustedAniCardsBaseUrl(rawBaseUrl, "PLAYWRIGHT_BASE_URL");
}

function buildDeployedSmokeReadinessHeaders(
  target: ResolvedPlaywrightBaseUrl,
  env: PlaywrightEnv,
): Record<string, string> | undefined {
  return buildPlaywrightAutomationBypassHeaders({
    automationBypassSecret: trimEnvValue(env.VERCEL_AUTOMATION_BYPASS_SECRET),
    resolvedBaseUrl: target,
  });
}

export function classifyDeployedSmokeReadinessStatus(
  status: number,
): Exclude<DeployedSmokeReadinessStatus, "network-error"> {
  if (status >= 200 && status < 400) {
    return "ready";
  }

  if (status === 401 || status === 403) {
    return "protected";
  }

  if (RETRYABLE_DEPLOYED_SMOKE_STATUSES.has(status)) {
    return "pending";
  }

  return "http-error";
}

function formatDeployedSmokeReadinessError(options: {
  hasBypassSecret: boolean;
  lastError?: string;
  lastKind: Exclude<DeployedSmokeReadinessStatus, "ready">;
  lastStatus?: number;
  target: ResolvedPlaywrightBaseUrl;
  timeoutMs?: number;
}): string {
  const {
    hasBypassSecret,
    lastError,
    lastKind,
    lastStatus,
    target,
    timeoutMs,
  } = options;

  if (lastKind === "protected") {
    if (target.canSendBypassHeaders && !hasBypassSecret) {
      return `Deployed smoke target returned ${lastStatus ?? "401/403"} from ${target.origin}. This preview appears protected; configure VERCEL_AUTOMATION_BYPASS_SECRET so smoke checks can bypass Vercel deployment protection.`;
    }

    return `Deployed smoke target returned ${lastStatus ?? "401/403"} from ${target.origin}. The target appears protected or requires auth; verify deployment protection settings${target.canSendBypassHeaders ? " and confirm VERCEL_AUTOMATION_BYPASS_SECRET is correct" : ""}.`;
  }

  if (lastKind === "http-error") {
    return `Deployed smoke readiness probe reached ${target.origin} but returned unexpected HTTP ${lastStatus ?? "error"}. Verify the deployment health and the resolved PLAYWRIGHT_BASE_URL target.`;
  }

  if (lastKind === "network-error") {
    return `Deployed smoke target at ${target.origin} did not become reachable before the readiness window expired.${lastError ? ` Last network error: ${lastError}` : ""}`;
  }

  return `Deployed smoke target at ${target.origin} did not become ready within ${timeoutMs ?? DEPLOYED_SMOKE_READY_TIMEOUT_MS}ms.${lastStatus ? ` Last status: ${lastStatus}.` : ""}`;
}

function formatDeployedSmokeReadinessWaitMessage(options: {
  attempt: number;
  lastError?: string;
  lastKind: Exclude<DeployedSmokeReadinessStatus, "ready">;
  lastStatus?: number;
  target: ResolvedPlaywrightBaseUrl;
}): string {
  const { attempt, lastError, lastKind, lastStatus, target } = options;

  if (lastKind === "network-error") {
    return `[INFO] Waiting for deployed target (${attempt}) after a network error: ${target.origin}${lastError ? ` :: ${lastError}` : ""}`;
  }

  return `[INFO] Waiting for deployed target (${attempt}) after ${lastKind}${lastStatus ? ` HTTP ${lastStatus}` : ""}: ${target.origin}`;
}

export async function waitForDeployedSmokeReadiness(
  target: ResolvedPlaywrightBaseUrl,
  env: PlaywrightEnv = process.env,
  options: WaitForDeployedSmokeReadinessOptions = {},
): Promise<void> {
  const fetchFn = options.fetchFn ?? fetch;
  const logger = options.logger ?? console;
  const now = options.now ?? Date.now;
  const sleep = options.sleep ?? ((ms) => Bun.sleep(ms));
  const timeoutMs = options.timeoutMs ?? DEPLOYED_SMOKE_READY_TIMEOUT_MS;
  const deadline = now() + timeoutMs;
  const headers = buildDeployedSmokeReadinessHeaders(target, env);
  const hasBypassSecret = Boolean(
    trimEnvValue(env.VERCEL_AUTOMATION_BYPASS_SECRET),
  );

  let attempt = 0;
  let lastError: string | undefined;
  let lastKind: Exclude<DeployedSmokeReadinessStatus, "ready"> = "pending";
  let lastStatus: number | undefined;

  while (now() <= deadline) {
    attempt += 1;

    try {
      const response = await fetchFn(target.origin, {
        headers,
        signal: AbortSignal.timeout(DEPLOYED_SMOKE_REQUEST_TIMEOUT_MS),
      });
      const readinessStatus = classifyDeployedSmokeReadinessStatus(
        response.status,
      );

      lastStatus = response.status;
      lastError = undefined;

      if (readinessStatus === "ready") {
        logger.info(`[INFO] Deployed target is reachable: ${target.origin}`);
        return;
      }

      lastKind = readinessStatus;

      if (readinessStatus !== "pending") {
        throw new Error(
          formatDeployedSmokeReadinessError({
            hasBypassSecret,
            lastKind,
            lastStatus,
            target,
          }),
        );
      }
    } catch (error) {
      if (
        error instanceof Error &&
        error.message.startsWith("Deployed smoke target")
      ) {
        throw error;
      }

      lastKind = "network-error";
      lastError = error instanceof Error ? error.message : String(error);
    }

    const remainingMs = deadline - now();

    if (remainingMs <= 0) {
      break;
    }

    const delayMs = Math.min(
      DEPLOYED_SMOKE_MAX_RETRY_DELAY_MS,
      DEPLOYED_SMOKE_INITIAL_RETRY_DELAY_MS * 2 ** (attempt - 1),
      remainingMs,
    );

    logger.info(
      formatDeployedSmokeReadinessWaitMessage({
        attempt,
        lastError,
        lastKind,
        lastStatus,
        target,
      }),
    );
    await sleep(delayMs);
  }

  throw new Error(
    formatDeployedSmokeReadinessError({
      hasBypassSecret,
      lastError,
      lastKind,
      lastStatus,
      target,
      timeoutMs,
    }),
  );
}

export function resolvePlaywrightRunConfiguration(
  mode: PlaywrightRunMode,
  passthroughArgs: readonly string[],
  env: PlaywrightEnv = process.env,
): PlaywrightRunConfiguration {
  const matrixMode =
    mode === "matrix-lite"
      ? "matrix-lite"
      : resolveRequestedProjectMatrix(passthroughArgs);
  const matrixEnvOverrides = getMatrixEnvOverrides(matrixMode);

  switch (mode) {
    case "test-e2e":
      return createRunConfiguration(matrixEnvOverrides);

    case "matrix-lite":
      return createRunConfiguration(matrixEnvOverrides);

    case "local-prod":
      return {
        envOverrides: {
          PLAYWRIGHT_LOCAL_PRODUCTION: "1",
          ...matrixEnvOverrides,
        },
      };

    case "deployed-smoke":
      const deployedSmokeTarget = resolveDeployedSmokeTarget(env);

      return {
        defaultArgs: ["--grep", DEPLOYED_SMOKE_TEST_GREP, "--project=chromium"],
        deployedSmokeTarget,
        envOverrides: {
          PLAYWRIGHT_BASE_URL: deployedSmokeTarget.origin,
        },
      };
  }
}

async function main(argv: readonly string[] = Bun.argv): Promise<never> {
  const mode = resolvePlaywrightRunMode(argv[2]);
  const passthroughArgs = argv.slice(3);

  const configuration = resolvePlaywrightRunConfiguration(
    mode,
    passthroughArgs,
  );

  if (configuration.deployedSmokeTarget) {
    await waitForDeployedSmokeReadiness(configuration.deployedSmokeTarget);
  }

  return runPlaywright({
    ...configuration,
    passthroughArgs,
  });
}

if (import.meta.main) {
  await main();
}

export { main };
