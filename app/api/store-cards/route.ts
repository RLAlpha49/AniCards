import { StoredCardConfig, CardsRecord } from "@/lib/types/records";
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
        return cards;
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
 * Builds a StoredCardConfig from incoming card data, merging with previous if needed.
 * Only saves individual colors when colorPreset is "custom" or not set.
 * @source
 */
function buildCardConfig(
  incoming: StoredCardConfig,
  previous: StoredCardConfig | undefined,
): StoredCardConfig {
  const normalizedBorderRadius = computeBorderRadius(incoming, previous);
  const shouldSaveColors =
    !incoming.colorPreset || incoming.colorPreset === "custom";

  // Only save showPiePercentages for card types that support pie variation
  const shouldSavePiePercentages =
    supportsPieVariation(incoming.cardName) && incoming.variation === "pie";

  const incomingPieDefined = typeof incoming.showPiePercentages === "boolean";
  const previousPie = previous?.showPiePercentages;
  // Merge incoming value -> previous -> explicit default false for pie variations
  let effectiveShowPiePercentages: boolean | undefined = undefined;
  if (shouldSavePiePercentages) {
    if (incomingPieDefined) {
      effectiveShowPiePercentages = incoming.showPiePercentages;
    } else if (typeof previousPie === "boolean") {
      effectiveShowPiePercentages = previousPie;
    } else {
      effectiveShowPiePercentages = false;
    }
  }

  const favoritesRelevant = CARD_TYPES_WITH_FAVORITES.has(incoming.cardName);
  const incomingFavDefined = typeof incoming.showFavorites === "boolean";
  const previousFav = previous?.showFavorites;
  let effectiveShowFavorites: boolean | undefined = undefined;
  if (favoritesRelevant) {
    if (incomingFavDefined) {
      effectiveShowFavorites = incoming.showFavorites;
    } else if (typeof previousFav === "boolean") {
      effectiveShowFavorites = previousFav;
    } else {
      effectiveShowFavorites = false;
    }
  }

  return {
    cardName: incoming.cardName,
    variation: incoming.variation,
    colorPreset: incoming.colorPreset,
    titleColor: shouldSaveColors ? incoming.titleColor : undefined,
    backgroundColor: shouldSaveColors ? incoming.backgroundColor : undefined,
    textColor: shouldSaveColors ? incoming.textColor : undefined,
    circleColor: shouldSaveColors ? incoming.circleColor : undefined,
    borderColor: incoming.borderColor,
    borderRadius: normalizedBorderRadius,
    showFavorites: effectiveShowFavorites,
    useStatusColors: incoming.useStatusColors,
    showPiePercentages: effectiveShowPiePercentages,
  };
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
    const { statsData, userId, cards: incomingCards } = body;
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

    // Process incoming cards: update existing or add new ones
    for (const card of incomingCards as StoredCardConfig[]) {
      const previous = existingCardsMap.get(card.cardName);
      existingCardsMap.set(card.cardName, buildCardConfig(card, previous));
    }

    const cardData: CardsRecord = {
      userId,
      cards: Array.from(existingCardsMap.values()),
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
