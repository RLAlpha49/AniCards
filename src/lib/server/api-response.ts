/**
 * The error path every JSON route ends in.
 *
 * Logs the failure with its request context, counts it, and returns the
 * JSON error response.
 * @source
 */
import { NextResponse, after } from "next/server";
import { Redis } from "@upstash/redis";
import { logWith } from "@/lib/log";
import { ApiError } from "@/lib/api/errors";
import { jsonWithCors } from "@/lib/api/http";
import { incrementAnalyticsInBackground } from "@/lib/server/analytics-counters";

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
  logWith("error", endpoint, `Error after ${duration}ms: ${error.message}`);

  if (error.stack) {
    logWith("error", endpoint, `Stack Trace: ${error.stack}`);
  }

  incrementAnalyticsInBackground(analyticsMetric);

  return jsonWithCors({ error: errorMessage }, request, 500);
}
