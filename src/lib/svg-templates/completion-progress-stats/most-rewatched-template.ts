import type { ColorValue } from "@/lib/types/card";
import type { MediaListEntry } from "@/lib/types/records";
import type { TrustedSVG } from "@/lib/types/svg";
import {
  ANIMATION,
  SPACING,
  TYPOGRAPHY,
  calculateDynamicFontSize,
  estimateCardTextWidth,
  fitCardText,
} from "@/lib/svg-templates/common";
import { escapeForXml, markTrustedSvg } from "@/lib/svg-markup";
import { getCardBorderRadius } from "@/lib/cards/style";
import { processColorsForSVG } from "@/lib/color/gradients";
import {
  fitStatusText,
  getDimensions,
  getMediaTitle,
  dedupeByMediaIdKeepHighestRepeat,
} from "./completion-progress-stats";

/** Most rewatched card input structure. @source */
interface MostRewatchedInput {
  username: string;
  variant?: "default" | "anime" | "manga";
  styles: {
    titleColor: ColorValue;
    backgroundColor: ColorValue;
    textColor: ColorValue;
    circleColor: ColorValue;
    borderColor?: ColorValue;
    borderRadius?: number;
  };
  animeRewatched: MediaListEntry[];
  mangaReread: MediaListEntry[];
  totalRewatches?: number;
  totalRereads?: number;
}

/**
 * Renders the Most Rewatched/Reread card showing titles the user revisits.
 * @source
 */
export function mostRewatchedTemplate(input: MostRewatchedInput): TrustedSVG {
  const { username, styles, variant = "default" } = input;

  const animeRewatched = dedupeByMediaIdKeepHighestRepeat(
    input.animeRewatched?.filter((e) => (e.repeat ?? 0) > 0) ?? [],
  );
  const mangaReread = dedupeByMediaIdKeepHighestRepeat(
    input.mangaReread?.filter((e) => (e.repeat ?? 0) > 0) ?? [],
  );

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
  const dims = getDimensions("mostRewatched", variant);

  let title: string;
  let displayEntries: { entry: MediaListEntry; type: "anime" | "manga" }[];

  if (variant === "anime") {
    title = `${username}'s Most Rewatched Anime`;
    displayEntries = animeRewatched
      .toSorted((a, b) => (b.repeat ?? 0) - (a.repeat ?? 0))
      .slice(0, 5)
      .map((e) => ({ entry: e, type: "anime" as const }));
  } else if (variant === "manga") {
    title = `${username}'s Most Reread Manga`;
    displayEntries = mangaReread
      .toSorted((a, b) => (b.repeat ?? 0) - (a.repeat ?? 0))
      .slice(0, 5)
      .map((e) => ({ entry: e, type: "manga" as const }));
  } else {
    title = `${username}'s Most Revisited`;
    const combined = [
      ...animeRewatched.map((e) => ({ entry: e, type: "anime" as const })),
      ...mangaReread.map((e) => ({ entry: e, type: "manga" as const })),
    ];
    displayEntries = combined
      .toSorted((a, b) => (b.entry.repeat ?? 0) - (a.entry.repeat ?? 0))
      .slice(0, 5);
  }

  const safeTitle = escapeForXml(title);
  const headerFontSize = calculateDynamicFontSize(title, 18, dims.w - 40);

  // Reduce empty space when there are fewer than 5 entries by shrinking the SVG
  // height to fit the rendered rows. Keep a sensible minimum so the card still
  // looks intentional.
  const svgHeight = Math.max(
    150,
    displayEntries.length === 0
      ? dims.h
      : 85 + Math.max(0, displayEntries.length - 1) * 28 + 23,
  );

  const totalRewatches =
    input.totalRewatches ??
    animeRewatched.reduce((sum, e) => sum + (e.repeat ?? 0), 0);
  const totalRereads =
    input.totalRereads ??
    mangaReread.reduce((sum, e) => sum + (e.repeat ?? 0), 0);
  const statsLine = `${totalRewatches} rewatches  ·  ${totalRereads} rereads`;

  const entriesContent = displayEntries
    .map(({ entry, type }, i) => {
      const mediaTitle = getMediaTitle(entry);
      const repeatCount = entry.repeat ?? 0;
      const count = `${repeatCount}x`;
      // The title starts after the type label and must stop short of the
      // count text, which is end-anchored at `dims.w - 45`. Derive the limit
      // from those two anchors instead of a fixed 140px reservation, which
      // cut titles ~30px earlier than the row required.
      const titleX = 48;
      const countRightEdge = dims.w - 45;
      const countWidth =
        estimateCardTextWidth(count, TYPOGRAPHY.STAT_LABEL_SIZE, 600) + 12;
      const titleWidth = countRightEdge - countWidth - titleX;
      // Fit to the measured width instead of a fixed character count: a char
      // cap truncates long titles while the row still has room to spare.
      const clippedTitle = fitCardText(
        mediaTitle,
        titleWidth,
        TYPOGRAPHY.STAT_LABEL_SIZE,
        400,
      );
      return `
        <g transform="translate(${SPACING.CARD_PADDING}, ${85 + i * 28})" class="stagger" style="animation-delay:${ANIMATION.BASE_DELAY + i * ANIMATION.FAST_INCREMENT}ms">
          <text class="entry-type" fill="${resolvedColors.circleColor}">${type === "anime" ? "ANIME" : "MANGA"}</text>
          <text class="entry-title" x="${titleX}" fill="${resolvedColors.textColor}" ${fitStatusText(clippedTitle, titleWidth, TYPOGRAPHY.STAT_LABEL_SIZE)}>${escapeForXml(clippedTitle)}</text>
          <text class="entry-count" x="${dims.w - 45}" fill="${resolvedColors.circleColor}" text-anchor="end" ${fitStatusText(count, 40, TYPOGRAPHY.STAT_LABEL_SIZE)}>${escapeForXml(count)}</text>
          ${i < displayEntries.length - 1 ? `<path d="M0 13 H${dims.w - 50}" stroke="${resolvedColors.textColor}" opacity="0.12"/>` : ""}
        </g>
      `;
    })
    .join("");

  const noDataMessage =
    displayEntries.length === 0
      ? `<text x="${dims.w / 2}" y="${svgHeight / 2}" text-anchor="middle" fill="${resolvedColors.textColor}" class="stats-line">No rewatched or reread titles found</text>`
      : "";

  return markTrustedSvg(`
    <svg xmlns="http://www.w3.org/2000/svg" width="${dims.w}" height="${svgHeight}" viewBox="0 0 ${dims.w} ${svgHeight}" fill="none" role="img" aria-labelledby="title-id">
      ${gradientDefs ? `<defs>${gradientDefs}</defs>` : ""}
      <title id="title-id">${safeTitle}</title>
      <style>
        .header { fill: ${resolvedColors.titleColor}; font: 600 ${headerFontSize}px 'Segoe UI', Ubuntu, Sans-Serif; }
        .stats-line { font: 400 ${TYPOGRAPHY.STAT_LABEL_SIZE}px 'Segoe UI', Ubuntu, Sans-Serif; }
        .entry-type { font: 700 9px 'Segoe UI', Ubuntu, Sans-Serif; letter-spacing: 0.3px; }
        .entry-title { font: 500 ${TYPOGRAPHY.STAT_LABEL_SIZE}px 'Segoe UI', Ubuntu, Sans-Serif; }
        .entry-count { font: 600 ${TYPOGRAPHY.STAT_LABEL_SIZE}px 'Segoe UI', Ubuntu, Sans-Serif; }
        .stagger { opacity: 0; animation: fadeIn 0.5s ease forwards; }
        @keyframes fadeIn { to { opacity: 1; } }
      </style>
      <rect x="0.5" y="0.5" width="${dims.w - 1}" height="${svgHeight - 1}" rx="${cardRadius}" fill="${resolvedColors.backgroundColor}" ${resolvedColors.borderColor ? `stroke="${resolvedColors.borderColor}"` : ""} stroke-width="2"/>
      <g transform="translate(20, 35)">
        <text class="header" ${fitStatusText(title, dims.w - 40, Number(headerFontSize))}>${safeTitle}</text>
      </g>
      <g transform="translate(25, 58)">
        <text class="stats-line" fill="${resolvedColors.textColor}" ${fitStatusText(statsLine, dims.w - 50, TYPOGRAPHY.STAT_LABEL_SIZE)}>${escapeForXml(statsLine)}</text>
      </g>
      ${entriesContent}
      ${noDataMessage}
    </svg>
  `);
}
