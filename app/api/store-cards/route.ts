import { CardConfig, CardsRecord } from "@/lib/types/records";
import { NextResponse } from "next/server";
import {
  incrementAnalytics,
  handleError,
  logSuccess,
  redisClient,
  initializeApiRequest,
  validateCardData,
} from "@/lib/api-utils";

// API endpoint for storing/updating user card configurations
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

    const cardData: CardsRecord = {
      userId,
      cards: incomingCards.map((card: CardConfig) => ({
        cardName: card.cardName,
        variation: card.variation,
        titleColor: card.titleColor,
        backgroundColor: card.backgroundColor,
        textColor: card.textColor,
        circleColor: card.circleColor,
        borderColor: card.borderColor,
        showFavorites: card.showFavorites,
        useStatusColors: card.useStatusColors,
        showPiePercentages: card.showPiePercentages,
      })),
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
    );
  }
}
