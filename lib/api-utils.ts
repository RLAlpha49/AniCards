import { NextResponse } from "next/server";
import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";
import type { Agent as HttpAgent } from "node:http";
import type { Agent as HttpsAgent } from "node:https";
import { isValidGradient } from "@/lib/utils";

// Shared Redis client and rate limiter configuration
// Edge runtime compatibility: don't require Node-only modules on edge.
// Prefer a single module-scoped client so it can be reused across requests.
// Create a Node https agent with keepAlive only in Node server runtimes.
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
} catch (err) {
  // Keep agent undefined if anything fails (safe fallback for edge or restricted runtimes)
  // Log for debugging in dev environments to help find problems
  if (process.env.NODE_ENV !== "production") {
    console.debug(
      "Warning: HTTPS Agent not available; continuing without keepAlive agent.",
      err,
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
 * Standardized API error response shape returned from API routes.
 * @source
 */
export interface ApiError {
  error: string;
}

/**
 * Enforces a rate limit for an IP address using the configured Upstash
 * rate limiter. Records analytics and returns a 429 response on limit.
 * @param ip - IP address to check.
 * @param endpoint - Logical endpoint name used for logging/analytics.
 * @returns A NextResponse with an ApiError when limited, or null when allowed.
 * @source
 */
export async function checkRateLimit(
  ip: string,
  endpoint: string,
): Promise<NextResponse<ApiError> | null> {
  const { success } = await ratelimit.limit(ip);
  if (!success) {
    console.warn(`🚨 [${endpoint}] Rate limited IP: ${ip}`);
    await incrementAnalytics(
      `analytics:${endpoint.toLowerCase().replace(" ", "_")}:failed_requests`,
    );
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }
  return null;
}

/**
 * Validates that a given request originates from the same origin as the
 * application (or an internal request with no origin header). In
 * production, cross-origin requests are rejected with a 401 response.
 * @param request - The incoming Request object to evaluate.
 * @param endpoint - Logical endpoint name for logging/analytics.
 * @returns A NextResponse with an ApiError when unauthorized, or null when allowed.
 * @source
 */
export function validateSameOrigin(
  request: Request,
  endpoint: string,
): NextResponse<ApiError> | null {
  const origin = request.headers.get("origin");
  const appUrl = process.env.NEXT_PUBLIC_APP_URL;

  // Allow internal requests (no origin) or same-origin requests
  const isSameOrigin = !origin || origin === appUrl;

  if (process.env.NODE_ENV === "production" && !isSameOrigin) {
    console.warn(
      `🔐 [${endpoint}] Rejected cross-origin request from: ${origin}`,
    );
    incrementAnalytics(
      `analytics:${endpoint.toLowerCase().replace(" ", "_")}:failed_requests`,
    ).catch(() => {});
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
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
): NextResponse<ApiError> {
  const duration = Date.now() - startTime;
  console.error(`🔥 [${endpoint}] Error after ${duration}ms: ${error.message}`);

  if (error.stack) {
    console.error(`💥 [${endpoint}] Stack Trace: ${error.stack}`);
  }

  incrementAnalytics(analyticsMetric).catch(() => {});

  return NextResponse.json({ error: errorMessage }, { status: 500 });
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
): NextResponse<ApiError> | null {
  if (!data.userId) {
    console.warn(`⚠️ [${endpoint}] Missing userId in request`);
    return NextResponse.json(
      { error: "Missing required field: userId" },
      { status: 400 },
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
): NextResponse<ApiError> | null {
  // Check required fields
  if (data.userId === undefined || data.userId === null) {
    console.warn(`⚠️ [${endpoint}] Missing userId`);
    return NextResponse.json({ error: "Invalid data" }, { status: 400 });
  }

  // Validate userId is a number
  const userId = Number(data.userId);
  if (!Number.isInteger(userId) || userId <= 0) {
    console.warn(`⚠️ [${endpoint}] Invalid userId format: ${data.userId}`);
    return NextResponse.json({ error: "Invalid data" }, { status: 400 });
  }

  // Validate username if provided
  if (data.username !== undefined && data.username !== null) {
    if (!isValidUsername(data.username)) {
      console.warn(`⚠️ [${endpoint}] Username invalid: ${data.username}`);
      return NextResponse.json({ error: "Invalid data" }, { status: 400 });
    }
  }

  // Validate stats exists and is an object
  if (!data.stats || typeof data.stats !== "object") {
    console.warn(`⚠️ [${endpoint}] Stats must be a valid object`);
    return NextResponse.json({ error: "Invalid data" }, { status: 400 });
  }

  return null;
}

/**
 * Verifies a hex color string is a 3/6/8 character hex (with leading #).
 * Note: This only validates hex strings, not gradient objects.
 * Use isValidColorValue for validating both hex strings and gradients.
 * @param color - Hex color string to validate.
 * @returns True when color matches expected hex format.
 * @source
 */
function isValidHexColor(color: string): boolean {
  return /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})([0-9a-fA-F]{2})?$/.test(color);
}

/**
 * Validates a color value which can be either a hex string or a gradient object.
 * @param value - The color value to validate.
 * @returns True if the value is a valid hex color or gradient definition.
 * @source
 */
function isValidColorValue(value: unknown): boolean {
  if (typeof value === "string") {
    return isValidHexColor(value);
  }
  return isValidGradient(value);
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
): NextResponse<ApiError> | null {
  const requiredStringFields = ["cardName", "variation"];
  const requiredColorFields = [
    "titleColor",
    "backgroundColor",
    "textColor",
    "circleColor",
  ];

  // Validate string fields
  for (const field of requiredStringFields) {
    if (typeof card[field] !== "string") {
      console.warn(
        `⚠️ [${endpoint}] Card ${cardIndex} missing or invalid field: ${field}`,
      );
      return NextResponse.json({ error: "Invalid data" }, { status: 400 });
    }

    const value = card[field];
    if (typeof value !== "string") continue;

    // Validate length constraints
    if (value.length === 0 || value.length > 100) {
      console.warn(
        `⚠️ [${endpoint}] Card ${cardIndex} field ${field} exceeds length limits`,
      );
      return NextResponse.json({ error: "Invalid data" }, { status: 400 });
    }
  }

  // Validate color fields (can be hex string or gradient object)
  for (const field of requiredColorFields) {
    const value = card[field];
    if (value === undefined || value === null) {
      console.warn(
        `⚠️ [${endpoint}] Card ${cardIndex} missing required color field: ${field}`,
      );
      return NextResponse.json({ error: "Invalid data" }, { status: 400 });
    }

    if (!isValidColorValue(value)) {
      console.warn(
        `⚠️ [${endpoint}] Card ${cardIndex} invalid color or gradient format for ${field}`,
      );
      return NextResponse.json({ error: "Invalid data" }, { status: 400 });
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
      return NextResponse.json({ error: "Invalid data" }, { status: 400 });
    }
  }

  // Validate borderColor if present (optional, can be hex string or gradient)
  if (card.borderColor !== undefined && card.borderColor !== null) {
    if (!isValidColorValue(card.borderColor)) {
      console.warn(
        `⚠️ [${endpoint}] Card ${cardIndex} invalid borderColor format`,
      );
      return NextResponse.json({ error: "Invalid data" }, { status: 400 });
    }
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
): NextResponse<ApiError> | null {
  // Validate userId
  if (userId === undefined || userId === null) {
    console.warn(`⚠️ [${endpoint}] Missing userId`);
    return NextResponse.json({ error: "Invalid data" }, { status: 400 });
  }

  const userIdNum = Number(userId);
  if (!Number.isInteger(userIdNum) || userIdNum <= 0) {
    console.warn(`⚠️ [${endpoint}] Invalid userId format: ${userId}`);
    return NextResponse.json({ error: "Invalid data" }, { status: 400 });
  }

  // Validate cards is an array
  if (!Array.isArray(cards)) {
    console.warn(`⚠️ [${endpoint}] Cards must be an array`);
    return NextResponse.json({ error: "Invalid data" }, { status: 400 });
  }

  // Validate cards array is not too large (prevent DOS attacks)
  if (cards.length > 21) {
    console.warn(`⚠️ [${endpoint}] Too many cards provided: ${cards.length}`);
    return NextResponse.json({ error: "Invalid data" }, { status: 400 });
  }

  // Validate each card in the array
  for (let i = 0; i < cards.length; i++) {
    const card = cards[i];

    if (typeof card !== "object" || card === null) {
      console.warn(`⚠️ [${endpoint}] Card ${i} is not a valid object`);
      return NextResponse.json({ error: "Invalid data" }, { status: 400 });
    }

    const cardRecord = card as Record<string, unknown>;

    // Validate required fields
    const requiredFieldsError = validateCardRequiredFields(
      cardRecord,
      i,
      endpoint,
    );
    if (requiredFieldsError) return requiredFieldsError;

    // Validate optional fields
    const optionalFieldsError = validateCardOptionalFields(
      cardRecord,
      i,
      endpoint,
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
  errorResponse?: NextResponse<ApiError>;
}

/**
 * Performs common API request initialization checks (rate limit, same-origin)
 * and returns contextual information needed by handlers.
 * @param request - The incoming Request object.
 * @param endpointName - Friendly endpoint name used for logs and analytics.
 * @returns ApiInitResult with startTime, ip, endpoint and any early errorResponse.
 * @source
 */
export async function initializeApiRequest(
  request: Request,
  endpointName: string,
): Promise<ApiInitResult> {
  const startTime = Date.now();
  const ip = request.headers.get("x-forwarded-for") || "127.0.0.1";
  const endpoint = endpointName;

  logRequest(endpoint, ip);

  // Check rate limit
  const rateLimitResponse = await checkRateLimit(ip, endpoint);
  if (rateLimitResponse) {
    return { startTime, ip, endpoint, errorResponse: rateLimitResponse };
  }

  // Validate same-origin request (for write operations)
  const sameOriginResponse = validateSameOrigin(request, endpoint);
  if (sameOriginResponse) {
    return { startTime, ip, endpoint, errorResponse: sameOriginResponse };
  }

  return { startTime, ip, endpoint };
}
