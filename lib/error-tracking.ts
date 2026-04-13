/**
 * Durable structured error reporting for client and server paths.
 * Reports are normalized through the shared error model, persisted via Redis on
 * the server, and forwarded through a request-proof-protected ingestion route
 * from the client.
 * @source
 */

import { requestClientJson } from "@/lib/api/client-fetch";
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
  sanitizeErrorReportStackTrace,
  sanitizeErrorReportText,
  sanitizeOptionalText,
  truncateText,
} from "@/lib/error-report-sanitization";
import { getStructuredResponseError } from "@/lib/utils";

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
  id?: string;
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
  expiresAt?: number;
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
const ERROR_REPORTS_EVICTED_REPORTS_KEY = `${ERROR_REPORTS_KEY}:evicted:v1`;
const MAX_ERROR_REPORTS = 250;
const ERROR_REPORT_RETENTION_SECONDS = 14 * 24 * 60 * 60;
const ERROR_REPORT_RETENTION_MS = ERROR_REPORT_RETENTION_SECONDS * 1000;
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
const MAX_RECOVERY_SUGGESTION_ACTION_URL_LENGTH = 1024;
const RECOVERY_SUGGESTION_INTERNAL_URL_BASE = "https://anicards.local";
const CLIENT_ERROR_REPORT_DELIVERY_TIMEOUT_MS = 5_000;
const CLIENT_ERROR_REPORT_DURABLE_OUTCOME_USER_ACTION =
  "client_error_report_delivery_outcomes";
const CLIENT_ERROR_REPORT_DURABLE_OUTCOME_MESSAGE =
  "Client error report queue observed local delivery outcomes before durable reporting resumed.";
const MAX_CLIENT_ERROR_REPORT_DURABLE_OUTCOME_SAMPLES = 5;

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
    retainedCount?: number;
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
    Math.max(
      0,
      Math.trunc(
        options?.retainedCount ??
          Math.max(0, normalizedTotalCaptured - normalizedTotalDropped),
      ),
    ),
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

type ClientErrorReportDeliveryOutcomeReason =
  | ClientErrorReportQueueDropReason
  | "non_retryable_delivery";

interface ClientErrorReportQueueTriage {
  source: ErrorReportSource;
  userAction: string;
  category: ErrorCategory;
  route?: string;
  requestId?: string;
  digest?: string;
  statusCode?: number;
  errorName: string;
  technicalMessage: string;
}

interface ClientErrorReportQueueEvent extends ClientErrorReportQueueTriage {
  reason: ClientErrorReportQueueDropReason;
  timestamp: number;
  attempts?: number;
}

interface ClientErrorReportDeliveryOutcomeEvent extends ClientErrorReportQueueTriage {
  reason: ClientErrorReportDeliveryOutcomeReason;
  timestamp: number;
  attempts?: number;
}

interface ClientErrorReportPendingDurableOutcomes {
  nonRetryableDeliveryCount: number;
  queueEvictedCount: number;
  queueExpiredCount: number;
  queueMaxAttemptsCount: number;
  recentOutcomes: ClientErrorReportDeliveryOutcomeEvent[];
}

interface ClientErrorReportQueueStats {
  storage: ClientErrorReportQueueStorageKind;
  totalQueued: number;
  totalDelivered: number;
  totalEvicted: number;
  totalExpired: number;
  totalDroppedAfterMaxAttempts: number;
  totalNonRetryableDeliveryFailures: number;
  totalRateLimited: number;
  recentDrops: ClientErrorReportQueueEvent[];
}

interface ClientErrorReportQueueState {
  version: 2;
  reports: QueuedClientErrorReport[];
  stats: ClientErrorReportQueueStats;
  pendingDurableOutcomes: ClientErrorReportPendingDurableOutcomes;
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
let isFlushingPendingClientErrorReportOutcomes = false;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
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

function sanitizeIncidentId(value: unknown): string | undefined {
  return sanitizeRequestId(value);
}

function normalizeErrorReportTimestamp(value: unknown): number | undefined {
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value <= 0) {
    return undefined;
  }

  return Math.trunc(value);
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

function sanitizeRecoverySuggestionActionUrl(
  value: unknown,
): string | undefined {
  if (typeof value !== "string") {
    return undefined;
  }

  const trimmed = value.trim();
  if (
    trimmed.length === 0 ||
    trimmed.length > MAX_RECOVERY_SUGGESTION_ACTION_URL_LENGTH
  ) {
    return undefined;
  }

  if (trimmed.startsWith("/")) {
    if (trimmed.startsWith("//")) {
      return undefined;
    }

    try {
      const parsed = new URL(trimmed, RECOVERY_SUGGESTION_INTERNAL_URL_BASE);
      return `${parsed.pathname}${parsed.search}${parsed.hash}`;
    } catch {
      return undefined;
    }
  }

  try {
    const parsed = new URL(trimmed);
    return parsed.protocol === "https:" ? parsed.toString() : undefined;
  } catch {
    return undefined;
  }
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
      const actionUrl = sanitizeRecoverySuggestionActionUrl(
        suggestion.actionUrl,
      );

      return [
        {
          title,
          description,
          ...(actionLabel ? { actionLabel } : {}),
          ...(actionUrl ? { actionUrl } : {}),
        } satisfies RecoverySuggestion,
      ];
    });
}

function coerceErrorMessage(error: unknown): string {
  if (error === undefined || error === null) return "Unknown error";
  if (typeof error === "string") return error;
  if (error instanceof Error) return error.message;
  if (
    typeof error === "number" ||
    typeof error === "boolean" ||
    typeof error === "bigint" ||
    typeof error === "symbol"
  ) {
    return String(error);
  }

  try {
    const serialized = JSON.stringify(error);
    if (typeof serialized === "string") {
      return serialized;
    }
  } catch {
    // Ignore serialization failures and fall back to a stable label below.
  }

  if (typeof error === "function") {
    return error.name ? `[Function ${error.name}]` : "[Function]";
  }

  if (Array.isArray(error)) {
    return `[Array(${error.length})]`;
  }

  const constructorName =
    typeof error === "object" && error !== null
      ? error.constructor?.name
      : undefined;
  if (constructorName && constructorName !== "Object") {
    return `[${constructorName}]`;
  }

  return "[Object]";
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
  const sanitizedExplicitStack = sanitizeErrorReportStackTrace(explicitStack, {
    maxLength: MAX_STACK_LENGTH,
  });
  if (sanitizedExplicitStack) {
    return sanitizedExplicitStack;
  }

  return error instanceof Error
    ? sanitizeErrorReportStackTrace(error.stack, {
        maxLength: MAX_STACK_LENGTH,
      })
    : undefined;
}

function buildStructuredErrorReport(
  options: ReportErrorOptions,
): StructuredErrorReport {
  const timestamp =
    normalizeErrorReportTimestamp(options.timestamp) ?? Date.now();
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
    id: sanitizeIncidentId(options.id) ?? crypto.randomUUID(),
    timestamp,
    expiresAt: timestamp + ERROR_REPORT_RETENTION_MS,
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
    componentStack: sanitizeErrorReportStackTrace(options.componentStack, {
      maxLength: MAX_STACK_LENGTH,
    }),
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
    typeof parsedValue.errorName !== "string" ||
    (parsedValue.expiresAt !== undefined &&
      (typeof parsedValue.expiresAt !== "number" ||
        !Number.isFinite(parsedValue.expiresAt)))
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

function isStructuredErrorReportWithinRetentionWindow(
  report: StructuredErrorReport,
  now = Date.now(),
): boolean {
  return typeof report.expiresAt === "number" ? report.expiresAt > now : true;
}

type StoredStructuredErrorReportEntry = {
  report: StructuredErrorReport;
  serialized: string;
};

function toStoredStructuredErrorReportEntry(
  value: unknown,
): StoredStructuredErrorReportEntry | undefined {
  const report = parseStructuredErrorReport(value);
  if (!report) {
    return undefined;
  }

  return {
    report,
    serialized: typeof value === "string" ? value : JSON.stringify(report),
  };
}

function shouldRewriteStructuredErrorReportList(
  currentEntries: unknown[],
  nextEntries: StoredStructuredErrorReportEntry[],
): boolean {
  const serializedCurrentEntries = currentEntries.map((entry) =>
    typeof entry === "string" ? entry : JSON.stringify(entry),
  );

  return (
    serializedCurrentEntries.length !== nextEntries.length ||
    serializedCurrentEntries.some(
      (entry, index) => entry !== nextEntries[index]?.serialized,
    )
  );
}

async function rewriteStructuredErrorReportList(
  key: string,
  entries: StoredStructuredErrorReportEntry[],
): Promise<void> {
  await redisClient.del(key);

  for (const entry of entries) {
    await redisClient.rpush(key, entry.serialized);
  }

  if (entries.length > 0) {
    await redisClient.expire(key, ERROR_REPORT_RETENTION_SECONDS);
  }
}

async function pruneStructuredErrorReportList(
  key: string,
  maxEntries: number,
): Promise<StructuredErrorReport[]> {
  const rawEntries = await redisClient.lrange(key, 0, -1);
  const currentEntries = Array.isArray(rawEntries) ? rawEntries : [];
  const now = Date.now();
  const nextEntries = currentEntries
    .flatMap((entry) => {
      const parsedEntry = toStoredStructuredErrorReportEntry(entry);
      if (!parsedEntry) {
        return [];
      }

      return isStructuredErrorReportWithinRetentionWindow(
        parsedEntry.report,
        now,
      )
        ? [parsedEntry]
        : [];
    })
    .slice(-maxEntries);

  if (shouldRewriteStructuredErrorReportList(currentEntries, nextEntries)) {
    await rewriteStructuredErrorReportList(key, nextEntries);
  } else if (nextEntries.length > 0) {
    await redisClient.expire(key, ERROR_REPORT_RETENTION_SECONDS);
  }

  return nextEntries.map((entry) => entry.report);
}

async function appendEvictedStructuredErrorReports(
  reports: StructuredErrorReport[],
): Promise<void> {
  if (reports.length === 0) {
    return;
  }

  const retainedReports = await pruneStructuredErrorReportList(
    ERROR_REPORTS_EVICTED_REPORTS_KEY,
    MAX_ERROR_REPORTS,
  );
  const nextEntries = [...retainedReports, ...reports]
    .slice(-MAX_ERROR_REPORTS)
    .map(
      (report) =>
        ({
          report,
          serialized: JSON.stringify(report),
        }) satisfies StoredStructuredErrorReportEntry,
    );

  await rewriteStructuredErrorReportList(
    ERROR_REPORTS_EVICTED_REPORTS_KEY,
    nextEntries,
  );
  await redisClient.del(ERROR_REPORTS_EVICTED_SUMMARY_KEY);
}

function buildRecentEvictedErrorReportTriageSummary(
  reports: StructuredErrorReport[],
): ErrorReportTriageSummary & {
  updatedAt?: number;
} {
  const summary = buildErrorReportTriageSummaryFromReports(reports);
  const updatedAt = reports.reduce(
    (latestTimestamp, report) => Math.max(latestTimestamp, report.timestamp),
    0,
  );

  return updatedAt > 0 ? { ...summary, updatedAt } : summary;
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
    statusCode: report.statusCode,
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
    ...(typeof value.statusCode === "number" &&
    Number.isInteger(value.statusCode) &&
    value.statusCode >= 400 &&
    value.statusCode <= 599
      ? { statusCode: value.statusCode }
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
      statusCode:
        typeof parsed.statusCode === "number" &&
        Number.isInteger(parsed.statusCode) &&
        parsed.statusCode >= 400 &&
        parsed.statusCode <= 599
          ? parsed.statusCode
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
    totalNonRetryableDeliveryFailures: 0,
    totalRateLimited: 0,
    recentDrops: [],
  };
}

function buildEmptyClientErrorReportPendingDurableOutcomes(): ClientErrorReportPendingDurableOutcomes {
  return {
    nonRetryableDeliveryCount: 0,
    queueEvictedCount: 0,
    queueExpiredCount: 0,
    queueMaxAttemptsCount: 0,
    recentOutcomes: [],
  };
}

function buildClientErrorReportQueueState(
  storage: ClientErrorReportQueueStorageKind,
): ClientErrorReportQueueState {
  return {
    version: 2,
    reports: [],
    stats: createClientErrorReportQueueStats(storage),
    pendingDurableOutcomes: buildEmptyClientErrorReportPendingDurableOutcomes(),
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
    totalNonRetryableDeliveryFailures:
      typeof value.totalNonRetryableDeliveryFailures === "number" &&
      Number.isFinite(value.totalNonRetryableDeliveryFailures)
        ? Math.max(0, Math.trunc(value.totalNonRetryableDeliveryFailures))
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

function parseClientErrorReportDeliveryOutcomeEvent(
  value: unknown,
): ClientErrorReportDeliveryOutcomeEvent | undefined {
  if (!isRecord(value)) {
    return undefined;
  }

  const triage = parseClientErrorReportQueueTriage(value);
  if (!triage) {
    return undefined;
  }

  const reason =
    typeof value.reason === "string"
      ? (value.reason as ClientErrorReportDeliveryOutcomeReason)
      : undefined;
  const timestamp =
    typeof value.timestamp === "number" && Number.isFinite(value.timestamp)
      ? Math.max(0, Math.trunc(value.timestamp))
      : undefined;

  if (!reason || !timestamp) {
    return undefined;
  }

  return {
    ...triage,
    reason,
    timestamp,
    ...(typeof value.attempts === "number" &&
    Number.isInteger(value.attempts) &&
    value.attempts >= 0
      ? { attempts: Math.trunc(value.attempts) }
      : {}),
  };
}

function parseClientErrorReportPendingDurableOutcomes(
  value: unknown,
): ClientErrorReportPendingDurableOutcomes {
  if (!isRecord(value)) {
    return buildEmptyClientErrorReportPendingDurableOutcomes();
  }

  const recentOutcomes = Array.isArray(value.recentOutcomes)
    ? value.recentOutcomes
        .map((entry) => parseClientErrorReportDeliveryOutcomeEvent(entry))
        .filter(
          (entry): entry is ClientErrorReportDeliveryOutcomeEvent =>
            entry !== undefined,
        )
        .slice(0, MAX_CLIENT_ERROR_REPORT_DURABLE_OUTCOME_SAMPLES)
    : [];

  return {
    nonRetryableDeliveryCount:
      typeof value.nonRetryableDeliveryCount === "number" &&
      Number.isFinite(value.nonRetryableDeliveryCount)
        ? Math.max(0, Math.trunc(value.nonRetryableDeliveryCount))
        : 0,
    queueEvictedCount:
      typeof value.queueEvictedCount === "number" &&
      Number.isFinite(value.queueEvictedCount)
        ? Math.max(0, Math.trunc(value.queueEvictedCount))
        : 0,
    queueExpiredCount:
      typeof value.queueExpiredCount === "number" &&
      Number.isFinite(value.queueExpiredCount)
        ? Math.max(0, Math.trunc(value.queueExpiredCount))
        : 0,
    queueMaxAttemptsCount:
      typeof value.queueMaxAttemptsCount === "number" &&
      Number.isFinite(value.queueMaxAttemptsCount)
        ? Math.max(0, Math.trunc(value.queueMaxAttemptsCount))
        : 0,
    recentOutcomes,
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
  state.pendingDurableOutcomes = parseClientErrorReportPendingDurableOutcomes(
    rawValue.pendingDurableOutcomes,
  );
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

function appendClientErrorReportDeliveryOutcomeEvent(
  events: ClientErrorReportDeliveryOutcomeEvent[],
  event: ClientErrorReportDeliveryOutcomeEvent,
): ClientErrorReportDeliveryOutcomeEvent[] {
  return [event, ...events].slice(
    0,
    MAX_CLIENT_ERROR_REPORT_DURABLE_OUTCOME_SAMPLES,
  );
}

function hasPendingClientErrorReportDeliveryOutcomes(
  pendingDurableOutcomes: ClientErrorReportPendingDurableOutcomes,
): boolean {
  return (
    pendingDurableOutcomes.nonRetryableDeliveryCount > 0 ||
    pendingDurableOutcomes.queueEvictedCount > 0 ||
    pendingDurableOutcomes.queueExpiredCount > 0 ||
    pendingDurableOutcomes.queueMaxAttemptsCount > 0 ||
    pendingDurableOutcomes.recentOutcomes.length > 0
  );
}

function recordClientErrorReportPendingDurableOutcome(
  state: ClientErrorReportQueueState,
  event: ClientErrorReportDeliveryOutcomeEvent,
): void {
  switch (event.reason) {
    case "non_retryable_delivery":
      state.pendingDurableOutcomes.nonRetryableDeliveryCount += 1;
      break;
    case "queue_evicted":
      state.pendingDurableOutcomes.queueEvictedCount += 1;
      break;
    case "queue_expired":
      state.pendingDurableOutcomes.queueExpiredCount += 1;
      break;
    case "max_attempts":
      state.pendingDurableOutcomes.queueMaxAttemptsCount += 1;
      break;
  }

  state.pendingDurableOutcomes.recentOutcomes =
    appendClientErrorReportDeliveryOutcomeEvent(
      state.pendingDurableOutcomes.recentOutcomes,
      event,
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
  recordClientErrorReportPendingDurableOutcome(state, event);
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
    state.stats.totalNonRetryableDeliveryFailures > 0 ||
    state.stats.totalRateLimited > 0 ||
    state.stats.recentDrops.length > 0 ||
    hasPendingClientErrorReportDeliveryOutcomes(state.pendingDurableOutcomes)
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
    writeClientErrorReportQueueStateToStorage(fallbackHandle, store.state);
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
    clientQueueTotalNonRetryableDeliveryFailures:
      state.stats.totalNonRetryableDeliveryFailures,
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
    id: report.id,
    timestamp: report.timestamp,
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

  const message = coerceErrorMessage(error);

  return new ClientErrorReportDeliveryError(message, {
    retryable: isRetryableClientErrorReportTransportFailure(error),
    cause: error,
  });
}

async function createClientErrorReportResponseError(
  response: Response,
  payload: unknown,
): Promise<ClientErrorReportDeliveryError> {
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

      const { response, payload } = await requestClientJson(
        CLIENT_ERROR_REPORTS_ENDPOINT,
        {
          method: "POST",
          headers,
          body: report.body,
          credentials: "same-origin",
          keepalive: true,
          timeoutMs: CLIENT_ERROR_REPORT_DELIVERY_TIMEOUT_MS,
        },
      );

      if (response.ok) {
        return;
      }

      lastError = await createClientErrorReportResponseError(response, payload);
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

function buildClientErrorReportDeliveryOutcomeSummaryMetadata(
  pendingDurableOutcomes: ClientErrorReportPendingDurableOutcomes,
): Record<string, SerializableMetadataValue> {
  const metadata: Record<string, SerializableMetadataValue> = {
    clientDeliveryOutcomeNonRetryableCount:
      pendingDurableOutcomes.nonRetryableDeliveryCount,
    clientDeliveryOutcomeQueueEvictedCount:
      pendingDurableOutcomes.queueEvictedCount,
    clientDeliveryOutcomeQueueExpiredCount:
      pendingDurableOutcomes.queueExpiredCount,
    clientDeliveryOutcomeQueueMaxAttemptsCount:
      pendingDurableOutcomes.queueMaxAttemptsCount,
    clientDeliveryOutcomeRecentCount:
      pendingDurableOutcomes.recentOutcomes.length,
  };

  pendingDurableOutcomes.recentOutcomes.forEach((outcome, index) => {
    const prefix = `clientDeliveryOutcome${index + 1}`;

    metadata[`${prefix}Reason`] = outcome.reason;
    metadata[`${prefix}Source`] = outcome.source;
    metadata[`${prefix}UserAction`] = outcome.userAction;
    metadata[`${prefix}Category`] = outcome.category;
    metadata[`${prefix}ErrorName`] = outcome.errorName;
    metadata[`${prefix}Timestamp`] = outcome.timestamp;

    if (typeof outcome.statusCode === "number") {
      metadata[`${prefix}StatusCode`] = outcome.statusCode;
    }

    if (typeof outcome.attempts === "number") {
      metadata[`${prefix}Attempts`] = outcome.attempts;
    }

    if (typeof outcome.requestId === "string") {
      metadata[`${prefix}RequestId`] = outcome.requestId;
    }

    if (typeof outcome.route === "string") {
      metadata[`${prefix}Route`] = outcome.route;
    }
  });

  return metadata;
}

function buildClientErrorReportDeliveryOutcomeSummaryReport(
  pendingDurableOutcomes: ClientErrorReportPendingDurableOutcomes,
): StructuredErrorReport {
  return buildStructuredErrorReport({
    source: "client_hook",
    userAction: CLIENT_ERROR_REPORT_DURABLE_OUTCOME_USER_ACTION,
    error: CLIENT_ERROR_REPORT_DURABLE_OUTCOME_MESSAGE,
    category: "unknown",
    retryable: false,
    metadata: buildClientErrorReportDeliveryOutcomeSummaryMetadata(
      pendingDurableOutcomes,
    ),
  });
}

function recordNonRetryableClientErrorReportDeliveryOutcome(
  report: StructuredErrorReport,
  deliveryError: ClientErrorReportDeliveryError,
): void {
  const store = loadClientErrorReportQueueStore();
  if (!store) {
    return;
  }

  store.state.stats.totalNonRetryableDeliveryFailures += 1;
  recordClientErrorReportPendingDurableOutcome(store.state, {
    ...buildClientErrorReportQueueTriage(report),
    reason: "non_retryable_delivery",
    timestamp: Date.now(),
    ...(typeof deliveryError.statusCode === "number"
      ? { statusCode: deliveryError.statusCode }
      : {}),
  });
  saveClientErrorReportQueueStore(store);
}

async function flushPendingClientErrorReportOutcomes(): Promise<void> {
  if (
    isFlushingPendingClientErrorReportOutcomes ||
    !canUseClientErrorReportQueue()
  ) {
    return;
  }

  const store = loadClientErrorReportQueueStore();
  if (
    !store ||
    !hasPendingClientErrorReportDeliveryOutcomes(
      store.state.pendingDurableOutcomes,
    )
  ) {
    return;
  }

  isFlushingPendingClientErrorReportOutcomes = true;

  try {
    const summaryReport = buildClientErrorReportDeliveryOutcomeSummaryReport(
      store.state.pendingDurableOutcomes,
    );

    await deliverClientErrorReport(
      buildClientErrorReportBody(summaryReport),
      1,
    );

    store.state.pendingDurableOutcomes =
      buildEmptyClientErrorReportPendingDurableOutcomes();
    saveClientErrorReportQueueStore(store);
  } catch (error) {
    if (process.env.NODE_ENV === "development") {
      console.error(
        "[ErrorTracking] Failed to flush pending client error report delivery outcomes.",
        error,
      );
    }
  } finally {
    isFlushingPendingClientErrorReportOutcomes = false;
  }
}

export async function flushClientErrorReportBacklog(): Promise<void> {
  if (!canUseClientErrorReportQueue()) {
    return;
  }

  await flushQueuedClientErrorReports();
  await flushPendingClientErrorReportOutcomes();
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

async function persistStructuredErrorBufferEntry(
  report: StructuredErrorReport,
): Promise<void> {
  await pruneStructuredErrorReportList(ERROR_REPORTS_KEY, MAX_ERROR_REPORTS);

  const persistedLength = await redisClient.rpush(
    ERROR_REPORTS_KEY,
    JSON.stringify(report),
  );

  let evictedReports: StructuredErrorReport[] = [];

  if (persistedLength > MAX_ERROR_REPORTS) {
    const overflowCount = persistedLength - MAX_ERROR_REPORTS;
    const evictedEntriesRaw = await redisClient.lrange(
      ERROR_REPORTS_KEY,
      0,
      overflowCount - 1,
    );
    evictedReports = Array.isArray(evictedEntriesRaw)
      ? evictedEntriesRaw
          .map((entry) => parseStructuredErrorReport(entry))
          .filter(
            (entry): entry is StructuredErrorReport => entry !== undefined,
          )
      : [];
  }

  await redisClient.ltrim(ERROR_REPORTS_KEY, -MAX_ERROR_REPORTS, -1);
  await redisClient.expire(ERROR_REPORTS_KEY, ERROR_REPORT_RETENTION_SECONDS);

  try {
    await appendEvictedStructuredErrorReports(evictedReports);
  } catch (error) {
    logPrivacySafe(
      "warn",
      "ErrorTracking",
      "Failed to persist recent evicted error reports",
      {
        error: error instanceof Error ? error.message : String(error),
      },
    );
  }

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
  const [retainedReports, evictedReports] = await Promise.all([
    pruneStructuredErrorReportList(ERROR_REPORTS_KEY, MAX_ERROR_REPORTS),
    pruneStructuredErrorReportList(
      ERROR_REPORTS_EVICTED_REPORTS_KEY,
      MAX_ERROR_REPORTS,
    ),
  ]);
  const [[totalCapturedRaw, totalDroppedRaw], evictedTriageRaw] =
    await Promise.all([
      redisClient.mget(ERROR_REPORTS_TOTAL_KEY, ERROR_REPORTS_DROPPED_KEY),
      redisClient.get(ERROR_REPORTS_EVICTED_SUMMARY_KEY),
    ]);

  const evictedTriage =
    evictedReports.length > 0
      ? buildRecentEvictedErrorReportTriageSummary(evictedReports)
      : (() => {
          const evictedTriageState =
            parseStoredErrorReportTriageState(evictedTriageRaw);

          return {
            ...toErrorReportTriageSummary(evictedTriageState),
            ...(evictedTriageState.updatedAt > 0
              ? { updatedAt: evictedTriageState.updatedAt }
              : {}),
          };
        })();

  return buildErrorReportBufferSnapshot(
    parseRedisCounter(totalCapturedRaw),
    parseRedisCounter(totalDroppedRaw),
    {
      retainedCount: retainedReports.length,
      retainedTriage: buildErrorReportTriageSummaryFromReports(retainedReports),
      evictedTriage,
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
    await flushPendingClientErrorReportOutcomes();
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
    } else {
      recordNonRetryableClientErrorReportDeliveryOutcome(report, deliveryError);
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
    logPrivacySafe(
      "error",
      "ErrorTracking",
      "Failed to report structured error",
      {
        source: options.source,
        userAction: options.userAction,
        category: options.category,
        requestId: options.requestId,
        route: options.route,
        error,
        ...(error instanceof Error && error.stack
          ? { stack: error.stack }
          : {}),
      },
    );

    if (process.env.NODE_ENV === "development") {
      console.error(
        "[ErrorTracking] Failed to report structured error:",
        error,
      );
    }
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
