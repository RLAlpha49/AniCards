import { parseTrustedAniCardsBaseUrl } from "../lib/playwright-base-url";

type PlaywrightRunMode = "test-e2e" | "deployed-smoke" | "local-prod";

type PlaywrightRunConfiguration = {
  defaultArgs?: string[];
  envOverrides?: Record<string, string | undefined>;
};

const DEPLOYED_SMOKE_SPEC = "tests/e2e/smoke/unmocked-app-shell.spec.ts";

function isEnabledFlag(value: string | undefined): boolean {
  return value === "1" || value?.toLowerCase() === "true";
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

export function shouldEnableFullMatrix(argv: readonly string[]): boolean {
  return getRequestedProjects(argv).some(
    (projectName) => projectName !== "chromium",
  );
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

export function resolvePlaywrightRunConfiguration(
  mode: PlaywrightRunMode,
  passthroughArgs: readonly string[],
): PlaywrightRunConfiguration {
  const shouldEnableMatrix = shouldEnableFullMatrix(passthroughArgs);

  switch (mode) {
    case "test-e2e":
      return shouldEnableMatrix
        ? {
            envOverrides: {
              PLAYWRIGHT_FULL_MATRIX: "1",
            },
          }
        : {};

    case "local-prod":
      return {
        envOverrides: {
          PLAYWRIGHT_LOCAL_PRODUCTION: "1",
          ...(shouldEnableMatrix ? { PLAYWRIGHT_FULL_MATRIX: "1" } : {}),
        },
      };

    case "deployed-smoke":
      return {
        defaultArgs: [DEPLOYED_SMOKE_SPEC, "--project=chromium"],
        envOverrides: {
          PLAYWRIGHT_BASE_URL: resolveDeployedSmokeBaseUrl(),
        },
      };
  }
}

function resolveDeployedSmokeBaseUrl(): string {
  const rawBaseUrl = process.env.PLAYWRIGHT_BASE_URL?.trim();
  if (!rawBaseUrl) {
    throw new Error("PLAYWRIGHT_BASE_URL is required for deployed smoke runs.");
  }

  return parseTrustedAniCardsBaseUrl(rawBaseUrl, "PLAYWRIGHT_BASE_URL").origin;
}

function main(argv: readonly string[] = Bun.argv): never {
  const mode = argv[2] as PlaywrightRunMode | undefined;
  const passthroughArgs = argv.slice(3);

  if (!mode) {
    throw new Error(
      "Missing Playwright run mode. Expected one of: test-e2e, local-prod, deployed-smoke.",
    );
  }

  const configuration = resolvePlaywrightRunConfiguration(
    mode,
    passthroughArgs,
  );

  runPlaywright({
    ...configuration,
    passthroughArgs,
  });
}

if (import.meta.main) {
  main();
}

export { main };
