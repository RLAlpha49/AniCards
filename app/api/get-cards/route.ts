import { redisClient } from "@/lib/api/clients";
import { apiJsonHeaders, jsonWithCors } from "@/lib/api/cors";
import { apiErrorResponse, handleError } from "@/lib/api/errors";
import { logPrivacySafe } from "@/lib/api/logging";
import { parseStrictPositiveInteger } from "@/lib/api/primitives";
import { createRateLimiter } from "@/lib/api/rate-limit";
import { initializeApiRequest } from "@/lib/api/request-guards";
import {
  scheduleAnalyticsIncrement,
  scheduleLowValueAnalyticsIncrement,
} from "@/lib/api/telemetry";
import {
  hasDurableStoredCardsUserSnapshot,
  parseStoredCardsRecord,
  resolveStoredCardsParentSnapshotState,
} from "@/lib/card-data/fetching";

const ratelimit = createRateLimiter({ limit: 60, window: "10 s" });
const anonymousRatelimit = createRateLimiter({
  limit: 12,
  window: "10 s",
  hotPath: true,
});
const CARDS_API_ENDPOINT = "Cards API";
const CARDS_API_FAILED_METRIC = "analytics:cards_api:failed_requests";
const CARDS_API_SUCCESS_METRIC = "analytics:cards_api:successful_requests";

function trackCardsApiMetric(
  metric: string,
  request: Request,
  options?: {
    lowValue?: boolean;
  },
): void {
  const scheduleMetric = options?.lowValue
    ? scheduleLowValueAnalyticsIncrement
    : scheduleAnalyticsIncrement;

  scheduleMetric(metric, {
    endpoint: CARDS_API_ENDPOINT,
    request,
    taskName: metric,
  });
}

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
    {
      skipSameOrigin: true,
      unverifiedRateLimitFallback: {
        bucketKey: "anonymous:cards_api",
        limiter: anonymousRatelimit,
      },
    },
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
    trackCardsApiMetric(CARDS_API_FAILED_METRIC, request, {
      lowValue: true,
    });
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
    trackCardsApiMetric(CARDS_API_FAILED_METRIC, request, {
      lowValue: true,
    });
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
      trackCardsApiMetric(CARDS_API_FAILED_METRIC, request, {
        lowValue: true,
      });
      return apiErrorResponse(request, 404, "Cards not found");
    }

    const cardData = parseStoredCardsRecord(
      cardDataStr,
      `${endpoint}:cards:${numericUserId}`,
      numericUserId,
    );

    if (hasDurableStoredCardsUserSnapshot(cardData.userSnapshot)) {
      const parentSnapshotState = await resolveStoredCardsParentSnapshotState(
        numericUserId,
        cardData,
      );

      if (!parentSnapshotState) {
        logPrivacySafe(
          "warn",
          endpoint,
          "Stored cards record lost its parent user snapshot",
          { userId: numericUserId },
          request,
        );
        trackCardsApiMetric(CARDS_API_FAILED_METRIC, request, {
          lowValue: true,
        });
        return apiErrorResponse(
          request,
          500,
          "Stored cards record is incomplete or corrupted",
          {
            category: "server_error",
            retryable: false,
          },
        );
      }
    }

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

    trackCardsApiMetric(CARDS_API_SUCCESS_METRIC, request);
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
