import {
  ensureRequestContext,
  getRequestContext,
} from "@/lib/api/request-context";
import {
  redactIp,
  redactUserIdentifier,
  sanitizeErrorReportRoute,
  sanitizeErrorReportText,
  sanitizePrivacySafeLogValue,
} from "@/lib/error-report-sanitization";
import type { PersistedRequestMetadata } from "@/lib/types/records";

export { redactIp, redactUserIdentifier };

export function buildPersistedRequestMetadata(
  ip: string,
): PersistedRequestMetadata | undefined {
  const lastSeenIpBucket = redactIp(ip);
  if (!lastSeenIpBucket || lastSeenIpBucket === "unknown") {
    return undefined;
  }

  return { lastSeenIpBucket };
}

function normalizeRequestId(value: unknown): string | undefined {
  if (typeof value !== "string") {
    return undefined;
  }

  const trimmed = value.trim();
  if (!/^[A-Za-z0-9._:-]{8,120}$/.test(trimmed)) {
    return undefined;
  }

  return trimmed;
}

function normalizeOperationId(value: unknown): string | undefined {
  return normalizeRequestId(value);
}

export function logPrivacySafe(
  level: "log" | "warn" | "error",
  endpoint: string,
  message: string,
  context?: Record<string, unknown>,
  request?: Request,
): void {
  const requestContext = request
    ? (getRequestContext(request) ??
      ensureRequestContext(request, {
        endpoint,
      }))
    : undefined;
  const requestIdFromContext = normalizeRequestId(context?.requestId);
  const operationIdFromContext = normalizeOperationId(context?.operationId);

  const safeContextEntries = Object.entries(context ?? {}).flatMap(
    ([key, value]) => {
      const normalizedKey = key.replaceAll(/_/g, "").toLowerCase();
      if (normalizedKey === "requestid" || normalizedKey === "operationid") {
        return [];
      }

      const sanitizedValue = sanitizePrivacySafeLogValue(key, value, {
        maxLength: 120,
        stackMaxLength: 200,
        stackMaxFrames: 5,
        stackSeparator: " | ",
        stackFrameMaxLength: 80,
      });
      return sanitizedValue === undefined ? [] : [[key, sanitizedValue]];
    },
  );

  const safeContext = Object.fromEntries(safeContextEntries);
  const safeMessage =
    sanitizeErrorReportText(message, 160) ?? "Privacy-safe log entry";
  const safePath = sanitizeErrorReportRoute(requestContext?.path);
  const logEntry = {
    timestamp: new Date().toISOString(),
    level: level === "log" ? "info" : level,
    endpoint,
    message: safeMessage,
    ...((requestIdFromContext ?? requestContext?.requestId)
      ? {
          requestId: requestIdFromContext ?? requestContext?.requestId,
        }
      : {}),
    ...((operationIdFromContext ?? requestContext?.operationId)
      ? {
          operationId: operationIdFromContext ?? requestContext?.operationId,
        }
      : {}),
    ...(requestContext?.method ? { method: requestContext.method } : {}),
    ...(safePath ? { path: safePath } : {}),
    ...(Object.keys(safeContext).length > 0 ? { context: safeContext } : {}),
  };

  console[level](JSON.stringify(logEntry));
}

export function logRequest(
  endpoint: string,
  ip: string,
  request?: Request,
  details?: string,
): void {
  logPrivacySafe(
    "log",
    endpoint,
    "Incoming request",
    {
      ip,
      ...(details ? { details } : {}),
    },
    request,
  );
}

export function logSuccess(
  endpoint: string,
  userId: number,
  duration: number,
  details?: string,
  request?: Request,
): void {
  logPrivacySafe(
    "log",
    endpoint,
    details ?? "Successfully processed request",
    {
      userId,
      durationMs: duration,
    },
    request,
  );
}
