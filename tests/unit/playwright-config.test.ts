import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "bun:test";

const PLAYWRIGHT_CONFIG_MODULE_URL = new URL(
  "../../playwright.config.ts",
  import.meta.url,
);

type PlaywrightConfigModule = typeof import("../../playwright.config");

type EnvLoadProbeResult = {
  loadedPaths: string[];
  value: string | null;
};

function createEnvFixtureDirectory(files: Record<string, string>): string {
  const fixtureDirectory = mkdtempSync(
    join(tmpdir(), "anicards-playwright-config-"),
  );

  for (const [fileName, content] of Object.entries(files)) {
    writeFileSync(join(fixtureDirectory, fileName), content, "utf8");
  }

  return fixtureDirectory;
}

async function importPlaywrightConfigModule(
  cacheKey: string,
): Promise<PlaywrightConfigModule> {
  const moduleUrl = new URL(PLAYWRIGHT_CONFIG_MODULE_URL.href);
  moduleUrl.searchParams.set("case", cacheKey);

  return (await import(moduleUrl.href)) as PlaywrightConfigModule;
}

function runEnvLoadProbe(options: {
  cacheKey: string;
  fixtureDirectory: string;
  nodeEnv: string;
}): EnvLoadProbeResult {
  const probeFilePath = join(
    options.fixtureDirectory,
    `playwright-config-env-probe-${options.cacheKey}.ts`,
  );
  const probeScript = `
process.env.NODE_ENV = ${JSON.stringify(options.nodeEnv)};
process.env.PLAYWRIGHT_SKIP_ENV_AUTOLOAD = "1";

const moduleUrl = new URL(${JSON.stringify(PLAYWRIGHT_CONFIG_MODULE_URL.href)});
moduleUrl.searchParams.set("case", ${JSON.stringify(options.cacheKey)});

const module = await import(moduleUrl.href);
const loaded = module.loadPlaywrightEnv(process.cwd());

console.log(JSON.stringify({
  loadedPaths: loaded.loadedEnvFiles.map((file) => file.path),
  value: process.env.PLAYWRIGHT_SAMPLE_ENV ?? null,
}));
`;

  writeFileSync(probeFilePath, probeScript, "utf8");

  const subprocess = Bun.spawnSync({
    cmd: [process.execPath, "--no-env-file", "run", probeFilePath],
    cwd: options.fixtureDirectory,
    stderr: "pipe",
    stdout: "pipe",
  });

  const stdout = new TextDecoder().decode(subprocess.stdout).trim();
  const stderr = new TextDecoder().decode(subprocess.stderr).trim();

  expect(subprocess.exitCode).toBe(0);
  expect(stderr).toBe("");

  return JSON.parse(stdout) as EnvLoadProbeResult;
}

describe("playwright.config", () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    process.env = {
      ...originalEnv,
      PLAYWRIGHT_SKIP_ENV_AUTOLOAD: "1",
    };
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it("loads env files with Next.js development precedence", async () => {
    const fixtureDirectory = createEnvFixtureDirectory({
      ".env": "PLAYWRIGHT_SAMPLE_ENV=from-env\n",
      ".env.local": "PLAYWRIGHT_SAMPLE_ENV=from-local\n",
      ".env.development": "PLAYWRIGHT_SAMPLE_ENV=from-development\n",
      ".env.development.local":
        "PLAYWRIGHT_SAMPLE_ENV=from-development-local\n",
    });

    try {
      const loaded = runEnvLoadProbe({
        cacheKey: "env-development",
        fixtureDirectory,
        nodeEnv: "development",
      });

      expect(loaded.value).toBe("from-development-local");
      expect(loaded.loadedPaths).toEqual([
        ".env.development.local",
        ".env.local",
        ".env.development",
        ".env",
      ]);
    } finally {
      rmSync(fixtureDirectory, { force: true, recursive: true });
    }
  });

  it("matches Next.js test-mode loading and skips .env.local", async () => {
    const fixtureDirectory = createEnvFixtureDirectory({
      ".env": "PLAYWRIGHT_SAMPLE_ENV=from-env\n",
      ".env.local": "PLAYWRIGHT_SAMPLE_ENV=from-local\n",
      ".env.test": "PLAYWRIGHT_SAMPLE_ENV=from-test\n",
      ".env.test.local": "PLAYWRIGHT_SAMPLE_ENV=from-test-local\n",
    });

    try {
      const loaded = runEnvLoadProbe({
        cacheKey: "env-test",
        fixtureDirectory,
        nodeEnv: "test",
      });

      expect(loaded.value).toBe("from-test-local");
      expect(loaded.loadedPaths).toEqual([
        ".env.test.local",
        ".env.test",
        ".env",
      ]);
    } finally {
      rmSync(fixtureDirectory, { force: true, recursive: true });
    }
  });

  it("defaults to the local chromium project with a dev server", async () => {
    const module = await importPlaywrightConfigModule("default-local");
    const config = module.createPlaywrightConfig({});

    expect(config.projects?.map((project) => project.name)).toEqual([
      "chromium",
    ]);
    expect(config.webServer).toEqual(
      expect.objectContaining({
        command: "bun run dev",
        reuseExistingServer: true,
        timeout: 120_000,
        url: module.DEFAULT_PLAYWRIGHT_BASE_URL,
      }),
    );
    expect(config.use?.baseURL).toBe(module.DEFAULT_PLAYWRIGHT_BASE_URL);
    expect(config.use?.extraHTTPHeaders).toBeUndefined();

    const chromiumProject = config.projects?.[0];
    expect(chromiumProject?.testIgnore).toEqual([
      module.PLAYWRIGHT_MOBILE_ONLY_TEST_MATCH,
    ]);
  });

  it("switches to local production boot mode when requested", async () => {
    const module = await importPlaywrightConfigModule("local-production");
    const config = module.createPlaywrightConfig({
      PLAYWRIGHT_LOCAL_PRODUCTION: "1",
    });

    expect(config.webServer).toEqual(
      expect.objectContaining({
        command: "bun run build && bun run start",
        reuseExistingServer: false,
        timeout: 300_000,
      }),
    );
  });

  it("uses the full standard browser matrix in CI", async () => {
    const module = await importPlaywrightConfigModule("ci-standard-matrix");
    const config = module.createPlaywrightConfig({ CI: "true" });

    expect(config.projects?.map((project) => project.name)).toEqual([
      "chromium",
      "mobile-chrome",
      "firefox",
    ]);
    expect(config.webServer).toEqual(
      expect.objectContaining({
        command: "bun run start",
        reuseExistingServer: false,
      }),
    );
  });

  it("normalizes trusted preview URLs and sends only approved bypass headers", async () => {
    const module = await importPlaywrightConfigModule("trusted-preview");
    const config = module.createPlaywrightConfig({
      PLAYWRIGHT_BASE_URL:
        "https://anicards-git-main-alpha49.vercel.app/path?build=123",
      VERCEL_AUTOMATION_BYPASS_SECRET: "preview-secret",
    });

    expect(config.webServer).toBeUndefined();
    expect(config.use?.baseURL).toBe(
      "https://anicards-git-main-alpha49.vercel.app",
    );
    expect(config.use?.extraHTTPHeaders).toEqual({
      "x-vercel-protection-bypass": "preview-secret",
      "x-vercel-set-bypass-cookie": "true",
    });
  });

  it("refuses to send bypass headers to untrusted external hosts", async () => {
    const module = await importPlaywrightConfigModule("untrusted-preview");
    const config = module.createPlaywrightConfig({
      PLAYWRIGHT_BASE_URL: "https://example.com/not-anicards",
      VERCEL_AUTOMATION_BYPASS_SECRET: "preview-secret",
    });

    expect(config.webServer).toBeUndefined();
    expect(config.use?.baseURL).toBe("https://example.com");
    expect(config.use?.extraHTTPHeaders).toBeUndefined();
  });

  it("requires trusted AniCards hosts for deployed smoke base URLs", async () => {
    const module = await importPlaywrightConfigModule("trusted-smoke-base-url");

    expect(
      module.parseTrustedAniCardsBaseUrl(
        "https://anicards-git-main-alpha49.vercel.app/path?build=123",
      ).origin,
    ).toBe("https://anicards-git-main-alpha49.vercel.app");

    expect(() =>
      module.parseTrustedAniCardsBaseUrl("https://example.com/not-anicards"),
    ).toThrow(/AniCards production host or an AniCards Vercel preview host/i);
  });

  it("rejects invalid external base URLs", async () => {
    const module = await importPlaywrightConfigModule("invalid-base-url");

    expect(() =>
      module.createPlaywrightConfig({
        PLAYWRIGHT_BASE_URL: "mailto:ops@example.com",
      }),
    ).toThrow(/PLAYWRIGHT_BASE_URL must use http\(s\)/i);

    expect(() =>
      module.createPlaywrightConfig({
        PLAYWRIGHT_BASE_URL: "https://user:pass@example.com",
      }),
    ).toThrow(/must not include embedded credentials/i);
  });
});
