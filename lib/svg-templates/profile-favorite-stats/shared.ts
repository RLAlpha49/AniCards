import type { ColorValue } from "@/lib/types/card";
import type { UserFavourites } from "@/lib/types/records";
import { ANIMATION, SPACING } from "@/lib/svg-templates/common/constants";
import { estimateCardTextWidth } from "@/lib/svg-templates/common/text-metrics";

/** Common styles interface for all profile/favourites templates. @source */
export interface TemplateStyles {
  titleColor: ColorValue;
  backgroundColor: ColorValue;
  textColor: ColorValue;
  circleColor: ColorValue;
  borderColor?: ColorValue;
  borderRadius?: number;
}

export type ProfileVariant = "default" | "compact" | "minimal";

/**
 * Fit text into `width` by shrinking the font size.
 *
 * Widths come from measured font advances, so text that already fits keeps its
 * natural size. `textLength` with `lengthAdjust="spacingAndGlyphs"` stretches
 * or squeezes every glyph advance, which visibly warps the label, so it is
 * never emitted: the measured estimate is accurate enough that scaling the
 * size alone fits the budget.
 * @source
 */
export function fitText(
  value: string | number,
  width: number,
  fontSize: number,
): string {
  const text = String(value);
  if (width <= 0) return "";
  const naturalWidth = estimateCardTextWidth(text, fontSize, 600);
  if (naturalWidth <= width) return "";
  const scaledSize = Math.max(6, (fontSize * width) / naturalWidth);
  return `style="font-size:${scaledSize.toFixed(2)}px"`;
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
 * @returns SVG string for the body.
 */
export function generateFavouritesSummaryBody(
  counts: ReturnType<typeof getFavouriteCounts>,
  variant: ProfileVariant = "default",
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

  const isDefault = variant === "default";
  const isMinimal = variant === "minimal";
  const totalText = `${total} total`;
  const totalLabelX = Math.min(
    125,
    Math.max(45, String(total).length * 15 + 10),
  );

  return `
    <g data-testid="main-card-body" transform="translate(${SPACING.CARD_PADDING}, ${SPACING.CONTENT_Y})">
      ${
        isMinimal
          ? `<text class="stat-label" x="300" y="-20" text-anchor="end" ${fitText(totalText, 85, 12)}>${totalText}</text>`
          : `<g class="stagger" style="animation-delay: ${ANIMATION.PROFILE_BASE_DELAY}ms">
              <text class="total-count" x="0" y="20" ${fitText(total, 110, 24)}>${total}</text>
              <text class="stat-label" x="${totalLabelX}" y="20">total favourites</text>
            </g>`
      }
      ${categories
        .map((cat, i) => {
          const x = isDefault ? (i % 3) * 100 : i * 61;
          const y = isDefault
            ? 62 + Math.floor(i / 3) * 37
            : isMinimal
              ? 0
              : 42;
          return `
        <g class="stagger" style="animation-delay: ${ANIMATION.BASE_DELAY - 100 + i * ANIMATION.MEDIUM_INCREMENT}ms" transform="translate(${x}, ${y})">
          <text class="stat-value" x="0" y="0" ${fitText(cat.count, isDefault ? 90 : 56, 14)}>${cat.count}</text>
          <text class="category-label" x="0" y="16">${cat.label}</text>
        </g>
      `;
        })
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
    case "staff":
      return "Staff";
    case "studios":
      return "Studios";
    default:
      return "Favorites";
  }
}
