/**
 * Durable structured error reporting for client and server paths.
 * Reports are normalized through the shared error model, persisted via Redis on
 * the server, and forwarded through a request-proof-protected ingestion route
 * from the client.
 * @source
 */

import { redisClient } from "@/lib/api/clients";
import { logPrivacySafe } from "@/lib/api/logging";
import {
  type ErrorCategory,
  getErrorDetails,
  isRetryableErrorCategory,
  type RecoverySuggestion,
} from "@/lib/error-messages";
import {
  type ErrorReportMetadataValue,
  sanitizeErrorReportMetadata,
  sanitizeErrorReportRoute,
  sanitizeErrorReportText,
  sanitizeOptionalText,
  truncateText,
} from "@/lib/error-report-sanitization";
import { getStructuredResponseError, parseResponsePayload } from "@/lib/utils";

export type ErrorReportSource =
  | "user_action"
  | "client_hook"
  | "analytics_instrumentation"
  | "react_error_boundary"
  | "app_router_error_boundary"
  | "api_route";

type ErrorReportEnvironment = "client" | "server";

type SerializableMetadataValue = ErrorReportMetadataValue;

interface ReportErrorOptions {
  userAction: string;
  error: unknown;
  category?: ErrorCategory;
  executionEnvironment?: "auto" | "client" | "server";
  retryable?: boolean;
  recoverySuggestions?: RecoverySuggestion[];
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
  retainedTriage: ErrorReportTriageSummary;
  evictedTriage: ErrorReportTriageSummary & {
    updatedAt?: number;
  };
}

export interface ErrorReportTriageSample {
  id: string;
  timestamp: number;
  requestId?: string;
  digest?: string;
  route?: string;
  source: ErrorReportSource;
  userAction: string;
  category: ErrorCategory;
  retryable: boolean;
  statusCode?: number;
  errorName: string;
  technicalMessage: string;
  stack?: string;
  componentStack?: string;
  metadata?: Record<string, SerializableMetadataValue>;
}

export interface ErrorReportBreakdownBucket {
  value: string;
  reports: number;
  latest: ErrorReportTriageSample;
}

export interface ErrorReportTriageSummary {
  totalReports: number;
  topRoutes: ErrorReportBreakdownBucket[];
  topCategories: ErrorReportBreakdownBucket[];
  topSources: ErrorReportBreakdownBucket[];
  topUserActions: ErrorReportBreakdownBucket[];
  recentReports: ErrorReportTriageSample[];
}

export const ERROR_REPORT_REQUEST_MAX_BYTES = 24_000;

const ERROR_REPORTS_KEY = "telemetry:error-reports:v1";
const ERROR_REPORTS_TOTAL_KEY = `${ERROR_REPORTS_KEY}:total`;
const ERROR_REPORTS_DROPPED_KEY = `${ERROR_REPORTS_KEY}:dropped`;
const ERROR_REPORTS_EVICTED_SUMMARY_KEY = `${ERROR_REPORTS_KEY}:evicted-summary`;
const MAX_ERROR_REPORTS = 250;
const MAX_ERROR_REPORT_TRIAGE_BUCKETS = 5;
const MAX_ERROR_REPORT_TRACKED_BUCKETS = 16;
const MAX_ERROR_REPORT_RECENT_SAMPLES = 5;
const MAX_ERROR_REPORT_TRIAGE_MESSAGE_LENGTH = 240;
const MAX_ERROR_REPORT_TRIAGE_STACK_LENGTH = 600;
const MAX_TEXT_FIELD_LENGTH = 2_000;
const MAX_STACK_LENGTH = 8_000;
const MAX_RECOVERY_SUGGESTIONS = 6;
const MAX_RECOVERY_SUGGESTION_TITLE_LENGTH = 120;
const MAX_RECOVERY_SUGGESTION_DESCRIPTION_LENGTH = 240;
const MAX_RECOVERY_SUGGESTION_ACTION_LABEL_LENGTH = 80;

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
  options?: {
    retainedTriage?: ErrorReportTriageSummary;
    evictedTriage?: ErrorReportTriageSummary & {
      updatedAt?: number;
    };
  },
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
    retainedTriage:
      options?.retainedTriage ?? buildEmptyErrorReportTriageSummary(),
    evictedTriage:
      options?.evictedTriage ?? buildEmptyErrorReportTriageSummary(),
  };
}
const CLIENT_ERROR_REPORTS_ENDPOINT = "/api/error-reports";
const CLIENT_ERROR_REPORT_QUEUE_STORAGE_KEY = "anicards:error-report-queue:v1";
const MAX_CLIENT_ERROR_REPORT_DELIVERY_ATTEMPTS = 3;
const MAX_CLIENT_QUEUED_ERROR_REPORTS = 24;
const MAX_CLIENT_QUEUED_ERROR_REPORT_ATTEMPTS = 5;
const CLIENT_ERROR_REPORT_RETRY_BASE_DELAY_MS = 250;
const CLIENT_ERROR_REPORT_MAX_BACKOFF_MS = 2_000;
const MAX_CLIENT_QUEUED_ERROR_REPORT_BODY_LENGTH =
  ERROR_REPORT_REQUEST_MAX_BYTES;
const CLIENT_ERROR_REPORT_QUEUE_RETENTION_MS = 1000 * 60 * 60 * 24 * 7;
const MAX_CLIENT_ERROR_REPORT_QUEUE_DROP_SAMPLES = 5;
const REQUEST_ID_PATTERN = /^[A-Za-z0-9._:-]{8,120}$/;

type ClientErrorReportQueueStorageKind = "local_storage" | "session_storage";

type ClientErrorReportQueueDropReason =
  | "queue_evicted"
  | "queue_expired"
  | "max_attempts";

interface ClientErrorReportQueueTriage {
  source: ErrorReportSource;
  userAction: string;
  category: ErrorCategory;
  route?: string;
  requestId?: string;
  digest?: string;
  errorName: string;
  technicalMessage: string;
}

interface ClientErrorReportQueueEvent extends ClientErrorReportQueueTriage {
  reason: ClientErrorReportQueueDropReason;
  timestamp: number;
  attempts?: number;
}

interface ClientErrorReportQueueStats {
  storage: ClientErrorReportQueueStorageKind;
  totalQueued: number;
  totalDelivered: number;
  totalEvicted: number;
  totalExpired: number;
  totalDroppedAfterMaxAttempts: number;
  totalRateLimited: number;
  recentDrops: ClientErrorReportQueueEvent[];
}

interface ClientErrorReportQueueState {
  version: 1;
  reports: QueuedClientErrorReport[];
  stats: ClientErrorReportQueueStats;
}

interface ClientErrorReportStorageHandle {
  kind: ClientErrorReportQueueStorageKind;
  storage: Storage;
}

interface QueuedClientErrorReport {
  attempts: number;
  body: string;
  requestId?: string;
  nextAttemptAt?: number;
  queuedAt: number;
  triage: ClientErrorReportQueueTriage;
}

interface StoredErrorReportTriageBucket {
  reports: number;
  latest: ErrorReportTriageSample;
}

interface StoredErrorReportTriageState {
  totalReports: number;
  updatedAt: number;
  routes: Record<string, StoredErrorReportTriageBucket>;
  categories: Record<string, StoredErrorReportTriageBucket>;
  sources: Record<string, StoredErrorReportTriageBucket>;
  userActions: Record<string, StoredErrorReportTriageBucket>;
  recentReports: ErrorReportTriageSample[];
}

class ClientErrorReportDeliveryError extends Error {
  readonly retryable: boolean;
  readonly retryAfterMs?: number;
  readonly statusCode?: number;

  constructor(
    message: string,
    options: {
      retryable: boolean;
      retryAfterMs?: number;
      statusCode?: number;
      cause?: unknown;
    },
  ) {
    super(message);
    this.name = "ClientErrorReportDeliveryError";
    this.retryable = options.retryable;
    this.retryAfterMs = options.retryAfterMs;
    this.statusCode = options.statusCode;

    if (options.cause !== undefined) {
      (this as Error & { cause?: unknown }).cause = options.cause;
    }
  }
}

let isFlushingQueuedClientErrorReports = false;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isWhitespaceCodePoint(codePoint: number | undefined): boolean {
  return (
    codePoint === 0x20 ||
    codePoint === 0x09 ||
    codePoint === 0x0a ||
    codePoint === 0x0d ||
    codePoint === 0x0c ||
    codePoint === 0x0b
  );
}

function sanitizeStackFrame(line: string): string | undefined {
  const trimmed = line.trim();
  if (!trimmed.startsWith("at ")) return undefined;

  const frameText = trimmed.slice(3).trimStart();
  let frameLabelEnd = frameText.length;

  for (let index = 1; index < frameText.length; index++) {
    if (
      frameText.codePointAt(index) === 0x28 &&
      isWhitespaceCodePoint(frameText.codePointAt(index - 1))
    ) {
      let whitespaceStart = index - 1;

      while (
        whitespaceStart > 0 &&
        isWhitespaceCodePoint(frameText.codePointAt(whitespaceStart - 1))
      ) {
        whitespaceStart--;
      }

      frameLabelEnd = whitespaceStart;
      break;
    }
  }

  const frameLabel = frameText.slice(0, frameLabelEnd).trim();
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
  return (
    sanitizeErrorReportText(userAction, 120, {
      normalizeRelativeRoutes: false,
    }) ?? "unknown_action"
  );
}

function sanitizeRequestId(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;

  const trimmed = value.trim();
  if (!REQUEST_ID_PATTERN.test(trimmed)) {
    return undefined;
  }

  return trimmed;
}

function getRetryAfterMs(retryAfterHeader: string | null): number | undefined {
  if (!retryAfterHeader) {
    return undefined;
  }

  const asSeconds = Number(retryAfterHeader);
  if (Number.isFinite(asSeconds) && asSeconds >= 0) {
    return asSeconds * 1000;
  }

  const retryAt = Date.parse(retryAfterHeader);
  if (Number.isNaN(retryAt)) {
    return undefined;
  }

  return Math.max(0, retryAt - Date.now());
}

function getCurrentClientRoute(): string | undefined {
  if (globalThis.location === undefined) return undefined;
  return `${globalThis.location.pathname}${globalThis.location.search}`;
}

function resolveReportRequestId(
  options: ReportErrorOptions,
): string | undefined {
  return (
    sanitizeRequestId(options.requestId) ??
    sanitizeRequestId(options.metadata?.requestId)
  );
}

function sanitizeRecoverySuggestions(
  suggestions: RecoverySuggestion[] | undefined,
): RecoverySuggestion[] | undefined {
  if (!Array.isArray(suggestions)) {
    return undefined;
  }

  return suggestions
    .slice(0, MAX_RECOVERY_SUGGESTIONS)
    .flatMap((suggestion) => {
      if (typeof suggestion !== "object" || suggestion === null) {
        return [];
      }

      const title = sanitizeErrorReportText(
        suggestion.title,
        MAX_RECOVERY_SUGGESTION_TITLE_LENGTH,
        {
          normalizeRelativeRoutes: false,
        },
      );
      const description = sanitizeErrorReportText(
        suggestion.description,
        MAX_RECOVERY_SUGGESTION_DESCRIPTION_LENGTH,
      );

      if (!title || !description) {
        return [];
      }

      const actionLabel = sanitizeErrorReportText(
        suggestion.actionLabel,
        MAX_RECOVERY_SUGGESTION_ACTION_LABEL_LENGTH,
        {
          normalizeRelativeRoutes: false,
        },
      );

      return [
        {
          title,
          description,
          ...(actionLabel ? { actionLabel } : {}),
        } satisfies RecoverySuggestion,
      ];
    });
}

function coerceErrorMessage(error: unknown): string {
  if (typeof error === "string") return error;
  if (error instanceof Error) return error.message;
  return String(error);
}

function resolveErrorName(error: unknown, explicitName?: string): string {
  const sanitizedExplicitName = sanitizeErrorReportText(explicitName, 120, {
    normalizeRelativeRoutes: false,
  });
  if (sanitizedExplicitName) return sanitizedExplicitName;

  if (error instanceof Error) {
    return (
      sanitizeErrorReportText(error.name, 120, {
        normalizeRelativeRoutes: false,
      }) ?? "Error"
    );
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
  const technicalMessage =
    sanitizeErrorReportText(
      coerceErrorMessage(options.error) || "Unknown error",
      MAX_TEXT_FIELD_LENGTH,
    ) ?? "Unknown error";
  const derivedDetails = getErrorDetails(technicalMessage, options.statusCode);
  const category = options.category ?? derivedDetails.category;
  const categoryDetails =
    category === derivedDetails.category
      ? derivedDetails
      : getErrorDetails(category);
  let retryable = derivedDetails.retryable;

  if (typeof options.retryable === "boolean") {
    retryable = options.retryable;
  } else if (options.category) {
    retryable = isRetryableErrorCategory(options.category);
  }

  const recoverySuggestions = sanitizeRecoverySuggestions(
    options.recoverySuggestions,
  );

  return {
    id: crypto.randomUUID(),
    timestamp: options.timestamp ?? Date.now(),
    environment: globalThis.window === undefined ? "server" : "client",
    source: options.source ?? "user_action",
    userAction: sanitizeUserAction(options.userAction),
    requestId: resolveReportRequestId(options),
    route: sanitizeErrorReportRoute(options.route ?? getCurrentClientRoute()),
    category,
    retryable,
    userMessage: categoryDetails.userMessage,
    technicalMessage,
    statusCode: options.statusCode,
    suggestions: recoverySuggestions ?? categoryDetails.suggestions,
    errorName: resolveErrorName(options.error, options.errorName),
    digest: sanitizeOptionalText(options.digest, 120),
    stack: resolveErrorStack(options.error, options.stack),
    componentStack: sanitizeStackTrace(
      options.componentStack,
      MAX_STACK_LENGTH,
    ),
    metadata: sanitizeErrorReportMetadata(options.metadata),
  };
}

function buildEmptyErrorReportTriageSummary(): ErrorReportTriageSummary {
  return {
    totalReports: 0,
    topRoutes: [],
    topCategories: [],
    topSources: [],
    topUserActions: [],
    recentReports: [],
  };
}

function buildEmptyStoredErrorReportTriageState(): StoredErrorReportTriageState {
  return {
    totalReports: 0,
    updatedAt: 0,
    routes: {},
    categories: {},
    sources: {},
    userActions: {},
    recentReports: [],
  };
}

function buildErrorReportTriageSample(
  report: StructuredErrorReport,
): ErrorReportTriageSample {
  return {
    id: report.id,
    timestamp: report.timestamp,
    source: report.source,
    userAction: report.userAction,
    category: report.category,
    retryable: report.retryable,
    technicalMessage: truncateText(
      report.technicalMessage,
      MAX_ERROR_REPORT_TRIAGE_MESSAGE_LENGTH,
    ),
    errorName: report.errorName,
    ...(report.requestId ? { requestId: report.requestId } : {}),
    ...(report.digest ? { digest: report.digest } : {}),
    ...(report.route ? { route: report.route } : {}),
    ...(typeof report.statusCode === "number"
      ? { statusCode: report.statusCode }
      : {}),
    ...(report.stack
      ? {
          stack: truncateText(
            report.stack,
            MAX_ERROR_REPORT_TRIAGE_STACK_LENGTH,
          ),
        }
      : {}),
    ...(report.componentStack
      ? {
          componentStack: truncateText(
            report.componentStack,
            MAX_ERROR_REPORT_TRIAGE_STACK_LENGTH,
          ),
        }
      : {}),
    ...(report.metadata ? { metadata: report.metadata } : {}),
  };
}

function appendRecentErrorReportTriageSample(
  recentReports: ErrorReportTriageSample[],
  sample: ErrorReportTriageSample,
): ErrorReportTriageSample[] {
  return [sample, ...recentReports.filter((report) => report.id !== sample.id)]
    .sort((left, right) => right.timestamp - left.timestamp)
    .slice(0, MAX_ERROR_REPORT_RECENT_SAMPLES);
}

function sortStoredErrorReportTriageBuckets(
  buckets: Array<[string, StoredErrorReportTriageBucket]>,
): Array<[string, StoredErrorReportTriageBucket]> {
  return buckets.sort((left, right) => {
    const reportDelta = right[1].reports - left[1].reports;
    if (reportDelta !== 0) {
      return reportDelta;
    }

    const timestampDelta = right[1].latest.timestamp - left[1].latest.timestamp;
    if (timestampDelta !== 0) {
      return timestampDelta;
    }

    return left[0].localeCompare(right[0]);
  });
}

function trimStoredErrorReportTriageBuckets(
  buckets: Record<string, StoredErrorReportTriageBucket>,
): Record<string, StoredErrorReportTriageBucket> {
  return Object.fromEntries(
    sortStoredErrorReportTriageBuckets(Object.entries(buckets)).slice(
      0,
      MAX_ERROR_REPORT_TRACKED_BUCKETS,
    ),
  );
}

function recordStoredErrorReportTriageBucket(
  buckets: Record<string, StoredErrorReportTriageBucket>,
  value: string,
  sample: ErrorReportTriageSample,
): Record<string, StoredErrorReportTriageBucket> {
  const normalizedValue = value.trim() || "(unknown)";
  const existing = buckets[normalizedValue];

  return trimStoredErrorReportTriageBuckets({
    ...buckets,
    [normalizedValue]: {
      reports: (existing?.reports ?? 0) + 1,
      latest:
        !existing || sample.timestamp >= existing.latest.timestamp
          ? sample
          : existing.latest,
    },
  });
}

function getErrorReportTriageBreakdownValue(
  report: StructuredErrorReport,
  dimension: "route" | "category" | "source" | "userAction",
): string {
  switch (dimension) {
    case "route":
      return report.route ?? "(unknown)";
    case "category":
      return report.category;
    case "source":
      return report.source;
    case "userAction":
      return report.userAction;
  }
}

function mergeStoredErrorReportTriageState(
  currentState: StoredErrorReportTriageState,
  reports: StructuredErrorReport[],
): StoredErrorReportTriageState {
  return reports.reduce<StoredErrorReportTriageState>((state, report) => {
    const sample = buildErrorReportTriageSample(report);

    return {
      totalReports: state.totalReports + 1,
      updatedAt: Math.max(state.updatedAt, report.timestamp),
      routes: recordStoredErrorReportTriageBucket(
        state.routes,
        getErrorReportTriageBreakdownValue(report, "route"),
        sample,
      ),
      categories: recordStoredErrorReportTriageBucket(
        state.categories,
        getErrorReportTriageBreakdownValue(report, "category"),
        sample,
      ),
      sources: recordStoredErrorReportTriageBucket(
        state.sources,
        getErrorReportTriageBreakdownValue(report, "source"),
        sample,
      ),
      userActions: recordStoredErrorReportTriageBucket(
        state.userActions,
        getErrorReportTriageBreakdownValue(report, "userAction"),
        sample,
      ),
      recentReports: appendRecentErrorReportTriageSample(
        state.recentReports,
        sample,
      ),
    };
  }, currentState);
}

function toErrorReportBreakdownBuckets(
  buckets: Record<string, StoredErrorReportTriageBucket>,
): ErrorReportBreakdownBucket[] {
  return sortStoredErrorReportTriageBuckets(Object.entries(buckets))
    .slice(0, MAX_ERROR_REPORT_TRIAGE_BUCKETS)
    .map(([value, bucket]) => ({
      value,
      reports: bucket.reports,
      latest: bucket.latest,
    }));
}

function toErrorReportTriageSummary(
  state: StoredErrorReportTriageState,
): ErrorReportTriageSummary {
  return {
    totalReports: state.totalReports,
    topRoutes: toErrorReportBreakdownBuckets(state.routes),
    topCategories: toErrorReportBreakdownBuckets(state.categories),
    topSources: toErrorReportBreakdownBuckets(state.sources),
    topUserActions: toErrorReportBreakdownBuckets(state.userActions),
    recentReports: state.recentReports,
  };
}

function buildErrorReportTriageSummaryFromReports(
  reports: StructuredErrorReport[],
): ErrorReportTriageSummary {
  return toErrorReportTriageSummary(
    mergeStoredErrorReportTriageState(
      buildEmptyStoredErrorReportTriageState(),
      reports,
    ),
  );
}

function parseStructuredErrorReport(
  value: unknown,
): StructuredErrorReport | undefined {
  let parsedValue = value;

  if (typeof parsedValue === "string") {
    try {
      parsedValue = JSON.parse(parsedValue) as unknown;
    } catch {
      return undefined;
    }
  }

  if (
    !isRecord(parsedValue) ||
    typeof parsedValue.id !== "string" ||
    typeof parsedValue.timestamp !== "number" ||
    typeof parsedValue.source !== "string" ||
    typeof parsedValue.userAction !== "string" ||
    typeof parsedValue.category !== "string" ||
    typeof parsedValue.retryable !== "boolean" ||
    typeof parsedValue.technicalMessage !== "string" ||
    typeof parsedValue.errorName !== "string"
  ) {
    return undefined;
  }

  return parsedValue as unknown as StructuredErrorReport;
}

function parseErrorReportTriageSample(
  value: unknown,
): ErrorReportTriageSample | undefined {
  let parsedValue = value;

  if (typeof parsedValue === "string") {
    try {
      parsedValue = JSON.parse(parsedValue) as unknown;
    } catch {
      return undefined;
    }
  }

  if (
    !isRecord(parsedValue) ||
    typeof parsedValue.id !== "string" ||
    typeof parsedValue.timestamp !== "number" ||
    typeof parsedValue.source !== "string" ||
    typeof parsedValue.userAction !== "string" ||
    typeof parsedValue.category !== "string" ||
    typeof parsedValue.retryable !== "boolean" ||
    typeof parsedValue.technicalMessage !== "string" ||
    typeof parsedValue.errorName !== "string"
  ) {
    return undefined;
  }

  return parsedValue as unknown as ErrorReportTriageSample;
}

function parseStoredErrorReportTriageBucket(
  value: unknown,
): StoredErrorReportTriageBucket | undefined {
  if (!isRecord(value) || typeof value.reports !== "number") {
    return undefined;
  }

  const latest = parseErrorReportTriageSample(value.latest);
  if (!latest) {
    return undefined;
  }

  return {
    reports: Math.max(0, Math.trunc(value.reports)),
    latest,
  };
}

function parseStoredErrorReportTriageBuckets(
  value: unknown,
): Record<string, StoredErrorReportTriageBucket> {
  if (!isRecord(value)) {
    return {};
  }

  return trimStoredErrorReportTriageBuckets(
    Object.fromEntries(
      Object.entries(value)
        .map(([key, bucket]) => {
          const parsedBucket = parseStoredErrorReportTriageBucket(bucket);
          return parsedBucket ? ([key, parsedBucket] as const) : undefined;
        })
        .filter(
          (entry): entry is readonly [string, StoredErrorReportTriageBucket] =>
            entry !== undefined,
        ),
    ),
  );
}

function parseStoredErrorReportTriageState(
  value: unknown,
): StoredErrorReportTriageState {
  let parsedValue = value;

  if (typeof parsedValue === "string") {
    try {
      parsedValue = JSON.parse(parsedValue) as unknown;
    } catch {
      return buildEmptyStoredErrorReportTriageState();
    }
  }

  if (!isRecord(parsedValue)) {
    return buildEmptyStoredErrorReportTriageState();
  }

  const recentReports = Array.isArray(parsedValue.recentReports)
    ? parsedValue.recentReports
        .map((report) => parseErrorReportTriageSample(report))
        .filter(
          (report): report is ErrorReportTriageSample => report !== undefined,
        )
        .slice(0, MAX_ERROR_REPORT_RECENT_SAMPLES)
    : [];

  return {
    totalReports:
      typeof parsedValue.totalReports === "number"
        ? Math.max(0, Math.trunc(parsedValue.totalReports))
        : 0,
    updatedAt:
      typeof parsedValue.updatedAt === "number" &&
      Number.isFinite(parsedValue.updatedAt)
        ? Math.max(0, Math.trunc(parsedValue.updatedAt))
        : 0,
    routes: parseStoredErrorReportTriageBuckets(parsedValue.routes),
    categories: parseStoredErrorReportTriageBuckets(parsedValue.categories),
    sources: parseStoredErrorReportTriageBuckets(parsedValue.sources),
    userActions: parseStoredErrorReportTriageBuckets(parsedValue.userActions),
    recentReports,
  };
}

function buildClientErrorReportQueueTriage(
  report: StructuredErrorReport,
): ClientErrorReportQueueTriage {
  return {
    source: report.source,
    userAction: report.userAction,
    category: report.category,
    route: report.route,
    requestId: report.requestId,
    digest: report.digest,
    errorName: report.errorName,
    technicalMessage: truncateText(
      report.technicalMessage,
      MAX_ERROR_REPORT_TRIAGE_MESSAGE_LENGTH,
    ),
  };
}

function parseClientErrorReportQueueTriage(
  value: unknown,
): ClientErrorReportQueueTriage | undefined {
  if (!isRecord(value)) {
    return undefined;
  }

  const source =
    typeof value.source === "string"
      ? (value.source as ErrorReportSource)
      : undefined;
  const userAction =
    typeof value.userAction === "string"
      ? sanitizeUserAction(value.userAction)
      : undefined;
  const category =
    typeof value.category === "string"
      ? (value.category as ErrorCategory)
      : undefined;
  const errorName =
    typeof value.errorName === "string"
      ? (sanitizeErrorReportText(value.errorName, 120, {
          normalizeRelativeRoutes: false,
        }) ?? "Error")
      : undefined;
  const technicalMessage =
    typeof value.technicalMessage === "string"
      ? (sanitizeErrorReportText(
          value.technicalMessage,
          MAX_ERROR_REPORT_TRIAGE_MESSAGE_LENGTH,
        ) ?? "Queued client error report")
      : undefined;

  if (!source || !userAction || !category || !errorName || !technicalMessage) {
    return undefined;
  }

  return {
    source,
    userAction,
    category,
    errorName,
    technicalMessage,
    ...(typeof value.route === "string"
      ? { route: sanitizeErrorReportRoute(value.route) }
      : {}),
    ...(sanitizeRequestId(value.requestId)
      ? { requestId: sanitizeRequestId(value.requestId) }
      : {}),
    ...(typeof value.digest === "string"
      ? { digest: sanitizeOptionalText(value.digest, 120) }
      : {}),
  };
}

function createDefaultClientErrorReportQueueTriage(
  requestId?: string,
): ClientErrorReportQueueTriage {
  return {
    source: "client_hook",
    userAction: "queued_client_report",
    category: "unknown",
    requestId,
    errorName: "Error",
    technicalMessage: "Queued client error report",
  };
}

function buildClientErrorReportQueueTriageFromBody(
  body: string,
  requestId?: string,
): ClientErrorReportQueueTriage | undefined {
  try {
    const parsed = JSON.parse(body) as unknown;
    if (!isRecord(parsed)) {
      return undefined;
    }

    return {
      source:
        typeof parsed.source === "string"
          ? (parsed.source as ErrorReportSource)
          : "client_hook",
      userAction:
        typeof parsed.userAction === "string"
          ? sanitizeUserAction(parsed.userAction)
          : "queued_client_report",
      category:
        typeof parsed.category === "string"
          ? (parsed.category as ErrorCategory)
          : "unknown",
      route:
        typeof parsed.route === "string"
          ? sanitizeErrorReportRoute(parsed.route)
          : undefined,
      requestId:
        sanitizeRequestId(parsed.requestId) ?? sanitizeRequestId(requestId),
      digest:
        typeof parsed.digest === "string"
          ? sanitizeOptionalText(parsed.digest, 120)
          : undefined,
      errorName:
        typeof parsed.errorName === "string"
          ? (sanitizeErrorReportText(parsed.errorName, 120, {
              normalizeRelativeRoutes: false,
            }) ?? "Error")
          : "Error",
      technicalMessage:
        typeof parsed.message === "string"
          ? (sanitizeErrorReportText(
              parsed.message,
              MAX_ERROR_REPORT_TRIAGE_MESSAGE_LENGTH,
            ) ?? "Queued client error report")
          : "Queued client error report",
    };
  } catch {
    return undefined;
  }
}

function createClientErrorReportQueueStats(
  storage: ClientErrorReportQueueStorageKind,
): ClientErrorReportQueueStats {
  return {
    storage,
    totalQueued: 0,
    totalDelivered: 0,
    totalEvicted: 0,
    totalExpired: 0,
    totalDroppedAfterMaxAttempts: 0,
    totalRateLimited: 0,
    recentDrops: [],
  };
}

function buildClientErrorReportQueueState(
  storage: ClientErrorReportQueueStorageKind,
): ClientErrorReportQueueState {
  return {
    version: 1,
    reports: [],
    stats: createClientErrorReportQueueStats(storage),
  };
}

function parseClientErrorReportQueueStats(
  value: unknown,
  storage: ClientErrorReportQueueStorageKind,
): ClientErrorReportQueueStats {
  if (!isRecord(value)) {
    return createClientErrorReportQueueStats(storage);
  }

  const recentDrops = Array.isArray(value.recentDrops)
    ? value.recentDrops.filter(isRecord).flatMap((entry) => {
        const triage = parseClientErrorReportQueueTriage(entry);
        if (!triage) {
          return [];
        }

        const reason =
          typeof entry.reason === "string"
            ? (entry.reason as ClientErrorReportQueueDropReason)
            : undefined;
        const timestamp =
          typeof entry.timestamp === "number" &&
          Number.isFinite(entry.timestamp)
            ? Math.max(0, Math.trunc(entry.timestamp))
            : undefined;

        if (!reason || !timestamp) {
          return [];
        }

        return [
          {
            ...triage,
            reason,
            timestamp,
            ...(typeof entry.attempts === "number" &&
            Number.isInteger(entry.attempts) &&
            entry.attempts >= 0
              ? { attempts: Math.trunc(entry.attempts) }
              : {}),
          } satisfies ClientErrorReportQueueEvent,
        ];
      })
    : [];

  return {
    storage,
    totalQueued:
      typeof value.totalQueued === "number" &&
      Number.isFinite(value.totalQueued)
        ? Math.max(0, Math.trunc(value.totalQueued))
        : 0,
    totalDelivered:
      typeof value.totalDelivered === "number" &&
      Number.isFinite(value.totalDelivered)
        ? Math.max(0, Math.trunc(value.totalDelivered))
        : 0,
    totalEvicted:
      typeof value.totalEvicted === "number" &&
      Number.isFinite(value.totalEvicted)
        ? Math.max(0, Math.trunc(value.totalEvicted))
        : 0,
    totalExpired:
      typeof value.totalExpired === "number" &&
      Number.isFinite(value.totalExpired)
        ? Math.max(0, Math.trunc(value.totalExpired))
        : 0,
    totalDroppedAfterMaxAttempts:
      typeof value.totalDroppedAfterMaxAttempts === "number" &&
      Number.isFinite(value.totalDroppedAfterMaxAttempts)
        ? Math.max(0, Math.trunc(value.totalDroppedAfterMaxAttempts))
        : 0,
    totalRateLimited:
      typeof value.totalRateLimited === "number" &&
      Number.isFinite(value.totalRateLimited)
        ? Math.max(0, Math.trunc(value.totalRateLimited))
        : 0,
    recentDrops: recentDrops.slice(
      0,
      MAX_CLIENT_ERROR_REPORT_QUEUE_DROP_SAMPLES,
    ),
  };
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

  const nextAttemptAt =
    typeof value.nextAttemptAt === "number" &&
    Number.isFinite(value.nextAttemptAt) &&
    value.nextAttemptAt > 0
      ? Math.trunc(value.nextAttemptAt)
      : undefined;

  const queuedAt =
    typeof value.queuedAt === "number" &&
    Number.isFinite(value.queuedAt) &&
    value.queuedAt > 0
      ? Math.trunc(value.queuedAt)
      : Date.now();

  const triage = isRecord(value.triage)
    ? buildClientErrorReportQueueTriageFromBody(
        JSON.stringify(value.triage),
        sanitizeRequestId(value.requestId),
      )
    : buildClientErrorReportQueueTriageFromBody(
        body,
        sanitizeRequestId(value.requestId),
      );

  return {
    attempts,
    body,
    queuedAt,
    triage:
      triage ??
      createDefaultClientErrorReportQueueTriage(
        sanitizeRequestId(value.requestId),
      ),
    requestId: sanitizeRequestId(value.requestId),
    ...(nextAttemptAt ? { nextAttemptAt } : {}),
  };
}

function parseClientErrorReportQueueState(
  rawValue: unknown,
  storage: ClientErrorReportQueueStorageKind,
): ClientErrorReportQueueState {
  if (Array.isArray(rawValue)) {
    const reports = rawValue
      .map((entry) => parseQueuedClientErrorReport(entry))
      .filter((entry): entry is QueuedClientErrorReport => entry !== undefined);
    const state = buildClientErrorReportQueueState(storage);
    state.reports = reports;
    state.stats.totalQueued = reports.length;
    return state;
  }

  if (!isRecord(rawValue)) {
    return buildClientErrorReportQueueState(storage);
  }

  const state = buildClientErrorReportQueueState(storage);
  state.reports = Array.isArray(rawValue.reports)
    ? rawValue.reports
        .map((entry) => parseQueuedClientErrorReport(entry))
        .filter(
          (entry): entry is QueuedClientErrorReport => entry !== undefined,
        )
    : [];
  state.stats = parseClientErrorReportQueueStats(rawValue.stats, storage);
  return state;
}

function appendClientErrorReportQueueEvent(
  events: ClientErrorReportQueueEvent[],
  event: ClientErrorReportQueueEvent,
): ClientErrorReportQueueEvent[] {
  return [event, ...events].slice(
    0,
    MAX_CLIENT_ERROR_REPORT_QUEUE_DROP_SAMPLES,
  );
}

function recordClientErrorReportQueueDrop(
  state: ClientErrorReportQueueState,
  report: QueuedClientErrorReport,
  reason: ClientErrorReportQueueDropReason,
): void {
  const event: ClientErrorReportQueueEvent = {
    ...report.triage,
    reason,
    timestamp: Date.now(),
    attempts: report.attempts,
  };

  switch (reason) {
    case "queue_evicted":
      state.stats.totalEvicted += 1;
      break;
    case "queue_expired":
      state.stats.totalExpired += 1;
      break;
    case "max_attempts":
      state.stats.totalDroppedAfterMaxAttempts += 1;
      break;
  }

  state.stats.recentDrops = appendClientErrorReportQueueEvent(
    state.stats.recentDrops,
    event,
  );
}

function normalizeClientErrorReportQueueState(
  state: ClientErrorReportQueueState,
  storage: ClientErrorReportQueueStorageKind,
): ClientErrorReportQueueState {
  state.stats.storage = storage;

  const now = Date.now();
  const retainedReports: QueuedClientErrorReport[] = [];
  for (const report of state.reports) {
    if (now - report.queuedAt > CLIENT_ERROR_REPORT_QUEUE_RETENTION_MS) {
      recordClientErrorReportQueueDrop(state, report, "queue_expired");
      continue;
    }

    retainedReports.push(report);
  }

  state.reports = retainedReports;

  while (state.reports.length > MAX_CLIENT_QUEUED_ERROR_REPORTS) {
    const evictedReport = state.reports.shift();
    if (!evictedReport) {
      break;
    }

    recordClientErrorReportQueueDrop(state, evictedReport, "queue_evicted");
  }

  return state;
}

function getClientErrorReportStorageHandleForKind(
  kind: ClientErrorReportQueueStorageKind,
): ClientErrorReportStorageHandle | null {
  if (globalThis.window === undefined) {
    return null;
  }

  try {
    const storage =
      kind === "local_storage"
        ? globalThis.window.localStorage
        : globalThis.window.sessionStorage;

    if (!storage || typeof storage.getItem !== "function") {
      return null;
    }

    return { kind, storage };
  } catch {
    return null;
  }
}

function getClientErrorReportStorageHandle(): ClientErrorReportStorageHandle | null {
  return (
    getClientErrorReportStorageHandleForKind("local_storage") ??
    getClientErrorReportStorageHandleForKind("session_storage")
  );
}

function readClientErrorReportQueueStateFromStorage(
  handle: ClientErrorReportStorageHandle,
): ClientErrorReportQueueState | null {
  try {
    const rawQueue = handle.storage.getItem(
      CLIENT_ERROR_REPORT_QUEUE_STORAGE_KEY,
    );
    if (!rawQueue) {
      return null;
    }

    return parseClientErrorReportQueueState(
      JSON.parse(rawQueue) as unknown,
      handle.kind,
    );
  } catch {
    return null;
  }
}

function shouldPersistClientErrorReportQueueState(
  state: ClientErrorReportQueueState,
): boolean {
  return (
    state.reports.length > 0 ||
    state.stats.totalQueued > 0 ||
    state.stats.totalDelivered > 0 ||
    state.stats.totalEvicted > 0 ||
    state.stats.totalExpired > 0 ||
    state.stats.totalDroppedAfterMaxAttempts > 0 ||
    state.stats.totalRateLimited > 0 ||
    state.stats.recentDrops.length > 0
  );
}

function writeClientErrorReportQueueStateToStorage(
  handle: ClientErrorReportStorageHandle,
  state: ClientErrorReportQueueState,
): boolean {
  try {
    if (!shouldPersistClientErrorReportQueueState(state)) {
      handle.storage.removeItem(CLIENT_ERROR_REPORT_QUEUE_STORAGE_KEY);
      return true;
    }

    handle.storage.setItem(
      CLIENT_ERROR_REPORT_QUEUE_STORAGE_KEY,
      JSON.stringify(state),
    );
    return true;
  } catch {
    return false;
  }
}

function clearClientErrorReportQueueStorage(
  handle: ClientErrorReportStorageHandle | null,
): void {
  if (!handle) {
    return;
  }

  try {
    handle.storage.removeItem(CLIENT_ERROR_REPORT_QUEUE_STORAGE_KEY);
  } catch {
    // Ignore storage cleanup failures.
  }
}

function loadClientErrorReportQueueStore(): {
  handle: ClientErrorReportStorageHandle;
  state: ClientErrorReportQueueState;
} | null {
  const handle = getClientErrorReportStorageHandle();
  if (!handle) {
    return null;
  }

  const storedState = readClientErrorReportQueueStateFromStorage(handle);
  if (storedState) {
    return {
      handle,
      state: normalizeClientErrorReportQueueState(storedState, handle.kind),
    };
  }

  if (handle.kind === "local_storage") {
    const fallbackHandle =
      getClientErrorReportStorageHandleForKind("session_storage");
    const fallbackState = fallbackHandle
      ? readClientErrorReportQueueStateFromStorage(fallbackHandle)
      : null;

    if (fallbackHandle && fallbackState) {
      const normalizedState = normalizeClientErrorReportQueueState(
        fallbackState,
        handle.kind,
      );

      clearClientErrorReportQueueStorage(fallbackHandle);

      return {
        handle,
        state: normalizedState,
      };
    }
  }

  return {
    handle,
    state: buildClientErrorReportQueueState(handle.kind),
  };
}

function saveClientErrorReportQueueStore(store: {
  handle: ClientErrorReportStorageHandle;
  state: ClientErrorReportQueueState;
}): void {
  store.state = normalizeClientErrorReportQueueState(
    store.state,
    store.handle.kind,
  );

  if (writeClientErrorReportQueueStateToStorage(store.handle, store.state)) {
    if (store.handle.kind === "local_storage") {
      clearClientErrorReportQueueStorage(
        getClientErrorReportStorageHandleForKind("session_storage"),
      );
    }
    return;
  }

  if (store.handle.kind === "local_storage") {
    const fallbackHandle =
      getClientErrorReportStorageHandleForKind("session_storage");
    if (!fallbackHandle) {
      return;
    }

    store.state.stats.storage = fallbackHandle.kind;
    void writeClientErrorReportQueueStateToStorage(fallbackHandle, store.state);
  }
}

function buildClientErrorReportQueueMetadata(
  state: ClientErrorReportQueueState,
  options: {
    queued: boolean;
    queueAttempts: number;
  },
): Record<string, SerializableMetadataValue> {
  return {
    clientQueueStorage: state.stats.storage,
    clientQueueDepth: state.reports.length,
    clientQueueTotalEvicted: state.stats.totalEvicted,
    clientQueueTotalDropped:
      state.stats.totalExpired + state.stats.totalDroppedAfterMaxAttempts,
    clientQueueTotalRateLimited: state.stats.totalRateLimited,
    clientQueued: options.queued,
    clientQueueAttempts: Math.max(0, Math.trunc(options.queueAttempts)),
  };
}

function mergeClientErrorReportMetadata(
  metadata: Record<string, SerializableMetadataValue> | undefined,
  clientQueueMetadata: Record<string, SerializableMetadataValue>,
): Record<string, SerializableMetadataValue> {
  if (!metadata) {
    return { ...clientQueueMetadata };
  }

  return {
    ...metadata,
    ...clientQueueMetadata,
  };
}

function injectClientErrorReportQueueMetadata(options: {
  body: string;
  queueState: ClientErrorReportQueueState;
  queued: boolean;
  queueAttempts: number;
}): string {
  try {
    const parsedPayload = JSON.parse(options.body) as unknown;
    if (!isRecord(parsedPayload)) {
      return options.body;
    }

    const existingMetadata = isRecord(parsedPayload.metadata)
      ? (parsedPayload.metadata as Record<string, SerializableMetadataValue>)
      : undefined;

    const nextPayload = {
      ...parsedPayload,
      metadata: mergeClientErrorReportMetadata(
        existingMetadata,
        buildClientErrorReportQueueMetadata(options.queueState, {
          queued: options.queued,
          queueAttempts: options.queueAttempts,
        }),
      ),
    };

    const nextBody = JSON.stringify(nextPayload);
    return nextBody.length <= MAX_CLIENT_QUEUED_ERROR_REPORT_BODY_LENGTH
      ? nextBody
      : options.body;
  } catch {
    return options.body;
  }
}

function buildClientErrorReportBody(
  report: StructuredErrorReport,
  options?: {
    queueState?: ClientErrorReportQueueState;
    queued?: boolean;
    queueAttempts?: number;
  },
): {
  body: string;
  requestId?: string;
} {
  let body = JSON.stringify({
    source: report.source,
    userAction: report.userAction,
    message: report.technicalMessage,
    category: report.category,
    retryable: report.retryable,
    recoverySuggestions: report.suggestions,
    errorName: report.errorName,
    route: report.route,
    statusCode: report.statusCode,
    digest: report.digest,
    stack: report.stack,
    componentStack: report.componentStack,
    metadata: report.metadata,
    requestId: report.requestId,
  });

  if (options?.queueState) {
    body = injectClientErrorReportQueueMetadata({
      body,
      queueState: options.queueState,
      queued: options.queued ?? false,
      queueAttempts: options.queueAttempts ?? 0,
    });
  }

  return {
    body,
    requestId: report.requestId,
  };
}

function canUseClientErrorReportQueue(): boolean {
  return getClientErrorReportStorageHandle() !== null;
}

function enqueueQueuedClientErrorReport(report: {
  body: string;
  requestId?: string;
  attempts?: number;
  nextAttemptAt?: number;
  triage?: ClientErrorReportQueueTriage;
}): void {
  if (report.body.length > MAX_CLIENT_QUEUED_ERROR_REPORT_BODY_LENGTH) {
    return;
  }

  const store = loadClientErrorReportQueueStore();
  if (!store) {
    return;
  }

  if (store.state.reports.length >= MAX_CLIENT_QUEUED_ERROR_REPORTS) {
    const evictedReport = store.state.reports.shift();
    if (evictedReport) {
      recordClientErrorReportQueueDrop(
        store.state,
        evictedReport,
        "queue_evicted",
      );
    }
  }

  store.state.reports.push({
    attempts:
      typeof report.attempts === "number" && report.attempts >= 0
        ? Math.trunc(report.attempts)
        : 0,
    body: report.body,
    queuedAt: Date.now(),
    triage:
      report.triage ??
      buildClientErrorReportQueueTriageFromBody(
        report.body,
        report.requestId,
      ) ??
      createDefaultClientErrorReportQueueTriage(report.requestId),
    requestId: report.requestId,
    ...(typeof report.nextAttemptAt === "number" &&
    Number.isFinite(report.nextAttemptAt) &&
    report.nextAttemptAt > 0
      ? { nextAttemptAt: Math.trunc(report.nextAttemptAt) }
      : {}),
  });
  store.state.stats.totalQueued += 1;

  saveClientErrorReportQueueStore(store);
}

function incrementClientErrorReportRateLimitedCount(): void {
  const store = loadClientErrorReportQueueStore();
  if (!store) {
    return;
  }

  store.state.stats.totalRateLimited += 1;
  saveClientErrorReportQueueStore(store);
}

function getClientErrorReportRetryDelay(attempt: number): number {
  return Math.min(
    CLIENT_ERROR_REPORT_RETRY_BASE_DELAY_MS * 2 ** Math.max(0, attempt - 1),
    CLIENT_ERROR_REPORT_MAX_BACKOFF_MS,
  );
}

function getClientErrorReportImmediateRetryDelay(options: {
  attempt: number;
  retryAfterMs?: number;
}): number | undefined {
  if (typeof options.retryAfterMs === "number") {
    return options.retryAfterMs <= CLIENT_ERROR_REPORT_MAX_BACKOFF_MS
      ? options.retryAfterMs
      : undefined;
  }

  return getClientErrorReportRetryDelay(options.attempt);
}

function getQueuedClientErrorReportNextAttemptAt(options: {
  attempts: number;
  retryAfterMs?: number;
}): number {
  const delayMs =
    typeof options.retryAfterMs === "number"
      ? options.retryAfterMs
      : getClientErrorReportRetryDelay(options.attempts);

  return Date.now() + Math.max(0, delayMs);
}

function isRetryableClientErrorReportTransportFailure(error: unknown): boolean {
  if (error instanceof ClientErrorReportDeliveryError) {
    return error.retryable;
  }

  if (error instanceof TypeError) {
    return true;
  }

  return error instanceof Error && error.name === "TimeoutError";
}

function toClientErrorReportDeliveryError(
  error: unknown,
): ClientErrorReportDeliveryError {
  if (error instanceof ClientErrorReportDeliveryError) {
    return error;
  }

  const message =
    error instanceof Error ? error.message : String(error ?? "Unknown error");

  return new ClientErrorReportDeliveryError(message, {
    retryable: isRetryableClientErrorReportTransportFailure(error),
    cause: error,
  });
}

async function createClientErrorReportResponseError(
  response: Response,
): Promise<ClientErrorReportDeliveryError> {
  const payload = await parseResponsePayload(response);
  const structuredError = getStructuredResponseError(response, payload);

  return new ClientErrorReportDeliveryError(structuredError.message, {
    retryable: structuredError.retryable,
    retryAfterMs: getRetryAfterMs(response.headers.get("retry-after")),
    statusCode: structuredError.status,
  });
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

  let lastError: ClientErrorReportDeliveryError | undefined;

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

      lastError = await createClientErrorReportResponseError(response);
    } catch (error) {
      lastError = toClientErrorReportDeliveryError(error);
    }

    const retryDelayMs = getClientErrorReportImmediateRetryDelay({
      attempt,
      retryAfterMs: lastError.retryAfterMs,
    });

    if (
      !lastError.retryable ||
      attempt >= maxAttempts ||
      retryDelayMs === undefined
    ) {
      throw lastError;
    }

    await waitForClientErrorReportRetry(retryDelayMs);
  }

  throw (
    lastError ??
    new ClientErrorReportDeliveryError("Client error report delivery failed", {
      retryable: true,
    })
  );
}

function shouldDeferQueuedClientErrorReport(
  queuedReport: QueuedClientErrorReport,
): boolean {
  return (
    typeof queuedReport.nextAttemptAt === "number" &&
    queuedReport.nextAttemptAt > Date.now()
  );
}

function getRetriableQueuedClientErrorReport(
  queuedReport: QueuedClientErrorReport,
  deliveryError: ClientErrorReportDeliveryError,
  state: ClientErrorReportQueueState,
): QueuedClientErrorReport | null {
  if (!deliveryError.retryable) {
    return null;
  }

  const nextAttempts = queuedReport.attempts + 1;
  if (nextAttempts < MAX_CLIENT_QUEUED_ERROR_REPORT_ATTEMPTS) {
    return {
      ...queuedReport,
      attempts: nextAttempts,
      nextAttemptAt: getQueuedClientErrorReportNextAttemptAt({
        attempts: nextAttempts,
        retryAfterMs: deliveryError.retryAfterMs,
      }),
    };
  }

  recordClientErrorReportQueueDrop(
    state,
    {
      ...queuedReport,
      attempts: nextAttempts,
    },
    "max_attempts",
  );
  return null;
}

async function replayQueuedClientErrorReport(
  store: {
    handle: ClientErrorReportStorageHandle;
    state: ClientErrorReportQueueState;
  },
  queuedReport: QueuedClientErrorReport,
): Promise<QueuedClientErrorReport | null> {
  try {
    await deliverClientErrorReport(
      {
        body: injectClientErrorReportQueueMetadata({
          body: queuedReport.body,
          queueState: store.state,
          queued: true,
          queueAttempts: queuedReport.attempts,
        }),
        requestId: queuedReport.requestId,
      },
      1,
    );
    store.state.stats.totalDelivered += 1;
    return null;
  } catch (error) {
    const deliveryError = toClientErrorReportDeliveryError(error);
    if (deliveryError.statusCode === 429) {
      store.state.stats.totalRateLimited += 1;
    }

    return getRetriableQueuedClientErrorReport(
      queuedReport,
      deliveryError,
      store.state,
    );
  }
}

async function flushQueuedClientErrorReports(): Promise<void> {
  if (isFlushingQueuedClientErrorReports || !canUseClientErrorReportQueue()) {
    return;
  }

  const store = loadClientErrorReportQueueStore();
  if (!store || store.state.reports.length === 0) {
    return;
  }

  isFlushingQueuedClientErrorReports = true;

  try {
    const remainingReports: QueuedClientErrorReport[] = [];

    for (const queuedReport of store.state.reports) {
      if (shouldDeferQueuedClientErrorReport(queuedReport)) {
        remainingReports.push(queuedReport);
        continue;
      }

      const nextQueuedReport = await replayQueuedClientErrorReport(
        store,
        queuedReport,
      );
      if (nextQueuedReport) {
        remainingReports.push(nextQueuedReport);
      }
    }

    store.state.reports = remainingReports;
    saveClientErrorReportQueueStore(store);
  } finally {
    isFlushingQueuedClientErrorReports = false;
  }
}

async function updateEvictedErrorReportTriageSummary(
  redisClient: {
    get: (key: string) => Promise<unknown>;
    lrange: (key: string, start: number, end: number) => Promise<unknown>;
    set: (key: string, value: string) => Promise<unknown>;
  },
  persistedLength: number,
): Promise<void> {
  const overflowCount = Math.max(0, persistedLength - MAX_ERROR_REPORTS);
  if (overflowCount === 0) {
    return;
  }

  const evictedEntriesRaw = await redisClient.lrange(
    ERROR_REPORTS_KEY,
    0,
    overflowCount - 1,
  );
  const evictedReports = Array.isArray(evictedEntriesRaw)
    ? evictedEntriesRaw
        .map((entry) => parseStructuredErrorReport(entry))
        .filter((entry): entry is StructuredErrorReport => entry !== undefined)
    : [];

  if (evictedReports.length === 0) {
    return;
  }

  const storedSummaryRaw = await redisClient.get(
    ERROR_REPORTS_EVICTED_SUMMARY_KEY,
  );
  const nextSummary = mergeStoredErrorReportTriageState(
    parseStoredErrorReportTriageState(storedSummaryRaw),
    evictedReports,
  );

  await redisClient.set(
    ERROR_REPORTS_EVICTED_SUMMARY_KEY,
    JSON.stringify(nextSummary),
  );
}

async function persistStructuredErrorBufferEntry(
  report: StructuredErrorReport,
): Promise<void> {
  const persistedLength = await redisClient.rpush(
    ERROR_REPORTS_KEY,
    JSON.stringify(report),
  );

  try {
    await updateEvictedErrorReportTriageSummary(redisClient, persistedLength);
  } catch (error) {
    logPrivacySafe(
      "warn",
      "ErrorTracking",
      "Failed to update error-report eviction summary",
      {
        error: error instanceof Error ? error.message : String(error),
      },
    );
  }

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
  const [
    [totalCapturedRaw, totalDroppedRaw],
    retainedEntriesRaw,
    evictedTriageRaw,
  ] = await Promise.all([
    redisClient.mget(ERROR_REPORTS_TOTAL_KEY, ERROR_REPORTS_DROPPED_KEY),
    redisClient.lrange(ERROR_REPORTS_KEY, -MAX_ERROR_REPORTS, -1),
    redisClient.get(ERROR_REPORTS_EVICTED_SUMMARY_KEY),
  ]);

  const retainedReports = Array.isArray(retainedEntriesRaw)
    ? retainedEntriesRaw
        .map((entry) => parseStructuredErrorReport(entry))
        .filter((entry): entry is StructuredErrorReport => entry !== undefined)
    : [];
  const evictedTriageState =
    parseStoredErrorReportTriageState(evictedTriageRaw);

  return buildErrorReportBufferSnapshot(
    parseRedisCounter(totalCapturedRaw),
    parseRedisCounter(totalDroppedRaw),
    {
      retainedTriage: buildErrorReportTriageSummaryFromReports(retainedReports),
      evictedTriage: {
        ...toErrorReportTriageSummary(evictedTriageState),
        ...(evictedTriageState.updatedAt > 0
          ? { updatedAt: evictedTriageState.updatedAt }
          : {}),
      },
    },
  );
}

async function postStructuredErrorReport(
  report: StructuredErrorReport,
): Promise<void> {
  const queueStore = loadClientErrorReportQueueStore();
  const clientReport = buildClientErrorReportBody(report, {
    queueState: queueStore?.state,
    queued: false,
    queueAttempts: 0,
  });

  try {
    await deliverClientErrorReport(clientReport);
    await flushQueuedClientErrorReports();
  } catch (error) {
    const deliveryError = toClientErrorReportDeliveryError(error);

    if (deliveryError.statusCode === 429) {
      incrementClientErrorReportRateLimitedCount();
    }

    if (deliveryError.retryable) {
      enqueueQueuedClientErrorReport({
        ...clientReport,
        triage: buildClientErrorReportQueueTriage(report),
        ...(typeof deliveryError.retryAfterMs === "number"
          ? {
              nextAttemptAt: getQueuedClientErrorReportNextAttemptAt({
                attempts: 0,
                retryAfterMs: deliveryError.retryAfterMs,
              }),
            }
          : {}),
      });
    }

    if (process.env.NODE_ENV === "development") {
      console.error(
        "[ErrorTracking] Failed to deliver client error report; queued for retry.",
        error,
      );
    }
  }
}

async function executeStructuredErrorReport(
  options: ReportErrorOptions,
): Promise<StructuredErrorReport> {
  const report = buildStructuredErrorReport(options);
  const executionEnvironment =
    options.executionEnvironment ??
    (globalThis.window === undefined ? "server" : "client");

  if (executionEnvironment === "server") {
    await persistStructuredErrorBufferEntry(report);
  } else {
    await postStructuredErrorReport(report);
  }

  return report;
}

/**
 * Report an error through the durable structured reporter and surface
 * persistence failures to the caller.
 * @param options - Structured error reporting options.
 * @returns StructuredErrorReport once the report is durably persisted or queued.
 * @source
 */
export async function recordStructuredErrorOrThrow(
  options: ReportErrorOptions,
): Promise<StructuredErrorReport> {
  return executeStructuredErrorReport(options);
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
    return await recordStructuredErrorOrThrow(options);
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
    executionEnvironment?: "auto" | "client" | "server";
    retryable?: boolean;
    recoverySuggestions?: RecoverySuggestion[];
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
    executionEnvironment: additionalContext?.executionEnvironment,
    retryable: additionalContext?.retryable,
    recoverySuggestions: additionalContext?.recoverySuggestions,
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
