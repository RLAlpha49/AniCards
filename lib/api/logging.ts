import {
  ensureRequestContext,
  getRequestContext,
} from "@/lib/api/request-context";
import {
  redactIp,
  sanitizeErrorReportRoute,
  sanitizeErrorReportText,
  sanitizePrivacySafeLogValue,
} from "@/lib/error-report-sanitization";
import type { PersistedRequestMetadata } from "@/lib/types/records";

export {
  redactIp,
  redactUserIdentifier,
} from "@/lib/error-report-sanitization";

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

type SanitizedLogContextValue = Exclude<
  ReturnType<typeof sanitizePrivacySafeLogValue>,
  undefined
>;

function buildSafeLogContext(
  context: Record<string, unknown> | undefined,
): Record<string, SanitizedLogContextValue> {
  const safeContextEntries: Array<[string, SanitizedLogContextValue]> = [];

  for (const [key, value] of Object.entries(context ?? {})) {
    const normalizedKey = key.replaceAll(/_/g, "").toLowerCase();
    if (normalizedKey === "requestid" || normalizedKey === "operationid") {
      continue;
    }

    const sanitizedValue = sanitizePrivacySafeLogValue(key, value, {
      maxLength: 120,
      stackMaxLength: 200,
      stackMaxFrames: 5,
      stackSeparator: " | ",
      stackFrameMaxLength: 80,
    });

    if (sanitizedValue !== undefined) {
      safeContextEntries.push([key, sanitizedValue]);
    }
  }

  return Object.fromEntries(safeContextEntries);
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
  const safeContext = buildSafeLogContext(context);
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
