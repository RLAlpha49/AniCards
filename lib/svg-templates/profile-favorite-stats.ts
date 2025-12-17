import { ColorValue } from "@/lib/types/card";
import type { TrustedSVG } from "@/lib/types/svg";
import {
  UserFavourites,
  UserStatistics,
  UserAvatar,
} from "@/lib/types/records";

import {
  calculateDynamicFontSize,
  processColorsForSVG,
  getCardBorderRadius,
  escapeForXml,
  markTrustedSvg,
  toFiniteNumber,
} from "../utils";

/** Common styles interface for all profile/favourites templates. @source */
interface TemplateStyles {
  titleColor: ColorValue;
  backgroundColor: ColorValue;
  textColor: ColorValue;
  circleColor: ColorValue;
  borderColor?: ColorValue;
  borderRadius?: number;
}

/**
 * Generate common CSS styles used across all profile/favourites cards.
 * @param resolvedColors - Pre-processed color values as strings.
 * @param titleFontSize - Font size for the title.
 * @returns CSS style block as string.
 * @source
 */
function generateCommonStyles(
  resolvedColors: Record<string, string>,
  titleFontSize: number,
): string {
  return `
    /* stylelint-disable selector-class-pattern, keyframes-name-pattern */
    .header {
      fill: ${resolvedColors.titleColor};
      font: 600 ${titleFontSize}px 'Segoe UI', Ubuntu, Sans-Serif;
      animation: fadeInAnimation 0.8s ease-in-out forwards;
    }

    [data-testid="card-title"] text {
      fill: ${resolvedColors.titleColor};
    }

    [data-testid="main-card-body"] circle {
      stroke: ${resolvedColors.circleColor};
    }

    [data-testid="card-bg"] {
      fill: ${resolvedColors.backgroundColor};
    }

    [data-testid="main-card-body"] text {
      fill: ${resolvedColors.textColor};
    }

    .stat {
      fill: ${resolvedColors.textColor};
      font: 400 13px 'Segoe UI', Ubuntu, Sans-Serif;
    }

    .stat-label {
      fill: ${resolvedColors.textColor};
      font: 600 12px 'Segoe UI', Ubuntu, Sans-Serif;
    }

    .stat-value {
      fill: ${resolvedColors.circleColor};
      font: 700 14px 'Segoe UI', Ubuntu, Sans-Serif;
    }

    .section-title {
      fill: ${resolvedColors.circleColor};
      font: 600 11px 'Segoe UI', Ubuntu, Sans-Serif;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }

    .stagger {
      opacity: 0;
      animation: fadeInAnimation 0.3s ease-in-out forwards;
    }

    @keyframes fadeInAnimation {
      from { opacity: 0; }
      to { opacity: 1; }
    }
  `;
}

/**
 * Generate the background rectangle for a card.
 * @param dims - Width and height for the card.
 * @param cardRadius - Border radius for the card.
 * @param resolvedColors - Pre-processed color values as strings.
 * @returns SVG rect element as string.
 * @source
 */
function generateCardBackground(
  dims: { w: number; h: number },
  cardRadius: number,
  resolvedColors: Record<string, string>,
): string {
  return `
    <rect
      data-testid="card-bg"
      x="0.5"
      y="0.5"
      rx="${cardRadius}"
      height="${dims.h - 1}"
      width="${dims.w - 1}"
      fill="${resolvedColors.backgroundColor}"
      ${resolvedColors.borderColor ? `stroke="${resolvedColors.borderColor}"` : ""}
      stroke-width="2"
    />
  `;
}

/**
 * Get favourite counts from favourites data.
 * @param favourites - User favourites data.
 * @returns Object with counts for each category.
 */
function getFavouriteCounts(favourites: UserFavourites) {
  return {
    anime:
      favourites.anime?.pageInfo?.total ?? favourites.anime?.nodes?.length ?? 0,
    manga:
      favourites.manga?.pageInfo?.total ?? favourites.manga?.nodes?.length ?? 0,
    characters:
      favourites.characters?.pageInfo?.total ??
      favourites.characters?.nodes?.length ??
      0,
    staff:
      favourites.staff?.pageInfo?.total ?? favourites.staff?.nodes?.length ?? 0,
    studios:
      favourites.studios?.pageInfo?.total ??
      favourites.studios?.nodes?.length ??
      0,
  };
}

/**
 * Generate the main body SVG for favourites summary.
 * @param counts - Favourite counts.
 * @param resolvedColors - Resolved colors.
 * @returns SVG string for the body.
 */
function generateFavouritesSummaryBody(
  counts: ReturnType<typeof getFavouriteCounts>,
  resolvedColors: Record<string, string>,
): string {
  const total =
    counts.anime +
    counts.manga +
    counts.characters +
    counts.staff +
    counts.studios;
  const categories = [
    { label: "Anime", count: counts.anime },
    { label: "Manga", count: counts.manga },
    { label: "Characters", count: counts.characters },
    { label: "Staff", count: counts.staff },
    { label: "Studios", count: counts.studios },
  ];

  return `
    <g data-testid="main-card-body" transform="translate(25, 55)">
      <g class="stagger" style="animation-delay: 250ms">
        <text class="total-count" x="0" y="20">${total}</text>
        <text class="stat-label" x="45" y="20">total favourites</text>
      </g>
      ${categories
        .map(
          (cat, i) => `
        <g class="stagger" style="animation-delay: ${350 + i * 100}ms" transform="translate(${(i % 3) * 100}, ${50 + Math.floor(i / 3) * 30})">
          <text class="stat-value" x="0" y="12">${cat.count}</text>
          <text class="stat-label" x="30" y="12">${cat.label}</text>
        </g>
      `,
        )
        .join("")}
    </g>
  `;
}

/**
 * Get the label for a favourites variant.
 * @param variant - The variant type.
 * @returns The display label.
 */
function getVariantLabel(variant: string): string {
  switch (variant) {
    case "anime":
      return "Anime";
    case "manga":
      return "Manga";
    case "characters":
      return "Characters";
    default:
      return "Favorites";
  }
}

/**
 * Renders the Profile Overview card showing avatar, display name, and high-level
 * counters (total anime, total manga, days watched, chapters read).
 * @param data - Template input including username, styles, statistics, and avatar.
 * @returns The generated SVG markup as a TrustedSVG.
 * @source
 */
export const profileOverviewTemplate = (data: {
  username: string;
  variant?: "default";
  styles: TemplateStyles;
  statistics: UserStatistics;
  avatar?: UserAvatar;
  avatarDataUrl?: string;
  createdAt?: number;
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

  const animeStats = data.statistics.anime;
  const mangaStats = data.statistics.manga;

  // Calculate days watched from minutes
  const daysWatched = Math.round(
    (toFiniteNumber(animeStats.minutesWatched, { fallback: 0 }) ?? 0) /
      (60 * 24),
  );

  // Calculate years active if createdAt is available
  const yearsActive = data.createdAt
    ? Math.max(
        1,
        Math.floor(
          (Date.now() / 1000 - data.createdAt) / (365.25 * 24 * 60 * 60),
        ),
      )
    : undefined;

  const dims = { w: 300, h: 170 };
  const cardRadius = getCardBorderRadius(data.styles.borderRadius);

  const title = `${data.username}'s Profile`;
  const safeTitle = escapeForXml(title);
  const safeUsername = escapeForXml(data.username);

  const avatarUrl =
    data.avatarDataUrl || data.avatar?.medium || data.avatar?.large;

  const yearSuffix = yearsActive && yearsActive > 1 ? "s" : "";
  const yearsActiveText = yearsActive
    ? `Active for ${yearsActive} year${yearSuffix}.`
    : "";
  const isDataUrl = data.avatarDataUrl?.startsWith("data:");
  const hrefAttr = isDataUrl
    ? `href="${escapeForXml(avatarUrl)}"`
    : `xlink:href="${escapeForXml(avatarUrl)}"`;

  return markTrustedSvg(`
<svg
  xmlns="http://www.w3.org/2000/svg"
  xmlns:xlink="http://www.w3.org/1999/xlink"
  width="${dims.w}"
  height="${dims.h}"
  viewBox="0 0 ${dims.w} ${dims.h}"
  fill="none"
  role="img"
  aria-labelledby="title-id desc-id"
>
  ${gradientDefs ? `<defs>${gradientDefs}</defs>` : ""}
  <title id="title-id">${safeTitle}</title>
  <desc id="desc-id">
    Anime: ${animeStats.count} titles, ${daysWatched} days watched.
    Manga: ${mangaStats.count} titles, ${mangaStats.chaptersRead} chapters read.
    ${yearsActiveText}
  </desc>

  <style>
    ${generateCommonStyles(resolvedColors, Number.parseFloat(calculateDynamicFontSize(title)))}

    .username {
      fill: ${resolvedColors.titleColor};
      font: 700 18px 'Segoe UI', Ubuntu, Sans-Serif;
    }

    .avatar-clip {
      clip-path: circle(30px at 35px 35px);
    }
  </style>

  ${generateCardBackground(dims, cardRadius, resolvedColors)}

  ${(() => {
    // Default variant
    return `
      <g data-testid="card-title" transform="translate(100, 45)">
        <text x="0" y="0" class="header">${safeUsername}</text>
      </g>
      ${
        avatarUrl
          ? `
        <g transform="translate(20, 10)">
          <clipPath id="avatar-clip">
            <circle cx="30" cy="30" r="30"/>
          </clipPath>
          <image
            x="0" y="0" width="60" height="60"
            ${hrefAttr}
            clip-path="url(#avatar-clip)"
            preserveAspectRatio="xMidYMid slice"
          />
          <circle cx="30" cy="30" r="30" fill="none" stroke="${resolvedColors.circleColor}" stroke-width="2"/>
        </g>
      `
          : ""
      }
      <g data-testid="main-card-body" transform="translate(20, 100)">
        <g class="stagger" style="animation-delay: 300ms">
          <text class="section-title" x="0" y="0">ANIME</text>
          <text class="stat-value" x="0" y="20">${animeStats.count}</text>
          <text class="stat-label" x="50" y="20">titles</text>
          <text class="stat-label" x="0" y="40">${daysWatched} days watched</text>
        </g>
        <g class="stagger" style="animation-delay: 450ms" transform="translate(150, 0)">
          <text class="section-title" x="0" y="0">MANGA</text>
          <text class="stat-value" x="0" y="20">${mangaStats.count}</text>
          <text class="stat-label" x="50" y="20">titles</text>
          <text class="stat-label" x="0" y="40">${mangaStats.chaptersRead} chapters read</text>
        </g>
        ${
          yearsActive
            ? `
          <g class="stagger" style="animation-delay: 600ms" transform="translate(300, 0)">
            <text class="section-title" x="0" y="0">ACTIVE</text>
            <text class="stat-value" x="0" y="20">${yearsActive}</text>
            <text class="stat-label" x="30" y="20">year${yearSuffix}</text>
          </g>
        `
            : ""
        }
      </g>
    `;
  })()}
</svg>
`);
};

/**
 * Renders the Favourites Summary card - a compact KPI-style card summarizing
 * how many favourites the user has in each category.
 * @param data - Template input including username, styles, and favourites.
 * @returns The generated SVG markup as a TrustedSVG.
 * @source
 */
export const favoritesSummaryTemplate = (data: {
  username: string;
  variant?: "default";
  styles: TemplateStyles;
  favourites: UserFavourites;
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

  // Get counts from each category
  const counts = getFavouriteCounts(data.favourites);
  const animeCount = counts.anime;
  const mangaCount = counts.manga;
  const charactersCount = counts.characters;
  const staffCount = counts.staff;
  const studiosCount = counts.studios;

  const totalFavourites =
    animeCount + mangaCount + charactersCount + staffCount + studiosCount;

  const dims = { w: 350, h: 180 };
  const cardRadius = getCardBorderRadius(data.styles.borderRadius);

  const title = `${data.username}'s Favourites`;
  const safeTitle = escapeForXml(title);

  return markTrustedSvg(`
<svg
  xmlns="http://www.w3.org/2000/svg"
  width="${dims.w}"
  height="${dims.h}"
  viewBox="0 0 ${dims.w} ${dims.h}"
  fill="none"
  role="img"
  aria-labelledby="title-id desc-id"
>
  ${gradientDefs ? `<defs>${gradientDefs}</defs>` : ""}
  <title id="title-id">${safeTitle}</title>
  <desc id="desc-id">
    Total Favourites: ${totalFavourites}.
    Anime: ${counts.anime}, Manga: ${counts.manga}, Characters: ${counts.characters},
    Staff: ${counts.staff}, Studios: ${counts.studios}.
  </desc>

  <style>
    ${generateCommonStyles(resolvedColors, Number.parseFloat(calculateDynamicFontSize(title)))}

    .total-count {
      fill: ${resolvedColors.circleColor};
      font: 700 24px 'Segoe UI', Ubuntu, Sans-Serif;
    }

    .category-icon {
      fill: ${resolvedColors.circleColor};
      font-size: 14px;
    }
  </style>

  ${generateCardBackground(dims, cardRadius, resolvedColors)}

  <g data-testid="card-title" transform="translate(25, 35)">
    <text x="0" y="0" class="header">${safeTitle}</text>
  </g>

  ${generateFavouritesSummaryBody(counts, resolvedColors)}
</svg>
`);
};

/**
 * Renders the Favourites Grid card - displays the user's favourite anime, manga,
 * or characters as a visual grid with cover images.
 * @param data - Template input including username, styles, favourites, and grid type.
 * @returns The generated SVG markup as a TrustedSVG.
 * @source
 */
export const favoritesGridTemplate = (data: {
  username: string;
  variant?: "anime" | "manga" | "characters" | "mixed";
  styles: TemplateStyles;
  favourites: UserFavourites;
  gridCols?: number;
  gridRows?: number;
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

  // Select which favourites to show based on variant
  const variant = data.variant || "mixed";

  // Grid size (clamped to 1..5)
  const gridCols = Math.max(1, Math.min(5, Math.floor(data.gridCols ?? 3)));
  const gridRows = Math.max(1, Math.min(5, Math.floor(data.gridRows ?? 3)));
  const gridCapacity = gridCols * gridRows;

  type GridItem = {
    id: number;
    name: string;
    image?: string;
    color?: string;
    type: "anime" | "manga" | "character";
  };

  type GridCell = {
    kind: "item" | "placeholder";
    item?: GridItem;
    placeholderId: string;
  };

  const buildAnimeItems = (): GridItem[] => {
    const animeNodes = data.favourites.anime?.nodes ?? [];
    return animeNodes.map((n) => ({
      id: n.id,
      name: n.title.english || n.title.romaji || n.title.native || "Unknown",
      image: n.coverImage.large || n.coverImage.medium,
      color: n.coverImage.color,
      type: "anime" as const,
    }));
  };

  const buildMangaItems = (): GridItem[] => {
    const mangaNodes = data.favourites.manga?.nodes ?? [];
    return mangaNodes.map((n) => ({
      id: n.id,
      name: n.title.english || n.title.romaji || n.title.native || "Unknown",
      image: n.coverImage.large || n.coverImage.medium,
      color: n.coverImage.color,
      type: "manga" as const,
    }));
  };

  const buildCharacterItems = (): GridItem[] => {
    const charNodes = data.favourites.characters?.nodes ?? [];
    return charNodes.map((n) => ({
      id: n.id,
      name: n.name.full || n.name.native || "Unknown",
      image: n.image.large || n.image.medium,
      type: "character" as const,
    }));
  };

  const takeInterleavedMixed = (
    anime: GridItem[],
    manga: GridItem[],
    characters: GridItem[],
    limit: number,
  ): GridItem[] => {
    // Start by taking 1 from each category (round-robin). If a category runs out,
    // keep pulling from the others until we reach `limit` or all pools are empty.
    const a = [...anime];
    const m = [...manga];
    const c = [...characters];

    const result: GridItem[] = [];
    const order: Array<"a" | "m" | "c"> = ["a", "m", "c"];

    while (result.length < limit) {
      const before = result.length;
      for (const k of order) {
        if (result.length >= limit) break;
        if (k === "a" && a.length) result.push(a.shift()!);
        if (k === "m" && m.length) result.push(m.shift()!);
        if (k === "c" && c.length) result.push(c.shift()!);
      }
      // If nothing was added in a full sweep, all pools are empty.
      if (result.length === before) break;
    }

    return result;
  };

  let gridItems: GridItem[] = [];

  if (variant === "anime") {
    gridItems = buildAnimeItems().slice(0, gridCapacity);
  } else if (variant === "manga") {
    gridItems = buildMangaItems().slice(0, gridCapacity);
  } else if (variant === "characters") {
    gridItems = buildCharacterItems().slice(0, gridCapacity);
  } else {
    // mixed
    gridItems = takeInterleavedMixed(
      buildAnimeItems(),
      buildMangaItems(),
      buildCharacterItems(),
      gridCapacity,
    );
  }

  // Always render a full grid; if items are missing, fill with placeholders.
  const cells: GridCell[] = Array.from({ length: gridCapacity }, (_, idx) => {
    const item = gridItems[idx];
    if (item) {
      return { kind: "item", item, placeholderId: `cell-${idx}` };
    }
    return { kind: "placeholder", placeholderId: `placeholder-${idx}` };
  });

  // Grid layout: configurable columns x rows
  const cellWidth = 120;
  const cellHeight = 190;
  const spacing = 12;
  const cols = gridCols;
  const rows = gridRows;

  const dims = {
    w: 20 + cols * (cellWidth + spacing) + 10,
    h: 55 + rows * (cellHeight + spacing) + 10,
  };
  const cardRadius = getCardBorderRadius(data.styles.borderRadius);

  const variantLabel = getVariantLabel(variant);
  const title = variant === "mixed" ? `${data.username}'s ${variantLabel}` : `${data.username}'s Favorite ${variantLabel}`;
  const safeTitle = escapeForXml(title);

  return markTrustedSvg(`
<svg
  xmlns="http://www.w3.org/2000/svg"
  xmlns:xlink="http://www.w3.org/1999/xlink"
  width="${dims.w}"
  height="${dims.h}"
  viewBox="0 0 ${dims.w} ${dims.h}"
  fill="none"
  role="img"
  aria-labelledby="title-id desc-id"
>
  ${gradientDefs ? `<defs>${gradientDefs}</defs>` : ""}
  <title id="title-id">${safeTitle}</title>
  <desc id="desc-id">
    ${variantLabel}: ${gridItems.map((item) => item.name).join(", ") || "None"}.
  </desc>

  <style>
    ${generateCommonStyles(resolvedColors, Number.parseFloat(calculateDynamicFontSize(title)))}

    .item-name {
      fill: ${resolvedColors.textColor};
      font: 400 11px 'Segoe UI', Ubuntu, Sans-Serif;
    }

    .item-placeholder {
      fill: ${resolvedColors.circleColor};
      opacity: 0.3;
    }
  </style>

  ${generateCardBackground(dims, cardRadius, resolvedColors)}

  <g data-testid="card-title" transform="translate(20, 30)">
    <text x="0" y="0" class="header">${safeTitle}</text>
  </g>

  <g data-testid="main-card-body" transform="translate(20, 50)">
    ${(() => {
      return cells
        .map((cell, i) => {
          const col = i % cols;
          const row = Math.floor(i / cols);
          const x = col * (cellWidth + spacing);
          const y = row * (cellHeight + spacing);

          if (cell.kind === "placeholder" || !cell.item) {
            return `
            <g class="stagger" style="animation-delay: ${300 + i * 100}ms" transform="translate(${x}, ${y})">
              <clipPath id="clip-${cell.placeholderId}">
                <rect x="0" y="0" width="${cellWidth}" height="${cellHeight - 25}" rx="4"/>
              </clipPath>
              <rect class="item-placeholder" x="0" y="0" width="${cellWidth}" height="${cellHeight - 25}" rx="4"/>
            </g>
          `;
          }

          const item = cell.item;
          const anilistUrl = `https://anilist.co/${item.type}/${item.id}`;
          let imageHrefAttr = "";
          if (item.image) {
            imageHrefAttr = `xlink:href="${escapeForXml(item.image)}"`;
            if (item.image.startsWith("data:")) {
              imageHrefAttr = `href="${escapeForXml(item.image)}"`;
            }
          }

          const clipId = `clip-${item.type}-${item.id}-${i}`;

          return `
          <g class="stagger" style="animation-delay: ${300 + i * 100}ms" transform="translate(${x}, ${y})">
            <clipPath id="${clipId}">
              <rect x="0" y="0" width="${cellWidth}" height="${cellHeight - 25}" rx="4"/>
            </clipPath>
            ${
              item.image
                ? `
              <a xlink:href="${escapeForXml(anilistUrl)}" target="_blank">
                <image
                  x="0" y="0" width="${cellWidth}" height="${cellHeight - 25}"
                  ${imageHrefAttr}
                  clip-path="url(#${clipId})"
                  preserveAspectRatio="xMidYMid slice"
                />
              </a>
            `
                : `
              <rect class="item-placeholder" x="0" y="0" width="${cellWidth}" height="${cellHeight - 25}" rx="4"/>
            `
            }
            <text class="item-name" style="font-size:16px" x="0" y="${cellHeight - 3}">
              ${escapeForXml(item.name.length > 15 ? item.name.substring(0, 15) + "…" : item.name)}
            </text>
          </g>
        `;
        })
        .join("");
    })()}
  </g>
</svg>
`);
};
