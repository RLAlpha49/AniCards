import { beforeEach, describe, expect, it } from "bun:test";

import type { PretextModule } from "@/lib/pretext/text-fit";
import {
  fitSingleLineTextToWidth,
  measureSingleLineText,
  resetTextFitCachesForTests,
} from "@/lib/pretext/text-fit";

interface MockPreparedText {
  breakablePrefixWidths: number[];
  breakableWidths: number[];
  chunks: unknown[];
  discretionaryHyphenWidth: number;
  kinds: string[];
  lineEndFitAdvances: number[];
  lineEndPaintAdvances: number[];
  segLevels: null;
  segments: string[];
  font: string;
  text: string;
  simpleLineWalkFastPath: boolean;
  tabStopAdvance: number;
  width: number;
  widths: number[];
}

function extractFontSizePx(font: string): number {
  const match = /(\d+(?:\.\d+)?)px/.exec(font);
  return Number(match?.[1] ?? 0);
}

function createMockPretext(): {
  calls: {
    layout: number;
    prepare: number;
    walk: number;
  };
  pretext: PretextModule;
} {
  const calls = {
    layout: 0,
    prepare: 0,
    walk: 0,
  };

  const pretext = {
    layout(
      prepared: MockPreparedText,
      maxWidth: number,
      lineHeight: number,
    ): { height: number; lineCount: number } {
      calls.layout += 1;
      const lineCount = prepared.width > maxWidth ? 2 : 1;

      return {
        height: lineCount * lineHeight,
        lineCount,
      };
    },
    prepareWithSegments(text: string, font: string): MockPreparedText {
      calls.prepare += 1;
      const width = Number(
        (String(text ?? "").length * extractFontSizePx(font) * 0.6).toFixed(2),
      );

      return {
        breakablePrefixWidths: [width],
        breakableWidths: [width],
        chunks: [text],
        discretionaryHyphenWidth: 0,
        kinds: ["text"],
        lineEndFitAdvances: [width],
        lineEndPaintAdvances: [width],
        segLevels: null,
        segments: Array.from(String(text ?? "")),
        font,
        text,
        simpleLineWalkFastPath: false,
        tabStopAdvance: 0,
        width,
        widths: [width],
      };
    },
    walkLineRanges(
      prepared: MockPreparedText,
      _maxWidth: number,
      callback: (line: { width: number }) => void,
    ): void {
      calls.walk += 1;
      callback({ width: prepared.width });
    },
  } satisfies PretextModule;

  return {
    calls,
    pretext,
  };
}

describe("pretext text-fit caching", () => {
  beforeEach(() => {
    resetTextFitCachesForTests();
  });

  it("reuses prepared text across different width measurements", () => {
    const { calls, pretext } = createMockPretext();

    const wideMeasurement = measureSingleLineText(pretext, {
      fontSize: 16,
      fontWeight: 400,
      maxWidth: 300,
      text: "Science Fiction Adventure",
    });
    const narrowMeasurement = measureSingleLineText(pretext, {
      fontSize: 16,
      fontWeight: 400,
      maxWidth: 120,
      text: "Science Fiction Adventure",
    });

    expect(calls.prepare).toBe(1);
    expect(calls.walk).toBe(2);
    expect(calls.layout).toBe(2);
    expect(wideMeasurement.naturalWidth).toBe(narrowMeasurement.naturalWidth);
    expect(wideMeasurement.lineCountAtWidth).toBeLessThan(
      narrowMeasurement.lineCountAtWidth,
    );
  });

  it("memoizes repeated single-line measurements with identical inputs", () => {
    const { calls, pretext } = createMockPretext();

    const firstMeasurement = measureSingleLineText(pretext, {
      fontSize: 18,
      fontWeight: 600,
      maxWidth: 140,
      text: "Collector",
    });
    const secondMeasurement = measureSingleLineText(pretext, {
      fontSize: 18,
      fontWeight: 600,
      maxWidth: 140,
      text: "Collector",
    });

    expect(secondMeasurement).toEqual(firstMeasurement);
    expect(calls.prepare).toBe(1);
    expect(calls.walk).toBe(1);
    expect(calls.layout).toBe(1);
  });

  it("avoids extra pretext work for repeated fit requests", () => {
    const { calls, pretext } = createMockPretext();
    const fitOptions = {
      fontWeight: 600,
      initialFontSize: 18,
      maxWidth: 120,
      minFontSize: 8,
      mode: "shrink-then-truncate" as const,
      text: "The Extremely Verbose Collector's Edition Director's Cut",
    };

    const firstFit = fitSingleLineTextToWidth(pretext, fitOptions);
    const callsAfterFirstFit = { ...calls };
    const secondFit = fitSingleLineTextToWidth(pretext, fitOptions);

    expect(secondFit).toEqual(firstFit);
    expect(calls).toEqual(callsAfterFirstFit);
  });

  it("clears text-fit caches when tests request a reset", () => {
    const { calls, pretext } = createMockPretext();

    measureSingleLineText(pretext, {
      fontSize: 18,
      fontWeight: 500,
      maxWidth: 180,
      text: "Reset me",
    });
    resetTextFitCachesForTests();
    measureSingleLineText(pretext, {
      fontSize: 18,
      fontWeight: 500,
      maxWidth: 180,
      text: "Reset me",
    });

    expect(calls.prepare).toBe(2);
    expect(calls.walk).toBe(2);
    expect(calls.layout).toBe(2);
  });

  it("handles empty text without throwing and memoizes repeated calls", () => {
    const { calls, pretext } = createMockPretext();
    const measurement = measureSingleLineText(pretext, {
      fontSize: 16,
      fontWeight: 400,
      maxWidth: 120,
      text: "",
    });
    const fit = fitSingleLineTextToWidth(pretext, {
      fontWeight: 400,
      initialFontSize: 16,
      maxWidth: 120,
      minFontSize: 8,
      text: "",
    });
    const callsAfterFirstPass = { ...calls };

    const repeatedMeasurement = measureSingleLineText(pretext, {
      fontSize: 16,
      fontWeight: 400,
      maxWidth: 120,
      text: "",
    });
    const repeatedFit = fitSingleLineTextToWidth(pretext, {
      fontWeight: 400,
      initialFontSize: 16,
      maxWidth: 120,
      minFontSize: 8,
      text: "",
    });

    expect(measurement.naturalWidth).toBe(0);
    expect(measurement.lineCountAtWidth).toBe(1);
    expect(Number.isFinite(measurement.naturalWidth)).toBe(true);
    expect(fit.text).toBe("");
    expect(fit.truncated).toBe(false);
    expect(repeatedMeasurement).toEqual(measurement);
    expect(repeatedFit).toEqual(fit);
    expect(calls).toEqual(callsAfterFirstPass);
  });

  it("handles very long text without throwing and memoizes repeated calls", () => {
    const { calls, pretext } = createMockPretext();
    const longText = `${"Science Fiction Adventure ".repeat(40).trim()} Chronicle`;

    const measurement = measureSingleLineText(pretext, {
      fontSize: 18,
      fontWeight: 600,
      maxWidth: 180,
      text: longText,
    });
    const fit = fitSingleLineTextToWidth(pretext, {
      fontWeight: 600,
      initialFontSize: 18,
      maxWidth: 180,
      minFontSize: 8,
      text: longText,
    });
    const callsAfterFirstPass = { ...calls };

    const repeatedMeasurement = measureSingleLineText(pretext, {
      fontSize: 18,
      fontWeight: 600,
      maxWidth: 180,
      text: longText,
    });
    const repeatedFit = fitSingleLineTextToWidth(pretext, {
      fontWeight: 600,
      initialFontSize: 18,
      maxWidth: 180,
      minFontSize: 8,
      text: longText,
    });

    expect(Number.isFinite(measurement.naturalWidth)).toBe(true);
    expect(Number.isFinite(measurement.lineCountAtWidth)).toBe(true);
    expect(Number.isFinite(fit.naturalWidth)).toBe(true);
    expect(Number.isFinite(fit.lineCountAtWidth)).toBe(true);
    expect(repeatedMeasurement).toEqual(measurement);
    expect(repeatedFit).toEqual(fit);
    expect(calls).toEqual(callsAfterFirstPass);
  });

  it("handles invalid font specs without throwing", () => {
    const { calls, pretext } = createMockPretext();

    const measurement = measureSingleLineText(pretext, {
      fontFamily: "",
      fontSize: 17,
      fontWeight: Number.NaN,
      maxWidth: 140,
      text: "Broken Font Spec",
    });
    const fit = fitSingleLineTextToWidth(pretext, {
      fontFamily: "",
      fontWeight: Number.NaN,
      initialFontSize: 17,
      maxWidth: 140,
      minFontSize: 8,
      text: "Broken Font Spec",
    });
    const callsAfterFirstPass = { ...calls };

    const repeatedMeasurement = measureSingleLineText(pretext, {
      fontFamily: "",
      fontSize: 17,
      fontWeight: Number.NaN,
      maxWidth: 140,
      text: "Broken Font Spec",
    });
    const repeatedFit = fitSingleLineTextToWidth(pretext, {
      fontFamily: "",
      fontWeight: Number.NaN,
      initialFontSize: 17,
      maxWidth: 140,
      minFontSize: 8,
      text: "Broken Font Spec",
    });

    expect(Number.isFinite(measurement.naturalWidth)).toBe(true);
    expect(Number.isFinite(fit.naturalWidth)).toBe(true);
    expect(fit.text.length).toBeGreaterThan(0);
    expect(repeatedMeasurement).toEqual(measurement);
    expect(repeatedFit).toEqual(fit);
    expect(calls).toEqual(callsAfterFirstPass);
  });
});
