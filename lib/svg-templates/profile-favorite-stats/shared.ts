import type { ColorValue } from "@/lib/types/card";
import type { UserFavourites } from "@/lib/types/records";

/** Common styles interface for all profile/favourites templates. @source */
export interface TemplateStyles {
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
export function generateCommonStyles(
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
export function generateCardBackground(
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
export function getFavouriteCounts(favourites: UserFavourites) {
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
export function generateFavouritesSummaryBody(
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
export function getVariantLabel(variant: string): string {
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
