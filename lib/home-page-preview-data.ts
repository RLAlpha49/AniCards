import { CARD_GROUPS } from "@/lib/card-groups";
import { buildThemePreviewUrls } from "@/lib/card-preview";
import { getPreviewCardDimensions } from "@/lib/card-preview-dimensions";
import type { ThemePreviewUrls } from "@/lib/preview-theme";

const MARQUEE_ROW_COUNT = 2;
const MARQUEE_VARIATION_PRIORITY = [
  "default",
  "vertical",
  "horizontal",
  "compact",
  "minimal",
  "pie",
  "donut",
  "bar",
  "radar",
  "badges",
  "split",
  "combined",
  "anime",
  "manga",
  "cumulative",
] as const;

type NormalizedVariation = {
  variation: string;
  extras?: Record<string, string>;
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

function normalizeVariation(
  variationDef: (typeof CARD_GROUPS)[number]["variations"][number],
): NormalizedVariation {
  return typeof variationDef === "string"
    ? { variation: variationDef, extras: undefined }
    : variationDef;
}

function pickMarqueeVariation(
  variations: readonly (typeof CARD_GROUPS)[number]["variations"][number][],
): NormalizedVariation | undefined {
  const normalizedVariations = variations.map(normalizeVariation);

  for (const candidate of MARQUEE_VARIATION_PRIORITY) {
    const match = normalizedVariations.find(
      (variation) => variation.variation === candidate,
    );

    if (match) {
      return match;
    }
  }

  return normalizedVariations[0];
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

const HOME_MARQUEE_CARDS_LAYOUT = CARD_GROUPS.flatMap((group) => {
  if (group.cardType === "favoritesGrid") {
    return [];
  }

  const normalizedVariation = pickMarqueeVariation(group.variations);
  if (!normalizedVariation) {
    return [];
  }

  const dimensions = getPreviewCardDimensions(
    group.cardType,
    normalizedVariation.variation,
  );
  const variationSignature = getVariationSignature(normalizedVariation.extras);

  return [
    {
      height: dimensions.h,
      key: [group.cardType, normalizedVariation.variation, variationSignature]
        .filter(Boolean)
        .join("-"),
      previewUrls: buildThemePreviewUrls({
        cardType: group.cardType,
        variation: normalizedVariation.variation,
        extras: normalizedVariation.extras,
      }),
      width: dimensions.w,
    },
  ];
});

export const HOME_CARD_MARQUEE_ROWS = buildMarqueeRows(
  HOME_MARQUEE_CARDS_LAYOUT,
  MARQUEE_ROW_COUNT,
);
