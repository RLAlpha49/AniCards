import { NextResponse } from "next/server";

import { jsonWithCors } from "@/lib/api/cors";
import { logPrivacySafe } from "@/lib/api/logging";
import { getRequestContext } from "@/lib/api/request-context";
import {
  buildLatencyBucketMetricKeys,
  scheduleAnalyticsIncrement,
  scheduleLowValueAnalyticsBatch,
} from "@/lib/api/telemetry";
import {
  type ErrorCategory,
  getErrorDetails,
  type RecoverySuggestion,
} from "@/lib/error-messages";

/**
 * Standardized API error response shape returned from API routes.
 */
export interface ApiError {
  error: string;
  category: ErrorCategory;
  retryable: boolean;
  status: number;
  recoverySuggestions: RecoverySuggestion[];
}

export type ApiErrorResponsePayload = ApiError & Record<string, unknown>;

interface SafeStructuredApiError extends Error {
  statusCode?: number;
  status?: number;
  publicMessage?: string;
  category?: ErrorCategory;
  retryable?: boolean;
  recoverySuggestions?: RecoverySuggestion[];
}

interface HandledApiErrorDetails {
  status: number;
  message: string;
  category?: ErrorCategory;
  retryable?: boolean;
  recoverySuggestions?: RecoverySuggestion[];
}

function getCandidateErrorStatus(error: Error): number {
  const candidate = (error as SafeStructuredApiError).statusCode;
  if (
    typeof candidate === "number" &&
    Number.isInteger(candidate) &&
    candidate >= 400 &&
    candidate <= 599
  ) {
    return candidate;
  }

  const alternateCandidate = (error as SafeStructuredApiError).status;
  if (
    typeof alternateCandidate === "number" &&
    Number.isInteger(alternateCandidate) &&
    alternateCandidate >= 400 &&
    alternateCandidate <= 599
  ) {
    return alternateCandidate;
  }

  return 500;
}

function looksLikeRedisTransportFailure(message: string): boolean {
  const normalized = message.toLowerCase();

  if (!(normalized.includes("redis") || normalized.includes("upstash"))) {
    return false;
  }

  return [
    "error",
    "fail",
    "failure",
    "connect",
    "connection",
    "unavailable",
    "timeout",
    "timed out",
    "network",
    "socket",
    "refused",
    "reset",
    "closed",
    "econn",
  ].some((token) => normalized.includes(token));
}

export function isRedisBackplaneUnavailable(error: unknown): boolean {
  if (!(error instanceof Error)) {
    return false;
  }

  if (looksLikeRedisTransportFailure(`${error.name} ${error.message}`)) {
    return true;
  }

  const cause = (error as { cause?: unknown }).cause;
  return cause instanceof Error
    ? looksLikeRedisTransportFailure(`${cause.name} ${cause.message}`)
    : false;
}

function resolveHandledApiErrorDetails(
  error: Error,
  fallbackMessage: string,
  options?: {
    redisUnavailableMessage?: string;
  },
): HandledApiErrorDetails {
  if (options?.redisUnavailableMessage && isRedisBackplaneUnavailable(error)) {
    return {
      status: 503,
      message: options.redisUnavailableMessage,
      category: "server_error",
      retryable: true,
    };
  }

  const structuredError = error as SafeStructuredApiError;

  return {
    status: getCandidateErrorStatus(error),
    message: structuredError.publicMessage ?? fallbackMessage,
    category: structuredError.category,
    retryable: structuredError.retryable,
    recoverySuggestions: structuredError.recoverySuggestions,
  };
}

function createApiErrorPayload(
  error: string,
  status: number,
  options?: {
    category?: ErrorCategory;
    retryable?: boolean;
    recoverySuggestions?: RecoverySuggestion[];
    additionalFields?: Record<string, unknown>;
  },
): ApiErrorResponsePayload {
  const details = getErrorDetails(error, status);
  const payload = {
    error,
    category: options?.category ?? details.category,
    retryable: options?.retryable ?? details.retryable,
    status,
    recoverySuggestions:
      options?.recoverySuggestions ?? details.suggestions ?? [],
  };

  if (!options?.additionalFields) {
    return payload;
  }

  return {
    ...payload,
    ...options.additionalFields,
  };
}

export function apiErrorResponse(
  request: Request | undefined,
  status: number,
  error: string,
  options?: {
    headers?: Record<string, string>;
    category?: ErrorCategory;
    retryable?: boolean;
    recoverySuggestions?: RecoverySuggestion[];
    additionalFields?: Record<string, unknown>;
  },
): NextResponse<ApiErrorResponsePayload> {
  return jsonWithCors(
    createApiErrorPayload(error, status, {
      category: options?.category,
      retryable: options?.retryable,
      recoverySuggestions: options?.recoverySuggestions,
      additionalFields: options?.additionalFields,
    }),
    request,
    status,
    options?.headers,
  );
}

export function invalidJsonResponse(
  request: Request | undefined,
  options?: { headers?: Record<string, string> },
): NextResponse<ApiErrorResponsePayload> {
  return apiErrorResponse(request, 400, "Invalid JSON body", {
    headers: options?.headers,
    category: "invalid_data",
    retryable: false,
  });
}

export function payloadTooLargeResponse(
  request: Request | undefined,
  options?: {
    headers?: Record<string, string>;
    message?: string;
    maxBytes?: number;
  },
): NextResponse<ApiErrorResponsePayload> {
  return apiErrorResponse(
    request,
    413,
    options?.message ?? "Request body too large",
    {
      headers: options?.headers,
      category: "invalid_data",
      retryable: false,
      additionalFields:
        typeof options?.maxBytes === "number"
          ? { maxBytes: options.maxBytes }
          : undefined,
    },
  );
}

export function handleError(
  error: Error,
  endpoint: string,
  startTime: number,
  analyticsMetric: string,
  errorMessage: string,
  request?: Request,
  options?: {
    redisUnavailableMessage?: string;
    logContext?: Record<string, unknown>;
  },
): NextResponse<ApiError> {
  const duration = Date.now() - startTime;
  const logContext = options?.logContext;
  const logPayload: Record<string, unknown> = {
    durationMs: duration,
    error: error.message,
    ...(error.stack ? { stack: error.stack } : {}),
  };

  if (logContext) {
    Object.assign(logPayload, logContext);
  }

  logPrivacySafe("error", endpoint, "Request failed", logPayload, request);
  scheduleAnalyticsIncrement(analyticsMetric, {
    endpoint,
    logContext,
    request,
    taskName: analyticsMetric,
  });

  const endpointKey = getRequestContext(request)?.endpointKey;
  if (endpointKey) {
    const latencyMetrics = buildLatencyBucketMetricKeys(
      endpointKey,
      duration,
      "failure",
    );
    scheduleLowValueAnalyticsBatch(latencyMetrics, {
      endpoint,
      logContext,
      request,
      taskName: `${analyticsMetric}:latency`,
    });
  }

  const handledError = resolveHandledApiErrorDetails(
    error,
    errorMessage,
    options,
  );

  return apiErrorResponse(request, handledError.status, handledError.message, {
    category: handledError.category,
    retryable: handledError.retryable,
    recoverySuggestions: handledError.recoverySuggestions,
  });
}
