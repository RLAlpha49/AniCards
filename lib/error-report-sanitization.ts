import { normalizeAnalyticsPage } from "@/lib/utils/google-analytics";

export type ErrorReportMetadataValue = string | number | boolean | null;

export interface SanitizeErrorReportStackTraceOptions {
  maxLength?: number;
  maxFrames?: number;
  separator?: string;
  frameMaxLength?: number;
}

export interface SanitizePrivacySafeLogValueOptions {
  maxLength?: number;
  stackMaxLength?: number;
  stackMaxFrames?: number;
  stackSeparator?: string;
  stackFrameMaxLength?: number;
}

const DEFAULT_LOG_TEXT_MAX_LENGTH = 120;
const DEFAULT_LOG_STACK_FRAME_MAX_LENGTH = 80;
const DEFAULT_LOG_STACK_MAX_FRAMES = 5;
const DEFAULT_LOG_STACK_MAX_LENGTH = 200;
const DEFAULT_STACK_FRAME_MAX_LENGTH = 160;
const DEFAULT_STACK_MAX_FRAMES = 12;
const DEFAULT_STACK_MAX_LENGTH = 8_000;
const MAX_METADATA_KEY_LENGTH = 64;
const MAX_METADATA_VALUE_LENGTH = 160;
const MAX_METADATA_ENTRIES = 12;
const REDACTED_EMAIL = "[redacted-email]";
const REDACTED_PATH = "[redacted-path]";
const REDACTED_SECRET = "[redacted]";
const REDACTED_URL = "[redacted-url]";
const SENSITIVE_METADATA_KEY_FRAGMENTS = [
  "auth",
  "authorization",
  "cookie",
  "csrf",
  "email",
  "mail",
  "ip",
  "jwt",
  "password",
  "passwd",
  "phone",
  "query",
  "route",
  "search",
  "secret",
  "session",
  "token",
  "url",
  "uri",
  "username",
  "user_id",
] as const;
const EMAIL_PATTERN = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi;
const FILE_PATH_PATTERN =
  /(?:[A-Za-z]:\\|\/Users\/|\/home\/|\/var\/|\/tmp\/)[^\s"'`)\]}]+/g;
const QUERY_PARAMETER_PATTERN = /([?&][A-Za-z0-9_-]{1,64}=)[^&#\s"'`)\]}]+/g;
const RELATIVE_ROUTE_WITH_QUERY_PATTERN =
  /((?:\/[A-Za-z0-9._~-]+)+)\?([^\s"'`)\]}]+)/g;
const ACCOUNT_KEY_VALUE_PATTERN =
  /\b(email|username|user(?:[_-]?id)?)\s*[:=]\s*([^\s,;]+)/gi;
const SECRET_KEY_VALUE_PATTERN =
  /\b(token|secret|password|passwd)\s*[:=]\s*([^\s,;]+)/gi;
const SESSION_KEY_VALUE_PATTERN =
  /\b(authorization|cookie|session|api(?:[_-]?key)?)\s*[:=]\s*([^\s,;]+)/gi;
const TOKEN_LIKE_PATTERN =
  /\b(?:eyJ[A-Za-z0-9._-]+|gh[pousr]_[A-Za-z0-9]{20,}|sk_[A-Za-z0-9]{16,}|[A-Fa-f0-9]{32,}|[A-Za-z0-9+/_-]{40,})\b/g;
const URL_PATTERN = /\bhttps?:\/\/[^\s"'`)\]}]+/gi;

export function truncateText(value: string, maxLength: number): string {
  return value.length <= maxLength
    ? value
    : `${value.slice(0, Math.max(0, maxLength - 1))}…`;
}

export function sanitizeOptionalText(
  value: string | undefined,
  maxLength: number,
): string | undefined {
  if (typeof value !== "string") return undefined;

  const trimmed = value.trim();
  if (!trimmed) return undefined;

  return truncateText(trimmed, maxLength);
}

function normalizeMetadataKey(value: string): string {
  return value.replaceAll(/([a-z0-9])([A-Z])/g, "$1_$2").toLowerCase();
}

function isSensitiveMetadataKey(value: string): boolean {
  const normalizedKey = normalizeMetadataKey(value.trim());
  if (!normalizedKey) {
    return false;
  }

  return SENSITIVE_METADATA_KEY_FRAGMENTS.some((fragment) =>
    normalizedKey.includes(fragment),
  );
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

function coerceUnknownToLogString(value: unknown): string {
  if (value === undefined) return "undefined";
  if (value === null) return "null";
  if (typeof value === "string") return value;
  if (
    typeof value === "number" ||
    typeof value === "boolean" ||
    typeof value === "bigint" ||
    typeof value === "symbol"
  ) {
    return String(value);
  }

  if (value instanceof Error) {
    const parts = [value.name, value.message].filter(
      (part): part is string => typeof part === "string" && part.length > 0,
    );

    return parts.length > 0 ? parts.join(": ") : "Error";
  }

  if (typeof value === "function") {
    return value.name ? `[Function ${value.name}]` : "[Function]";
  }

  if (Array.isArray(value)) {
    return `[Array(${value.length})]`;
  }

  if (typeof value === "object") {
    const constructorName = value?.constructor?.name;
    if (constructorName && constructorName !== "Object") {
      return `[${constructorName}]`;
    }

    return "[Object]";
  }

  return String(value);
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

  const normalized = coerceUnknownToLogString(value).trim();
  if (!normalized) {
    return "missing";
  }

  if (/^\d+$/.test(normalized)) {
    return `id:***${normalized.slice(-2)}`;
  }

  const prefix = normalized.slice(0, Math.min(2, normalized.length));
  return `${prefix}${normalized.length > 2 ? "***" : "*"}(${normalized.length})`;
}

export function sanitizeErrorReportRoute(
  route: string | undefined,
): string | undefined {
  const candidate = sanitizeOptionalText(route, 512);
  if (!candidate) return undefined;

  try {
    const parsed =
      candidate.startsWith("http://") || candidate.startsWith("https://")
        ? new URL(candidate)
        : new URL(candidate, "https://anicards.local");

    return normalizeAnalyticsPage({
      pathname: parsed.pathname,
      search: parsed.search,
    }).pagePath;
  } catch {
    const pathname = candidate.startsWith("/") ? candidate : `/${candidate}`;
    return normalizeAnalyticsPage({ pathname }).pagePath;
  }
}

export function sanitizeErrorReportText(
  value: string | undefined,
  maxLength: number,
  options?: {
    normalizeRelativeRoutes?: boolean;
  },
): string | undefined {
  if (typeof value !== "string") return undefined;

  const trimmed = value.trim();
  if (!trimmed) return undefined;

  let sanitized = trimmed;

  if (options?.normalizeRelativeRoutes ?? true) {
    sanitized = sanitized.replaceAll(
      RELATIVE_ROUTE_WITH_QUERY_PATTERN,
      (_match, path: string, query: string) =>
        sanitizeErrorReportRoute(`${path}?${query}`) ?? path,
    );
  }

  sanitized = sanitized
    .replaceAll(FILE_PATH_PATTERN, REDACTED_PATH)
    .replaceAll(URL_PATTERN, REDACTED_URL)
    .replaceAll(EMAIL_PATTERN, REDACTED_EMAIL)
    .replaceAll(QUERY_PARAMETER_PATTERN, (_match, prefix: string) => {
      return `${prefix}${REDACTED_SECRET}`;
    })
    .replaceAll(ACCOUNT_KEY_VALUE_PATTERN, (_match, key: string) => {
      return `${key}=${REDACTED_SECRET}`;
    })
    .replaceAll(SECRET_KEY_VALUE_PATTERN, (_match, key: string) => {
      return `${key}=${REDACTED_SECRET}`;
    })
    .replaceAll(SESSION_KEY_VALUE_PATTERN, (_match, key: string) => {
      return `${key}=${REDACTED_SECRET}`;
    })
    .replaceAll(TOKEN_LIKE_PATTERN, REDACTED_SECRET)
    .replaceAll(/\s+/g, " ");

  return truncateText(sanitized, maxLength);
}

function sanitizeStackFrame(
  line: string,
  frameMaxLength: number,
): string | undefined {
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

  return `at ${truncateText(collapseStackWhitespace(frameLabel), frameMaxLength)}`;
}

export function sanitizeErrorReportStackTrace(
  value: string | undefined,
  options?: SanitizeErrorReportStackTraceOptions,
): string | undefined {
  if (typeof value !== "string") {
    return undefined;
  }

  const frames = value
    .split(/\r?\n/)
    .map((line) =>
      sanitizeStackFrame(
        line,
        options?.frameMaxLength ?? DEFAULT_STACK_FRAME_MAX_LENGTH,
      ),
    )
    .filter((line): line is string => typeof line === "string")
    .slice(0, options?.maxFrames ?? DEFAULT_STACK_MAX_FRAMES);

  if (frames.length === 0) {
    return undefined;
  }

  return truncateText(
    frames.join(options?.separator ?? "\n"),
    options?.maxLength ?? DEFAULT_STACK_MAX_LENGTH,
  );
}

export function sanitizePrivacySafeLogValue(
  key: string,
  value: unknown,
  options?: SanitizePrivacySafeLogValueOptions,
): ErrorReportMetadataValue | undefined {
  const normalizedKey = normalizeMetadataKey(key.trim());
  const normalizedValue = coerceUnknownToLogString(value);

  if (normalizedKey.includes("ip")) {
    return redactIp(normalizedValue);
  }

  if (
    normalizedKey.includes("user_id") ||
    normalizedKey.includes("username") ||
    normalizedKey.includes("identifier")
  ) {
    return redactUserIdentifier(value);
  }

  if (normalizedKey === "request_id") {
    return sanitizeOptionalText(normalizedValue, 120);
  }

  if (
    normalizedKey === "route" ||
    normalizedKey === "path" ||
    normalizedKey.endsWith("_route") ||
    normalizedKey.endsWith("_path")
  ) {
    return (
      sanitizeErrorReportRoute(normalizedValue) ??
      sanitizeErrorReportText(
        normalizedValue,
        options?.maxLength ?? DEFAULT_LOG_TEXT_MAX_LENGTH,
      )
    );
  }

  if (normalizedKey.includes("stack")) {
    return sanitizeErrorReportStackTrace(normalizedValue, {
      maxLength: options?.stackMaxLength ?? DEFAULT_LOG_STACK_MAX_LENGTH,
      maxFrames: options?.stackMaxFrames ?? DEFAULT_LOG_STACK_MAX_FRAMES,
      separator: options?.stackSeparator ?? " | ",
      frameMaxLength:
        options?.stackFrameMaxLength ?? DEFAULT_LOG_STACK_FRAME_MAX_LENGTH,
    });
  }

  if (value === undefined) return undefined;
  if (value === null) return null;
  if (typeof value === "number" || typeof value === "boolean") {
    return value;
  }

  return sanitizeErrorReportText(
    normalizedValue,
    options?.maxLength ?? DEFAULT_LOG_TEXT_MAX_LENGTH,
  );
}

function collectSanitizedErrorReportMetadataEntries(
  metadata: Record<string, unknown>,
): Array<[string, ErrorReportMetadataValue]> {
  const entries: Array<[string, ErrorReportMetadataValue]> = [];

  for (const [key, value] of Object.entries(metadata).slice(
    0,
    MAX_METADATA_ENTRIES,
  )) {
    const normalizedKey = key.trim().slice(0, MAX_METADATA_KEY_LENGTH);
    if (
      !normalizedKey ||
      normalizedKey.toLowerCase() === "requestid" ||
      isSensitiveMetadataKey(normalizedKey)
    ) {
      continue;
    }

    if (
      value === null ||
      typeof value === "number" ||
      typeof value === "boolean"
    ) {
      entries.push([normalizedKey, value satisfies ErrorReportMetadataValue]);
      continue;
    }

    if (typeof value !== "string") {
      continue;
    }

    const sanitizedValue = sanitizeErrorReportText(
      value,
      MAX_METADATA_VALUE_LENGTH,
    );
    if (sanitizedValue) {
      entries.push([normalizedKey, sanitizedValue]);
    }
  }

  return entries;
}

export function sanitizeErrorReportMetadata(
  metadata: Record<string, unknown> | undefined,
): Record<string, ErrorReportMetadataValue> | undefined {
  if (!metadata) return undefined;

  const entries = collectSanitizedErrorReportMetadataEntries(metadata);

  if (entries.length === 0) {
    return undefined;
  }

  return Object.fromEntries(entries);
}
