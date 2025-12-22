import type { ColorValue } from "@/lib/types/card";
import type { MediaListEntry } from "@/lib/types/records";
import type { TrustedSVG } from "@/lib/types/svg";
import {
  calculateDynamicFontSize,
  escapeForXml,
  getCardBorderRadius,
  markTrustedSvg,
  processColorsForSVG,
} from "@/lib/utils";
import {
  ANIMATION,
  SPACING,
  TYPOGRAPHY,
} from "@/lib/svg-templates/common/constants";
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
  const headerFontSize = calculateDynamicFontSize(title, 18, dims.w - 40);

  const allPlanning = [...animePlanning, ...mangaPlanning];
  const animeCount = input.animeCount ?? animePlanning.length;
  const mangaCount = input.mangaCount ?? mangaPlanning.length;

  const displayEntries: MediaListEntry[] = [...allPlanning]
    .sort((a, b) => (b.media.averageScore ?? 0) - (a.media.averageScore ?? 0))
    .slice(0, 5);

  const statsLine = `📺 ${animeCount} anime | 📚 ${mangaCount} manga planned`;

  const entriesContent = displayEntries
    .map((entry, i) => {
      const mediaTitle = getMediaTitle(entry);
      const format = entry.media.format ?? "?";
      const score = entry.media.averageScore
        ? `${entry.media.averageScore}%`
        : "N/A";
      return `
        <g transform="translate(${SPACING.CARD_PADDING}, ${85 + i * 32})" class="stagger" style="animation-delay:${ANIMATION.BASE_DELAY + i * ANIMATION.FAST_INCREMENT}ms">
          <text class="entry-title" fill="${resolvedColors.textColor}">${escapeForXml(mediaTitle.slice(0, 50))}${mediaTitle.length > 50 ? "..." : ""}</text>
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
        .header { fill: ${resolvedColors.titleColor}; font: 600 ${headerFontSize}px 'Segoe UI', Ubuntu, Sans-Serif; }
        .stats-line { font: 400 ${TYPOGRAPHY.STAT_LABEL_SIZE}px 'Segoe UI', Ubuntu, Sans-Serif; }
        .entry-title { font: 500 ${TYPOGRAPHY.STAT_LABEL_SIZE}px 'Segoe UI', Ubuntu, Sans-Serif; }
        .entry-meta { font: 400 ${TYPOGRAPHY.SMALL_TEXT_SIZE}px 'Segoe UI', Ubuntu, Sans-Serif; opacity: 0.8; }
        .stagger { opacity: 0; animation: fadeIn 0.5s ease forwards; }
        @keyframes fadeIn { to { opacity: 1; } }
      </style>
      <rect x="0.5" y="0.5" width="${dims.w - 1}" height="${dims.h - 1}" rx="${cardRadius}" fill="${resolvedColors.backgroundColor}" ${resolvedColors.borderColor ? `stroke="${resolvedColors.borderColor}"` : ""} stroke-width="2"/>
      <g transform="translate(20, 35)">
        <text class="header">${safeTitle}</text>
      </g>
      <g transform="translate(25, 58)">
        <text class="stats-line" fill="${resolvedColors.textColor}">${escapeForXml(statsLine)}</text>
      </g>
      ${entriesContent}
    </svg>
  `);
}
