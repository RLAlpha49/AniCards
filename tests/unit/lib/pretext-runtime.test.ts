import { afterEach, describe, expect, it } from "bun:test";

import {
  buildSvgTextLengthAdjustAttributes,
  fitSvgPairedText,
  fitSvgSingleLineText,
  isPretextRuntimeReady,
  resolveSvgTitleTextFit,
} from "@/lib/pretext/runtime";
import {
  initializeServerPretext,
  resetServerPretextForTests,
} from "@/lib/pretext/server";
import { assertDefined } from "@/tests/shared/assert-defined";

// Sub-pixel rendering tolerance for text-fitting assertions.
const SUBPIXEL_TOLERANCE = 0.5;

afterEach(() => {
  resetServerPretextForTests();
});

describe("server pretext runtime", () => {
  it("does not retry failed initialization until tests reset the runtime", () => {
    const probeScript = `
import { mock } from "bun:test";

const canvasImportSpy = mock(() => undefined);
const logSpy = mock(() => undefined);

mock.module("@/lib/api/logging", () => ({
  logPrivacySafe: logSpy,
}));

mock.module("@napi-rs/canvas", () => {
  canvasImportSpy();
  throw new Error("canvas missing");
});

const { initializeServerPretext } = await import("@/lib/pretext/server");

const first = await initializeServerPretext();
const second = await initializeServerPretext();

console.log(
  JSON.stringify({
    canvasImportCalls: canvasImportSpy.mock.calls.length,
    first,
    logCalls: logSpy.mock.calls.length,
    second,
  }),
);
`;

    const subprocess = Bun.spawnSync({
      cmd: [process.execPath, "run", "-"],
      cwd: process.cwd(),
      stdin: new Blob([probeScript]),
      stdout: "pipe",
      stderr: "pipe",
    });

    const stdout = new TextDecoder().decode(subprocess.stdout).trim();
    const stderr = new TextDecoder().decode(subprocess.stderr).trim();

    expect(subprocess.exitCode).toBe(0);
    expect(stderr).toBe("");

    const result = JSON.parse(stdout) as {
      canvasImportCalls: number;
      first: boolean;
      logCalls: number;
      second: boolean;
    };

    expect(result.first).toBe(false);
    expect(result.second).toBe(false);
    expect(result.canvasImportCalls).toBe(1);
    expect(result.logCalls).toBe(1);
  });

  it("initializes the canvas-backed runtime for server SVG rendering", async () => {
    expect(isPretextRuntimeReady()).toBe(false);

    const ready = await initializeServerPretext();

    expect(ready).toBe(true);
    expect(isPretextRuntimeReady()).toBe(true);
  });

  it("truncates long single-line text when shrinking alone is not enough", async () => {
    const ready = await initializeServerPretext();
    expect(ready).toBe(true);

    const fit = fitSvgSingleLineText({
      fontWeight: 600,
      initialFontSize: 18,
      maxWidth: 60,
      minFontSize: 8,
      mode: "shrink-then-truncate",
      text: "The Extremely Verbose Collector's Edition Director's Cut",
    });

    assertDefined(fit, "Expected a fitted text result after runtime init");

    expect(fit.truncated).toBe(true);
    expect(fit.overflowPx).toBeLessThanOrEqual(SUBPIXEL_TOLERANCE);
    expect(fit.text).toContain("…");
  });

  it("fits paired labels against trailing values", async () => {
    const ready = await initializeServerPretext();
    expect(ready).toBe(true);

    const rowFit = fitSvgPairedText({
      availableWidth: 190,
      gapPx: 10,
      mode: "shrink-then-truncate",
      primaryFontWeight: 400,
      primaryInitialFontSize: 13,
      primaryMinFontSize: 8,
      primaryText: "Science Fiction Adventure",
      secondaryFontSize: 13,
      secondaryFontWeight: 600,
      secondaryText: "9,876",
    });

    assertDefined(
      rowFit,
      "Expected a paired text fit result after runtime init",
    );

    expect(rowFit.availablePrimaryWidth).toBeGreaterThan(0);
    expect(rowFit.primary.overflowPx).toBeLessThanOrEqual(SUBPIXEL_TOLERANCE);
  });

  it("falls back to heuristic sizing when the runtime is not initialized", () => {
    const fit = resolveSvgTitleTextFit({
      maxWidth: 120,
      text: "Alpha49's Ridiculously Long Header Title",
    });

    expect(isPretextRuntimeReady()).toBe(false);
    expect(fit.text).toContain("Alpha49");
    expect(fit.fontSize).toBeGreaterThan(0);
    expect(fit.naturalWidth).toBeNull();
    expect(fit.truncated).toBeNull();
  });

  it("does not emit textLength attributes for heuristic fallback fits", () => {
    const fit = resolveSvgTitleTextFit({
      maxWidth: 180,
      text: "Alex",
    });

    const attrs = buildSvgTextLengthAdjustAttributes(fit, {
      initialFontSize: 18,
      maxWidth: 180,
    });

    expect(attrs).toBe("");
  });

  it("restores OffscreenCanvas during test reset", async () => {
    const globalScope = globalThis as typeof globalThis & {
      OffscreenCanvas?: typeof OffscreenCanvas;
    };
    const originalOffscreenCanvas = globalScope.OffscreenCanvas;

    const ready = await initializeServerPretext();

    expect(ready).toBe(true);
    expect(typeof globalScope.OffscreenCanvas).toBe("function");

    resetServerPretextForTests();

    expect(globalScope.OffscreenCanvas).toBe(originalOffscreenCanvas);
  });
});
