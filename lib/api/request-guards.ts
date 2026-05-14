import type { Ratelimit } from "@upstash/ratelimit";
import type { NextResponse } from "next/server";

import { normalizeOrigin } from "@/lib/api/cors";
import { type ApiError, apiErrorResponse } from "@/lib/api/errors";
import { logPrivacySafe, logRequest } from "@/lib/api/logging";
import {
  getProtectedWriteGrantCookie,
  type ProtectedWriteGrant,
  verifyProtectedWriteGrantToken,
} from "@/lib/api/protected-write-grants";
import { checkRateLimit, createRateLimitIdentity } from "@/lib/api/rate-limit";
import { ensureRequestContext } from "@/lib/api/request-context";
import {
  getRequestProofCookie,
  resolveVerifiedClientIp,
  type VerifiedClientIpResult,
  verifyRequestProofToken,
} from "@/lib/api/request-proof";
import {
  buildFailedRequestMetricKeys,
  scheduleLowValueAnalyticsBatch,
} from "@/lib/api/telemetry";

function incrementFailedRequestMetric(
  endpointName: string,
  endpointKey: string,
  request: Request,
  reasonCode?: string,
): void {
  const metrics = buildFailedRequestMetricKeys(endpointKey, reasonCode);
  scheduleLowValueAnalyticsBatch(metrics, {
    endpoint: endpointName,
    request,
    taskName: metrics[0],
  });
}

function getUnverifiedClientIpReasonCode(
  clientIp: Extract<VerifiedClientIpResult, { verified: false }>,
): string {
  return `client_ip_${clientIp.reason}`;
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
  incrementFailedRequestMetric(
    endpointName,
    endpointKey,
    request,
    getUnverifiedClientIpReasonCode(clientIp),
  );

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
  incrementFailedRequestMetric(
    endpointName,
    endpointKey,
    request,
    `request_proof_${verification.reason}`,
  );

  return apiErrorResponse(
    request,
    isServerMisconfigured ? 503 : 401,
    isServerMisconfigured ? "Server misconfigured" : "Unauthorized",
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
    incrementFailedRequestMetric(
      endpointName,
      endpointKey,
      request,
      "origin_misconfigured",
    );

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
    incrementFailedRequestMetric(
      endpointName,
      endpointKey,
      request,
      "missing_origin",
    );

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
    incrementFailedRequestMetric(
      endpointName,
      endpointKey,
      request,
      "cross_origin",
    );

    return apiErrorResponse(request, 401, "Unauthorized", {
      category: "authentication",
      retryable: false,
    });
  }

  return null;
}

function createProtectedWriteGrantResponse(
  request: Request,
  endpointName: string,
  endpointKey: string,
  reason:
    | "expired"
    | "invalid_payload"
    | "invalid_signature"
    | "malformed_token"
    | "missing_secret"
    | "missing_stats_hash"
    | "missing_token"
    | "stats_hash_mismatch"
    | "user_id_mismatch",
  context?: Record<string, unknown>,
): NextResponse<ApiError> {
  logPrivacySafe(
    reason === "missing_secret" ? "error" : "warn",
    endpointName,
    "Rejected protected write because the browser was not bound to the requested user.",
    {
      reason,
      ...context,
    },
    request,
  );
  incrementFailedRequestMetric(
    endpointName,
    endpointKey,
    request,
    `protected_write_grant_${reason}`,
  );

  return apiErrorResponse(
    request,
    reason === "missing_secret" ? 503 : 403,
    reason === "missing_secret" ? "Server misconfigured" : "Forbidden",
    {
      category: reason === "missing_secret" ? "server_error" : "authentication",
      retryable: reason === "missing_secret",
    },
  );
}

export async function validateProtectedWriteGrant(params: {
  endpointKey: string;
  endpointName: string;
  request: Request;
  requireStatsHash?: boolean;
  statsPayload?: unknown;
  userId: number | string;
}): Promise<
  | {
      grant: ProtectedWriteGrant;
    }
  | {
      errorResponse: NextResponse<ApiError>;
    }
> {
  const token = getProtectedWriteGrantCookie(params.request, params.userId);
  const verification = await verifyProtectedWriteGrantToken(token, {
    expectedUserId: params.userId,
    expectedStatsPayload: params.statsPayload,
    requireStatsHash: params.requireStatsHash,
  });

  if (!verification.valid) {
    return {
      errorResponse: createProtectedWriteGrantResponse(
        params.request,
        params.endpointName,
        params.endpointKey,
        verification.reason,
        { userId: String(params.userId) },
      ),
    };
  }

  if (verification.reason === "test_bypass") {
    return {
      grant: {
        source: "test_bypass",
        userId: String(params.userId),
      },
    };
  }

  const payload = verification.payload;
  if (!payload) {
    return {
      errorResponse: createProtectedWriteGrantResponse(
        params.request,
        params.endpointName,
        params.endpointKey,
        "invalid_payload",
        { userId: String(params.userId) },
      ),
    };
  }

  return {
    grant: {
      source: payload.source,
      statsHash: payload.statsHash,
      userId: payload.userId,
      ...(payload.username ? { username: payload.username } : {}),
      ...(payload.usernameNormalized
        ? { usernameNormalized: payload.usernameNormalized }
        : {}),
    },
  };
}

export interface ApiInitResult {
  startTime: number;
  ip: string;
  endpoint: string;
  endpointKey: string;
  requestId: string;
  operationId: string;
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
    unverifiedRateLimitFallback?: {
      bucketKey?: string;
      limiter?: Ratelimit;
    };
  },
): Promise<ApiInitResult> {
  const startTime = Date.now();
  const clientIp = resolveVerifiedClientIp(request);
  const rateLimitIdentity = createRateLimitIdentity(clientIp);
  const ip = rateLimitIdentity.ip;
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
      operationId: requestContext.operationId,
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
      rateLimitIdentity,
      endpoint,
      endpointKey,
      limiter,
      {
        allowUnverifiedFallback:
          !requireVerifiedClientIp &&
          Boolean(options?.unverifiedRateLimitFallback),
        requireVerifiedIp: requireVerifiedClientIp,
        unverifiedFallbackKey: options?.unverifiedRateLimitFallback?.bucketKey,
        unverifiedFallbackLimiter:
          options?.unverifiedRateLimitFallback?.limiter,
      },
    );
    if (rateLimitResponse) {
      return {
        startTime,
        ip,
        endpoint,
        endpointKey,
        requestId: requestContext.requestId,
        operationId: requestContext.operationId,
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
        operationId: requestContext.operationId,
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
        operationId: requestContext.operationId,
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
    operationId: requestContext.operationId,
  };
}
