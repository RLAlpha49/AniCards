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
import { isValidCardType } from "@/lib/card-data/validation";
import { invalidateSvgCache } from "@/lib/stores/svg-cache";

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

const MAX_CARDS_SAVE_ATTEMPTS = 5;
const MISSING_CARDS_VALUE = "__MISSING_CARDS_VALUE__";
const CARDS_VALUE_PREFIX = "__CARDS_VALUE__:";

const READ_CARDS_SCRIPT = `
  local value = redis.call("GET", KEYS[1])
  if not value then
    return "${MISSING_CARDS_VALUE}"
  end
  return "${CARDS_VALUE_PREFIX}" .. value
`;

const COMPARE_AND_SET_CARDS_SCRIPT = `
  local current = redis.call("GET", KEYS[1])
  if ARGV[1] == "0" then
    if current then
      return 0
    end
  elseif current ~= ARGV[2] then
    return 0
  end
  redis.call("SET", KEYS[1], ARGV[3])
  return 1
`;

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

/**
 * Reads the timestamp of a stored card record.
 *
 * @param rawValue - The stored record, as raw JSON.
 * @returns The stored timestamp, or undefined when it cannot be read.
 * @source
 */
function readStoredCardsUpdatedAt(rawValue: unknown): string | undefined {
  if (rawValue === undefined || rawValue === null) return undefined;

  try {
    const parsedValue =
      typeof rawValue === "string" ? JSON.parse(rawValue) : rawValue;
    const updatedAt = (parsedValue as CardsRecord | null)?.updatedAt;
    return typeof updatedAt === "string" ? updatedAt : undefined;
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
    supportsPieVariation(incoming.cardName) &&
    (incoming.variation === "pie" || incoming.variation === "donut");

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

  const clampGridDim = (value: unknown): number | undefined => {
    if (typeof value !== "number" || !Number.isFinite(value)) return undefined;
    const n = Math.trunc(value);
    if (n < 1) return 1;
    if (n > 5) return 5;
    return n;
  };

  const resolvedGridCols =
    clampGridDim(incoming.gridCols) ?? clampGridDim(previous?.gridCols);
  const resolvedGridRows =
    clampGridDim(incoming.gridRows) ?? clampGridDim(previous?.gridRows);

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
    gridCols: resolvedGridCols,
    gridRows: resolvedGridRows,
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

    let cardsSaved = false;
    for (let attempt = 0; attempt < MAX_CARDS_SAVE_ATTEMPTS; attempt += 1) {
      const storedValue = await redisClient.eval<[], string>(
        READ_CARDS_SCRIPT,
        [cardsKey],
        [],
      );
      const recordExists = storedValue !== MISSING_CARDS_VALUE;
      const existingData = recordExists
        ? storedValue.slice(CARDS_VALUE_PREFIX.length)
        : undefined;
      const existingCards = parseStoredCardsRecord(
        existingData,
        endpoint,
        endpointKey,
        cardsKey,
      );

      // The stored timestamp is read alongside the cards so a save that
      // changes nothing can keep it.
      const existingUpdatedAt = readStoredCardsUpdatedAt(existingData);

      const existingCardsMap = new Map<string, StoredCardConfig>(
        existingCards.map((card) => [card.cardName, card]),
      );

      for (const card of incomingCards as StoredCardConfig[]) {
        const previous = existingCardsMap.get(card.cardName);
        existingCardsMap.set(card.cardName, buildCardConfig(card, previous));
      }

      const mergedCards = Array.from(existingCardsMap.values());

      // The timestamp moves only when the configuration actually changed. It
      // is the card URL's version, so a save that changes nothing must not
      // move it: that would ask every cached card for a fresh copy without
      // any card having changed.
      const configurationChanged =
        !recordExists ||
        JSON.stringify(existingCards) !== JSON.stringify(mergedCards);

      const cardData: CardsRecord = {
        userId,
        cards: mergedCards,
        updatedAt: configurationChanged
          ? new Date().toISOString()
          : (existingUpdatedAt ?? new Date().toISOString()),
      };
      const saveResult = await redisClient.eval<
        [string, string, string],
        number
      >(
        COMPARE_AND_SET_CARDS_SCRIPT,
        [cardsKey],
        [
          recordExists ? "1" : "0",
          existingData ?? "",
          JSON.stringify(cardData),
        ],
      );

      if (saveResult === 1) {
        cardsSaved = true;
        break;
      }
    }

    if (!cardsSaved) {
      console.warn(
        `⚠️ [${endpoint}] Concurrent card updates prevented saving for user ${userId}`,
      );
      await incrementAnalytics(
        buildAnalyticsMetricKey(endpointKey, "failed_requests"),
      );
      return jsonWithCors(
        { error: "Card configuration changed while saving. Please retry." },
        request,
        409,
      );
    }

    const duration = Date.now() - startTime;
    logSuccess(endpoint, userId, duration, "Stored cards");
    await incrementAnalytics(
      buildAnalyticsMetricKey(endpointKey, "successful_requests"),
    );

    // The stored configuration is an input to every card rendered for this
    // user, and a `colorPreset=custom` URL carries none of it, so the renders
    // this process holds are now wrong. `validateCardData` already rejected
    // anything that is not a positive integer, so the conversion cannot change
    // the value. Other processes and the CDN pick up the change from the
    // `updatedAt` this save just wrote, which the user page puts in the URL.
    invalidateSvgCache(Number(userId));

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
