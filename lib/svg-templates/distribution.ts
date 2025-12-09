import type { TrustedSVG } from "@/lib/types/svg";

import {
  calculateDynamicFontSize,
  getCardBorderRadius,
  processColorsForSVG,
  escapeForXml,
  markTrustedSvg,
  toFiniteNumber,
} from "../utils";
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
function getDimensions(variant: "default" | "horizontal"): {
  w: number;
  h: number;
} {
  if (variant === "horizontal") {
    return { w: 320, h: 150 };
  } else {
    return { w: 350, h: 260 };
  }
}

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
): string {
  return data
    .map((d, i) => {
      const width = (d.count / maxCount) * maxBarWidth;
      const safeWidth = Math.max(2, width);
      const barStartX = 30;
      const countBaseX = 35;

      return `<g class="stagger" style="animation-delay:${400 + i * 90}ms" transform="translate(0, ${i * 18})">
      <text class="score-label" x="0" y="12">${d.value}</text>
      <rect x="${barStartX}" y="4" rx="3" height="10" width="${safeWidth.toFixed(2)}" fill="${barColor}" opacity="0.85" />
      <text class="score-count" x="${countBaseX + safeWidth}" y="12">${d.count}</text>
    </g>`;
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
): string {
  return data
    .slice(0, 15)
    .map((d, i) => {
      const height = ((d.count / maxCount) * 70).toFixed(2);
      const x = i * 28 + 35;
      const barTop = 90 - Number(height);

      return `<g class="stagger" style="animation-delay:${350 + i * 70}ms" transform="translate(${x},0)">
      <text class="h-count" text-anchor="middle" x="0" y="${barTop - 6}" font-size="10">${d.count}</text>
      <rect x="-6" y="${barTop}" width="12" height="${height}" rx="2" fill="${barColor}" />
      <text class="h-score" text-anchor="middle" x="0" y="104" font-size="10">${d.value}</text>
    </g>`;
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
  const maxCount = Math.max(1, ...data.map((d) => d.count));

  // Generate title and get dimensions
  const baseTitle =
    kind === "score" ? "Score Distribution" : "Year Distribution";
  const title = `${username}'s ${capitalize(mediaType)} ${baseTitle}`;
  const safeTitle = escapeForXml(title);
  const dims = getDimensions(variant);

  // Layout constants
  const barColor = resolvedColors.circleColor;
  const rightPadding = 60;
  const countBaseX = 35;
  const maxBarWidth = Math.max(10, dims.w - countBaseX - rightPadding);

  // Generate content based on variant
  const mainContent =
    variant === "horizontal"
      ? `<g transform="translate(0,40)">${generateVerticalBars(data, maxCount, barColor)}</g>`
      : `<g transform="translate(30,70)">${generateBarItems(data, maxCount, maxBarWidth, barColor)}</g>`;

  const headerFontSize = calculateDynamicFontSize(title, 18, 300);

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
    <desc id="desc-id">${escapeForXml(data.map((d) => `${d.value}:${d.count}`).join(", "))}</desc>
    <style>
      /* stylelint-disable selector-class-pattern, keyframes-name-pattern */
      .header { 
        fill: ${resolvedColors.titleColor};
        font: 600 ${headerFontSize}px 'Segoe UI', Ubuntu, Sans-Serif;
        animation: fadeInAnimation 0.8s ease-in-out forwards;
      }
      .score-label,.score-count,.h-score,.h-count { fill:${resolvedColors.textColor}; font:400 12px 'Segoe UI', Ubuntu, Sans-Serif; }
      .score-count { font-size:11px; }
      .h-score,.h-count { font-size:10px; }
      .stagger { opacity:0; animation: fadeInAnimation 0.6s ease forwards; }
      @keyframes fadeInAnimation { from { opacity:0 } to { opacity:1 } }
    </style>
    <rect
      x="0.5"
      y="0.5"
      width="${dims.w - 1}"
      height="${dims.h - 1}"
      rx="${cardRadius}"
      fill="${resolvedColors.backgroundColor}"
      ${resolvedColors.borderColor ? `stroke="${resolvedColors.borderColor}"` : ""}
      stroke-width="2"
    />
    <g transform="translate(20,35)"><text class="header">${safeTitle}</text></g>
    ${mainContent}
  </svg>`);
}

/** Capitalize the first letter of a string. @source */
function capitalize(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
