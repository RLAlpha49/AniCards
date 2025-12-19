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

  const dedupeByMediaIdKeepHighestRepeat = (
    entries: MediaListEntry[],
  ): MediaListEntry[] => {
    const byId = new Map<number, MediaListEntry>();
    for (const entry of entries) {
      const mediaId = entry.media?.id;
      if (!mediaId) continue;

      const existing = byId.get(mediaId);
      if (!existing) {
        byId.set(mediaId, entry);
        continue;
      }

      const existingRepeat = existing.repeat ?? 0;
      const nextRepeat = entry.repeat ?? 0;
      if (nextRepeat > existingRepeat) byId.set(mediaId, entry);
    }
    return [...byId.values()];
  };

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
  const statsLine = `🔄 ${totalRewatches} rewatches | 📖 ${totalRereads} rereads`;

  const entriesContent = displayEntries
    .map(({ entry, type }, i) => {
      const mediaTitle = getMediaTitle(entry);
      const repeatCount = entry.repeat ?? 0;
      const icon = type === "anime" ? "📺" : "📚";
      return `
        <g transform="translate(${SPACING.CARD_PADDING}, ${85 + i * 28})" class="stagger" style="animation-delay:${ANIMATION.BASE_DELAY + i * ANIMATION.FAST_INCREMENT}ms">
          <text class="entry-icon" fill="${resolvedColors.textColor}">${escapeForXml(icon)}</text>
          <text class="entry-title" x="22" fill="${resolvedColors.textColor}">${escapeForXml(mediaTitle.slice(0, 32))}${mediaTitle.length > 32 ? "..." : ""}</text>
          <text class="entry-count" x="${dims.w - 45}" fill="${resolvedColors.circleColor}" text-anchor="end">${escapeForXml(repeatCount)}x</text>
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
        .entry-icon { font-size: ${TYPOGRAPHY.STAT_VALUE_SIZE}px; }
        .entry-title { font: 500 ${TYPOGRAPHY.STAT_LABEL_SIZE}px 'Segoe UI', Ubuntu, Sans-Serif; }
        .entry-count { font: 600 ${TYPOGRAPHY.STAT_LABEL_SIZE}px 'Segoe UI', Ubuntu, Sans-Serif; }
        .stagger { opacity: 0; animation: fadeIn 0.5s ease forwards; }
        @keyframes fadeIn { to { opacity: 1; } }
      </style>
      <rect x="0.5" y="0.5" width="${dims.w - 1}" height="${svgHeight - 1}" rx="${cardRadius}" fill="${resolvedColors.backgroundColor}" ${resolvedColors.borderColor ? `stroke="${resolvedColors.borderColor}"` : ""} stroke-width="2"/>
      <g transform="translate(20, 35)">
        <text class="header">${safeTitle}</text>
      </g>
      <g transform="translate(25, 58)">
        <text class="stats-line" fill="${resolvedColors.textColor}">${escapeForXml(statsLine)}</text>
      </g>
      ${entriesContent}
      ${noDataMessage}
    </svg>
  `);
}
