import {
  StoredCardConfig,
  CardsRecord,
  GlobalCardSettings,
} from "@/lib/types/records";
import type { NextResponse } from "next/server";
import {
  incrementAnalytics,
  handleError,
  apiJsonHeaders,
  logSuccess,
  redisClient,
  initializeApiRequest,
  validateCardData,
  buildAnalyticsMetricKey,
  jsonWithCors,
} from "@/lib/api-utils";
import { clampBorderRadius, safeParse, validateColorValue } from "@/lib/utils";
import { displayNames, isValidCardType } from "@/lib/card-data/validation";

function sanitizeStoredBorderColor(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  return validateColorValue(trimmed) ? trimmed : undefined;
}

/**
 * Card types that support pie variation and thus can use showPiePercentages.
 * @source
 */
const CARD_TYPES_WITH_PIE_VARIATION = new Set([
  "animeGenres",
  "animeTags",
  "animeVoiceActors",
  "animeStudios",
  "animeStaff",
  "animeStatusDistribution",
  "animeFormatDistribution",
  "animeCountry",
  "mangaGenres",
  "mangaTags",
  "mangaStaff",
  "mangaStatusDistribution",
  "mangaFormatDistribution",
  "mangaCountry",
]);

/**
 * Card types that may render favorites and therefore store `showFavorites`.
 */
const CARD_TYPES_WITH_FAVORITES = new Set([
  "animeVoiceActors",
  "animeStudios",
  "animeStaff",
  "mangaStaff",
]);

/**
 * Cached list of supported base card types.
 * Used to ensure stored Redis records are never empty/partial.
 */
const SUPPORTED_BASE_CARD_TYPES = Object.keys(displayNames);

/**
 * Ensures the stored record always contains every supported base card type.
 * Missing card types are added as disabled.
 */
function ensureAllSupportedCardTypesPresent(
  cardsMap: Map<string, StoredCardConfig>,
): void {
  for (const baseCardName of SUPPORTED_BASE_CARD_TYPES) {
    if (cardsMap.has(baseCardName)) continue;
    cardsMap.set(baseCardName, { cardName: baseCardName, disabled: true });
  }
}

/**
 * Checks if a card type supports pie variation.
 * @source
 */
function supportsPieVariation(cardName: string): boolean {
  return CARD_TYPES_WITH_PIE_VARIATION.has(cardName);
}

function parseStoredCardsRecord(
  rawValue: unknown,
  endpoint: string,
  endpointKey: string,
  cardsKey: string,
): StoredCardConfig[] {
  if (rawValue === undefined || rawValue === null) return [];

  try {
    const parsedValue =
      typeof rawValue === "string"
        ? safeParse(rawValue, `${endpoint}:stored-cards:${cardsKey}`)
        : rawValue;

    if (parsedValue && typeof parsedValue === "object") {
      const cards = (parsedValue as CardsRecord).cards;
      if (Array.isArray(cards)) {
        // Filter out any stored entries that are not valid/supported card types
        const filtered = cards.filter(
          (c): c is StoredCardConfig =>
            !!c &&
            typeof c === "object" &&
            typeof c.cardName === "string" &&
            isValidCardType(c.cardName),
        );
        if (filtered.length !== cards.length) {
          console.warn(
            `⚠️ [${endpoint}] Removed unsupported card types from stored record for ${cardsKey}`,
          );
        }
        return filtered;
      }
    }
  } catch (error) {
    console.warn(
      `⚠️ [${endpoint}] Stored card record corrupted for ${cardsKey}: ${
        error instanceof Error ? error.message : String(error)
      }`,
    );
    incrementAnalytics(
      buildAnalyticsMetricKey(endpointKey, "corrupted_records"),
    ).catch(() => {});
  }

  return [];
}

/** Helper to safely parse existing global settings from stored data */
function parseExistingGlobalSettings(
  existingData: unknown,
  endpoint: string,
): GlobalCardSettings | undefined {
  try {
    return (
      typeof existingData === "string"
        ? safeParse<CardsRecord>(existingData, `${endpoint}:globalSettings`)
        : (existingData as CardsRecord | null)
    )?.globalSettings;
  } catch (error) {
    console.warn(
      `⚠️ [${endpoint}] Failed to parse existing global settings: ${
        error instanceof Error ? error.message : String(error)
      }`,
    );
    return undefined;
  }
}

/**
 * Computes the effective border radius from incoming and previous values.
 * @source
 */
function computeBorderRadius(
  incoming: StoredCardConfig,
  previous: StoredCardConfig | undefined,
): number | undefined {
  const incomingRadius = Number.isFinite(incoming.borderRadius)
    ? incoming.borderRadius
    : undefined;
  const previousRadius = Number.isFinite(previous?.borderRadius)
    ? previous!.borderRadius
    : undefined;
  const effectiveRadius = incomingRadius ?? previousRadius;
  return typeof effectiveRadius === "number"
    ? clampBorderRadius(effectiveRadius)
    : undefined;
}

/**
 * Computes effective showPiePercentages value from incoming and previous values.
 * @source
 */
function computeShowPiePercentages(
  incoming: StoredCardConfig,
  previous: StoredCardConfig | undefined,
): boolean | undefined {
  // Consider incoming variation first, fall back to previous variation so
  // disabling a card (which may omit variation) still preserves pie settings.
  const variation = incoming.variation ?? previous?.variation;
  const shouldSave =
    supportsPieVariation(incoming.cardName) &&
    (variation === "pie" || variation === "donut");

  if (!shouldSave) return undefined;

  if (typeof incoming.showPiePercentages === "boolean") {
    return incoming.showPiePercentages;
  }
  if (typeof previous?.showPiePercentages === "boolean") {
    return previous.showPiePercentages;
  }
  return undefined;
}

/**
 * Computes effective showFavorites value from incoming and previous values.
 * @source
 */
function computeShowFavorites(
  incoming: StoredCardConfig,
  previous: StoredCardConfig | undefined,
): boolean | undefined {
  if (!CARD_TYPES_WITH_FAVORITES.has(incoming.cardName)) return undefined;

  if (typeof incoming.showFavorites === "boolean") {
    return incoming.showFavorites;
  }
  if (typeof previous?.showFavorites === "boolean") {
    return previous.showFavorites;
  }
  return undefined;
}

/**
 * Clamps a grid dimension value to valid range (1-5).
 * @source
 */
function clampGridDim(value: unknown): number | undefined {
  if (typeof value !== "number" || !Number.isFinite(value)) return undefined;
  const n = Math.trunc(value);
  if (n < 1) return 1;
  if (n > 5) return 5;
  return n;
}

/**
 * Merge advanced global settings (useStatusColors, showPiePercentages,
 * showFavorites, gridCols, gridRows) by preferring incoming values and
 * falling back to previous values when omitted. Grid dims are clamped.
 */
function mergeGlobalAdvancedSettings(
  incoming?: Partial<GlobalCardSettings>,
  previous?: GlobalCardSettings,
) {
  const useStatusColors =
    typeof incoming?.useStatusColors === "boolean"
      ? incoming.useStatusColors
      : previous?.useStatusColors;

  const showPiePercentages =
    typeof incoming?.showPiePercentages === "boolean"
      ? incoming.showPiePercentages
      : previous?.showPiePercentages;

  const showFavorites =
    typeof incoming?.showFavorites === "boolean"
      ? incoming.showFavorites
      : previous?.showFavorites;

  const gridCols =
    clampGridDim(incoming?.gridCols) ?? clampGridDim(previous?.gridCols);
  const gridRows =
    clampGridDim(incoming?.gridRows) ?? clampGridDim(previous?.gridRows);

  return {
    useStatusColors,
    showPiePercentages,
    showFavorites,
    gridCols,
    gridRows,
  };
}

function shouldPersistIndividualColorsForPreset(preset: string | undefined) {
  return !preset || preset === "custom";
}

/**
 * Process a single global color field into `sanitized`.
 * Returns the key (string) when the value is a string and invalid.
 */
function processGlobalColorField(
  sanitized: Partial<GlobalCardSettings>,
  key: keyof GlobalCardSettings,
  value: unknown,
): string | undefined {
  if (value === undefined) return undefined;
  if (typeof value === "string") {
    if (!validateColorValue(value)) return key as string;
    (sanitized as Record<string, unknown>)[key as string] = value;
    return undefined;
  }
  // Only accept non-string (object) values when they validate.
  if (validateColorValue(value)) {
    (sanitized as Record<string, unknown>)[key as string] = value;
  }
  return undefined;
}

function sanitizeGlobalColorFields(
  incoming: Partial<GlobalCardSettings>,
  sanitized: Partial<GlobalCardSettings>,
): string | undefined {
  const colorKeys: Array<keyof GlobalCardSettings> = [
    "titleColor",
    "backgroundColor",
    "textColor",
    "circleColor",
  ];

  for (const key of colorKeys) {
    const val = (incoming as Record<string, unknown>)[key as string];
    const invalidKey = processGlobalColorField(sanitized, key, val);
    if (invalidKey) return invalidKey;
  }

  return undefined;
}

function sanitizeGlobalBooleanFields(
  incoming: Partial<GlobalCardSettings>,
  sanitized: Partial<GlobalCardSettings>,
): void {
  const booleanKeys: Array<keyof GlobalCardSettings> = [
    "borderEnabled",
    "useStatusColors",
    "showPiePercentages",
    "showFavorites",
  ];
  for (const key of booleanKeys) {
    const val = (incoming as Record<string, unknown>)[key as string];
    if (typeof val === "boolean") {
      (sanitized as Record<string, unknown>)[key as string] = val;
    }
  }
}

function sanitizeGlobalBorderFields(
  incoming: Partial<GlobalCardSettings>,
  sanitized: Partial<GlobalCardSettings>,
): string | undefined {
  if (typeof incoming.borderColor === "string") {
    const borderColor = sanitizeStoredBorderColor(incoming.borderColor);
    if (!borderColor) return "borderColor";
    sanitized.borderColor = borderColor;
  }
  if (
    typeof incoming.borderRadius === "number" &&
    Number.isFinite(incoming.borderRadius)
  ) {
    sanitized.borderRadius = clampBorderRadius(incoming.borderRadius);
  }

  return undefined;
}

function sanitizeGlobalGridFields(
  incoming: Partial<GlobalCardSettings>,
  sanitized: Partial<GlobalCardSettings>,
): void {
  const cols = clampGridDim(incoming.gridCols);
  if (typeof cols === "number") sanitized.gridCols = cols;
  const rows = clampGridDim(incoming.gridRows);
  if (typeof rows === "number") sanitized.gridRows = rows;
}

/**
 * Sanitize incoming partial GlobalCardSettings by picking only known keys
 * and validating/coercing where appropriate. Uses strict validateColorValue
 * for string color inputs to avoid accepting arbitrary strings.
 */
function sanitizeIncomingGlobalSettings(
  incoming?: Partial<GlobalCardSettings>,
):
  | { sanitized?: Partial<GlobalCardSettings>; invalidColorStringKey?: string }
  | undefined {
  if (!incoming || typeof incoming !== "object") return undefined;
  const sanitized: Partial<GlobalCardSettings> = {};

  const preset =
    typeof incoming.colorPreset === "string"
      ? incoming.colorPreset.trim()
      : undefined;
  const shouldAcceptIndividualColors =
    shouldPersistIndividualColorsForPreset(preset);

  if (preset) {
    sanitized.colorPreset = preset;
  }

  if (shouldAcceptIndividualColors) {
    const invalidKey = sanitizeGlobalColorFields(incoming, sanitized);
    if (invalidKey) return { invalidColorStringKey: invalidKey };
  }

  sanitizeGlobalBooleanFields(incoming, sanitized);
  const borderInvalidKey = sanitizeGlobalBorderFields(incoming, sanitized);
  if (borderInvalidKey) return { invalidColorStringKey: borderInvalidKey };
  sanitizeGlobalGridFields(incoming, sanitized);

  return Object.keys(sanitized).length ? { sanitized } : undefined;
}

/**
 * Builds a StoredCardConfig from incoming card data, merging with previous if needed.
 * Only saves individual colors when colorPreset is "custom" or not set.
 * Disabled cards preserve per-card settings so toggling visibility does not drop customizations.
 * If useCustomSettings is false, skips colorPreset and color fields (card references globalSettings).
 * Per-card `borderColor` and `borderRadius` are preserved from previous config when omitted,
 * even if global borders are disabled. Per-card border values are only omitted when
 * `useCustomSettings` is false.
 * @source
 */
function buildCardConfig(
  incoming: StoredCardConfig,
  previous: StoredCardConfig | undefined,
): StoredCardConfig {
  // Prefer incoming explicit flag, fall back to previous, and default to true
  const useCustomSettings =
    incoming.useCustomSettings ?? previous?.useCustomSettings ?? true;

  const normalizedBorderRadius = useCustomSettings
    ? computeBorderRadius(incoming, previous)
    : undefined;

  const baseCardType = (incoming.cardName || "").split("-")[0] || "";
  const shouldSaveColorData = useCustomSettings;
  const effectiveColorPreset = shouldSaveColorData
    ? (incoming.colorPreset ?? previous?.colorPreset)
    : undefined;
  const shouldSaveIndividualColors =
    shouldSaveColorData &&
    (!effectiveColorPreset || effectiveColorPreset === "custom");

  const shouldPersistFavoritesGridDims =
    useCustomSettings && baseCardType === "favoritesGrid";
  const resolvedGridCols = shouldPersistFavoritesGridDims
    ? clampGridDim(incoming.gridCols) ?? clampGridDim(previous?.gridCols)
    : undefined;
  const resolvedGridRows = shouldPersistFavoritesGridDims
    ? clampGridDim(incoming.gridRows) ?? clampGridDim(previous?.gridRows)
    : undefined;

  const effectiveBorderColor = useCustomSettings
    ? sanitizeStoredBorderColor(incoming.borderColor) ??
      sanitizeStoredBorderColor(previous?.borderColor)
    : undefined;

  const resolvedUseStatusColors = useCustomSettings
    ? (incoming.useStatusColors ?? previous?.useStatusColors)
    : undefined;

  const resolvedShowFavorites = useCustomSettings
    ? computeShowFavorites(incoming, previous)
    : undefined;

  const resolvedShowPiePercentages = useCustomSettings
    ? computeShowPiePercentages(incoming, previous)
    : undefined;

  return {
    cardName: incoming.cardName,
    // Preserve disabled flag when provided
    disabled: incoming.disabled === true ? true : undefined,
    variation: incoming.variation ?? previous?.variation,
    colorPreset: effectiveColorPreset,
    titleColor: shouldSaveIndividualColors
      ? (incoming.titleColor ?? previous?.titleColor)
      : undefined,
    backgroundColor: shouldSaveIndividualColors
      ? (incoming.backgroundColor ?? previous?.backgroundColor)
      : undefined,
    textColor: shouldSaveIndividualColors
      ? (incoming.textColor ?? previous?.textColor)
      : undefined,
    circleColor: shouldSaveIndividualColors
      ? (incoming.circleColor ?? previous?.circleColor)
      : undefined,
    borderColor: effectiveBorderColor,
    borderRadius: normalizedBorderRadius,
    showFavorites: resolvedShowFavorites,
    useStatusColors: resolvedUseStatusColors,
    showPiePercentages: resolvedShowPiePercentages,
    gridCols: resolvedGridCols,
    gridRows: resolvedGridRows,
    useCustomSettings,
  };
}

/**
 * Apply incoming cards into the existing cards map by merging values and
 * preserving previous values when appropriate.
 */
function applyIncomingCards(
  existingCardsMap: Map<string, StoredCardConfig>,
  incomingCards: StoredCardConfig[],
) {
  for (const card of incomingCards) {
    const previous = existingCardsMap.get(card.cardName);
    existingCardsMap.set(card.cardName, buildCardConfig(card, previous));
  }
}

function computeEffectiveBorderRadius(
  effectiveBorderEnabled: boolean | undefined,
  incoming?: Partial<GlobalCardSettings>,
  existing?: GlobalCardSettings,
): number | undefined {
  if (!effectiveBorderEnabled) return undefined;
  if (typeof incoming?.borderRadius === "number") {
    return clampBorderRadius(incoming.borderRadius);
  }
  if (typeof existing?.borderRadius === "number") {
    return clampBorderRadius(existing.borderRadius);
  }
  return undefined;
}

/**
 * Validates, persists, and reports analytics for the user card configuration payload.
 * @param request - Incoming request containing the user ID, stats, and card array.
 * @returns A NextResponse that signals success or propagates a validation/error response.
 * @source
 */
export async function POST(request: Request): Promise<NextResponse> {
  const init = await initializeApiRequest(
    request,
    "Store Cards",
    "store_cards",
  );
  if (init.errorResponse) return init.errorResponse;

  const { startTime, endpoint, endpointKey } = init;

  try {
    const body = await request.json();
    const { statsData, userId, cards: incomingCards, globalSettings } = body;
    console.log(
      `📝 [${endpoint}] Processing user ${userId} with ${incomingCards?.length || 0} cards`,
    );

    // Validate incoming data and obtain typed cards on success
    const validated = validateCardData(
      incomingCards,
      userId,
      endpoint,
      request,
    );
    if (!validated.success) {
      await incrementAnalytics(
        buildAnalyticsMetricKey(endpointKey, "failed_requests"),
      );
      return validated.error;
    }
    const incomingCardsTyped = validated.cards;

    if (statsData?.error) {
      console.warn(
        `⚠️ [${endpoint}] Invalid data for user ${userId}: ${statsData.error}`,
      );
      await incrementAnalytics(
        buildAnalyticsMetricKey(endpointKey, "failed_requests"),
      );
      return jsonWithCors(
        { error: "Invalid data: " + statsData.error },
        request,
        400,
      );
    }

    // Use a Redis key to store the user's card configurations
    const cardsKey = `cards:${userId}`;
    console.log(
      `📝 [${endpoint}] Storing card configuration using key: ${cardsKey}`,
    );

    // Fetch existing cards from Redis to merge with incoming cards
    const existingData = await redisClient.get(cardsKey);
    const existingCards = parseStoredCardsRecord(
      existingData,
      endpoint,
      endpointKey,
      cardsKey,
    );

    // Build a map of existing cards by cardName for efficient merging
    const existingCardsMap = new Map<string, StoredCardConfig>(
      existingCards.map((card) => [card.cardName, card]),
    );

    const existingGlobalSettings = parseExistingGlobalSettings(
      existingData,
      endpoint,
    );

    // Sanitize incoming globalSettings to only include known keys and valid types.
    const sanitizeResult = sanitizeIncomingGlobalSettings(globalSettings);
    if (sanitizeResult?.invalidColorStringKey) {
      console.warn(
        `⚠️ [${endpoint}] Invalid globalSettings color string for ${sanitizeResult.invalidColorStringKey}`,
      );
      await incrementAnalytics(
        buildAnalyticsMetricKey(endpointKey, "failed_requests"),
      ).catch(() => {});
      return jsonWithCors({ error: "Invalid data" }, request, 400);
    }
    const sanitizedGlobalSettings = sanitizeResult?.sanitized;
    // Determine effective borderEnabled early for use in card config building
    const effectiveBorderEnabled =
      sanitizedGlobalSettings?.borderEnabled ??
      existingGlobalSettings?.borderEnabled;

    // Process incoming cards: update existing or add new ones
    // Apply incoming typed cards (validated above)
    applyIncomingCards(existingCardsMap, incomingCardsTyped);

    ensureAllSupportedCardTypesPresent(existingCardsMap);

    // Compute borderRadius using helper (clamped when applicable)
    const effectiveBorderRadius = computeEffectiveBorderRadius(
      effectiveBorderEnabled,
      sanitizedGlobalSettings,
      existingGlobalSettings,
    );

    const effectiveBorderColor = effectiveBorderEnabled
      ? sanitizeStoredBorderColor(sanitizedGlobalSettings?.borderColor) ??
        sanitizeStoredBorderColor(existingGlobalSettings?.borderColor)
      : undefined;

    const {
      useStatusColors: effectiveUseStatusColors,
      showPiePercentages: effectiveShowPiePercentages,
      showFavorites: effectiveShowFavorites,
      gridCols: effectiveGridCols,
      gridRows: effectiveGridRows,
    } = mergeGlobalAdvancedSettings(
      sanitizedGlobalSettings,
      existingGlobalSettings,
    );

    const normalizeGlobalColorsForPreset = (
      settings: GlobalCardSettings | undefined,
    ): GlobalCardSettings | undefined => {
      if (!settings) return settings;
      const preset =
        typeof settings.colorPreset === "string"
          ? settings.colorPreset.trim()
          : undefined;
      if (preset && preset !== "custom") {
        return {
          ...settings,
          colorPreset: preset,
          titleColor: undefined,
          backgroundColor: undefined,
          textColor: undefined,
          circleColor: undefined,
        };
      }
      return preset ? { ...settings, colorPreset: preset } : settings;
    };

    const mergedColorPresetRaw =
      sanitizedGlobalSettings?.colorPreset ?? existingGlobalSettings?.colorPreset;
    const mergedColorPreset =
      typeof mergedColorPresetRaw === "string" ? mergedColorPresetRaw.trim() : undefined;
    const shouldPersistGlobalColors =
      !mergedColorPreset || mergedColorPreset === "custom";

    const mergedGlobalSettings: GlobalCardSettings | undefined =
      sanitizedGlobalSettings
        ? normalizeGlobalColorsForPreset({
            colorPreset: mergedColorPreset,
            titleColor: shouldPersistGlobalColors
              ? (sanitizedGlobalSettings.titleColor ??
                existingGlobalSettings?.titleColor)
              : undefined,
            backgroundColor: shouldPersistGlobalColors
              ? (sanitizedGlobalSettings.backgroundColor ??
                existingGlobalSettings?.backgroundColor)
              : undefined,
            textColor: shouldPersistGlobalColors
              ? (sanitizedGlobalSettings.textColor ??
                existingGlobalSettings?.textColor)
              : undefined,
            circleColor: shouldPersistGlobalColors
              ? (sanitizedGlobalSettings.circleColor ??
                existingGlobalSettings?.circleColor)
              : undefined,
            borderEnabled: effectiveBorderEnabled,
            borderColor: effectiveBorderColor,
            borderRadius: effectiveBorderRadius,
            useStatusColors: effectiveUseStatusColors,
            showPiePercentages: effectiveShowPiePercentages,
            showFavorites: effectiveShowFavorites,
            gridCols: effectiveGridCols,
            gridRows: effectiveGridRows,
          })
        : normalizeGlobalColorsForPreset(existingGlobalSettings);

    const cardData: CardsRecord = {
      userId,
      cards: Array.from(existingCardsMap.values()),
      globalSettings: mergedGlobalSettings,
      updatedAt: new Date().toISOString(),
    };

    // Save card configuration to Redis
    await redisClient.set(cardsKey, JSON.stringify(cardData));

    const duration = Date.now() - startTime;
    logSuccess(endpoint, userId, duration, "Stored cards");
    await incrementAnalytics(
      buildAnalyticsMetricKey(endpointKey, "successful_requests"),
    );

    return jsonWithCors({ success: true, userId }, request);
  } catch (error) {
    return handleError(
      error as Error,
      endpoint,
      startTime,
      buildAnalyticsMetricKey(endpointKey, "failed_requests"),
      "Card storage failed",
      request,
    );
  }
}

export function OPTIONS(request: Request) {
  const headers = apiJsonHeaders(request);
  return new Response(null, {
    headers: {
      ...headers,
      "Access-Control-Allow-Headers": "Content-Type",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
    },
  });
}
