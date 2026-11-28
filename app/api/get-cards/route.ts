import {
  redisClient,
  incrementAnalyticsInBackground,
  jsonWithCors,
  apiJsonHeaders,
  checkRateLimit,
  getClientIp,
} from "@/lib/api-utils";
import { CardsRecord } from "@/lib/types/records";
import { safeParse } from "@/lib/json";
import { createLogger } from "@/lib/log";

const log = createLogger("Cards API");

/**
 * Serves cached card configurations for the requested user from Redis.
 *
 * The rate limit runs before any Redis command, so an unauthenticated caller
 * cannot turn this endpoint into unbounded reads and analytics writes. The
 * user page calls it once per load, well inside the default 10 per 5 s.
 *
 * @param request - HTTP request carrying the userId query and related headers.
 * @returns JSON response containing the card data or an explanatory error payload.
 * @source
 */
export async function GET(request: Request) {
  const startTime = Date.now();
  const { searchParams } = new URL(request.url);
  const userId = searchParams.get("userId");
  const ip = getClientIp(request);

  const rateLimitResponse = await checkRateLimit(
    request,
    ip,
    "Cards API",
    "cards_api",
  );
  if (rateLimitResponse) return rateLimitResponse;

  log.log(`New request from ${ip} for userId: ${userId}`);

  if (!userId) {
    log.warn("Missing user ID parameter");
    return jsonWithCors({ error: "Missing user ID parameter" }, request, 400);
  }

  const numericUserId = Number.parseInt(userId);
  if (Number.isNaN(numericUserId)) {
    log.warn(`Invalid user ID format: ${userId}`);
    incrementAnalyticsInBackground("analytics:cards_api:failed_requests");
    return jsonWithCors({ error: "Invalid user ID format" }, request, 400);
  }

  try {
    log.log(`Fetching card configuration from Redis for user ${numericUserId}`);
    const key = `cards:${numericUserId}`;
    const cardDataStr = await redisClient.get(key);
    const duration = Date.now() - startTime;

    if (!cardDataStr) {
      log.warn(`Cards for user ${numericUserId} not found [${duration}ms]`);
      return jsonWithCors({ error: "Cards not found" }, request, 404);
    }

    let cardData: CardsRecord = safeParse<CardsRecord>(cardDataStr);

    log.log(
      `Successfully returned card data for user ${numericUserId} [${duration}ms]`,
    );

    if (duration > 500) {
      log.warn(`Slow response time: ${duration}ms for user ${numericUserId}`);
    }
    incrementAnalyticsInBackground("analytics:cards_api:successful_requests");
    return jsonWithCors(cardData, request);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } catch (error: any) {
    const duration = Date.now() - startTime;
    log.error(
      `Error for user ${numericUserId} [${duration}ms]: ${error.message}`,
    );
    if (error.stack) {
      log.error(`Stack Trace: ${error.stack}`);
    }
    incrementAnalyticsInBackground("analytics:cards_api:failed_requests");
    return jsonWithCors({ error: "Failed to fetch cards" }, request, 500);
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
