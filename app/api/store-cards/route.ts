import { StoredCardConfig, CardsRecord } from "@/lib/types/records";
import { NextResponse } from "next/server";
import {
  incrementAnalytics,
  handleError,
  logSuccess,
  redisClient,
  initializeApiRequest,
  validateCardData,
} from "@/lib/api-utils";
import { clampBorderRadius } from "@/lib/utils";

function parseStoredCardsRecord(
  rawValue: unknown,
  endpoint: string,
  cardsKey: string,
): StoredCardConfig[] {
  if (rawValue === undefined || rawValue === null) return [];

  try {
    const parsedValue =
      typeof rawValue === "string" ? JSON.parse(rawValue) : rawValue;

    if (parsedValue && typeof parsedValue === "object") {
      const cards = (parsedValue as CardsRecord).cards;
      if (Array.isArray(cards)) {
        return cards;
      }
    }
  } catch (error) {
    console.warn(
      `⚠️ [${endpoint}] Unable to parse stored cards for ${cardsKey}: ${
        error instanceof Error ? error.message : String(error)
      }`,
    );
  }

  return [];
}

/**
 * Validates, persists, and reports analytics for the user card configuration payload.
 * @param request - Incoming request containing the user ID, stats, and card array.
 * @returns A NextResponse that signals success or propagates a validation/error response.
 * @source
 */
export async function POST(request: Request): Promise<NextResponse> {
  const init = await initializeApiRequest(request, "Store Cards");
  if (init.errorResponse) return init.errorResponse;

  const { startTime, endpoint } = init;

  try {
    const body = await request.json();
    const { statsData, userId, cards: incomingCards } = body;
    console.log(
      `📝 [${endpoint}] Processing user ${userId} with ${incomingCards?.length || 0} cards`,
    );

    // Validate incoming data
    const validationError = validateCardData(incomingCards, userId, endpoint);
    if (validationError) {
      await incrementAnalytics("analytics:store_cards:failed_requests");
      return validationError;
    }

    if (statsData?.error) {
      console.warn(
        `⚠️ [${endpoint}] Invalid data for user ${userId}: ${statsData.error}`,
      );
      await incrementAnalytics("analytics:store_cards:failed_requests");
      return NextResponse.json(
        { error: "Invalid data: " + statsData.error },
        { status: 400 },
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
      cardsKey,
    );

    // Build a map of existing cards by cardName for efficient merging
    const existingCardsMap = new Map<string, StoredCardConfig>(
      existingCards.map((card) => [card.cardName, card]),
    );

    // Process incoming cards: update existing or add new ones
    for (const card of incomingCards as StoredCardConfig[]) {
      const previous = existingCardsMap.get(card.cardName);
      const incomingRadius = Number.isFinite(card.borderRadius as number)
        ? (card.borderRadius as number)
        : undefined;
      const previousRadius = Number.isFinite(previous?.borderRadius as number)
        ? (previous!.borderRadius as number)
        : undefined;
      const effectiveRadius = incomingRadius ?? previousRadius;
      const normalizedBorderRadius =
        typeof effectiveRadius === "number"
          ? clampBorderRadius(effectiveRadius)
          : undefined;

      existingCardsMap.set(card.cardName, {
        cardName: card.cardName,
        variation: card.variation,
        titleColor: card.titleColor,
        backgroundColor: card.backgroundColor,
        textColor: card.textColor,
        circleColor: card.circleColor,
        borderColor: card.borderColor,
        borderRadius: normalizedBorderRadius,
        showFavorites: card.showFavorites,
        useStatusColors: card.useStatusColors,
        showPiePercentages: card.showPiePercentages,
      });
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
    await incrementAnalytics("analytics:store_cards:successful_requests");

    return NextResponse.json({
      success: true,
      userId,
    });
  } catch (error) {
    return handleError(
      error as Error,
      endpoint,
      startTime,
      "analytics:store_cards:failed_requests",
      "Card storage failed",
    );
  }
}
