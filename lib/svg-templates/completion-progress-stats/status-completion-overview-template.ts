import { z } from "zod";

import {
  buildSvgTextLengthAdjustAttributes,
  resolveSvgTitleTextFit,
} from "@/lib/pretext/runtime";
import { SPACING, TYPOGRAPHY } from "@/lib/svg-templates/common/constants";
import type { ColorValue } from "@/lib/types/card";
import type { TrustedSVG } from "@/lib/types/svg";
import {
  escapeForXml,
  getCardBorderRadius,
  markTrustedSvg,
  processColorsForSVG,
} from "@/lib/utils";

import {
  calculateCompletionRatio,
  generateStackedBar,
  generateStatusLegend,
  getDimensions,
  normalizeStatusCounts,
} from "./shared";

/** Status completion input structure. @source */
interface StatusCompletionInput {
  username: string;
  variant?: "combined" | "split";
  styles: {
    titleColor: ColorValue;
    backgroundColor: ColorValue;
    textColor: ColorValue;
    circleColor: ColorValue;
    borderColor?: ColorValue;
    borderRadius?: number;
  };
  animeStatuses: { status: string; count: number }[];
  mangaStatuses: { status: string; count: number }[];
}

const HORIZONTAL_TITLE_MARGIN = 2 * SPACING.CARD_PADDING; // Use the shared card padding on both sides of the centered title.
const TITLE_INITIAL_FONT_SIZE = TYPOGRAPHY.HEADER_SIZE; // Match the shared header typography before fitting.
const USERNAME_SCHEMA = z.string().trim().min(1);

/**
 * Renders the Status Completion Overview card showing cross-media completion stats.
 * @source
 */
export function statusCompletionOverviewTemplate(
  input: StatusCompletionInput,
): TrustedSVG {
  const { username, styles, variant = "combined" } = input;
  const parsedUsername = USERNAME_SCHEMA.safeParse(username);
  const safeUsername = parsedUsername.success ? parsedUsername.data : "User";
  const animeStatuses = normalizeStatusCounts(input.animeStatuses ?? []);
  const mangaStatuses = normalizeStatusCounts(input.mangaStatuses ?? []);

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
  const dims = getDimensions("statusCompletionOverview", variant);
  const safeDims =
    Number.isFinite(dims.w) &&
    dims.w > 0 &&
    Number.isFinite(dims.h) &&
    dims.h > 0
      ? dims
      : { w: 400, h: 240 };
  const title = `${safeUsername}'s Completion Overview`;
  const safeTitle = escapeForXml(title);
  const titleMaxWidth = safeDims.w - HORIZONTAL_TITLE_MARGIN;
  const titleFit = resolveSvgTitleTextFit({
    initialFontSize: TITLE_INITIAL_FONT_SIZE,
    maxWidth: titleMaxWidth,
    text: title,
  });
  const hasValidTitleFit =
    Number.isFinite(titleFit.fontSize) && titleFit.fontSize > 0;
  const titleFontSize = hasValidTitleFit
    ? titleFit.fontSize
    : TITLE_INITIAL_FONT_SIZE;
  const titleLengthAdjustAttrs = hasValidTitleFit
    ? buildSvgTextLengthAdjustAttributes(titleFit, {
        initialFontSize: TITLE_INITIAL_FONT_SIZE,
        maxWidth: titleMaxWidth,
      })
    : "";
  const safeVisibleTitle = escapeForXml(titleFit.text || title);

  const animeRatio = calculateCompletionRatio(animeStatuses);
  const mangaRatio = calculateCompletionRatio(mangaStatuses);

  const animeLabel = `Anime (${animeRatio.percentage}% completed)`;
  const mangaLabel = `Manga (${mangaRatio.percentage}% completed)`;

  let content: string;

  if (variant === "split") {
    content = `
      <g transform="translate(${SPACING.CARD_PADDING}, 65)">
        ${generateStackedBar(animeStatuses, {
          x: 0,
          y: 0,
          width: safeDims.w - 50,
          height: 20,
          label: animeLabel,
          textColor: resolvedColors.textColor,
          trackColor: resolvedColors.circleColor,
        })}
        ${generateStatusLegend(animeStatuses, 0, 34, resolvedColors.textColor)}
        ${generateStackedBar(mangaStatuses, {
          x: 0,
          y: 80,
          width: safeDims.w - 50,
          height: 20,
          label: mangaLabel,
          textColor: resolvedColors.textColor,
          trackColor: resolvedColors.circleColor,
        })}
        ${generateStatusLegend(mangaStatuses, 0, 114, resolvedColors.textColor)}
      </g>
    `;
  } else {
    // Combined variant - merge anime and manga statuses
    const combinedStatuses = normalizeStatusCounts([
      ...animeStatuses,
      ...mangaStatuses,
    ]);
    const combinedRatio = calculateCompletionRatio(combinedStatuses);
    const combinedLabel = `All Media (${combinedRatio.percentage}% completed)`;

    content = `
      <g transform="translate(${SPACING.CARD_PADDING}, 65)">
        ${generateStackedBar(combinedStatuses, {
          x: 0,
          y: 0,
          width: safeDims.w - 50,
          height: 24,
          label: combinedLabel,
          textColor: resolvedColors.textColor,
          trackColor: resolvedColors.circleColor,
        })}
        ${generateStatusLegend(combinedStatuses, 0, 40, resolvedColors.textColor)}
      </g>
    `;
  }

  return markTrustedSvg(`
    <svg xmlns="http://www.w3.org/2000/svg" width="${safeDims.w}" height="${safeDims.h}" viewBox="0 0 ${safeDims.w} ${safeDims.h}" fill="none" role="img" aria-labelledby="title-id">
      ${gradientDefs ? `<defs>${gradientDefs}</defs>` : ""}
      <title id="title-id">${safeTitle}</title>
      <style>
        .header { fill: ${resolvedColors.titleColor}; font: 600 ${titleFontSize}px 'Segoe UI', Ubuntu, Sans-Serif; }
        .bar-label { font: 500 ${TYPOGRAPHY.STAT_LABEL_SIZE}px 'Segoe UI', Ubuntu, Sans-Serif; }
        .legend-text { font: 400 ${TYPOGRAPHY.SECTION_TITLE_SIZE}px 'Segoe UI', Ubuntu, Sans-Serif; }
        .stagger { opacity: 0; animation: fadeIn 0.5s ease forwards; }
        @keyframes fadeIn { to { opacity: 1; } }
      </style>
      <rect x="0.5" y="0.5" width="${safeDims.w - 1}" height="${safeDims.h - 1}" rx="${cardRadius}" fill="${resolvedColors.backgroundColor}" ${resolvedColors.borderColor ? `stroke="${resolvedColors.borderColor}"` : ""} stroke-width="2"/>
      <g transform="translate(20, 35)">
        <text class="header"${titleLengthAdjustAttrs}>${safeVisibleTitle}</text>
      </g>
      ${content}
    </svg>
  `);
}
