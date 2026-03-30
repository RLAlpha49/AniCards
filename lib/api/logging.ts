import { getRequestContext } from "@/lib/api/request-context";
import type { PersistedRequestMetadata } from "@/lib/types/records";

function truncateLogString(value: string, maxLength = 120): string {
  return value.length <= maxLength
    ? value
    : `${value.slice(0, Math.max(0, maxLength - 1))}…`;
}

function isStackWhitespace(char: string): boolean {
  return (
    char === " " ||
    char === "\t" ||
    char === "\n" ||
    char === "\r" ||
    char === "\f" ||
    char === "\v"
  );
}

function collapseStackWhitespace(value: string): string {
  let normalized = "";
  let lastWasWhitespace = false;

  for (const char of value) {
    if (isStackWhitespace(char)) {
      if (!lastWasWhitespace) {
        normalized += " ";
      }
      lastWasWhitespace = true;
      continue;
    }

    normalized += char;
    lastWasWhitespace = false;
  }

  return normalized;
}

function sanitizeStackFrame(line: string): string | undefined {
  const trimmed = line.trim();
  if (!trimmed.startsWith("at ")) {
    return undefined;
  }

  const frameText = trimmed.slice(3).trimStart();
  if (!frameText) {
    return "at <frame>";
  }

  let frameLabelEnd = frameText.length;
  for (let index = 0; index < frameText.length; index += 1) {
    if (frameText[index] !== "(") {
      continue;
    }

    let whitespaceStart = index - 1;
    while (
      whitespaceStart >= 0 &&
      isStackWhitespace(frameText[whitespaceStart])
    ) {
      whitespaceStart -= 1;
    }

    if (whitespaceStart < index - 1) {
      frameLabelEnd = whitespaceStart + 1;
      break;
    }
  }

  const frameLabel = frameText.slice(0, frameLabelEnd).trim();
  if (!frameLabel) {
    return "at <frame>";
  }

  return `at ${truncateLogString(collapseStackWhitespace(frameLabel), 80)}`;
}

function summarizeStackForLogs(value: unknown): string | undefined {
  if (typeof value !== "string") {
    return undefined;
  }

  const frames = value
    .split(/\r?\n/)
    .map((line) => sanitizeStackFrame(line))
    .filter((line): line is string => typeof line === "string")
    .slice(0, 5);

  if (frames.length === 0) {
    return undefined;
  }

  return truncateLogString(frames.join(" | "), 200);
}

function safeStringifyValue(value: unknown): string {
  if (value === undefined) return "undefined";
  if (value === null) return "null";
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }

  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

export function redactIp(ip: string): string {
  const normalized = ip.trim();
  if (!normalized || normalized === "unknown") {
    return "unknown";
  }

  if (normalized === "127.0.0.1" || normalized === "::1") {
    return "loopback";
  }

  const ipv4Match = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(
    normalized,
  );
  if (ipv4Match) {
    const [a, b, c, d] = ipv4Match.slice(1).map(Number);
    const validOctets = [a, b, c, d].every(
      (octet) => octet >= 0 && octet <= 255,
    );

    if (!validOctets) {
      return "invalid_ip";
    }

    const isPrivateRange =
      a === 10 ||
      a === 127 ||
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 168);

    if (isPrivateRange) {
      return "private_ipv4";
    }

    return `${a}.${b}.x.x`;
  }

  if (normalized.includes(":")) {
    return "ipv6";
  }

  return "redacted";
}

export function redactUserIdentifier(value: unknown): string {
  if (value === undefined || value === null) {
    return "missing";
  }

  const normalized = String(value).trim();
  if (!normalized) {
    return "missing";
  }

  if (/^\d+$/.test(normalized)) {
    return `id:***${normalized.slice(-2)}`;
  }

  const prefix = normalized.slice(0, Math.min(2, normalized.length));
  return `${prefix}${normalized.length > 2 ? "***" : "*"}(${normalized.length})`;
}

export function buildPersistedRequestMetadata(
  ip: string,
): PersistedRequestMetadata | undefined {
  const lastSeenIpBucket = redactIp(ip);
  if (!lastSeenIpBucket || lastSeenIpBucket === "unknown") {
    return undefined;
  }

  return { lastSeenIpBucket };
}

function sanitizeLogContextValue(
  key: string,
  value: unknown,
): string | number | boolean | null | undefined {
  if (value === undefined) return undefined;
  if (value === null) return null;
  if (typeof value === "number" || typeof value === "boolean") {
    return value;
  }

  const normalizedKey = key.toLowerCase();
  if (normalizedKey.includes("ip")) {
    return redactIp(String(value));
  }

  if (
    normalizedKey.includes("userid") ||
    normalizedKey.includes("username") ||
    normalizedKey.includes("identifier")
  ) {
    return redactUserIdentifier(value);
  }

  if (normalizedKey === "requestid") {
    return truncateLogString(String(value), 120);
  }

  if (normalizedKey.includes("stack")) {
    return summarizeStackForLogs(value);
  }

  return truncateLogString(safeStringifyValue(value));
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

export function logPrivacySafe(
  level: "log" | "warn" | "error",
  endpoint: string,
  message: string,
  context?: Record<string, unknown>,
  request?: Request,
): void {
  const requestContext = request ? getRequestContext(request) : undefined;
  const requestIdFromContext = normalizeRequestId(context?.requestId);

  const safeContextEntries = Object.entries(context ?? {}).flatMap(
    ([key, value]) => {
      if (key === "requestId") {
        return [];
      }

      const sanitizedValue = sanitizeLogContextValue(key, value);
      return sanitizedValue === undefined ? [] : [[key, sanitizedValue]];
    },
  );

  const safeContext = Object.fromEntries(safeContextEntries);
  const logEntry = {
    timestamp: new Date().toISOString(),
    level: level === "log" ? "info" : level,
    endpoint,
    message,
    ...((requestIdFromContext ?? requestContext?.requestId)
      ? {
          requestId: requestIdFromContext ?? requestContext?.requestId,
        }
      : {}),
    ...(requestContext?.method ? { method: requestContext.method } : {}),
    ...(requestContext?.path ? { path: requestContext.path } : {}),
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
