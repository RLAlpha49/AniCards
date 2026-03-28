/**
 * Durable structured error reporting for client and server paths.
 * Reports are normalized through the shared error model, persisted via Redis on
 * the server, and forwarded through a same-origin ingestion route from the client.
 * @source
 */

import {
  type ErrorCategory,
  getErrorDetails,
  isRetryableErrorCategory,
  type RecoverySuggestion,
} from "@/lib/error-messages";
import { normalizeAnalyticsPage } from "@/lib/utils/google-analytics";

export type ErrorReportSource =
  | "user_action"
  | "client_hook"
  | "react_error_boundary"
  | "app_router_error_boundary"
  | "api_route";

type ErrorReportEnvironment = "client" | "server";

type SerializableMetadataValue = string | number | boolean | null;

interface ReportErrorOptions {
  userAction: string;
  error: unknown;
  category?: ErrorCategory;
  statusCode?: number;
  route?: string;
  source?: ErrorReportSource;
  componentStack?: string;
  stack?: string;
  errorName?: string;
  digest?: string;
  metadata?: Record<string, unknown>;
  timestamp?: number;
}

export interface StructuredErrorReport {
  id: string;
  timestamp: number;
  environment: ErrorReportEnvironment;
  source: ErrorReportSource;
  userAction: string;
  route?: string;
  category: ErrorCategory;
  retryable: boolean;
  userMessage: string;
  technicalMessage: string;
  statusCode?: number;
  suggestions: RecoverySuggestion[];
  errorName: string;
  digest?: string;
  stack?: string;
  componentStack?: string;
  metadata?: Record<string, SerializableMetadataValue>;
}

const ERROR_REPORTS_KEY = "telemetry:error-reports:v1";
const MAX_ERROR_REPORTS = 250;
const MAX_TEXT_FIELD_LENGTH = 2_000;
const MAX_STACK_LENGTH = 8_000;
const MAX_METADATA_KEY_LENGTH = 64;

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

function sanitizeStackFrame(line: string): string | undefined {
  const trimmed = line.trim();
  if (!trimmed.startsWith("at ")) return undefined;

  const match = /^at\s+(.+?)(?:\s+\(|$)/.exec(trimmed);
  const frameLabel = match?.[1]?.trim();
  if (!frameLabel) return "at <frame>";

  return `at ${truncateText(frameLabel.replaceAll(/\s+/g, " "), 160)}`;
}

function sanitizeStackTrace(
  value: string | undefined,
  maxLength: number,
): string | undefined {
  if (typeof value !== "string") return undefined;

  const frames = value
    .split(/\r?\n/)
    .map((line) => sanitizeStackFrame(line))
    .filter((line): line is string => typeof line === "string")
    .slice(0, 12);

  if (frames.length === 0) return undefined;
  return truncateText(frames.join("\n"), maxLength);
}

function sanitizeUserAction(userAction: string): string {
  const trimmed = userAction.trim();
  return truncateText(trimmed || "unknown_action", 120);
}

function getCurrentClientRoute(): string | undefined {
  if (globalThis.location === undefined) return undefined;
  return `${globalThis.location.pathname}${globalThis.location.search}`;
}

function normalizeRoute(route: string | undefined): string | undefined {
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

function sanitizeMetadata(
  metadata: Record<string, unknown> | undefined,
): Record<string, SerializableMetadataValue> | undefined {
  if (!metadata) return undefined;

  const entries = Object.entries(metadata).flatMap(([key, value]) => {
    const normalizedKey = key.trim().slice(0, MAX_METADATA_KEY_LENGTH);
    if (!normalizedKey) return [];

    if (
      value === null ||
      typeof value === "number" ||
      typeof value === "boolean"
    ) {
      return [[normalizedKey, value satisfies SerializableMetadataValue]];
    }

    if (typeof value === "string") {
      return [[normalizedKey, truncateText(value, 160)]];
    }

    return [[normalizedKey, truncateText(String(value), 160)]];
  });

  if (entries.length === 0) {
    return undefined;
  }

  return Object.fromEntries(entries);
}

function coerceErrorMessage(error: unknown): string {
  if (typeof error === "string") return error;
  if (error instanceof Error) return error.message;
  return String(error);
}

function resolveErrorName(error: unknown, explicitName?: string): string {
  const sanitizedExplicitName = sanitizeOptionalText(explicitName, 120);
  if (sanitizedExplicitName) return sanitizedExplicitName;

  if (error instanceof Error) {
    return sanitizeOptionalText(error.name, 120) ?? "Error";
  }

  return typeof error === "string" ? "Error" : "UnknownError";
}

function resolveErrorStack(
  error: unknown,
  explicitStack?: string,
): string | undefined {
  const sanitizedExplicitStack = sanitizeStackTrace(
    explicitStack,
    MAX_STACK_LENGTH,
  );
  if (sanitizedExplicitStack) {
    return sanitizedExplicitStack;
  }

  return error instanceof Error
    ? sanitizeStackTrace(error.stack, MAX_STACK_LENGTH)
    : undefined;
}

function buildStructuredErrorReport(
  options: ReportErrorOptions,
): StructuredErrorReport {
  const technicalMessage = truncateText(
    coerceErrorMessage(options.error) || "Unknown error",
    MAX_TEXT_FIELD_LENGTH,
  );
  const details = getErrorDetails(technicalMessage, options.statusCode);
  const category = options.category ?? details.category;
  const retryable = options.category
    ? isRetryableErrorCategory(options.category)
    : details.retryable;

  return {
    id: crypto.randomUUID(),
    timestamp: options.timestamp ?? Date.now(),
    environment: globalThis.window === undefined ? "server" : "client",
    source: options.source ?? "user_action",
    userAction: sanitizeUserAction(options.userAction),
    route: normalizeRoute(options.route ?? getCurrentClientRoute()),
    category,
    retryable,
    userMessage: details.userMessage,
    technicalMessage,
    statusCode: options.statusCode,
    suggestions: details.suggestions,
    errorName: resolveErrorName(options.error, options.errorName),
    digest: sanitizeOptionalText(options.digest, 120),
    stack: resolveErrorStack(options.error, options.stack),
    componentStack: sanitizeStackTrace(
      options.componentStack,
      MAX_STACK_LENGTH,
    ),
    metadata: sanitizeMetadata(options.metadata),
  };
}

async function persistStructuredErrorReport(
  report: StructuredErrorReport,
): Promise<void> {
  const { logPrivacySafe, redisClient } = await import("@/lib/api-utils");

  await redisClient.rpush(ERROR_REPORTS_KEY, JSON.stringify(report));
  await redisClient.ltrim(ERROR_REPORTS_KEY, -MAX_ERROR_REPORTS, -1);

  logPrivacySafe("error", "ErrorTracking", "Structured error recorded", {
    source: report.source,
    userAction: report.userAction,
    category: report.category,
    retryable: report.retryable,
    route: report.route,
    statusCode: report.statusCode,
  });

  if (process.env.NODE_ENV === "development") {
    console.error("[ErrorTracking]", report);
  }
}

async function postStructuredErrorReport(
  report: StructuredErrorReport,
): Promise<void> {
  if (typeof globalThis.fetch !== "function") return;

  const response = await globalThis.fetch("/api/error-reports", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      source: report.source,
      userAction: report.userAction,
      message: report.technicalMessage,
      errorName: report.errorName,
      route: report.route,
      statusCode: report.statusCode,
      digest: report.digest,
      stack: report.stack,
      componentStack: report.componentStack,
      metadata: report.metadata,
    }),
    credentials: "same-origin",
    keepalive: true,
  });

  if (!response.ok && process.env.NODE_ENV === "development") {
    console.error(
      `[ErrorTracking] Client error report rejected with status ${response.status}`,
    );
  }
}

/**
 * Report an error through the durable structured reporter.
 * @param options - Structured error reporting options.
 * @returns StructuredErrorReport when reporting succeeds, otherwise null.
 * @source
 */
export async function reportStructuredError(
  options: ReportErrorOptions,
): Promise<StructuredErrorReport | null> {
  try {
    const report = buildStructuredErrorReport(options);

    if (globalThis.window === undefined) {
      await persistStructuredErrorReport(report);
    } else {
      await postStructuredErrorReport(report);
    }

    return report;
  } catch (error) {
    console.error("[ErrorTracking] Failed to report structured error:", error);
    return null;
  }
}

/**
 * Track an error from a user action (e.g., "submit_card_form").
 * @param userAction - Description of user action when error occurred.
 * @param error - The error object or message.
 * @param errorType - ErrorCategory for classification.
 * @param additionalContext - Optional additional context for durable reporting.
 * @returns StructuredErrorReport when reporting succeeds, otherwise null.
 * @source
 */
export async function trackUserActionError(
  userAction: string,
  error: Error | string,
  errorType: ErrorCategory,
  additionalContext?: {
    statusCode?: number;
    route?: string;
    source?: ErrorReportSource;
    componentStack?: string;
    stack?: string;
    digest?: string;
    metadata?: Record<string, unknown>;
  },
): Promise<StructuredErrorReport | null> {
  return reportStructuredError({
    userAction,
    error,
    category: errorType,
    statusCode: additionalContext?.statusCode,
    route: additionalContext?.route,
    source: additionalContext?.source ?? "user_action",
    componentStack: additionalContext?.componentStack,
    stack: additionalContext?.stack,
    digest: additionalContext?.digest,
    metadata: additionalContext?.metadata,
  });
}
