import { CardConfig, CardsRecord } from "@/lib/types/records";
import { NextResponse } from "next/server";
import {
  incrementAnalytics,
  handleError,
  logSuccess,
  redisClient,
  initializeApiRequest,
} from "@/lib/api-utils";

// API endpoint for storing/updating user card configurations
export async function POST(request: Request): Promise<NextResponse> {
  const init = await initializeApiRequest(request, "Store Cards");
  if (init.errorResponse) return init.errorResponse;

  const { startTime, endpoint } = init;

  try {
    // Server-side validation: requests must originate from same origin or internal requests
    // The rate limiting from initializeApiRequest provides additional protection
    const origin = request.headers.get("origin");
    const isInternalRequest = !origin || origin === process.env.NEXT_PUBLIC_APP_URL;

    if (process.env.NODE_ENV === "production" && !isInternalRequest) {
      console.warn(
        `🔐 [${endpoint}] Suspicious cross-origin request from: ${origin}`,
      );
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 },
      );
    }

    const body = await request.json();
    const { statsData, userId, cards: incomingCards } = body;
    console.log(
      `📝 [${endpoint}] Processing user ${userId} with ${incomingCards?.length || 0} cards`,
    );

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
