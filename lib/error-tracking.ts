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
  requestId?: string;
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
  requestId?: string;
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

export interface ErrorReportBufferSnapshot {
  capacity: number;
  retained: number;
  totalCaptured: number;
  totalDropped: number;
  cumulativeSaturationRate: number;
}

const ERROR_REPORTS_KEY = "telemetry:error-reports:v1";
const ERROR_REPORTS_TOTAL_KEY = `${ERROR_REPORTS_KEY}:total`;
const ERROR_REPORTS_DROPPED_KEY = `${ERROR_REPORTS_KEY}:dropped`;
const MAX_ERROR_REPORTS = 250;
const MAX_TEXT_FIELD_LENGTH = 2_000;
const MAX_STACK_LENGTH = 8_000;
const MAX_METADATA_KEY_LENGTH = 64;

function roundRatio(value: number): number {
  return Number(value.toFixed(4));
}

function parseRedisCounter(value: unknown): number {
  if (typeof value === "number" && Number.isFinite(value)) {
    return Math.max(0, Math.trunc(value));
  }

  if (typeof value === "string") {
    const parsed = Number.parseInt(value, 10);
    return Number.isFinite(parsed) ? Math.max(0, parsed) : 0;
  }

  return 0;
}

function buildErrorReportBufferSnapshot(
  totalCaptured: number,
  totalDropped: number,
): ErrorReportBufferSnapshot {
  const normalizedTotalCaptured = Math.max(0, Math.trunc(totalCaptured));
  const normalizedTotalDropped = Math.max(
    0,
    Math.min(Math.trunc(totalDropped), normalizedTotalCaptured),
  );
  const retained = Math.min(
    MAX_ERROR_REPORTS,
    Math.max(0, normalizedTotalCaptured - normalizedTotalDropped),
  );

  return {
    capacity: MAX_ERROR_REPORTS,
    retained,
    totalCaptured: normalizedTotalCaptured,
    totalDropped: normalizedTotalDropped,
    cumulativeSaturationRate:
      normalizedTotalCaptured === 0
        ? 0
        : roundRatio(normalizedTotalDropped / normalizedTotalCaptured),
  };
}
const CLIENT_ERROR_REPORTS_ENDPOINT = "/api/error-reports";
const CLIENT_ERROR_REPORT_QUEUE_STORAGE_KEY = "anicards:error-report-queue:v1";
const MAX_CLIENT_ERROR_REPORT_DELIVERY_ATTEMPTS = 3;
const MAX_CLIENT_QUEUED_ERROR_REPORTS = 8;
const MAX_CLIENT_QUEUED_ERROR_REPORT_ATTEMPTS = 5;
const CLIENT_ERROR_REPORT_RETRY_BASE_DELAY_MS = 250;
const CLIENT_ERROR_REPORT_MAX_BACKOFF_MS = 2_000;
const MAX_CLIENT_QUEUED_ERROR_REPORT_BODY_LENGTH = 24_000;
const REQUEST_ID_PATTERN = /^[A-Za-z0-9._:-]{8,120}$/;

interface QueuedClientErrorReport {
  attempts: number;
  body: string;
  requestId?: string;
}

let isFlushingQueuedClientErrorReports = false;

function truncateText(value: string, maxLength: number): string {
  return value.length <= maxLength
    ? value
    : `${value.slice(0, Math.max(0, maxLength - 1))}…`;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
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

function sanitizeRequestId(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;

  const trimmed = value.trim();
  if (!REQUEST_ID_PATTERN.test(trimmed)) {
    return undefined;
  }

  return trimmed;
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

function resolveReportRequestId(
  options: ReportErrorOptions,
): string | undefined {
  return (
    sanitizeRequestId(options.requestId) ??
    sanitizeRequestId(options.metadata?.requestId)
  );
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
    requestId: resolveReportRequestId(options),
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

function buildClientErrorReportBody(report: StructuredErrorReport): {
  body: string;
  requestId?: string;
} {
  const body = JSON.stringify({
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
    requestId: report.requestId,
  });

  return {
    body,
    requestId: report.requestId,
  };
}

function canUseClientErrorReportQueue(): boolean {
  if (globalThis.window === undefined) {
    return false;
  }

  try {
    return globalThis.window.sessionStorage !== undefined;
  } catch {
    return false;
  }
}

function parseQueuedClientErrorReport(
  value: unknown,
): QueuedClientErrorReport | undefined {
  if (!isRecord(value)) return undefined;

  const body =
    typeof value.body === "string" &&
    value.body.length > 0 &&
    value.body.length <= MAX_CLIENT_QUEUED_ERROR_REPORT_BODY_LENGTH
      ? value.body
      : undefined;

  if (!body) return undefined;

  const attempts =
    typeof value.attempts === "number" &&
    Number.isInteger(value.attempts) &&
    value.attempts >= 0
      ? value.attempts
      : 0;

  return {
    attempts,
    body,
    requestId: sanitizeRequestId(value.requestId),
  };
}

function loadQueuedClientErrorReports(): QueuedClientErrorReport[] {
  if (!canUseClientErrorReportQueue()) {
    return [];
  }

  try {
    const rawQueue = globalThis.window.sessionStorage.getItem(
      CLIENT_ERROR_REPORT_QUEUE_STORAGE_KEY,
    );
    if (!rawQueue) {
      return [];
    }

    const parsed = JSON.parse(rawQueue) as unknown;
    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed
      .map((entry) => parseQueuedClientErrorReport(entry))
      .filter((entry): entry is QueuedClientErrorReport => entry !== undefined)
      .slice(-MAX_CLIENT_QUEUED_ERROR_REPORTS);
  } catch {
    return [];
  }
}

function saveQueuedClientErrorReports(queue: QueuedClientErrorReport[]): void {
  if (!canUseClientErrorReportQueue()) {
    return;
  }

  try {
    if (queue.length === 0) {
      globalThis.window.sessionStorage.removeItem(
        CLIENT_ERROR_REPORT_QUEUE_STORAGE_KEY,
      );
      return;
    }

    globalThis.window.sessionStorage.setItem(
      CLIENT_ERROR_REPORT_QUEUE_STORAGE_KEY,
      JSON.stringify(queue.slice(-MAX_CLIENT_QUEUED_ERROR_REPORTS)),
    );
  } catch {
    // Ignore queue persistence failures on the client.
  }
}

function enqueueQueuedClientErrorReport(report: {
  body: string;
  requestId?: string;
}): void {
  if (report.body.length > MAX_CLIENT_QUEUED_ERROR_REPORT_BODY_LENGTH) {
    return;
  }

  const nextQueue = [
    ...loadQueuedClientErrorReports(),
    {
      attempts: 0,
      body: report.body,
      requestId: report.requestId,
    },
  ].slice(-MAX_CLIENT_QUEUED_ERROR_REPORTS);

  saveQueuedClientErrorReports(nextQueue);
}

function getClientErrorReportRetryDelay(attempt: number): number {
  return Math.min(
    CLIENT_ERROR_REPORT_RETRY_BASE_DELAY_MS * 2 ** Math.max(0, attempt - 1),
    CLIENT_ERROR_REPORT_MAX_BACKOFF_MS,
  );
}

async function waitForClientErrorReportRetry(delayMs: number): Promise<void> {
  await new Promise((resolve) => {
    globalThis.setTimeout(resolve, delayMs);
  });
}

async function deliverClientErrorReport(
  report: {
    body: string;
    requestId?: string;
  },
  maxAttempts = MAX_CLIENT_ERROR_REPORT_DELIVERY_ATTEMPTS,
): Promise<void> {
  if (typeof globalThis.fetch !== "function") {
    throw new TypeError("Fetch is unavailable for client error reporting");
  }

  let lastError: Error | undefined;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
      };

      if (report.requestId) {
        headers["X-Request-Id"] = report.requestId;
      }

      const response = await globalThis.fetch(CLIENT_ERROR_REPORTS_ENDPOINT, {
        method: "POST",
        headers,
        body: report.body,
        credentials: "same-origin",
        keepalive: true,
      });

      if (response.ok) {
        return;
      }

      lastError = new Error(
        `Client error report rejected with status ${response.status}`,
      );
    } catch (error) {
      lastError =
        error instanceof Error
          ? error
          : new Error(String(error ?? "Unknown error"));
    }

    if (attempt < maxAttempts) {
      await waitForClientErrorReportRetry(
        getClientErrorReportRetryDelay(attempt),
      );
    }
  }

  throw lastError ?? new Error("Client error report delivery failed");
}

async function flushQueuedClientErrorReports(): Promise<void> {
  if (isFlushingQueuedClientErrorReports || !canUseClientErrorReportQueue()) {
    return;
  }

  const queuedReports = loadQueuedClientErrorReports();
  if (queuedReports.length === 0) {
    return;
  }

  isFlushingQueuedClientErrorReports = true;

  try {
    const remainingReports: QueuedClientErrorReport[] = [];

    for (const queuedReport of queuedReports) {
      try {
        await deliverClientErrorReport(queuedReport, 1);
      } catch {
        const nextAttempts = queuedReport.attempts + 1;
        if (nextAttempts < MAX_CLIENT_QUEUED_ERROR_REPORT_ATTEMPTS) {
          remainingReports.push({
            ...queuedReport,
            attempts: nextAttempts,
          });
        }
      }
    }

    saveQueuedClientErrorReports(remainingReports);
  } finally {
    isFlushingQueuedClientErrorReports = false;
  }
}

async function persistStructuredErrorReport(
  report: StructuredErrorReport,
): Promise<void> {
  const { logPrivacySafe, redisClient } = await import("@/lib/api-utils");

  const persistedLength = await redisClient.rpush(
    ERROR_REPORTS_KEY,
    JSON.stringify(report),
  );
  await redisClient.ltrim(ERROR_REPORTS_KEY, -MAX_ERROR_REPORTS, -1);

  try {
    const droppedOnWrite = persistedLength > MAX_ERROR_REPORTS ? 1 : 0;
    await Promise.all([
      redisClient.incr(ERROR_REPORTS_TOTAL_KEY),
      ...(droppedOnWrite > 0
        ? [redisClient.incr(ERROR_REPORTS_DROPPED_KEY)]
        : []),
    ]);
  } catch (error) {
    logPrivacySafe(
      "warn",
      "ErrorTracking",
      "Failed to update error-report buffer saturation counters",
      {
        error: error instanceof Error ? error.message : String(error),
      },
    );
  }

  logPrivacySafe("error", "ErrorTracking", "Structured error recorded", {
    source: report.source,
    userAction: report.userAction,
    requestId: report.requestId,
    category: report.category,
    retryable: report.retryable,
    route: report.route,
    statusCode: report.statusCode,
  });

  if (process.env.NODE_ENV === "development") {
    console.error("[ErrorTracking]", report);
  }
}

/**
 * Reads the durable error-report ring-buffer saturation counters.
 * @returns Current capacity, retained entries, total captured, and total dropped.
 * @source
 */
export async function getErrorReportBufferSnapshot(): Promise<ErrorReportBufferSnapshot> {
  const { redisClient } = await import("@/lib/api-utils");
  const [totalCapturedRaw, totalDroppedRaw] = await redisClient.mget(
    ERROR_REPORTS_TOTAL_KEY,
    ERROR_REPORTS_DROPPED_KEY,
  );

  return buildErrorReportBufferSnapshot(
    parseRedisCounter(totalCapturedRaw),
    parseRedisCounter(totalDroppedRaw),
  );
}

async function postStructuredErrorReport(
  report: StructuredErrorReport,
): Promise<void> {
  const clientReport = buildClientErrorReportBody(report);

  try {
    await deliverClientErrorReport(clientReport);
    await flushQueuedClientErrorReports();
  } catch (error) {
    enqueueQueuedClientErrorReport(clientReport);

    if (process.env.NODE_ENV === "development") {
      console.error(
        "[ErrorTracking] Failed to deliver client error report; queued for retry.",
        error,
      );
    }
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
    requestId?: string;
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
    requestId: additionalContext?.requestId,
    route: additionalContext?.route,
    source: additionalContext?.source ?? "user_action",
    componentStack: additionalContext?.componentStack,
    stack: additionalContext?.stack,
    digest: additionalContext?.digest,
    metadata: additionalContext?.metadata,
  });
}
