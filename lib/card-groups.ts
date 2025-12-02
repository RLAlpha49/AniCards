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
 * Parameters for building a card URL with all configuration options.
 * @source
 */
export interface CardUrlParams {
  /** Card type identifier */
  cardType: string;
  /** User ID (numeric) */
  userId?: string;
  /** Username (alternative to userId) */
  userName?: string;
  /** Variation name (default, vertical, pie, etc.) */
  variation?: string;
  /** Color preset name or "custom" for database-stored custom colors */
  colorPreset?: string;
  /** Title color (hex string) */
  titleColor?: string;
  /** Background color (hex string) */
  backgroundColor?: string;
  /** Text color (hex string) */
  textColor?: string;
  /** Circle/accent color (hex string) */
  circleColor?: string;
  /** Border color (hex string, optional) */
  borderColor?: string;
  /** Border radius (0-100) */
  borderRadius?: number;
  /** Show favorites indicator */
  showFavorites?: boolean;
  /** Use status colors for status distribution cards */
  statusColors?: boolean;
  /** Show percentages on pie charts */
  piePercentages?: boolean;
}

/**
 * Map a stored card configuration (StoredCardConfig) or a partial candidate
 * into CardUrlParams for URL building. This keeps client-side URL generation
 * consistent with the server-side processing in lib/card-data.ts which expects
 * specific query parameter names and semantics.
 *
 * Options:
 * - userId/userName: identity used for the URL
 * - includeColors: include individual color params (title/background/text/circle)
 * - defaultToCustomPreset: when no colorPreset is present, include "custom" to
 *   instruct the server to use DB stored colors. Default: true.
 *
 * IMPORTANT: This helper centralizes the mapping rules used by the client-side
 * URL generator. When adding new features (flags, colors, or layout options),
 * add the flag here and also update server-side functions in
 * lib/card-data.ts: needsCardConfigFromDb() and buildCardConfigFromParams()
 * so that round-tripping between stored configuration and URL-driven
 * configuration preserves rendering behavior.
 */
export function mapStoredConfigToCardUrlParams(
  candidate: Partial<
    import("@/lib/types/records").StoredCardConfig & {
      cardName?: string;
      cardType?: string;
    }
  >,
  opts?: {
    userId?: string;
    userName?: string;
    includeColors?: boolean;
    defaultToCustomPreset?: boolean;
  },
): CardUrlParams {
  const cardType = candidate.cardName || candidate.cardType || "";
  const variation = candidate.variation || "default";
  const baseCardType = (cardType || "").split("-")[0] || "";
  const includeColors = !!opts?.includeColors;
  const defaultToCustom = opts?.defaultToCustomPreset !== false;

  // Resolve effective preset - if none present and defaultToCustom is true,
  // use "custom" so the server will read DB colors.
  let colorPreset: string | undefined;
  if (candidate.colorPreset) {
    colorPreset = candidate.colorPreset;
  } else if (defaultToCustom) {
    colorPreset = "custom";
  } else {
    colorPreset = undefined;
  }

  const params: CardUrlParams = {
    cardType,
    userId: opts?.userId,
    userName: opts?.userName,
    variation,
    colorPreset,
    borderColor: candidate.borderColor,
    borderRadius:
      typeof candidate.borderRadius === "number"
        ? candidate.borderRadius
        : undefined,
  };

  if (includeColors) {
    if (candidate.titleColor) params.titleColor = candidate.titleColor;
    if (candidate.backgroundColor)
      params.backgroundColor = candidate.backgroundColor;
    if (candidate.textColor) params.textColor = candidate.textColor;
    if (candidate.circleColor) params.circleColor = candidate.circleColor;
  }

  const favoritesRelevant = [
    "animeVoiceActors",
    "animeStudios",
    "animeStaff",
    "mangaStaff",
  ].includes(baseCardType);
  if (favoritesRelevant && typeof candidate.showFavorites === "boolean") {
    params.showFavorites = candidate.showFavorites;
  }

  const statusRelevant = [
    "animeStatusDistribution",
    "mangaStatusDistribution",
  ].includes(baseCardType);
  if (statusRelevant && typeof candidate.useStatusColors === "boolean") {
    params.statusColors = candidate.useStatusColors;
  }

  if (
    variation === "pie" &&
    typeof candidate.showPiePercentages === "boolean"
  ) {
    params.piePercentages = candidate.showPiePercentages;
  }

  return params;
}

/**
 * Helper to set a search param if the value is defined.
 * @source
 */
function setParamIfDefined(
  searchParams: URLSearchParams,
  key: string,
  value: string | undefined,
): void {
  if (value !== undefined && value !== "") {
    searchParams.set(key, value);
  }
}

/**
 * Helper to set a boolean search param if true.
 * @source
 */
function setBooleanParam(
  searchParams: URLSearchParams,
  key: string,
  value: boolean | undefined,
): void {
  if (typeof value === "boolean") {
    searchParams.set(key, value ? "true" : "false");
  }
}

/**
 * Constructs a URL to the card SVG endpoint with all configuration parameters.
 * Includes all provided params in the URL to avoid database lookups when possible.
 *
 * @param params - Configuration parameters for the card URL.
 * @param baseUrl - The base API endpoint to use (defaults to DEFAULT_BASE_CARD_URL).
 * @returns The constructed card URL with all parameters.
 * @source
 */
export function buildCardUrlWithParams(
  params: CardUrlParams,
  baseUrl = DEFAULT_BASE_CARD_URL,
): string {
  const searchParams = new URLSearchParams();

  // User identification (at least one required) - userId first for consistency
  setParamIfDefined(searchParams, "userId", params.userId);
  setParamIfDefined(searchParams, "userName", params.userName);

  // Required params
  searchParams.set("cardType", params.cardType);

  // Variation
  setParamIfDefined(searchParams, "variation", params.variation);

  // Color preset (if set, instructs the server to use the named preset; if
  // "custom", the server will load saved DB colors and ignore any URL color
  // params). Individual color params are always included when present; the
  // server enforces their precedence (URL colors override presets unless the
  // effective preset is 'custom').
  setParamIfDefined(searchParams, "colorPreset", params.colorPreset);

  // Individual colors - always include any color params provided by the
  // caller. Server-side color resolution implements the precedence: if
  // the effective preset is "custom", the server ignores URL color
  // params, otherwise URL individual colors override preset colors.
  setParamIfDefined(searchParams, "titleColor", params.titleColor);
  setParamIfDefined(searchParams, "backgroundColor", params.backgroundColor);
  setParamIfDefined(searchParams, "textColor", params.textColor);
  setParamIfDefined(searchParams, "circleColor", params.circleColor);

  // Border settings
  setParamIfDefined(searchParams, "borderColor", params.borderColor);
  if (typeof params.borderRadius === "number") {
    searchParams.set("borderRadius", String(params.borderRadius));
  }

  // Boolean flags
  setBooleanParam(searchParams, "showFavorites", params.showFavorites);
  setBooleanParam(searchParams, "statusColors", params.statusColors);
  setBooleanParam(searchParams, "piePercentages", params.piePercentages);

  return `${baseUrl}?${searchParams.toString()}`;
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
