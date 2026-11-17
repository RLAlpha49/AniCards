import type { StoredCardConfig } from "@/lib/types/records";
import type { NextResponse } from "next/server";
import {
  incrementAnalytics,
  handleError,
  apiJsonHeaders,
  logSuccess,
  initializeApiRequest,
  validateCardData,
  buildAnalyticsMetricKey,
  jsonWithCors,
} from "@/lib/api-utils";
import { invalidateSvgCache } from "@/lib/stores/svg-cache";
import { saveCardsRecord } from "@/lib/api/store-cards/save-cards";

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

    const cardsSaved = await saveCardsRecord(
      cardsKey,
      userId,
      incomingCards as StoredCardConfig[],
      endpoint,
      endpointKey,
    );

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
