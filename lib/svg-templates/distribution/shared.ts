import type { TrustedSVG } from "@/lib/types/svg";

import { generateCardBackground } from "@/lib/svg-templates/common/base-template-utils";
import { generateCommonStyles } from "@/lib/svg-templates/common/style-generators";
import {
  ANIMATION,
  DISTRIBUTION,
  SPACING,
  TYPOGRAPHY,
} from "@/lib/svg-templates/common/constants";
import { getCardDimensions } from "@/lib/svg-templates/common/dimensions";
import {
  createRectElement,
  createStaggeredGroup,
  createTextElement,
} from "@/lib/svg-templates/common/svg-primitives";

import {
  calculateDynamicFontSize,
  getCardBorderRadius,
  processColorsForSVG,
  escapeForXml,
  markTrustedSvg,
  toFiniteNumber,
} from "@/lib/utils";
import type { ColorValue } from "@/lib/types/card";

/** Simple representation of a distribution item with value and a count. @source */
interface DistributionDatum {
  value: number;
  count: number;
}

/**
 * Input shape expected by the distribution SVG template including user info,
 * visual styles and data points.
 * @source
 */
interface DistributionTemplateInput {
  username: string;
  mediaType: "anime" | "manga";
  kind: "score" | "year";
  styles: {
    titleColor: ColorValue;
    backgroundColor: ColorValue;
    textColor: ColorValue;
    circleColor: ColorValue;
    borderColor?: ColorValue;
    borderRadius?: number;
  };
  variant?: "default" | "horizontal" | "cumulative";
  data: DistributionDatum[];
}

/**
 * Generates an SVG cumulative distribution chart (CDF) for score distributions.
 * Expects data sorted by ascending score value.
 * @source
 */
function generateCumulativeChart(
  dataAsc: DistributionDatum[],
  dims: { w: number; h: number },
): string {
  const left = 56;
  const right = 22;
  const top = 78;
  const bottom = 42;

  const chartW = Math.max(10, dims.w - left - right);
  const chartH = Math.max(10, dims.h - top - bottom);

  const total = dataAsc.reduce((sum, d) => sum + d.count, 0);
  let cumulative = 0;

  const n = dataAsc.length;
  const stepX = n > 1 ? chartW / (n - 1) : 0;
  const points = dataAsc.map((d, i) => {
    cumulative += d.count;
    const pct = total > 0 ? (cumulative / total) * 100 : 0;
    const x = left + i * stepX;
    const y = top + chartH - (pct / 100) * chartH;
    return { x, y, pct, score: d.value };
  });

  const polylinePoints = points
    .map((p) => `${p.x.toFixed(2)},${p.y.toFixed(2)}`)
    .join(" ");

  const areaPath = (() => {
    if (points.length === 0) return "";
    const first = points[0];
    const last = points.at(-1)!;
    const d = [
      `M ${first.x.toFixed(2)} ${(top + chartH).toFixed(2)}`,
      `L ${first.x.toFixed(2)} ${first.y.toFixed(2)}`,
      ...points.slice(1).map((p) => `L ${p.x.toFixed(2)} ${p.y.toFixed(2)}`),
      `L ${last.x.toFixed(2)} ${(top + chartH).toFixed(2)}`,
      "Z",
    ].join(" ");
    return `<path class="cdf-area" d="${d}" />`;
  })();

  const gridLines = [0, 25, 50, 75, 100]
    .map((pct) => {
      const y = top + chartH - (pct / 100) * chartH;
      return `<g>
        <line class="cdf-grid" x1="${left}" y1="${y.toFixed(2)}" x2="${(left + chartW).toFixed(2)}" y2="${y.toFixed(2)}" />
        <text class="cdf-axis" x="${left - 10}" y="${(y + 4).toFixed(2)}" text-anchor="end">${pct}%</text>
      </g>`;
    })
    .join("");

  const xLabels = dataAsc
    .map((d, i) => {
      const show = n <= 12 || i % 2 === 0 || i === n - 1;
      if (!show) return "";
      const x = left + i * stepX;
      const y = top + chartH + 18;
      return `<text class="cdf-axis" x="${x.toFixed(2)}" y="${y.toFixed(2)}" text-anchor="middle">${d.value}</text>`;
    })
    .join("");

  const pointDots = points
    .map(
      (p, i) =>
        `<circle class="cdf-dot" cx="${p.x.toFixed(2)}" cy="${p.y.toFixed(2)}" r="${i === points.length - 1 ? 2.4 : 2}" />`,
    )
    .join("");

  const legend =
    total > 0
      ? `<text class="cdf-legend" x="${left}" y="${(top - 10).toFixed(2)}">Cumulative % of entries</text>`
      : `<text class="cdf-legend" x="${left}" y="${(top - 10).toFixed(2)}">Cumulative % (no scores yet)</text>`;

  return [
    `<g>
      ${legend}
      ${gridLines}
      ${areaPath}
      <polyline class="cdf-line" points="${polylinePoints}" />
      ${pointDots}
      ${xLabels}
    </g>`,
    `<line class="cdf-baseline" x1="${left}" y1="${(top + chartH).toFixed(2)}" x2="${(left + chartW).toFixed(2)}" y2="${(top + chartH).toFixed(2)}" />`,
  ].join("");
}

/**
 * Ensures the expected score buckets are present in the provided list by
 * adding zero-count entries for missing values (e.g., 1-10 or 10-100 step 10).
 * @param provided - The array of provided DistributionDatum entries.
 * @param existing - A set of existing values to skip when adding missing entries.
 * @source
 */
function addMissingScores(
  provided: DistributionDatum[],
  existing: Set<number>,
): void {
  const maxVal = Math.max(...provided.map((d) => d.value), 0);

  if (maxVal <= 10) {
    for (let v = 1; v <= 10; v++) {
      if (!existing.has(v)) {
        provided.push({ value: v, count: 0 });
      }
    }
  } else if (maxVal <= 100 && provided.every((d) => d.value % 10 === 0)) {
    for (let v = 10; v <= 100; v += 10) {
      if (!existing.has(v)) {
        provided.push({ value: v, count: 0 });
      }
    }
  }
}

/**
 * Normalize and fill distribution data for rendering. For score data this
 * ensures missing score buckets are filled; for year data it only returns
 * the provided values.
 * @param inputData - Raw distribution input data.
 * @param kind - Either 'score' or 'year' to determine normalization behavior.
 * @returns Sorted and normalized distribution data.
 * @source
 */
function normalizeDistributionData(
  inputData: DistributionDatum[],
  kind: "score" | "year",
): DistributionDatum[] {
  const provided = inputData
    .map((d) => {
      const v = toFiniteNumber(d.value, { label: "distribution.value" });
      const c = toFiniteNumber(d.count, { label: "distribution.count" });
      return v === null || c === null
        ? null
        : { value: v, count: Math.max(0, c) };
    })
    .filter((d): d is DistributionDatum => d !== null);

  const existing = new Set(provided.map((d) => d.value));

  if (kind === "score") {
    addMissingScores(provided, existing);
  }
  // For year kind, do not fill missing years; use only provided data

  return provided.toSorted((a, b) => b.value - a.value);
}

/**
 * Returns width/height dims for a variant, used by the SVG template to
 * properly size the generated card.
 * @param variant - Template variant name.
 * @returns An object containing width (w) and height (h).
 * @source
 */
/**
 * Generates SVG markup for horizontal bar items used in the default variant.
 * @param data - Array of distribution points.
 * @param maxCount - Maximum count used for scaling bar widths.
 * @param maxBarWidth - Width class for the longest bar.
 * @param barColor - Color to fill the bars with.
 * @returns A string containing SVG markup for the bars.
 * @source
 */
function generateBarItems(
  data: DistributionDatum[],
  maxCount: number,
  maxBarWidth: number,
  barColor: string,
  opts?: {
    showYearGaps?: boolean;
  },
): string {
  const showYearGaps = opts?.showYearGaps ?? false;
  const rowLabelBaselineY = 12;
  const gapMarkerLineY = rowLabelBaselineY + SPACING.ITEM_GAP / 3;
  const gapMarkerDotsY = gapMarkerLineY + 2;

  return data
    .map((d, i) => {
      const width = (d.count / maxCount) * maxBarWidth;
      const safeWidth = Math.max(2, width);
      const barStartX = DISTRIBUTION.BAR_START_X;
      const countBaseX = DISTRIBUTION.COUNT_BASE_X;

      const next = data[i + 1];
      const yearGapSize =
        showYearGaps && next ? Math.max(0, d.value - next.value - 1) : 0;

      const content = [
        createTextElement(0, 12, String(d.value), "score-label"),
        createRectElement(barStartX, 3, Number(safeWidth.toFixed(2)), 10, {
          rx: 3,
          fill: barColor,
          opacity: 0.85,
        }),
        createTextElement(
          countBaseX + safeWidth,
          12,
          String(d.count),
          "score-count",
        ),
        yearGapSize > 0
          ? [
              `<line class="year-gap-line" x1="${barStartX}" y1="${gapMarkerLineY - 1}" x2="${barStartX + maxBarWidth}" y2="${gapMarkerLineY}" />`,
              createTextElement(
                barStartX - 14,
                gapMarkerDotsY,
                "⋯",
                "year-gap-dots",
                {
                  textAnchor: "middle",
                  fontSize: TYPOGRAPHY.SMALL_TEXT_SIZE,
                },
              ),
            ].join("")
          : "",
      ].join("");

      return createStaggeredGroup(
        `translate(0, ${i * SPACING.ITEM_GAP})`,
        content,
        `${ANIMATION.BASE_DELAY + i * ANIMATION.MEDIUM_INCREMENT}ms`,
      );
    })
    .join("");
}

/**
 * Generates vertical bar SVG markup used by the compact horizontal variant.
 * @param data - Array of distribution points.
 * @param maxCount - Maximum count used for scaling bar heights.
 * @param barColor - Fill color for bars.
 * @returns A string containing SVG markup for vertical bars.
 * @source
 */
function generateVerticalBars(
  data: DistributionDatum[],
  maxCount: number,
  barColor: string,
  opts?: {
    /** When true, renders subtle markers when there are gaps between consecutive years. */
    showYearGaps?: boolean;
  },
): string {
  const showYearGaps = opts?.showYearGaps ?? false;

  return data
    .map((d, i) => {
      const height = Number(
        ((d.count / maxCount) * DISTRIBUTION.VERTICAL_BAR_MAX_HEIGHT).toFixed(
          2,
        ),
      );
      const x =
        i * DISTRIBUTION.VERTICAL_BAR_SPACING + DISTRIBUTION.COUNT_BASE_X;
      const barTop = DISTRIBUTION.VERTICAL_BAR_Y_BASE - height;

      const next = data[i + 1];
      const yearGapSize =
        showYearGaps && next ? Math.max(0, d.value - next.value - 1) : 0;

      const content = [
        createTextElement(0, barTop - 6, String(d.count), "h-count", {
          textAnchor: "middle",
          fontSize: TYPOGRAPHY.SMALL_TEXT_SIZE,
        }),
        createRectElement(
          -DISTRIBUTION.VERTICAL_BAR_WIDTH / 2,
          barTop,
          DISTRIBUTION.VERTICAL_BAR_WIDTH,
          height,
          {
            rx: 2,
            fill: barColor,
          },
        ),
        yearGapSize > 0
          ? [
              `<line class="year-gap-line" x1="${DISTRIBUTION.VERTICAL_BAR_SPACING / 2}" y1="12" x2="${DISTRIBUTION.VERTICAL_BAR_SPACING / 2}" y2="${DISTRIBUTION.VERTICAL_BAR_Y_BASE + 4}" />`,
              createTextElement(
                DISTRIBUTION.VERTICAL_BAR_SPACING / 2,
                DISTRIBUTION.VERTICAL_BAR_Y_BASE + 11,
                "⋯",
                "year-gap-dots",
                {
                  textAnchor: "middle",
                  fontSize: TYPOGRAPHY.SMALL_TEXT_SIZE,
                },
              ),
            ].join("")
          : "",
        createTextElement(
          0,
          DISTRIBUTION.VERTICAL_BAR_Y_BASE + 14,
          String(d.value),
          "h-score",
          {
            textAnchor: "middle",
            fontSize: TYPOGRAPHY.SMALL_TEXT_SIZE,
          },
        ),
      ].join("");

      return createStaggeredGroup(
        `translate(${x},0)`,
        content,
        `${ANIMATION.CHART_BASE_DELAY + i * ANIMATION.CHART_INCREMENT}ms`,
      );
    })
    .join("");
}

/**
 * Prepare rendered data for the template and compute summary stats.
 * - Slices and sorts based on variant/kind
 * - Computes the maximum count for scaling
 * - Detects gaps between non-consecutive years (for year kind)
 */
function prepareRenderedData(
  normalizedData: DistributionDatum[],
  variant: DistributionTemplateInput["variant"],
  kind: "score" | "year",
): {
  renderedData: DistributionDatum[];
  maxCount: number;
  hasYearGaps: boolean;
} {
  const renderedDataBase =
    variant === "horizontal"
      ? normalizedData.slice(0, DISTRIBUTION.MAX_ITEMS)
      : normalizedData;

  const renderedData =
    variant === "cumulative" && kind === "score"
      ? renderedDataBase.toSorted((a, b) => a.value - b.value)
      : renderedDataBase;

  let maxCount = 1;
  let hasYearGaps = false;

  for (let i = 0; i < renderedData.length; i += 1) {
    const current = renderedData[i];

    if (current.count > maxCount) {
      maxCount = current.count;
    }

    if (!hasYearGaps && kind === "year" && i < renderedData.length - 1) {
      const next = renderedData[i + 1];
      if (next && current.value - next.value > 1) {
        hasYearGaps = true;
      }
    }
  }

  return { renderedData, maxCount, hasYearGaps };
}

/**
 * Compute the required dimensions for a variant based on the rendered data
 */
function computeDimsForVariant(
  variant: DistributionTemplateInput["variant"],
  renderedData: DistributionDatum[],
  baseDims: { w: number; h: number },
) {
  if (variant === "horizontal") {
    const n = renderedData.length;
    if (n <= 0) return baseDims;

    const lastX =
      (n - 1) * DISTRIBUTION.VERTICAL_BAR_SPACING + DISTRIBUTION.COUNT_BASE_X;
    const requiredWidth =
      lastX + DISTRIBUTION.VERTICAL_BAR_WIDTH / 2 + SPACING.CARD_PADDING;

    return {
      ...baseDims,
      w: Math.max(baseDims.w, Math.ceil(requiredWidth)),
    };
  }

  const n = renderedData.length;
  if (n <= 0) return baseDims;

  const chartTopY = 70;
  const lastRowBottom = chartTopY + (n - 1) * SPACING.ITEM_GAP + (4 + 10); // rect y + rect height
  const requiredHeight = lastRowBottom + SPACING.CARD_PADDING;

  return {
    ...baseDims,
    h: Math.max(baseDims.h, Math.ceil(requiredHeight)),
  };
}

/**
 * Build the main content SVG string for the given variant and kind.
 */
function renderMainContent(
  variant: DistributionTemplateInput["variant"],
  kind: "score" | "year",
  renderedData: DistributionDatum[],
  opts: {
    dims: { w: number; h: number };
    maxCount: number;
    maxBarWidth: number;
    barColor: string;
    showYearGaps: boolean;
  },
) {
  const { dims, maxCount, maxBarWidth, barColor, showYearGaps } = opts;

  if (variant === "horizontal") {
    return `<g transform="translate(0,40)">${generateVerticalBars(renderedData, maxCount, barColor, { showYearGaps })}</g>`;
  }

  if (variant === "cumulative" && kind === "score") {
    return generateCumulativeChart(renderedData, dims);
  }

  return `<g transform="translate(30,70)">${generateBarItems(renderedData, maxCount, maxBarWidth, barColor, { showYearGaps })}</g>`;
}

/**
 * Renders an SVG string representing a distribution (score or year)
 * chart for a user; the output is a ready-to-embed SVG string.
 * @param input - The DistributionTemplateInput containing user, styles and data.
 * @returns A string containing the generated SVG markup.
 * @source
 */
export function distributionTemplate(
  input: DistributionTemplateInput,
): TrustedSVG {
  const { username, mediaType, styles, variant = "default", kind } = input;

  // Process colors for gradient support
  const { gradientDefs, resolvedColors } = processColorsForSVG(
    {
      titleColor: styles.titleColor,
      backgroundColor: styles.backgroundColor,
      textColor: styles.textColor,
      circleColor: styles.circleColor,
      borderColor: styles.borderColor,
    },
    [
      "titleColor",
      "backgroundColor",
      "textColor",
      "circleColor",
      "borderColor",
    ],
  );
  const cardRadius = getCardBorderRadius(styles.borderRadius);

  // Normalize and sort data
  const normalizedData = normalizeDistributionData(input.data, kind);

  const { renderedData, maxCount, hasYearGaps } = prepareRenderedData(
    normalizedData,
    variant,
    kind,
  );

  const showYearGaps = kind === "year";

  // Generate title and get dimensions
  const baseTitle =
    kind === "score" ? "Score Distribution" : "Year Distribution";
  const title = `${username}'s ${capitalize(mediaType)} ${baseTitle}`;
  const safeTitle = escapeForXml(title);
  const baseDims = getCardDimensions("distribution", variant);
  const dims = computeDimsForVariant(variant, renderedData, baseDims);

  // Layout constants
  const barColor = resolvedColors.circleColor;
  const countBaseX = DISTRIBUTION.COUNT_BASE_X;
  const maxBarWidth = Math.max(
    10,
    dims.w - countBaseX - DISTRIBUTION.MAX_BAR_WIDTH_OFFSET,
  );

  // Generate content based on variant
  const mainContent = renderMainContent(variant, kind, renderedData, {
    dims,
    maxCount,
    maxBarWidth,
    barColor,
    showYearGaps,
  });

  const headerFontSize = calculateDynamicFontSize(title, 18, 300);
  const headerFontSizeNumber = Number.parseFloat(headerFontSize) || 18;

  return markTrustedSvg(`
<svg
    xmlns="http://www.w3.org/2000/svg"
    width="${dims.w}"
    height="${dims.h}"
    viewBox="0 0 ${dims.w} ${dims.h}"
    fill="none"
    role="img"
    aria-labelledby="desc-id"
  >
    ${gradientDefs ? `<defs>${gradientDefs}</defs>` : ""}
    <title id="title-id">${safeTitle}</title>
    <desc id="desc-id">${escapeForXml(
      [
        normalizedData.map((d) => `${d.value}:${d.count}`).join(", "),
        variant === "cumulative" && kind === "score"
          ? "Cumulative distribution curve shows the percentage of entries at or below each score bucket."
          : "",
        hasYearGaps
          ? "Gaps between non-consecutive years are indicated with dashed separators."
          : "",
      ]
        .filter(Boolean)
        .join(" "),
    )}</desc>
    <style>
      ${generateCommonStyles(resolvedColors, headerFontSizeNumber)}
      .score-label,.score-count,.h-score,.h-count { fill:${resolvedColors.textColor}; font:400 ${TYPOGRAPHY.STAT_LABEL_SIZE}px 'Segoe UI', Ubuntu, Sans-Serif; }
      .score-count { font-size:${TYPOGRAPHY.SECTION_TITLE_SIZE}px; }
      .h-score,.h-count { font-size:${TYPOGRAPHY.SMALL_TEXT_SIZE}px; }
      .year-gap-line { stroke:${resolvedColors.textColor}; stroke-width:1; stroke-dasharray:3 3; opacity:0.35; }
      .year-gap-dots { fill:${resolvedColors.textColor}; opacity:0.55; }
      .cdf-grid { stroke:${resolvedColors.textColor}; stroke-width:1; opacity:0.12; }
      .cdf-baseline { stroke:${resolvedColors.textColor}; stroke-width:1; opacity:0.22; }
      .cdf-axis { fill:${resolvedColors.textColor}; font:400 ${TYPOGRAPHY.SMALL_TEXT_SIZE}px 'Segoe UI', Ubuntu, Sans-Serif; opacity:0.85; }
      .cdf-legend { fill:${resolvedColors.textColor}; font:600 ${TYPOGRAPHY.SMALL_TEXT_SIZE}px 'Segoe UI', Ubuntu, Sans-Serif; opacity:0.9; }
      .cdf-line { stroke:${resolvedColors.circleColor}; stroke-width:2.5; fill:none; stroke-linecap:round; stroke-linejoin:round; }
      .cdf-area { fill:${resolvedColors.circleColor}; opacity:0.14; }
      .cdf-dot { fill:${resolvedColors.circleColor}; opacity:0.95; }
    </style>
    ${generateCardBackground(dims, cardRadius, resolvedColors)}
    <g transform="translate(20,35)"><text class="header">${safeTitle}</text></g>
    ${mainContent}
  </svg>`);
}

/**
 * Factory function to create distribution template wrappers.
 * Accepts mediaType and kind, returns a wrapper that omits both from input.
 */
export function createDistributionTemplate(
  mediaType: "anime" | "manga",
  kind: "score" | "year",
) {
  return (
    input: Omit<
      Parameters<typeof distributionTemplate>[0],
      "mediaType" | "kind"
    >,
  ) => {
    return distributionTemplate({ ...input, mediaType, kind });
  };
}

/** Capitalize the first letter of a string. @source */
function capitalize(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
