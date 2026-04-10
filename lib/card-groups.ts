import { getCardVariations } from "@/lib/card-types";
import type { ColorValue } from "@/lib/types/card";
import { buildApiUrl, clampBorderRadius } from "@/lib/utils";

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
export type VariationDef =
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

type CardGroupDefinition = {
  cardType: string;
  cardTitle: string;
  variationOrder?: readonly string[];
  extrasByVariation?: Partial<Record<string, Record<string, string>>>;
};

type CardGroupDefinitionEntry = readonly [
  cardType: CardGroupDefinition["cardType"],
  cardTitle: CardGroupDefinition["cardTitle"],
  options?: Pick<CardGroupDefinition, "variationOrder" | "extrasByVariation">,
];

const DEFAULT_STATS_VARIATION_ORDER = [
  "vertical",
  "default",
  "compact",
  "minimal",
] as const;

const STATUS_COLOR_VARIATION_EXTRAS = {
  pie: { statusColors: "true" },
  bar: { statusColors: "true" },
  donut: { statusColors: "true" },
} as const satisfies NonNullable<CardGroupDefinition["extrasByVariation"]>;

function createCardGroup(definition: CardGroupDefinition): CardGroup {
  const supportedVariationIds = getCardVariations(definition.cardType).map(
    (variation) => variation.id,
  );

  const orderedVariationIds = definition.variationOrder
    ? definition.variationOrder.filter((variationId, index, all) => {
        return (
          supportedVariationIds.includes(variationId) &&
          all.indexOf(variationId) === index
        );
      })
    : [];

  for (const supportedVariationId of supportedVariationIds) {
    if (orderedVariationIds.includes(supportedVariationId)) continue;
    orderedVariationIds.push(supportedVariationId);
  }

  return {
    cardType: definition.cardType,
    cardTitle: definition.cardTitle,
    variations: orderedVariationIds.map((variationId) => {
      const extras = definition.extrasByVariation?.[variationId];
      return extras ? { variation: variationId, extras } : variationId;
    }),
  };
}

/** All grouped card metadata used to render examples and UI lists. @source */
const CARD_GROUP_DEFINITIONS = [
  [
    "animeStats",
    "Anime Statistics",
    { variationOrder: DEFAULT_STATS_VARIATION_ORDER },
  ],
  [
    "mangaStats",
    "Manga Statistics",
    { variationOrder: DEFAULT_STATS_VARIATION_ORDER },
  ],
  ["socialStats", "Social Statistics"],
  ["socialMilestones", "Social Milestones"],
  ["animeGenres", "Anime Genres"],
  ["animeTags", "Anime Tags"],
  ["animeVoiceActors", "Voice Actors"],
  ["animeStudios", "Animation Studios"],
  ["studioCollaboration", "Studio Collaboration"],
  ["animeStaff", "Anime Staff"],
  [
    "animeStatusDistribution",
    "Anime Status Distribution",
    { extrasByVariation: STATUS_COLOR_VARIATION_EXTRAS },
  ],
  ["animeFormatDistribution", "Anime Format Distribution"],
  ["animeCountry", "Anime Country Distribution"],
  ["animeSourceMaterialDistribution", "Anime Source Material Distribution"],
  ["animeSeasonalPreference", "Anime Seasonal Preference"],
  ["animeScoreDistribution", "Anime Score Distribution"],
  ["animeYearDistribution", "Anime Year Distribution"],
  ["animeEpisodeLengthPreferences", "Episode Length Preferences"],
  ["animeGenreSynergy", "Genre Synergy"],
  ["mangaGenres", "Manga Genres"],
  ["mangaTags", "Manga Tags"],
  ["mangaStaff", "Manga Staff"],
  [
    "mangaStatusDistribution",
    "Manga Status Distribution",
    { extrasByVariation: STATUS_COLOR_VARIATION_EXTRAS },
  ],
  ["mangaFormatDistribution", "Manga Format Distribution"],
  ["mangaCountry", "Manga Country Distribution"],
  ["mangaScoreDistribution", "Manga Score Distribution"],
  ["mangaYearDistribution", "Manga Year Distribution"],
  ["profileOverview", "Profile Overview"],
  ["favoritesSummary", "Favourites Summary"],
  ["favoritesGrid", "Favourites Grid"],
  ["recentActivitySummary", "Recent Activity Summary"],
  ["activityStreaks", "Activity Streaks"],
  ["topActivityDays", "Top Activity Days"],
  ["statusCompletionOverview", "Status Completion Overview"],
  ["milestones", "Consumption Milestones"],
  ["personalRecords", "Personal Records"],
  ["planningBacklog", "Planning Backlog"],
  ["mostRewatched", "Most Rewatched/Reread"],
  ["currentlyWatchingReading", "Currently Watching / Reading"],
  ["animeMangaOverview", "Anime vs Manga Overview"],
  ["scoreCompareAnimeManga", "Anime vs Manga Score Comparison"],
  ["countryDiversity", "Country Diversity"],
  ["genreDiversity", "Genre Diversity"],
  ["formatPreferenceOverview", "Format Preference Overview"],
  ["releaseEraPreference", "Release Era Preference"],
  ["startYearMomentum", "Start-Year Momentum"],
  ["lengthPreference", "Length Preference"],
  ["tagCategoryDistribution", "Tag Category Distribution"],
  ["tagDiversity", "Tag Diversity"],
  ["seasonalViewingPatterns", "Seasonal Viewing Patterns"],
  ["droppedMedia", "Dropped Media"],
  ["reviewStats", "Review Statistics"],
] as const satisfies readonly CardGroupDefinitionEntry[];

export const CARD_GROUPS: CardGroup[] = CARD_GROUP_DEFINITIONS.map(
  ([cardType, cardTitle, options]) =>
    createCardGroup({
      cardType,
      cardTitle,
      ...(options ?? {}),
    }),
);

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
  username?: string;
  /** @deprecated Legacy alias for backward compatibility; prefer username. */
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

function computeShouldIncludeColors(opts: {
  includeColors: boolean;
  allowPresetColorOverrides: boolean;
  colorPreset: string | undefined;
}): boolean {
  const hasNamedPreset = !!opts.colorPreset && opts.colorPreset !== "custom";
  return (
    opts.includeColors && (opts.allowPresetColorOverrides || !hasNamedPreset)
  );
}

function addColorParamsIfIncluded(
  params: CardUrlParams,
  candidate: {
    titleColor?: ColorValue;
    backgroundColor?: ColorValue;
    textColor?: ColorValue;
    circleColor?: ColorValue;
  },
  shouldIncludeColors: boolean,
): void {
  if (!shouldIncludeColors) return;

  if (candidate.titleColor)
    params.titleColor = colorToString(candidate.titleColor);
  if (candidate.backgroundColor) {
    params.backgroundColor = colorToString(candidate.backgroundColor);
  }
  if (candidate.textColor)
    params.textColor = colorToString(candidate.textColor);
  if (candidate.circleColor)
    params.circleColor = colorToString(candidate.circleColor);
}

function addFavoritesGridDimsParamIfRelevant(
  params: CardUrlParams,
  baseCardType: string,
  candidate: { gridCols?: number; gridRows?: number },
): void {
  if (baseCardType !== "favoritesGrid") return;

  if (typeof candidate.gridCols === "number") {
    const n = Math.trunc(candidate.gridCols);
    params.gridCols = Math.max(1, Math.min(5, n));
  }
  if (typeof candidate.gridRows === "number") {
    const n = Math.trunc(candidate.gridRows);
    params.gridRows = Math.max(1, Math.min(5, n));
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
    username?: string;
    /** Legacy alias for backward compatibility; prefer username. */
    userName?: string;
    includeColors?: boolean;
    defaultToCustomPreset?: boolean;
    allowPresetColorOverrides?: boolean;
  },
): CardUrlParams {
  const cardType = candidate.cardName || candidate.cardType || "";
  const baseCardType = (cardType || "").split("-")[0] || "";
  const rawVariation = candidate.variation || "default";
  const variation =
    baseCardType === "profileOverview" ? "default" : rawVariation;
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
      ? clampBorderRadius(candidate.borderRadius)
      : undefined;
  const borderRadius = borderColor ? borderRadiusCandidate : undefined;

  const params: CardUrlParams = {
    cardType,
    userId: opts?.userId,
    username: opts?.username,
    variation,
    colorPreset,
    borderColor,
    borderRadius,
  };

  if (!params.username && typeof opts?.["userName"] === "string") {
    params.username = opts["userName"];
  }

  const shouldIncludeColors = computeShouldIncludeColors({
    includeColors,
    allowPresetColorOverrides,
    colorPreset,
  });

  addColorParamsIfIncluded(params, candidate, shouldIncludeColors);

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

  addFavoritesGridDimsParamIfRelevant(params, baseCardType, candidate);

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
  const legacyUsername = Reflect.get(params, "userName");
  const resolvedUsername =
    params.username ||
    (typeof legacyUsername === "string" ? legacyUsername : undefined);

  setParamIfDefined(searchParams, "userId", params.userId);
  setParamIfDefined(searchParams, "username", resolvedUsername);

  searchParams.set("cardType", params.cardType);

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

  setParamIfDefined(searchParams, "borderColor", params.borderColor);
  if (typeof params.borderRadius === "number") {
    searchParams.set("borderRadius", String(params.borderRadius));
  }

  setBooleanParam(searchParams, "showFavorites", params.showFavorites);
  setBooleanParam(searchParams, "statusColors", params.statusColors);
  setBooleanParam(searchParams, "piePercentages", params.piePercentages);

  setNumberParam(searchParams, "gridCols", params.gridCols);
  setNumberParam(searchParams, "gridRows", params.gridRows);

  return `${baseUrl}?${searchParams.toString()}`;
}
