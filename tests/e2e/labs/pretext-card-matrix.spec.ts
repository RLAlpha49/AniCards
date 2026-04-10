import { spawn } from "node:child_process";
import {
  mkdir,
  open,
  readFile,
  rename,
  rm,
  stat,
  writeFile,
} from "node:fs/promises";
import { join } from "node:path";
import { setTimeout as delay } from "node:timers/promises";

import { expect, test } from "@playwright/test";
import { z } from "zod";

import { CARD_RENDER_MATRIX_CASE_COUNT } from "@/tests/shared/card-render-matrix";

const TEXT_BOUNDARY_TOLERANCE_PX = 4;
const TEXT_MIN_HORIZONTAL_GAP_PX = 2;
const VERTICAL_OVERLAP_ROW_THRESHOLD = 0.35;
const PROBE_TIMEOUT_MS = 240_000;
const MATRIX_CACHE_DIR = join(
  process.cwd(),
  ".artifacts",
  "playwright-test-results",
  "shared-probe-cache",
);
const MATRIX_CACHE_PATH = join(MATRIX_CACHE_DIR, "pretext-card-matrix.json");
const MATRIX_CACHE_LOCK_PATH = `${MATRIX_CACHE_PATH}.lock`;
const MATRIX_CACHE_LOCK_STALE_MS = PROBE_TIMEOUT_MS + 60_000;
const MATRIX_CACHE_POLL_MS = 250;

const renderedMatrixCardSchema = z.object({
  cardId: z.string(),
  cardLabel: z.string(),
  svg: z.string(),
  variation: z.string(),
  variationLabel: z.string(),
});

const renderedMatrixCardsSchema = z.array(renderedMatrixCardSchema);

type RenderedMatrixCards = z.infer<typeof renderedMatrixCardsSchema>;

function hasErrorCode(error: unknown, code: string): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as NodeJS.ErrnoException).code === code
  );
}

function escapeHtml(value: string): string {
  return value.replaceAll(/[&<>"']/g, (char) => {
    switch (char) {
      case "&":
        return "&amp;";
      case "<":
        return "&lt;";
      case ">":
        return "&gt;";
      case '"':
        return "&quot;";
      case "'":
        return "&#39;";
      default:
        return char;
    }
  });
}

function runProbeScript(
  probeScript: string,
): Promise<{ stderr: string; stdout: string }> {
  return new Promise((resolve, reject) => {
    const subprocess = spawn("bun", ["run", "-"], {
      cwd: process.cwd(),
      windowsHide: true,
      stdio: ["pipe", "pipe", "pipe"],
    });

    let stdout = "";
    let stderr = "";
    let settled = false;
    let timeoutId: ReturnType<typeof setTimeout> | undefined;

    subprocess.stdout.setEncoding("utf8");
    subprocess.stderr.setEncoding("utf8");

    const stdoutHandler = (chunk: string) => {
      stdout += chunk;
    };

    const stderrHandler = (chunk: string) => {
      stderr += chunk;
    };

    const cleanup = () => {
      if (timeoutId) {
        clearTimeout(timeoutId);
        timeoutId = undefined;
      }

      subprocess.stdout.off("data", stdoutHandler);
      subprocess.stderr.off("data", stderrHandler);
      subprocess.off("error", errorHandler);
      subprocess.off("close", closeHandler);
      subprocess.stdin.destroy();
    };

    const finishReject = (error: Error) => {
      if (settled) {
        return;
      }

      settled = true;
      cleanup();
      reject(error);
    };

    const finishResolve = (result: { stderr: string; stdout: string }) => {
      if (settled) {
        return;
      }

      settled = true;
      cleanup();
      resolve(result);
    };

    const errorHandler = (error: Error) => {
      finishReject(error);
    };

    const closeHandler = (
      code: number | null,
      signal: NodeJS.Signals | null,
    ) => {
      if (code !== 0) {
        const signalSuffix = signal ? ` (signal ${signal})` : "";

        finishReject(
          new Error(
            `Matrix render probe failed with exit code ${code ?? "unknown"}${signalSuffix}\n${stderr.trim()}`,
          ),
        );
        return;
      }

      finishResolve({ stdout, stderr });
    };

    subprocess.stdout.on("data", stdoutHandler);
    subprocess.stderr.on("data", stderrHandler);
    subprocess.on("error", errorHandler);
    subprocess.on("close", closeHandler);

    timeoutId = setTimeout(() => {
      subprocess.kill();
      finishReject(
        new Error(
          `Matrix render probe timed out after ${PROBE_TIMEOUT_MS}ms and was terminated`,
        ),
      );
    }, PROBE_TIMEOUT_MS);

    subprocess.stdin.end(probeScript);
  });
}

function parseRenderedMatrixCardsJson(
  jsonPayload: string,
  sourceLabel: string,
): RenderedMatrixCards {
  let parsed: unknown;
  try {
    parsed = JSON.parse(jsonPayload);
  } catch (error) {
    throw new Error(
      `${sourceLabel} emitted invalid JSON: ${jsonPayload}\n${error instanceof Error ? error.message : String(error)}`,
    );
  }

  const validation = renderedMatrixCardsSchema.safeParse(parsed);
  if (!validation.success) {
    const issues = validation.error.issues
      .map((issue) => {
        const path = issue.path.length > 0 ? issue.path.join(".") : "<root>";
        return `${path}: ${issue.message}`;
      })
      .join("; ");

    throw new Error(
      `${sourceLabel} JSON failed validation: ${jsonPayload}\n${issues}`,
    );
  }

  return validation.data;
}

function extractProbeJsonPayload(stdout: string, stderr: string): string {
  const trimmedStdout = stdout.trim();
  const trimmedStderr = stderr.trim();

  expect(trimmedStderr).toBe("");

  const jsonStartMarker = "---JSON_START---";
  const jsonEndMarker = "---JSON_END---";
  const jsonStartIndex = trimmedStdout.indexOf(jsonStartMarker);
  const jsonEndIndex = trimmedStdout.indexOf(jsonEndMarker);
  if (
    jsonStartIndex === -1 ||
    jsonEndIndex === -1 ||
    jsonEndIndex <= jsonStartIndex
  ) {
    throw new Error(
      `Matrix render probe did not emit marked JSON output: ${trimmedStdout}`,
    );
  }

  const jsonPayload = trimmedStdout
    .slice(jsonStartIndex + jsonStartMarker.length, jsonEndIndex)
    .trim();

  if (!jsonPayload) {
    throw new Error("Matrix render probe emitted an empty JSON payload");
  }

  return jsonPayload;
}

async function readCachedMatrixCards(): Promise<RenderedMatrixCards | null> {
  try {
    const cachedJson = await readFile(MATRIX_CACHE_PATH, "utf8");
    return parseRenderedMatrixCardsJson(cachedJson, "Matrix render cache");
  } catch (error) {
    if (hasErrorCode(error, "ENOENT")) {
      return null;
    }

    if (error instanceof Error) {
      await rm(MATRIX_CACHE_PATH, { force: true });
      return null;
    }

    throw error;
  }
}

async function tryAcquireMatrixCacheLock() {
  await mkdir(MATRIX_CACHE_DIR, { recursive: true });

  try {
    return await open(MATRIX_CACHE_LOCK_PATH, "wx");
  } catch (error) {
    if (hasErrorCode(error, "EEXIST")) {
      return null;
    }

    throw error;
  }
}

async function clearStaleMatrixCacheLockIfNeeded(): Promise<void> {
  try {
    const lockStats = await stat(MATRIX_CACHE_LOCK_PATH);
    if (Date.now() - lockStats.mtimeMs > MATRIX_CACHE_LOCK_STALE_MS) {
      await rm(MATRIX_CACHE_LOCK_PATH, { force: true });
    }
  } catch (error) {
    if (hasErrorCode(error, "ENOENT")) {
      return;
    }

    throw error;
  }
}

async function writeCachedMatrixCards(
  cards: RenderedMatrixCards,
): Promise<void> {
  await mkdir(MATRIX_CACHE_DIR, { recursive: true });

  const tempCachePath = `${MATRIX_CACHE_PATH}.${process.pid}.tmp`;

  try {
    await writeFile(tempCachePath, JSON.stringify(cards), "utf8");
    await rm(MATRIX_CACHE_PATH, { force: true });
    await rename(tempCachePath, MATRIX_CACHE_PATH);
  } finally {
    await rm(tempCachePath, { force: true });
  }
}

async function renderMatrixCards(): Promise<RenderedMatrixCards> {
  const probeScript = `
import { mockPretextStressUserRecord } from "@/tests/e2e/fixtures/pretext-stress-data";
import { cardRenderMatrixCases, createCardRenderMatrixConfig } from "@/tests/shared/card-render-matrix";

const { default: generateCardSvg } = await import("@/lib/card-generator");

const renderedCards = [];

for (const matrixCase of cardRenderMatrixCases) {
  const svg = await generateCardSvg(
    createCardRenderMatrixConfig(matrixCase.cardId, matrixCase.variation),
    mockPretextStressUserRecord,
    matrixCase.variation,
    undefined,
    { animationsEnabled: false },
  );

  renderedCards.push({
    ...matrixCase,
    svg: svg.replace(/^<!--ANICARDS_TRUSTED_SVG-->/, ""),
  });
}

console.log("---JSON_START---");
console.log(JSON.stringify(renderedCards));
console.log("---JSON_END---");
`;

  const deadline = Date.now() + PROBE_TIMEOUT_MS;

  while (Date.now() < deadline) {
    const cachedCards = await readCachedMatrixCards();
    if (cachedCards) {
      return cachedCards;
    }

    const lockHandle = await tryAcquireMatrixCacheLock();
    if (!lockHandle) {
      await clearStaleMatrixCacheLockIfNeeded();
      await delay(MATRIX_CACHE_POLL_MS);
      continue;
    }

    try {
      const cachedAfterLock = await readCachedMatrixCards();
      if (cachedAfterLock) {
        return cachedAfterLock;
      }

      const { stdout, stderr } = await runProbeScript(probeScript);
      const renderedCards = parseRenderedMatrixCardsJson(
        extractProbeJsonPayload(stdout, stderr),
        "Matrix render probe",
      );

      await writeCachedMatrixCards(renderedCards);
      return renderedCards;
    } finally {
      await lockHandle.close();
      await rm(MATRIX_CACHE_LOCK_PATH, { force: true });
    }
  }

  throw new Error(
    `Timed out waiting for shared matrix render cache after ${PROBE_TIMEOUT_MS}ms`,
  );
}

function buildMatrixHtml(cards: RenderedMatrixCards): string {
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <title>Pretext Card Matrix</title>
    <style>
      :root {
        color-scheme: dark;
      }

      * {
        box-sizing: border-box;
      }

      body {
        margin: 0;
        background: #020617;
        color: #e2e8f0;
        font-family: "Segoe UI", Ubuntu, sans-serif;
      }

      main {
        padding: 24px;
      }

      .matrix {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(360px, max-content));
        gap: 20px;
        align-items: start;
      }

      .card-shell {
        border: 1px solid rgba(56, 189, 248, 0.25);
        background: rgba(15, 23, 42, 0.92);
        padding: 14px;
        border-radius: 16px;
        width: max-content;
      }

      .card-meta {
        margin: 0 0 10px;
        display: flex;
        flex-direction: column;
        gap: 2px;
      }

      .card-meta strong {
        font-size: 13px;
      }

      .card-meta span {
        font-size: 11px;
        color: #94a3b8;
      }

      .card-svg {
        display: inline-block;
        line-height: 0;
      }

      .card-svg svg {
        display: block;
      }
    </style>
  </head>
  <body>
    <main>
      <div class="matrix">
        ${cards
          .map(
            (card) => `
              <section class="card-shell" data-card-id="${escapeHtml(card.cardId)}" data-card-label="${escapeHtml(card.cardLabel)}" data-variation="${escapeHtml(card.variation)}">
                <p class="card-meta">
                  <strong>${escapeHtml(card.cardLabel)}</strong>
                  <span>${escapeHtml(card.variationLabel)}</span>
                </p>
                <!-- card.svg is generated by the trusted renderer and already contains the SVG markup we want to inspect. -->
                <div class="card-svg">${card.svg}</div>
              </section>
            `,
          )
          .join("")}
      </div>
    </main>
  </body>
</html>`;
}

test.describe("pretext card matrix browser audit", () => {
  test.describe.configure({ timeout: PROBE_TIMEOUT_MS + 60_000 });

  let matrixHtml = "";

  test.beforeAll(async () => {
    test.setTimeout(PROBE_TIMEOUT_MS + 60_000);
    const renderedCards = await renderMatrixCards();
    matrixHtml = buildMatrixHtml(renderedCards);
  });

  test("keeps stressed card text inside bounds and separated on the same row", async ({
    page,
  }) => {
    await test.step("load the matrix HTML", async () => {
      await page.setContent(matrixHtml, { waitUntil: "load" });
    });

    await test.step("wait for fonts to settle", async () => {
      await page.evaluate(async () => {
        if (document.fonts) {
          await document.fonts.ready;
        }
      });
    });

    await test.step("confirm the matrix card count", async () => {
      await expect(page.locator("[data-card-id]")).toHaveCount(
        CARD_RENDER_MATRIX_CASE_COUNT,
      );
    });

    const audit = await test.step("collect spacing audit results", async () => {
      return await page.evaluate(
        ({
          boundaryTolerancePx,
          minHorizontalGapPx,
          verticalOverlapRowThreshold,
        }) => {
          interface TextRect {
            bottom: number;
            height: number;
            left: number;
            right: number;
            text: string;
            top: number;
            width: number;
          }

          const overflowIssues: string[] = [];
          const overlapIssues: string[] = [];
          const crowdedIssues: string[] = [];

          function collectTextRects(card: HTMLElement): {
            cardId: string;
            textRects: TextRect[];
          } {
            const svg = card.querySelector<SVGSVGElement>("svg");
            const cardId = `${card.dataset.cardId}:${card.dataset.variation}`;

            if (!svg) {
              overflowIssues.push(`${cardId} missing svg`);
              return { cardId, textRects: [] };
            }

            const svgRect = svg.getBoundingClientRect();
            const textRects: TextRect[] = [];

            for (const textNode of svg.querySelectorAll<SVGTextElement>(
              "text",
            )) {
              const text = textNode.textContent?.trim() ?? "";
              if (!text) continue;

              const rect = textNode.getBoundingClientRect();
              if (rect.width <= 0 || rect.height <= 0) continue;

              const left = rect.left - svgRect.left;
              const right = rect.right - svgRect.left;
              const top = rect.top - svgRect.top;
              const bottom = rect.bottom - svgRect.top;

              if (
                left < -boundaryTolerancePx ||
                right > svgRect.width + boundaryTolerancePx ||
                top < -boundaryTolerancePx ||
                bottom > svgRect.height + boundaryTolerancePx
              ) {
                overflowIssues.push(
                  `${cardId} overflow: "${text}" @ (${left.toFixed(1)}, ${top.toFixed(1)}) → (${right.toFixed(1)}, ${bottom.toFixed(1)}) within ${svgRect.width.toFixed(1)}×${svgRect.height.toFixed(1)}`,
                );
              }

              textRects.push({
                bottom,
                height: rect.height,
                left,
                right,
                text,
                top,
                width: rect.width,
              });
            }

            return { cardId, textRects };
          }

          function recordPairSpacingIssue(
            cardId: string,
            current: TextRect,
            comparison: TextRect,
          ): void {
            const verticalOverlap =
              Math.min(current.bottom, comparison.bottom) -
              Math.max(current.top, comparison.top);
            const minHeight = Math.min(current.height, comparison.height);
            const sameRow =
              verticalOverlap >
              Math.max(2, minHeight * verticalOverlapRowThreshold);

            if (!sameRow) {
              return;
            }

            const [leftRect, rightRect] =
              current.left <= comparison.left
                ? [current, comparison]
                : [comparison, current];
            const gap = rightRect.left - leftRect.right;

            if (gap < -1) {
              overlapIssues.push(
                `${cardId} overlap: "${leftRect.text}" vs "${rightRect.text}" (${gap.toFixed(1)}px)`,
              );
              return;
            }

            if (gap < minHorizontalGapPx) {
              crowdedIssues.push(
                `${cardId} crowded: "${leftRect.text}" vs "${rightRect.text}" (${gap.toFixed(1)}px)`,
              );
            }
          }

          function inspectSameRowSpacing(
            cardId: string,
            textRects: TextRect[],
          ): void {
            // Intentionally O(n^2): every pair must be checked so recordPairSpacingIssue can flag each same-row collision.
            // Any optimization here must preserve the full pairwise audit coverage.
            for (let index = 0; index < textRects.length; index += 1) {
              const current = textRects[index];
              if (!current) continue;

              for (
                let compareIndex = index + 1;
                compareIndex < textRects.length;
                compareIndex += 1
              ) {
                const comparison = textRects[compareIndex];
                if (!comparison) continue;
                recordPairSpacingIssue(cardId, current, comparison);
              }
            }
          }

          for (const card of document.querySelectorAll<HTMLElement>(
            "[data-card-id]",
          )) {
            const { cardId, textRects } = collectTextRects(card);
            inspectSameRowSpacing(cardId, textRects);
          }

          return {
            crowdedIssues: crowdedIssues.slice(0, 25),
            overlapIssues: overlapIssues.slice(0, 25),
            overflowIssues: overflowIssues.slice(0, 25),
          };
        },
        {
          boundaryTolerancePx: TEXT_BOUNDARY_TOLERANCE_PX,
          minHorizontalGapPx: TEXT_MIN_HORIZONTAL_GAP_PX,
          verticalOverlapRowThreshold: VERTICAL_OVERLAP_ROW_THRESHOLD,
        },
      );
    });

    await test.step("assert the spacing audit is clean", async () => {
      expect(
        audit.overflowIssues,
        audit.overflowIssues.join("\n") || "No overflow issues detected",
      ).toHaveLength(0);
      expect(
        audit.overlapIssues,
        audit.overlapIssues.join("\n") || "No overlap issues detected",
      ).toHaveLength(0);
      expect(
        audit.crowdedIssues,
        audit.crowdedIssues.join("\n") || "No crowding issues detected",
      ).toHaveLength(0);
    });
  });
});
