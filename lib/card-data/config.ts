import { clampBorderRadius } from "@/lib/utils";
import { colorPresets } from "@/components/stat-card-generator/constants";
import { StoredCardConfig, CardsRecord, UserRecord } from "@/lib/types/records";
import { ColorValue } from "@/lib/types/card";
import { CardDataError, getFavoritesForCardType } from "./validation";

/**
 * Determines if we need to fetch card config from DB or can build from URL params.
 * Returns true if colorPreset is "custom" (needs DB for gradient colors) or missing
 * @source
 */
export function needsCardConfigFromDb(params: {
  colorPresetParam: string | null;
  titleColorParam?: string | null;
  backgroundColorParam?: string | null;
  textColorParam?: string | null;
  circleColorParam?: string | null;
  borderColorParam?: string | null;
  borderRadiusParam?: string | null;
  showFavoritesParam?: string | null;
  statusColorsParam?: string | null;
  piePercentagesParam?: string | null;
  baseCardType?: string;
  variationParam?: string | null;
  gridColsParam?: string | null;
  gridRowsParam?: string | null;
}): boolean {
  if (params.colorPresetParam === "custom") {
    return true;
  }
  // Determine whether the URL provides enough information to build
  // a complete card config without consulting the DB.
  // Color resolution is satisfied when either:
  //  - a named preset (non-custom) is present in the URL, or
  //  - every individual color param is provided in the URL.
  const hasNamedPreset = !!params.colorPresetParam;
  const hasIndividualColors =
    !!params.titleColorParam &&
    !!params.backgroundColorParam &&
    !!params.textColorParam &&
    !!params.circleColorParam;

  const colorsResolved = hasNamedPreset || hasIndividualColors;
  if (!colorsResolved) return true;

  // For booleans and other presentation flags that are stored in the DB,
  // we only skip the DB fetch when the URL explicitly specifies the override.
  // Note: The API accepts "true"/"false" in the query string to make the
  // explicit override possible; absence of a param means we should consult DB.
  // Only check flags relevant to the base card type / variation.
  const baseType = params.baseCardType ?? "";
  const variation = params.variationParam ?? undefined;

  // Favorites flag is relevant only for certain card types
  const favoritesRelevant = [
    "animeVoiceActors",
    "animeStudios",
    "animeStaff",
    "mangaStaff",
  ].includes(baseType);
  if (favoritesRelevant && params.showFavoritesParam == null) return true;

  // Status color preference is only meaningful for status distribution cards
  const statusRelevant = [
    "animeStatusDistribution",
    "mangaStatusDistribution",
  ].includes(baseType);
  if (statusRelevant && params.statusColorsParam == null) return true;

  // Pie chart percentages only matter in pie variations
  const pieRelevant = variation === "pie";
  if (pieRelevant && params.piePercentagesParam == null) return true;

  // Favorites grid layout is only meaningful for the favoritesGrid card.
  const favoritesGridRelevant = baseType === "favoritesGrid";
  if (
    favoritesGridRelevant &&
    (params.gridColsParam == null || params.gridRowsParam == null)
  ) {
    return true;
  }

  // If we reached here, the URL includes enough params to build a complete
  // card configuration without needing the database.
  return false;
}

/**
 * Converts a color value to string format for config storage.
 * @source
 */
function colorToString(color: ColorValue): string {
  return typeof color === "string" ? color : JSON.stringify(color);
}

/**
 * Applies preset colors to a card config.
 * @source
 */
function applyPresetColorsToConfig(
  config: StoredCardConfig,
  presetColors: ColorValue[],
): void {
  config.titleColor = colorToString(presetColors[0]);
  config.backgroundColor = colorToString(presetColors[1]);
  config.textColor = colorToString(presetColors[2]);
  config.circleColor = colorToString(presetColors[3]);
}

/**
 * Applies individual URL color params to config.
 * @source
 */
function applyUrlColorParams(
  config: StoredCardConfig,
  params: {
    titleColorParam?: string | null;
    backgroundColorParam?: string | null;
    textColorParam?: string | null;
    circleColorParam?: string | null;
  },
): void {
  if (params.titleColorParam) config.titleColor = params.titleColorParam;
  if (params.backgroundColorParam)
    config.backgroundColor = params.backgroundColorParam;
  if (params.textColorParam) config.textColor = params.textColorParam;
  if (params.circleColorParam) config.circleColor = params.circleColorParam;
}

/**
 * Type used by applyColorOverrides to represent URL color overrides.
 * Exported so other modules can adopt the same contract when building
 * card URLs or interpreting query parameters.
 */
export type ColorOverrideParams = {
  colorPresetParam?: string | null;
  titleColorParam?: string | null;
  backgroundColorParam?: string | null;
  textColorParam?: string | null;
  circleColorParam?: string | null;
};

/**
 * Compute the effective preset name given an optional URL param and a stored
 * config. URL param has precedence over stored preset.
 */
export function resolveEffectiveColorPreset(
  colorPresetParam?: string | null,
  storedColorPreset?: string | undefined,
): string | undefined {
  return colorPresetParam ?? storedColorPreset ?? undefined;
}

/**
 * Returns true when an effective preset indicates that the server should not
 * apply any URL color overrides - this is used for "custom" preset behavior.
 */
export function isCustomPreset(effectivePreset?: string | undefined): boolean {
  return effectivePreset === "custom";
}

/**
 * Applies color parameters from URL to the card config.
 *
 * Color resolution priority (server-side):
 *  1. If the URL `colorPreset` equals "custom", the server uses database
 *     stored colors (this supports gradients and explicitly ignores any
 *     individual URL color params).
 *  2. Otherwise, if a named `colorPreset` is present in the URL, apply the
 *     named preset colors.
 *  3. If there's no URL preset but the stored config includes a `colorPreset`,
 *     apply that stored preset.
 *  4. After applying a preset (URL or DB), any individual URL color params
 *     (titleColor, backgroundColor, textColor, circleColor) override the
 *     corresponding preset colors.
 *  5. If none of the above apply, colors persist from the stored DB values.
 *
 * @source
 */
function applyColorOverrides(
  config: StoredCardConfig,
  params: ColorOverrideParams,
): void {
  // Determine which preset to use (URL takes precedence over stored)
  const effectivePreset = resolveEffectiveColorPreset(
    params.colorPresetParam,
    config.colorPreset,
  );

  // If colorPreset is "custom", keep database colors (supports gradients)
  if (isCustomPreset(effectivePreset)) {
    return;
  }

  // If a named preset is provided (from URL or database), look up and apply preset colors
  if (effectivePreset) {
    const presetColors = getPresetColors(effectivePreset);
    if (presetColors) {
      applyPresetColorsToConfig(config, presetColors);
      // After applying preset, check if any individual color params override
      applyUrlColorParams(config, params);
      return;
    }
    console.warn(`[Card Data] Unknown color preset: ${effectivePreset}`);
  }

  // Apply URL color params if provided (these override database values)
  applyUrlColorParams(config, params);
}

/**
 * Look up preset colors by name.
 * @returns Array of [titleColor, backgroundColor, textColor, circleColor] or null if not found.
 * @source
 */
function getPresetColors(presetName: string): ColorValue[] | null {
  const preset = colorPresets[presetName];
  if (!preset || !Array.isArray(preset.colors) || preset.colors.length < 4) {
    return null;
  }
  // Return all 4 colors (may include gradient objects)
  return preset.colors.slice(0, 4);
}

/**
 * Applies border parameters from URL to the card config.
 * @source
 */
function applyBorderOverrides(
  config: StoredCardConfig,
  params: {
    borderColorParam?: string | null;
    borderRadiusParam?: string | null;
  },
): void {
  if (
    params.borderColorParam !== null &&
    params.borderColorParam !== undefined
  ) {
    config.borderColor = params.borderColorParam || undefined;
  }
  if (
    params.borderRadiusParam !== null &&
    params.borderRadiusParam !== undefined
  ) {
    const parsedRadius = Number.parseInt(params.borderRadiusParam);
    if (!Number.isNaN(parsedRadius)) {
      config.borderRadius = clampBorderRadius(parsedRadius);
    }
  }
}

/**
 * Applies boolean-style overrides (true/false flags) present in URL params
 * to the StoredCardConfig instance during build-from-params flow.
 */
function applyBooleanOverridesForBuild(
  config: StoredCardConfig,
  params: {
    baseCardType: string;
    variationParam: string | null;
    showFavoritesParam: string | null;
    statusColorsParam: string | null;
    piePercentagesParam: string | null;
  },
): void {
  if (params.showFavoritesParam === "true") config.showFavorites = true;
  if (params.showFavoritesParam === "false") config.showFavorites = false;

  const statusRelevant = [
    "animeStatusDistribution",
    "mangaStatusDistribution",
  ].includes(params.baseCardType);
  if (statusRelevant) {
    if (params.statusColorsParam === "true") {
      config.useStatusColors = true;
    } else if (params.statusColorsParam === "false") {
      config.useStatusColors = false;
    } else {
      config.useStatusColors ??= false;
    }
  }

  if (params.piePercentagesParam === "true" && config.variation === "pie") {
    config.showPiePercentages = true;
  }
  if (params.piePercentagesParam === "false" && config.variation === "pie") {
    config.showPiePercentages = false;
  }
}

/**
 * Builds a card config directly from URL params without needing DB lookup.
 * Used when all required params are in the URL.
 * @source
 */
export function buildCardConfigFromParams(params: {
  cardType: string;
  baseCardType: string;
  variationParam: string | null;
  showFavoritesParam: string | null;
  statusColorsParam: string | null;
  piePercentagesParam: string | null;
  gridColsParam?: string | null;
  gridRowsParam?: string | null;
  colorPresetParam?: string | null;
  titleColorParam?: string | null;
  backgroundColorParam?: string | null;
  textColorParam?: string | null;
  circleColorParam?: string | null;
  borderColorParam?: string | null;
  borderRadiusParam?: string | null;
}): StoredCardConfig {
  const config: StoredCardConfig = {
    cardName: params.cardType,
    variation: params.variationParam || "default",
    colorPreset: params.colorPresetParam || undefined,
  };

  // Apply preset colors if a named preset is provided
  if (params.colorPresetParam && params.colorPresetParam !== "custom") {
    const presetColors = getPresetColors(params.colorPresetParam);
    if (presetColors) {
      applyPresetColorsToConfig(config, presetColors);
    }
  }

  // Apply individual color params (these override preset colors)
  applyUrlColorParams(config, params);

  // Apply border params
  applyBorderOverrides(config, params);

  // Favorites grid layout params (only meaningful for favoritesGrid)
  if (params.baseCardType === "favoritesGrid") {
    const clampGridDim = (raw: string | null | undefined, fallback: number) => {
      if (raw === null || raw === undefined) return fallback;
      const parsed = Number.parseInt(raw, 10);
      if (Number.isNaN(parsed)) return fallback;
      return Math.max(1, Math.min(5, parsed));
    };
    config.gridCols = clampGridDim(params.gridColsParam, 3);
    config.gridRows = clampGridDim(params.gridRowsParam, 3);
  }

  // Apply boolean flags using a utility function to reduce cognitive
  applyBooleanOverridesForBuild(config, params);

  return config;
}

/**
 * Resolves and applies runtime overrides to a stored card configuration for rendering.
 * Purpose: select the correct card configuration, apply variation param, and optionally include favourites and status/pie display options.
 *
 * Color handling priority:
 * 1. If colorPreset is "custom", always load colors from database
 * 2. If individual color params are provided in URL, use those
 * 3. Otherwise, fall back to stored card configuration in database
 *
 * @param cardDoc - The CardsRecord containing saved card configurations for the user.
 * @param params - Request parameters controlling cardType, variation and boolean-like UI overrides.
 * @param userDoc - The normalized user record used to resolve favourites when requested.
 * @returns The processed StoredCardConfig, the effective variation name, and the favourites list used by the template.
 * @throws {CardDataError} When no configuration for the requested cardType exists.
 * @source
 */
export function processCardConfig(
  cardDoc: CardsRecord,
  params: {
    cardType: string;
    numericUserId: number;
    baseCardType: string;
    variationParam: string | null;
    showFavoritesParam: string | null;
    statusColorsParam: string | null;
    piePercentagesParam: string | null;
    gridColsParam?: string | null;
    gridRowsParam?: string | null;
    colorPresetParam?: string | null;
    titleColorParam?: string | null;
    backgroundColorParam?: string | null;
    textColorParam?: string | null;
    circleColorParam?: string | null;
    borderColorParam?: string | null;
    borderRadiusParam?: string | null;
  },
  userDoc: UserRecord,
): {
  cardConfig: StoredCardConfig;
  effectiveVariation: string;
  favorites: string[];
} {
  const { cardType, baseCardType } = params;

  const cardConfig = cardDoc.cards.find(
    (c: StoredCardConfig) => c.cardName === cardType,
  );
  if (!cardConfig) {
    throw new CardDataError(
      "Not Found: Card config not found. Try to regenerate the card.",
      404,
    );
  }

  const effectiveCardConfig: StoredCardConfig = {
    ...cardConfig,
  } as StoredCardConfig;
  const effectiveVariation =
    params.variationParam || effectiveCardConfig.variation || "default";

  applyColorOverrides(effectiveCardConfig, params);
  applyBorderOverrides(effectiveCardConfig, params);

  // Favorites grid layout params (only meaningful for favoritesGrid)
  if (params.baseCardType === "favoritesGrid") {
    const clampGridDim = (raw: string | null | undefined, fallback: number) => {
      if (raw === null || raw === undefined) return fallback;
      const parsed = Number.parseInt(raw, 10);
      if (Number.isNaN(parsed)) return fallback;
      return Math.max(1, Math.min(5, parsed));
    };
    effectiveCardConfig.gridCols = clampGridDim(params.gridColsParam, 3);
    effectiveCardConfig.gridRows = clampGridDim(params.gridRowsParam, 3);
  }

  // Apply boolean-like overrides and compute favorites list
  const favorites = applyBooleanOverridesForProcess(
    effectiveCardConfig,
    params,
    baseCardType,
    effectiveVariation,
    userDoc,
  );

  return { cardConfig: effectiveCardConfig, effectiveVariation, favorites };
}

/**
 * Applies boolean-style overrides and computes the favorites list for
 * the processing of an existing card config fetched from DB.
 *
 * Returns the computed favorites array.
 */
function applyBooleanOverridesForProcess(
  effectiveCardConfig: StoredCardConfig,
  params: {
    showFavoritesParam: string | null;
    statusColorsParam: string | null;
    piePercentagesParam: string | null;
  },
  baseCardType: string,
  effectiveVariation: string,
  userDoc: UserRecord,
): string[] {
  if (params.showFavoritesParam === "false") {
    effectiveCardConfig.showFavorites = false;
  }

  let favorites: string[] = [];
  const useFavorites =
    params.showFavoritesParam === null
      ? !!effectiveCardConfig.showFavorites
      : params.showFavoritesParam === "true";

  const favoritesRelevant = [
    "animeVoiceActors",
    "animeStudios",
    "animeStaff",
    "mangaStaff",
  ].includes(baseCardType);
  if (useFavorites && favoritesRelevant) {
    favorites = computeFavoritesList(userDoc, baseCardType);
  }

  const statusRelevant = [
    "animeStatusDistribution",
    "mangaStatusDistribution",
  ].includes(baseCardType);
  if (statusRelevant) {
    if (params.statusColorsParam === "true") {
      effectiveCardConfig.useStatusColors = true;
    } else if (params.statusColorsParam === "false") {
      effectiveCardConfig.useStatusColors = false;
    }
    effectiveCardConfig.useStatusColors ??= false;
  }

  applyPiePercentFlag(effectiveCardConfig, params, effectiveVariation);

  applyDefaultShowFavoritesFlag(effectiveCardConfig, favoritesRelevant);

  return favorites;
}

function computeFavoritesList(userDoc: UserRecord, baseCardType: string) {
  const favourites = userDoc?.stats?.User?.favourites ?? {};
  return getFavoritesForCardType(favourites, baseCardType);
}

function applyPiePercentFlag(
  effectiveCardConfig: StoredCardConfig,
  params: { piePercentagesParam: string | null },
  effectiveVariation: string,
): void {
  if (effectiveVariation !== "pie") return;
  if (params.piePercentagesParam === "true") {
    effectiveCardConfig.showPiePercentages = true;
  } else if (params.piePercentagesParam === "false") {
    effectiveCardConfig.showPiePercentages = false;
  }
  effectiveCardConfig.showPiePercentages ??= false;
}

function applyDefaultShowFavoritesFlag(
  effectiveCardConfig: StoredCardConfig,
  favoritesRelevant: boolean,
): void {
  if (!favoritesRelevant) return;
  effectiveCardConfig.showFavorites ??= false;
}
