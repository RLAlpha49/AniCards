import { buildApiUrl } from "@/lib/utils";
import { colorPresets } from "@/lib/card-catalogue";
import type { CardId, VariationDef } from "@/lib/cards/registry";
import { CARD_REGISTRY } from "@/lib/cards/registry";

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
 * A group of related cards represented in the UI such as genres, tags and
 * statistics card groups. Derived from the card registry.
 * @source
 */
export type CardGroup = {
  cardType: CardId;
  cardTitle: string;
  variations: VariationDef[];
};

/** All grouped card metadata used to render examples and UI lists. @source */
export const CARD_GROUPS: CardGroup[] = CARD_REGISTRY.map((card) => ({
  cardType: card.id,
  cardTitle: card.title,
  variations: [...card.variations],
}));
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
  /** Color preset name or "custom" for stored colors */
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

/** Use the shortest equivalent representation for a complete custom palette. */
function shortenColorParams(params: CardUrlParams): void {
  if (
    params.colorPreset ||
    !params.titleColor ||
    !params.backgroundColor ||
    !params.textColor ||
    !params.circleColor
  )
    return;

  const keys = [
    "titleColor",
    "backgroundColor",
    "textColor",
    "circleColor",
  ] as const;
  const originalColors = keys.map((key) => params[key]!);
  let shortest = new URLSearchParams(
    keys.map((key, index) => [key, originalColors[index]]),
  ).toString().length;

  for (const [name, preset] of Object.entries(colorPresets)) {
    if (name === "custom" || preset.colors.length < 4) continue;
    const overrides = keys.flatMap((key, index) => {
      const color = preset.colors[index];
      const serialized =
        typeof color === "string" ? color : JSON.stringify(color);
      return serialized === originalColors[index]
        ? []
        : [[key, originalColors[index]]];
    });
    const length = new URLSearchParams([
      ["colorPreset", name],
      ...overrides,
    ]).toString().length;
    if (length >= shortest) continue;
    shortest = length;
    params.colorPreset = name;
    for (const key of keys) delete params[key];
    for (const [key, value] of overrides) {
      params[key as (typeof keys)[number]] = value;
    }
  }
}

/**
 * Resolves the preset to send for a stored config.
 *
 * A stored `custom` preset names no colors, so a caller that also sends the
 * colors drops the preset and lets the URL carry them instead.
 *
 * @param candidate - Stored config being mapped.
 * @param includeColors - Whether the colors are being sent too.
 * @param defaultToCustom - Whether an absent preset becomes `custom`.
 * @returns The preset name, or undefined when none is needed.
 * @source
 */
function resolveMappedColorPreset(
  candidate: {
    colorPreset?: string;
    titleColor?: string;
    backgroundColor?: string;
    textColor?: string;
    circleColor?: string;
  },
  includeColors: boolean,
  defaultToCustom: boolean,
): string | undefined {
  const colorPreset = resolveColorPreset(
    candidate.colorPreset,
    defaultToCustom,
  );
  const hasAllColors =
    candidate.titleColor &&
    candidate.backgroundColor &&
    candidate.textColor &&
    candidate.circleColor;
  if (colorPreset === "custom" && includeColors && hasAllColors) {
    return undefined;
  }
  return colorPreset;
}

/**
 * Copies the stored colors onto the params and shortens them.
 *
 * @param params - Params to write into.
 * @param candidate - Stored config holding the colors.
 * @source
 */
function applyStoredColors(
  params: CardUrlParams,
  candidate: {
    titleColor?: string;
    backgroundColor?: string;
    textColor?: string;
    circleColor?: string;
  },
): void {
  if (candidate.titleColor) params.titleColor = candidate.titleColor;
  if (candidate.backgroundColor)
    params.backgroundColor = candidate.backgroundColor;
  if (candidate.textColor) params.textColor = candidate.textColor;
  if (candidate.circleColor) params.circleColor = candidate.circleColor;

  shortenColorParams(params);
}

/**
 * Writes the favorites grid size, clamped to the range the renderer accepts.
 *
 * @param params - Params to write into.
 * @param candidate - Stored config holding the requested size.
 * @source
 */
function applyGridSize(
  params: CardUrlParams,
  candidate: { gridCols?: number; gridRows?: number },
): void {
  const clamp = (value: number | undefined): number =>
    Math.max(1, Math.min(5, Math.trunc(Number.isFinite(value) ? value! : 3)));
  params.gridCols = clamp(candidate.gridCols);
  params.gridRows = clamp(candidate.gridRows);
}

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

  const params: CardUrlParams = {
    cardType,
    userId: opts?.userId,
    userName: opts?.userName,
    variation,
    colorPreset: resolveMappedColorPreset(
      candidate,
      includeColors,
      defaultToCustom,
    ),
    borderColor: candidate.borderColor,
    borderRadius:
      typeof candidate.borderRadius === "number"
        ? candidate.borderRadius
        : undefined,
  };

  if (includeColors) applyStoredColors(params, candidate);

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

  if (baseCardType === "favoritesGrid") applyGridSize(params, candidate);

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

  // Custom presets use stored colors; named presets can be rendered from the URL.
  setParamIfDefined(searchParams, "colorPreset", params.colorPreset);

  // Individual colors override named presets on self-contained URLs.
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
