import { redisClient } from "@/lib/api/clients";
import { apiJsonHeaders, jsonWithCors } from "@/lib/api/cors";
import { apiErrorResponse, handleError } from "@/lib/api/errors";
import { logPrivacySafe } from "@/lib/api/logging";
import { parseStrictPositiveInteger } from "@/lib/api/primitives";
import { createRateLimiter } from "@/lib/api/rate-limit";
import { initializeApiRequest } from "@/lib/api/request-guards";
import { incrementAnalytics } from "@/lib/api/telemetry";
import { parseStoredCardsRecord } from "@/lib/card-data/fetching";

const ratelimit = createRateLimiter({ limit: 60, window: "10 s" });
const CARDS_API_ENDPOINT = "Cards API";
const CARDS_API_FAILED_METRIC = "analytics:cards_api:failed_requests";
const CARDS_API_SUCCESS_METRIC = "analytics:cards_api:successful_requests";

/**
 * Serves cached card configurations for the requested user from Redis.
 * @param request - HTTP request carrying the userId query and related headers.
 * @returns JSON response containing the card data or an explanatory error payload.
 * @source
 */
export async function GET(request: Request) {
  const init = await initializeApiRequest(
    request,
    CARDS_API_ENDPOINT,
    "cards_api",
    ratelimit,
    { skipSameOrigin: true },
  );
  if (init.errorResponse) return init.errorResponse;

  const { startTime, endpoint } = init;
  const { searchParams } = new URL(request.url);
  const userId = searchParams.get("userId");

  logPrivacySafe(
    "log",
    endpoint,
    "Processing cards lookup",
    { userId },
    request,
  );

  if (!userId) {
    logPrivacySafe(
      "warn",
      endpoint,
      "Missing user ID parameter",
      undefined,
      request,
    );
    return apiErrorResponse(request, 400, "Missing user ID parameter");
  }

  const numericUserId = parseStrictPositiveInteger(userId);
  if (!numericUserId) {
    logPrivacySafe(
      "warn",
      endpoint,
      "Invalid user ID format",
      { userId },
      request,
    );
    incrementAnalytics(CARDS_API_FAILED_METRIC).catch(() => {});
    return apiErrorResponse(request, 400, "Invalid user ID format", {
      category: "invalid_data",
      retryable: false,
    });
  }

  try {
    logPrivacySafe(
      "log",
      endpoint,
      "Fetching card configuration from Redis",
      { userId: numericUserId },
      request,
    );

    const key = `cards:${numericUserId}`;
    const cardDataStr = await redisClient.get(key);
    const duration = Date.now() - startTime;

    if (!cardDataStr) {
      logPrivacySafe(
        "warn",
        endpoint,
        "Cards not found",
        { userId: numericUserId, durationMs: duration },
        request,
      );
      return apiErrorResponse(request, 404, "Cards not found");
    }

    const cardData = parseStoredCardsRecord(
      cardDataStr,
      `${endpoint}:cards:${numericUserId}`,
      numericUserId,
    );

    logPrivacySafe(
      "log",
      endpoint,
      "Successfully returned card data",
      { userId: numericUserId, durationMs: duration },
      request,
    );

    if (duration > 500) {
      logPrivacySafe(
        "warn",
        endpoint,
        "Slow response time",
        { userId: numericUserId, durationMs: duration },
        request,
      );
    }

    incrementAnalytics(CARDS_API_SUCCESS_METRIC).catch(() => {});
    return jsonWithCors(cardData, request);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } catch (error: any) {
    return handleError(
      error as Error,
      endpoint,
      startTime,
      CARDS_API_FAILED_METRIC,
      "Failed to fetch cards",
      request,
      {
        redisUnavailableMessage: "Card data is temporarily unavailable",
        logContext: { userId: numericUserId },
      },
    );
  }
}

export function OPTIONS(request: Request) {
  const headers = apiJsonHeaders(request);
  return new Response(null, {
    headers: {
      ...headers,
      "Access-Control-Allow-Headers": "Content-Type",
      "Access-Control-Allow-Methods": "GET, HEAD, OPTIONS",
    },
  });
}
