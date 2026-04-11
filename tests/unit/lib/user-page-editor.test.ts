import { fileURLToPath } from "node:url";

import { describe, expect, it } from "bun:test";

const isolatedTestPath = fileURLToPath(
  new URL("./user-page-editor.isolated.ts", import.meta.url),
);
const repoRoot = fileURLToPath(new URL("../../../", import.meta.url));
const decoder = new TextDecoder();

describe("user-page-editor store", () => {
  it("passes the isolated regression suite", () => {
    const result = Bun.spawnSync({
      cmd: [process.execPath, "test", isolatedTestPath],
      cwd: repoRoot,
      env: process.env,
      stderr: "pipe",
      stdout: "pipe",
    });

    const output =
      `${decoder.decode(result.stdout)}${decoder.decode(result.stderr)}`.trim();

    if (result.exitCode !== 0) {
      throw new Error(
        output ||
          `Isolated user-page-editor regression suite failed with exit code ${result.exitCode}.`,
      );
    }

    expect(result.exitCode).toBe(0);
  });
});
