export const DEFAULT_BASE_CARD_URL =
  "https://anicards.alpha49.com/api/card.svg";
export const DEFAULT_EXAMPLE_USER_ID = "542244";

export const VARIATION_LABEL_MAP: Record<string, string> = {
  default: "Default",
  vertical: "Vertical",
  compact: "Compact",
  minimal: "Minimal",
  pie: "Pie Chart",
  bar: "Bar Chart",
  horizontal: "Horizontal",
};

type VariationDef =
  | string
  | { variation: string; extras?: Record<string, string> };

export type CardGroup = {
  cardType: string;
  cardTitle: string;
  variations: VariationDef[];
};

export const CARD_GROUPS: CardGroup[] = [
  {
    cardType: "animeStats",
    cardTitle: "Anime Statistics",
    variations: ["vertical", "default", "compact", "minimal"],
  },
  {
    cardType: "mangaStats",
    cardTitle: "Manga Statistics",
    variations: ["vertical", "default", "compact", "minimal"],
  },
  {
    cardType: "socialStats",
    cardTitle: "Social Statistics",
    variations: ["default", "compact", "minimal"],
  },
  {
    cardType: "animeGenres",
    cardTitle: "Anime Genres",
    variations: ["default", "pie", "bar"],
  },
  {
    cardType: "animeTags",
    cardTitle: "Anime Tags",
    variations: ["default", "pie", "bar"],
  },
  {
    cardType: "animeVoiceActors",
    cardTitle: "Voice Actors",
    variations: ["default", "pie", "bar"],
  },
  {
    cardType: "animeStudios",
    cardTitle: "Animation Studios",
    variations: ["default", "pie", "bar"],
  },
  {
    cardType: "animeStaff",
    cardTitle: "Anime Staff",
    variations: ["default", "pie", "bar"],
  },
  {
    cardType: "animeStatusDistribution",
    cardTitle: "Anime Status Distribution",
    variations: [
      "default",
      { variation: "pie", extras: { statusColors: "true" } },
      { variation: "bar", extras: { statusColors: "true" } },
    ],
  },
  {
    cardType: "animeFormatDistribution",
    cardTitle: "Anime Format Distribution",
    variations: ["default", "pie", "bar"],
  },
  {
    cardType: "animeCountry",
    cardTitle: "Anime Country Distribution",
    variations: ["default", "pie", "bar"],
  },
  {
    cardType: "animeScoreDistribution",
    cardTitle: "Anime Score Distribution",
    variations: ["default", "horizontal"],
  },
  {
    cardType: "animeYearDistribution",
    cardTitle: "Anime Year Distribution",
    variations: ["default", "horizontal"],
  },
  {
    cardType: "mangaGenres",
    cardTitle: "Manga Genres",
    variations: ["default", "pie", "bar"],
  },
  {
    cardType: "mangaTags",
    cardTitle: "Manga Tags",
    variations: ["default", "pie", "bar"],
  },
  {
    cardType: "mangaStaff",
    cardTitle: "Manga Staff",
    variations: ["default", "pie", "bar"],
  },
  {
    cardType: "mangaStatusDistribution",
    cardTitle: "Manga Status Distribution",
    variations: [
      "default",
      { variation: "pie", extras: { statusColors: "true" } },
      { variation: "bar", extras: { statusColors: "true" } },
    ],
  },
  {
    cardType: "mangaFormatDistribution",
    cardTitle: "Manga Format Distribution",
    variations: ["default", "pie", "bar"],
  },
  {
    cardType: "mangaCountry",
    cardTitle: "Manga Country Distribution",
    variations: ["default", "pie", "bar"],
  },
  {
    cardType: "mangaScoreDistribution",
    cardTitle: "Manga Score Distribution",
    variations: ["default", "horizontal"],
  },
  {
    cardType: "mangaYearDistribution",
    cardTitle: "Manga Year Distribution",
    variations: ["default", "horizontal"],
  },
];

export function buildCardUrl(
  cardType: string,
  variation: string,
  extras?: Record<string, string>,
  baseUrl = DEFAULT_BASE_CARD_URL,
  userId = DEFAULT_EXAMPLE_USER_ID,
) {
  const params = new URLSearchParams({
    cardType,
    userId,
    variation,
    ...extras,
  });

  return `${baseUrl}?${params.toString()}`;
}

export type ExampleCardVariant = {
  cardType: string;
  cardTitle: string;
  variation: string;
  label: string;
  extras?: Record<string, string>;
};

export function generateExampleCardVariants(
  variationLabelMap: Record<string, string> = VARIATION_LABEL_MAP,
) {
  return CARD_GROUPS.flatMap((group) =>
    group.variations.map((v) => {
      const variation = typeof v === "string" ? v : v.variation;
      const extras = typeof v === "string" ? undefined : v.extras;

      return {
        cardType: group.cardType,
        cardTitle: group.cardTitle,
        variation,
        label: variationLabelMap[variation] ?? variation,
        ...(extras ? { extras } : {}),
      } as ExampleCardVariant;
    }),
  );
}
