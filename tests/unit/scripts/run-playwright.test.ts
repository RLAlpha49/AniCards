import { afterAll, beforeEach, describe, expect, it } from "bun:test";

import {
  classifyDeployedSmokeReadinessStatus,
  DEPLOYED_SMOKE_TEST_GREP,
  main,
  resolveDeployedSmokeTarget,
  resolvePlaywrightRunConfiguration,
  resolvePlaywrightRunMode,
  resolveRequestedProjectMatrix,
  waitForDeployedSmokeReadiness,
} from "../../../scripts/run-playwright";

const originalAbortSignalTimeout = AbortSignal.timeout;

type BunxInvocation = {
  args: string[];
  env: {
    PLAYWRIGHT_FULL_MATRIX: string | null;
    PLAYWRIGHT_LOCAL_PRODUCTION: string | null;
    PLAYWRIGHT_MATRIX_LITE: string | null;
  };
};

async function runPlaywrightCliProbe(options: {
  args: string[];
  exitCode?: number;
}) {
  const exitCode = options.exitCode ?? 0;
  const originalSpawnSync = Bun.spawnSync;
  const originalProcessExit = process.exit;
  let invocation: BunxInvocation | undefined;

  try {
    Bun.spawnSync = ((spawnOptions: {
      cmd: string[];
      env?: Record<string, string>;
    }) => {
      invocation = {
        args: spawnOptions.cmd.slice(1),
        env: {
          PLAYWRIGHT_FULL_MATRIX:
            spawnOptions.env?.PLAYWRIGHT_FULL_MATRIX ?? null,
          PLAYWRIGHT_LOCAL_PRODUCTION:
            spawnOptions.env?.PLAYWRIGHT_LOCAL_PRODUCTION ?? null,
          PLAYWRIGHT_MATRIX_LITE:
            spawnOptions.env?.PLAYWRIGHT_MATRIX_LITE ?? null,
        },
      };

      return {
        exitCode,
      };
    }) as typeof Bun.spawnSync;

    process.exit = ((code?: number) => {
      throw new Error(`__RUN_PLAYWRIGHT_EXIT__${code ?? 0}`);
    }) as typeof process.exit;

    await expect(
      main(["bun", "scripts/run-playwright.ts", ...options.args]),
    ).rejects.toThrow(`__RUN_PLAYWRIGHT_EXIT__${exitCode}`);

    if (!invocation) {
      throw new Error("Expected Bun.spawnSync to be called.");
    }

    return {
      invocation,
      subprocess: {
        exitCode,
        stderr: new Uint8Array(),
        stdout: new Uint8Array(),
      },
    };
  } finally {
    Bun.spawnSync = originalSpawnSync;
    process.exit = originalProcessExit;
  }
}

describe("run-playwright", () => {
  beforeEach(() => {
    Object.defineProperty(AbortSignal, "timeout", {
      configurable: true,
      value: () => new AbortController().signal,
      writable: true,
    });
  });

  afterAll(() => {
    Object.defineProperty(AbortSignal, "timeout", {
      configurable: true,
      value: originalAbortSignalTimeout,
      writable: true,
    });
  });

  it("keeps the default test run on chromium only", () => {
    expect(resolveRequestedProjectMatrix(["--grep", "home"])).toBe("default");
    expect(
      resolvePlaywrightRunConfiguration("test-e2e", ["--grep", "home"]),
    ).toEqual({});
  });

  it("enables the matrix-lite project set when a non-chromium lite project is requested", () => {
    expect(resolveRequestedProjectMatrix(["--project=mobile-chrome"])).toBe(
      "matrix-lite",
    );
    expect(
      resolvePlaywrightRunConfiguration("test-e2e", [
        "--project=mobile-chrome",
      ]),
    ).toEqual({
      envOverrides: {
        PLAYWRIGHT_MATRIX_LITE: "1",
      },
    });
  });

  it("parses spaced --project arguments across the default, lite, and full matrix branches", () => {
    expect(resolveRequestedProjectMatrix(["--project", "chromium"])).toBe(
      "default",
    );
    expect(resolveRequestedProjectMatrix(["--project", "firefox"])).toBe(
      "matrix-lite",
    );
    expect(resolveRequestedProjectMatrix(["--project", "mobile-safari"])).toBe(
      "full-matrix",
    );
  });

  it("reserves the full matrix for full-only project requests", () => {
    expect(resolveRequestedProjectMatrix(["--project=mobile-safari"])).toBe(
      "full-matrix",
    );
    expect(
      resolvePlaywrightRunConfiguration("test-e2e", [
        "--project=mobile-safari",
      ]),
    ).toEqual({
      envOverrides: {
        PLAYWRIGHT_FULL_MATRIX: "1",
      },
    });
  });

  it("forces the matrix-lite lane for the high-signal local path", () => {
    expect(
      resolvePlaywrightRunConfiguration("matrix-lite", ["--grep", "smoke"]),
    ).toEqual({
      envOverrides: {
        PLAYWRIGHT_MATRIX_LITE: "1",
      },
    });
  });

  it("keeps local production mode on the default chromium lane when no extra project is requested", () => {
    expect(resolvePlaywrightRunConfiguration("local-prod", [])).toEqual({
      envOverrides: {
        PLAYWRIGHT_LOCAL_PRODUCTION: "1",
      },
    });
  });

  it("keeps local production mode while enabling matrix-lite for the Firefox route-suite lane", () => {
    const firefoxRouteSuiteArgs = [
      "tests/e2e/search",
      "tests/e2e/user",
      "--project=firefox",
    ];

    expect(resolveRequestedProjectMatrix(firefoxRouteSuiteArgs)).toBe(
      "matrix-lite",
    );
    expect(
      resolvePlaywrightRunConfiguration("local-prod", firefoxRouteSuiteArgs),
    ).toEqual({
      envOverrides: {
        PLAYWRIGHT_LOCAL_PRODUCTION: "1",
        PLAYWRIGHT_MATRIX_LITE: "1",
      },
    });
  });

  it("configures deployed smoke against the resolved trusted base URL", () => {
    const configuration = resolvePlaywrightRunConfiguration(
      "deployed-smoke",
      [],
      {
        PLAYWRIGHT_BASE_URL: "https://anicards-preview-123.vercel.app",
      },
    );

    expect(configuration.defaultArgs).toEqual([
      "--grep",
      DEPLOYED_SMOKE_TEST_GREP,
      "--project=chromium",
    ]);
    expect(configuration.envOverrides).toEqual({
      PLAYWRIGHT_BASE_URL: "https://anicards-preview-123.vercel.app",
    });
    expect(configuration.deployedSmokeTarget).toMatchObject({
      canSendBypassHeaders: true,
      isTrustedAniCardsHost: true,
      origin: "https://anicards-preview-123.vercel.app",
    });
  });

  it("rejects deployed smoke runs when PLAYWRIGHT_BASE_URL is missing", () => {
    expect(() =>
      resolvePlaywrightRunConfiguration("deployed-smoke", [], {}),
    ).toThrow(/PLAYWRIGHT_BASE_URL is required/i);
  });

  it("rejects missing and invalid run modes before launching Playwright", () => {
    expect(() => resolvePlaywrightRunMode(undefined)).toThrow(
      /Missing Playwright run mode/i,
    );
    expect(() => resolvePlaywrightRunMode("preview-smoke")).toThrow(
      /Invalid Playwright run mode/i,
    );
  });

  it("classifies deployed smoke readiness statuses", () => {
    expect(classifyDeployedSmokeReadinessStatus(200)).toBe("ready");
    expect(classifyDeployedSmokeReadinessStatus(403)).toBe("protected");
    expect(classifyDeployedSmokeReadinessStatus(503)).toBe("pending");
    expect(classifyDeployedSmokeReadinessStatus(418)).toBe("http-error");
  });

  it("treats external Vercel protection redirects as protected and probes with manual redirect handling", async () => {
    const target = resolveDeployedSmokeTarget({
      PLAYWRIGHT_BASE_URL: "https://anicards-preview-123.vercel.app",
    });
    let receivedInit: RequestInit | undefined;

    await expect(
      waitForDeployedSmokeReadiness(
        target,
        {},
        {
          fetchFn: async (_input, init) => {
            receivedInit = init;

            return new Response("", {
              status: 302,
              headers: {
                location:
                  "https://vercel.com/sso-api?url=https://anicards-preview-123.vercel.app/",
              },
            });
          },
          logger: { info: () => {} },
          now: () => 0,
          sleep: async () => {},
          timeoutMs: 1,
        },
      ),
    ).rejects.toThrow(/VERCEL_AUTOMATION_BYPASS_SECRET/i);

    expect(receivedInit?.redirect).toBe("manual");
  });

  it("accepts same-origin redirects as reachable deployed smoke responses", async () => {
    const target = resolveDeployedSmokeTarget({
      PLAYWRIGHT_BASE_URL: "https://anicards-preview-123.vercel.app",
    });

    await expect(
      waitForDeployedSmokeReadiness(
        target,
        {},
        {
          fetchFn: async () =>
            new Response("", {
              status: 307,
              headers: {
                location: "/search",
              },
            }),
          logger: { info: () => {} },
          now: () => 0,
          sleep: async () => {},
          timeoutMs: 1,
        },
      ),
    ).resolves.toBeUndefined();
  });

  it("treats malformed redirect targets as http errors", async () => {
    const target = resolveDeployedSmokeTarget({
      PLAYWRIGHT_BASE_URL: "https://anicards-preview-123.vercel.app",
    });

    await expect(
      waitForDeployedSmokeReadiness(
        target,
        {
          VERCEL_AUTOMATION_BYPASS_SECRET: "test-secret",
        },
        {
          fetchFn: async () =>
            new Response("", {
              status: 302,
              headers: {
                location: "https://[",
              },
            }),
          logger: { info: () => {} },
          now: () => 0,
          sleep: async () => {},
          timeoutMs: 1,
        },
      ),
    ).rejects.toThrow(/unexpected HTTP 302/i);
  });

  it("retries retryable deployed smoke responses until the target becomes reachable", async () => {
    const target = resolveDeployedSmokeTarget({
      PLAYWRIGHT_BASE_URL: "https://anicards-preview-123.vercel.app",
    });
    let attempts = 0;
    let now = 0;

    await waitForDeployedSmokeReadiness(
      target,
      {},
      {
        fetchFn: async () => {
          attempts += 1;

          return new Response("", {
            status: attempts < 3 ? 503 : 200,
          });
        },
        logger: { info: () => {} },
        now: () => now,
        sleep: async (delayMs) => {
          now += delayMs;
        },
        timeoutMs: 30_000,
      },
    );

    expect(attempts).toBe(3);
  });

  it("surfaces a protection-specific error when preview bypass credentials are missing", async () => {
    const target = resolveDeployedSmokeTarget({
      PLAYWRIGHT_BASE_URL: "https://anicards-preview-123.vercel.app",
    });

    await expect(
      waitForDeployedSmokeReadiness(
        target,
        {},
        {
          fetchFn: async () => new Response("", { status: 403 }),
          logger: { info: () => {} },
          now: () => 0,
          sleep: async () => {},
          timeoutMs: 1,
        },
      ),
    ).rejects.toThrow(/VERCEL_AUTOMATION_BYPASS_SECRET/i);
  });

  it("surfaces unexpected http readiness failures with the last status", async () => {
    const target = resolveDeployedSmokeTarget({
      PLAYWRIGHT_BASE_URL: "https://anicards-preview-123.vercel.app",
    });

    await expect(
      waitForDeployedSmokeReadiness(
        target,
        {
          VERCEL_AUTOMATION_BYPASS_SECRET: "test-secret",
        },
        {
          fetchFn: async () => new Response("", { status: 418 }),
          logger: { info: () => {} },
          now: () => 0,
          sleep: async () => {},
          timeoutMs: 1,
        },
      ),
    ).rejects.toThrow(/unexpected HTTP 418/i);
  });

  it("reports network readiness failures with wait logging and the last error detail", async () => {
    const target = resolveDeployedSmokeTarget({
      PLAYWRIGHT_BASE_URL: "https://anicards-preview-123.vercel.app",
    });
    const messages: string[] = [];
    let now = 0;

    await expect(
      waitForDeployedSmokeReadiness(
        target,
        {},
        {
          fetchFn: async () => {
            throw new Error("socket hang up");
          },
          logger: {
            info: (message) => {
              messages.push(message);
            },
          },
          now: () => now,
          sleep: async (delayMs) => {
            now += delayMs;
          },
          timeoutMs: 2_500,
        },
      ),
    ).rejects.toThrow(/socket hang up/i);

    expect(messages).toEqual(
      expect.arrayContaining([
        expect.stringMatching(
          /waiting for deployed target \(1\) after a network error/i,
        ),
      ]),
    );
    expect(messages.at(0)).toMatch(/socket hang up/i);
  });

  it("reports the last retryable status when deployed smoke never becomes ready", async () => {
    const target = resolveDeployedSmokeTarget({
      PLAYWRIGHT_BASE_URL: "https://anicards-preview-123.vercel.app",
    });
    let now = 0;

    await expect(
      waitForDeployedSmokeReadiness(
        target,
        {
          VERCEL_AUTOMATION_BYPASS_SECRET: "test-secret",
        },
        {
          fetchFn: async () => new Response("", { status: 503 }),
          logger: { info: () => {} },
          now: () => now,
          sleep: async (delayMs) => {
            now += delayMs;
          },
          timeoutMs: 2_500,
        },
      ),
    ).rejects.toThrow(/did not become ready.*503/i);
  });

  it("launches Playwright through bunx with passthrough args and matrix env overrides", async () => {
    const { invocation, subprocess } = await runPlaywrightCliProbe({
      args: [
        "test-e2e",
        "tests/e2e/user/user-mobile.spec.ts",
        "--project",
        "firefox",
      ],
      exitCode: 17,
    });

    expect(subprocess.exitCode).toBe(17);
    expect(new TextDecoder().decode(subprocess.stderr).trim()).toBe("");
    expect(invocation.args).toEqual([
      "playwright",
      "test",
      "tests/e2e/user/user-mobile.spec.ts",
      "--project",
      "firefox",
    ]);
    expect(invocation.env).toEqual({
      PLAYWRIGHT_FULL_MATRIX: null,
      PLAYWRIGHT_LOCAL_PRODUCTION: null,
      PLAYWRIGHT_MATRIX_LITE: "1",
    });
  });
});
