import {
  incrementAnalytics,
  getAllowedCardSvgOrigin,
  createRateLimiter,
  checkRateLimit,
  buildAnalyticsMetricKey,
} from "@/lib/api-utils";
import { escapeForXml, getCardBorderRadius, DEFAULT_CARD_BORDER_RADIUS, markTrustedSvg } from "@/lib/utils";
import { UserRecord, CardsRecord, StoredCardConfig } from "@/lib/types/records";
import generateCardSvg from "@/lib/card-generator";
import { fetchUserData, validateAndNormalizeUserRecord, processCardConfig, CardDataError } from "@/lib/card-data";
import { toCleanSvgResponse, type TrustedSVG } from "@/lib/types/svg";

/** Rate limiter for card SVG requests to prevent abuse. @source */
const ratelimit = createRateLimiter({ limit: 150, window: "10 s" });

/** Whitelist of supported card types the API will render. @source */
const ALLOWED_CARD_TYPES = new Set([
  "animeStats",
  "socialStats",
  "mangaStats",
  "animeGenres",
  "animeTags",
  "animeVoiceActors",
  "animeStudios",
  "animeStaff",
  "mangaGenres",
  "mangaTags",
  "mangaStaff",
  "animeStatusDistribution",
  "mangaStatusDistribution",
  "animeFormatDistribution",
  "mangaFormatDistribution",
  "animeScoreDistribution",
  "mangaScoreDistribution",
  "animeYearDistribution",
  "mangaYearDistribution",
  "animeCountry",
  "mangaCountry",
]);

/**
 * Generate a minimal error SVG containing a single message.
 *
 * This returns a TrustedSVG (wrapped) to ensure the response is safe to return
 * from the API and is used only for error responses. It escapes the message
 * to avoid SVG injection.
 *
 * @param message - The human-readable message to display inside the SVG.
 * @returns A TrustedSVG string containing a single text node with the message.
 * @source
 */
function svgError(message: string): TrustedSVG {
  const escaped = escapeForXml(message);
  const svg = `<?xml version="1.0" encoding="UTF-8"?>
  <!DOCTYPE svg PUBLIC "-//W3C//DTD SVG 1.1//EN" "http://www.w3.org/Graphics/SVG/1.1/DTD/svg11.dtd">
  <svg width="800" height="400" viewBox="0 0 800 400" xmlns="http://www.w3.org/2000/svg">
    <style>
      .error-text {
        font-family: monospace;
        font-size: 20px;
        fill: #ff5555;
      }
    </style>
    <rect width="100%" height="100%" fill="#1a1a1a"/>
    <text x="50%" y="50%" class="error-text"
          text-anchor="middle" dominant-baseline="middle">
      ${escaped}
    </text>
  </svg>`;
  return markTrustedSvg(svg);
}

/**
 * Format a CardDataError's message with a suitable prefix depending on status.
 *
 * Client errors are prefixed with 'Client Error:' unless they're 'Not Found',
 * and server errors are prefixed with 'Server Error:' to keep responses
 * consistent for listeners and debugging.
 *
 * @param err - CardDataError containing status and message.
 * @returns A prefixed, human-readable message.
 * @source
 */
function formatCardDataErrorMessage(err: CardDataError): string {
  const raw = String(err?.message ?? "");
  if (err.status === 404) {
    return raw.startsWith("Not Found:") ? raw : `Not Found: ${raw}`;
  }
  if (err.status >= 400 && err.status < 500) {
    return raw.startsWith("Client Error:") || raw.startsWith("Not Found:") ? raw : `Client Error: ${raw}`;
  }
  return raw.startsWith("Server Error:") ? raw : `Server Error: ${raw}`;
}

/**
 * Headers used for successful SVG responses.
 *
 * These include caching and CORS headers and expose the card border radius
 * in a response header so clients can render a placeholder sized correctly.
 *
 * @param request - Optional incoming request used to determine allowed origin.
 * @returns A headers object suitable for passing to Response.
 * @source
 */
function svgHeaders(request?: Request) {
  const allowedOrigin = getAllowedCardSvgOrigin(request);
  return {
    "Content-Type": "image/svg+xml",
    "Cache-Control": "public, max-age=86400, stale-while-revalidate=86400", // 24 hour cache, revalidate in background
    "Access-Control-Allow-Origin": allowedOrigin,
    "Access-Control-Allow-Methods": "GET, HEAD",
    "Access-Control-Expose-Headers": "X-Card-Border-Radius",
    Vary: "Origin", // Cache varies based on Origin header
    "X-Card-Border-Radius": String(DEFAULT_CARD_BORDER_RADIUS),
  };
}

/**
 * Headers used for error SVG responses.
 *
 * Error responses are not cached and use CORS headers consistent with the
 * card SVG responses. This ensures the browser doesn't persist erroneous
 * output for long.
 *
 * @param request - Optional incoming request used to determine allowed origin.
 * @returns A headers object suitable for passing to Response.
 * @source
 */
function errorHeaders(request?: Request) {
  const allowedOrigin = getAllowedCardSvgOrigin(request);
  return {
    "Content-Type": "image/svg+xml",
    "Cache-Control": "no-store, max-age=0, must-revalidate", // No cache, force revalidation
    "Access-Control-Allow-Origin": allowedOrigin,
    "Access-Control-Allow-Methods": "GET, HEAD",
    "Access-Control-Expose-Headers": "X-Card-Border-Radius",
    Vary: "Origin", // Header varies based on Origin
    "X-Card-Border-Radius": String(DEFAULT_CARD_BORDER_RADIUS),
  };
}

/**
 * Parsed and validated parameters required by the card renderer.
 *
 * Numeric and normalized inputs are provided so subsequent logic can assume
 * well-formed values.
 * @source
 */
interface ValidatedParams {
  userId: string;
  cardType: string;
  numericUserId: number;
  baseCardType: string;
  variationParam: string | null;
  showFavoritesParam: string | null;
  statusColorsParam: string | null;
  piePercentagesParam: string | null;
}

/**
 * Extracts required query parameters from the request and performs validation.
 *
 * If validation fails, a Response with an appropriate SVG error is returned.
 * Otherwise, a Normalized ValidatedParams object is returned.
 *
 * @param request - The incoming HTTP request containing the query string.
 * @returns ValidatedParams on success, or an HTTP Response (SVG error) on failure.
 * @source
 */
function extractAndValidateParams(
  request: Request,
): ValidatedParams | Response {
  const { searchParams } = new URL(request.url);
  const userId = searchParams.get("userId");
  const cardType = searchParams.get("cardType");

  if (!userId || !cardType) {
    const missingParam = userId ? "cardType" : "userId";
    console.warn(`⚠️ [Card SVG] Missing parameter: ${missingParam}`);
    return new Response(
      toCleanSvgResponse(
        svgError(`Client Error: Missing parameter: ${missingParam}`),
      ),
      {
        headers: errorHeaders(request),
        status: 400,
      },
    );
  }

  const numericUserId = Number.parseInt(userId);
  if (Number.isNaN(numericUserId)) {
    console.warn(`⚠️ [Card SVG] Invalid user ID format: ${userId}`);
    return new Response(
      toCleanSvgResponse(svgError("Client Error: Invalid user ID")),
      {
        headers: errorHeaders(request),
        status: 400,
      },
    );
  }

  const [baseCardType] = cardType.split("-");
  if (!ALLOWED_CARD_TYPES.has(baseCardType)) {
    console.warn(`⚠️ [Card SVG] Invalid card type: ${cardType}`);
    return new Response(
      toCleanSvgResponse(svgError("Client Error: Invalid card type")),
      {
        headers: errorHeaders(request),
        status: 400,
      },
    );
  }

  return {
    userId,
    cardType,
    numericUserId,
    baseCardType,
    variationParam: searchParams.get("variation"),
    showFavoritesParam: searchParams.get("showFavorites"),
    statusColorsParam: searchParams.get("statusColors"),
    piePercentagesParam: searchParams.get("piePercentages"),
  };
}

/**
 * Track analytics metrics for failed card SVG requests.
 *
 * Metrics are incremented for the overall endpoint, the base card type, and
 * optionally a status-specific metric so failures can be filtered.
 *
 * @param baseCardType - Optional base card type to attribute the metric to.
 * @param status - Optional HTTP status code for the failed request.
 * @returns Promise that resolves once analytics calls are fired (errors are ignored).
 * @source
 */
async function trackFailedRequest(
  baseCardType?: string,
  status?: number,
): Promise<void> {
  incrementAnalytics(
    buildAnalyticsMetricKey("card_svg", "failed_requests"),
  ).catch(() => {});
  if (baseCardType) {
    incrementAnalytics(
      buildAnalyticsMetricKey("card_svg", "failed_requests") +
        `:${baseCardType}`,
    ).catch(() => {});
  }
  if (typeof status === "number") {
    incrementAnalytics(
      buildAnalyticsMetricKey("card_svg", "failed_requests") +
        `:status:${status}`,
    ).catch(() => {});
    if (baseCardType) {
      incrementAnalytics(
        buildAnalyticsMetricKey("card_svg", "failed_requests") +
          `:${baseCardType}:status:${status}`,
      ).catch(() => {});
    }
  }
}

/**
 * Track analytics metrics for successful card SVG requests.
 *
 * This records an overall success metric and a base-card-type-scoped metric.
 *
 * @param baseCardType - The base card type that was successfully rendered.
 * @returns Promise that resolves once analytics calls are fired.
 * @source
 */
async function trackSuccessfulRequest(baseCardType: string): Promise<void> {
  incrementAnalytics(
    buildAnalyticsMetricKey("card_svg", "successful_requests"),
  ).catch(() => {});
  incrementAnalytics(
    buildAnalyticsMetricKey("card_svg", "successful_requests") +
      `:${baseCardType}`,
  ).catch(() => {});
}

/**
 * GET handler for generating card SVGs.
 *
 * Workflow:
 * 1. Rate-limit by source IP.
 * 2. Validate query params and translate them to a normalized shape.
 * 3. Fetch and normalize user/card data.
 * 4. Generate the card SVG and return it with cache/CORS headers.
 *
 * Returns a suitable SVG error response on client errors, rate-limiting, or
 * on server failures.
 *
 * @param request - The incoming GET request for the card endpoint.
 * @returns A Response containing an SVG (card or error).
 * @source
 */
export async function GET(request: Request) {
  const startTime = Date.now();
  const ip = request.headers.get("x-forwarded-for") || "127.0.0.1";

  const rateLimitResponse = await checkRateLimit(
    ip,
    "Card SVG",
    "card_svg",
    ratelimit,
  );
  if (rateLimitResponse) {
    return new Response(
      toCleanSvgResponse(
        svgError("Client Error: Too many requests - try again later"),
      ),
      {
        headers: errorHeaders(request),
        status: 429,
      },
    );
  }

  console.log(`🚀 [Card SVG] New request from IP: ${ip} - URL: ${request.url}`);

  const paramsResult = extractAndValidateParams(request);
  if (paramsResult instanceof Response) {
    await trackFailedRequest(undefined, paramsResult.status);
    return paramsResult;
  }

  const params = paramsResult;
  console.log(
    `🖼️ [Card SVG] Request for ${params.cardType} card - User ID: ${params.userId}`,
  );

  try {
    /**
     * Local handler that converts CardDataError instances into a proper SVG
     * response and sends analytics for the failure. It is defined inline to
     * capture the request and params scope.
     *
     * @param err - The CardDataError to convert.
     * @returns A Response containing an error SVG with proper status code.
     * @source
     */
    async function handleCardDataError(err: CardDataError): Promise<Response> {
      await trackFailedRequest(params.baseCardType, err.status);
      return new Response(
        toCleanSvgResponse(svgError(formatCardDataErrorMessage(err))),
        { headers: errorHeaders(request), status: err.status },
      );
    }

    let cardDoc: CardsRecord;
    let userDoc: UserRecord;
    try {
      const data = await fetchUserData(params.numericUserId);
      cardDoc = data.cardDoc;
      userDoc = data.userDoc;
    } catch (err: unknown) {
      if (err instanceof CardDataError) return handleCardDataError(err);
      throw err;
    }

    const validationResult = validateAndNormalizeUserRecord(userDoc);
    if ("error" in validationResult) {
      const status = validationResult.status ?? 500;
      void trackFailedRequest(params.baseCardType, status);
      if (status === 404) {
        return new Response(
          toCleanSvgResponse(svgError("Not Found: Missing card configuration or stats data")),
          {
            headers: errorHeaders(request),
            status: 404,
          },
        );
      }
      return new Response(
        toCleanSvgResponse(svgError(`Server Error: ${validationResult.error}`)),
        { headers: errorHeaders(request), status },
      );
    }
    userDoc = validationResult.normalized;

    let cardConfig: StoredCardConfig;
    let effectiveVariation: string;
    let favorites: string[] = [];
    try {
      const processed = processCardConfig(cardDoc, params, userDoc);
      cardConfig = processed.cardConfig;
      effectiveVariation = processed.effectiveVariation;
      favorites = processed.favorites;
    } catch (err: unknown) {
      if (err instanceof CardDataError) return handleCardDataError(err);
      throw err;
    }

    console.log(
      `🎨 [Card SVG] Generating ${params.cardType} (${effectiveVariation}) SVG for user ${params.numericUserId}`,
    );

    let svgContent: TrustedSVG;
    try {
      svgContent = generateCardSvg(
        cardConfig,
        userDoc,
        effectiveVariation as
          | "default"
          | "vertical"
          | "pie"
          | "compact"
          | "minimal"
          | "bar"
          | "horizontal",
        favorites,
      );
    } catch (err: unknown) {
      if (err instanceof CardDataError) return handleCardDataError(err);
      throw err;
    }

    const duration = Date.now() - startTime;
    if (duration > 1500) {
      console.warn(
        `⏳ [Card SVG] Slow rendering detected: ${duration}ms for user ${params.numericUserId}`,
      );
    }

    console.log(
      `✅ [Card SVG] Rendered ${params.cardType} card for ${params.numericUserId} in ${duration}ms`,
    );

    await trackSuccessfulRequest(params.baseCardType);

    const cleaned = toCleanSvgResponse(svgContent);

    const headerRadius = getCardBorderRadius(cardConfig.borderRadius);
    const responseHeaders = {
      ...svgHeaders(request),
      "X-Card-Border-Radius": String(headerRadius),
    } as Record<string, string>;

    return new Response(cleaned, {
      headers: responseHeaders,
    });
  } catch (error: unknown) {
    const duration = Date.now() - startTime;

    console.error(
      `🔥 [Card SVG] Error generating card for user ${params.numericUserId} after ${duration}ms:`,
      error,
    );

    if (error instanceof Error && error.stack) {
      console.error(`💥 [Card SVG] Stack Trace: ${error.stack}`);
    }

    await trackFailedRequest(params.baseCardType, 500);

    return new Response(
      toCleanSvgResponse(svgError("Server Error: An internal error occurred")),
      {
        headers: errorHeaders(request),
        status: 500,
      },
    );
  }
}
