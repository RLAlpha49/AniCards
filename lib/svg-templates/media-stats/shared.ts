/**
 * Shared renderer for the core anime and manga stats cards.
 *
 * Both media types share the same structural template, with this module swapping
 * the label/value configuration and layout variant so the visuals stay aligned
 * while avoiding duplicated SVG markup.
 */
import {
  buildSvgTextLengthAdjustAttributes,
  fitSvgSingleLineText,
  resolveSvgTitleTextFit,
} from "@/lib/pretext/runtime";
import { generateCardBackground } from "@/lib/svg-templates/common/base-template-utils";
import {
  ANIMATION,
  MIN_FONT_SIZE,
  POSITIONING,
  SHAPES,
  SPACING,
  TYPOGRAPHY,
} from "@/lib/svg-templates/common/constants";
import { getCardDimensions } from "@/lib/svg-templates/common/dimensions";
import {
  generateCommonStyles,
  generateRankCircleStyles,
} from "@/lib/svg-templates/common/style-generators";
import {
  createGroupElement,
  createStaggeredGroup,
  createTextElement,
} from "@/lib/svg-templates/common/svg-primitives";
import { AnimeStats, ColorValue, MangaStats } from "@/lib/types/card";
import type { TrustedSVG } from "@/lib/types/svg";
import {
  escapeForXml,
  getCardBorderRadius,
  markTrustedSvg,
  processColorsForSVG,
  toFiniteNumber,
} from "@/lib/utils";

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

const LABEL_SLOT_PADDING = 12;
const MIN_VALUE_WIDTH = 24;
const DEFAULT_VALUE_MAX_WIDTH = 96;
const VERTICAL_MILESTONE_MAX_WIDTH = 104;
const SHARED_MAIN_STAT_LABEL_MAX_WIDTH = 128;
const DEFAULT_MILESTONE_MAX_WIDTH = 100;
const COMPACT_MAIN_STAT_VALUE_MAX_WIDTH = 68;
const MINIMAL_MAIN_STAT_VALUE_MAX_WIDTH = 70;
const MINIMAL_MAIN_STAT_LABEL_MAX_WIDTH = 120;
const MIN_DEFAULT_TITLE_WIDTH = 140;
const DEFAULT_TITLE_RIGHT_MARGIN = 175;

type StatWithValue = {
  label: string;
  value: number;
};

function fitCircleText(options: {
  fontWeight: number;
  initialFontSize: number;
  maxWidth: number;
  minFontSize?: number;
  text: string;
}): ReturnType<typeof fitSvgSingleLineText> {
  return fitSvgSingleLineText({
    fontWeight: options.fontWeight,
    initialFontSize: options.initialFontSize,
    maxWidth: options.maxWidth,
    minFontSize: options.minFontSize ?? MIN_FONT_SIZE,
    mode: "shrink-then-truncate",
    text: options.text,
  });
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
  valueMaxWidth: number = DEFAULT_VALUE_MAX_WIDTH,
): string {
  const labelSlotWidth = Math.max(1, xOffset - LABEL_SLOT_PADDING);
  const rows = stats
    .filter((stat): stat is StatWithValue => stat.value !== undefined)
    .map((stat, index) => {
      const valueText = `${stat.value}`;
      const labelFit = fitSvgSingleLineText({
        fontWeight: 400,
        initialFontSize: TYPOGRAPHY.STAT_SIZE,
        maxWidth: labelSlotWidth,
        minFontSize: MIN_FONT_SIZE,
        mode: "shrink-then-truncate",
        text: stat.label,
      });
      const valueFit = fitSvgSingleLineText({
        fontWeight: 700,
        initialFontSize: TYPOGRAPHY.STAT_SIZE,
        maxWidth: Math.max(MIN_VALUE_WIDTH, valueMaxWidth),
        minFontSize: MIN_FONT_SIZE,
        mode: "shrink-then-truncate",
        text: valueText,
      });
      const content =
        createTextElement(0, 12.5, labelFit?.text ?? stat.label, "stat", {
          ...(labelFit ? { fontSize: labelFit.fontSize } : {}),
        }) +
        createTextElement(xOffset, 12.5, valueFit?.text ?? valueText, "stat", {
          ...(valueFit
            ? { fontSize: valueFit.fontSize, fontWeight: 700 }
            : { fontWeight: 700 }),
        });
      return createStaggeredGroup(
        `translate(25, ${index * ySpacing})`,
        content,
        `${animationDelay + index * animationIncrement}ms`,
      );
    })
    .join("");

  return createGroupElement(transform, rows);
}

interface MediaStatsVariantTemplateData {
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
}

interface MediaStatsVariantConfig {
  title: string;
  mainStat: {
    label: string;
    value: number | undefined;
    secondary: {
      label: string;
      value: number | undefined;
    };
  };
}

interface MediaStatsVariantArgs {
  config: MediaStatsVariantConfig;
  data: MediaStatsVariantTemplateData;
  dims: { w: number; h: number };
  resolvedColors: Record<string, string>;
  scaledDasharray: string | null;
  scaledDashoffset: string | null;
}

function buildStandardMediaStatsRows(args: MediaStatsVariantArgs) {
  return [
    { label: "Count:", value: args.data.stats.count },
    {
      label: `${args.config.mainStat.label}:`,
      value: args.config.mainStat.value,
    },
    {
      label: `${args.config.mainStat.secondary.label}:`,
      value: args.config.mainStat.secondary.value,
    },
    { label: "Mean Score:", value: args.data.stats.meanScore },
    { label: "Standard Deviation:", value: args.data.stats.standardDeviation },
  ];
}

function renderVerticalMediaStatsVariant(args: MediaStatsVariantArgs): string {
  const milestoneText = String(args.data.stats.currentMilestone);
  const mainStatValueText = String(args.config.mainStat.value ?? 0);
  const mainStatLabelText = String(args.config.mainStat.label);
  const milestoneFit = fitCircleText({
    fontWeight: 700,
    initialFontSize: TYPOGRAPHY.KPI_SIZE,
    maxWidth: VERTICAL_MILESTONE_MAX_WIDTH,
    text: milestoneText,
  });
  const mainStatValueFit = fitCircleText({
    fontWeight: 700,
    initialFontSize: TYPOGRAPHY.LARGE_TEXT_SIZE,
    maxWidth: POSITIONING.VALUE_MAX_WIDTH_DEFAULT,
    text: mainStatValueText,
  });
  const mainStatLabelFit = fitCircleText({
    fontWeight: 600,
    initialFontSize: TYPOGRAPHY.STAT_LABEL_SIZE,
    maxWidth: SHARED_MAIN_STAT_LABEL_MAX_WIDTH,
    text: mainStatLabelText,
  });
  const stats = buildStandardMediaStatsRows(args);

  return `
      <g transform="translate(230, 140)">
        <text x="-100" y="-130" class="milestone" text-anchor="middle"${milestoneFit ? ` font-size="${milestoneFit.fontSize}"` : ""}>${escapeForXml(milestoneFit?.text ?? milestoneText)}</text>
        <text x="-100" y="-70" class="main-stat" text-anchor="middle"${mainStatValueFit ? ` font-size="${mainStatValueFit.fontSize}"` : ""}>${escapeForXml(mainStatValueFit?.text ?? mainStatValueText)}</text>
        <text x="-100" y="-10" class="label" text-anchor="middle"${mainStatLabelFit ? ` font-size="${mainStatLabelFit.fontSize}"` : ""}>${escapeForXml(mainStatLabelFit?.text ?? mainStatLabelText)}</text>
        ${renderCircle(-100, -72, 40, args.resolvedColors.circleColor, args.scaledDasharray, args.scaledDashoffset)}
      </g>
      <svg x="0" y="0">
        ${renderStatsList(stats, "translate(0, 150)", POSITIONING.STAT_VALUE_X_COMPACT, SPACING.ROW_HEIGHT_COMPACT, ANIMATION.BASE_DELAY, ANIMATION.STAGGER_INCREMENT, POSITIONING.VALUE_MAX_WIDTH_VERTICAL)}
      </svg>
    `;
}

function renderCompactMediaStatsVariant(args: MediaStatsVariantArgs): string {
  const mainStatValueText = String(args.config.mainStat.value ?? 0);
  const mainStatValueFit = fitCircleText({
    fontWeight: 700,
    initialFontSize: TYPOGRAPHY.LARGE_TEXT_SIZE,
    maxWidth: COMPACT_MAIN_STAT_VALUE_MAX_WIDTH,
    text: mainStatValueText,
  });
  const mainStatFontSize = mainStatValueFit
    ? ` font-size="${mainStatValueFit.fontSize}"`
    : ` font-size="${TYPOGRAPHY.LARGE_TEXT_SIZE}"`;
  const stats = [
    { label: "Count:", value: args.data.stats.count },
    {
      label: `${args.config.mainStat.secondary.label}:`,
      value: args.config.mainStat.secondary.value,
    },
    { label: "Mean Score:", value: args.data.stats.meanScore },
  ];

  return `
      <g transform="translate(${args.dims.w - 50}, 20)">
        <text x="-10" y="15" class="main-stat" text-anchor="middle" fill="${args.resolvedColors.textColor}"${mainStatFontSize}>${escapeForXml(mainStatValueFit?.text ?? mainStatValueText)}</text>
        ${renderCircle(-10, 10, 30, args.resolvedColors.textColor, args.scaledDasharray, args.scaledDashoffset, 5)}
      </g>
      <svg x="0" y="0">
        ${renderStatsList(stats, "translate(0, 0)", 120, 22, 450, 120, POSITIONING.VALUE_MAX_WIDTH_COMPACT)}
      </svg>
    `;
}

function renderMinimalMediaStatsVariant(args: MediaStatsVariantArgs): string {
  const mainStatValueText = String(args.config.mainStat.value ?? 0);
  const mainStatLabelText = String(args.config.mainStat.label);
  const mainStatValueFit = fitCircleText({
    fontWeight: 700,
    initialFontSize: TYPOGRAPHY.LARGE_TEXT_SIZE,
    maxWidth: MINIMAL_MAIN_STAT_VALUE_MAX_WIDTH,
    text: mainStatValueText,
  });
  const mainStatLabelFit = fitCircleText({
    fontWeight: 600,
    initialFontSize: TYPOGRAPHY.SMALL_TEXT_SIZE,
    maxWidth: MINIMAL_MAIN_STAT_LABEL_MAX_WIDTH,
    text: mainStatLabelText,
  });
  const mainStatFontSize = mainStatValueFit
    ? ` font-size="${mainStatValueFit.fontSize}"`
    : ` font-size="${TYPOGRAPHY.LARGE_TEXT_SIZE}"`;
  const labelFontSize = mainStatLabelFit
    ? ` font-size="${mainStatLabelFit.fontSize}"`
    : ` font-size="${TYPOGRAPHY.SMALL_TEXT_SIZE}"`;

  return `
      <g transform="translate(${Math.round(args.dims.w / 2)}, 20)">
        <text x="0" y="5" class="main-stat" text-anchor="middle" fill="${args.resolvedColors.textColor}"${mainStatFontSize}>${escapeForXml(mainStatValueFit?.text ?? mainStatValueText)}</text>
        <text x="0" y="50" class="label" text-anchor="middle" fill="${args.resolvedColors.circleColor}"${labelFontSize}>${escapeForXml(mainStatLabelFit?.text ?? mainStatLabelText)}</text>
        ${renderCircle(0, 0, 28, args.resolvedColors.textColor, args.scaledDasharray, args.scaledDashoffset, 5)}
      </g>
    `;
}

function renderDefaultMediaStatsVariant(args: MediaStatsVariantArgs): string {
  const milestoneText = String(args.data.stats.currentMilestone);
  const mainStatValueText = String(args.config.mainStat.value ?? 0);
  const mainStatLabelText = String(args.config.mainStat.label);
  const milestoneFit = fitCircleText({
    fontWeight: 700,
    initialFontSize: TYPOGRAPHY.KPI_SIZE,
    maxWidth: DEFAULT_MILESTONE_MAX_WIDTH,
    text: milestoneText,
  });
  const mainStatValueFit = fitCircleText({
    fontWeight: 700,
    initialFontSize: TYPOGRAPHY.LARGE_TEXT_SIZE,
    maxWidth: POSITIONING.VALUE_MAX_WIDTH_DEFAULT,
    text: mainStatValueText,
  });
  const mainStatLabelFit = fitCircleText({
    fontWeight: 600,
    initialFontSize: TYPOGRAPHY.STAT_LABEL_SIZE,
    maxWidth: SHARED_MAIN_STAT_LABEL_MAX_WIDTH,
    text: mainStatLabelText,
  });
  const stats = buildStandardMediaStatsRows(args);

  return `
      <g transform="translate(375, 37.5)">
        <text x="-10" y="-50" class="milestone" text-anchor="middle" fill="${args.resolvedColors.circleColor}"${milestoneFit ? ` font-size="${milestoneFit.fontSize}"` : ""}>
          ${escapeForXml(milestoneFit?.text ?? milestoneText)}
        </text>
        <text x="-10" y="10" class="main-stat" text-anchor="middle" fill="${args.resolvedColors.textColor}"${mainStatValueFit ? ` font-size="${mainStatValueFit.fontSize}"` : ""}>
          ${escapeForXml(mainStatValueFit?.text ?? mainStatValueText)}
        </text>
        <text x="-10" y="70" class="label" text-anchor="middle" fill="${args.resolvedColors.circleColor}"${mainStatLabelFit ? ` font-size="${mainStatLabelFit.fontSize}"` : ""}>
          ${escapeForXml(mainStatLabelFit?.text ?? mainStatLabelText)}
        </text>
        ${renderCircle(-10, 8, 40, args.resolvedColors.textColor, args.scaledDasharray, args.scaledDashoffset)}
      </g>
      <svg x="0" y="0">
        ${renderStatsList(stats, "translate(0, 0)", POSITIONING.STAT_VALUE_X_DEFAULT, SPACING.ROW_HEIGHT_COMPACT, ANIMATION.BASE_DELAY, ANIMATION.STAGGER_INCREMENT, POSITIONING.VALUE_MAX_WIDTH_DEFAULT)}
      </svg>
    `;
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
  data: MediaStatsVariantTemplateData,
  config: MediaStatsVariantConfig,
  dims: { w: number; h: number },
  scaledDasharray: string | null,
  scaledDashoffset: string | null,
  resolvedColors: Record<string, string>,
): string {
  const args = {
    config,
    data,
    dims,
    resolvedColors,
    scaledDasharray,
    scaledDashoffset,
  } satisfies MediaStatsVariantArgs;

  switch (data.variant) {
    case "vertical":
      return renderVerticalMediaStatsVariant(args);
    case "compact":
      return renderCompactMediaStatsVariant(args);
    case "minimal":
      return renderMinimalMediaStatsVariant(args);
    default:
      return renderDefaultMediaStatsVariant(args);
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

  // Dimensions per variant
  const dims = getCardDimensions("mediaStats", data.variant ?? "default");

  const titleText = String(config.title);
  const titleMaxWidth =
    data.variant === "default"
      ? Math.max(MIN_DEFAULT_TITLE_WIDTH, dims.w - DEFAULT_TITLE_RIGHT_MARGIN)
      : dims.w - SPACING.CARD_PADDING * 2;
  const titleFit = resolveSvgTitleTextFit({
    maxWidth: titleMaxWidth,
    text: titleText,
  });
  const titleLengthAdjustAttrs = buildSvgTextLengthAdjustAttributes(titleFit, {
    initialFontSize: TYPOGRAPHY.HEADER_SIZE,
    maxWidth: titleMaxWidth,
  });
  const safeTitle = escapeForXml(titleText);
  const safeVisibleTitle = escapeForXml(titleFit.text);
  const safeMainStatLabel = escapeForXml(String(config.mainStat.label));
  const safeSecondaryStatLabel = escapeForXml(
    String(config.mainStat.secondary.label),
  );

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
  const animationsEnabled =
    (data.styles as { animate?: boolean }).animate !== false;
  const rankCircleStyle = generateRankCircleStyles(
    resolvedColors.circleColor,
    scaledDasharray,
    scaledDashoffset,
    { includeAnimations: animationsEnabled },
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
    ${generateCommonStyles(resolvedColors, titleFit.fontSize, { includeAnimations: animationsEnabled })}
    ${rankCircleStyle}
  </style>
  ${generateCardBackground(dims, cardRadius, resolvedColors)}
  <g data-testid="card-title" transform="translate(25, 35)">
    <g transform="translate(0, 0)">
      <text x="0" y="0" class="header" data-testid="header"${titleLengthAdjustAttrs}>${safeVisibleTitle}</text>
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
