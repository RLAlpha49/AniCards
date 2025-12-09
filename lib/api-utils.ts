import { NextResponse } from "next/server";
import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";
import type { Agent as HttpAgent } from "node:http";
import type { Agent as HttpsAgent } from "node:https";
import {
  validateBorderRadius,
  validateColorValue,
  getColorInvalidReason,
} from "@/lib/utils";

/**
 * Optional keep-alive HTTP(S) agent used only in Node runtimes to improve
 * connection reuse for Redis/Upstash requests.
 * @source
 */
let agent: HttpAgent | HttpsAgent | undefined = undefined;
try {
  // Prefer detecting the Edge runtime explicit flag for Next.js.
  const isEdge = process?.env?.NEXT_RUNTIME === "edge";
  const isNode = typeof process !== "undefined" && !!process.versions?.node;

  if (isNode && !isEdge) {
    // Use dynamic require here to keep this module compatible with edge runtimes
    const https = require("node:https");
    agent = new https.Agent({
      keepAlive: true,
      keepAliveMsecs: 30000,
      maxSockets: 100,
    });
  }
} catch {
  if (process.env.NODE_ENV !== "production") {
    console.debug(
      "Warning: HTTPS Agent not available; continuing without keepAlive agent.",
    );
  }
  agent = undefined;
}

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
    agent,
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
 * Validates that the provided request data contains a valid userId.
 * @param data - The payload to validate.
 * @param endpoint - Logical endpoint name for logging context.
 * @returns A NextResponse with an ApiError when invalid, or null otherwise.
 * @source
 */
export function validateRequestData(
  data: Record<string, unknown>,
  endpoint: string,
  request?: Request,
): NextResponse<ApiError> | null {
  if (!data.userId) {
    console.warn(`⚠️ [${endpoint}] Missing userId in request`);
    return jsonWithCors(
      { error: "Missing required field: userId" },
      request,
      400,
    );
  }
  return null;
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
  // Check required fields
  if (data.userId === undefined || data.userId === null) {
    console.warn(`⚠️ [${endpoint}] Missing userId`);
    return jsonWithCors({ error: "Invalid data" }, request, 400);
  }

  // Validate userId is a number
  const userId = Number(data.userId);
  if (!Number.isInteger(userId) || userId <= 0) {
    console.warn(`⚠️ [${endpoint}] Invalid userId format: ${data.userId}`);
    return jsonWithCors({ error: "Invalid data" }, request, 400);
  }

  // Validate username if provided
  if (data.username !== undefined && data.username !== null) {
    if (!isValidUsername(data.username)) {
      console.warn(`⚠️ [${endpoint}] Username invalid: ${data.username}`);
      return jsonWithCors({ error: "Invalid data" }, request, 400);
    }
  }

  // Validate stats exists and is an object
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
  // Only allow letters, numbers, underscores, hyphens and whitespace inside usernames.
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

  /** Validate required color fields, allowing hex string or gradient defs. */
  function validateRequiredColorFields(
    cardObj: Record<string, unknown>,
    fields: string[],
  ): NextResponse<ApiError> | null {
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
        console.warn(
          `⚠️ [${endpoint}] Card ${cardIndex} invalid color or gradient format for ${field} (${reason})`,
        );
        return NextResponse.json(
          { error: "Invalid data" },
          { status: 400, headers: apiJsonHeaders(request) },
        );
      }
    }
    return null;
  }

  const reqStrErr = validateRequiredStringFields(card, requiredStringFields);
  if (reqStrErr) return reqStrErr;

  const rawPreset = card["colorPreset"];
  const preset =
    typeof rawPreset === "string" && rawPreset.trim().length > 0
      ? rawPreset
      : undefined;
  const requireColorFields = preset === undefined || preset === "custom";
  if (requireColorFields) {
    const reqColorErr = validateRequiredColorFields(card, requiredColorFields);
    if (reqColorErr) return reqColorErr;
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
  // Validate optional boolean fields
  const optionalBooleanFields = [
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

  // Validate borderColor if present (optional, can be hex string or gradient)
  const borderColorValue = card.borderColor;
  const hasBorder = borderColorValue !== undefined && borderColorValue !== null;
  if (hasBorder) {
    if (!validateColorValue(borderColorValue)) {
      const reason = getColorInvalidReason(borderColorValue);
      console.warn(
        `⚠️ [${endpoint}] Card ${cardIndex} invalid borderColor format (${reason})`,
      );
      return NextResponse.json(
        { error: "Invalid data" },
        { status: 400, headers: apiJsonHeaders(request) },
      );
    }
  }

  const borderRadiusValue = card.borderRadius;
  const borderRadiusError = validateBorderRadiusField(
    borderRadiusValue,
    cardIndex,
    endpoint,
    { requireValue: hasBorder },
    request,
  );
  if (borderRadiusError) return borderRadiusError;

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
 * Validates an array of cards provided in the store-cards endpoint, ensuring
 * userId is valid and that each card's required and optional fields are valid.
 * @param cards - Payload expected to be an array of card objects.
 * @param userId - User identifier associated with the cards.
 * @param endpoint - Logical endpoint name for logging/analytics.
 * @returns A NextResponse with an ApiError when invalid, or null otherwise.
 * @source
 */
export function validateCardData(
  cards: unknown,
  userId: unknown,
  endpoint: string,
  request?: Request,
): NextResponse<ApiError> | null {
  // Validate userId
  if (userId === undefined || userId === null) {
    console.warn(`⚠️ [${endpoint}] Missing userId`);
    return NextResponse.json(
      { error: "Invalid data" },
      { status: 400, headers: apiJsonHeaders(request) },
    );
  }

  const userIdNum = Number(userId);
  if (!Number.isInteger(userIdNum) || userIdNum <= 0) {
    console.warn(`⚠️ [${endpoint}] Invalid userId format: ${userId}`);
    return NextResponse.json(
      { error: "Invalid data" },
      { status: 400, headers: apiJsonHeaders(request) },
    );
  }

  // Validate cards is an array
  if (!Array.isArray(cards)) {
    console.warn(`⚠️ [${endpoint}] Cards must be an array`);
    return NextResponse.json(
      { error: "Invalid data" },
      { status: 400, headers: apiJsonHeaders(request) },
    );
  }

  // Validate cards array is not too large (prevent DOS attacks)
  if (cards.length > 21) {
    console.warn(`⚠️ [${endpoint}] Too many cards provided: ${cards.length}`);
    return NextResponse.json(
      { error: "Invalid data" },
      { status: 400, headers: apiJsonHeaders(request) },
    );
  }

  // Validate each card in the array
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

    // Validate required fields
    const requiredFieldsError = validateCardRequiredFields(
      cardRecord,
      i,
      endpoint,
      request,
    );
    if (requiredFieldsError) return requiredFieldsError;

    // Validate optional fields
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

  // Check rate limit
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

  // Validate same-origin request (for write operations)
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
