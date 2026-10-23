import {
  getAllowedCardSvgOrigin,
  doesCardSvgOriginVary,
  createRateLimiter,
  checkRateLimit,
} from "@/lib/api-utils";
import {
  getCardBorderRadius,
  DEFAULT_CARD_BORDER_RADIUS,
  markTrustedSvg,
} from "@/lib/utils";
import { buildErrorCardSvg } from "@/lib/svg-templates/error-card";
import generateCardSvg from "@/lib/card-generator";
import {
  fetchUserData,
  fetchUserDataForCard,
  validateAndNormalizeUserRecord,
  processCardConfig,
  CardDataError,
  resolveUserIdFromUsername,
  needsCardConfigFromDb,
  classifyCardConfigSource,
  buildCardConfigFromParams,
  processFavorites,
} from "@/lib/card-data";
import { toCleanSvgResponse, type TrustedSVG } from "@/lib/types/svg";
import {
  generateCacheKey,
  getSvgFromMemoryCache,
  setSvgInMemoryCache,
} from "@/lib/stores/svg-cache";
import { trackUserActionError } from "@/lib/error-tracking";
import { buildCardUrlProfile } from "@/lib/server/url-usage";
import { recordUserCardRequest } from "@/lib/server/user-activity";
import {
  createCardRequestMetrics,
  type CardRequestMetrics,
} from "@/lib/server/card-metrics";

/** Rate limiter for card SVG requests to prevent abuse. @source */
const ratelimit = createRateLimiter({ limit: 150, window: "10 s" });

/** Whitelist of supported card types the API will render. @source */
const ALLOWED_CARD_TYPES = new Set([
  "animeStats",
  "socialStats",
  "socialMilestones",
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
  "animeSourceMaterialDistribution",
  "animeSeasonalPreference",
  "animeEpisodeLengthPreferences",
  "animeGenreSynergy",
  "animeScoreDistribution",
  "mangaScoreDistribution",
  "animeYearDistribution",
  "mangaYearDistribution",
  "animeCountry",
  "mangaCountry",
  "profileOverview",
  "favoritesSummary",
  "favoritesGrid",
  "activityHeatmap",
  "recentActivitySummary",
  "recentActivityFeed",
  "activityStreaks",
  "topActivityDays",
  "statusCompletionOverview",
  "milestones",
  "personalRecords",
  "planningBacklog",
  "mostRewatched",
  "currentlyWatchingReading",
  "animeMangaOverview",
  "scoreCompareAnimeManga",
  "countryDiversity",
  "genreDiversity",
  "formatPreferenceOverview",
  "releaseEraPreference",
  "startYearMomentum",
  "lengthPreference",
  "tagCategoryDistribution",
  "tagDiversity",
  "seasonalViewingPatterns",
  "droppedMedia",
  "reviewStats",
  "studioCollaboration",
]);

/**
 * Generate the error SVG returned for a failed card request.
 *
 * Error responses are the only place the API returns a card that is not
 * generated from user data, so the size and wrapping rules live with the
 * template rather than this route. See `buildErrorCardSvg`.
 *
 * @param message - The human-readable message to display inside the SVG.
 * @returns A TrustedSVG containing the wrapped message.
 * @source
 */
function svgError(message: string): TrustedSVG {
  return buildErrorCardSvg(message);
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
    return raw.startsWith("Client Error:") || raw.startsWith("Not Found:")
      ? raw
      : `Client Error: ${raw}`;
  }
  return raw.startsWith("Server Error:") ? raw : `Server Error: ${raw}`;
}

/**
 * Headers used for successful SVG responses.
 *
 * These include aggressive caching and CORS headers, exposing the card border radius
 * in a response header so clients can render a placeholder sized correctly.
 *
 * Implements stale-while-revalidate pattern:
 * - max-age: 24 hours (browser cache fresh for a full day)
 * - s-maxage: 24 hours (required for Vercel's CDN to cache a function response;
 *   without it the edge stores the response only via max-age)
 * - stale-while-revalidate: 7 days (continue serving stale content for a week while revalidating)
 * - stale-if-error: 14 days (serve stale if origin is down)
 *
 * Vercel consumes `s-maxage`, `stale-while-revalidate`, and `stale-if-error` and
 * strips them from the copy sent to the browser, so the client sees only
 * `public, max-age=86400`.
 *
 * @param request - Optional incoming request used to determine allowed origin.
 * @returns A headers object suitable for passing to Response.
 * @source
 */
function svgHeaders(request?: Request) {
  const allowedOrigin = getAllowedCardSvgOrigin(request);
  return {
    "Content-Type": "image/svg+xml",
    "Cache-Control":
      "public, max-age=86400, s-maxage=86400, stale-while-revalidate=604800, stale-if-error=1209600",
    "Access-Control-Allow-Origin": allowedOrigin,
    "Access-Control-Allow-Methods": "GET, HEAD",
    "Access-Control-Expose-Headers": "X-Card-Border-Radius, X-Cache-Source",
    // Only declared when the origin depends on the request. A constant origin
    // does not need the variance, and declaring it stored one copy of every
    // card per embedding context.
    ...(doesCardSvgOriginVary() ? { Vary: "Origin" } : {}),
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
    // Errors are never cached, so the variance costs nothing to declare and
    // keeps the header correct when the origin is request-derived.
    ...(doesCardSvgOriginVary() ? { Vary: "Origin" } : {}),
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
  userName: string | null;
  cardType: string;
  numericUserId: number;
  baseCardType: string;
  variationParam: string | null;
  showFavoritesParam: string | null;
  statusColorsParam: string | null;
  piePercentagesParam: string | null;
  gridColsParam: string | null;
  gridRowsParam: string | null;
  colorPresetParam: string | null;
  titleColorParam: string | null;
  backgroundColorParam: string | null;
  textColorParam: string | null;
  circleColorParam: string | null;
  borderColorParam: string | null;
  borderRadiusParam: string | null;
  // Cache busting param
  _t: string | null;
}

/**
 * Extracts required query parameters from the request and performs validation.
 *
 * If validation fails, a Response with an appropriate SVG error is returned.
 * Otherwise, a Normalized ValidatedParams object is returned.
 *
 * Supports both userId and userName parameters. At least one must be provided.
 * If only userName is provided, the API will need to look up the userId from the database.
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
  const userName = searchParams.get("userName");
  const cardType = searchParams.get("cardType");

  // Must have cardType
  if (!cardType) {
    console.warn(`⚠️ [Card SVG] Missing parameter: cardType`);
    return new Response(
      toCleanSvgResponse(svgError(`Client Error: Missing parameter: cardType`)),
      {
        headers: errorHeaders(request),
        status: 400,
      },
    );
  }

  // Must have either userId or userName
  if (!userId && !userName) {
    console.warn(`⚠️ [Card SVG] Missing parameter: userId or userName`);
    return new Response(
      toCleanSvgResponse(
        svgError(`Client Error: Missing parameter: userId or userName`),
      ),
      {
        headers: errorHeaders(request),
        status: 400,
      },
    );
  }

  // If userId is provided, validate it's numeric
  let numericUserId = 0;
  if (userId) {
    numericUserId = Number.parseInt(userId);
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
    userId: userId || "",
    userName,
    cardType,
    numericUserId,
    baseCardType,
    variationParam: searchParams.get("variation"),
    showFavoritesParam: searchParams.get("showFavorites"),
    statusColorsParam: searchParams.get("statusColors"),
    piePercentagesParam: searchParams.get("piePercentages"),
    gridColsParam: searchParams.get("gridCols"),
    gridRowsParam: searchParams.get("gridRows"),
    colorPresetParam: searchParams.get("colorPreset"),
    titleColorParam: searchParams.get("titleColor"),
    backgroundColorParam: searchParams.get("backgroundColor"),
    textColorParam: searchParams.get("textColor"),
    circleColorParam: searchParams.get("circleColor"),
    borderColorParam: searchParams.get("borderColor"),
    borderRadiusParam: searchParams.get("borderRadius"),
    _t: searchParams.get("_t"),
  };
}

/**
 * Resolves the effective user ID from either the numeric userId or userName.
 * Returns the userId if provided, otherwise looks up the userId from userName.
 *
 * @param params - Validated parameters containing userId and userName.
 * @param request - The incoming request, used to build an error response.
 * @param metrics - Batched metrics for the request; records a failure.
 * @returns Object with resolved userId or an error response.
 * @source
 */
async function resolveEffectiveUserId(
  params: ValidatedParams,
  request: Request,
  metrics: CardRequestMetrics,
): Promise<{ userId: number } | { error: Response }> {
  if (params.numericUserId) {
    return { userId: params.numericUserId };
  }

  if (params.userName) {
    const resolvedUserId = await resolveUserIdFromUsername(params.userName);
    if (resolvedUserId) {
      return { userId: resolvedUserId };
    }

    console.warn(
      `⚠️ [Card SVG] User not found for userName: ${params.userName}`,
    );
    metrics.recordFailure();
    return {
      error: new Response(
        toCleanSvgResponse(svgError("Not Found: User not found")),
        { headers: errorHeaders(request), status: 404 },
      ),
    };
  }

  // This shouldn't happen due to validation, but handle it anyway
  metrics.recordFailure();
  return {
    error: new Response(
      toCleanSvgResponse(svgError("Client Error: Missing user identifier")),
      { headers: errorHeaders(request), status: 400 },
    ),
  };
}

/**
 * Handles user record validation errors and returns appropriate error responses.
 * @source
 */
function handleValidationError(
  validationResult: { error: string; status?: number },
  request: Request,
  metrics: CardRequestMetrics,
): Response {
  const status = validationResult.status ?? 500;
  metrics.recordFailure();

  if (status === 404) {
    return new Response(
      toCleanSvgResponse(
        svgError("Not Found: Missing card configuration or stats data"),
      ),
      { headers: errorHeaders(request), status: 404 },
    );
  }

  return new Response(
    toCleanSvgResponse(svgError(`Server Error: ${validationResult.error}`)),
    { headers: errorHeaders(request), status },
  );
}

/**
 * Creates a CardDataError response.
 * @source
 */
async function handleCardDataError(
  err: CardDataError,
  request: Request,
  baseCardType: string,
  metrics: CardRequestMetrics,
): Promise<Response> {
  metrics.recordFailure();

  // Track error with context
  trackUserActionError(
    `card_svg_generation_${baseCardType}`,
    err,
    err.category,
    {
      statusCode: err.status,
    },
  );

  return new Response(
    toCleanSvgResponse(svgError(formatCardDataErrorMessage(err))),
    { headers: errorHeaders(request), status: err.status },
  );
}

/**
 * Where the SVG in a response came from.
 *
 * `memory` means this process already had the render. `render` means the card
 * was produced for this request. `bypass` means the request carried a `_t`
 * parameter, which asks for a render that does not use a stored copy.
 *
 * @source
 */
type CardCacheSource = "memory" | "render" | "bypass";

/**
 * Creates the success response with SVG content and headers.
 *
 * Every served card records a card request for the resolved user, because this
 * is the one funnel all successful paths pass through: cache hit and fresh
 * render. Failed requests do not record activity, so they cannot keep
 * a removed or invalid user looking active.
 *
 * @param svgContent - The trusted SVG to return.
 * @param request - The incoming request, used to build CORS headers.
 * @param borderRadius - The card's border radius, returned in a header.
 * @param userId - The resolved user the card belongs to.
 * @param cacheSource - Where the SVG came from, returned in `X-Cache-Source`.
 * @source
 */
function createSuccessResponse(
  svgContent: TrustedSVG,
  request: Request,
  borderRadius: number | undefined,
  userId: number,
  cacheSource: CardCacheSource,
): Response {
  void recordUserCardRequest(userId);
  const cleaned = toCleanSvgResponse(svgContent);
  const headerRadius = getCardBorderRadius(borderRadius);
  const responseHeaders = {
    ...svgHeaders(request),
    "X-Card-Border-Radius": String(headerRadius),
    "X-Cache-Source": cacheSource,
  } as Record<string, string>;
  return new Response(cleaned, { headers: responseHeaders });
}

/**
 * Creates a 500 internal server error response.
 * @source
 */
function createInternalErrorResponse(request: Request): Response {
  return new Response(
    toCleanSvgResponse(svgError("Server Error: An internal error occurred")),
    { headers: errorHeaders(request), status: 500 },
  );
}

/**
 * GET handler for generating card SVGs.
 *
 * Workflow:
 * 1. Rate-limit by source IP.
 * 2. Check in-memory LRU cache (fast path).
 * 3. Validate query params and translate them to a normalized shape.
 * 4. Fetch and normalize user/card data.
 * 5. Generate the card SVG and return it with cache/CORS headers.
 * 6. Cache result for next time (LRU).
 *
 * Returns a suitable SVG error response on client errors, rate-limiting, or
 * on server failures. Implements stale-while-revalidate for cache efficiency.
 *
 * @param request - The incoming GET request for the card endpoint.
 * @returns A Response containing an SVG (card or error).
 * @source
 */
export async function GET(request: Request) {
  const startTime = Date.now();
  const ip = request.headers.get("x-forwarded-for") || "127.0.0.1";

  const rateLimitResponse = await checkRateLimit(
    request,
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
      { headers: errorHeaders(request), status: 429 },
    );
  }

  console.log(`🚀 [Card SVG] New request from IP: ${ip} - URL: ${request.url}`);

  // One pipeline holds every analytics counter and URL-profile write this
  // request makes.
  const metrics = createCardRequestMetrics();

  const paramsResult = extractAndValidateParams(request);
  if (paramsResult instanceof Response) {
    metrics.recordFailure();
    await metrics.flush();
    return paramsResult;
  }
  const params = paramsResult;

  const userIdResult = await resolveEffectiveUserId(params, request, metrics);
  if ("error" in userIdResult) {
    await metrics.flush();
    return userIdResult.error;
  }
  const effectiveUserId = userIdResult.userId;

  console.log(
    `🖼️ [Card SVG] Request for ${params.cardType} card - User ID: ${effectiveUserId}`,
  );

  // Canonical URL profile for the cards-key removal audit. Built before the
  // cache lookup so cache hits are counted, and written once per request at the
  // terminal points below so background revalidation cannot double count.
  const cardConfigClassification = classifyCardConfigSource(params);
  let trackingUserIdentifier:
    { type: "userId" | "userName"; value: string } | undefined;
  if (params.userId) {
    trackingUserIdentifier = { type: "userId", value: params.userId };
  } else if (params.userName) {
    trackingUserIdentifier = { type: "userName", value: params.userName };
  }
  const urlProfile = buildCardUrlProfile({
    routePath: new URL(request.url).pathname,
    cardType: params.cardType,
    baseCardType: params.baseCardType,
    variationParam: params.variationParam,
    colorPresetParam: params.colorPresetParam,
    titleColorParam: params.titleColorParam,
    backgroundColorParam: params.backgroundColorParam,
    textColorParam: params.textColorParam,
    circleColorParam: params.circleColorParam,
    borderColorParam: params.borderColorParam,
    borderRadiusParam: params.borderRadiusParam,
    showFavoritesParam: params.showFavoritesParam,
    statusColorsParam: params.statusColorsParam,
    piePercentagesParam: params.piePercentagesParam,
    gridColsParam: params.gridColsParam,
    gridRowsParam: params.gridRowsParam,
    classification: cardConfigClassification,
  });

  const normalizeGridDim = (raw: string | null | undefined, fallback = 3) => {
    if (raw === null || raw === undefined) return fallback;
    const parsed = Number.parseInt(raw, 10);
    if (Number.isNaN(parsed)) return fallback;
    return Math.max(1, Math.min(5, parsed));
  };
  const normalizedGridCols = normalizeGridDim(params.gridColsParam);
  const normalizedGridRows = normalizeGridDim(params.gridRowsParam);

  const cacheKey = generateCacheKey(effectiveUserId, params.cardType, {
    variation: params.variationParam,
    colorPreset: params.colorPresetParam,
    titleColor: params.titleColorParam,
    backgroundColor: params.backgroundColorParam,
    textColor: params.textColorParam,
    circleColor: params.circleColorParam,
    borderColor: params.borderColorParam,
    borderRadius: params.borderRadiusParam,
    showFavorites: params.showFavoritesParam,
    statusColors: params.statusColorsParam,
    piePercentages: params.piePercentagesParam,
    gridCols: normalizedGridCols,
    gridRows: normalizedGridRows,
  });

  // The `_t` parameter is deliberately absent from the key. It exists to bust
  // the browser and CDN copies, not to describe the render, so including it
  // would turn every request into a unique key.
  //
  // Its presence is also a request to not use a stored copy. A caller that
  // adds `_t` wants the card rendered from current data, so the server cache
  // is skipped for that request. The value is irrelevant: only its presence
  // matters. Every other request is served from the cache when it can be.
  const bypassCache = params._t !== null;
  const cachedEntry = bypassCache ? null : getSvgFromMemoryCache(cacheKey);
  if (cachedEntry) {
    metrics.recordCache("hit");

    console.log(
      `⚡ [Card SVG] Served from memory cache for user ${effectiveUserId} in ${Date.now() - startTime}ms`,
    );
    metrics.recordUrlProfile(
      urlProfile,
      { cache: "hit", status: 200 },
      cardConfigClassification.source === "db"
        ? trackingUserIdentifier
        : undefined,
    );
    metrics.flushInBackground();
    return createSuccessResponse(
      markTrustedSvg(cachedEntry.svg),
      request,
      cachedEntry.borderRadius,
      effectiveUserId,
      "memory",
    );
  }

  // A miss in this process renders the card. There is no shared tier to check,
  // so a miss here is the real miss that the counter records.
  metrics.recordCache("miss");
  if (bypassCache) metrics.recordCacheBypass();

  const response = await generateCardResponse(
    request,
    params,
    effectiveUserId,
    startTime,
    metrics,
    cacheKey,
    bypassCache,
  );
  metrics.recordUrlProfile(
    urlProfile,
    { cache: "miss", status: response.status },
    cardConfigClassification.source === "db"
      ? trackingUserIdentifier
      : undefined,
  );
  await metrics.flush();
  return response;
}

/**
 * Loads user and card configuration data for card generation.
 *
 * This function centralizes the conditional flow that previously lived
 * in generateCardResponse: fetching user and card documents from the DB
 * when needed, normalizing and validating the user record, and building
 * a card configuration from URL params when DB card config is not required.
 *
 * It returns an object with the resolved data on success, or an object
 * with an `error` response to be returned from the route on failure.
 */
async function loadUserAndCardConfig(
  needsDbCardConfig: boolean,
  params: ValidatedParams,
  effectiveUserId: number,
  request: Request,
  metrics: CardRequestMetrics,
): Promise<
  | {
      userDoc: import("@/lib/types/records").UserRecord;
      cardConfig: import("@/lib/types/records").StoredCardConfig;
      effectiveVariation: string;
      favorites: string[];
    }
  | { error: Response }
> {
  if (needsDbCardConfig) {
    const data = await fetchUserData(effectiveUserId, params.cardType);
    const { cardDoc } = data;
    let userDoc = data.userDoc;

    const validationResult = validateAndNormalizeUserRecord(userDoc);
    if ("error" in validationResult) {
      return {
        error: handleValidationError(validationResult, request, metrics),
      };
    }
    userDoc = validationResult.normalized;

    const processed = processCardConfig(cardDoc, params, userDoc);
    return {
      userDoc,
      cardConfig: processed.cardConfig,
      effectiveVariation: processed.effectiveVariation,
      favorites: processed.favorites,
    };
  }

  // Not using DB card config; fetch user only and build config from params
  const userDoc = await fetchUserDataForCard(effectiveUserId, params.cardType);
  const validationResult = validateAndNormalizeUserRecord(userDoc);
  if ("error" in validationResult) {
    return {
      error: handleValidationError(validationResult, request, metrics),
    };
  }

  const normalized = validationResult.normalized;
  const cardConfig = buildCardConfigFromParams(params);
  const effectiveVariation =
    params.variationParam || cardConfig.variation || "default";
  const favorites = processFavorites(
    params.baseCardType,
    params.showFavoritesParam,
    cardConfig.showFavorites,
    normalized,
  );

  return {
    userDoc: normalized,
    cardConfig,
    effectiveVariation,
    favorites,
  };
}

async function generateCardResponse(
  request: Request,
  params: ValidatedParams,
  effectiveUserId: number,
  startTime: number,
  metrics: CardRequestMetrics,
  cacheKey?: string,
  bypassCache: boolean = false,
): Promise<Response> {
  try {
    const needsDbCardConfig = needsCardConfigFromDb(params);
    const loadResult = await loadUserAndCardConfig(
      needsDbCardConfig,
      params,
      effectiveUserId,
      request,
      metrics,
    );
    if ("error" in loadResult) {
      return loadResult.error;
    }

    const { userDoc, cardConfig, effectiveVariation, favorites } = loadResult;

    console.log(
      `🎨 [Card SVG] Generating ${params.cardType} (${effectiveVariation}) SVG for user ${effectiveUserId}${needsDbCardConfig ? " (with DB card lookup)" : " (from URL params)"}`,
    );

    const svgContent = await generateCardSvg(
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

    const duration = Date.now() - startTime;
    if (duration > 1500) {
      console.warn(
        `⏳ [Card SVG] Slow rendering detected: ${duration}ms for user ${effectiveUserId}`,
      );
    }
    console.log(
      `✅ [Card SVG] Rendered ${params.cardType} card for ${effectiveUserId} in ${duration}ms`,
    );

    // Keep the render in this process for the next request. Nothing is written
    // to Redis; the CDN holds the shared copy.
    //
    // A request that carried `_t` asked not to use a stored copy, but its
    // render is current, so it replaces the stored one. Otherwise the next
    // request without `_t` would still find the older render.
    if (cacheKey) {
      setSvgInMemoryCache(
        cacheKey,
        toCleanSvgResponse(svgContent),
        effectiveUserId,
        cardConfig.borderRadius,
      );
      console.log(`💾 [Card SVG] Cached SVG for ${effectiveUserId}`);
    }

    metrics.recordSuccess();
    return createSuccessResponse(
      svgContent,
      request,
      cardConfig.borderRadius,
      effectiveUserId,
      bypassCache ? "bypass" : "render",
    );
  } catch (err: unknown) {
    if (err instanceof CardDataError) {
      return handleCardDataError(err, request, params.baseCardType, metrics);
    }

    const duration = Date.now() - startTime;
    console.error(
      `🔥 [Card SVG] Error generating card for user ${effectiveUserId} after ${duration}ms:`,
      err,
    );
    if (err instanceof Error && err.stack) {
      console.error(`💥 [Card SVG] Stack Trace: ${err.stack}`);
    }

    // Track generic errors
    trackUserActionError(
      `card_svg_generation_${params.baseCardType}`,
      err instanceof Error ? err : new Error(String(err)),
      "server_error",
      {
        userId: String(effectiveUserId),
        statusCode: 500,
      },
    );

    metrics.recordFailure();
    return createInternalErrorResponse(request);
  }
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
