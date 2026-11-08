import {
  DEFAULT_BASE_CARD_URL,
  DEFAULT_EXAMPLE_USER_ID,
  buildCardUrlWithParams,
  mapStoredConfigToCardUrlParams,
} from "@/lib/card-groups";

/**
 * Builds a live card-preview URL for marketing pages.
 *
 * Previews use the shared example AniList account and a named colour preset,
 * so they do not depend on stored user configuration.
 *
 * @param cardType - The card type identifier, for example `animeStats`.
 * @param variation - The card variation, for example `vertical`.
 * @param colorPreset - A named colour preset from the generator constants.
 * @returns An absolute card SVG URL.
 * @source
 */
export function previewCardUrl(
  cardType: string,
  variation = "default",
  colorPreset = "anilistDarkGradient",
): string {
  return buildCardUrlWithParams(
    mapStoredConfigToCardUrlParams(
      { cardName: cardType, variation, colorPreset },
      { userId: DEFAULT_EXAMPLE_USER_ID, includeColors: false },
    ),
    DEFAULT_BASE_CARD_URL,
  );
}

/**
 * Intrinsic size of each card preview, keyed by card type and variation.
 *
 * The card API renders each card at a fixed size, so the browser can reserve
 * the right box before the SVG loads. The values mirror the server templates
 * in `lib/svg-templates/common/dimensions.ts` for the card types the home
 * page previews.
 * @source
 */
const PREVIEW_DIMENSIONS: Record<
  string,
  Record<string, { w: number; h: number }>
> = {
  animeStats: {
    default: { w: 450, h: 195 },
    vertical: { w: 260, h: 350 },
  },
  mangaStats: {
    default: { w: 450, h: 195 },
  },
  socialStats: {
    default: { w: 280, h: 195 },
  },
  animeGenres: {
    pie: { w: 340, h: 205 },
    donut: { w: 340, h: 205 },
    bar: { w: 360, h: 210 },
  },
  animeTags: {
    bar: { w: 360, h: 210 },
  },
  animeStudios: {
    donut: { w: 340, h: 205 },
  },
  animeVoiceActors: {
    default: { w: 280, h: 205 },
  },
  animeScoreDistribution: {
    horizontal: { w: 320, h: 150 },
  },
};

/**
 * Size used when a card type is not in the dimension table.
 * @source
 */
const FALLBACK_DIMENSIONS = { w: 450, h: 195 } as const;

/**
 * Reports the intrinsic size of a card preview.
 *
 * Passing the size to the `<img>` lets the browser reserve the box before
 * the SVG loads, which stops the frame collapsing and stops the image from
 * being stretched to fit a box of the wrong shape.
 *
 * @param cardType - The card type identifier, for example `animeStats`.
 * @param variation - The card variation, for example `vertical`.
 * @returns The card's intrinsic width and height in pixels.
 * @source
 */
export function previewCardDimensions(
  cardType: string,
  variation = "default",
): { width: number; height: number } {
  const byVariation = PREVIEW_DIMENSIONS[cardType];
  const size =
    byVariation?.[variation] ?? byVariation?.default ?? FALLBACK_DIMENSIONS;

  return { width: size.w, height: size.h };
}
