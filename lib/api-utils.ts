/**
 * Shared API-route infrastructure for AniCards.
 *
 * This module keeps route handlers thin by centralizing lazy Upstash clients,
 * CORS policy, request validation, analytics counters, and common response
 * helpers in one place.
 */
import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";
import { NextResponse } from "next/server";

import { displayNames, isValidCardType } from "@/lib/card-data/validation";
import type { StoredCardConfig } from "@/lib/types/records";
import {
  getColorInvalidReason,
  validateBorderRadius,
  validateColorValue,
} from "@/lib/utils";

// Create the Redis client lazily to prevent calling `Redis.fromEnv()` during module initialization.
// This avoids side effects in test environments (jest mocking) and preserves edge runtime safety.
let _realRedisClient: Redis | undefined;
/**
 * Create or return an existing Redis client instance using environment
 * configuration. This defers initialization until the client is used.
 * @returns The Upstash Redis client.
 * @source
 */
function createRealRedisClient(): Redis {
  _realRedisClient ??= Redis.fromEnv({
    enableAutoPipelining: true,
    retry: {
      retries: 3,
      backoff: (retryCount: number) => Math.round(Math.exp(retryCount) * 50),
    },
    latencyLogging: process.env.NODE_ENV !== "production",
  });
  return _realRedisClient;
}

/**
 * A lazily-initialized proxy for the Upstash Redis client that forwards
 * operations to a real client when they are invoked. This keeps module
 * initialization side-effect free and supports edge runtimes.
 * @source
 */
export const redisClient: Redis = new Proxy({} as Record<string, unknown>, {
  get(_: unknown, prop: string | symbol) {
    const client = createRealRedisClient();
    const value: unknown = (client as unknown as Record<string, unknown>)[
      prop as keyof typeof client
    ];
    if (typeof value === "function")
      return (...args: unknown[]) =>
        (value as (...args: unknown[]) => unknown).apply(client, args);
    return value;
  },
  set(_: unknown, prop: string | symbol, value: unknown) {
    const client = createRealRedisClient();
    (client as unknown as Record<string, unknown>)[
      prop as keyof typeof client
    ] = value;
    return true;
  },
}) as unknown as Redis;

/**
 * Scans all keys matching a pattern using the Redis SCAN command.
 * This is safer and more efficient than the KEYS command for large datasets.
 * @param pattern - The pattern to match (e.g., "user:*").
 * @param count - The number of keys to fetch per scan iteration.
 * @returns A promise that resolves to an array of all matching keys.
 * @source
 */
export async function scanAllKeys(
  pattern: string,
  count: number = 1000,
): Promise<string[]> {
  let cursor: string | number = 0;
  const allKeys: string[] = [];

  do {
    const [nextCursor, keys] = (await redisClient.scan(cursor, {
      match: pattern,
      count,
    })) as [string | number, string[]];
    cursor = nextCursor;
    allKeys.push(...keys);
  } while (cursor !== 0 && cursor !== "0");

  return allKeys;
}

let _realRatelimit: Ratelimit | undefined;
/**
 * A lazily-initialized Upstash rate limiter proxy which creates the
 * RateLimit instance on first use with a default sliding window limiter.
 * @source
 */
export const ratelimit: Ratelimit = new Proxy({} as Record<string, unknown>, {
  get(_: unknown, prop: string | symbol) {
    _realRatelimit ??= new Ratelimit({
      redis: createRealRedisClient(),
      limiter: Ratelimit.slidingWindow(10, "5 s"),
    });
    const val: unknown = (_realRatelimit as unknown as Record<string, unknown>)[
      prop as keyof typeof _realRatelimit
    ];
    if (typeof val === "function")
      return (...args: unknown[]) =>
        (val as (...args: unknown[]) => unknown).apply(_realRatelimit, args);
    return val;
  },
  set(_: unknown, prop: string | symbol, value: unknown) {
    _realRatelimit ??= new Ratelimit({
      redis: createRealRedisClient(),
      limiter: Ratelimit.slidingWindow(10, "5 s"),
    });
    (_realRatelimit as unknown as Record<string, unknown>)[
      prop as keyof typeof _realRatelimit
    ] = value;
    return true;
  },
}) as unknown as Ratelimit;

/**
 * Creates a new Upstash Ratelimit instance using the shared Redis client.
 * Allows per-endpoint overrides for window/limit settings.
 * @param options.limit - Maximum number of requests allowed per window
 * @param options.window - Duration string (e.g. "10 s", "1 m")
 * @returns A configured Ratelimit instance ready to be used for limiting
 */
export function createRateLimiter(options?: {
  limit?: number;
  window?: Parameters<typeof Ratelimit.slidingWindow>[1];
  redis?: Redis;
}): Ratelimit {
  const limit = options?.limit ?? 10;
  const window =
    options?.window ?? ("5 s" as Parameters<typeof Ratelimit.slidingWindow>[1]);
  const redis = options?.redis ?? createRealRedisClient();

  return new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(limit, window),
  });
}

/**
 * Standardized API error response shape returned from API routes.
 * @source
 */
export interface ApiError {
  error: string;
}

function normalizeOrigin(value: string | null | undefined): string | null {
  if (!value) return null;
  try {
    return new URL(value).origin;
  } catch {
    return null;
  }
}

/**
 * Determine the Access-Control-Allow-Origin value used by the Card SVG API.
 * Priority: NEXT_PUBLIC_CARD_SVG_ALLOWED_ORIGIN env -> production fallback -> request origin or '*'.
 * This helper centralizes CORS policy and is used by card route header helpers.
 * @param request - Optional Request used to extract the request origin in development.
 */
export function getAllowedCardSvgOrigin(request?: Request): string {
  const rawConfigured = process.env.NEXT_PUBLIC_CARD_SVG_ALLOWED_ORIGIN;
  const configured = normalizeOrigin(rawConfigured);

  let origin: string | undefined;

  if (configured) {
    origin = configured;
  } else if (process.env.NODE_ENV === "production") {
    origin = "https://anilist.co";
  } else {
    const requestOrigin = request?.headers?.get("origin");
    const requestNormalized = normalizeOrigin(requestOrigin);
    origin = requestNormalized ?? "*";
  }

  if (process.env.NODE_ENV === "production" && origin === "*") {
    console.warn(
      "[Card CORS] Computed Access-Control-Allow-Origin is '*' in production; forcing to https://anilist.co",
    );
    origin = "https://anilist.co";
  }

  return origin;
}

/**
 * Determine the Access-Control-Allow-Origin value used by JSON API endpoints.
 * Priority: NEXT_PUBLIC_APP_URL env -> production fallback -> request origin or '*'.
 * This helper centralizes CORS policy for JSON APIs.
 * @param request - Optional Request used to extract the request origin in development.
 */
export function getAllowedApiOrigin(request?: Request): string {
  const rawConfigured = process.env.NEXT_PUBLIC_APP_URL;
  const configured = normalizeOrigin(rawConfigured);

  let origin: string | undefined;

  if (configured) {
    origin = configured;
  } else if (process.env.NODE_ENV === "production") {
    origin = normalizeOrigin(process.env.NEXT_PUBLIC_APP_URL) ?? "*";
  } else {
    const requestOrigin = request?.headers?.get("origin");
    const requestNormalized = normalizeOrigin(requestOrigin);
    origin = requestNormalized ?? "*";
  }

  return origin;
}

/**
 * Standard headers for JSON API responses including CORS and Vary semantics.
 * @param request - Optional request to calculate the allowed origin in development.
 */
export function apiJsonHeaders(request?: Request): Record<string, string> {
  const allowedOrigin = getAllowedApiOrigin(request);
  return {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": allowedOrigin,
    "Access-Control-Allow-Methods": "GET, HEAD, OPTIONS, POST",
    Vary: "Origin",
  };
}

/**
 * JSON response factory that always applies API CORS headers so callers don't forget.
 * Use this instead of calling `NextResponse.json(...)` directly when returning JSON.
 * @param data - payload to serialize
 * @param request - Request used to compute the allowed origin in dev
 * @param status - optional HTTP status code
 */
export function jsonWithCors<T = unknown>(
  data: T,
  request?: Request,
  status?: number,
): NextResponse<T> {
  const opts: Record<string, unknown> = {
    headers: apiJsonHeaders(request),
  };
  if (typeof status === "number") opts.status = status;
  return NextResponse.json(
    data as unknown,
    opts as ResponseInit,
  ) as NextResponse<T>;
}

/**
 * Enforces a rate limit for an IP address using the configured Upstash
 * rate limiter. Records analytics and returns a 429 response on limit.
 * @param ip - IP address to check.
 * @param endpointName - Friendly endpoint name used for logging.
 * @param endpointKey - Stable canonical endpoint key used for analytics metric keys.
 * @param limiter - Optional per-endpoint Ratelimit instance used for rate limiting.
 * @returns A NextResponse with an ApiError when limited, or null when allowed.
 * @source
 */
export async function checkRateLimit(
  request: Request | undefined,
  ip: string,
  endpointName: string,
  endpointKey: string,
  limiter?: Ratelimit,
): Promise<NextResponse<ApiError> | null> {
  const effectiveLimiter = limiter ?? ratelimit;
  const { success } = await effectiveLimiter.limit(ip);
  if (!success) {
    console.warn(`🚨 [${endpointName}] Rate limited IP: ${ip}`);
    await incrementAnalytics(
      buildAnalyticsMetricKey(endpointKey, "failed_requests"),
    );
    return jsonWithCors({ error: "Too many requests" }, request, 429);
  }
  return null;
}

/**
 * Validates that a given request originates from the same origin as the
 * application (or an internal request with no origin header). In
 * production, cross-origin requests are rejected with a 401 response.
 * @param request - The incoming Request object to evaluate.
 * @param endpointName - Friendly endpoint name used for logs.
 * @param endpointKey - Stable canonical endpoint key used for analytics metric keys.
 * @returns A NextResponse with an ApiError when unauthorized, or null when allowed.
 * @source
 */
export function validateSameOrigin(
  request: Request,
  endpointName: string,
  endpointKey: string,
): NextResponse<ApiError> | null {
  const origin = request.headers.get("origin");
  const requestOrigin = new URL(request.url).origin;
  const configuredAppOrigin = normalizeOrigin(process.env.NEXT_PUBLIC_APP_URL);
  const allowedOrigin = configuredAppOrigin ?? requestOrigin;

  // Allow internal requests (no origin) or same-origin requests
  const isSameOrigin = !origin || origin === allowedOrigin;

  if (!isSameOrigin) {
    console.warn(
      `🔐 [${endpointName}] Rejected cross-origin request from: ${origin} (allowed: ${allowedOrigin})`,
    );

    const metric = buildAnalyticsMetricKey(endpointKey, "failed_requests");

    incrementAnalytics(metric).catch((err) => {
      if (process.env.NODE_ENV !== "production") {
        console.warn(`Analytics increment failed for ${metric}:`, err);
      }
    });

    if (process.env.NODE_ENV === "production") {
      return jsonWithCors({ error: "Unauthorized" }, request, 401);
    }
    // In dev mode, still return headers for consistent CORS behavior
    return jsonWithCors({ error: "Unauthorized" }, request, 401);
  }

  return null;
}

/**
 * Safely increments a Redis-based analytics counter. This function
 * intentionally swallows errors to avoid affecting primary request paths.
 * @param metric - Redis key for the analytics counter to increment.
 * @source
 */
export async function incrementAnalytics(metric: string): Promise<void> {
  try {
    await redisClient.incr(metric);
  } catch (error) {
    // Silently fail analytics to avoid affecting main functionality
    console.warn(`Failed to increment analytics for ${metric}:`, error);
  }
}

/**
 * Build a canonical analytics Redis key using a stable endpoint key.
 * Example: buildAnalyticsMetricKey("store_cards", "failed_requests")
 * returns "analytics:store_cards:failed_requests".
 * An optional extraSuffix is appended if provided for more granular metrics.
 */
export function buildAnalyticsMetricKey(
  endpointKey: string,
  metric: string,
  extraSuffix?: string,
): string {
  const normalized = String(endpointKey).toLowerCase().replaceAll(/\s+/g, "_");
  const base = `analytics:${normalized}:${metric}`;
  return extraSuffix ? `${base}:${extraSuffix}` : base;
}

/**
 * Logs an incoming API request with optional details for debugging.
 * @param endpoint - Logical endpoint name for logging context.
 * @param ip - IP address of the caller.
 * @param details - Optional additional info about the request.
 * @source
 */
export function logRequest(
  endpoint: string,
  ip: string,
  details?: string,
): void {
  const message = details
    ? `🚀 [${endpoint}] Incoming request from IP: ${ip} - ${details}`
    : `🚀 [${endpoint}] Incoming request from IP: ${ip}`;
  console.log(message);
}

/**
 * Centralized error handling for API routes that logs details,
 * increments an analytics metric, and returns a 500 error response.
 * @param error - Error object thrown by the route handler.
 * @param endpoint - Logical endpoint for logging context.
 * @param startTime - Request start timestamp used to calculate duration.
 * @param analyticsMetric - Redis metric key to increment on error.
 * @param errorMessage - User-facing error message returned in the response.
 * @returns A NextResponse containing an ApiError.
 * @source
 */
export function handleError(
  error: Error,
  endpoint: string,
  startTime: number,
  analyticsMetric: string,
  errorMessage: string,
  request?: Request,
): NextResponse<ApiError> {
  const duration = Date.now() - startTime;
  console.error(`🔥 [${endpoint}] Error after ${duration}ms: ${error.message}`);

  if (error.stack) {
    console.error(`💥 [${endpoint}] Stack Trace: ${error.stack}`);
  }

  incrementAnalytics(analyticsMetric).catch(() => {});

  return jsonWithCors({ error: errorMessage }, request, 500);
}

/**
 * Logs a successful operation for an endpoint with timing and optional details.
 * @param endpoint - Logical endpoint name for logging context.
 * @param userId - ID of the user associated with the successful operation.
 * @param duration - Duration in milliseconds for the operation.
 * @param details - Optional details string for the log.
 * @source
 */
export function logSuccess(
  endpoint: string,
  userId: number,
  duration: number,
  details?: string,
): void {
  const message = details
    ? `✅ [${endpoint}] ${details} for user ${userId} in ${duration}ms`
    : `✅ [${endpoint}] Successfully processed user ${userId} [${duration}ms]`;
  console.log(message);
}

/**
 * Validates the payload for the store-users endpoint including userId,
 * optional username, and stats object shape.
 * @param data - The request data to validate.
 * @param endpoint - Logical endpoint name for logging/analytics.
 * @returns A NextResponse with an ApiError when invalid, or null otherwise.
 * @source
 */
export function validateUserData(
  data: Record<string, unknown>,
  endpoint: string,
  request?: Request,
): NextResponse<ApiError> | null {
  if (data.userId === undefined || data.userId === null) {
    console.warn(`⚠️ [${endpoint}] Missing userId`);
    return jsonWithCors({ error: "Invalid data" }, request, 400);
  }

  const userId = Number(data.userId);
  if (!Number.isInteger(userId) || userId <= 0) {
    console.warn(
      `⚠️ [${endpoint}] Invalid userId format: ${safeStringifyValue(data.userId)}`,
    );
    return jsonWithCors({ error: "Invalid data" }, request, 400);
  }

  if (data.username !== undefined && data.username !== null) {
    if (!isValidUsername(data.username)) {
      console.warn(
        `⚠️ [${endpoint}] Username invalid: ${safeStringifyValue(data.username)}`,
      );
      return jsonWithCors({ error: "Invalid data" }, request, 400);
    }
  }

  if (!data.stats || typeof data.stats !== "object") {
    console.warn(`⚠️ [${endpoint}] Stats must be a valid object`);
    return jsonWithCors({ error: "Invalid data" }, request, 400);
  }

  return null;
}

/**
 * Validates a username string following project constraints: length,
 * permitted characters, and trimming. Used by both GET and POST paths.
 * @param value - Username value to validate.
 * @returns True if the username is valid.
 * @source
 */
export function isValidUsername(value: unknown): boolean {
  if (value === undefined || value === null) return false;
  if (typeof value !== "string") return false;
  const trimmed = value.trim();
  if (trimmed.length === 0 || trimmed.length > 100) return false;
  return /^[a-zA-Z0-9_\-\s]*$/.test(trimmed);
}

/**
 * Ensures required string fields for a card are present and valid.
 * Validates color formats (hex or gradient) and length constraints on string fields.
 * @param card - Card object to validate.
 * @param cardIndex - Index of the card in the array for error messages.
 * @param endpoint - Endpoint name used for logging/analytics context.
 * @returns A NextResponse with an ApiError when invalid, or null otherwise.
 * @source
 */
function validateCardRequiredFields(
  card: Record<string, unknown>,
  cardIndex: number,
  endpoint: string,
  request?: Request,
): NextResponse<ApiError> | null {
  const requiredStringFields = ["cardName", "variation"];
  const requiredColorFields = [
    "titleColor",
    "backgroundColor",
    "textColor",
    "circleColor",
  ];

  /** Validate required string fields with length constraints. */
  function validateRequiredStringFields(
    cardObj: Record<string, unknown>,
    fields: string[],
  ): NextResponse<ApiError> | null {
    for (const field of fields) {
      if (typeof cardObj[field] !== "string") {
        console.warn(
          `⚠️ [${endpoint}] Card ${cardIndex} missing or invalid field: ${field}`,
        );
        return jsonWithCors({ error: "Invalid data" }, request, 400);
      }
      const value = cardObj[field];
      if (value.length === 0 || value.length > 100) {
        console.warn(
          `⚠️ [${endpoint}] Card ${cardIndex} field ${field} exceeds length limits`,
        );
        return NextResponse.json(
          { error: "Invalid data" },
          { status: 400, headers: apiJsonHeaders(request) },
        );
      }
    }
    return null;
  }

  /** Validate required color fields, allowing hex string or gradient defs.
   *
   * When the incoming card object contains none of the color fields, treat it as
   * a partial patch (colors may be provided by the existing stored record). In
   * that case, skip the strict "all colors present" check here and allow the
   * merge step to fill missing values; a final merged-state validation will
   * enforce presence before persisting.
   */
  function validateRequiredColorFields(
    cardObj: Record<string, unknown>,
    fields: string[],
  ): NextResponse<ApiError> | null {
    const anyColorPresent = fields.some(
      (f) => cardObj[f] !== undefined && cardObj[f] !== null,
    );
    if (!anyColorPresent) return null;

    for (const field of fields) {
      const value = cardObj[field];
      if (value === undefined || value === null) {
        console.warn(
          `⚠️ [${endpoint}] Card ${cardIndex} missing required color field: ${field}`,
        );
        return NextResponse.json(
          { error: "Invalid data" },
          { status: 400, headers: apiJsonHeaders(request) },
        );
      }
      if (!validateColorValue(value)) {
        const reason = getColorInvalidReason(value);
        const reasonSuffix = reason ? ` (${reason})` : "";
        console.warn(
          `⚠️ [${endpoint}] Card ${cardIndex} invalid color or gradient format for ${field}${reasonSuffix}`,
        );
        return NextResponse.json(
          { error: "Invalid data" },
          { status: 400, headers: apiJsonHeaders(request) },
        );
      }
    }
    return null;
  }

  const isDisabled = card["disabled"] === true;
  const fieldsToValidate = isDisabled ? ["cardName"] : requiredStringFields;
  const reqStrErr = validateRequiredStringFields(card, fieldsToValidate);
  if (reqStrErr) return reqStrErr;

  const cardNameRaw = card["cardName"];
  if (typeof cardNameRaw !== "string" || !isValidCardType(cardNameRaw)) {
    console.warn(
      `⚠️ [${endpoint}] Card ${cardIndex} has an invalid cardName: ${safeStringifyValue(
        cardNameRaw,
      )}`,
    );
    return NextResponse.json(
      { error: "Invalid data: Invalid card type" },
      { status: 400, headers: apiJsonHeaders(request) },
    );
  }

  if (!isDisabled) {
    const rawPreset = card["colorPreset"];
    const preset =
      typeof rawPreset === "string" && rawPreset.trim().length > 0
        ? rawPreset
        : undefined;
    const requireColorFields = preset === undefined || preset === "custom";
    if (requireColorFields) {
      const reqColorErr = validateRequiredColorFields(
        card,
        requiredColorFields,
      );
      if (reqColorErr) return reqColorErr;
    }
  }

  return null;
}

/**
 * Helper: validate optional boolean fields existed and are booleans.
 */
function validateOptionalBooleanFields(
  card: Record<string, unknown>,
  cardIndex: number,
  endpoint: string,
  request?: Request,
): NextResponse<ApiError> | null {
  const optionalBooleanFields = [
    "disabled",
    "showFavorites",
    "useStatusColors",
    "showPiePercentages",
  ];

  for (const field of optionalBooleanFields) {
    const value = card[field];
    if (value !== undefined && typeof value !== "boolean") {
      console.warn(
        `⚠️ [${endpoint}] Card ${cardIndex} field ${field} must be boolean`,
      );
      return NextResponse.json(
        { error: "Invalid data" },
        { status: 400, headers: apiJsonHeaders(request) },
      );
    }
  }
  return null;
}

/**
 * Helper: validate optional border color field when present.
 */
function validateOptionalBorderColorField(
  card: Record<string, unknown>,
  cardIndex: number,
  endpoint: string,
  request?: Request,
): NextResponse<ApiError> | null {
  const borderColorValue = card.borderColor;
  const hasBorder = borderColorValue !== undefined && borderColorValue !== null;
  if (hasBorder) {
    if (
      typeof borderColorValue !== "string" ||
      !validateColorValue(borderColorValue)
    ) {
      const reason = getColorInvalidReason(borderColorValue);
      const reasonSuffix = reason ? ` (${reason})` : "";
      console.warn(
        `⚠️ [${endpoint}] Card ${cardIndex} invalid borderColor format${reasonSuffix}`,
      );
      return NextResponse.json(
        { error: "Invalid data" },
        { status: 400, headers: apiJsonHeaders(request) },
      );
    }
  }
  return null;
}

/**
 * Helper: validate a grid numeric field (cols/rows) ensuring integer between 1 and 5.
 */
function validateGridNumericField(
  value: unknown,
  cardIndex: number,
  fieldName: string,
  endpoint: string,
  request?: Request,
): NextResponse<ApiError> | null {
  if (value !== undefined) {
    const n = Number(value);
    if (!Number.isInteger(n) || n < 1 || n > 5) {
      console.warn(
        `⚠️ [${endpoint}] Card ${cardIndex} ${fieldName} must be an integer between 1 and 5`,
      );
      return NextResponse.json(
        { error: "Invalid data" },
        { status: 400, headers: apiJsonHeaders(request) },
      );
    }
  }
  return null;
}

/**
 * Validates optional fields for a card such as booleans and optional
 * borderColor (hex or gradient format).
 * @param card - Card object to validate.
 * @param cardIndex - Index of the card in the array for error messages.
 * @param endpoint - Endpoint name used for logging/analytics context.
 * @returns A NextResponse with an ApiError when invalid, or null otherwise.
 * @source
 */
function validateCardOptionalFields(
  card: Record<string, unknown>,
  cardIndex: number,
  endpoint: string,
  request?: Request,
): NextResponse<ApiError> | null {
  const optBoolErr = validateOptionalBooleanFields(
    card,
    cardIndex,
    endpoint,
    request,
  );
  if (optBoolErr) return optBoolErr;

  const borderColorValue = card.borderColor;
  const hasBorder = borderColorValue !== undefined && borderColorValue !== null;
  const borderColorErr = validateOptionalBorderColorField(
    card,
    cardIndex,
    endpoint,
    request,
  );
  if (borderColorErr) return borderColorErr;

  const borderRadiusValue = card.borderRadius;
  const borderRadiusError = validateBorderRadiusField(
    borderRadiusValue,
    cardIndex,
    endpoint,
    { requireValue: hasBorder },
    request,
  );
  if (borderRadiusError) return borderRadiusError;

  const gridColsError = validateGridNumericField(
    card.gridCols,
    cardIndex,
    "gridCols",
    endpoint,
    request,
  );
  if (gridColsError) return gridColsError;

  const gridRowsError = validateGridNumericField(
    card.gridRows,
    cardIndex,
    "gridRows",
    endpoint,
    request,
  );
  if (gridRowsError) return gridRowsError;

  return null;
}

function validateBorderRadiusField(
  borderRadiusValue: unknown,
  cardIndex: number,
  endpoint: string,
  options?: { requireValue?: boolean },
  request?: Request,
): NextResponse<ApiError> | null {
  const { requireValue = false } = options ?? {};
  if (borderRadiusValue === undefined || borderRadiusValue === null) {
    if (requireValue) {
      console.warn(
        `⚠️ [${endpoint}] Card ${cardIndex} borderRadius required when border is enabled`,
      );
      return NextResponse.json(
        { error: "Invalid data" },
        { status: 400, headers: apiJsonHeaders(request) },
      );
    }
    return null;
  }
  if (typeof borderRadiusValue !== "number") {
    console.warn(
      `⚠️ [${endpoint}] Card ${cardIndex} borderRadius must be a number`,
    );
    return NextResponse.json(
      { error: "Invalid data" },
      { status: 400, headers: apiJsonHeaders(request) },
    );
  }
  if (!validateBorderRadius(borderRadiusValue)) {
    console.warn(
      `⚠️ [${endpoint}] Card ${cardIndex} borderRadius out of range: ${borderRadiusValue}`,
    );
    return NextResponse.json(
      { error: "Invalid data" },
      { status: 400, headers: apiJsonHeaders(request) },
    );
  }
  return null;
}

/**
 * Validates the provided userId and returns an API error response when
 * invalid. Keeps logging consistent with existing behavior.
 * @param userId - The incoming userId value
 * @param endpoint - Endpoint name used for logging
 */
function validateUserIdField(
  userId: unknown,
  endpoint: string,
  request?: Request,
): NextResponse<ApiError> | null {
  if (userId === undefined || userId === null) {
    console.warn(`⚠️ [${endpoint}] Missing userId`);
    return NextResponse.json(
      { error: "Invalid data" },
      { status: 400, headers: apiJsonHeaders(request) },
    );
  }

  const userIdNum = Number(userId);
  if (!Number.isInteger(userIdNum) || userIdNum <= 0) {
    console.warn(
      `⚠️ [${endpoint}] Invalid userId format: ${safeStringifyValue(userId)}`,
    );
    return NextResponse.json(
      { error: "Invalid data" },
      { status: 400, headers: apiJsonHeaders(request) },
    );
  }

  return null;
}

/**
 * Utility to safely stringify unknown values for logs.
 * Uses JSON.stringify for objects when possible and falls back to String().
 */
function safeStringifyValue(value: unknown): string {
  if (value === undefined) return "undefined";
  if (value === null) return "null";
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean")
    return String(value);
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

/** Coerce to a plain string: prefer original string when possible. */
function coerceToString(value: unknown): string {
  return typeof value === "string" ? value : safeStringifyValue(value);
}

/**
 * Ensures the payload is an array. Returns an API error response when not.
 */
function validateCardsArrayField(
  cards: unknown,
  endpoint: string,
  request?: Request,
): NextResponse<ApiError> | null {
  if (!Array.isArray(cards)) {
    console.warn(`⚠️ [${endpoint}] Cards must be an array`);
    return NextResponse.json(
      { error: "Invalid data" },
      { status: 400, headers: apiJsonHeaders(request) },
    );
  }
  return null;
}

/**
 * Collects card names from the provided card objects and separates them
 * into supported (uniqueSupportedNames) and unknownNames sets.
 */
function collectUniqueAndUnknownCardNames(
  cards: unknown[],
  supportedNames: Set<string>,
): { uniqueSupportedNames: Set<string>; unknownNames: Set<string> } {
  const uniqueSupportedNames = new Set<string>();
  const unknownNames = new Set<string>();

  for (const c of cards) {
    if (typeof c === "object" && c !== null) {
      const name = (c as Record<string, unknown>).cardName;
      if (typeof name === "string" && name.length > 0) {
        if (supportedNames.has(name)) uniqueSupportedNames.add(name);
        else unknownNames.add(name);
      }
    }
  }

  return { uniqueSupportedNames, unknownNames };
}

/**
 * Compute the Levenshtein edit distance between two strings.
 */
function levenshteinDistance(a: string, b: string): number {
  const n = a.length;
  const m = b.length;
  const dp: number[][] = Array.from({ length: n + 1 }, () =>
    new Array<number>(m + 1).fill(0),
  );

  for (let i = 0; i <= n; i++) dp[i][0] = i;
  for (let j = 0; j <= m; j++) dp[0][j] = j;

  for (let i = 1; i <= n; i++) {
    for (let j = 1; j <= m; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      dp[i][j] = Math.min(
        dp[i - 1][j] + 1,
        dp[i][j - 1] + 1,
        dp[i - 1][j - 1] + cost,
      );
    }
  }

  return dp[n][m];
}

/**
 * Build suggestion candidates for unknown names using Levenshtein distance.
 */
function buildLevenshteinSuggestions(
  unknownNames: Set<string>,
  supportedArray: string[],
  maxDistance = 3,
  topN = 3,
): Record<string, string[]> {
  const suggestions: Record<string, string[]> = {};
  for (const unknown of unknownNames) {
    const candidates = supportedArray
      .map((s) => ({ s, d: levenshteinDistance(unknown, s) }))
      .sort((a, b) => a.d - b.d)
      .slice(0, topN)
      .filter((c) => c.d <= maxDistance)
      .map((c) => c.s);
    if (candidates.length) suggestions[unknown] = candidates;
  }
  return suggestions;
}

/**
 * Enforces a maximum on unique card types and returns an API error if exceeded.
 */
function validateUniqueCardTypes(
  cards: unknown[],
  endpoint: string,
  request?: Request,
): NextResponse<ApiError> | null {
  const maxSupportedTypes = Object.keys(displayNames).length || 33;
  const MAX_ALLOWED_CARDS = Math.max(33, maxSupportedTypes);

  const supportedNames = new Set<string>(Object.keys(displayNames));
  const { uniqueSupportedNames, unknownNames } =
    collectUniqueAndUnknownCardNames(cards, supportedNames);

  if (unknownNames.size > 0) {
    console.warn(
      `⚠️ [${endpoint}] Invalid card types provided: ${[...unknownNames].join(", ")}`,
    );

    const suggestions = buildLevenshteinSuggestions(unknownNames, [
      ...supportedNames,
    ]);

    return NextResponse.json(
      {
        error: "Invalid data: Invalid card type",
        invalidCardNames: [...unknownNames],
        suggestions,
      },
      { status: 400, headers: apiJsonHeaders(request) },
    );
  }

  if (uniqueSupportedNames.size > MAX_ALLOWED_CARDS) {
    console.warn(
      `⚠️ [${endpoint}] Too many unique card types provided: ${uniqueSupportedNames.size} (max ${MAX_ALLOWED_CARDS})`,
    );
    return NextResponse.json(
      {
        error: `Too many cards provided: ${uniqueSupportedNames.size} (max ${MAX_ALLOWED_CARDS})`,
      },
      { status: 400, headers: apiJsonHeaders(request) },
    );
  }

  return null;
}

/**
 * Validates each card object in the array using existing helper validators.
 */
function validateCardsItems(
  cards: unknown[],
  endpoint: string,
  request?: Request,
): NextResponse<ApiError> | null {
  for (let i = 0; i < cards.length; i++) {
    const card = cards[i];

    if (typeof card !== "object" || card === null) {
      console.warn(`⚠️ [${endpoint}] Card ${i} is not a valid object`);
      return NextResponse.json(
        { error: "Invalid data" },
        { status: 400, headers: apiJsonHeaders(request) },
      );
    }

    const cardRecord = card as Record<string, unknown>;

    const requiredFieldsError = validateCardRequiredFields(
      cardRecord,
      i,
      endpoint,
      request,
    );
    if (requiredFieldsError) return requiredFieldsError;

    const optionalFieldsError = validateCardOptionalFields(
      cardRecord,
      i,
      endpoint,
      request,
    );
    if (optionalFieldsError) return optionalFieldsError;
  }

  return null;
}

/**
 * Validates an array of cards provided in the store-cards endpoint, ensuring
 * userId is valid and that each card's required and optional fields are valid.
 * On success this returns a discriminated result with typed cards so callers
 * can safely use normalized `StoredCardConfig` objects. On failure it returns
 * an API error response wrapped in the failure branch of the result.
 * @param cards - Payload expected to be an array of card objects.
 * @param userId - User identifier associated with the cards.
 * @param endpoint - Logical endpoint name for logging/analytics.
 * @returns A discriminated union: success with typed cards or failure with an API error response.
 * @source
 */
export type ValidateCardDataResult =
  | { success: true; cards: StoredCardConfig[] }
  | { success: false; error: NextResponse<ApiError> };

export function validateCardData(
  cards: unknown,
  userId: unknown,
  endpoint: string,
  request?: Request,
): ValidateCardDataResult {
  const userIdError = validateUserIdField(userId, endpoint, request);
  if (userIdError) return { success: false, error: userIdError };

  const cardsArrayError = validateCardsArrayField(cards, endpoint, request);
  if (cardsArrayError) return { success: false, error: cardsArrayError };

  const cardsArr = cards as unknown[];

  const uniqueErr = validateUniqueCardTypes(cardsArr, endpoint, request);
  if (uniqueErr) return { success: false, error: uniqueErr };

  const itemsErr = validateCardsItems(cardsArr, endpoint, request);
  if (itemsErr) return { success: false, error: itemsErr };

  const typedCards: StoredCardConfig[] = cardsArr.map((card) => {
    const r = card as Record<string, unknown>;

    const coerceNum = (v: unknown): number | undefined => {
      if (v === undefined || v === null) return undefined;
      const n = Number(v);
      return Number.isFinite(n) ? n : undefined;
    };

    return {
      cardName: coerceToString(r.cardName),
      variation:
        typeof r.variation === "string" && r.variation.length > 0
          ? r.variation
          : undefined,
      colorPreset:
        typeof r.colorPreset === "string" && r.colorPreset.length > 0
          ? r.colorPreset
          : undefined,
      titleColor: r.titleColor as StoredCardConfig["titleColor"],
      backgroundColor: r.backgroundColor as StoredCardConfig["backgroundColor"],
      textColor: r.textColor as StoredCardConfig["textColor"],
      circleColor: r.circleColor as StoredCardConfig["circleColor"],
      borderColor:
        r.borderColor !== undefined && r.borderColor !== null
          ? (r.borderColor as StoredCardConfig["borderColor"])
          : undefined,
      borderRadius: coerceNum(r.borderRadius),
      showFavorites:
        typeof r.showFavorites === "boolean" ? r.showFavorites : undefined,
      useStatusColors:
        typeof r.useStatusColors === "boolean" ? r.useStatusColors : undefined,
      showPiePercentages:
        typeof r.showPiePercentages === "boolean"
          ? r.showPiePercentages
          : undefined,
      gridCols: coerceNum(r.gridCols),
      gridRows: coerceNum(r.gridRows),
      useCustomSettings:
        typeof r.useCustomSettings === "boolean"
          ? r.useCustomSettings
          : undefined,
      disabled: typeof r.disabled === "boolean" ? r.disabled : undefined,
    } as StoredCardConfig;
  });

  return { success: true, cards: typedCards };
}

/**
 * The result returned from initializing an API request, including timing
 * context and any early error response encountered during initialization.
 * @source
 */
export interface ApiInitResult {
  startTime: number;
  ip: string;
  endpoint: string;
  endpointKey: string;
  errorResponse?: NextResponse<ApiError>;
}

/**
 * Performs common API request initialization checks (rate limit, same-origin)
 * and returns contextual information needed by handlers.
 * @param request - The incoming Request object.
 * @param endpointName - Friendly endpoint name used for logs.
 * @param endpointKey - Stable canonical endpoint key used for analytics metric keys.
 * @returns ApiInitResult with startTime, ip, endpoint and any early errorResponse.
 * @source
 */
export async function initializeApiRequest(
  request: Request,
  endpointName: string,
  endpointKey: string,
  limiter?: Ratelimit,
): Promise<ApiInitResult> {
  const startTime = Date.now();
  const ip = request.headers.get("x-forwarded-for") || "127.0.0.1";
  const endpoint = endpointName;

  logRequest(endpoint, ip);

  const rateLimitResponse = await checkRateLimit(
    request,
    ip,
    endpoint,
    endpointKey,
    limiter,
  );
  if (rateLimitResponse) {
    return {
      startTime,
      ip,
      endpoint,
      endpointKey,
      errorResponse: rateLimitResponse,
    };
  }

  const sameOriginResponse = validateSameOrigin(request, endpoint, endpointKey);
  if (sameOriginResponse) {
    return {
      startTime,
      ip,
      endpoint,
      endpointKey,
      errorResponse: sameOriginResponse,
    };
  }

  return { startTime, ip, endpoint, endpointKey };
}
