import { parseTrustedAniCardsBaseUrl } from "../lib/playwright-base-url";

type PlaywrightRunMode = "deployed-smoke" | "local-prod";

const DEPLOYED_SMOKE_SPEC = "tests/e2e/smoke/unmocked-app-shell.spec.ts";

const mode = Bun.argv[2] as PlaywrightRunMode | undefined;
const passthroughArgs = Bun.argv.slice(3);

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
}): never {
  const result = Bun.spawnSync({
    cmd: [
      "bunx",
      "playwright",
      "test",
      ...(options.defaultArgs ?? []),
      ...passthroughArgs,
    ],
    env: createSpawnEnvironment(options.envOverrides ?? {}),
    stdin: "inherit",
    stderr: "inherit",
    stdout: "inherit",
  });

  process.exit(result.exitCode ?? 1);
}

function resolveDeployedSmokeBaseUrl(): string {
  const rawBaseUrl = process.env.PLAYWRIGHT_BASE_URL?.trim();
  if (!rawBaseUrl) {
    throw new Error("PLAYWRIGHT_BASE_URL is required for deployed smoke runs.");
  }

  return parseTrustedAniCardsBaseUrl(rawBaseUrl, "PLAYWRIGHT_BASE_URL").origin;
}

switch (mode) {
  case "deployed-smoke":
    runPlaywright({
      defaultArgs: [DEPLOYED_SMOKE_SPEC, "--project=chromium"],
      envOverrides: {
        PLAYWRIGHT_BASE_URL: resolveDeployedSmokeBaseUrl(),
      },
    });
  case "local-prod":
    runPlaywright({
      envOverrides: {
        PLAYWRIGHT_LOCAL_PRODUCTION: "1",
      },
    });
  default: {
    const supportedModes = ["deployed-smoke", "local-prod"].join(", ");
    throw new Error(
      `Unknown Playwright run mode: ${mode ?? "(missing)"}. Expected one of: ${supportedModes}.`,
    );
  }
}
