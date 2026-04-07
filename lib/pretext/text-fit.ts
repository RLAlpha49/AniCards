import { inspect } from "node:util";

import { LRUCache } from "lru-cache";

import { logPrivacySafe } from "@/lib/api/logging";

export const PRETEXT_WIDTH_EPSILON_PX = 0.25;

export type PretextModule = Pick<
  typeof import("@chenglou/pretext"),
  "layout" | "prepareWithSegments" | "walkLineRanges"
>;

type PreparedSingleLineText = ReturnType<PretextModule["prepareWithSegments"]>;
type PreparedSingleLineLayoutInput = Parameters<PretextModule["layout"]>[0];

const PREPARED_TEXT_CACHE_MAX = 1024;
const SINGLE_LINE_MEASUREMENT_CACHE_MAX = 4096;
const SINGLE_LINE_FIT_CACHE_MAX = 2048;
// Components are encoded before joining so the separator stays internal.
const CACHE_KEY_SEPARATOR = "\u0001";
// Effectively infinite width for measuring natural text width without clipping.
const UNCONSTRAINED_MAX_WIDTH = 100_000;
// Shared floor for compact secondary labels in paired layouts.
const DEFAULT_MIN_FONT_SIZE = 8;
const DEFAULT_FONT_FAMILY = '"Segoe UI", Ubuntu, Sans-Serif';
const DEFAULT_FONT_WEIGHT = 600;
const PRETEXT_DEBUG_SNIPPET_MAX_LENGTH = 1200;

interface PretextRuntimeCaches {
  measurements: LRUCache<string, SingleLineTextMeasurement>;
  preparedTexts: LRUCache<string, PreparedSingleLineText>;
  singleLineFits: LRUCache<string, FittedSingleLineText>;
}

export interface MeasureSingleLineTextOptions {
  fontFamily?: string;
  fontSize: number;
  fontWeight?: number;
  maxWidth: number;
  skipCache?: boolean;
  text: string;
}

/**
 * Measurement result for a single line of text at a specific width.
 *
 * `overflowPx` is `0` when the text fits and becomes a positive pixel value
 * when the natural width exceeds `maxWidth`. `lineCountAtWidth` reflects the
 * wrapped line count returned by the provided pretext layout engine.
 */
export interface SingleLineTextMeasurement {
  font: string;
  fontSize: number;
  lineCountAtWidth: number;
  naturalWidth: number;
  overflowPx: number;
  wrapsAtWidth: boolean;
}

export type SingleLineFitMode = "shrink" | "truncate" | "shrink-then-truncate";

export interface FitSingleLineTextOptions extends Omit<
  MeasureSingleLineTextOptions,
  "fontSize"
> {
  initialFontSize: number;
  minFontSize: number;
  mode?: SingleLineFitMode;
  suffix?: string;
}

export interface FittedSingleLineText extends SingleLineTextMeasurement {
  text: string;
  truncated: boolean;
}

export interface FitPairedTextOptions {
  availableWidth: number;
  gapPx: number;
  mode?: SingleLineFitMode;
  primaryFontFamily?: string;
  primaryFontWeight?: number;
  primaryInitialFontSize: number;
  primaryMinFontSize: number;
  primaryText: string;
  reservedWidthPx?: number;
  secondaryFontFamily?: string;
  secondaryFontSize: number;
  secondaryFontWeight?: number;
  secondaryText: string;
  suffix?: string;
}

export interface FitPairedTextResult {
  availablePrimaryWidth: number;
  primary: FittedSingleLineText;
  secondary: SingleLineTextMeasurement;
}

export interface FitAnchoredTextPairOptions {
  availableWidth: number;
  gapPx: number;
  mode?: SingleLineFitMode;
  primaryFontFamily?: string;
  primaryFontWeight?: number;
  primaryInitialFontSize: number;
  primaryMinFontSize: number;
  primaryText: string;
  reservedWidthPx?: number;
  secondaryFontFamily?: string;
  secondaryFontWeight?: number;
  secondaryInitialFontSize: number;
  secondaryMaxWidth?: number;
  secondaryMinFontSize?: number;
  secondaryMode?: SingleLineFitMode;
  secondarySuffix?: string;
  secondaryText: string;
  suffix?: string;
}

export interface FitAnchoredTextPairResult {
  availablePrimaryWidth: number;
  primary: FittedSingleLineText;
  secondary: FittedSingleLineText;
}

interface GraphemeSegmenter {
  segment(input: string): Iterable<{ segment: string }>;
}

type IntlWithSegmenter = typeof Intl & {
  Segmenter?: new (
    locales?: string | string[],
    options?: { granularity?: "grapheme" },
  ) => GraphemeSegmenter;
};

// These module-level singletons intentionally memoize cross-call work so we do
// not recreate the grapheme segmenter or per-runtime LRU caches on every fit.
// `runtimeCaches` is a WeakMap so PretextModule instances can still be
// garbage-collected, and `warnedGraphemeFallback` is a module-wide flag that
// keeps the fallback warning from spamming logs.
let cachedSegmenter: GraphemeSegmenter | null | undefined;
let runtimeCaches = new WeakMap<PretextModule, PretextRuntimeCaches>();
let warnedGraphemeFallback = false;

export function roundToTenths(value: number): number {
  return Math.round(value * 10) / 10;
}

export function resolveLineHeightPx(fontSize: number): number {
  return Math.max(1, roundToTenths(fontSize * 1.2));
}

export function buildPretextFontShorthand({
  fontFamily = DEFAULT_FONT_FAMILY,
  fontSize,
  fontWeight = DEFAULT_FONT_WEIGHT,
}: {
  fontFamily?: string;
  fontSize: number;
  fontWeight?: number;
}): string {
  return `${fontWeight} ${fontSize}px ${fontFamily}`;
}

function cloneSingleLineMeasurement(
  measurement: SingleLineTextMeasurement,
): SingleLineTextMeasurement {
  return { ...measurement };
}

function cloneFittedSingleLineText(
  fittedText: FittedSingleLineText,
): FittedSingleLineText {
  return { ...fittedText };
}

function formatDebugValue(value: unknown): string {
  const inspected = inspect(value, {
    breakLength: 120,
    compact: 3,
    depth: 2,
    maxArrayLength: 24,
    sorted: true,
  });

  return inspected.length <= PRETEXT_DEBUG_SNIPPET_MAX_LENGTH
    ? inspected
    : `${inspected.slice(0, PRETEXT_DEBUG_SNIPPET_MAX_LENGTH - 1)}…`;
}

function getRuntimeCaches(pretext: PretextModule): PretextRuntimeCaches {
  const existingCaches = runtimeCaches.get(pretext);
  if (existingCaches) {
    return existingCaches;
  }

  const createdCaches: PretextRuntimeCaches = {
    measurements: new LRUCache({
      max: SINGLE_LINE_MEASUREMENT_CACHE_MAX,
    }),
    preparedTexts: new LRUCache({
      max: PREPARED_TEXT_CACHE_MAX,
    }),
    singleLineFits: new LRUCache({
      max: SINGLE_LINE_FIT_CACHE_MAX,
    }),
  };

  runtimeCaches.set(pretext, createdCaches);
  return createdCaches;
}

function buildPreparedTextCacheKey(text: string, font: string): string {
  return [font, text]
    .map((component) => encodeURIComponent(String(component)))
    .join(CACHE_KEY_SEPARATOR);
}

function buildMeasurementCacheKey(
  text: string,
  font: string,
  maxWidth: number,
): string {
  return [font, maxWidth, text]
    .map((component) => encodeURIComponent(String(component)))
    .join(CACHE_KEY_SEPARATOR);
}

function buildSingleLineFitCacheKey(options: {
  fontFamily?: string;
  fontWeight?: number;
  initialFontSize: number;
  maxWidth: number;
  minFontSize: number;
  mode: SingleLineFitMode;
  suffix: string;
  text: string;
}): string {
  return [
    options.fontFamily ?? DEFAULT_FONT_FAMILY,
    options.fontWeight ?? DEFAULT_FONT_WEIGHT,
    options.initialFontSize,
    options.maxWidth,
    options.minFontSize,
    options.mode,
    options.suffix,
    options.text,
  ]
    .map((component) => encodeURIComponent(String(component)))
    .join(CACHE_KEY_SEPARATOR);
}

function getPreparedSingleLineText(
  pretext: PretextModule,
  text: string,
  font: string,
): PreparedSingleLineText {
  const caches = getRuntimeCaches(pretext);
  const cacheKey = buildPreparedTextCacheKey(text, font);
  const cachedPreparedText = caches.preparedTexts.get(cacheKey);

  if (cachedPreparedText) {
    return cachedPreparedText;
  }

  const preparedText = pretext.prepareWithSegments(text, font);
  caches.preparedTexts.set(cacheKey, preparedText);
  return preparedText;
}

export function resetTextFitCachesForTests(): void {
  cachedSegmenter = undefined;
  runtimeCaches = new WeakMap<PretextModule, PretextRuntimeCaches>();
  warnedGraphemeFallback = false;
}

/**
 * Fast heuristic for estimating a dynamic font size without DOM layout or font
 * metrics.
 *
 * @param text - Text to approximate.
 * @param initialFontSize - Starting size for the heuristic search.
 * @param maxWidth - Maximum allowed width in pixels.
 * @param minFontSize - Lower bound for the heuristic search.
 * @returns An approximate font size rounded to tenths.
 *
 * @remarks Use this for quick client-side estimates. When exact fitting is
 * required, prefer `findLargestSingleLineFontSizeToFit`, which measures layout
 * with the shared pretext runtime.
 */
export function calculateHeuristicDynamicFontSizeValue(
  text: string,
  initialFontSize = 18,
  maxWidth = 220,
  minFontSize = 8,
): number {
  const safeText = String(text ?? "");
  const safeInitialFontSize = Number.isFinite(initialFontSize)
    ? initialFontSize
    : 18;
  const safeMaxWidth = Number.isFinite(maxWidth) ? maxWidth : 220;
  const safeMinInput = Number.isFinite(minFontSize) ? minFontSize : 8;
  const safeMinFontSize = Math.max(0.1, safeMinInput);
  const charWidthMultiplier = Math.max(0.4, 0.6 - safeText.length * 0.003);
  const safeInitialFontSizeBounded = Math.max(
    safeMinFontSize,
    safeInitialFontSize,
  );
  let low = safeMinFontSize;
  let high = safeInitialFontSizeBounded;

  while (high - low > 0.1) {
    const mid = (low + high) / 2;
    if (safeText.length * mid * charWidthMultiplier <= safeMaxWidth) {
      low = mid;
      continue;
    }

    high = mid;
  }

  const finalMid = low;
  return roundToTenths(Math.max(safeMinFontSize, finalMid));
}

function isPreparedSingleLineLayoutInput(
  prepared: unknown,
): prepared is PreparedSingleLineLayoutInput {
  if (typeof prepared !== "object" || prepared === null) {
    return false;
  }

  const candidate = prepared as {
    breakablePrefixWidths?: unknown;
    breakableWidths?: unknown;
    chunks?: unknown;
    discretionaryHyphenWidth?: unknown;
    kinds?: unknown;
    lineEndFitAdvances?: unknown;
    lineEndPaintAdvances?: unknown;
    simpleLineWalkFastPath?: unknown;
    segLevels?: unknown;
    segments?: unknown;
    widths?: unknown;
    tabStopAdvance?: unknown;
  };

  return (
    Array.isArray(candidate.segments) &&
    Array.isArray(candidate.widths) &&
    Array.isArray(candidate.lineEndFitAdvances) &&
    Array.isArray(candidate.lineEndPaintAdvances) &&
    Array.isArray(candidate.kinds) &&
    (candidate.segLevels === null ||
      candidate.segLevels instanceof Int8Array) &&
    Array.isArray(candidate.breakableWidths) &&
    Array.isArray(candidate.breakablePrefixWidths) &&
    Array.isArray(candidate.chunks) &&
    typeof candidate.discretionaryHyphenWidth === "number" &&
    typeof candidate.tabStopAdvance === "number" &&
    typeof candidate.simpleLineWalkFastPath === "boolean"
  );
}

/**
 * Measure a single line of text with the supplied pretext runtime.
 *
 * @param pretext - Initialized pretext module used for measurement.
 * @param options - Text, font, and width settings in pixels.
 * @returns A measurement object describing the natural width, wrapped line
 * count, overflow in pixels, and the resolved font shorthand.
 */
export function measureSingleLineText(
  pretext: PretextModule,
  options: MeasureSingleLineTextOptions,
): SingleLineTextMeasurement {
  const safeText = String(options.text ?? "");
  const font = buildPretextFontShorthand({
    fontFamily: options.fontFamily,
    fontSize: options.fontSize,
    fontWeight: options.fontWeight,
  });
  const safeMaxWidth = Math.max(1, options.maxWidth);
  const caches = getRuntimeCaches(pretext);
  const measurementCacheKey = buildMeasurementCacheKey(
    safeText,
    font,
    safeMaxWidth,
  );
  const cachedMeasurement = options.skipCache
    ? undefined
    : caches.measurements.get(measurementCacheKey);

  if (cachedMeasurement) {
    return cloneSingleLineMeasurement(cachedMeasurement);
  }

  const prepared = getPreparedSingleLineText(pretext, safeText, font);
  if (!isPreparedSingleLineLayoutInput(prepared)) {
    const preparedDebug = formatDebugValue(prepared);
    const pretextDebug = formatDebugValue({
      layout: typeof pretext.layout,
      prepareWithSegments: typeof pretext.prepareWithSegments,
      walkLineRanges: typeof pretext.walkLineRanges,
    });

    throw new Error(
      `Pretext returned an unexpected prepared text shape; prepared=${preparedDebug}; pretext=${pretextDebug}; text=${JSON.stringify(safeText)}; font=${JSON.stringify(font)}; expected segments, widths, kinds, and segLevels before calling layout.`,
    );
  }
  let naturalWidth = 0;

  pretext.walkLineRanges(prepared, UNCONSTRAINED_MAX_WIDTH, (line) => {
    naturalWidth = Math.max(naturalWidth, line.width);
  });

  const layoutResult = pretext.layout(
    prepared,
    safeMaxWidth,
    resolveLineHeightPx(options.fontSize),
  );
  const overflowPx = roundToTenths(Math.max(0, naturalWidth - safeMaxWidth));

  const measurement = {
    font,
    fontSize: roundToTenths(options.fontSize),
    lineCountAtWidth: layoutResult.lineCount,
    naturalWidth: roundToTenths(naturalWidth),
    overflowPx,
    wrapsAtWidth:
      overflowPx > PRETEXT_WIDTH_EPSILON_PX || layoutResult.lineCount > 1,
  };

  if (!options.skipCache) {
    caches.measurements.set(measurementCacheKey, measurement);
  }
  return cloneSingleLineMeasurement(measurement);
}

/**
 * Find the largest font size that still fits the text within the width.
 *
 * @param pretext - Initialized pretext module used for measurement.
 * @param options - Text, width, and font bounds in pixels.
 * @returns The best `SingleLineTextMeasurement` found by binary search.
 */
export function findLargestSingleLineFontSizeToFit(
  pretext: PretextModule,
  options: Omit<MeasureSingleLineTextOptions, "fontSize"> & {
    initialFontSize: number;
    minFontSize: number;
  },
): SingleLineTextMeasurement {
  const safeMin = Math.max(0.1, options.minFontSize);
  const safeMax = Math.max(safeMin, options.initialFontSize);
  const minTenths = Math.round(safeMin * 10);
  const maxTenths = Math.round(safeMax * 10);

  let lo = minTenths;
  let hi = maxTenths;
  let bestMeasurement = measureSingleLineText(pretext, {
    ...options,
    fontSize: safeMin,
  });

  while (lo <= hi) {
    const mid = Math.floor((lo + hi) / 2);
    const fontSize = mid / 10;
    const measurement = measureSingleLineText(pretext, {
      ...options,
      fontSize,
    });

    if (measurement.overflowPx <= PRETEXT_WIDTH_EPSILON_PX) {
      bestMeasurement = measurement;
      lo = mid + 1;
      continue;
    }

    hi = mid - 1;
  }

  return bestMeasurement;
}

function getGraphemeSegmenter(): GraphemeSegmenter | null {
  if (cachedSegmenter !== undefined) {
    return cachedSegmenter;
  }

  const Segmenter = (Intl as IntlWithSegmenter).Segmenter;
  if (typeof Segmenter !== "function") {
    cachedSegmenter = null;
    return cachedSegmenter;
  }

  cachedSegmenter = new Segmenter(undefined, {
    granularity: "grapheme",
  });
  return cachedSegmenter;
}

const COMBINING_MARK_PATTERN =
  /[\u0300-\u036f\u1ab0-\u1aff\u1dc0-\u1dff\u20d0-\u20ff\ufe20-\ufe2f]/u;
const EMOJI_MODIFIER_PATTERN = /[\u{1f3fb}-\u{1f3ff}]/u;
const REGIONAL_INDICATOR_PATTERN = /[\u{1f1e6}-\u{1f1ff}]/u;
const VARIATION_SELECTOR_15 = "\uFE0E";
const VARIATION_SELECTOR_16 = "\uFE0F";
const ZERO_WIDTH_JOINER = "\u200D";

function isCombiningOrModifier(char: string): boolean {
  return (
    COMBINING_MARK_PATTERN.test(char) ||
    char === VARIATION_SELECTOR_15 ||
    char === VARIATION_SELECTOR_16 ||
    EMOJI_MODIFIER_PATTERN.test(char)
  );
}

function isRegionalIndicator(char: string): boolean {
  return REGIONAL_INDICATOR_PATTERN.test(char);
}

function splitIntoGraphemeClustersFallback(text: string): string[] {
  const clusters: string[] = [];
  let current = "";
  let joinNext = false;
  let currentRegionalIndicators = 0;

  for (const char of text) {
    const isJoiner = char === ZERO_WIDTH_JOINER;
    const isModifier = isCombiningOrModifier(char);
    const isRegional = isRegionalIndicator(char);

    if (current === "") {
      current = char;
      joinNext = isJoiner;
      currentRegionalIndicators = isRegional ? 1 : 0;
      continue;
    }

    if (joinNext) {
      current += char;
      joinNext = isJoiner;
      currentRegionalIndicators = isRegional ? 1 : 0;
      continue;
    }

    if (isModifier) {
      current += char;
      continue;
    }

    if (isJoiner) {
      current += char;
      joinNext = true;
      continue;
    }

    if (isRegional && currentRegionalIndicators % 2 === 1) {
      current += char;
      currentRegionalIndicators += 1;
      continue;
    }

    clusters.push(current);
    current = char;
    joinNext = isJoiner;
    currentRegionalIndicators = isRegional ? 1 : 0;
  }

  if (current) {
    clusters.push(current);
  }

  return clusters;
}

export function splitIntoGraphemesSync(text: string): string[] {
  const segmenter = getGraphemeSegmenter();
  if (segmenter) {
    return Array.from(segmenter.segment(text), (segment) => segment.segment);
  }

  if (!warnedGraphemeFallback) {
    logPrivacySafe(
      "warn",
      "Pretext Text Fit",
      "splitIntoGraphemesSync: using fallback grapheme segmentation because Intl.Segmenter is unavailable",
      {
        component: "splitIntoGraphemesSync",
        fallback: "Intl.Segmenter",
      },
    );
    warnedGraphemeFallback = true;
  }

  return splitIntoGraphemeClustersFallback(text);
}

/**
 * Backwards-compatible async wrapper over `splitIntoGraphemesSync`.
 *
 * The implementation stays synchronous so existing callers can await it
 * without changing behavior while the sync helper remains the real workhorse.
 */
export async function splitIntoGraphemesAsync(text: string): Promise<string[]> {
  return splitIntoGraphemesSync(text);
}

function truncateWithMeasuredSuffix(
  pretext: PretextModule,
  options: Omit<MeasureSingleLineTextOptions, "maxWidth"> & {
    maxWidth: number;
    suffix: string;
    text: string;
  },
): FittedSingleLineText {
  /**
   * Note: on first render without Intl.Segmenter, this path can briefly use the
   * fallback grapheme segmentation from splitIntoGraphemesSync(), so
   * multi-codepoint graphemes may render with best-effort clustering on older
   * runtimes.
   */
  const fullMeasurement = measureSingleLineText(pretext, {
    ...options,
    maxWidth: options.maxWidth,
  });

  if (fullMeasurement.overflowPx <= PRETEXT_WIDTH_EPSILON_PX) {
    return {
      ...fullMeasurement,
      text: options.text,
      truncated: false,
    };
  }

  const safeMaxWidth = Math.max(1, options.maxWidth);
  const suffixMeasurement = measureSingleLineText(pretext, {
    ...options,
    maxWidth: safeMaxWidth,
    text: options.suffix,
  });

  const emptyMeasurement: SingleLineTextMeasurement = {
    font: buildPretextFontShorthand({
      fontFamily: options.fontFamily,
      fontSize: options.fontSize,
      fontWeight: options.fontWeight,
    }),
    fontSize: roundToTenths(options.fontSize),
    lineCountAtWidth: 1,
    naturalWidth: 0,
    overflowPx: 0,
    wrapsAtWidth: false,
  };

  if (
    suffixMeasurement.naturalWidth >
    safeMaxWidth + PRETEXT_WIDTH_EPSILON_PX
  ) {
    return {
      ...emptyMeasurement,
      text: "",
      truncated: true,
    };
  }

  const graphemes = splitIntoGraphemesSync(String(options.text ?? ""));
  let lo = 0;
  let hi = graphemes.length;
  let bestText = options.suffix;

  while (lo <= hi) {
    const mid = Math.floor((lo + hi) / 2);
    const prefix = graphemes.slice(0, mid).join("").trimEnd();
    const candidateText = prefix
      ? `${prefix}${options.suffix}`
      : options.suffix;
    const candidateMeasurement = measureSingleLineText(pretext, {
      ...options,
      maxWidth: safeMaxWidth,
      skipCache: true,
      text: candidateText,
    });

    if (candidateMeasurement.overflowPx <= PRETEXT_WIDTH_EPSILON_PX) {
      bestText = candidateText;
      lo = mid + 1;
      continue;
    }

    hi = mid - 1;
  }

  const finalMeasurement = measureSingleLineText(pretext, {
    ...options,
    maxWidth: safeMaxWidth,
    text: bestText,
  });

  return {
    ...finalMeasurement,
    text: bestText,
    truncated: bestText !== options.text,
  };
}

/**
 * Fit a single line of text by shrinking first and truncating only if needed.
 *
 * @param pretext - Initialized pretext module used for measurement.
 * @param options - Font and width bounds in pixels, plus optional truncation suffix.
 * @returns The fitted text, including the final rendered string and whether
 * truncation occurred.
 */
export function fitSingleLineTextToWidth(
  pretext: PretextModule,
  options: FitSingleLineTextOptions,
): FittedSingleLineText {
  const safeText = String(options.text ?? "");
  const mode = options.mode ?? "shrink-then-truncate";
  const safeMinFontSize = Math.max(0.1, options.minFontSize);
  const safeMaxWidth = Math.max(1, options.maxWidth);
  const safeSuffix = options.suffix ?? "…";
  const caches = getRuntimeCaches(pretext);
  const fitCacheKey = buildSingleLineFitCacheKey({
    fontFamily: options.fontFamily,
    fontWeight: options.fontWeight,
    initialFontSize: options.initialFontSize,
    maxWidth: safeMaxWidth,
    minFontSize: safeMinFontSize,
    mode,
    suffix: safeSuffix,
    text: safeText,
  });
  const cachedFit = caches.singleLineFits.get(fitCacheKey);

  if (cachedFit) {
    return cloneFittedSingleLineText(cachedFit);
  }

  let fittedText: FittedSingleLineText;

  if (mode === "truncate") {
    fittedText = truncateWithMeasuredSuffix(pretext, {
      ...options,
      maxWidth: safeMaxWidth,
      fontSize: options.initialFontSize,
      suffix: safeSuffix,
      text: safeText,
    });
  } else {
    const bestMeasurement = findLargestSingleLineFontSizeToFit(pretext, {
      ...options,
      maxWidth: safeMaxWidth,
      minFontSize: safeMinFontSize,
      text: safeText,
    });

    if (
      mode === "shrink" ||
      bestMeasurement.overflowPx <= PRETEXT_WIDTH_EPSILON_PX
    ) {
      fittedText = {
        ...bestMeasurement,
        text: safeText,
        truncated: false,
      };
    } else {
      fittedText = truncateWithMeasuredSuffix(pretext, {
        ...options,
        maxWidth: safeMaxWidth,
        fontSize: bestMeasurement.fontSize,
        suffix: safeSuffix,
        text: safeText,
      });
    }
  }

  caches.singleLineFits.set(fitCacheKey, fittedText);
  return cloneFittedSingleLineText(fittedText);
}

/**
 * Fit a pair of text values on one line using a shared available width.
 *
 * @param pretext - Initialized pretext module used for measurement.
 * @param options - Primary/secondary text values and their font bounds in pixels.
 * @returns The fitted primary and secondary measurements plus the primary width budget.
 */
export function fitPairedTextToWidth(
  pretext: PretextModule,
  options: FitPairedTextOptions,
): FitPairedTextResult {
  const secondary = measureSingleLineText(pretext, {
    fontFamily: options.secondaryFontFamily,
    fontSize: options.secondaryFontSize,
    fontWeight: options.secondaryFontWeight,
    maxWidth: UNCONSTRAINED_MAX_WIDTH,
    text: options.secondaryText,
  });
  const safeGapPx = Math.max(0, options.gapPx);
  const safeReservedWidthPx = Math.max(0, options.reservedWidthPx ?? 0);
  const availablePrimaryWidth = roundToTenths(
    Math.max(
      1,
      options.availableWidth -
        secondary.naturalWidth -
        safeGapPx -
        safeReservedWidthPx,
    ),
  );
  const primary = fitSingleLineTextToWidth(pretext, {
    fontFamily: options.primaryFontFamily,
    fontWeight: options.primaryFontWeight,
    initialFontSize: options.primaryInitialFontSize,
    maxWidth: availablePrimaryWidth,
    minFontSize: options.primaryMinFontSize,
    mode: options.mode,
    suffix: options.suffix,
    text: options.primaryText,
  });

  return {
    availablePrimaryWidth,
    primary,
    secondary,
  };
}

/**
 * Fit a primary/secondary text pair where the secondary text is anchored first.
 *
 * @param pretext - Initialized pretext module used for measurement.
 * @param options - Primary/secondary text values and width constraints in pixels.
 * @returns The fitted pair plus the computed width available to the primary text.
 */
export function fitAnchoredTextPairToWidth(
  pretext: PretextModule,
  options: FitAnchoredTextPairOptions,
): FitAnchoredTextPairResult {
  const safeAvailableWidth = Math.max(1, options.availableWidth);
  const secondaryMinFontSize = Math.max(
    0.1,
    options.secondaryMinFontSize ??
      Math.min(options.secondaryInitialFontSize, DEFAULT_MIN_FONT_SIZE),
  );
  const secondaryMaxWidth = roundToTenths(
    Math.max(
      1,
      Math.min(
        safeAvailableWidth,
        options.secondaryMaxWidth ?? safeAvailableWidth,
      ),
    ),
  );
  const secondary = fitSingleLineTextToWidth(pretext, {
    fontFamily: options.secondaryFontFamily,
    fontWeight: options.secondaryFontWeight,
    initialFontSize: options.secondaryInitialFontSize,
    maxWidth: secondaryMaxWidth,
    minFontSize: secondaryMinFontSize,
    mode: options.secondaryMode ?? "shrink-then-truncate",
    suffix: options.secondarySuffix,
    text: options.secondaryText,
  });
  const safeGapPx = Math.max(0, options.gapPx);
  const safeReservedWidthPx = Math.max(0, options.reservedWidthPx ?? 0);
  const availablePrimaryWidth = roundToTenths(
    Math.max(
      1,
      safeAvailableWidth -
        secondary.naturalWidth -
        safeGapPx -
        safeReservedWidthPx,
    ),
  );
  const primary = fitSingleLineTextToWidth(pretext, {
    fontFamily: options.primaryFontFamily,
    fontWeight: options.primaryFontWeight,
    initialFontSize: options.primaryInitialFontSize,
    maxWidth: availablePrimaryWidth,
    minFontSize: options.primaryMinFontSize,
    mode: options.mode,
    suffix: options.suffix,
    text: options.primaryText,
  });

  return {
    availablePrimaryWidth,
    primary,
    secondary,
  };
}
