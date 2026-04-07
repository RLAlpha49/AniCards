import { fitSvgSingleLineText } from "@/lib/pretext/runtime";
import {
  ANIMATION,
  SPACING,
  TYPOGRAPHY,
} from "@/lib/svg-templates/common/constants";
import type { ColorValue } from "@/lib/types/card";
import type { UserFavourites } from "@/lib/types/records";

type CategoryLabel = "Anime" | "Manga" | "Characters" | "Staff" | "Studios";

function fontSizeAttr(fontSize: number | null | undefined): string {
  return typeof fontSize === "number" ? ` font-size="${fontSize}"` : "";
}

function fitCategoryLabel(
  text: CategoryLabel,
): ReturnType<typeof fitSvgSingleLineText> {
  return fitSvgSingleLineText({
    fontWeight: 400,
    initialFontSize: TYPOGRAPHY.STAT_LABEL_SIZE,
    maxWidth: 66,
    minFontSize: 8,
    mode: "shrink-then-truncate",
    text,
  });
}

const TOTAL_LABEL_FIT = fitSvgSingleLineText({
  fontWeight: 400,
  initialFontSize: TYPOGRAPHY.STAT_LABEL_SIZE,
  maxWidth: 120,
  minFontSize: 8,
  mode: "shrink-then-truncate",
  text: "total favourites",
});

const CATEGORY_LABEL_FITS: Record<
  CategoryLabel,
  ReturnType<typeof fitSvgSingleLineText>
> = {
  Anime: fitCategoryLabel("Anime"),
  Manga: fitCategoryLabel("Manga"),
  Characters: fitCategoryLabel("Characters"),
  Staff: fitCategoryLabel("Staff"),
  Studios: fitCategoryLabel("Studios"),
};

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
  void resolvedColors;
  const total =
    counts.anime +
    counts.manga +
    counts.characters +
    counts.staff +
    counts.studios;
  const categories: ReadonlyArray<{ label: CategoryLabel; count: number }> = [
    { label: "Anime", count: counts.anime },
    { label: "Manga", count: counts.manga },
    { label: "Characters", count: counts.characters },
    { label: "Staff", count: counts.staff },
    { label: "Studios", count: counts.studios },
  ];
  const totalText = total.toLocaleString("en-US");
  // generateFavouritesSummaryBody computes totalCountFit per call because the value is dynamic; if fitSvgSingleLineText becomes hot, add memoization.
  const totalCountFit = fitSvgSingleLineText({
    fontWeight: 600,
    initialFontSize: 24,
    maxWidth: 40,
    minFontSize: 8,
    mode: "shrink-then-truncate",
    text: totalText,
  });

  return `
    <g data-testid="main-card-body" transform="translate(${SPACING.CARD_PADDING}, ${SPACING.CONTENT_Y})">
      <g class="stagger" style="animation-delay: ${ANIMATION.PROFILE_BASE_DELAY}ms">
        <text class="total-count" x="0" y="20"${fontSizeAttr(totalCountFit?.fontSize)}>${totalCountFit?.text ?? totalText}</text>
        <text class="stat-label" x="45" y="20"${fontSizeAttr(TOTAL_LABEL_FIT?.fontSize)}>${TOTAL_LABEL_FIT?.text ?? "total favourites"}</text>
      </g>
      ${categories
        .map((cat, i) => {
          const categoryCountText = cat.count.toLocaleString("en-US");
          // generateFavouritesSummaryBody computes this category fit per call because counts are dynamic; if fitSvgSingleLineText becomes hot, add memoization.
          const categoryCountFit = fitSvgSingleLineText({
            fontWeight: 600,
            initialFontSize: 12,
            maxWidth: 26,
            minFontSize: 8,
            mode: "shrink-then-truncate",
            text: categoryCountText,
          });
          const categoryLabelFit = CATEGORY_LABEL_FITS[cat.label];

          return `
        <g class="stagger" style="animation-delay: ${ANIMATION.BASE_DELAY - 100 + i * ANIMATION.MEDIUM_INCREMENT}ms" transform="translate(${(i % 3) * 100}, ${50 + Math.floor(i / 3) * 30})">
          <text class="stat-value" x="0" y="12"${fontSizeAttr(categoryCountFit?.fontSize)}>${categoryCountFit?.text ?? categoryCountText}</text>
          <text class="stat-label" x="30" y="12"${fontSizeAttr(categoryLabelFit?.fontSize)}>${categoryLabelFit?.text ?? cat.label}</text>
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
