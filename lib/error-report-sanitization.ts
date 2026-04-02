import { normalizeAnalyticsPage } from "@/lib/utils/google-analytics";

export type ErrorReportMetadataValue = string | number | boolean | null;

export const ERROR_REPORT_REQUEST_MAX_BYTES = 24_000;

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

function truncateText(value: string, maxLength: number): string {
  return value.length <= maxLength
    ? value
    : `${value.slice(0, Math.max(0, maxLength - 1))}…`;
}

function sanitizeOptionalText(
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

export function sanitizeErrorReportMetadata(
  metadata: Record<string, unknown> | undefined,
): Record<string, ErrorReportMetadataValue> | undefined {
  if (!metadata) return undefined;

  const entries = Object.entries(metadata)
    .slice(0, MAX_METADATA_ENTRIES)
    .flatMap(([key, value]) => {
      const normalizedKey = key.trim().slice(0, MAX_METADATA_KEY_LENGTH);
      if (
        !normalizedKey ||
        normalizedKey.toLowerCase() === "requestid" ||
        isSensitiveMetadataKey(normalizedKey)
      ) {
        return [];
      }

      if (
        value === null ||
        typeof value === "number" ||
        typeof value === "boolean"
      ) {
        return [[normalizedKey, value satisfies ErrorReportMetadataValue]];
      }

      if (typeof value === "string") {
        const sanitizedValue = sanitizeErrorReportText(
          value,
          MAX_METADATA_VALUE_LENGTH,
        );
        return sanitizedValue ? [[normalizedKey, sanitizedValue]] : [];
      }

      return [];
    });

  if (entries.length === 0) {
    return undefined;
  }

  return Object.fromEntries(entries);
}
