/**
 * Renders shareable AniCards SVGs for both saved configurations and stateless
 * URL-driven previews.
 *
 * This route sits between user/card storage and the SVG generator: it resolves
 * the effective config source, normalizes request params, and uses an in-memory
 * cache with stale-while-revalidate behavior so common embeds stay fast without
 * giving up freshness.
 */
import { colorPresets } from "@/components/stat-card-generator/constants";
import { getAllowedCardSvgOrigin } from "@/lib/api/cors";
import { isRedisBackplaneUnavailable } from "@/lib/api/errors";
import { logPrivacySafe } from "@/lib/api/logging";
import { parseStrictPositiveInteger } from "@/lib/api/primitives";
import {
  checkRateLimit,
  createRateLimiter,
  getRateLimitIdentity,
} from "@/lib/api/rate-limit";
import {
  ensureRequestContext,
  getOperationId,
  withRequestIdHeaders,
} from "@/lib/api/request-context";
import {
  buildAnalyticsMetricKey,
  buildFailedRequestMetricKeys,
  buildLatencyBucketMetricKeys,
  incrementAnalyticsBatch,
  scheduleDeferredAnalyticsBatch,
  scheduleTelemetryTask,
} from "@/lib/api/telemetry";
import {
  buildCardConfigFromParams,
  CardDataError,
  fetchStoredCardsRecordCacheStamp,
  fetchUserDataForCardWithState,
  fetchUserDataWithState,
  needsCardConfigFromDb,
  processCardConfig,
  processFavorites,
  resolveUserIdFromUsername,
} from "@/lib/card-data";
import {
  getRequiredAggregateKeyForCardType,
  userHasRequiredAggregateForCardType,
  validateUserRecordForCardRender,
} from "@/lib/card-data/validation";
import generateCardSvg from "@/lib/card-generator";
import { trackUserActionError } from "@/lib/error-tracking";
import {
  generateCacheKey,
  getRemainingSvgCacheLifetimeMs,
  getSvgFromMemoryCache,
  getSvgFromSharedCache,
  releaseSvgRevalidationLock,
  setSvgInMemoryCache,
  setSvgInSharedCache,
  trackCacheMetric,
  tryAcquireSvgRevalidationLock,
} from "@/lib/stores/svg-cache";
import type {
  CardsRecord,
  CardsRecordMetadata,
  UserRecord,
} from "@/lib/types/records";
import { toCleanSvgResponse, type TrustedSVG } from "@/lib/types/svg";
import {
  DEFAULT_CARD_BORDER_RADIUS,
  escapeForXml,
  getCardBorderRadius,
  getColorInvalidReason,
  markTrustedSvg,
  validateColorValue,
} from "@/lib/utils";

export const runtime = "nodejs";

const PREVIEW_MEDIA_X_ROBOTS_TAG = "noindex, noimageindex, noarchive";

/** Rate limiter for card SVG requests to prevent abuse. @source */
const ratelimit = createRateLimiter({
  limit: 150,
  window: "10 s",
  hotPath: true,
});
const anonymousRatelimit = createRateLimiter({
  limit: 30,
  window: "10 s",
  hotPath: true,
});

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
  "recentActivitySummary",
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

const COLOR_QUERY_PARAM_NAMES = [
  "titleColor",
  "backgroundColor",
  "textColor",
  "circleColor",
  "borderColor",
] as const;

const CARD_NO_STORE_CACHE_CONTROL = "no-store, max-age=0, must-revalidate";
const CARD_NO_STORE_EDGE_CACHE_CONTROL = "no-store";
const CARD_CANONICAL_CACHE_CONTROL =
  "public, max-age=86400, stale-while-revalidate=604800, stale-if-error=1209600";
const CARD_CANONICAL_EDGE_CACHE_CONTROL =
  "public, s-maxage=86400, stale-while-revalidate=604800, stale-if-error=1209600";
const CARD_VARIANT_CACHE_CONTROL =
  "public, max-age=3600, stale-while-revalidate=86400, stale-if-error=604800";
const CARD_VARIANT_EDGE_CACHE_CONTROL =
  "public, s-maxage=3600, stale-while-revalidate=86400, stale-if-error=604800";

const ALLOWED_COLOR_PRESETS = new Set(Object.keys(colorPresets));

type CardSuccessCachePolicy = {
  cacheControl: string;
  edgeCacheControl: string;
};

const CARD_CANONICAL_CACHE_POLICY: CardSuccessCachePolicy = {
  cacheControl: CARD_CANONICAL_CACHE_CONTROL,
  edgeCacheControl: CARD_CANONICAL_EDGE_CACHE_CONTROL,
};

const CARD_VARIANT_CACHE_POLICY: CardSuccessCachePolicy = {
  cacheControl: CARD_VARIANT_CACHE_CONTROL,
  edgeCacheControl: CARD_VARIANT_EDGE_CACHE_CONTROL,
};

const CARD_REFRESH_CACHE_POLICY: CardSuccessCachePolicy = {
  cacheControl: CARD_NO_STORE_CACHE_CONTROL,
  edgeCacheControl: CARD_NO_STORE_EDGE_CACHE_CONTROL,
};

function getTrimmedSearchParam(
  searchParams: URLSearchParams,
  key: string,
): string | null {
  const value = searchParams.get(key);
  return value === null ? null : value.trim();
}

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
 * - max-age: 24 hours (cache fresh for a full day)
 * - stale-while-revalidate: 7 days (continue serving stale content for a week while revalidating)
 * - stale-if-error: 14 days (serve stale if origin is down)
 *
 * @param request - Optional incoming request used to determine allowed origin.
 * @returns A headers object suitable for passing to Response.
 * @source
 */
function svgHeaders(
  request?: Request,
  options?: {
    cacheSource?: string;
    cachePolicy?: CardSuccessCachePolicy;
  },
) {
  const allowedOrigin = getAllowedCardSvgOrigin(request);
  const cachePolicy = options?.cachePolicy ?? CARD_CANONICAL_CACHE_POLICY;
  return withRequestIdHeaders(
    {
      "Content-Type": "image/svg+xml",
      "Cache-Control": cachePolicy.cacheControl,
      "CDN-Cache-Control": cachePolicy.edgeCacheControl,
      "Edge-Cache-Control": cachePolicy.edgeCacheControl,
      "X-Robots-Tag": PREVIEW_MEDIA_X_ROBOTS_TAG,
      "Access-Control-Allow-Origin": allowedOrigin,
      "Access-Control-Allow-Methods": "GET, HEAD",
      "Access-Control-Expose-Headers": "X-Card-Border-Radius, X-Cache-Source",
      Vary: "Origin",
      "X-Card-Border-Radius": String(DEFAULT_CARD_BORDER_RADIUS),
      "X-Cache-Source": options?.cacheSource ?? "render",
    },
    request,
  );
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
function errorHeaders(
  request?: Request,
  options?: {
    extraHeaders?: Record<string, string>;
    exposeHeaders?: string[];
  },
) {
  const allowedOrigin = getAllowedCardSvgOrigin(request);
  const extraHeaders = options?.extraHeaders;
  const exposeHeaders = [
    "X-Card-Border-Radius",
    ...(options?.exposeHeaders ?? []),
  ];
  const headers = {
    "Content-Type": "image/svg+xml",
    "Cache-Control": CARD_NO_STORE_CACHE_CONTROL,
    "CDN-Cache-Control": CARD_NO_STORE_EDGE_CACHE_CONTROL,
    "Edge-Cache-Control": CARD_NO_STORE_EDGE_CACHE_CONTROL,
    "X-Robots-Tag": PREVIEW_MEDIA_X_ROBOTS_TAG,
    "Access-Control-Allow-Origin": allowedOrigin,
    "Access-Control-Allow-Methods": "GET, HEAD",
    "Access-Control-Expose-Headers": [...new Set(exposeHeaders)].join(", "),
    Vary: "Origin",
    "X-Card-Border-Radius": String(DEFAULT_CARD_BORDER_RADIUS),
  };

  return withRequestIdHeaders(
    extraHeaders
      ? {
          ...headers,
          ...extraHeaders,
        }
      : headers,
    request,
  );
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
  username: string | null;
  cardType: string;
  numericUserId: number;
  baseCardType: string;
  animationsEnabled: boolean;
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
  _t: string | null;
}

function areCardAnimationsEnabled(value: string | null): boolean {
  if (value === null) {
    return true;
  }

  return !["0", "false", "no", "off"].includes(value.trim().toLowerCase());
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
  const username = searchParams.get("username") ?? searchParams.get("userName");
  const cardType = searchParams.get("cardType");
  const colorPresetParam = getTrimmedSearchParam(searchParams, "colorPreset");
  const titleColorParam = getTrimmedSearchParam(searchParams, "titleColor");
  const backgroundColorParam = getTrimmedSearchParam(
    searchParams,
    "backgroundColor",
  );
  const textColorParam = getTrimmedSearchParam(searchParams, "textColor");
  const circleColorParam = getTrimmedSearchParam(searchParams, "circleColor");
  const borderColorParam = getTrimmedSearchParam(searchParams, "borderColor");

  if (!cardType) {
    logPrivacySafe(
      "warn",
      "Card SVG",
      "Missing parameter: cardType",
      undefined,
      request,
    );
    void trackFailedRequest({
      request,
      status: 400,
      reasonCode: "missing_card_type",
    });
    return new Response(
      toCleanSvgResponse(svgError(`Client Error: Missing parameter: cardType`)),
      {
        headers: errorHeaders(request),
        status: 400,
      },
    );
  }

  if (!userId && !username) {
    logPrivacySafe(
      "warn",
      "Card SVG",
      "Missing parameter: userId or username",
      undefined,
      request,
    );
    void trackFailedRequest({
      request,
      status: 400,
      reasonCode: "missing_user_identifier",
    });
    return new Response(
      toCleanSvgResponse(
        svgError(`Client Error: Missing parameter: userId or username`),
      ),
      {
        headers: errorHeaders(request),
        status: 400,
      },
    );
  }

  let numericUserId = 0;
  if (userId) {
    const parsedUserId = parseStrictPositiveInteger(userId);
    if (!parsedUserId) {
      logPrivacySafe(
        "warn",
        "Card SVG",
        "Invalid user ID format",
        { userId },
        request,
      );
      void trackFailedRequest({
        request,
        status: 400,
        reasonCode: "invalid_user_id",
      });
      return new Response(
        toCleanSvgResponse(svgError("Client Error: Invalid user ID")),
        {
          headers: errorHeaders(request),
          status: 400,
        },
      );
    }

    numericUserId = parsedUserId;
  }

  const [baseCardType] = cardType.split("-");
  if (!ALLOWED_CARD_TYPES.has(baseCardType)) {
    logPrivacySafe(
      "warn",
      "Card SVG",
      "Invalid card type",
      { cardType },
      request,
    );
    void trackFailedRequest({
      request,
      status: 400,
      reasonCode: "invalid_card_type",
    });
    return new Response(
      toCleanSvgResponse(svgError("Client Error: Invalid card type")),
      {
        headers: errorHeaders(request),
        status: 400,
      },
    );
  }

  if (
    colorPresetParam !== null &&
    !ALLOWED_COLOR_PRESETS.has(colorPresetParam)
  ) {
    logPrivacySafe(
      "warn",
      "Card SVG",
      "Invalid color preset query parameter",
      {
        colorPreset: colorPresetParam,
        validPresetCount: ALLOWED_COLOR_PRESETS.size,
      },
      request,
    );
    void trackFailedRequest({
      request,
      status: 400,
      reasonCode: "invalid_color_preset",
    });
    return new Response(
      toCleanSvgResponse(svgError("Client Error: Invalid colorPreset")),
      {
        headers: errorHeaders(request),
        status: 400,
      },
    );
  }

  const colorQueryParams = {
    titleColor: titleColorParam,
    backgroundColor: backgroundColorParam,
    textColor: textColorParam,
    circleColor: circleColorParam,
    borderColor: borderColorParam,
  } satisfies Record<(typeof COLOR_QUERY_PARAM_NAMES)[number], string | null>;

  for (const paramName of COLOR_QUERY_PARAM_NAMES) {
    const colorValue = colorQueryParams[paramName];
    if (colorValue === null || validateColorValue(colorValue)) {
      continue;
    }

    logPrivacySafe(
      "warn",
      "Card SVG",
      "Invalid color query parameter",
      {
        paramName,
        reason: getColorInvalidReason(colorValue) || undefined,
      },
      request,
    );
    void trackFailedRequest({
      request,
      status: 400,
      reasonCode: `invalid_${paramName}`,
    });
    return new Response(
      toCleanSvgResponse(svgError(`Client Error: Invalid ${paramName}`)),
      {
        headers: errorHeaders(request),
        status: 400,
      },
    );
  }

  return {
    userId: userId || "",
    username,
    cardType,
    numericUserId,
    baseCardType,
    animationsEnabled: areCardAnimationsEnabled(searchParams.get("animate")),
    variationParam: searchParams.get("variation"),
    showFavoritesParam: searchParams.get("showFavorites"),
    statusColorsParam: searchParams.get("statusColors"),
    piePercentagesParam: searchParams.get("piePercentages"),
    gridColsParam: searchParams.get("gridCols"),
    gridRowsParam: searchParams.get("gridRows"),
    colorPresetParam,
    titleColorParam,
    backgroundColorParam,
    textColorParam,
    circleColorParam,
    borderColorParam,
    borderRadiusParam: searchParams.get("borderRadius"),
    _t: searchParams.get("_t"),
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
async function trackFailedRequest(options?: {
  request?: Request;
  baseCardType?: string;
  status?: number;
  reasonCode?: string;
  durationMs?: number;
}): Promise<void> {
  const metric = buildAnalyticsMetricKey("card_svg", "failed_requests");
  const metrics = [
    ...buildFailedRequestMetricKeys("card_svg", options?.reasonCode),
  ];

  if (options?.baseCardType) {
    metrics.push(`${metric}:${options.baseCardType}`);
  }

  if (typeof options?.status === "number") {
    metrics.push(`${metric}:status:${options.status}`);
    if (options.baseCardType) {
      metrics.push(
        `${metric}:${options.baseCardType}:status:${options.status}`,
      );
    }
  }

  if (typeof options?.durationMs === "number") {
    metrics.push(
      ...buildLatencyBucketMetricKeys(
        "card_svg",
        options.durationMs,
        "failure",
      ),
    );
  }

  await incrementAnalyticsBatch(metrics);
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
async function trackSuccessfulRequest(
  baseCardType: string,
  request?: Request,
  durationMs?: number,
): Promise<void> {
  const metric = buildAnalyticsMetricKey("card_svg", "successful_requests");
  scheduleDeferredAnalyticsBatch(
    [
      metric,
      `${metric}:${baseCardType}`,
      ...(typeof durationMs === "number"
        ? buildLatencyBucketMetricKeys("card_svg", durationMs, "success")
        : []),
    ],
    {
      endpoint: "Card SVG",
      request,
      taskName: "card-svg-successful-requests",
    },
  );
}

/**
 * Resolves the effective user ID from either the numeric userId or username.
 * Returns the userId if provided, otherwise looks up the userId from username.
 *
 * @param params - Validated parameters containing userId and username.
 * @returns Object with resolved userId or an error response.
 * @source
 */
async function resolveEffectiveUserId(
  params: ValidatedParams,
  request: Request,
  startTime: number,
): Promise<{ userId: number } | { error: Response }> {
  if (params.numericUserId) {
    return { userId: params.numericUserId };
  }

  if (params.username) {
    let resolvedUserId: number | null;
    try {
      resolvedUserId = await resolveUserIdFromUsername(params.username);
    } catch (error) {
      if (isRedisBackplaneUnavailable(error)) {
        return {
          error: await handleCardDataError(
            new CardDataError(
              "Server Error: User data is temporarily unavailable",
              503,
            ),
            request,
            params.baseCardType,
            startTime,
          ),
        };
      }

      throw error;
    }

    if (resolvedUserId) {
      return { userId: resolvedUserId };
    }

    logPrivacySafe(
      "warn",
      "Card SVG",
      "User not found for username",
      { username: params.username },
      request,
    );
    await trackFailedRequest({
      request,
      baseCardType: params.baseCardType,
      status: 404,
      reasonCode: "not_found",
      durationMs: Date.now() - startTime,
    });
    return {
      error: new Response(
        toCleanSvgResponse(svgError("Not Found: User not found")),
        {
          headers: errorHeaders(request),
          status: 404,
        },
      ),
    };
  }

  await trackFailedRequest({
    request,
    baseCardType: params.baseCardType,
    status: 400,
    reasonCode: "missing_user_identifier",
    durationMs: Date.now() - startTime,
  });
  return {
    error: new Response(
      toCleanSvgResponse(svgError("Client Error: Missing user identifier")),
      {
        headers: errorHeaders(request),
        status: 400,
      },
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
  baseCardType: string,
  startTime: number,
): Response {
  const status = validationResult.status ?? 500;
  void trackFailedRequest({
    request,
    baseCardType,
    status,
    reasonCode: status === 404 ? "not_found" : "invalid_user_record",
    durationMs: Date.now() - startTime,
  });

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
    {
      headers: errorHeaders(request),
      status,
    },
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
  startTime: number,
): Promise<Response> {
  await trackFailedRequest({
    request,
    baseCardType,
    status: err.status,
    reasonCode:
      err.status === 404
        ? "not_found"
        : err.status >= 400 && err.status < 500
          ? "request_rejected"
          : err.category,
    durationMs: Date.now() - startTime,
  });

  await trackUserActionError(
    `card_svg_generation_${baseCardType}`,
    err,
    err.category,
    {
      executionEnvironment: "server",
      operationId: getOperationId(request),
      statusCode: err.status,
      source: "api_route",
      metadata: {
        endpoint: "card_svg",
        cardType: baseCardType,
      },
    },
  );

  return new Response(
    toCleanSvgResponse(svgError(formatCardDataErrorMessage(err))),
    {
      headers: errorHeaders(request),
      status: err.status,
    },
  );
}

function hasExplicitCardVariantOverrides(params: ValidatedParams): boolean {
  return (
    params.variationParam !== null ||
    params.colorPresetParam !== null ||
    params.titleColorParam !== null ||
    params.backgroundColorParam !== null ||
    params.textColorParam !== null ||
    params.circleColorParam !== null ||
    params.borderColorParam !== null ||
    params.borderRadiusParam !== null ||
    params.showFavoritesParam !== null ||
    params.statusColorsParam !== null ||
    params.piePercentagesParam !== null ||
    params.gridColsParam !== null ||
    params.gridRowsParam !== null
  );
}

function resolveCardSuccessCachePolicy(
  params: ValidatedParams,
  options?: { manualRefresh?: boolean },
): CardSuccessCachePolicy {
  if (options?.manualRefresh) {
    return CARD_REFRESH_CACHE_POLICY;
  }

  return hasExplicitCardVariantOverrides(params)
    ? CARD_VARIANT_CACHE_POLICY
    : CARD_CANONICAL_CACHE_POLICY;
}

function buildCardCacheKeyParams(
  params: ValidatedParams,
  normalizedGridCols: number,
  normalizedGridRows: number,
): Record<string, string | number | boolean | null | undefined> {
  return {
    animate: params.animationsEnabled,
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
  };
}

function buildSavedCardRenderCacheKey(
  userId: number,
  cardType: string,
  params: Record<string, string | number | boolean | null | undefined>,
  cardDoc:
    | Pick<CardsRecord, "updatedAt" | "userSnapshot">
    | Pick<CardsRecordMetadata, "updatedAt" | "userSnapshot">,
): string {
  return generateCacheKey(userId, cardType, {
    ...params,
    cardsUpdatedAt: cardDoc.updatedAt || undefined,
    snapshotRevision: cardDoc.userSnapshot?.revision,
    snapshotToken: cardDoc.userSnapshot?.token,
    snapshotUpdatedAt: cardDoc.userSnapshot?.updatedAt,
  });
}

function restoreSharedSvgEntryToMemoryCache(
  cacheKey: string,
  sharedCachedEntry: NonNullable<
    Awaited<ReturnType<typeof getSvgFromSharedCache>>
  >,
  effectiveUserId: number,
): void {
  const remainingTtlMs = getRemainingSvgCacheLifetimeMs(sharedCachedEntry);
  if (remainingTtlMs <= 0) {
    return;
  }

  setSvgInMemoryCache(
    cacheKey,
    sharedCachedEntry.svg,
    remainingTtlMs,
    effectiveUserId,
    sharedCachedEntry.borderRadius,
  );
}

function scheduleStaleCacheRevalidation(args: {
  request: Request;
  params: ValidatedParams;
  effectiveUserId: number;
  cacheKey: string;
  preloadedCardDoc?: CardsRecord;
}): void {
  const { request, params, effectiveUserId, cacheKey, preloadedCardDoc } = args;

  if (!tryAcquireSvgRevalidationLock(cacheKey)) {
    logPrivacySafe(
      "log",
      "Card SVG",
      "Skipped duplicate stale cache revalidation; work already in flight",
      { userId: effectiveUserId, cacheKey },
      request,
    );
    return;
  }

  logPrivacySafe(
    "warn",
    "Card SVG",
    "Serving stale memory cache and triggering background revalidation",
    { userId: effectiveUserId, cacheKey },
    request,
  );

  scheduleTelemetryTask(
    async () => {
      try {
        const sharedCachedEntry = await getSvgFromSharedCache(cacheKey);
        if (sharedCachedEntry) {
          restoreSharedSvgEntryToMemoryCache(
            cacheKey,
            sharedCachedEntry,
            effectiveUserId,
          );

          logPrivacySafe(
            "log",
            "Card SVG",
            "Background revalidation refreshed memory cache from shared cache",
            { userId: effectiveUserId, cacheKey },
            request,
          );
          return;
        }

        await generateCardResponse(
          request,
          params,
          effectiveUserId,
          Date.now(),
          cacheKey,
          preloadedCardDoc ? { preloadedCardDoc } : undefined,
        );

        logPrivacySafe(
          "log",
          "Card SVG",
          "Background revalidation completed",
          { userId: effectiveUserId, cacheKey },
          request,
        );
      } catch (err: unknown) {
        logPrivacySafe(
          "error",
          "Card SVG",
          "Background revalidation failed",
          {
            userId: effectiveUserId,
            cacheKey,
            error: err instanceof Error ? err.message : String(err),
            ...(err instanceof Error && err.stack ? { stack: err.stack } : {}),
          },
          request,
        );
      } finally {
        releaseSvgRevalidationLock(cacheKey);
      }
    },
    {
      endpoint: "Card SVG",
      taskName: "stale-svg-cache-revalidation",
      request,
    },
  );
}

/**
 * Creates the success response with SVG content and headers.
 * @source
 */
function createSuccessResponse(
  svgContent: TrustedSVG,
  request: Request,
  borderRadius: number | undefined,
  options?: {
    cacheSource?: string;
    cachePolicy?: CardSuccessCachePolicy;
  },
): Response {
  const cleaned = toCleanSvgResponse(svgContent);
  const headerRadius = getCardBorderRadius(borderRadius);
  const responseHeaders = {
    ...svgHeaders(request, options),
    "X-Card-Border-Radius": String(headerRadius),
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
    {
      headers: errorHeaders(request),
      status: 500,
    },
  );
}

/**
 * GET handler for generating card SVGs.
 *
 * Workflow:
 * 1. Validate query params and translate them to a normalized shape.
 * 2. Rate-limit valid requests by source IP before expensive work.
 * 3. Check in-memory LRU cache (fast path).
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
  const rateLimitIdentity = getRateLimitIdentity(request);
  const ip = rateLimitIdentity.ip;
  ensureRequestContext(request, {
    endpoint: "Card SVG",
    endpointKey: "card_svg",
    ip,
  });

  const paramsResult = extractAndValidateParams(request);
  if (paramsResult instanceof Response) {
    return paramsResult;
  }
  const params = paramsResult;

  const rateLimitResponse = await checkRateLimit(
    request,
    rateLimitIdentity,
    "Card SVG",
    "card_svg",
    ratelimit,
    {
      allowUnverifiedFallback: true,
      unverifiedFallbackKey: "anonymous:card_svg",
      unverifiedFallbackLimiter: anonymousRatelimit,
    },
  );
  if (rateLimitResponse) {
    const forwardedRateLimitHeaders = Object.fromEntries(
      [
        "Retry-After",
        "X-RateLimit-Limit",
        "X-RateLimit-Remaining",
        "X-RateLimit-Reset",
      ].flatMap((headerName) => {
        const value = rateLimitResponse.headers.get(headerName);
        return value ? [[headerName, value] as const] : [];
      }),
    );

    return new Response(
      toCleanSvgResponse(
        svgError("Client Error: Too many requests - try again later"),
      ),
      {
        headers: errorHeaders(request, {
          extraHeaders: forwardedRateLimitHeaders,
          exposeHeaders: Object.keys(forwardedRateLimitHeaders),
        }),
        status: 429,
      },
    );
  }

  logPrivacySafe(
    "log",
    "Card SVG",
    "Processing card SVG request",
    { ip, queryParamCount: new URL(request.url).searchParams.size },
    request,
  );
  const isManualRefresh = params._t !== null;
  const successCachePolicy = resolveCardSuccessCachePolicy(params, {
    manualRefresh: isManualRefresh,
  });

  const userIdResult = await resolveEffectiveUserId(params, request, startTime);
  if ("error" in userIdResult) {
    return userIdResult.error;
  }
  const effectiveUserId = userIdResult.userId;

  logPrivacySafe(
    "log",
    "Card SVG",
    "Resolved effective user for card render",
    { userId: effectiveUserId, cardType: params.cardType },
    request,
  );

  const normalizeGridDim = (raw: string | null | undefined, fallback = 3) => {
    if (raw === null || raw === undefined) return fallback;
    const parsed = Number.parseInt(raw, 10);
    if (Number.isNaN(parsed)) return fallback;
    return Math.max(1, Math.min(5, parsed));
  };
  const normalizedGridCols = normalizeGridDim(params.gridColsParam);
  const normalizedGridRows = normalizeGridDim(params.gridRowsParam);
  const needsDbCardConfig = needsCardConfigFromDb(params);
  const cacheKeyParams = buildCardCacheKeyParams(
    params,
    normalizedGridCols,
    normalizedGridRows,
  );

  let preloadedCardDoc: CardsRecord | undefined;
  let preloadedCardMeta:
    | Pick<CardsRecordMetadata, "updatedAt" | "userSnapshot">
    | undefined;
  if (needsDbCardConfig) {
    try {
      const savedCardCacheStamp =
        await fetchStoredCardsRecordCacheStamp(effectiveUserId);
      preloadedCardDoc = savedCardCacheStamp.preloadedCardDoc;
      preloadedCardMeta = savedCardCacheStamp.cardMeta;
    } catch (error) {
      if (error instanceof CardDataError) {
        return handleCardDataError(
          error,
          request,
          params.baseCardType,
          startTime,
        );
      }

      throw error;
    }
  }

  const cacheKey = preloadedCardMeta
    ? buildSavedCardRenderCacheKey(
        effectiveUserId,
        params.cardType,
        cacheKeyParams,
        preloadedCardMeta,
      )
    : generateCacheKey(effectiveUserId, params.cardType, cacheKeyParams);

  if (isManualRefresh) {
    logPrivacySafe(
      "log",
      "Card SVG",
      "Manual refresh requested; bypassing cache reads",
      { userId: effectiveUserId, cardType: params.cardType },
      request,
    );
  } else {
    const cachedEntry = getSvgFromMemoryCache(cacheKey);
    if (cachedEntry) {
      void trackCacheMetric(true, "memory");

      if (cachedEntry.isStale) {
        scheduleStaleCacheRevalidation({
          request,
          params,
          effectiveUserId,
          cacheKey,
          preloadedCardDoc,
        });

        return createSuccessResponse(
          markTrustedSvg(cachedEntry.svg),
          request,
          cachedEntry.borderRadius,
          {
            cacheSource: "memory",
            cachePolicy: successCachePolicy,
          },
        );
      }

      logPrivacySafe(
        "log",
        "Card SVG",
        "Served SVG from memory cache",
        { userId: effectiveUserId, durationMs: Date.now() - startTime },
        request,
      );
      void trackSuccessfulRequest(
        params.baseCardType,
        request,
        Date.now() - startTime,
      );
      return createSuccessResponse(
        markTrustedSvg(cachedEntry.svg),
        request,
        cachedEntry.borderRadius,
        {
          cacheSource: "memory",
          cachePolicy: successCachePolicy,
        },
      );
    }

    void trackCacheMetric(false, "memory", { includeOverall: false });

    const sharedCachedEntry = await getSvgFromSharedCache(cacheKey);
    if (sharedCachedEntry) {
      void trackCacheMetric(true, "redis");
      restoreSharedSvgEntryToMemoryCache(
        cacheKey,
        sharedCachedEntry,
        effectiveUserId,
      );

      logPrivacySafe(
        "log",
        "Card SVG",
        "Served SVG from shared cache",
        { userId: effectiveUserId, durationMs: Date.now() - startTime },
        request,
      );

      void trackSuccessfulRequest(
        params.baseCardType,
        request,
        Date.now() - startTime,
      );

      return createSuccessResponse(
        markTrustedSvg(sharedCachedEntry.svg),
        request,
        sharedCachedEntry.borderRadius,
        {
          cacheSource: "redis",
          cachePolicy: successCachePolicy,
        },
      );
    }

    void trackCacheMetric(false, "redis");
  }

  return generateCardResponse(
    request,
    params,
    effectiveUserId,
    startTime,
    cacheKey,
    {
      manualRefresh: isManualRefresh,
      cachePolicy: successCachePolicy,
      preloadedCardDoc,
    },
  );
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
function validateUserRecordForCard(
  baseCardType: string,
  userDoc: UserRecord,
  options?: { snapshotMatched?: boolean },
) {
  const fastPathResult = validateUserRecordForCardRender(userDoc);
  if ("error" in fastPathResult) {
    return fastPathResult;
  }

  if (
    userHasRequiredAggregateForCardType(baseCardType, fastPathResult.normalized)
  ) {
    return fastPathResult;
  }

  const requiredAggregateKey = getRequiredAggregateKeyForCardType(baseCardType);
  if (!requiredAggregateKey) {
    return fastPathResult;
  }

  logPrivacySafe(
    "warn",
    "Card SVG",
    "Missing required stored aggregate for card render",
    {
      cardType: baseCardType,
      missingAggregate: requiredAggregateKey,
      snapshotMatched: options?.snapshotMatched ?? true,
    },
  );

  return {
    error: `Missing required stored aggregate: ${requiredAggregateKey}`,
    status: 500,
  };
}

async function loadUserAndCardConfig(
  needsDbCardConfig: boolean,
  params: ValidatedParams,
  effectiveUserId: number,
  request: Request,
  startTime: number,
  options?: {
    preloadedCardDoc?: CardsRecord;
  },
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
    const data = await fetchUserDataWithState(
      effectiveUserId,
      params.cardType,
      {
        preloadedCardDoc: options?.preloadedCardDoc,
      },
    );
    const { cardDoc } = data;
    let userDoc = data.userDoc;

    if (!data.snapshotMatched) {
      logPrivacySafe(
        "warn",
        "Card SVG",
        "Card configuration snapshot no longer matches a retained user snapshot; rendering latest committed user data",
        {
          userId: effectiveUserId,
          cardType: params.cardType,
          requestedSnapshotToken: cardDoc.userSnapshot?.token,
          requestedSnapshotUpdatedAt: cardDoc.userSnapshot?.updatedAt,
          resolvedSnapshotToken: data.userReadState?.snapshot?.token,
          resolvedSnapshotUpdatedAt: data.userReadState?.snapshot?.updatedAt,
        },
        request,
      );
    }

    const validationResult = validateUserRecordForCard(
      params.baseCardType,
      userDoc,
      { snapshotMatched: data.snapshotMatched },
    );
    if ("error" in validationResult) {
      return {
        error: handleValidationError(
          validationResult,
          request,
          params.baseCardType,
          startTime,
        ),
      };
    }
    userDoc = validationResult.normalized;

    const processed = processCardConfig(cardDoc, params, userDoc);
    const normalizedEffectiveVariation =
      params.baseCardType === "profileOverview"
        ? "default"
        : processed.effectiveVariation;
    return {
      userDoc,
      cardConfig: processed.cardConfig,
      effectiveVariation: normalizedEffectiveVariation,
      favorites: processed.favorites,
    };
  }

  const userData = await fetchUserDataForCardWithState(
    effectiveUserId,
    params.cardType,
  );
  const userDoc = userData.userDoc;
  const validationResult = validateUserRecordForCard(
    params.baseCardType,
    userDoc,
    { snapshotMatched: userData.snapshotMatched },
  );
  if ("error" in validationResult) {
    return {
      error: handleValidationError(
        validationResult,
        request,
        params.baseCardType,
        startTime,
      ),
    };
  }

  const normalized = validationResult.normalized;
  const cardConfig = buildCardConfigFromParams(params);
  const effectiveVariationRaw =
    params.variationParam || cardConfig.variation || "default";
  const effectiveVariation =
    params.baseCardType === "profileOverview"
      ? "default"
      : effectiveVariationRaw;
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
  cacheKey?: string,
  options?: {
    manualRefresh?: boolean;
    cachePolicy?: CardSuccessCachePolicy;
    preloadedCardDoc?: CardsRecord;
  },
): Promise<Response> {
  try {
    const needsDbCardConfig =
      options?.preloadedCardDoc !== undefined || needsCardConfigFromDb(params);
    const loadResult = await loadUserAndCardConfig(
      needsDbCardConfig,
      params,
      effectiveUserId,
      request,
      startTime,
      {
        preloadedCardDoc: options?.preloadedCardDoc,
      },
    );
    if ("error" in loadResult) {
      return loadResult.error;
    }

    const { userDoc, cardConfig, effectiveVariation, favorites } = loadResult;

    logPrivacySafe(
      "log",
      "Card SVG",
      "Generating SVG",
      {
        userId: effectiveUserId,
        cardType: params.cardType,
        animationsEnabled: params.animationsEnabled,
        variation: effectiveVariation,
        source: needsDbCardConfig ? "db" : "url",
      },
      request,
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
      { animationsEnabled: params.animationsEnabled },
    );

    const duration = Date.now() - startTime;
    if (duration > 1500) {
      logPrivacySafe(
        "warn",
        "Card SVG",
        "Slow SVG rendering detected",
        { userId: effectiveUserId, durationMs: duration },
        request,
      );
    }
    logPrivacySafe(
      "log",
      "Card SVG",
      "Rendered SVG successfully",
      {
        userId: effectiveUserId,
        cardType: params.cardType,
        durationMs: duration,
      },
      request,
    );

    if (cacheKey) {
      const cleanedSvg = toCleanSvgResponse(svgContent);
      setSvgInMemoryCache(
        cacheKey,
        cleanedSvg,
        12 * 60 * 60 * 1000,
        effectiveUserId,
        cardConfig.borderRadius,
      );

      scheduleTelemetryTask(
        () =>
          setSvgInSharedCache(
            cacheKey,
            cleanedSvg,
            24 * 60 * 60 * 1000,
            effectiveUserId,
            cardConfig.borderRadius,
          ),
        {
          endpoint: "Card SVG",
          taskName: "persist-shared-svg-cache-entry",
          request,
        },
      );

      logPrivacySafe(
        "log",
        "Card SVG",
        "Cached generated SVG and scheduled shared-cache persistence",
        { userId: effectiveUserId, cacheKey },
        request,
      );
    }

    void trackSuccessfulRequest(params.baseCardType, request, duration);
    return createSuccessResponse(svgContent, request, cardConfig.borderRadius, {
      cacheSource: options?.manualRefresh ? "refresh" : "render",
      cachePolicy:
        options?.cachePolicy ??
        resolveCardSuccessCachePolicy(params, {
          manualRefresh: options?.manualRefresh,
        }),
    });
  } catch (err: unknown) {
    if (err instanceof CardDataError) {
      return handleCardDataError(err, request, params.baseCardType, startTime);
    }

    const duration = Date.now() - startTime;
    logPrivacySafe(
      "error",
      "Card SVG",
      "Error generating card SVG",
      {
        userId: effectiveUserId,
        durationMs: duration,
        error: err instanceof Error ? err.message : String(err),
        ...(err instanceof Error && err.stack ? { stack: err.stack } : {}),
      },
      request,
    );

    await trackUserActionError(
      `card_svg_generation_${params.baseCardType}`,
      err instanceof Error ? err : new Error(String(err)),
      "server_error",
      {
        executionEnvironment: "server",
        operationId: getOperationId(request),
        statusCode: 500,
        source: "api_route",
        metadata: {
          endpoint: "card_svg",
          cardType: params.baseCardType,
        },
      },
    );

    await trackFailedRequest({
      request,
      baseCardType: params.baseCardType,
      status: 500,
      reasonCode: "render_failed",
      durationMs: duration,
    });
    return createInternalErrorResponse(request);
  }
}

export function OPTIONS(request: Request) {
  const allowedOrigin = getAllowedCardSvgOrigin(request);
  return new Response(null, {
    headers: withRequestIdHeaders(
      {
        "Access-Control-Allow-Origin": allowedOrigin,
        "Access-Control-Allow-Methods": "GET, HEAD, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type",
        "X-Robots-Tag": PREVIEW_MEDIA_X_ROBOTS_TAG,
        "Access-Control-Expose-Headers":
          "X-Card-Border-Radius, Retry-After, X-RateLimit-Limit, X-RateLimit-Remaining, X-RateLimit-Reset",
        Vary: "Origin",
      },
      request,
    ),
  });
}
