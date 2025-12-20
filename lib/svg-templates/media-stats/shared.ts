import { AnimeStats, MangaStats, ColorValue } from "@/lib/types/card";
import type { TrustedSVG } from "@/lib/types/svg";

import {
  generateCommonStyles,
  generateRankCircleStyles,
} from "@/lib/svg-templates/common/style-generators";
import { generateCardBackground } from "@/lib/svg-templates/common/base-template-utils";
import {
  createGroupElement,
  createStaggeredGroup,
  createTextElement,
} from "@/lib/svg-templates/common/svg-primitives";

import {
  calculateDynamicFontSize,
  processColorsForSVG,
  getCardBorderRadius,
  escapeForXml,
  markTrustedSvg,
  toFiniteNumber,
} from "@/lib/utils";
import {
  ANIMATION,
  POSITIONING,
  SHAPES,
  SPACING,
} from "@/lib/svg-templates/common/constants";
import { getCardDimensions } from "@/lib/svg-templates/common/dimensions";

/** Media type used by the media stats templates — either anime or manga. @source */
export type MediaType = "anime" | "manga";

/**
 * Renders an SVG circular progress indicator and rim used by rank visuals.
 * @param cx - Circle center X coordinate.
 * @param cy - Circle center Y coordinate.
 * @param radius - Circle radius.
 * @param strokeColor - Color used for the progress stroke.
 * @param scaledDasharray - Dasharray applied for circumference.
 * @param scaledDashoffset - Dashoffset to animate progress.
 * @param strokeWidth - Optional stroke width.
 * @returns SVG markup string for the circle visuals.
 * @source
 */
function renderCircle(
  cx: number,
  cy: number,
  radius: number,
  strokeColor: string,
  scaledDasharray?: string | null,
  scaledDashoffset?: string | null,
  strokeWidth: number = 6,
): string {
  const rim = `<circle class="rank-circle-rim" cx="${cx}" cy="${cy}" r="${radius}" fill="none" stroke="${strokeColor}" stroke-opacity="0.2" stroke-width="${strokeWidth}"></circle>`;
  const dasharrayAttr = scaledDasharray
    ? `stroke-dasharray="${scaledDasharray}"`
    : "";
  const dashoffsetAttr = scaledDashoffset
    ? `stroke-dashoffset="${scaledDashoffset}"`
    : "";
  const circle = `<circle class="rank-circle" cx="${cx}" cy="${cy}" r="${radius}" stroke-width="${strokeWidth}" ${dasharrayAttr} ${dashoffsetAttr}></circle>`;
  const rotated = createGroupElement(`rotate(-90 ${cx} ${cy})`, circle);
  return `
    ${rim}
    ${rotated}
  `;
}

/**
 * Render a list of labeled stats as an SVG fragment.
 * @param stats - Array of label/value pairs to render.
 * @param transform - SVG transform applied to the container group.
 * @param xOffset - X offset for numbers.
 * @param ySpacing - Vertical spacing between rows.
 * @param animationDelay - Initial animation delay in ms.
 * @param animationIncrement - Incremental animation delay per row in ms.
 * @returns SVG markup string for the stats list.
 * @source
 */
function renderStatsList(
  stats: Array<{ label: string; value: number | undefined }>,
  transform: string = `translate(${SPACING.CARD_PADDING}, 0)`,
  xOffset: number = POSITIONING.STAT_VALUE_X_COMPACT,
  ySpacing: number = SPACING.ROW_HEIGHT_COMPACT,
  animationDelay: number = ANIMATION.BASE_DELAY,
  animationIncrement: number = ANIMATION.STAGGER_INCREMENT,
): string {
  const rows = stats
    .filter((stat) => stat.value !== undefined)
    .map((stat, index) => {
      const content =
        createTextElement(0, 12.5, stat.label, "stat") +
        createTextElement(xOffset, 12.5, String(stat.value), "stat");
      return createStaggeredGroup(
        `translate(25, ${index * ySpacing})`,
        content,
        `${animationDelay + index * animationIncrement}ms`,
      );
    })
    .join("");

  return createGroupElement(transform, rows);
}

/**
 * Generate the variant-specific SVG content for media stats template.
 * Handles default/compact/vertical/minimal variants with different layouts.
 * @param data - The template input with stats and styles.
 * @param config - Derived configuration for the main stat and title.
 * @param dims - Width and height for the card.
 * @param scaledDasharray - Pre-scaled dasharray for rank visualization.
 * @param scaledDashoffset - Pre-scaled dashoffset for rank visualization.
 * @param resolvedColors - Pre-processed color values as strings.
 * @returns SVG markup fragment appropriate for the chosen variant.
 * @source
 */
function getVariantContent(
  data: {
    variant?: "default" | "vertical" | "compact" | "minimal";
    styles: {
      titleColor: ColorValue;
      backgroundColor: ColorValue;
      textColor: ColorValue;
      circleColor: ColorValue;
      borderColor?: ColorValue;
    };
    stats: (AnimeStats | MangaStats) & {
      previousMilestone: number;
      currentMilestone: number;
      dasharray: string;
      dashoffset: string;
    };
  },
  config: {
    title: string;
    mainStat: {
      label: string;
      value: number | undefined;
      secondary: {
        label: string;
        value: number | undefined;
      };
    };
  },
  dims: { w: number; h: number },
  scaledDasharray: string | null,
  scaledDashoffset: string | null,
  resolvedColors: Record<string, string>,
): string {
  if (data.variant === "vertical") {
    const stats = [
      { label: "Count:", value: data.stats.count },
      { label: `${config.mainStat.label}:`, value: config.mainStat.value },
      {
        label: `${config.mainStat.secondary.label}:`,
        value: config.mainStat.secondary.value,
      },
      { label: "Mean Score:", value: data.stats.meanScore },
      { label: "Standard Deviation:", value: data.stats.standardDeviation },
    ];

    return `
      <g transform="translate(230, 140)">
        <text x="-100" y="-130" class="milestone" text-anchor="middle">${data.stats.currentMilestone}</text>
        <text x="-100" y="-70" class="main-stat" text-anchor="middle">${config.mainStat.value}</text>
        <text x="-100" y="-10" class="label" text-anchor="middle">${config.mainStat.label}</text>
        ${renderCircle(-100, -72, 40, resolvedColors.circleColor, scaledDasharray, scaledDashoffset)}
      </g>
      <svg x="0" y="0">
        ${renderStatsList(stats, "translate(0, 150)")}
      </svg>
    `;
  } else if (data.variant === "compact") {
    const stats = [
      { label: "Count:", value: data.stats.count },
      {
        label: `${config.mainStat.secondary.label}:`,
        value: config.mainStat.secondary.value,
      },
      { label: "Mean Score:", value: data.stats.meanScore },
    ];

    return `
      <g transform="translate(${dims.w - 50}, 20)">
        <text x="-10" y="15" class="main-stat" text-anchor="middle" fill="${resolvedColors.textColor}" font-size="16">${config.mainStat.value}</text>
        ${renderCircle(-10, 10, 30, resolvedColors.textColor, scaledDasharray, scaledDashoffset, 5)}
      </g>
      <svg x="0" y="0">
        ${renderStatsList(stats, "translate(0, 0)", 120, 22, 450, 120)}
      </svg>
    `;
  } else if (data.variant === "minimal") {
    return `
      <g transform="translate(${Math.round(dims.w / 2)}, 20)">
        <text x="0" y="5" class="main-stat" text-anchor="middle" fill="${resolvedColors.textColor}" font-size="16">${config.mainStat.value}</text>
        <text x="0" y="50" class="label" text-anchor="middle" fill="${resolvedColors.circleColor}" font-size="14">${config.mainStat.label}</text>
        ${renderCircle(0, 0, 28, resolvedColors.textColor, scaledDasharray, scaledDashoffset, 5)}
      </g>
    `;
  } else {
    // Default variant
    const stats = [
      { label: "Count:", value: data.stats.count },
      { label: `${config.mainStat.label}:`, value: config.mainStat.value },
      {
        label: `${config.mainStat.secondary.label}:`,
        value: config.mainStat.secondary.value,
      },
      { label: "Mean Score:", value: data.stats.meanScore },
      { label: "Standard Deviation:", value: data.stats.standardDeviation },
    ];

    return `
      <g transform="translate(375, 37.5)">
        <text x="-10" y="-50" class="milestone" text-anchor="middle" fill="${resolvedColors.circleColor}">
          ${data.stats.currentMilestone}
        </text>
        <text x="-10" y="10" class="main-stat" text-anchor="middle" fill="${resolvedColors.textColor}">
          ${config.mainStat.value}
        </text>
        <text x="-10" y="70" class="label" text-anchor="middle" fill="${resolvedColors.circleColor}">
          ${config.mainStat.label}
        </text>
        ${renderCircle(-10, 8, 40, resolvedColors.textColor, scaledDasharray, scaledDashoffset)}
      </g>
      <svg x="0" y="0">
        ${renderStatsList(stats, "translate(0, 0)", 199.01)}
      </svg>
    `;
  }
}

/**
 * Renders an SVG string that visualizes anime or manga statistics. The
 * function returns a fully formed SVG markup string that can be embedded
 * as an image or served as the response to the SVG card endpoint.
 * @param data - Template input including mediaType, username, styles and stats.
 * @returns A string containing the SVG markup for the card.
 * @source
 */
export const mediaStatsTemplate = (data: {
  mediaType: MediaType;
  username: string;
  variant?: "default" | "vertical" | "compact" | "minimal";
  styles: {
    titleColor: ColorValue;
    backgroundColor: ColorValue;
    textColor: ColorValue;
    circleColor: ColorValue;
    borderColor?: ColorValue;
    borderRadius?: number;
  };
  stats: (AnimeStats | MangaStats) & {
    previousMilestone: number;
    currentMilestone: number;
    dasharray: string;
    dashoffset: string;
  };
}): TrustedSVG => {
  // Process colors for gradient support
  const { gradientDefs, resolvedColors } = processColorsForSVG(
    {
      titleColor: data.styles.titleColor,
      backgroundColor: data.styles.backgroundColor,
      textColor: data.styles.textColor,
      circleColor: data.styles.circleColor,
      borderColor: data.styles.borderColor,
    },
    [
      "titleColor",
      "backgroundColor",
      "textColor",
      "circleColor",
      "borderColor",
    ],
  );

  const config = {
    anime: {
      title: `${data.username}'s Anime Stats`,
      mainStat: {
        label: "Episodes Watched",
        value: (data.stats as AnimeStats).episodesWatched,
        secondary: {
          label: "Minutes Watched",
          value: (data.stats as AnimeStats).minutesWatched,
        },
      },
    },
    manga: {
      title: `${data.username}'s Manga Stats`,
      mainStat: {
        label: "Chapters Read",
        value: (data.stats as MangaStats).chaptersRead,
        secondary: {
          label: "Volumes Read",
          value: (data.stats as MangaStats).volumesRead,
        },
      },
    },
  }[data.mediaType];

  const titleText = String(config.title);
  const safeTitle = escapeForXml(titleText);
  const safeMainStatLabel = escapeForXml(String(config.mainStat.label));
  const safeSecondaryStatLabel = escapeForXml(
    String(config.mainStat.secondary.label),
  );

  // Dimensions per variant
  const dims = getCardDimensions("mediaStats", data.variant ?? "default");

  // Circle radius per variant
  const circleRadius = (() => {
    if (data.variant === "compact") {
      return SHAPES.CIRCLE_RADIUS_MEDIUM;
    } else if (data.variant === "minimal") {
      return SHAPES.CIRCLE_RADIUS_SMALL;
    }
    return SHAPES.CIRCLE_RADIUS_LARGE;
  })();

  // Scale dasharray & dashoffset relative to base radius 40 to avoid overfill on smaller circles
  const baseRadius = SHAPES.CIRCLE_RADIUS_LARGE;
  const scale = circleRadius / baseRadius;
  const originalDasharray = toFiniteNumber(data.stats.dasharray, {
    label: "dasharray",
  });
  const originalDashoffset = toFiniteNumber(data.stats.dashoffset, {
    label: "dashoffset",
  });
  const hasValidDash =
    originalDasharray !== null && originalDashoffset !== null;
  const scaledDasharray = hasValidDash
    ? (originalDasharray * scale).toFixed(2)
    : null;
  const scaledDashoffset = hasValidDash
    ? (originalDashoffset * scale).toFixed(2)
    : null;
  const cardRadius = getCardBorderRadius(data.styles.borderRadius);
  const rankCircleStyle = generateRankCircleStyles(
    resolvedColors.circleColor,
    scaledDasharray,
    scaledDashoffset,
  );

  return markTrustedSvg(`
<svg
  xmlns="http://www.w3.org/2000/svg"
  width="${dims.w}"
  height="${dims.h}"
  viewBox="0 0 ${dims.w} ${dims.h}"
  fill="none"
  role="img"
  aria-labelledby="desc-id"
  style="overflow: visible"
>
  ${gradientDefs ? `<defs>${gradientDefs}</defs>` : ""}
  <title id="title-id">${safeTitle}</title>
  <desc id="desc-id">
    Count: ${escapeForXml(data.stats.count)}, 
    ${safeMainStatLabel}: ${escapeForXml(config.mainStat.value)},
    ${safeSecondaryStatLabel}: ${escapeForXml(config.mainStat.secondary.value)}, 
    Mean Score: ${escapeForXml(data.stats.meanScore)},
    Standard Deviation: ${escapeForXml(data.stats.standardDeviation)}
  </desc>
  <style>
    ${generateCommonStyles(resolvedColors, Number.parseFloat(calculateDynamicFontSize(titleText)) || 18)}
    ${rankCircleStyle}
  </style>
  ${generateCardBackground(dims, cardRadius, resolvedColors)}
  <g data-testid="card-title" transform="translate(25, 35)">
    <g transform="translate(0, 0)">
      <text x="0" y="0" class="header" data-testid="header">${safeTitle}</text>
    </g>
  </g>
  <g data-testid="main-card-body" transform="translate(0, 55)">
      ${getVariantContent(data, config, dims, scaledDasharray, scaledDashoffset, resolvedColors)}
  </g>
</svg>`);
};

/**
 * Factory function to create media-specific template wrappers.
 * Eliminates boilerplate by generating wrapper functions that inject mediaType.
 */
export function createMediaStatsTemplate(mediaType: MediaType) {
  return (
    input: Omit<Parameters<typeof mediaStatsTemplate>[0], "mediaType">,
  ) => {
    return mediaStatsTemplate({ ...input, mediaType });
  };
}
