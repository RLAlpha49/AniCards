import { buildApiUrl } from "@/lib/utils";
import type { ColorValue } from "@/lib/types/card";

/** Default card generation endpoint used for example previews. @source */
export const DEFAULT_BASE_CARD_URL = buildApiUrl("/card.svg");
/** Default example user id used for generating demo card previews. @source */
export const DEFAULT_EXAMPLE_USER_ID = "542244";

/**
 * Converts a color value to string format for URL parameters.
 * Gradients are serialized as JSON strings.
 * @source
 */
function colorToString(color: ColorValue | undefined): string | undefined {
  if (color === undefined) return undefined;
  return typeof color === "string" ? color : JSON.stringify(color);
}

/** Human-friendly labels for card variations used in the UI. @source */
export const VARIATION_LABEL_MAP: Record<string, string> = {
  default: "Default",
  vertical: "Vertical",
  compact: "Compact",
  minimal: "Minimal",
  badges: "Badges",
  pie: "Pie Chart",
  donut: "Donut Chart",
  bar: "Bar Chart",
  radar: "Radar Chart",
  horizontal: "Horizontal",
  cumulative: "Cumulative",
  anime: "Anime",
  manga: "Manga",
  characters: "Characters",
  staff: "Staff",
  studios: "Studios",
  mixed: "Mixed",
  github: "GitHub",
  fire: "Fire",
  combined: "Combined",
  split: "Split",
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
    variations: ["default", "compact", "minimal", "badges"],
  },
  {
    cardType: "socialMilestones",
    cardTitle: "Social Milestones",
    variations: ["default"],
  },
  {
    cardType: "animeGenres",
    cardTitle: "Anime Genres",
    variations: ["default", "pie", "donut", "bar", "radar"],
  },
  {
    cardType: "animeTags",
    cardTitle: "Anime Tags",
    variations: ["default", "pie", "donut", "bar", "radar"],
  },
  {
    cardType: "animeVoiceActors",
    cardTitle: "Voice Actors",
    variations: ["default", "pie", "donut", "bar"],
  },
  {
    cardType: "animeStudios",
    cardTitle: "Animation Studios",
    variations: ["default", "pie", "donut", "bar"],
  },
  {
    cardType: "animeStaff",
    cardTitle: "Anime Staff",
    variations: ["default", "pie", "donut", "bar"],
  },
  {
    cardType: "animeStatusDistribution",
    cardTitle: "Anime Status Distribution",
    variations: [
      "default",
      { variation: "pie", extras: { statusColors: "true" } },
      { variation: "bar", extras: { statusColors: "true" } },
      { variation: "donut", extras: { statusColors: "true" } },
    ],
  },
  {
    cardType: "animeFormatDistribution",
    cardTitle: "Anime Format Distribution",
    variations: ["default", "pie", "donut", "bar"],
  },
  {
    cardType: "animeCountry",
    cardTitle: "Anime Country Distribution",
    variations: ["default", "pie", "donut", "bar"],
  },
  {
    cardType: "animeSourceMaterialDistribution",
    cardTitle: "Anime Source Material Distribution",
    variations: ["default", "pie", "donut", "bar"],
  },
  {
    cardType: "animeSeasonalPreference",
    cardTitle: "Anime Seasonal Preference",
    variations: ["default", "pie", "donut", "bar", "radar"],
  },
  {
    cardType: "animeScoreDistribution",
    cardTitle: "Anime Score Distribution",
    variations: ["default", "horizontal", "cumulative"],
  },
  {
    cardType: "animeYearDistribution",
    cardTitle: "Anime Year Distribution",
    variations: ["default", "horizontal"],
  },
  {
    cardType: "animeEpisodeLengthPreferences",
    cardTitle: "Episode Length Preferences",
    variations: ["default", "pie", "donut", "bar"],
  },
  {
    cardType: "animeGenreSynergy",
    cardTitle: "Genre Synergy",
    variations: ["default"],
  },
  {
    cardType: "mangaGenres",
    cardTitle: "Manga Genres",
    variations: ["default", "pie", "donut", "bar", "radar"],
  },
  {
    cardType: "mangaTags",
    cardTitle: "Manga Tags",
    variations: ["default", "pie", "donut", "bar", "radar"],
  },
  {
    cardType: "mangaStaff",
    cardTitle: "Manga Staff",
    variations: ["default", "pie", "donut", "bar"],
  },
  {
    cardType: "mangaStatusDistribution",
    cardTitle: "Manga Status Distribution",
    variations: [
      "default",
      { variation: "pie", extras: { statusColors: "true" } },
      { variation: "bar", extras: { statusColors: "true" } },
      { variation: "donut", extras: { statusColors: "true" } },
    ],
  },
  {
    cardType: "mangaFormatDistribution",
    cardTitle: "Manga Format Distribution",
    variations: ["default", "pie", "donut", "bar"],
  },
  {
    cardType: "mangaCountry",
    cardTitle: "Manga Country Distribution",
    variations: ["default", "pie", "donut", "bar"],
  },
  {
    cardType: "mangaScoreDistribution",
    cardTitle: "Manga Score Distribution",
    variations: ["default", "horizontal", "cumulative"],
  },
  {
    cardType: "mangaYearDistribution",
    cardTitle: "Manga Year Distribution",
    variations: ["default", "horizontal"],
  },
  {
    cardType: "profileOverview",
    cardTitle: "Profile Overview",
    variations: ["default"],
  },
  {
    cardType: "favoritesSummary",
    cardTitle: "Favourites Summary",
    variations: ["default"],
  },
  {
    cardType: "favoritesGrid",
    cardTitle: "Favourites Grid",
    variations: ["anime", "manga", "characters", "staff", "studios", "mixed"],
  },
  {
    cardType: "activityHeatmap",
    cardTitle: "Activity Heatmap",
    variations: ["default", "github", "fire"],
  },
  {
    cardType: "recentActivitySummary",
    cardTitle: "Recent Activity Summary",
    variations: ["default"],
  },
  {
    cardType: "recentActivityFeed",
    cardTitle: "Recent Activity Feed",
    variations: ["default"],
  },
  {
    cardType: "activityStreaks",
    cardTitle: "Activity Streaks",
    variations: ["default"],
  },
  {
    cardType: "topActivityDays",
    cardTitle: "Top Activity Days",
    variations: ["default"],
  },
  {
    cardType: "statusCompletionOverview",
    cardTitle: "Status Completion Overview",
    variations: ["combined", "split"],
  },
  {
    cardType: "milestones",
    cardTitle: "Consumption Milestones",
    variations: ["default"],
  },
  {
    cardType: "personalRecords",
    cardTitle: "Personal Records",
    variations: ["default"],
  },
  {
    cardType: "planningBacklog",
    cardTitle: "Planning Backlog",
    variations: ["default"],
  },
  {
    cardType: "mostRewatched",
    cardTitle: "Most Rewatched/Reread",
    variations: ["default", "anime", "manga"],
  },
  {
    cardType: "currentlyWatchingReading",
    cardTitle: "Currently Watching / Reading",
    variations: ["default", "anime", "manga"],
  },
  {
    cardType: "animeMangaOverview",
    cardTitle: "Anime vs Manga Overview",
    variations: ["default"],
  },
  {
    cardType: "scoreCompareAnimeManga",
    cardTitle: "Anime vs Manga Score Comparison",
    variations: ["default"],
  },
  {
    cardType: "countryDiversity",
    cardTitle: "Country Diversity",
    variations: ["default"],
  },
  {
    cardType: "genreDiversity",
    cardTitle: "Genre Diversity",
    variations: ["default"],
  },
  {
    cardType: "formatPreferenceOverview",
    cardTitle: "Format Preference Overview",
    variations: ["default"],
  },
  {
    cardType: "releaseEraPreference",
    cardTitle: "Release Era Preference",
    variations: ["default"],
  },
  {
    cardType: "startYearMomentum",
    cardTitle: "Start-Year Momentum",
    variations: ["default"],
  },
  {
    cardType: "lengthPreference",
    cardTitle: "Length Preference",
    variations: ["default"],
  },
  {
    cardType: "tagCategoryDistribution",
    cardTitle: "Tag Category Distribution",
    variations: ["default"],
  },
  {
    cardType: "tagDiversity",
    cardTitle: "Tag Diversity",
    variations: ["default"],
  },
  {
    cardType: "seasonalViewingPatterns",
    cardTitle: "Seasonal Viewing Patterns",
    variations: ["default"],
  },
  {
    cardType: "droppedMedia",
    cardTitle: "Dropped Media",
    variations: ["default"],
  },
  {
    cardType: "reviewStats",
    cardTitle: "Review Statistics",
    variations: ["default"],
  },
  {
    cardType: "studioCollaboration",
    cardTitle: "Studio Collaboration",
    variations: ["default"],
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
  /** Favorites grid columns (1-5) */
  gridCols?: number;
  /** Favorites grid rows (1-5) */
  gridRows?: number;
}

/**
 * Resolves the effective color preset for URL parameters.
 * Returns "custom" if no preset is provided and defaultToCustom is true,
 * otherwise returns the provided preset.
 */
function resolveColorPreset(
  candidatePreset: string | undefined,
  defaultToCustom: boolean,
): string | undefined {
  if (candidatePreset) return candidatePreset;
  if (defaultToCustom) return "custom";
  return undefined;
}

/**
 * Adds conditional parameters for favorite-capable card types.
 */
function addFavoritesParamIfRelevant(
  params: CardUrlParams,
  baseCardType: string,
  showFavorites: boolean | undefined,
): void {
  const favoritesRelevant = [
    "animeVoiceActors",
    "animeStudios",
    "animeStaff",
    "mangaStaff",
  ].includes(baseCardType);
  // Always include showFavorites for relevant card types
  // Default to false if not explicitly set, to avoid DB lookup
  if (favoritesRelevant) {
    params.showFavorites =
      typeof showFavorites === "boolean" ? showFavorites : false;
  }
}

/**
 * Adds conditional parameters for status distribution card types.
 */
function addStatusColorsParamIfRelevant(
  params: CardUrlParams,
  baseCardType: string,
  useStatusColors: boolean | undefined,
): void {
  const statusRelevant = [
    "animeStatusDistribution",
    "mangaStatusDistribution",
  ].includes(baseCardType);
  // Always include statusColors for status distribution cards
  // Default to false if not explicitly set, to avoid DB lookup
  if (statusRelevant) {
    params.statusColors =
      typeof useStatusColors === "boolean" ? useStatusColors : false;
  }
}

/**
 * Adds piePercentages parameter for pie variation cards.
 */
function addPiePercentagesParamIfRelevant(
  params: CardUrlParams,
  variation: string,
  showPiePercentages: boolean | undefined,
): void {
  // Pie-like chart percentages only matter in pie/donut variations.
  if (variation === "pie" || variation === "donut") {
    params.piePercentages =
      typeof showPiePercentages === "boolean" ? showPiePercentages : false;
  }
}

export function mapStoredConfigToCardUrlParams(
  candidate: Partial<
    Omit<
      import("@/lib/types/records").StoredCardConfig,
      "titleColor" | "backgroundColor" | "textColor" | "circleColor"
    > & {
      cardName?: string;
      cardType?: string;
      titleColor?: ColorValue;
      backgroundColor?: ColorValue;
      textColor?: ColorValue;
      circleColor?: ColorValue;
    }
  >,
  opts?: {
    userId?: string;
    userName?: string;
    includeColors?: boolean;
    defaultToCustomPreset?: boolean;
    allowPresetColorOverrides?: boolean;
  },
): CardUrlParams {
  const cardType = candidate.cardName || candidate.cardType || "";
  const variation = candidate.variation || "default";
  const baseCardType = (cardType || "").split("-")[0] || "";
  const includeColors = !!opts?.includeColors;
  const defaultToCustom = opts?.defaultToCustomPreset !== false;
  const allowPresetColorOverrides = opts?.allowPresetColorOverrides !== false;

  const colorPreset = resolveColorPreset(
    candidate.colorPreset,
    defaultToCustom,
  );

  const borderColor = candidate.borderColor;
  const borderRadiusCandidate =
    typeof candidate.borderRadius === "number"
      ? candidate.borderRadius
      : undefined;
  const borderRadius = borderColor ? borderRadiusCandidate : undefined;

  const params: CardUrlParams = {
    cardType,
    userId: opts?.userId,
    userName: opts?.userName,
    variation,
    colorPreset,
    borderColor,
    borderRadius,
  };

  const hasNamedPreset = !!colorPreset && colorPreset !== "custom";
  const shouldIncludeColors =
    includeColors && (allowPresetColorOverrides || !hasNamedPreset);

  if (shouldIncludeColors) {
    if (candidate.titleColor)
      params.titleColor = colorToString(candidate.titleColor);
    if (candidate.backgroundColor)
      params.backgroundColor = colorToString(candidate.backgroundColor);
    if (candidate.textColor)
      params.textColor = colorToString(candidate.textColor);
    if (candidate.circleColor)
      params.circleColor = colorToString(candidate.circleColor);
  }

  addFavoritesParamIfRelevant(params, baseCardType, candidate.showFavorites);
  addStatusColorsParamIfRelevant(
    params,
    baseCardType,
    candidate.useStatusColors,
  );
  addPiePercentagesParamIfRelevant(
    params,
    variation,
    candidate.showPiePercentages,
  );

  if (typeof candidate.gridCols === "number") {
    const n = Math.trunc(candidate.gridCols);
    params.gridCols = Math.max(1, Math.min(5, n));
  }
  if (typeof candidate.gridRows === "number") {
    const n = Math.trunc(candidate.gridRows);
    params.gridRows = Math.max(1, Math.min(5, n));
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
 * Helper to set a numeric search param if the value is a finite number.
 * @source
 */
function setNumberParam(
  searchParams: URLSearchParams,
  key: string,
  value: number | undefined,
): void {
  if (typeof value === "number" && Number.isFinite(value)) {
    searchParams.set(key, String(value));
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

  // Favorites grid layout (optional)
  setNumberParam(searchParams, "gridCols", params.gridCols);
  setNumberParam(searchParams, "gridRows", params.gridRows);

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
