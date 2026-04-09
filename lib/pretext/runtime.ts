import * as textFit from "@/lib/pretext/text-fit";

const DEFAULT_TITLE_INITIAL_FONT_SIZE = 18;
const DEFAULT_TITLE_MIN_FONT_SIZE = 8;
const DEFAULT_SHRINK_THRESHOLD = 0.25;
const DEFAULT_FONT_FAMILY = '"Segoe UI", Ubuntu, Sans-Serif';
const TITLE_FIT_BROWSER_SAFETY_FACTOR = 0.85;

// This singleton is intentionally client-only. It is not safe for SSR/edge reuse,
// and the reset helpers split production cleanup from test-only cache resets.
let activePretextRuntime: textFit.PretextModule | null = null;

function withPretextRuntime<T>(
  callback: (pretext: textFit.PretextModule) => T,
): T | null {
  if (!activePretextRuntime) {
    return null;
  }

  return callback(activePretextRuntime);
}

export function registerPretextRuntime(module: textFit.PretextModule): void {
  activePretextRuntime = module;
}

export function isPretextRuntimeReady(): boolean {
  return activePretextRuntime !== null;
}

function resetPretextRuntimeState(): void {
  activePretextRuntime = null;
}

// `resetPretextRuntime()` clears only the active runtime. The test-only helper
// also clears grapheme and measurement caches so each test starts clean.
export function resetPretextRuntime(): void {
  resetPretextRuntimeState();
}

export function resetPretextRuntimeForTests(): void {
  resetPretextRuntimeState();
  textFit.resetTextFitCachesForTests();
}

export function measureSvgSingleLineText(
  options: textFit.MeasureSingleLineTextOptions,
): textFit.SingleLineTextMeasurement | null {
  return withPretextRuntime((pretext) =>
    textFit.measureSingleLineText(pretext, options),
  );
}

export function fitSvgSingleLineText(
  options: textFit.FitSingleLineTextOptions,
): textFit.FittedSingleLineText | null {
  return withPretextRuntime((pretext) =>
    textFit.fitSingleLineTextToWidth(pretext, options),
  );
}

export function fitSvgPairedText(
  options: textFit.FitPairedTextOptions,
): textFit.FitPairedTextResult | null {
  return withPretextRuntime((pretext) =>
    textFit.fitPairedTextToWidth(pretext, options),
  );
}

export function fitSvgAnchoredTextPair(
  options: textFit.FitAnchoredTextPairOptions,
): textFit.FitAnchoredTextPairResult | null {
  return withPretextRuntime((pretext) =>
    textFit.fitAnchoredTextPairToWidth(pretext, options),
  );
}

export interface ResolvedSvgTitleTextFit {
  text: string;
  /** Final font size used for the title after runtime measurement or heuristic fallback. */
  fontSize: number;
  /** Natural width from runtime measurement, or null when only heuristic sizing was possible. */
  naturalWidth: number | null;
  /** Overflow in pixels, or null when runtime measurement was unavailable. */
  overflowPx: number | null;
  /** Whether the runtime fit truncated the text, or null when the heuristic fallback was used. */
  truncated: boolean | null;
  /** Whether the text wrapped at the fitted width, or null when the heuristic fallback was used. */
  wrapsAtWidth: boolean | null;
}

export interface SvgTextLengthAdjustFit {
  fontSize: number;
  naturalWidth: number | null;
  truncated: boolean | null;
}

export interface BuildSvgTextLengthAdjustAttributesOptions {
  /** Starting font size used to decide when the attribute should clamp width. */
  initialFontSize?: number;
  /** Maximum allowed text width in pixels. */
  maxWidth: number;
  /** Fractional shrink threshold; defaults to 0.25, meaning 25% below the initial size. */
  shrinkThreshold?: number;
}

export interface ResolveSvgTitleTextFitOptions {
  /** Optional font family override; defaults to the shared SVG title stack. */
  fontFamily?: string;
  /** Optional font weight override; defaults to 600. */
  fontWeight?: number;
  /** Optional starting font size; defaults to 18. */
  initialFontSize?: number;
  /** Maximum allowed title width in pixels. */
  maxWidth: number;
  /** Optional minimum font size; defaults to 8. */
  minFontSize?: number;
  /** Untrusted title text to fit. */
  text: string;
}

/**
 * Fit a title string for SVG rendering using the shared pretext runtime.
 *
 * @param options - Font, width, and text settings for the title.
 * @returns A resolved fit object containing the fitted text and runtime
 * measurement metadata. When runtime measurement is unavailable, the returned
 * object keeps `naturalWidth`, `overflowPx`, `truncated`, and `wrapsAtWidth`
 * nullable and falls back to a heuristic font size computed from the provided
 * bounds.
 *
 * @remarks The defaults are `fontFamily = DEFAULT_FONT_FAMILY`,
 * `fontWeight = 600`, `initialFontSize = DEFAULT_TITLE_INITIAL_FONT_SIZE`, and
 * `minFontSize = DEFAULT_TITLE_MIN_FONT_SIZE`. When `fitSvgSingleLineText`
 * returns null, the function uses `calculateHeuristicDynamicFontSizeValue` so
 * callers still receive a usable size without DOM or layout measurement.
 */
export function resolveSvgTitleTextFit(
  options: ResolveSvgTitleTextFitOptions,
): ResolvedSvgTitleTextFit {
  const effectiveMaxWidth = Math.max(
    1,
    Math.floor(options.maxWidth * TITLE_FIT_BROWSER_SAFETY_FACTOR),
  );

  const fit = fitSvgSingleLineText({
    fontFamily: options.fontFamily ?? DEFAULT_FONT_FAMILY,
    fontWeight: options.fontWeight ?? 600,
    initialFontSize: options.initialFontSize ?? DEFAULT_TITLE_INITIAL_FONT_SIZE,
    maxWidth: effectiveMaxWidth,
    minFontSize: options.minFontSize ?? DEFAULT_TITLE_MIN_FONT_SIZE,
    mode: "shrink-then-truncate",
    text: options.text,
  });

  if (fit) {
    return {
      text: fit.text,
      fontSize: fit.fontSize,
      naturalWidth: fit.naturalWidth,
      overflowPx: fit.overflowPx,
      truncated: fit.truncated,
      wrapsAtWidth: fit.wrapsAtWidth,
    };
  }

  return {
    text: options.text,
    fontSize: textFit.calculateHeuristicDynamicFontSizeValue(
      options.text,
      options.initialFontSize ?? DEFAULT_TITLE_INITIAL_FONT_SIZE,
      effectiveMaxWidth,
      options.minFontSize ?? DEFAULT_TITLE_MIN_FONT_SIZE,
    ),
    naturalWidth: null,
    overflowPx: null,
    // Runtime measurement is unavailable here, so truncation remains unknown.
    truncated: null,
    wrapsAtWidth: null,
  };
}

/**
 * Build safe `textLength`/`lengthAdjust` attributes for an SVG text element.
 *
 * @param fit - The fitted text metadata returned from the pretext runtime.
 * @param options - Width and clamp-threshold settings for the attribute pair.
 * @returns Either an empty string when no adjustment is needed or a string
 * that begins with a single leading space and contains only safe attribute
 * assignments suitable for inlining into an opening `<text>` tag.
 *
 * @remarks The helper fails closed: if any required numeric input is missing or
 * invalid, it returns `""` instead of emitting partial markup.
 */
export function buildSvgTextLengthAdjustAttributes(
  fit: SvgTextLengthAdjustFit | null | undefined,
  options: BuildSvgTextLengthAdjustAttributesOptions,
): string {
  if (!fit) {
    return "";
  }

  const safeFitFontSize =
    Number.isFinite(fit.fontSize) && fit.fontSize > 0 ? fit.fontSize : null;
  const safeMaxWidth =
    Number.isFinite(options.maxWidth) && options.maxWidth > 0
      ? textFit.roundToTenths(options.maxWidth)
      : null;
  const initialFontSize = options.initialFontSize;
  const safeInitialFontSize =
    typeof initialFontSize === "number" &&
    Number.isFinite(initialFontSize) &&
    initialFontSize > 0
      ? initialFontSize
      : safeFitFontSize;

  if (
    safeFitFontSize === null ||
    safeMaxWidth === null ||
    safeInitialFontSize === null
  ) {
    return "";
  }

  const shrinkThreshold = Math.min(
    1,
    Math.max(0, options.shrinkThreshold ?? DEFAULT_SHRINK_THRESHOLD),
  );
  const thresholdFontSize = safeInitialFontSize * (1 - shrinkThreshold);
  const hasMeasuredNaturalWidth =
    typeof fit.naturalWidth === "number" && Number.isFinite(fit.naturalWidth);
  const safeNaturalWidth = hasMeasuredNaturalWidth ? fit.naturalWidth : null;
  const shouldClampWidth =
    fit.truncated === true ||
    // Only clamp measured text. Heuristic fallback fits do not have a trustworthy
    // natural width, so emitting textLength there can stretch short titles
    // dramatically instead of degrading gracefully.
    (safeNaturalWidth !== null &&
      (safeNaturalWidth > safeMaxWidth - textFit.PRETEXT_WIDTH_EPSILON_PX ||
        safeFitFontSize < thresholdFontSize));

  if (!shouldClampWidth) {
    return "";
  }

  const safeMaxWidthText = String(safeMaxWidth);
  if (!/^\d+(?:\.\d+)?$/.test(safeMaxWidthText)) {
    return "";
  }

  const safeTextLengthAttr = `textLength="${safeMaxWidthText}"`;
  const safeLengthAdjustAttr = `lengthAdjust="spacingAndGlyphs"`;

  // The leading space is intentional so callers can concatenate this pair of
  // attributes directly into an opening tag without managing separators.
  return ` ${safeTextLengthAttr} ${safeLengthAdjustAttr}`;
}
