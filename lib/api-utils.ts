import { NextResponse } from "next/server";
import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";
import type { Agent as HttpAgent } from "node:http";
import type { Agent as HttpsAgent } from "node:https";

// Shared Redis client and rate limiter configuration
// Edge runtime compatibility: don't require Node-only modules on edge.
// Prefer a single module-scoped client so it can be reused across requests.
// Create a Node https agent with keepAlive only in Node server runtimes.
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

// Common response types
export interface ApiError {
  error: string;
}

// Rate limiting middleware
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

// Same-origin validation for internal requests
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

// Analytics tracking helper
export async function incrementAnalytics(metric: string): Promise<void> {
  try {
    await redisClient.incr(metric);
  } catch (error) {
    // Silently fail analytics to avoid affecting main functionality
    console.warn(`Failed to increment analytics for ${metric}:`, error);
  }
}

// Request logging helper
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

// Success logging helper
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

// Common request validation
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

// Validation for store-users endpoint
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
    if (typeof data.username !== "string") {
      console.warn(`⚠️ [${endpoint}] Username must be a string`);
      return NextResponse.json({ error: "Invalid data" }, { status: 400 });
    }
    // Check length constraints
    if (data.username.length === 0 || data.username.length > 100) {
      console.warn(
        `⚠️ [${endpoint}] Username length invalid: ${data.username.length}`,
      );
      return NextResponse.json({ error: "Invalid data" }, { status: 400 });
    }
    // Check for suspicious characters or injection attempts
    if (!/^[a-zA-Z0-9_-\s]*$/.test(data.username)) {
      console.warn(`⚠️ [${endpoint}] Username contains invalid characters`);
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

// Validation helpers for card data
function isValidHexColor(color: string): boolean {
  return /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})([0-9a-fA-F]{2})?$/.test(color);
}

function validateCardRequiredFields(
  card: Record<string, unknown>,
  cardIndex: number,
  endpoint: string,
): NextResponse<ApiError> | null {
  const requiredStringFields = [
    "cardName",
    "variation",
    "titleColor",
    "backgroundColor",
    "textColor",
    "circleColor",
  ];

  for (const field of requiredStringFields) {
    if (typeof card[field] !== "string") {
      console.warn(
        `⚠️ [${endpoint}] Card ${cardIndex} missing or invalid field: ${field}`,
      );
      return NextResponse.json({ error: "Invalid data" }, { status: 400 });
    }

    const value = card[field];

    // Validate color format
    if (field.includes("Color") && !isValidHexColor(value)) {
      console.warn(
        `⚠️ [${endpoint}] Card ${cardIndex} invalid color format for ${field}: ${value}`,
      );
      return NextResponse.json({ error: "Invalid data" }, { status: 400 });
    }

    // Validate length constraints
    if (value.length === 0 || value.length > 100) {
      console.warn(
        `⚠️ [${endpoint}] Card ${cardIndex} field ${field} exceeds length limits`,
      );
      return NextResponse.json({ error: "Invalid data" }, { status: 400 });
    }
  }

  return null;
}

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

  // Validate borderColor if present (optional)
  if (card.borderColor !== undefined && typeof card.borderColor === "string") {
    if (!isValidHexColor(card.borderColor)) {
      console.warn(
        `⚠️ [${endpoint}] Card ${cardIndex} invalid borderColor format: ${card.borderColor}`,
      );
      return NextResponse.json({ error: "Invalid data" }, { status: 400 });
    }
  }

  return null;
}

// Validation for store-cards endpoint
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

// Common API initialization and validation
export interface ApiInitResult {
  startTime: number;
  ip: string;
  endpoint: string;
  errorResponse?: NextResponse<ApiError>;
}

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
