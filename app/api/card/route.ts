import {
  getAllowedCardSvgOrigin,
  createRateLimiter,
  checkRateLimit,
  getClientIp,
} from "@/lib/api-utils";
import { markTrustedSvg } from "@/lib/svg-markup";
import generateCardSvg from "@/lib/card-generator";
import { CardDataError } from "@/lib/card-data";
import { toCleanSvgResponse, type TrustedSVG } from "@/lib/types/svg";
import {
  getSvgFromMemoryCache,
  setSvgInMemoryCache,
} from "@/lib/stores/svg-cache";
import { trackUserActionError } from "@/lib/error-tracking";
import {
  createCardRequestMetrics,
  type CardRequestMetrics,
} from "@/lib/server/card-metrics";
import {
  resolveCardRequest,
  loadCardRenderInputs,
  type CardRequestError,
  type CardRequestPlan,
  type CardRenderInputs,
} from "@/lib/api/card/prepare-request";
import {
  createSuccessResponse,
  errorResponse,
  formatCardDataErrorMessage,
} from "@/lib/api/card/responses";

/** Rate limiter for card SVG requests to prevent abuse. @source */
const ratelimit = createRateLimiter({ limit: 150, window: "10 s" });

/**
 * GET handler for generating card SVGs.
 *
 * The route owns the request lifecycle: rate limit, cache lookup, render,
 * metrics. The work behind each step lives in `lib/api/card/prepare-request`,
 * so the whole handler reads as those four steps.
 *
 * @param request - The incoming GET request for the card endpoint.
 * @returns A Response containing an SVG (card or error).
 * @source
 */
export async function GET(request: Request) {
  const startTime = Date.now();
  const ip = getClientIp(request);

  const rateLimitResponse = await checkRateLimit(
    request,
    ip,
    "Card SVG",
    "card_svg",
    ratelimit,
  );
  if (rateLimitResponse) {
    return errorResponse(
      request,
      "Client Error: Too many requests - try again later",
      429,
    );
  }

  console.log(`🚀 [Card SVG] New request from IP: ${ip} - URL: ${request.url}`);

  // One pipeline holds every analytics counter and URL-profile write this
  // request makes.
  const metrics = createCardRequestMetrics();

  const requestResult = await resolveCardRequest(request, metrics);
  if ("error" in requestResult) {
    return answerError(request, requestResult.error, metrics, true);
  }
  const plan = requestResult.plan;
  const { params, userId, urlProfile, cacheKey, bypassCache } = plan;

  // A request that carried `_t` asked not to use a stored copy, so the
  // in-process cache is skipped for it and the counter records the bypass.
  const cachedEntry = bypassCache ? null : getSvgFromMemoryCache(cacheKey);
  if (cachedEntry) {
    metrics.recordCache("hit");
    metrics.recordUrlProfile(urlProfile, { cache: "hit", status: 200 });
    metrics.flushInBackground();
    return createSuccessResponse(
      markTrustedSvg(cachedEntry.svg),
      request,
      cachedEntry.borderRadius,
      userId,
      "memory",
    );
  }

  // A miss in this process renders the card. There is no shared tier to check,
  // so a miss here is the real miss that the counter records.
  metrics.recordCache("miss");
  if (bypassCache) metrics.recordCacheBypass();

  // Every path from here on ends in the same place: record the URL profile
  // with the status that was actually answered, flush once, return.
  let response: Response;
  try {
    const loaded = await loadCardRenderInputs(plan);
    if ("error" in loaded) {
      metrics.recordFailure();
      response = errorResponse(
        request,
        loaded.error.message,
        loaded.error.status,
      );
    } else {
      response = await renderAndRespond(
        loaded.inputs,
        plan,
        request,
        metrics,
        startTime,
      );
    }
  } catch (err: unknown) {
    response = answerUnexpectedError(
      err,
      request,
      params.baseCardType,
      metrics,
    );
  }

  metrics.recordUrlProfile(urlProfile, {
    cache: "miss",
    status: response.status,
  });
  await metrics.flush();
  return response;
}

/**
 * Renders the card, stores it for the next request, and builds the response.
 *
 * @param inputs - Stored records and configuration for the render.
 * @param plan - Resolved request.
 * @param request - The incoming request, used to build CORS headers.
 * @param metrics - Batched metrics for this request.
 * @param startTime - Request start, used to report the duration.
 * @returns The success response.
 * @source
 */
async function renderAndRespond(
  inputs: CardRenderInputs,
  plan: CardRequestPlan,
  request: Request,
  metrics: CardRequestMetrics,
  startTime: number,
): Promise<Response> {
  const { params, userId, cacheKey, bypassCache } = plan;

  const svgContent = await renderCard(
    inputs,
    params.cardType,
    params.baseCardType,
    userId,
    startTime,
  );

  // Keep the render in this process for the next request. Nothing is written
  // to Redis; the CDN holds the shared copy.
  //
  // A request that carried `_t` asked not to use a stored copy, but its render
  // is current, so it replaces the stored one. Otherwise the next request
  // without `_t` would still find the older render.
  setSvgInMemoryCache(
    cacheKey,
    toCleanSvgResponse(svgContent),
    userId,
    inputs.cardConfig.borderRadius,
  );

  metrics.recordSuccess();
  return createSuccessResponse(
    svgContent,
    request,
    inputs.cardConfig.borderRadius,
    userId,
    bypassCache ? "bypass" : "render",
  );
}

/**
 * Renders one card and logs how long it took.
 *
 * @param inputs - Stored records and configuration for the render.
 * @param cardType - Requested card type, used in log lines only.
 * @param baseCardType - Card type without a variation suffix.
 * @param userId - Resolved user, used in log lines only.
 * @param startTime - Request start, used to report the duration.
 * @returns The rendered SVG.
 * @source
 */
async function renderCard(
  inputs: CardRenderInputs,
  cardType: string,
  baseCardType: string,
  userId: number,
  startTime: number,
): Promise<TrustedSVG> {
  console.log(
    `🎨 [Card SVG] Generating ${cardType} (${inputs.effectiveVariation}) SVG for user ${userId}`,
  );

  const svgContent = await generateCardSvg(
    inputs.cardConfig,
    inputs.userDoc,
    inputs.effectiveVariation,
    inputs.favorites,
  );

  const duration = Date.now() - startTime;
  if (duration > 1500) {
    console.warn(
      `⏳ [Card SVG] Slow rendering detected: ${duration}ms for user ${userId} (${baseCardType})`,
    );
  }
  console.log(
    `✅ [Card SVG] Rendered ${cardType} card for ${userId} in ${duration}ms`,
  );
  return svgContent;
}

/**
 * Answers a rejected request with the SVG error card.
 *
 * @param request - The incoming request, used to build CORS headers.
 * @param error - Message and status produced by the request resolver.
 * @param metrics - Batched metrics for this request.
 * @param flush - Whether to send the queued metrics before answering.
 * @source
 */
async function answerError(
  request: Request,
  error: CardRequestError,
  metrics: CardRequestMetrics,
  flush: boolean,
): Promise<Response> {
  metrics.recordFailure();
  if (flush) await metrics.flush();
  return errorResponse(request, error.message, error.status);
}

/**
 * Answers a failure that was not shaped as a card request error.
 *
 * A {@link CardDataError} is expected and carries its own status. Anything
 * else is a bug, logged and answered with a generic 500.
 *
 * @param err - The thrown value.
 * @param request - The incoming request, used to build CORS headers.
 * @param baseCardType - Card type without a variation suffix, for the error
 *   tracking key.
 * @param metrics - Batched metrics for this request.
 * @returns The error response to return.
 * @source
 */
function answerUnexpectedError(
  err: unknown,
  request: Request,
  baseCardType: string,
  metrics: CardRequestMetrics,
): Response {
  metrics.recordFailure();

  if (err instanceof CardDataError) {
    trackUserActionError(
      `card_svg_generation_${baseCardType}`,
      err,
      err.category,
      { statusCode: err.status },
    );
    return errorResponse(request, formatCardDataErrorMessage(err), err.status);
  }

  console.error(`🔥 [Card SVG] Error generating ${baseCardType} card:`, err);
  if (err instanceof Error && err.stack) {
    console.error(`💥 [Card SVG] Stack Trace: ${err.stack}`);
  }

  trackUserActionError(
    `card_svg_generation_${baseCardType}`,
    err instanceof Error ? err : new Error(String(err)),
    "server_error",
    { statusCode: 500 },
  );

  return errorResponse(
    request,
    "Server Error: An internal error occurred",
    500,
  );
}

export function OPTIONS(request: Request) {
  const allowedOrigin = getAllowedCardSvgOrigin(request);
  return new Response(null, {
    headers: {
      "Access-Control-Allow-Origin": allowedOrigin,
      "Access-Control-Allow-Methods": "GET, HEAD, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
      "Access-Control-Expose-Headers": "X-Card-Border-Radius",
      Vary: "Origin",
    },
  });
}
