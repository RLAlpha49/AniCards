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
  variant?: "default" | "horizontal";
  data: DistributionDatum[];
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

/*
Variants:
- default: Horizontal list of proportional bars (like previous score default)
- horizontal: Condensed mini vertical bars (like previous horizontal score variant)
*/
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
  const data = normalizeDistributionData(input.data, kind);
  const renderedData =
    variant === "horizontal" ? data.slice(0, DISTRIBUTION.MAX_ITEMS) : data;
  const maxCount = Math.max(1, ...renderedData.map((d) => d.count));

  const showYearGaps = kind === "year";
  const hasYearGaps =
    showYearGaps &&
    renderedData.some((d, i) => {
      const next = renderedData[i + 1];
      return next ? d.value - next.value > 1 : false;
    });

  // Generate title and get dimensions
  const baseTitle =
    kind === "score" ? "Score Distribution" : "Year Distribution";
  const title = `${username}'s ${capitalize(mediaType)} ${baseTitle}`;
  const safeTitle = escapeForXml(title);
  const baseDims = getCardDimensions("distribution", variant);

  const dims = (() => {
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

    // default variant
    const n = renderedData.length;
    if (n <= 0) return baseDims;

    const chartTopY = 70;
    const lastRowBottom = chartTopY + (n - 1) * SPACING.ITEM_GAP + (4 + 10); // rect y + rect height
    const requiredHeight = lastRowBottom + SPACING.CARD_PADDING;

    return {
      ...baseDims,
      h: Math.max(baseDims.h, Math.ceil(requiredHeight)),
    };
  })();

  // Layout constants
  const barColor = resolvedColors.circleColor;
  const countBaseX = DISTRIBUTION.COUNT_BASE_X;
  const maxBarWidth = Math.max(
    10,
    dims.w - countBaseX - DISTRIBUTION.MAX_BAR_WIDTH_OFFSET,
  );

  // Generate content based on variant
  const mainContent =
    variant === "horizontal"
      ? `<g transform="translate(0,40)">${generateVerticalBars(renderedData, maxCount, barColor, { showYearGaps })}</g>`
      : `<g transform="translate(30,70)">${generateBarItems(renderedData, maxCount, maxBarWidth, barColor, { showYearGaps })}</g>`;

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
        data.map((d) => `${d.value}:${d.count}`).join(", "),
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
