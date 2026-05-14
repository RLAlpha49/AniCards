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
  ERROR_CATEGORIES,
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

const RESERVED_API_ERROR_FIELDS = new Set<keyof ApiError>([
  "error",
  "category",
  "retryable",
  "status",
  "recoverySuggestions",
]);

interface SafeStructuredApiError extends Error {
  cause?: unknown;
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

const ERROR_CATEGORY_SET = new Set<ErrorCategory>(ERROR_CATEGORIES);

function hasNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function isErrorCategoryValue(value: unknown): value is ErrorCategory {
  return (
    typeof value === "string" && ERROR_CATEGORY_SET.has(value as ErrorCategory)
  );
}

function isRecoverySuggestionValue(
  value: unknown,
): value is RecoverySuggestion {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const suggestion = value as Partial<RecoverySuggestion>;

  return (
    hasNonEmptyString(suggestion.title) &&
    hasNonEmptyString(suggestion.description) &&
    (suggestion.actionLabel === undefined ||
      hasNonEmptyString(suggestion.actionLabel)) &&
    (suggestion.actionUrl === undefined ||
      hasNonEmptyString(suggestion.actionUrl))
  );
}

function coerceStructuredStatus(value: unknown): number | undefined {
  if (
    typeof value !== "number" ||
    !Number.isInteger(value) ||
    value < 400 ||
    value > 599
  ) {
    return undefined;
  }

  return value;
}

function describeUnknownThrownValue(error: unknown): string {
  if (error === null) {
    return "null";
  }

  switch (typeof error) {
    case "undefined":
      return "undefined";
    case "string":
      return error;
    case "number":
    case "boolean":
    case "bigint":
      return String(error);
    case "symbol":
      return error.description ? `Symbol(${error.description})` : "symbol";
    default:
      return "object";
  }
}

function resolveUnknownErrorMessage(error: unknown): string {
  if (
    typeof error === "object" &&
    error !== null &&
    hasNonEmptyString((error as { message?: unknown }).message)
  ) {
    return (error as { message: string }).message.trim();
  }

  if (hasNonEmptyString(error)) {
    return error.trim();
  }

  return `Non-Error thrown: ${describeUnknownThrownValue(error)}`;
}

export function normalizeUnknownError(error: unknown): SafeStructuredApiError {
  if (error instanceof Error) {
    return error as SafeStructuredApiError;
  }

  const structuredError =
    typeof error === "object" && error !== null
      ? (error as Partial<SafeStructuredApiError>)
      : undefined;
  const normalizedError = new Error(resolveUnknownErrorMessage(error), {
    cause: structuredError?.cause ?? error,
  }) as SafeStructuredApiError;

  normalizedError.name = hasNonEmptyString(structuredError?.name)
    ? structuredError.name.trim()
    : "NonErrorThrown";

  if (hasNonEmptyString(structuredError?.publicMessage)) {
    normalizedError.publicMessage = structuredError.publicMessage.trim();
  }

  const statusCode = coerceStructuredStatus(structuredError?.statusCode);
  if (statusCode !== undefined) {
    normalizedError.statusCode = statusCode;
  }

  const status = coerceStructuredStatus(structuredError?.status);
  if (status !== undefined) {
    normalizedError.status = status;
  }

  if (isErrorCategoryValue(structuredError?.category)) {
    normalizedError.category = structuredError.category;
  }

  if (typeof structuredError?.retryable === "boolean") {
    normalizedError.retryable = structuredError.retryable;
  }

  if (Array.isArray(structuredError?.recoverySuggestions)) {
    const recoverySuggestions = structuredError.recoverySuggestions.filter(
      isRecoverySuggestionValue,
    );

    if (recoverySuggestions.length > 0) {
      normalizedError.recoverySuggestions = recoverySuggestions;
    }
  }

  if (hasNonEmptyString(structuredError?.stack)) {
    normalizedError.stack = structuredError.stack.trim();
  }

  return normalizedError;
}

function getCandidateErrorStatus(error: Error): number {
  const candidate = coerceStructuredStatus(
    (error as SafeStructuredApiError).statusCode,
  );
  if (candidate !== undefined) {
    return candidate;
  }

  const alternateCandidate = coerceStructuredStatus(
    (error as SafeStructuredApiError).status,
  );
  if (alternateCandidate !== undefined) {
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
  const normalizedError = normalizeUnknownError(error);

  if (
    looksLikeRedisTransportFailure(
      `${normalizedError.name} ${normalizedError.message}`,
    )
  ) {
    return true;
  }

  const cause = normalizedError.cause;
  if (cause === undefined) {
    return false;
  }

  const normalizedCause = normalizeUnknownError(cause);
  return looksLikeRedisTransportFailure(
    `${normalizedCause.name} ${normalizedCause.message}`,
  );
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

  const safeAdditionalFields = Object.fromEntries(
    Object.entries(options.additionalFields).filter(
      ([key]) => !RESERVED_API_ERROR_FIELDS.has(key as keyof ApiError),
    ),
  );

  if (Object.keys(safeAdditionalFields).length === 0) {
    return payload;
  }

  return {
    ...payload,
    ...safeAdditionalFields,
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
  error: unknown,
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
  const normalizedError = normalizeUnknownError(error);
  const duration = Date.now() - startTime;
  const logContext = options?.logContext;
  const logPayload: Record<string, unknown> = {
    durationMs: duration,
    error: normalizedError.message,
    ...(normalizedError.stack ? { stack: normalizedError.stack } : {}),
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
    normalizedError,
    errorMessage,
    options,
  );

  return apiErrorResponse(request, handledError.status, handledError.message, {
    category: handledError.category,
    retryable: handledError.retryable,
    recoverySuggestions: handledError.recoverySuggestions,
  });
}
