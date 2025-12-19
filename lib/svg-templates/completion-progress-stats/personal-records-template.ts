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
import { getDimensions, getMediaTitle, truncateWithEllipsis } from "./shared";

/** Personal records card input structure. @source */
interface PersonalRecordsInput {
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
  animeCompleted: MediaListEntry[];
  mangaCompleted: MediaListEntry[];
  animeRewatched: MediaListEntry[];
  mangaReread: MediaListEntry[];
}

/**
 * Renders the Personal Records card showing user's personal bests.
 * @source
 */
export function personalRecordsTemplate(
  input: PersonalRecordsInput,
): TrustedSVG {
  const { username, styles, variant = "default" } = input;
  const animeCompleted = input.animeCompleted ?? [];
  const mangaCompleted = input.mangaCompleted ?? [];
  const animeRewatched =
    input.animeRewatched?.filter((e) => e.repeat && e.repeat > 0) ?? [];
  const mangaReread =
    input.mangaReread?.filter((e) => e.repeat && e.repeat > 0) ?? [];

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
  const dims = getDimensions("personalRecords", variant);
  const title = `${username}'s Personal Records`;
  const safeTitle = escapeForXml(title);
  const headerFontSize = calculateDynamicFontSize(title, 18, dims.w - 40);

  // Find records
  const longestAnime = [...animeCompleted].sort(
    (a, b) => (b.media.episodes ?? 0) - (a.media.episodes ?? 0),
  )[0];
  const longestManga = [...mangaCompleted].sort(
    (a, b) => (b.media.chapters ?? 0) - (a.media.chapters ?? 0),
  )[0];
  const topRatedAnime = [...animeCompleted].sort(
    (a, b) => (b.score ?? 0) - (a.score ?? 0),
  )[0];
  const topRatedManga = [...mangaCompleted].sort(
    (a, b) => (b.score ?? 0) - (a.score ?? 0),
  )[0];
  const mostRewatched = [...animeRewatched].sort(
    (a, b) => (b.repeat ?? 0) - (a.repeat ?? 0),
  )[0];
  const mostReread = [...mangaReread].sort(
    (a, b) => (b.repeat ?? 0) - (a.repeat ?? 0),
  )[0];

  const maxTitleChars = 42;

  const formatMediaValue = (
    entry: MediaListEntry | undefined,
    suffix: string,
  ): { value: string; missing: boolean } => {
    if (!entry) return { value: "—", missing: true };
    const titleText = getMediaTitle(entry);
    const clipped = truncateWithEllipsis(titleText, maxTitleChars);
    return { value: `${escapeForXml(clipped)} ${suffix}`, missing: false };
  };

  const formatScoreValue = (
    entry: MediaListEntry | undefined,
  ): { value: string; missing: boolean } => {
    const score = entry?.score ?? 0;
    if (!entry || score <= 0) return { value: "—", missing: true };
    const titleText = getMediaTitle(entry);
    const clipped = truncateWithEllipsis(titleText, maxTitleChars);
    return {
      value: `${escapeForXml(clipped)} (${escapeForXml(score)}/10)`,
      missing: false,
    };
  };

  const longestAnimeRow = longestAnime?.media.episodes
    ? {
        label: "Longest Anime",
        ...formatMediaValue(
          longestAnime,
          `(${longestAnime.media.episodes} ep)`,
        ),
      }
    : { label: "Longest Anime", value: "—", missing: true };

  const longestMangaRow = (() => {
    if (longestManga?.media.chapters) {
      return {
        label: "Longest Manga",
        ...formatMediaValue(
          longestManga,
          `(${longestManga.media.chapters} ch)`,
        ),
      };
    }
    if (longestManga?.media.volumes) {
      return {
        label: "Longest Manga",
        ...formatMediaValue(
          longestManga,
          `(${longestManga.media.volumes} vol)`,
        ),
      };
    }
    return { label: "Longest Manga", value: "—", missing: true };
  })();

  const mostRewatchedRow =
    mostRewatched?.repeat && mostRewatched.repeat > 0
      ? {
          label: "Most Rewatched",
          ...formatMediaValue(mostRewatched, `(${mostRewatched.repeat}x)`),
        }
      : { label: "Most Rewatched", value: "—", missing: true };

  const mostRereadRow =
    mostReread?.repeat && mostReread.repeat > 0
      ? {
          label: "Most Reread",
          ...formatMediaValue(mostReread, `(${mostReread.repeat}x)`),
        }
      : { label: "Most Reread", value: "—", missing: true };

  // Always render the full set of record rows (using placeholders when data is missing)
  const rows: { label: string; value: string; missing: boolean }[] = [
    longestAnimeRow,
    longestMangaRow,
    { label: "Top Rated Anime", ...formatScoreValue(topRatedAnime) },
    { label: "Top Rated Manga", ...formatScoreValue(topRatedManga) },
    mostRewatchedRow,
    mostRereadRow,
  ];

  const rowHeight = 34;
  const startY = 62;
  const bottomPad = 22;
  const svgHeight = Math.max(
    180,
    startY + (rows.length - 1) * rowHeight + 26 + bottomPad,
  );

  const recordsContent = rows
    .map((r, i) => {
      const valueFill = r.missing
        ? resolvedColors.textColor
        : resolvedColors.circleColor;
      const valueOpacity = r.missing ? 0.65 : 1;
      return `
      <g transform="translate(${SPACING.CARD_PADDING}, ${startY + i * rowHeight})" class="stagger" style="animation-delay:${ANIMATION.BASE_DELAY + i * ANIMATION.MEDIUM_INCREMENT}ms">
        <text class="record-label" x="0" y="0" fill="${resolvedColors.textColor}">${escapeForXml(r.label)}:</text>
        <text class="record-value" x="0" y="16" fill="${valueFill}" opacity="${valueOpacity}">${r.value}</text>
      </g>
    `;
    })
    .join("");

  return markTrustedSvg(`
    <svg xmlns="http://www.w3.org/2000/svg" width="${dims.w}" height="${svgHeight}" viewBox="0 0 ${dims.w} ${svgHeight}" fill="none" role="img" aria-labelledby="title-id">
      ${gradientDefs ? `<defs>${gradientDefs}</defs>` : ""}
      <title id="title-id">${safeTitle}</title>
      <style>
        .header { fill: ${resolvedColors.titleColor}; font: 600 ${headerFontSize}px 'Segoe UI', Ubuntu, Sans-Serif; }
        .record-label { font-family: 'Segoe UI', Ubuntu, Sans-Serif; font-weight: 500; font-size: ${TYPOGRAPHY.STAT_LABEL_SIZE}px; }
        .record-value { font-family: 'Segoe UI', Ubuntu, Sans-Serif; font-weight: 400; font-size: ${TYPOGRAPHY.SECTION_TITLE_SIZE}px; }
        .stagger { opacity: 0; animation: fadeIn 0.5s ease forwards; }
        @keyframes fadeIn { to { opacity: 1; } }
      </style>
      <rect x="0.5" y="0.5" width="${dims.w - 1}" height="${svgHeight - 1}" rx="${cardRadius}" fill="${resolvedColors.backgroundColor}" ${resolvedColors.borderColor ? `stroke="${resolvedColors.borderColor}"` : ""} stroke-width="2"/>
      <g transform="translate(20, 35)">
        <text class="header">${safeTitle}</text>
      </g>
      ${recordsContent}
    </svg>
  `);
}
