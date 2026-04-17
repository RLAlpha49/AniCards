import { buildThemePreviewUrls } from "@/lib/card-preview";
import { getPreviewCardDimensions } from "@/lib/card-preview-dimensions";
import type { ThemePreviewUrls } from "@/lib/preview-theme";

const MARQUEE_ROW_COUNT = 2;

type HomePreviewSelection = {
  cardType: string;
  extras?: Record<string, string>;
  keyPrefix?: string;
  variation: string;
};

export interface HomeHeroPreviewCard {
  cardType: string;
  previewUrls: ThemePreviewUrls;
  rotate: number;
  width: number;
  height: number;
  z: number;
}

export interface HomeMarqueeCard {
  height: number;
  key: string;
  previewUrls: ThemePreviewUrls;
  width: number;
}

function buildHeroPreviewCard(params: {
  cardType: string;
  rotate: number;
  variation: string;
  z: number;
}): HomeHeroPreviewCard {
  const { h, w } = getPreviewCardDimensions(params.cardType, params.variation);

  return {
    cardType: params.cardType,
    height: h,
    previewUrls: buildThemePreviewUrls({
      cardType: params.cardType,
      variation: params.variation,
    }),
    rotate: params.rotate,
    width: w,
    z: params.z,
  };
}

function buildMarqueeRows(cards: readonly HomeMarqueeCard[], rowCount: number) {
  const rows = Array.from({ length: rowCount }, () => [] as HomeMarqueeCard[]);

  cards.forEach((card, index) => {
    rows[index % rowCount].push(card);
  });

  return rows.filter((row) => row.length > 0);
}

function getVariationSignature(extras?: Record<string, string>) {
  if (!extras) return "";

  return Object.entries(extras)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, value]) => `${key}-${value}`)
    .join("-");
}

function buildMarqueeCard({
  cardType,
  extras,
  keyPrefix,
  variation,
}: Readonly<HomePreviewSelection>): HomeMarqueeCard {
  const { h, w } = getPreviewCardDimensions(cardType, variation);
  const variationSignature = getVariationSignature(extras);

  return {
    height: h,
    key: [keyPrefix ?? cardType, variation, variationSignature]
      .filter(Boolean)
      .join("-"),
    previewUrls: buildThemePreviewUrls({
      cardType,
      variation,
      extras,
    }),
    width: w,
  };
}

export const HOME_HERO_PREVIEW_CARDS: readonly HomeHeroPreviewCard[] = [
  buildHeroPreviewCard({
    cardType: "animeStats",
    rotate: -6,
    variation: "default",
    z: 3,
  }),
  buildHeroPreviewCard({
    cardType: "animeGenres",
    rotate: 4,
    variation: "pie",
    z: 2,
  }),
  buildHeroPreviewCard({
    cardType: "socialStats",
    rotate: -2,
    variation: "default",
    z: 1,
  }),
] as const;

const HOME_MARQUEE_CARD_SELECTION: readonly HomePreviewSelection[] = [
  { cardType: "profileOverview", variation: "default" },
  { cardType: "animeSeasonalPreference", variation: "radar" },
  { cardType: "recentActivitySummary", variation: "default" },
  { cardType: "statusCompletionOverview", variation: "combined" },
  { cardType: "mostRewatched", variation: "anime" },
  { cardType: "mangaStats", variation: "compact" },
  { cardType: "animeSourceMaterialDistribution", variation: "bar" },
  { cardType: "favoritesSummary", variation: "default" },
] as const;

export const HOME_CARD_MARQUEE_ROWS = buildMarqueeRows(
  HOME_MARQUEE_CARD_SELECTION.map(buildMarqueeCard),
  MARQUEE_ROW_COUNT,
);
