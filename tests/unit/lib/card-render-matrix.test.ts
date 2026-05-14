import { fileURLToPath } from "node:url";

import { describe, expect, it } from "bun:test";
import { z } from "zod";

import {
  CARD_RENDER_MATRIX_CASE_COUNT,
  cardRenderMatrixCases,
} from "@/tests/shared/card-render-matrix";

const MATRIX_PROBE_FILE_PATH = fileURLToPath(
  new URL("./card-render-matrix-subprocess.ts", import.meta.url),
);
const MATRIX_TARGETED_PROBE_FILE_PATH = fileURLToPath(
  new URL("./card-render-matrix-targeted-subprocess.ts", import.meta.url),
);
const SUBPROCESS_TIMEOUT_MS = 10_000;

const matrixProbeResultSchema = z.object({
  caseCount: z.number(),
  failures: z.array(z.string()),
});

const matrixProbeFailuresSchema = matrixProbeResultSchema.pick({
  failures: true,
});

function handleSubprocessResult<T>(
  subprocess: { exitCode: number; stderr: Uint8Array; stdout: Uint8Array },
  schema: z.ZodType<T>,
): T {
  const stdout = new TextDecoder().decode(subprocess.stdout).trim();
  const stderr = new TextDecoder().decode(subprocess.stderr).trim();

  expect(subprocess.exitCode).toBe(0);
  expect(stderr).toBe("");

  const jsonLine = stdout.split(/\r?\n/).at(-1);

  if (!jsonLine) {
    throw new Error("Matrix probe did not emit JSON output");
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(jsonLine);
  } catch (error) {
    throw new Error(
      `Matrix probe emitted invalid JSON: ${jsonLine}\n${
        error instanceof Error ? error.message : String(error)
      }`,
    );
  }

  const validation = schema.safeParse(parsed);
  if (!validation.success) {
    const issues = validation.error.issues
      .map((issue) => {
        const path = issue.path.length > 0 ? issue.path.join(".") : "<root>";
        return `${path}: ${issue.message}`;
      })
      .join("; ");

    throw new Error(
      `Matrix probe JSON failed validation: ${jsonLine}\n${issues}`,
    );
  }

  return validation.data;
}

function runMatrixProbeFile<T>(probeFilePath: string, schema: z.ZodType<T>): T {
  const subprocess = Bun.spawnSync({
    cmd: [process.execPath, "run", probeFilePath],
    cwd: process.cwd(),
    stdout: "pipe",
    stderr: "pipe",
  });

  return handleSubprocessResult(subprocess, schema);
}

describe("card render matrix", () => {
  it(
    "renders every registered card and variant with the pretext stress fixture",
    () => {
      expect(CARD_RENDER_MATRIX_CASE_COUNT).toBe(cardRenderMatrixCases.length);

      const result = runMatrixProbeFile(
        MATRIX_PROBE_FILE_PATH,
        matrixProbeResultSchema,
      );

      expect(result.caseCount).toBe(CARD_RENDER_MATRIX_CASE_COUNT);
      expect(result.failures).toEqual([]);
    },
    SUBPROCESS_TIMEOUT_MS,
  );

  it(
    "renders the previously missing aggregate-driven variants with real stressed labels",
    () => {
      const result = runMatrixProbeFile(
        MATRIX_TARGETED_PROBE_FILE_PATH,
        matrixProbeFailuresSchema,
      );

      expect(result.failures).toEqual([]);
    },
    SUBPROCESS_TIMEOUT_MS,
  );
});
