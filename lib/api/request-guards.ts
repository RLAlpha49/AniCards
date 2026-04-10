import type { Ratelimit } from "@upstash/ratelimit";
import type { NextResponse } from "next/server";

import { normalizeOrigin } from "@/lib/api/cors";
import { type ApiError, apiErrorResponse } from "@/lib/api/errors";
import { logPrivacySafe, logRequest } from "@/lib/api/logging";
import { checkRateLimit } from "@/lib/api/rate-limit";
import { ensureRequestContext } from "@/lib/api/request-context";
import {
  getRequestProofCookie,
  resolveVerifiedClientIp,
  type VerifiedClientIpResult,
  verifyRequestProofToken,
} from "@/lib/api/request-proof";
import {
  buildAnalyticsMetricKey,
  incrementAnalytics,
  scheduleTelemetryTask,
} from "@/lib/api/telemetry";

/**
 * Extracts the client IP address from trusted deployment headers only.
 */
export function getRequestIp(request?: Request): string {
  const clientIp = resolveVerifiedClientIp(request);
  return clientIp.verified ? clientIp.ip : "unknown";
}

function incrementFailedRequestMetric(
  endpointName: string,
  endpointKey: string,
  request: Request,
): void {
  const metric = buildAnalyticsMetricKey(endpointKey, "failed_requests");
  scheduleTelemetryTask(() => incrementAnalytics(metric), {
    endpoint: endpointName,
    taskName: metric,
    request,
  });
}

function createUnverifiedClientIpResponse(
  request: Request,
  endpointName: string,
  endpointKey: string,
  clientIp: Extract<VerifiedClientIpResult, { verified: false }>,
): NextResponse<ApiError> {
  logPrivacySafe(
    "error",
    endpointName,
    "Rejected request because the client IP could not be verified.",
    {
      reason: clientIp.reason,
    },
    request,
  );
  incrementFailedRequestMetric(endpointName, endpointKey, request);

  return apiErrorResponse(request, 503, "Client IP could not be verified", {
    category: "server_error",
    retryable: true,
  });
}

async function validateRequestProof(
  request: Request,
  endpointName: string,
  endpointKey: string,
  clientIp: VerifiedClientIpResult,
): Promise<NextResponse<ApiError> | null> {
  if (!clientIp.verified) {
    return createUnverifiedClientIpResponse(
      request,
      endpointName,
      endpointKey,
      clientIp,
    );
  }

  const verification = await verifyRequestProofToken(
    getRequestProofCookie(request),
    {
      ip: clientIp.ip,
      userAgent: request.headers.get("user-agent"),
    },
  );

  if (verification.valid) {
    return null;
  }

  const isServerMisconfigured = verification.reason === "missing_secret";
  logPrivacySafe(
    isServerMisconfigured ? "error" : "warn",
    endpointName,
    isServerMisconfigured
      ? "Rejected request because API_SECRET_TOKEN is not configured."
      : "Rejected request with missing or invalid request proof.",
    {
      reason: verification.reason,
    },
    request,
  );
  incrementFailedRequestMetric(endpointName, endpointKey, request);

  return apiErrorResponse(
    request,
    isServerMisconfigured ? 503 : 401,
    isServerMisconfigured
      ? "API_SECRET_TOKEN is not configured"
      : "Unauthorized",
    {
      category: isServerMisconfigured ? "server_error" : "authentication",
      retryable: isServerMisconfigured,
    },
  );
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
    incrementFailedRequestMetric(endpointName, endpointKey, request);

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
    incrementFailedRequestMetric(endpointName, endpointKey, request);

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
    incrementFailedRequestMetric(endpointName, endpointKey, request);

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
    requireRequestProof?: boolean;
    requireVerifiedClientIp?: boolean;
    skipRateLimit?: boolean;
    skipSameOrigin?: boolean;
    requestId?: string;
  },
): Promise<ApiInitResult> {
  const startTime = Date.now();
  const clientIp = resolveVerifiedClientIp(request);
  const ip = clientIp.verified ? clientIp.ip : "unknown";
  const endpoint = endpointName;
  const requireVerifiedClientIp =
    options?.requireVerifiedClientIp ?? options?.requireRequestProof ?? false;
  const requestContext = ensureRequestContext(request, {
    endpoint,
    endpointKey,
    ip,
    requestId: options?.requestId,
  });

  logRequest(endpoint, ip, request);

  if (requireVerifiedClientIp && !clientIp.verified) {
    return {
      startTime,
      ip,
      endpoint,
      endpointKey,
      requestId: requestContext.requestId,
      errorResponse: createUnverifiedClientIpResponse(
        request,
        endpoint,
        endpointKey,
        clientIp,
      ),
    };
  }

  if (!options?.skipRateLimit) {
    const rateLimitResponse = await checkRateLimit(
      request,
      {
        ip,
        verified: clientIp.verified,
        ...(clientIp.verified ? { source: clientIp.source } : {}),
      },
      endpoint,
      endpointKey,
      limiter,
      { requireVerifiedIp: requireVerifiedClientIp },
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

  if (options?.requireRequestProof) {
    const requestProofResponse = await validateRequestProof(
      request,
      endpoint,
      endpointKey,
      clientIp,
    );
    if (requestProofResponse) {
      return {
        startTime,
        ip,
        endpoint,
        endpointKey,
        requestId: requestContext.requestId,
        errorResponse: requestProofResponse,
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
