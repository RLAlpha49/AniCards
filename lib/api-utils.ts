import { NextResponse } from "next/server";
import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

// Shared Redis client and rate limiter configuration
export const redisClient = Redis.fromEnv();
export const ratelimit = new Ratelimit({
  redis: redisClient,
  limiter: Ratelimit.slidingWindow(5, "5 s"),
});

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

// Authentication validation
export function validateAuth(
  authToken: string | null,
  ip: string,
  endpoint: string,
): NextResponse<ApiError> | null {
  if (!authToken || authToken !== `Bearer ${process.env.API_AUTH_TOKEN}`) {
    console.warn(`⚠️ [${endpoint}] Invalid auth token from IP: ${ip}`);
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
    const analyticsClient = Redis.fromEnv();
    await analyticsClient.incr(metric);
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

// Error logging and response helper
export function handleError(
  error: Error,
  endpoint: string,
  startTime: number,
  analyticsMetric: string,
): NextResponse<ApiError> {
  const duration = Date.now() - startTime;
  console.error(`🔥 [${endpoint}] Error after ${duration}ms: ${error.message}`);

  if (error.stack) {
    console.error(`💥 [${endpoint}] Stack Trace: ${error.stack}`);
  }

  incrementAnalytics(analyticsMetric).catch(() => {});

  const errorMessage = endpoint.includes("Cards")
    ? "Card storage failed"
    : "User storage failed";
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

  // Validate authentication
  const authToken = request.headers.get("Authorization");
  const authResponse = validateAuth(authToken, ip, endpoint);
  if (authResponse) {
    return { startTime, ip, endpoint, errorResponse: authResponse };
  }

  return { startTime, ip, endpoint };
}
