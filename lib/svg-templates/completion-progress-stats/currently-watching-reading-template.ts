import type { ColorValue } from "@/lib/types/card";
import type { MediaListEntry } from "@/lib/types/records";
import type { TrustedSVG } from "@/lib/types/svg";
import { isAllowedAniListImageUrl } from "@/lib/image-utils";
import {
  ANIMATION,
  SPACING,
  TYPOGRAPHY,
  calculateDynamicFontSize,
  estimateCardTextWidth,
  fitCardText,
} from "@/lib/svg-templates/common";
import { escapeForXml, markTrustedSvg } from "@/lib/svg-markup";
import { getCardBorderRadius } from "@/lib/card-style";
import { processColorsForSVG } from "@/lib/color/gradients";
import {
  fitStatusText,
  getDimensions,
  getMediaTitle,
  toSvgIdFragment,
} from "./completion-progress-stats";

/** Currently watching/reading card input structure. @source */
interface CurrentlyWatchingReadingInput {
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
  animeCurrent: MediaListEntry[];
  mangaCurrent: MediaListEntry[];
  animeCount?: number;
  mangaCount?: number;
}

type NowEntry = { entry: MediaListEntry; type: "anime" | "manga" };

function buildNowEntries(
  anime: MediaListEntry[],
  manga: MediaListEntry[],
  maxRows: number,
): NowEntry[] {
  const animeLimit = Math.min(3, anime.length);
  const mangaLimit = Math.min(3, manga.length);

  const baseAnime = anime.slice(0, animeLimit);
  const baseManga = manga.slice(0, mangaLimit);

  let remaining = maxRows - (baseAnime.length + baseManga.length);

  const animeExtra =
    remaining > 0
      ? Math.min(remaining, Math.max(0, anime.length - animeLimit))
      : 0;
  remaining -= animeExtra;

  const mangaExtra =
    remaining > 0
      ? Math.min(remaining, Math.max(0, manga.length - mangaLimit))
      : 0;

  const animeFinal = anime.slice(0, animeLimit + animeExtra);
  const mangaFinal = manga.slice(0, mangaLimit + mangaExtra);

  return [
    ...animeFinal.map((entry) => ({ entry, type: "anime" as const })),
    ...mangaFinal.map((entry) => ({ entry, type: "manga" as const })),
  ];
}

function getProgressMeta(entry: MediaListEntry, type: "anime" | "manga") {
  const progress = Math.max(0, Math.trunc(entry.progress ?? 0));
  const total =
    type === "anime"
      ? Math.trunc(entry.media.episodes ?? 0)
      : Math.trunc(entry.media.chapters ?? 0);

  const unit = type === "anime" ? "ep" : "ch";
  if (total > 0) {
    const pct = Math.max(0, Math.min(1, progress / total));
    return {
      label: `${progress}/${total} ${unit}`,
      ratio: pct,
    };
  }

  return {
    label: `${progress} ${unit}`,
    ratio: null as number | null,
  };
}

function getCoverDataUrl(entry: MediaListEntry): string | null {
  const url = entry.media.coverImage?.large || entry.media.coverImage?.medium;
  if (!url) return null;
  if (url.startsWith("data:")) return url;

  if (isAllowedAniListImageUrl(url)) return url;
  return null;
}

function getStatsLine(
  variant: "default" | "anime" | "manga",
  animeCount: number,
  mangaCount: number,
): string {
  if (variant === "anime") return `${animeCount} watching`;
  if (variant === "manga") return `${mangaCount} reading`;
  return `${animeCount} watching  ·  ${mangaCount} reading`;
}

/**
 * Renders the Currently Watching / Reading card showing current anime and manga
 * progress with cover thumbnails.
 * @source
 */
export function currentlyWatchingReadingTemplate(
  input: CurrentlyWatchingReadingInput,
): TrustedSVG {
  const { username, styles, variant = "default" } = input;
  const animeCurrent = input.animeCurrent ?? [];
  const mangaCurrent = input.mangaCurrent ?? [];

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
  const dims = getDimensions("currentlyWatchingReading", variant);

  let titleSuffix = "Currently Watching / Reading";
  if (variant === "anime") titleSuffix = "Currently Watching";
  if (variant === "manga") titleSuffix = "Currently Reading";
  const title = `${username}'s ${titleSuffix}`;
  const safeTitle = escapeForXml(title);
  const headerFontSize = calculateDynamicFontSize(title, 18, dims.w - 40);

  const animeCount = input.animeCount ?? animeCurrent.length;
  const mangaCount = input.mangaCount ?? mangaCurrent.length;
  const statsLine = getStatsLine(variant, animeCount, mangaCount);

  const rows = buildNowEntries(animeCurrent, mangaCurrent, 6);

  const COVER_W = 26;
  const COVER_H = 36;
  const ROW_H = 46;

  const contentW = dims.w - SPACING.CARD_PADDING * 2;
  const textX = COVER_W + 12;
  const barX = textX;
  const barW = contentW - textX;
  const barH = 6;

  const startY = 86;
  const svgHeight = Math.max(
    180,
    rows.length === 0 ? dims.h : startY + (rows.length - 1) * ROW_H + 36,
  );

  const coverClips = rows
    .map(({ entry }, i) => {
      const id = `cover-${toSvgIdFragment(String(entry.media.id || entry.id))}-${i}`;
      return `<clipPath id="${id}" clipPathUnits="userSpaceOnUse"><rect x="0" y="-18" width="${COVER_W}" height="${COVER_H}" rx="5"/></clipPath>`;
    })
    .join("");

  const entriesContent = rows
    .map(({ entry, type }, i) => {
      const mediaTitle = getMediaTitle(entry);
      const { label, ratio } = getProgressMeta(entry, type);
      const progressLabel = `${type === "anime" ? "Anime" : "Manga"} · ${label}`;
      // Reserve only the width this row's meta text actually needs. A fixed
      // 115px reservation left ~40px unused on every row and truncated the
      // title well before the row ran out of room.
      const metaWidth = estimateCardTextWidth(
        progressLabel,
        TYPOGRAPHY.SMALL_TEXT_SIZE,
        400,
      );
      const titleWidth = contentW - textX - metaWidth - 10;
      // Fit to the measured width instead of a fixed character count: a char
      // cap truncates long titles while the row still has room to spare.
      const clippedTitle = fitCardText(
        mediaTitle,
        titleWidth,
        TYPOGRAPHY.STAT_LABEL_SIZE,
        600,
      );

      const coverColor =
        entry.media.coverImage?.color || String(resolvedColors.circleColor);
      const coverDataUrl = getCoverDataUrl(entry);
      const clipId = `cover-${toSvgIdFragment(String(entry.media.id || entry.id))}-${i}`;

      const rowY = startY + i * ROW_H;

      const track = `<rect x="${barX}" y="10" width="${barW}" height="${barH}" rx="${barH / 2}" fill="${resolvedColors.textColor}" opacity="0.16"/>`;
      const fill =
        typeof ratio === "number"
          ? `<rect x="${barX}" y="10" width="${Math.max(0, Math.min(barW, barW * ratio))}" height="${barH}" rx="${barH / 2}" fill="${resolvedColors.circleColor}"/>`
          : "";

      const coverRect = `<rect x="0" y="-18" width="${COVER_W}" height="${COVER_H}" rx="5" fill="${escapeForXml(coverColor)}" opacity="0.9"/>`;
      let coverImage = "";
      if (coverDataUrl) {
        const escaped = escapeForXml(coverDataUrl);
        coverImage = `<image x="0" y="-18" width="${COVER_W}" height="${COVER_H}" href="${escaped}" xlink:href="${escaped}" preserveAspectRatio="xMidYMid slice" clip-path="url(#${clipId})"/>`;
      }

      return `
        <g transform="translate(${SPACING.CARD_PADDING}, ${rowY})" class="stagger" style="animation-delay:${ANIMATION.BASE_DELAY + i * ANIMATION.FAST_INCREMENT}ms">
          ${coverRect}
          ${coverImage}
          <text class="entry-title" x="${textX}" y="0" fill="${resolvedColors.textColor}" ${fitStatusText(clippedTitle, titleWidth, TYPOGRAPHY.STAT_LABEL_SIZE)}>${escapeForXml(clippedTitle)}</text>
          <text class="entry-meta" x="${contentW}" y="0" text-anchor="end" fill="${resolvedColors.circleColor}" ${fitStatusText(progressLabel, metaWidth, TYPOGRAPHY.SMALL_TEXT_SIZE)}>${escapeForXml(progressLabel)}</text>
          ${track}
          ${fill}
        </g>
      `;
    })
    .join("");

  const noDataMessage =
    rows.length === 0
      ? `<text x="${dims.w / 2}" y="${svgHeight / 2}" text-anchor="middle" fill="${resolvedColors.textColor}" class="stats-line">No currently watching/reading entries found</text>`
      : "";

  return markTrustedSvg(`
    <svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${dims.w}" height="${svgHeight}" viewBox="0 0 ${dims.w} ${svgHeight}" fill="none" role="img" aria-labelledby="title-id">
      <defs>
        ${gradientDefs ?? ""}
        ${coverClips}
      </defs>
      <title id="title-id">${safeTitle}</title>
      <style>
        .header { fill: ${resolvedColors.titleColor}; font: 600 ${headerFontSize}px 'Segoe UI', Ubuntu, Sans-Serif; }
        .stats-line { font: 400 ${TYPOGRAPHY.STAT_LABEL_SIZE}px 'Segoe UI', Ubuntu, Sans-Serif; }
        .entry-title { font: 500 ${TYPOGRAPHY.STAT_LABEL_SIZE}px 'Segoe UI', Ubuntu, Sans-Serif; }
        .entry-meta { font: 600 ${TYPOGRAPHY.SMALL_TEXT_SIZE}px 'Segoe UI', Ubuntu, Sans-Serif; opacity: 0.95; }
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
