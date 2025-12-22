import type { ColorValue } from "@/lib/types/card";
import type { UserFavourites } from "@/lib/types/records";
import { ANIMATION, SPACING } from "@/lib/svg-templates/common/constants";

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
    <g data-testid="main-card-body" transform="translate(${SPACING.CARD_PADDING}, ${SPACING.CONTENT_Y})">
      <g class="stagger" style="animation-delay: ${ANIMATION.PROFILE_BASE_DELAY}ms">
        <text class="total-count" x="0" y="20">${total}</text>
        <text class="stat-label" x="45" y="20">total favourites</text>
      </g>
      ${categories
        .map(
          (cat, i) => `
        <g class="stagger" style="animation-delay: ${ANIMATION.BASE_DELAY - 100 + i * ANIMATION.MEDIUM_INCREMENT}ms" transform="translate(${(i % 3) * 100}, ${50 + Math.floor(i / 3) * 30})">
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
    case "studios":
      return "Studios";
    default:
      return "Favorites";
  }
}
