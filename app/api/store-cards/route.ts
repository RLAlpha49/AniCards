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
import { clampBorderRadius, safeParse } from "@/lib/utils";
import { displayNames, isValidCardType } from "@/lib/card-data/validation";

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
  } catch {
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
  const shouldSave =
    supportsPieVariation(incoming.cardName) &&
    (incoming.variation === "pie" || incoming.variation === "donut");

  if (!shouldSave) return undefined;

  if (typeof incoming.showPiePercentages === "boolean") {
    return incoming.showPiePercentages;
  }
  if (typeof previous?.showPiePercentages === "boolean") {
    return previous.showPiePercentages;
  }
  return false;
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
  return false;
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

  return { useStatusColors, showPiePercentages, showFavorites, gridCols, gridRows };
}

/**
 * Builds a StoredCardConfig from incoming card data, merging with previous if needed.
 * Only saves individual colors when colorPreset is "custom" or not set.
 * If the card is disabled, only stores minimal data (cardName and disabled flag).
 * If useCustomSettings is false, skips colorPreset and color fields (card references globalSettings).
 * Per-card `borderColor` and `borderRadius` are preserved from previous config when omitted,
 * even if global borders are disabled. Per-card border values are only omitted when
 * `useCustomSettings` is false.
 * @source
 */
function buildCardConfig(
  incoming: StoredCardConfig,
  previous: StoredCardConfig | undefined,
  globalBorderEnabled?: boolean,
): StoredCardConfig {
  // If card is disabled, store only minimal data
  if (incoming.disabled === true) {
    return {
      cardName: incoming.cardName,
      disabled: true,
    };
  }

  const normalizedBorderRadius = computeBorderRadius(incoming, previous);

  const useCustomSettings = incoming.useCustomSettings ?? true;
  const shouldSaveColorData = useCustomSettings;
  const shouldSaveIndividualColors =
    shouldSaveColorData &&
    (!incoming.colorPreset || incoming.colorPreset === "custom");

  const resolvedGridCols =
    clampGridDim(incoming.gridCols) ?? clampGridDim(previous?.gridCols);
  const resolvedGridRows =
    clampGridDim(incoming.gridRows) ?? clampGridDim(previous?.gridRows);

  const effectiveBorderColor =
    useCustomSettings ? incoming.borderColor ?? previous?.borderColor : undefined;

  return {
    cardName: incoming.cardName,
    variation: incoming.variation,
    colorPreset: shouldSaveColorData ? incoming.colorPreset : undefined,
    titleColor: shouldSaveIndividualColors ? incoming.titleColor : undefined,
    backgroundColor: shouldSaveIndividualColors
      ? incoming.backgroundColor
      : undefined,
    textColor: shouldSaveIndividualColors ? incoming.textColor : undefined,
    circleColor: shouldSaveIndividualColors ? incoming.circleColor : undefined,
    borderColor: effectiveBorderColor,
    borderRadius: normalizedBorderRadius,
    showFavorites: computeShowFavorites(incoming, previous),
    useStatusColors: incoming.useStatusColors,
    showPiePercentages: computeShowPiePercentages(incoming, previous),
    gridCols: resolvedGridCols,
    gridRows: resolvedGridRows,
    useCustomSettings: incoming.useCustomSettings,
  };
}

/**
 * Apply incoming cards into the existing cards map by merging values and
 * preserving previous values when appropriate.
 */
function applyIncomingCards(
  existingCardsMap: Map<string, StoredCardConfig>,
  incomingCards: StoredCardConfig[],
  effectiveBorderEnabled?: boolean,
) {
  for (const card of incomingCards) {
    const previous = existingCardsMap.get(card.cardName);
    existingCardsMap.set(
      card.cardName,
      buildCardConfig(card, previous, effectiveBorderEnabled),
    );
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

    // Validate incoming data
    const validationError = validateCardData(
      incomingCards,
      userId,
      endpoint,
      request,
    );
    if (validationError) {
      await incrementAnalytics(
        buildAnalyticsMetricKey(endpointKey, "failed_requests"),
      );
      return validationError;
    }

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

    const existingGlobalSettings = parseExistingGlobalSettings(existingData, endpoint);

    // Determine effective borderEnabled early for use in card config building
    const effectiveBorderEnabled =
      globalSettings?.borderEnabled ?? existingGlobalSettings?.borderEnabled;

    // Process incoming cards: update existing or add new ones
    applyIncomingCards(existingCardsMap, incomingCards as StoredCardConfig[], effectiveBorderEnabled);

    ensureAllSupportedCardTypesPresent(existingCardsMap);

    // Compute borderRadius using helper (clamped when applicable)
    const effectiveBorderRadius = computeEffectiveBorderRadius(
      effectiveBorderEnabled,
      globalSettings,
      existingGlobalSettings,
    );

    const effectiveBorderColor = effectiveBorderEnabled
      ? (globalSettings.borderColor ?? existingGlobalSettings?.borderColor)
      : undefined;

    const {
      useStatusColors: effectiveUseStatusColors,
      showPiePercentages: effectiveShowPiePercentages,
      showFavorites: effectiveShowFavorites,
      gridCols: effectiveGridCols,
      gridRows: effectiveGridRows,
    } = mergeGlobalAdvancedSettings(globalSettings, existingGlobalSettings);

    const mergedGlobalSettings: GlobalCardSettings | undefined = globalSettings
      ? {
          ...globalSettings,
          borderEnabled: effectiveBorderEnabled,
          borderColor: effectiveBorderColor,
          borderRadius: effectiveBorderRadius,
          useStatusColors: effectiveUseStatusColors,
          showPiePercentages: effectiveShowPiePercentages,
          showFavorites: effectiveShowFavorites,
          gridCols: effectiveGridCols,
          gridRows: effectiveGridRows,
        }
      : existingGlobalSettings;

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
