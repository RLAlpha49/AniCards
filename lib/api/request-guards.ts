import type { Ratelimit } from "@upstash/ratelimit";
import type { NextResponse } from "next/server";

import { normalizeOrigin } from "@/lib/api/cors";
import { type ApiError, apiErrorResponse } from "@/lib/api/errors";
import { logPrivacySafe, logRequest } from "@/lib/api/logging";
import { checkRateLimit } from "@/lib/api/rate-limit";
import { ensureRequestContext } from "@/lib/api/request-context";
import {
  buildAnalyticsMetricKey,
  incrementAnalytics,
} from "@/lib/api/telemetry";

/**
 * Extracts the client IP address from trusted deployment headers only.
 */
export function getRequestIp(request?: Request): string {
  if (!request) {
    return "127.0.0.1";
  }

  const trustedHeaderNames = ["x-vercel-forwarded-for", "cf-connecting-ip"];
  for (const headerName of trustedHeaderNames) {
    const headerValue = request.headers.get(headerName)?.trim();
    if (headerValue) {
      return headerValue;
    }
  }

  return process.env.NODE_ENV === "production" ? "unknown" : "127.0.0.1";
}

export function validateSameOrigin(
  request: Request,
  endpointName: string,
  endpointKey: string,
  options?: {
    requireOrigin?: boolean;
  },
): NextResponse<ApiError> | null {
  const origin = normalizeOrigin(request.headers.get("origin"));
  const requestOrigin = new URL(request.url).origin;
  const configuredAppOrigin = normalizeOrigin(process.env.NEXT_PUBLIC_APP_URL);
  const requireOrigin = options?.requireOrigin ?? true;

  if (process.env.NODE_ENV === "production" && !configuredAppOrigin) {
    logPrivacySafe(
      "error",
      endpointName,
      "Rejected request because NEXT_PUBLIC_APP_URL is not configured in production.",
      undefined,
      request,
    );

    const metric = buildAnalyticsMetricKey(endpointKey, "failed_requests");
    void incrementAnalytics(metric);

    return apiErrorResponse(request, 503, "Server misconfigured", {
      category: "server_error",
      retryable: true,
    });
  }

  const allowedOrigin = configuredAppOrigin ?? requestOrigin;

  if (!origin) {
    if (!requireOrigin) {
      return null;
    }

    logPrivacySafe(
      "warn",
      endpointName,
      "Rejected request with missing Origin header",
      { allowedOrigin },
      request,
    );

    const metric = buildAnalyticsMetricKey(endpointKey, "failed_requests");
    void incrementAnalytics(metric);

    return apiErrorResponse(request, 401, "Unauthorized", {
      category: "authentication",
      retryable: false,
    });
  }

  if (origin !== allowedOrigin) {
    logPrivacySafe(
      "warn",
      endpointName,
      "Rejected cross-origin request",
      { origin, allowedOrigin },
      request,
    );

    const metric = buildAnalyticsMetricKey(endpointKey, "failed_requests");
    void incrementAnalytics(metric).catch((error) => {
      if (process.env.NODE_ENV !== "production") {
        logPrivacySafe("warn", endpointName, "Analytics increment failed", {
          metric,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    });

    return apiErrorResponse(request, 401, "Unauthorized", {
      category: "authentication",
      retryable: false,
    });
  }

  return null;
}

export interface ApiInitResult {
  startTime: number;
  ip: string;
  endpoint: string;
  endpointKey: string;
  requestId: string;
  errorResponse?: NextResponse<ApiError>;
}

export async function initializeApiRequest(
  request: Request,
  endpointName: string,
  endpointKey: string,
  limiter?: Ratelimit,
  options?: {
    requireOrigin?: boolean;
    skipRateLimit?: boolean;
    skipSameOrigin?: boolean;
    requestId?: string;
  },
): Promise<ApiInitResult> {
  const startTime = Date.now();
  const ip = getRequestIp(request);
  const endpoint = endpointName;
  const requestContext = ensureRequestContext(request, {
    endpoint,
    endpointKey,
    ip,
    requestId: options?.requestId,
  });

  logRequest(endpoint, ip, request);

  if (!options?.skipRateLimit) {
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
        requestId: requestContext.requestId,
        errorResponse: rateLimitResponse,
      };
    }
  }

  if (!options?.skipSameOrigin) {
    const sameOriginResponse = validateSameOrigin(
      request,
      endpoint,
      endpointKey,
      {
        requireOrigin: options?.requireOrigin ?? true,
      },
    );
    if (sameOriginResponse) {
      return {
        startTime,
        ip,
        endpoint,
        endpointKey,
        requestId: requestContext.requestId,
        errorResponse: sameOriginResponse,
      };
    }
  }

  return {
    startTime,
    ip,
    endpoint,
    endpointKey,
    requestId: requestContext.requestId,
  };
}
