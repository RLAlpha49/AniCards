/**
 * Rejects cross-origin writes addressed to a different origin.
 *
 * Internal calls with no `Origin` header pass. Anything else must match an
 * origin this deployment serves.
 * @source
 */
import { NextResponse } from "next/server";
import { logWith } from "@/lib/log";
import { ApiError } from "@/lib/api/errors";
import { getAllowedApiOrigins, jsonWithCors } from "@/lib/api/http";
import {
  buildAnalyticsMetricKey,
  incrementAnalyticsInBackground,
} from "@/lib/server/analytics-counters";

/**
 * Validates that a given request originates from a host this deployment
 * serves (or is an internal request with no origin header). Cross-origin
 * requests are rejected with a 401 response.
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
  const allowedOrigins = getAllowedApiOrigins(request);

  // Allow internal requests (no origin) or requests from a host we serve
  const isSameOrigin = !origin || allowedOrigins.has(origin);

  if (!isSameOrigin) {
    logWith(
      "warn",
      endpointName,
      `Rejected cross-origin request from: ${origin} (allowed: ${[...allowedOrigins].join(", ")})`,
    );

    const metric = buildAnalyticsMetricKey(endpointKey, "failed_requests");

    incrementAnalyticsInBackground(metric);

    if (process.env.NODE_ENV === "production") {
      return jsonWithCors({ error: "Unauthorized" }, request, 401);
    }
    // In dev mode, still return headers for consistent CORS behavior
    return jsonWithCors({ error: "Unauthorized" }, request, 401);
  }

  return null;
}
