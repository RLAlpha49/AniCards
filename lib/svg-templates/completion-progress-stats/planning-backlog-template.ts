import {
  buildSvgTextLengthAdjustAttributes,
  fitSvgSingleLineText,
  resolveSvgTitleTextFit,
} from "@/lib/pretext/runtime";
import {
  ANIMATION,
  SPACING,
  TYPOGRAPHY,
} from "@/lib/svg-templates/common/constants";
import type { ColorValue } from "@/lib/types/card";
import type { MediaListEntry } from "@/lib/types/records";
import type { TrustedSVG } from "@/lib/types/svg";
import {
  escapeForXml,
  getCardBorderRadius,
  markTrustedSvg,
  processColorsForSVG,
} from "@/lib/utils";

import { getDimensions, getMediaTitle } from "./shared";

/** Planning backlog card input structure. @source */
interface PlanningBacklogInput {
  username: string;
  variant?: "default";
  styles: {
    titleColor: ColorValue;
    backgroundColor: ColorValue;
    textColor: ColorValue;
    circleColor: ColorValue;
    borderColor?: ColorValue;
    borderRadius?: number;
  };
  animePlanning: MediaListEntry[];
  mangaPlanning: MediaListEntry[];
  animeCount?: number;
  mangaCount?: number;
}

/**
 * Renders the Planning Backlog card showing planned titles.
 * @source
 */
export function planningBacklogTemplate(
  input: PlanningBacklogInput,
): TrustedSVG {
  const { username, styles, variant = "default" } = input;
  const animePlanning = input.animePlanning ?? [];
  const mangaPlanning = input.mangaPlanning ?? [];

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
  const dims = getDimensions("planningBacklog", variant);
  const title = `${username}'s Planning Backlog`;
  const safeTitle = escapeForXml(title);
  const titleMaxWidth = dims.w - 40;
  const titleFit = resolveSvgTitleTextFit({
    initialFontSize: TYPOGRAPHY.HEADER_SIZE,
    maxWidth: titleMaxWidth,
    text: title,
  });
  const titleLengthAdjustAttrs = buildSvgTextLengthAdjustAttributes(titleFit, {
    initialFontSize: TYPOGRAPHY.HEADER_SIZE,
    maxWidth: titleMaxWidth,
  });
  const safeVisibleTitle = escapeForXml(titleFit.text);

  const allPlanning = [...animePlanning, ...mangaPlanning];
  const animeCount = input.animeCount ?? animePlanning.length;
  const mangaCount = input.mangaCount ?? mangaPlanning.length;

  const displayEntries: MediaListEntry[] = [...allPlanning]
    .sort((a, b) => (b.media.averageScore ?? 0) - (a.media.averageScore ?? 0))
    .slice(0, 5);

  const statsLine = `📺 ${animeCount} anime | 📚 ${mangaCount} manga planned`;
  const statsLineFit = fitSvgSingleLineText({
    fontWeight: 400,
    initialFontSize: TYPOGRAPHY.STAT_LABEL_SIZE,
    maxWidth: dims.w - 50,
    minFontSize: 8,
    mode: "shrink-then-truncate",
    text: statsLine,
  });

  const entriesContent = displayEntries
    .map((entry, i) => {
      const mediaTitle = getMediaTitle(entry);
      const format = entry.media.format ?? "?";
      const score = entry.media.averageScore
        ? `${entry.media.averageScore}%`
        : "N/A";
      const entryTitleFit = fitSvgSingleLineText({
        fontWeight: 500,
        initialFontSize: TYPOGRAPHY.STAT_LABEL_SIZE,
        maxWidth: dims.w - SPACING.CARD_PADDING * 2,
        minFontSize: 8,
        mode: "shrink-then-truncate",
        text: mediaTitle,
      });
      const entryTitleFontSize =
        entryTitleFit?.fontSize ?? TYPOGRAPHY.STAT_LABEL_SIZE;
      return `
        <g transform="translate(${SPACING.CARD_PADDING}, ${85 + i * 32})" class="stagger" style="animation-delay:${ANIMATION.BASE_DELAY + i * ANIMATION.FAST_INCREMENT}ms">
          <text class="entry-title" fill="${resolvedColors.textColor}" font-size="${entryTitleFontSize}px">${escapeForXml(entryTitleFit?.text ?? mediaTitle ?? "")}</text>
          <text class="entry-meta" x="0" y="14" fill="${resolvedColors.circleColor}">${escapeForXml(format)} • Score: ${escapeForXml(score)}</text>
        </g>
      `;
    })
    .join("");

  return markTrustedSvg(`
    <svg xmlns="http://www.w3.org/2000/svg" width="${dims.w}" height="${dims.h}" viewBox="0 0 ${dims.w} ${dims.h}" fill="none" role="img" aria-labelledby="title-id">
      ${gradientDefs ? `<defs>${gradientDefs}</defs>` : ""}
      <title id="title-id">${safeTitle}</title>
      <style>
        /* Keep font-weight and font-family in these static classes; .header is the exception and uses the fitted title size in the font shorthand, while stats-line and entry-title stay on rendered elements. */
        .header { fill: ${resolvedColors.titleColor}; font: 600 ${titleFit.fontSize}px 'Segoe UI', Ubuntu, Sans-Serif; }
        .stats-line { font-weight: 400; font-family: 'Segoe UI', Ubuntu, Sans-Serif; }
        .entry-title { font-weight: 500; font-family: 'Segoe UI', Ubuntu, Sans-Serif; }
        .entry-meta { font: 400 ${TYPOGRAPHY.SMALL_TEXT_SIZE}px 'Segoe UI', Ubuntu, Sans-Serif; opacity: 0.8; }
        .stagger { opacity: 0; animation: fadeIn 0.5s ease forwards; }
        @keyframes fadeIn { to { opacity: 1; } }
      </style>
      <rect x="0.5" y="0.5" width="${dims.w - 1}" height="${dims.h - 1}" rx="${cardRadius}" fill="${resolvedColors.backgroundColor}" ${resolvedColors.borderColor ? `stroke="${resolvedColors.borderColor}"` : ""} stroke-width="2"/>
      <g transform="translate(20, 35)">
        <text class="header"${titleLengthAdjustAttrs}>${safeVisibleTitle}</text>
      </g>
      <g transform="translate(25, 58)">
        <text class="stats-line" fill="${resolvedColors.textColor}" font-size="${statsLineFit?.fontSize ?? TYPOGRAPHY.STAT_LABEL_SIZE}px">${escapeForXml(statsLineFit?.text ?? statsLine)}</text>
      </g>
      ${entriesContent}
    </svg>
  `);
}
