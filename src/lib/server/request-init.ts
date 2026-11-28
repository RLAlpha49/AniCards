/**
 * The shared opening of an API request.
 *
 * Resolves the caller address, enforces the rate limit, and checks the
 * origin, returning either the initialised context or the early error
 * response.
 * @source
 */
import { NextResponse } from "next/server";
import { Ratelimit } from "@upstash/ratelimit";
import { logRequest } from "@/lib/server/api-logging";
import { getClientIp } from "@/lib/api/client-ip";
import { ApiError } from "@/lib/api/errors";
import { checkRateLimit } from "@/lib/server/rate-limit";
import { validateSameOrigin } from "@/lib/server/same-origin";

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
  const ip = getClientIp(request);
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
