import {
  apiErrorResponse,
  apiJsonHeaders,
  checkRateLimit,
  createRateLimiter,
  getRequestIp,
  incrementAnalytics,
  jsonWithCors,
  parseStrictPositiveInteger,
  redisClient,
} from "@/lib/api-utils";
import { CardsRecord } from "@/lib/types/records";
import { safeParse } from "@/lib/utils";

const ratelimit = createRateLimiter({ limit: 60, window: "10 s" });

/**
 * Serves cached card configurations for the requested user from Redis.
 * @param request - HTTP request carrying the userId query and related headers.
 * @returns JSON response containing the card data or an explanatory error payload.
 * @source
 */
export async function GET(request: Request) {
  const startTime = Date.now();
  const { searchParams } = new URL(request.url);
  const userId = searchParams.get("userId");
  const ip = getRequestIp(request);

  const rateLimitResponse = await checkRateLimit(
    request,
    ip,
    "Cards API",
    "cards_api",
    ratelimit,
  );
  if (rateLimitResponse) {
    return rateLimitResponse;
  }

  console.log(`🚀 [Cards API] New request from ${ip} for userId: ${userId}`);

  if (!userId) {
    console.warn("⚠️ [Cards API] Missing user ID parameter");
    return apiErrorResponse(request, 400, "Missing user ID parameter");
  }

  const numericUserId = parseStrictPositiveInteger(userId);
  if (!numericUserId) {
    console.warn(`⚠️ [Cards API] Invalid user ID format: ${userId}`);
    incrementAnalytics("analytics:cards_api:failed_requests").catch(() => {});
    return apiErrorResponse(request, 400, "Invalid user ID format", {
      category: "invalid_data",
      retryable: false,
    });
  }

  try {
    console.log(
      `🔍 [Cards API] Fetching card configuration from Redis for user ${numericUserId}`,
    );
    const key = `cards:${numericUserId}`;
    const cardDataStr = await redisClient.get(key);
    const duration = Date.now() - startTime;

    if (!cardDataStr) {
      console.warn(
        `⚠️ [Cards API] Cards for user ${numericUserId} not found [${duration}ms]`,
      );
      return apiErrorResponse(request, 404, "Cards not found");
    }

    const cardData: CardsRecord = safeParse<CardsRecord>(cardDataStr);

    console.log(
      `✅ [Cards API] Successfully returned card data for user ${numericUserId} [${duration}ms]`,
    );

    if (duration > 500) {
      console.warn(
        `⏳ [Cards API] Slow response time: ${duration}ms for user ${numericUserId}`,
      );
    }
    incrementAnalytics("analytics:cards_api:successful_requests").catch(
      () => {},
    );
    return jsonWithCors(cardData, request);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } catch (error: any) {
    const duration = Date.now() - startTime;
    console.error(
      `🔥 [Cards API] Error for user ${numericUserId} [${duration}ms]: ${error.message}`,
    );
    if (error.stack) {
      console.error(`💥 [Cards API] Stack Trace: ${error.stack}`);
    }
    incrementAnalytics("analytics:cards_api:failed_requests").catch(() => {});
    return apiErrorResponse(request, 500, "Failed to fetch cards");
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
