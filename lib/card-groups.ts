import { buildApiUrl } from "@/lib/utils";

/** Default card generation endpoint used for example previews. @source */
export const DEFAULT_BASE_CARD_URL = buildApiUrl("/card.svg");
/** Default example user id used for generating demo card previews. @source */
export const DEFAULT_EXAMPLE_USER_ID = "542244";

/** Human-friendly labels for card variations used in the UI. @source */
export const VARIATION_LABEL_MAP: Record<string, string> = {
  default: "Default",
  vertical: "Vertical",
  compact: "Compact",
  minimal: "Minimal",
  pie: "Pie Chart",
  bar: "Bar Chart",
  horizontal: "Horizontal",
};

/**
 * Defines a variation entry which may be a simple string variation or an
 * object that supplies extras (query params) for the variation.
 * @source
 */
type VariationDef =
  | string
  | { variation: string; extras?: Record<string, string> };

/**
 * A group of related cards represented in the UI such as genres, tags and
 * statistics card groups.
 * @source
 */
export type CardGroup = {
  cardType: string;
  cardTitle: string;
  variations: VariationDef[];
};

/** All grouped card metadata used to render examples and UI lists. @source */
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

/**
 * Constructs a URL to the card SVG endpoint with the required query
 * parameters and optional extras for a given variation and user.
 * @param cardType - The logical card type to generate.
 * @param variation - Variation name used by the card renderer.
 * @param extras - Optional additional query parameters.
 * @param baseUrl - The base API endpoint to use (defaults to DEFAULT_BASE_CARD_URL).
 * @param userId - User id used to produce the card data (defaults to DEFAULT_EXAMPLE_USER_ID).
 * @returns The constructed card URL.
 * @source
 */
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

/** Example variant shape used by UI examples for each card variation. @source */
export type ExampleCardVariant = {
  cardType: string;
  cardTitle: string;
  variation: string;
  label: string;
  extras?: Record<string, string>;
};

/**
 * Creates a flattened list of example card variants from the configured
 * card groups. Each variant includes metadata and extras required to build
 * a preview card URL.
 * @param variationLabelMap - Optional mapping for variation labels.
 * @returns An array of ExampleCardVariant objects.
 * @source
 */
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
