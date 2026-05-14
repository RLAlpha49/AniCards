import type { Redis as UpstashRedis } from "@upstash/redis";

import { redisClient } from "@/lib/api/clients";
import { apiJsonHeaders } from "@/lib/api/cors";
import { apiErrorResponse } from "@/lib/api/errors";
import { logPrivacySafe } from "@/lib/api/logging";
import { initializeApiRequest } from "@/lib/api/request-guards";
import {
  ANALYTICS_REPORTING_INDEX_KEY,
  buildAnalyticsMetricKey,
  buildFailedRequestMetricKeys,
  buildLatencyBucketMetricKeys,
  buildReasonCodedMetricKey,
  type CronRefreshBatchTelemetrySnapshot,
  isExcludedAnalyticsReportStateKey,
  readCronRefreshBatchTelemetrySnapshotResult,
  readTelemetryWriteHealthSnapshotResult,
  scheduleAnalyticsBatch,
  scheduleLowValueAnalyticsBatch,
  type TelemetrySnapshotReadResult,
  type TelemetryWriteHealthSnapshot,
} from "@/lib/api/telemetry";
import {
  authorizeCronRequest,
  fetchUpstreamWithRetry,
} from "@/lib/api/upstream";
import {
  type ErrorReportBreakdownBucket,
  type ErrorReportBufferSnapshot,
  type ErrorReportRollingWindowSnapshot,
  type ErrorReportTriageSample,
  type ErrorReportTriageSummary,
  getErrorReportBufferSnapshot,
} from "@/lib/error-tracking";
import { safeParse } from "@/lib/utils";

type AnalyticsScalar = boolean | null | number | string;

type AnalyticsMetricValue =
  | AnalyticsMetricValue[]
  | AnalyticsScalar
  | { [key: string]: AnalyticsMetricValue };

type AnalyticsData = Record<string, AnalyticsMetricValue>;
type AnalyticsMetricGroup = Record<string, AnalyticsMetricValue>;
type AnalyticsSummary = Record<
  string,
  AnalyticsMetricGroup | AnalyticsMetricValue
>;

interface AnalyticsReportMeta {
  alertDelivery: ErrorSpikeAlertDelivery;
  durationMs: number;
  operationId?: string;
  requestId?: string;
}

interface AnalyticsDataReadResult {
  analyticsData: AnalyticsData;
  rollup: AnalyticsMetricGroup;
}

type ErrorSpikeAlertComparisonWindow =
  | "report_interval"
  | "rolling_24h"
  | "unavailable";

interface AnalyticsReportResponse {
  generatedAt: string;
  raw_data?: AnalyticsData;
  reportMeta: AnalyticsReportMeta;
  summary: AnalyticsSummary;
}

interface StoredAnalyticsReport {
  generatedAt: string;
  reportMeta: AnalyticsReportMeta;
  summary: AnalyticsSummary;
}

interface AnalyticsReportListResponse {
  count: number;
  reports: StoredAnalyticsReport[];
  retentionLimit: number;
}

type ErrorSpikeAlertReason = "error_spike" | "ring_buffer_saturation";

const ERROR_SPIKE_ALERT_REASON_ORDER = {
  error_spike: 0,
  ring_buffer_saturation: 1,
} as const satisfies Record<ErrorSpikeAlertReason, number>;

interface ErrorSpikeAlertDelivery {
  attempted: boolean;
  delivered: boolean;
  destinationHost?: string;
  failure?: string;
  fingerprint?: string;
  skippedReason?: string;
  statusCode?: number;
  suppressedUntil?: string;
}

interface ErrorSpikeAlertSummary {
  webhookConfigured: boolean;
  baselineAvailable: boolean;
  comparisonWindow: ErrorSpikeAlertComparisonWindow;
  triggered: boolean;
  reasons: ErrorSpikeAlertReason[];
  minNewReportsThreshold: number;
  newCapturedSinceLastReport: number | null;
  newDroppedSinceLastReport: number | null;
  intervalSaturationRate: number | null;
  delivery: ErrorSpikeAlertDelivery;
}

const ANALYTICS_REPORTS_KEY = "analytics:reports";
const DEFAULT_REPORT_READ_LIMIT = 10;
const MAX_STORED_ANALYTICS_REPORTS = 50;
const MAX_ANALYTICS_REPORTING_KEYS = 200;
const ANALYTICS_REPORT_RETENTION_SECONDS = 14 * 24 * 60 * 60;
const ANALYTICS_REPORT_RETENTION_MS = ANALYTICS_REPORT_RETENTION_SECONDS * 1000;
const DEFAULT_ERROR_SPIKE_MIN_NEW_REPORTS = 25;
const ERROR_ALERT_TIMEOUT_MS = 4_000;
const ERROR_ALERT_WEBHOOK_ENV_NAME = "ERROR_ALERT_WEBHOOK_URL";
const ERROR_ALERT_SUPPRESSION_TTL_SECONDS = 2 * 60 * 60;

/**
 * Validates the cron secret header and returns an error response on failure.
 * @param request - Incoming request whose headers provide the cron secret.
 * @returns Response when authorization fails or null when allowed.
 * @source
 */
function checkCronAuthorization(request: Request): Response | null {
  return authorizeCronRequest(request, "Analytics & Reporting");
}

/**
 * Collects stored analytics metrics from Redis, mapping missing values to zero.
 * @param redisClient - Redis client used to read analytics keys.
 * @returns Mapping of analytics keys to their numeric values.
 * @source
 */
async function fetchAnalyticsData(
  redisClient: UpstashRedis,
  options?: {
    endpoint?: string;
    request?: Request;
  },
): Promise<AnalyticsDataReadResult> {
  const analyticsKeys = (
    await redisClient.smembers(ANALYTICS_REPORTING_INDEX_KEY)
  )
    .filter(
      (key) =>
        key !== ANALYTICS_REPORTING_INDEX_KEY && key !== ANALYTICS_REPORTS_KEY,
    )
    .filter((key) => !isExcludedAnalyticsReportStateKey(key))
    .sort();

  const boundedAnalyticsKeys = analyticsKeys.slice(
    0,
    MAX_ANALYTICS_REPORTING_KEYS,
  );
  const truncatedKeyCount = Math.max(
    0,
    analyticsKeys.length - boundedAnalyticsKeys.length,
  );

  if (boundedAnalyticsKeys.length === 0) {
    return {
      analyticsData: {},
      rollup: {
        degraded: false,
        includedKeyCount: 0,
        staleKeyCount: 0,
        state: "ok",
        totalIndexedKeyCount: analyticsKeys.length,
        truncatedKeyCount,
      },
    };
  }

  const values = await redisClient.mget(...boundedAnalyticsKeys);

  const staleAnalyticsKeys = boundedAnalyticsKeys.filter(
    (_, index) => values[index] === null || values[index] === undefined,
  );

  if (staleAnalyticsKeys.length > 0) {
    try {
      await redisClient.srem(
        ANALYTICS_REPORTING_INDEX_KEY,
        ...staleAnalyticsKeys,
      );
    } catch (error) {
      logPrivacySafe(
        "warn",
        options?.endpoint ?? "Analytics & Reporting",
        "Failed to prune stale analytics index members",
        {
          staleKeyCount: staleAnalyticsKeys.length,
          error: error instanceof Error ? error.message : String(error),
        },
        options?.request,
      );
    }
  }

  return {
    analyticsData: Object.fromEntries(
      boundedAnalyticsKeys.map((key, index) => [
        key,
        parseAnalyticsValue(values[index]),
      ]),
    ),
    rollup: {
      degraded: truncatedKeyCount > 0,
      ...(truncatedKeyCount > 0 ? { failure: "analytics_index_bounded" } : {}),
      includedKeyCount: boundedAnalyticsKeys.length,
      staleKeyCount: staleAnalyticsKeys.length,
      state: truncatedKeyCount > 0 ? "degraded" : "ok",
      totalIndexedKeyCount: analyticsKeys.length,
      truncatedKeyCount,
    },
  };
}

/**
 * Normalizes a stored Redis analytics value into the report payload shape.
 */
function parseAnalyticsValue(value: unknown): AnalyticsMetricValue {
  if (value === null || value === undefined) {
    return 0;
  }

  if (
    typeof value === "boolean" ||
    typeof value === "number" ||
    typeof value === "object"
  ) {
    return value as AnalyticsMetricValue;
  }

  const numericValue = Number(value);
  if (!Number.isNaN(numericValue)) {
    return numericValue;
  }

  return safeParse<AnalyticsMetricValue>(value, "analytics-reporting");
}

/**
 * Reformats analytics rows by service and metric identifiers for reporting.
 * @param analyticsData - Flat mapping of analytics key strings to numeric values.
 * @returns Nested summary grouped by service and metric names.
 * @source
 */
function groupAnalyticsData(analyticsData: AnalyticsData): AnalyticsSummary {
  const summary: AnalyticsSummary = {};

  for (const [key, value] of Object.entries(analyticsData)) {
    const parts = key.split(":");

    if (parts.length === 2) {
      summary[parts[1]] = value;
    } else if (parts.length >= 3) {
      const service = parts[1];
      const metric = parts.slice(2).join(":");
      const existingGroup = summary[service];
      if (
        !existingGroup ||
        typeof existingGroup !== "object" ||
        Array.isArray(existingGroup)
      ) {
        summary[service] = {};
      }

      (summary[service] as AnalyticsMetricGroup)[metric] = value;
    }
  }

  return summary;
}

function shouldIncludeRawAnalyticsData(request: Request): boolean {
  const includeRawParam = new URL(request.url).searchParams.get("includeRaw");

  return includeRawParam === "1" || includeRawParam === "true";
}

function buildTelemetryReadMetricGroup<TSnapshot>(
  readResult: TelemetrySnapshotReadResult<TSnapshot>,
  snapshotGroup: AnalyticsMetricGroup,
): AnalyticsMetricGroup {
  if (!readResult.degraded) {
    return {
      ...snapshotGroup,
      state: "ok",
    };
  }

  return {
    ...snapshotGroup,
    degraded: true,
    ...(readResult.failure ? { failure: readResult.failure } : {}),
    state: "degraded",
  };
}

function buildRefreshBatchMetricGroup(
  readResult: TelemetrySnapshotReadResult<CronRefreshBatchTelemetrySnapshot>,
): AnalyticsMetricGroup {
  if (readResult.snapshot) {
    return buildTelemetryReadMetricGroup(
      readResult,
      toCronRefreshBatchMetricGroup(readResult.snapshot),
    );
  }

  if (readResult.degraded) {
    return {
      degraded: true,
      ...(readResult.failure ? { failure: readResult.failure } : {}),
      state: "degraded",
    };
  }

  return {
    state: "unavailable",
  };
}

function trackAlertDeliveryDegradation(
  request: Request,
  delivery: ErrorSpikeAlertDelivery,
): void {
  if (!delivery.attempted || delivery.delivered) {
    return;
  }

  const failureReason = delivery.failure ?? delivery.skippedReason ?? "unknown";
  const metrics = [
    buildAnalyticsMetricKey("analytics_reporting", "alert_delivery_failures"),
    buildReasonCodedMetricKey(
      "analytics_reporting",
      "alert_delivery_failures",
      failureReason,
    ),
  ];

  scheduleLowValueAnalyticsBatch(metrics, {
    endpoint: "Analytics & Reporting",
    request,
    taskName: metrics[0],
  });

  logPrivacySafe(
    "warn",
    "Analytics & Reporting",
    "Analytics alert delivery degraded while cron reporting still succeeded",
    {
      destinationHost: delivery.destinationHost,
      failure: delivery.failure,
      skippedReason: delivery.skippedReason,
      statusCode: delivery.statusCode,
    },
    request,
  );
}

function roundRatio(value: number): number {
  return Number(value.toFixed(4));
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function parseFiniteNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }

  return null;
}

function parseErrorSpikeThreshold(): number {
  const raw = process.env.ERROR_ALERT_MIN_NEW_REPORTS?.trim();
  if (!raw) return DEFAULT_ERROR_SPIKE_MIN_NEW_REPORTS;

  const parsed = Number.parseInt(raw, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return DEFAULT_ERROR_SPIKE_MIN_NEW_REPORTS;
  }

  return parsed;
}

type ErrorReportBufferReadResult =
  | {
      degraded: false;
      snapshot: ErrorReportBufferSnapshot;
    }
  | {
      degraded: true;
      failure: string;
    };

function buildUnavailableErrorSpikeAlertSummary(options: {
  skippedReason: string;
  webhookConfigured: boolean;
}): ErrorSpikeAlertSummary {
  return {
    webhookConfigured: options.webhookConfigured,
    baselineAvailable: false,
    comparisonWindow: "unavailable",
    triggered: false,
    reasons: [],
    minNewReportsThreshold: parseErrorSpikeThreshold(),
    newCapturedSinceLastReport: null,
    newDroppedSinceLastReport: null,
    intervalSaturationRate: null,
    delivery: {
      attempted: false,
      delivered: false,
      skippedReason: options.skippedReason,
    },
  };
}

function buildAnalyticsReportMeta(options: {
  alertDelivery: ErrorSpikeAlertDelivery;
  durationMs: number;
  operationId?: string;
  requestId?: string;
}): AnalyticsReportMeta {
  return {
    alertDelivery: options.alertDelivery,
    durationMs: Math.max(0, Math.trunc(options.durationMs)),
    ...(options.operationId ? { operationId: options.operationId } : {}),
    ...(options.requestId ? { requestId: options.requestId } : {}),
  };
}

function hashString(value: string): string {
  let hash = 2166136261;

  for (let index = 0; index < value.length; ) {
    const codePoint = value.codePointAt(index);
    if (codePoint === undefined) {
      break;
    }

    hash ^= codePoint;
    hash = Math.imul(hash, 16777619);
    index += codePoint > 0xffff ? 2 : 1;
  }

  return (hash >>> 0).toString(16).padStart(8, "0");
}

function buildErrorSpikeAlertFingerprint(options: {
  snapshot: ErrorReportBufferSnapshot;
  summary: ErrorSpikeAlertSummary;
}): string {
  return `alert_${hashString(
    JSON.stringify({
      comparisonWindow: options.summary.comparisonWindow,
      cumulativeDropped: options.snapshot.totalDropped,
      cumulativeRetained: options.snapshot.retained,
      cumulativeTotalCaptured: options.snapshot.totalCaptured,
      intervalCaptured: options.summary.newCapturedSinceLastReport,
      intervalDropped: options.summary.newDroppedSinceLastReport,
      reasons: [...options.summary.reasons].sort(
        (left, right) =>
          ERROR_SPIKE_ALERT_REASON_ORDER[left] -
          ERROR_SPIKE_ALERT_REASON_ORDER[right],
      ),
      rollingWindowEnd: options.snapshot.rollingWindow.windowEnd,
    }),
  )}`;
}

function buildErrorAlertSuppressionKey(fingerprint: string): string {
  return `analytics:error-alert:fingerprint:${fingerprint}`;
}

function parseStoredErrorAlertSuppression(
  value: unknown,
): { suppressedUntil?: string } | null {
  let parsedValue = value;

  if (typeof parsedValue === "string") {
    try {
      parsedValue = JSON.parse(parsedValue) as unknown;
    } catch {
      return null;
    }
  }

  if (!isPlainObject(parsedValue)) {
    return null;
  }

  const suppressedUntil =
    typeof parsedValue.suppressedUntil === "string" &&
    Number.isFinite(Date.parse(parsedValue.suppressedUntil))
      ? parsedValue.suppressedUntil
      : undefined;

  return suppressedUntil ? { suppressedUntil } : null;
}

async function readErrorAlertSuppressionState(
  redisClient: UpstashRedis,
  fingerprint: string,
  options: {
    endpoint: string;
    request: Request;
  },
): Promise<{ suppressedUntil?: string } | null> {
  try {
    return parseStoredErrorAlertSuppression(
      await redisClient.get(buildErrorAlertSuppressionKey(fingerprint)),
    );
  } catch (error) {
    logPrivacySafe(
      "warn",
      options.endpoint,
      "Failed to read error alert suppression state; continuing without duplicate suppression",
      {
        fingerprint,
        error: error instanceof Error ? error.message : String(error),
      },
      options.request,
    );
    return null;
  }
}

async function persistErrorAlertSuppressionState(
  redisClient: UpstashRedis,
  fingerprint: string,
  options: {
    endpoint: string;
    request: Request;
  },
): Promise<{ suppressedUntil: string } | null> {
  const suppressedUntil = new Date(
    Date.now() + ERROR_ALERT_SUPPRESSION_TTL_SECONDS * 1000,
  ).toISOString();

  try {
    await redisClient.set(
      buildErrorAlertSuppressionKey(fingerprint),
      JSON.stringify({ suppressedUntil }),
      {
        ex: ERROR_ALERT_SUPPRESSION_TTL_SECONDS,
      },
    );
    return { suppressedUntil };
  } catch (error) {
    logPrivacySafe(
      "warn",
      options.endpoint,
      "Failed to persist error alert suppression fingerprint",
      {
        fingerprint,
        error: error instanceof Error ? error.message : String(error),
      },
      options.request,
    );
    return null;
  }
}

function createEmptyErrorReportRollingWindowSnapshot(): ErrorReportRollingWindowSnapshot {
  const now = Date.now();
  const bucketSizeMs = 60 * 60 * 1000;
  const bucketCount = 24;
  const windowEnd =
    Math.floor(now / bucketSizeMs) * bucketSizeMs + bucketSizeMs;

  return {
    bucketSizeMs,
    bucketCount,
    windowStart: windowEnd - bucketSizeMs * bucketCount,
    windowEnd,
    totalCaptured: 0,
    totalDropped: 0,
    saturationRate: 0,
  };
}

function createEmptyErrorReportTriageSummary(): ErrorReportTriageSummary {
  return {
    totalReports: 0,
    topRoutes: [],
    topCategories: [],
    topSources: [],
    topUserActions: [],
    recentReports: [],
  };
}

function parseErrorReportBufferSnapshot(
  value: unknown,
): ErrorReportBufferSnapshot | null {
  if (!isPlainObject(value)) {
    return null;
  }

  const capacity = parseFiniteNumber(value.capacity);
  const retained = parseFiniteNumber(value.retained);
  const totalCaptured = parseFiniteNumber(value.totalCaptured);
  const totalDropped = parseFiniteNumber(value.totalDropped);

  if (
    capacity === null ||
    retained === null ||
    totalCaptured === null ||
    totalDropped === null
  ) {
    return null;
  }

  return {
    capacity: Math.max(0, Math.trunc(capacity)),
    retained: Math.max(0, Math.trunc(retained)),
    totalCaptured: Math.max(0, Math.trunc(totalCaptured)),
    totalDropped: Math.max(0, Math.trunc(totalDropped)),
    cumulativeSaturationRate:
      totalCaptured <= 0 ? 0 : roundRatio(totalDropped / totalCaptured),
    rollingWindow: createEmptyErrorReportRollingWindowSnapshot(),
    retainedTriage: createEmptyErrorReportTriageSummary(),
    evictedTriage: createEmptyErrorReportTriageSummary(),
  };
}

function getPreviousErrorReportBufferSnapshot(
  summary: AnalyticsSummary | undefined,
): ErrorReportBufferSnapshot | null {
  if (!summary) {
    return null;
  }

  const observability = summary.observability;
  if (!isPlainObject(observability)) {
    return null;
  }

  return parseErrorReportBufferSnapshot(observability.errorReports);
}

function isDisallowedWebhookHost(hostname: string): boolean {
  const normalized = hostname.trim().toLowerCase();
  if (!normalized) return true;

  if (
    normalized === "localhost" ||
    normalized.endsWith(".local") ||
    normalized.endsWith(".internal")
  ) {
    return true;
  }

  if (/^\d{1,3}(?:\.\d{1,3}){3}$/.test(normalized)) {
    return true;
  }

  return normalized.includes(":");
}

function getConfiguredAlertWebhook(
  endpoint: string,
  request: Request,
): { url: string; destinationHost: string } | null {
  const rawWebhookUrl = process.env[ERROR_ALERT_WEBHOOK_ENV_NAME]?.trim();
  if (!rawWebhookUrl) {
    return null;
  }

  let parsedWebhookUrl: URL;
  try {
    parsedWebhookUrl = new URL(rawWebhookUrl);
  } catch {
    logPrivacySafe(
      "warn",
      endpoint,
      "Skipping error spike alert because webhook configuration is invalid",
      {
        config: ERROR_ALERT_WEBHOOK_ENV_NAME,
      },
      request,
    );
    return null;
  }

  if (
    parsedWebhookUrl.protocol !== "https:" ||
    parsedWebhookUrl.username ||
    parsedWebhookUrl.password ||
    (parsedWebhookUrl.port && parsedWebhookUrl.port !== "443") ||
    isDisallowedWebhookHost(parsedWebhookUrl.hostname)
  ) {
    logPrivacySafe(
      "warn",
      endpoint,
      "Skipping error spike alert because webhook configuration failed validation",
      {
        config: ERROR_ALERT_WEBHOOK_ENV_NAME,
        destinationHost: parsedWebhookUrl.hostname,
      },
      request,
    );
    return null;
  }

  return {
    url: parsedWebhookUrl.toString(),
    destinationHost: parsedWebhookUrl.hostname,
  };
}

function buildAlertSkippedReason(options: {
  hasReasons: boolean;
  webhookConfigured: boolean;
}): string {
  if (!options.hasReasons) {
    return "not_triggered";
  }

  if (!options.webhookConfigured) {
    return "webhook_not_configured";
  }

  return "delivery_pending";
}

function parseTimestampMs(value: string | undefined): number | null {
  if (typeof value !== "string" || value.length === 0) {
    return null;
  }

  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function hasRecentReportBaseline(options: {
  previousReportGeneratedAt?: string;
  rollingWindow: ErrorReportRollingWindowSnapshot;
  now?: number;
}): boolean {
  const previousGeneratedAtMs = parseTimestampMs(
    options.previousReportGeneratedAt,
  );
  if (previousGeneratedAtMs === null) {
    return false;
  }

  const maxAgeMs =
    options.rollingWindow.bucketSizeMs * options.rollingWindow.bucketCount;
  const now = options.now ?? Date.now();

  return (
    previousGeneratedAtMs <= now && now - previousGeneratedAtMs <= maxAgeMs
  );
}

function buildErrorSpikeAlertSummary(options: {
  current: ErrorReportBufferSnapshot;
  previous: ErrorReportBufferSnapshot | null;
  previousReportGeneratedAt?: string;
  webhookConfigured: boolean;
}): ErrorSpikeAlertSummary {
  const minNewReportsThreshold = parseErrorSpikeThreshold();
  const hasFreshReportBaseline =
    options.previous &&
    options.current.totalCaptured >= options.previous.totalCaptured &&
    options.current.totalDropped >= options.previous.totalDropped &&
    hasRecentReportBaseline({
      previousReportGeneratedAt: options.previousReportGeneratedAt,
      rollingWindow: options.current.rollingWindow,
    });

  let comparisonWindow: ErrorSpikeAlertComparisonWindow = "unavailable";
  let baselineAvailable = false;
  let newCapturedSinceLastReport: number | null = null;
  let newDroppedSinceLastReport: number | null = null;

  if (hasFreshReportBaseline && options.previous) {
    comparisonWindow = "report_interval";
    baselineAvailable = true;
    newCapturedSinceLastReport =
      options.current.totalCaptured - options.previous.totalCaptured;
    newDroppedSinceLastReport =
      options.current.totalDropped - options.previous.totalDropped;
  } else if (
    options.current.rollingWindow.totalCaptured > 0 ||
    options.current.rollingWindow.totalDropped > 0
  ) {
    comparisonWindow = "rolling_24h";
    newCapturedSinceLastReport = options.current.rollingWindow.totalCaptured;
    newDroppedSinceLastReport = options.current.rollingWindow.totalDropped;
  }

  if (
    newCapturedSinceLastReport === null ||
    newDroppedSinceLastReport === null
  ) {
    return {
      webhookConfigured: options.webhookConfigured,
      baselineAvailable,
      comparisonWindow,
      triggered: false,
      reasons: [],
      minNewReportsThreshold,
      newCapturedSinceLastReport: null,
      newDroppedSinceLastReport: null,
      intervalSaturationRate: null,
      delivery: {
        attempted: false,
        delivered: false,
        skippedReason: "baseline_unavailable",
      },
    };
  }

  const intervalSaturationRate =
    newCapturedSinceLastReport === 0
      ? 0
      : roundRatio(newDroppedSinceLastReport / newCapturedSinceLastReport);

  const reasons: ErrorSpikeAlertReason[] = [];
  if (newCapturedSinceLastReport >= minNewReportsThreshold) {
    reasons.push("error_spike");
  }
  if (newDroppedSinceLastReport > 0) {
    reasons.push("ring_buffer_saturation");
  }

  return {
    webhookConfigured: options.webhookConfigured,
    baselineAvailable,
    comparisonWindow,
    triggered: reasons.length > 0,
    reasons,
    minNewReportsThreshold,
    newCapturedSinceLastReport,
    newDroppedSinceLastReport,
    intervalSaturationRate,
    delivery: {
      attempted: false,
      delivered: false,
      skippedReason: buildAlertSkippedReason({
        hasReasons: reasons.length > 0,
        webhookConfigured: options.webhookConfigured,
      }),
    },
  };
}

function toErrorReportBufferMetricGroup(
  snapshot: ErrorReportBufferSnapshot,
): AnalyticsMetricGroup {
  return {
    capacity: snapshot.capacity,
    retained: snapshot.retained,
    totalCaptured: snapshot.totalCaptured,
    totalDropped: snapshot.totalDropped,
    cumulativeSaturationRate: snapshot.cumulativeSaturationRate,
    rollingWindow: toErrorReportRollingWindowMetricGroup(
      snapshot.rollingWindow,
    ),
    retainedTriage: toErrorReportTriageMetricGroup(snapshot.retainedTriage),
    evictedTriage: toErrorReportTriageMetricGroup(snapshot.evictedTriage),
  };
}

function toStoredErrorReportBufferMetricGroup(
  snapshot: ErrorReportBufferSnapshot,
): AnalyticsMetricGroup {
  return {
    capacity: snapshot.capacity,
    retained: snapshot.retained,
    totalCaptured: snapshot.totalCaptured,
    totalDropped: snapshot.totalDropped,
    cumulativeSaturationRate: snapshot.cumulativeSaturationRate,
    rollingWindow: toErrorReportRollingWindowMetricGroup(
      snapshot.rollingWindow,
    ),
    retainedTriage: toStoredErrorReportTriageMetricGroup(
      snapshot.retainedTriage,
    ),
    evictedTriage: toStoredErrorReportTriageMetricGroup(snapshot.evictedTriage),
  };
}

function toStoredErrorReportTriageSampleMetricGroup(
  sample: ErrorReportTriageSample,
): AnalyticsMetricGroup {
  return {
    id: sample.id,
    timestamp: sample.timestamp,
    source: sample.source,
    userAction: sample.userAction,
    category: sample.category,
    retryable: sample.retryable,
    errorName: sample.errorName,
    technicalMessage: sample.technicalMessage,
    ...(sample.requestId ? { requestId: sample.requestId } : {}),
    ...(sample.digest ? { digest: sample.digest } : {}),
    ...(sample.route ? { route: sample.route } : {}),
    ...(typeof sample.statusCode === "number"
      ? { statusCode: sample.statusCode }
      : {}),
  };
}

function toStoredErrorReportBreakdownBucketMetricGroup(
  bucket: ErrorReportBreakdownBucket,
): AnalyticsMetricGroup {
  return {
    value: bucket.value,
    reports: bucket.reports,
    latest: toStoredErrorReportTriageSampleMetricGroup(bucket.latest),
  };
}

function toStoredErrorReportTriageMetricGroup(
  summary: ErrorReportTriageSummary & {
    updatedAt?: number;
  },
): AnalyticsMetricGroup {
  return {
    totalReports: summary.totalReports,
    topRoutes: summary.topRoutes.map((bucket) =>
      toStoredErrorReportBreakdownBucketMetricGroup(bucket),
    ),
    topCategories: summary.topCategories.map((bucket) =>
      toStoredErrorReportBreakdownBucketMetricGroup(bucket),
    ),
    topSources: summary.topSources.map((bucket) =>
      toStoredErrorReportBreakdownBucketMetricGroup(bucket),
    ),
    topUserActions: summary.topUserActions.map((bucket) =>
      toStoredErrorReportBreakdownBucketMetricGroup(bucket),
    ),
    recentReports: summary.recentReports.map((sample) =>
      toStoredErrorReportTriageSampleMetricGroup(sample),
    ),
    ...(typeof summary.updatedAt === "number"
      ? { updatedAt: summary.updatedAt }
      : {}),
  };
}

function toDegradedErrorReportBufferMetricGroup(
  reason: string,
): AnalyticsMetricGroup {
  return {
    degraded: true,
    failure: reason,
    state: "degraded",
  };
}

function toTelemetryWriteHealthMetricGroup(
  snapshot: TelemetryWriteHealthSnapshot,
): AnalyticsMetricGroup {
  return {
    degraded: snapshot.degraded,
    currentFailureStreak: snapshot.currentFailureStreak,
    pendingFailureCount: snapshot.pendingFailureCount,
    ...(snapshot.lastFailureAt
      ? { lastFailureAt: snapshot.lastFailureAt }
      : {}),
    ...(snapshot.lastFailureKind
      ? { lastFailureKind: snapshot.lastFailureKind }
      : {}),
    ...(snapshot.lastRecoveryAt
      ? { lastRecoveryAt: snapshot.lastRecoveryAt }
      : {}),
  };
}

function toCronRefreshBatchMetricGroup(
  snapshot: CronRefreshBatchTelemetrySnapshot,
): AnalyticsMetricGroup {
  return {
    completedAt: snapshot.completedAt,
    batchSize: snapshot.batchSize,
    configuredBatchSize: snapshot.configuredBatchSize,
    dailyCapacity: snapshot.dailyCapacity,
    estimatedSweepHours: snapshot.estimatedSweepHours,
    failedUpdates: snapshot.failedUpdates,
    note: snapshot.note,
    removedUsers: snapshot.removedUsers,
    schedule: snapshot.schedule,
    successfulUpdates: snapshot.successfulUpdates,
    totalUsers: snapshot.totalUsers,
    withinDailyBudget: snapshot.withinDailyBudget,
  };
}

function toErrorReportRollingWindowMetricGroup(
  snapshot: ErrorReportRollingWindowSnapshot,
): AnalyticsMetricGroup {
  return {
    bucketSizeMs: snapshot.bucketSizeMs,
    bucketCount: snapshot.bucketCount,
    windowStart: snapshot.windowStart,
    windowEnd: snapshot.windowEnd,
    totalCaptured: snapshot.totalCaptured,
    totalDropped: snapshot.totalDropped,
    saturationRate: snapshot.saturationRate,
  };
}

function toErrorReportTriageSampleMetricGroup(
  sample: ErrorReportTriageSample,
): AnalyticsMetricGroup {
  return {
    id: sample.id,
    timestamp: sample.timestamp,
    source: sample.source,
    userAction: sample.userAction,
    category: sample.category,
    retryable: sample.retryable,
    errorName: sample.errorName,
    technicalMessage: sample.technicalMessage,
    ...(sample.requestId ? { requestId: sample.requestId } : {}),
    ...(sample.digest ? { digest: sample.digest } : {}),
    ...(sample.route ? { route: sample.route } : {}),
    ...(typeof sample.statusCode === "number"
      ? { statusCode: sample.statusCode }
      : {}),
    ...(sample.stack ? { stack: sample.stack } : {}),
    ...(sample.componentStack ? { componentStack: sample.componentStack } : {}),
    ...(sample.metadata ? { metadata: sample.metadata } : {}),
  };
}

function toErrorReportBreakdownBucketMetricGroup(
  bucket: ErrorReportBreakdownBucket,
): AnalyticsMetricGroup {
  return {
    value: bucket.value,
    reports: bucket.reports,
    latest: toErrorReportTriageSampleMetricGroup(bucket.latest),
  };
}

function toErrorReportTriageMetricGroup(
  summary: ErrorReportTriageSummary & {
    updatedAt?: number;
  },
): AnalyticsMetricGroup {
  return {
    totalReports: summary.totalReports,
    topRoutes: summary.topRoutes.map((bucket) =>
      toErrorReportBreakdownBucketMetricGroup(bucket),
    ),
    topCategories: summary.topCategories.map((bucket) =>
      toErrorReportBreakdownBucketMetricGroup(bucket),
    ),
    topSources: summary.topSources.map((bucket) =>
      toErrorReportBreakdownBucketMetricGroup(bucket),
    ),
    topUserActions: summary.topUserActions.map((bucket) =>
      toErrorReportBreakdownBucketMetricGroup(bucket),
    ),
    recentReports: summary.recentReports.map((sample) =>
      toErrorReportTriageSampleMetricGroup(sample),
    ),
    ...(typeof summary.updatedAt === "number"
      ? { updatedAt: summary.updatedAt }
      : {}),
  };
}

function toErrorSpikeAlertDeliveryMetricGroup(
  delivery: ErrorSpikeAlertDelivery,
): AnalyticsMetricGroup {
  return {
    attempted: delivery.attempted,
    delivered: delivery.delivered,
    ...(delivery.destinationHost
      ? { destinationHost: delivery.destinationHost }
      : {}),
    ...(delivery.failure ? { failure: delivery.failure } : {}),
    ...(delivery.fingerprint ? { fingerprint: delivery.fingerprint } : {}),
    ...(delivery.skippedReason
      ? { skippedReason: delivery.skippedReason }
      : {}),
    ...(typeof delivery.statusCode === "number"
      ? { statusCode: delivery.statusCode }
      : {}),
    ...(delivery.suppressedUntil
      ? { suppressedUntil: delivery.suppressedUntil }
      : {}),
  };
}

function toErrorSpikeAlertMetricGroup(
  summary: ErrorSpikeAlertSummary,
): AnalyticsMetricGroup {
  return {
    webhookConfigured: summary.webhookConfigured,
    baselineAvailable: summary.baselineAvailable,
    comparisonWindow: summary.comparisonWindow,
    triggered: summary.triggered,
    reasons: summary.reasons,
    minNewReportsThreshold: summary.minNewReportsThreshold,
    newCapturedSinceLastReport: summary.newCapturedSinceLastReport,
    newDroppedSinceLastReport: summary.newDroppedSinceLastReport,
    intervalSaturationRate: summary.intervalSaturationRate,
    delivery: toErrorSpikeAlertDeliveryMetricGroup(summary.delivery),
  };
}

function getComparisonWindowLabel(options: {
  comparisonWindow: ErrorSpikeAlertComparisonWindow;
  snapshot: ErrorReportBufferSnapshot;
}): string {
  if (options.comparisonWindow === "report_interval") {
    return "since the previous analytics report";
  }

  if (options.comparisonWindow === "rolling_24h") {
    return `within the last ${options.snapshot.rollingWindow.bucketCount} hours`;
  }

  return "within the recent comparison window";
}

function buildErrorSpikeAlertMessage(options: {
  summary: ErrorSpikeAlertSummary;
  snapshot: ErrorReportBufferSnapshot;
}): string {
  const reasonLabels = options.summary.reasons.map((reason) =>
    reason === "error_spike" ? "error spike" : "ring-buffer saturation",
  );

  const intervalSaturationRatePercent =
    options.summary.intervalSaturationRate === null
      ? "n/a"
      : `${(options.summary.intervalSaturationRate * 100).toFixed(1)}%`;
  const cumulativeSaturationRatePercent = `${(
    options.snapshot.cumulativeSaturationRate * 100
  ).toFixed(1)}%`;
  const comparisonWindowLabel = getComparisonWindowLabel({
    comparisonWindow: options.summary.comparisonWindow,
    snapshot: options.snapshot,
  });

  return [
    `[AniCards] ${reasonLabels.join(" + ")}`,
    `${options.summary.newCapturedSinceLastReport ?? 0} new structured error reports ${comparisonWindowLabel} (threshold ${options.summary.minNewReportsThreshold}).`,
    `${options.summary.newDroppedSinceLastReport ?? 0} reports rolled out of the ring buffer in that interval (${intervalSaturationRatePercent} interval saturation).`,
    `Current retained buffer: ${options.snapshot.retained}/${options.snapshot.capacity}; cumulative dropped: ${options.snapshot.totalDropped}/${options.snapshot.totalCaptured} (${cumulativeSaturationRatePercent}).`,
  ].join("\n");
}

function buildErrorSpikeAlertWebhookDetails(options: {
  operationId?: string;
  requestId?: string;
  snapshot: ErrorReportBufferSnapshot;
  summary: ErrorSpikeAlertSummary;
}): AnalyticsMetricGroup {
  return {
    ...(options.operationId ? { operationId: options.operationId } : {}),
    ...(options.requestId ? { requestId: options.requestId } : {}),
    reasons: options.summary.reasons,
    comparisonWindow: options.summary.comparisonWindow,
    minNewReportsThreshold: options.summary.minNewReportsThreshold,
    errorReportBuffer: {
      capacity: options.snapshot.capacity,
      retained: options.snapshot.retained,
      totalCaptured: options.snapshot.totalCaptured,
      totalDropped: options.snapshot.totalDropped,
      cumulativeSaturationRate: options.snapshot.cumulativeSaturationRate,
    },
    interval: {
      newCapturedSinceLastReport: options.summary.newCapturedSinceLastReport,
      newDroppedSinceLastReport: options.summary.newDroppedSinceLastReport,
      intervalSaturationRate: options.summary.intervalSaturationRate,
    },
  };
}

async function sendErrorSpikeAlert(options: {
  endpoint: string;
  operationId?: string;
  request: Request;
  requestId?: string;
  summary: ErrorSpikeAlertSummary;
  snapshot: ErrorReportBufferSnapshot;
  webhook: { url: string; destinationHost: string };
}): Promise<ErrorSpikeAlertDelivery> {
  const message = buildErrorSpikeAlertMessage({
    summary: options.summary,
    snapshot: options.snapshot,
  });

  try {
    const response = await fetchUpstreamWithRetry({
      service: "Error alert webhook",
      url: options.webhook.url,
      init: {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          text: message,
          content: message,
          source: "anicards-error-alert",
          details: buildErrorSpikeAlertWebhookDetails(options),
        }),
      },
      timeoutMs: ERROR_ALERT_TIMEOUT_MS,
      maxAttempts: 1,
      circuitBreaker: false,
    });

    if (!response.ok) {
      logPrivacySafe(
        "warn",
        options.endpoint,
        "Error spike alert webhook returned a non-success status",
        {
          destinationHost: options.webhook.destinationHost,
          statusCode: response.status,
        },
        options.request,
      );

      return {
        attempted: true,
        delivered: false,
        destinationHost: options.webhook.destinationHost,
        failure: "webhook_non_success_status",
        statusCode: response.status,
      };
    }

    return {
      attempted: true,
      delivered: true,
      destinationHost: options.webhook.destinationHost,
      statusCode: response.status,
    };
  } catch (error) {
    logPrivacySafe(
      "warn",
      options.endpoint,
      "Error spike alert webhook delivery failed without blocking cron completion",
      {
        destinationHost: options.webhook.destinationHost,
        error: error instanceof Error ? error.message : String(error),
      },
      options.request,
    );

    return {
      attempted: true,
      delivered: false,
      destinationHost: options.webhook.destinationHost,
      failure: "webhook_request_failed",
    };
  }
}

async function finalizeErrorSpikeAlertDelivery(options: {
  endpoint: string;
  operationId?: string;
  request: Request;
  requestId?: string;
  snapshot: ErrorReportBufferSnapshot;
  summary: ErrorSpikeAlertSummary;
  webhook: { url: string; destinationHost: string };
}): Promise<ErrorSpikeAlertDelivery> {
  const fingerprint = buildErrorSpikeAlertFingerprint({
    snapshot: options.snapshot,
    summary: options.summary,
  });
  const existingSuppression = await readErrorAlertSuppressionState(
    redisClient,
    fingerprint,
    {
      endpoint: options.endpoint,
      request: options.request,
    },
  );

  if (existingSuppression) {
    return {
      attempted: false,
      delivered: false,
      destinationHost: options.webhook.destinationHost,
      fingerprint,
      skippedReason: "duplicate_suppressed",
      ...(existingSuppression.suppressedUntil
        ? { suppressedUntil: existingSuppression.suppressedUntil }
        : {}),
    };
  }

  const delivery = await sendErrorSpikeAlert(options);
  const deliveredWithFingerprint: ErrorSpikeAlertDelivery = {
    ...delivery,
    fingerprint,
  };

  if (!delivery.delivered) {
    return deliveredWithFingerprint;
  }

  const persistedSuppression = await persistErrorAlertSuppressionState(
    redisClient,
    fingerprint,
    {
      endpoint: options.endpoint,
      request: options.request,
    },
  );

  return {
    ...deliveredWithFingerprint,
    ...(persistedSuppression?.suppressedUntil
      ? { suppressedUntil: persistedSuppression.suppressedUntil }
      : {}),
  };
}

function trackAnalyticsReportingOutcome(
  request: Request,
  durationMs: number,
  outcome: "success" | "failure",
  reasonCode?: string,
): void {
  const metrics =
    outcome === "success"
      ? [
          buildAnalyticsMetricKey("analytics_reporting", "successful_requests"),
          ...buildLatencyBucketMetricKeys(
            "analytics_reporting",
            durationMs,
            "success",
          ),
        ]
      : [
          ...buildFailedRequestMetricKeys("analytics_reporting", reasonCode),
          ...buildLatencyBucketMetricKeys(
            "analytics_reporting",
            durationMs,
            "failure",
          ),
        ];

  const scheduleMetrics =
    outcome === "success"
      ? scheduleAnalyticsBatch
      : scheduleLowValueAnalyticsBatch;

  scheduleMetrics(metrics, {
    endpoint: "Analytics & Reporting",
    request,
    taskName: metrics[0],
  });
}

async function readLatestStoredReportBaseline(
  request: Request,
  endpoint: string,
): Promise<StoredAnalyticsReport | null> {
  try {
    const [latestReport] = await fetchStoredReports(redisClient, 1);
    return latestReport ?? null;
  } catch (error) {
    logPrivacySafe(
      "warn",
      endpoint,
      "Failed to load the previous analytics report baseline; continuing without spike comparison",
      {
        error: error instanceof Error ? error.message : String(error),
      },
      request,
    );
    return null;
  }
}

async function readErrorReportBufferSnapshotWithFallback(
  request: Request,
  endpoint: string,
): Promise<ErrorReportBufferReadResult> {
  try {
    return {
      degraded: false,
      snapshot: await getErrorReportBufferSnapshot(),
    };
  } catch (error) {
    logPrivacySafe(
      "warn",
      endpoint,
      "Failed to read error-report buffer saturation counters; continuing with a degraded observability signal",
      {
        error: error instanceof Error ? error.message : String(error),
      },
      request,
    );
    return {
      degraded: true,
      failure: "error_report_buffer_unavailable",
    };
  }
}

/**
 * Reads a bounded slice of stored analytics reports, newest first.
 */
async function fetchStoredReports(
  redisClient: UpstashRedis,
  limit: number,
): Promise<StoredAnalyticsReport[]> {
  const rawEntries = await redisClient.lrange(ANALYTICS_REPORTS_KEY, 0, -1);
  const currentEntries = Array.isArray(rawEntries) ? rawEntries : [];
  const now = Date.now();

  return currentEntries
    .map((entry, index) => toStoredAnalyticsReportEntry(entry, index))
    .filter((entry) =>
      isAnalyticsReportWithinRetentionWindow(entry.report, now),
    )
    .slice(-limit)
    .map((entry) => entry.report)
    .reverse();
}

/**
 * Parses a persisted analytics report from the Redis list.
 */
function parseStoredAlertDelivery(
  value: unknown,
): ErrorSpikeAlertDelivery | null {
  if (!isPlainObject(value)) {
    return null;
  }

  if (
    typeof value.attempted !== "boolean" ||
    typeof value.delivered !== "boolean"
  ) {
    return null;
  }

  return {
    attempted: value.attempted,
    delivered: value.delivered,
    ...(typeof value.destinationHost === "string"
      ? { destinationHost: value.destinationHost }
      : {}),
    ...(typeof value.failure === "string" ? { failure: value.failure } : {}),
    ...(typeof value.fingerprint === "string"
      ? { fingerprint: value.fingerprint }
      : {}),
    ...(typeof value.skippedReason === "string"
      ? { skippedReason: value.skippedReason }
      : {}),
    ...(typeof value.statusCode === "number"
      ? { statusCode: value.statusCode }
      : {}),
    ...(typeof value.suppressedUntil === "string"
      ? { suppressedUntil: value.suppressedUntil }
      : {}),
  };
}

function extractLegacyAlertDelivery(
  summary: AnalyticsSummary,
): ErrorSpikeAlertDelivery {
  const observability = summary.observability;
  if (!isPlainObject(observability)) {
    return {
      attempted: false,
      delivered: false,
    };
  }

  const alerts = observability.alerts;
  if (!isPlainObject(alerts)) {
    return {
      attempted: false,
      delivered: false,
    };
  }

  return (
    parseStoredAlertDelivery(alerts.delivery) ?? {
      attempted: false,
      delivered: false,
    }
  );
}

function parseStoredReportMeta(
  value: unknown,
  summary: AnalyticsSummary,
): AnalyticsReportMeta {
  if (!isPlainObject(value)) {
    return {
      alertDelivery: extractLegacyAlertDelivery(summary),
      durationMs: 0,
    };
  }

  const durationMs = parseFiniteNumber(value.durationMs);

  return {
    alertDelivery:
      parseStoredAlertDelivery(value.alertDelivery) ??
      extractLegacyAlertDelivery(summary),
    durationMs: durationMs === null ? 0 : Math.max(0, Math.trunc(durationMs)),
    ...(typeof value.operationId === "string" && value.operationId.length > 0
      ? { operationId: value.operationId }
      : {}),
    ...(typeof value.requestId === "string" && value.requestId.length > 0
      ? { requestId: value.requestId }
      : {}),
  };
}

function parseStoredReport(
  value: unknown,
  index: number,
): StoredAnalyticsReport {
  const parsedValue =
    typeof value === "string"
      ? safeParse<Record<string, unknown>>(
          value,
          `${ANALYTICS_REPORTS_KEY}[${index}]`,
        )
      : (value as Record<string, unknown>);

  if (
    !isPlainObject(parsedValue) ||
    typeof parsedValue.generatedAt !== "string" ||
    !isPlainObject(parsedValue.summary)
  ) {
    throw new TypeError(
      `Invalid stored analytics report at ${ANALYTICS_REPORTS_KEY}[${index}]`,
    );
  }

  const summary = parsedValue.summary as AnalyticsSummary;

  return {
    generatedAt: parsedValue.generatedAt,
    reportMeta: parseStoredReportMeta(parsedValue.reportMeta, summary),
    summary,
  };
}

type StoredAnalyticsReportEntry = {
  report: StoredAnalyticsReport;
  serialized: string;
};

function toStoredAnalyticsReportEntry(
  value: unknown,
  index: number,
): StoredAnalyticsReportEntry {
  const report = parseStoredReport(value, index);

  return {
    report,
    serialized: typeof value === "string" ? value : JSON.stringify(report),
  };
}

function isAnalyticsReportWithinRetentionWindow(
  report: StoredAnalyticsReport,
  now = Date.now(),
): boolean {
  const generatedAtMs = parseTimestampMs(report.generatedAt);
  if (generatedAtMs === null) {
    return false;
  }

  return (
    generatedAtMs <= now && now - generatedAtMs <= ANALYTICS_REPORT_RETENTION_MS
  );
}

async function trimExpiredStoredAnalyticsReportHead(
  redisClient: UpstashRedis,
): Promise<void> {
  while (true) {
    const rawEntries = await redisClient.lrange(ANALYTICS_REPORTS_KEY, 0, 15);
    const currentEntries = Array.isArray(rawEntries) ? rawEntries : [];

    if (currentEntries.length === 0) {
      return;
    }

    const now = Date.now();
    let trimCount = 0;

    for (const [index, entry] of currentEntries.entries()) {
      const parsedEntry = toStoredAnalyticsReportEntry(entry, index);
      if (!isAnalyticsReportWithinRetentionWindow(parsedEntry.report, now)) {
        trimCount += 1;
        continue;
      }

      break;
    }

    if (trimCount === 0) {
      return;
    }

    await redisClient.ltrim(ANALYTICS_REPORTS_KEY, trimCount, -1);

    if (trimCount < currentEntries.length) {
      return;
    }
  }
}

/**
 * Parses and bounds the requested report limit.
 */
function parseRequestedReportLimit(request: Request): number | null {
  const limitParam = new URL(request.url).searchParams.get("limit");

  if (limitParam === null) {
    return DEFAULT_REPORT_READ_LIMIT;
  }

  if (!/^\d+$/.test(limitParam)) {
    return null;
  }

  const parsedLimit = Number.parseInt(limitParam, 10);
  if (parsedLimit < 1) {
    return null;
  }

  return Math.min(parsedLimit, MAX_STORED_ANALYTICS_REPORTS);
}

/**
 * Persists the analytics report and returns its structure.
 * @param redisClient - Redis client used to append reports.
 * @param summary - Structured summary of analytics results.
 * @param analyticsData - Raw analytics values recorded for the report.
 * @returns Generated report stored in Redis.
 * @source
 */
function buildAnalyticsReport(
  summary: AnalyticsSummary,
  analyticsData: AnalyticsData | undefined,
  reportMeta: AnalyticsReportMeta,
  generatedAt = new Date().toISOString(),
): AnalyticsReportResponse {
  return {
    summary,
    ...(analyticsData ? { raw_data: analyticsData } : {}),
    reportMeta,
    generatedAt,
  };
}

function buildStoredAnalyticsReport(
  summary: AnalyticsSummary,
  reportMeta: AnalyticsReportMeta,
  generatedAt: string,
): StoredAnalyticsReport {
  return {
    summary,
    reportMeta,
    generatedAt,
  };
}

async function createAndSaveReport(
  redisClient: UpstashRedis,
  report: StoredAnalyticsReport,
): Promise<void> {
  await trimExpiredStoredAnalyticsReportHead(redisClient);
  await redisClient.rpush(ANALYTICS_REPORTS_KEY, JSON.stringify(report));
  await redisClient.ltrim(
    ANALYTICS_REPORTS_KEY,
    -MAX_STORED_ANALYTICS_REPORTS,
    -1,
  );
  await redisClient.expire(
    ANALYTICS_REPORTS_KEY,
    ANALYTICS_REPORT_RETENTION_SECONDS,
  );
}

/**
 * Returns persisted analytics reports for supported downstream consumers.
 * @param request - Incoming request that must pass the cron secret check.
 * @returns JSON response containing recent analytics reports.
 * @source
 */
export async function GET(request: Request) {
  const init = await initializeApiRequest(
    request,
    "Analytics & Reporting",
    "analytics_reporting",
    undefined,
    { skipRateLimit: true, skipSameOrigin: true, requireOrigin: false },
  );
  if (init.errorResponse) return init.errorResponse;

  const { endpoint } = init;
  const authError = checkCronAuthorization(request);
  if (authError) {
    return authError;
  }

  const limit = parseRequestedReportLimit(request);
  if (limit === null) {
    trackAnalyticsReportingOutcome(
      request,
      Date.now() - init.startTime,
      "failure",
      "invalid_limit",
    );
    return apiErrorResponse(request, 400, "Invalid limit parameter");
  }

  try {
    const reports = await fetchStoredReports(redisClient, limit);
    const response: AnalyticsReportListResponse = {
      reports,
      count: reports.length,
      retentionLimit: MAX_STORED_ANALYTICS_REPORTS,
    };

    trackAnalyticsReportingOutcome(
      request,
      Date.now() - init.startTime,
      "success",
    );

    return new Response(JSON.stringify(response), {
      status: 200,
      headers: apiJsonHeaders(request),
    });
  } catch (error) {
    logPrivacySafe(
      "error",
      endpoint,
      "Failed to read stored analytics reports",
      {
        error: error instanceof Error ? error.message : String(error),
        ...(error instanceof Error && error.stack
          ? { stack: error.stack }
          : {}),
      },
      request,
    );

    trackAnalyticsReportingOutcome(
      request,
      Date.now() - init.startTime,
      "failure",
      "read_reports_failed",
    );

    return apiErrorResponse(request, 500, "Failed to fetch analytics reports");
  }
}

/**
 * Runs the analytics and reporting cron job, returning the latest report.
 * @param request - Incoming request that must pass the cron secret check.
 * @returns HTTP response containing the generated analytics payload or an error.
 * @source
 */
export async function POST(request: Request) {
  const init = await initializeApiRequest(
    request,
    "Analytics & Reporting",
    "analytics_reporting",
    undefined,
    { skipRateLimit: true, skipSameOrigin: true, requireOrigin: false },
  );
  if (init.errorResponse) return init.errorResponse;

  const { startTime, endpoint, operationId, requestId } = init;
  const authError = checkCronAuthorization(request);
  if (authError) {
    return authError;
  }

  logPrivacySafe(
    "log",
    endpoint,
    "Starting analytics and reporting job",
    undefined,
    request,
  );

  try {
    const latestStoredReport = await readLatestStoredReportBaseline(
      request,
      endpoint,
    );
    const includeRawAnalyticsData = shouldIncludeRawAnalyticsData(request);
    const analyticsDataReadResult = await fetchAnalyticsData(redisClient, {
      endpoint,
      request,
    });
    const analyticsData = analyticsDataReadResult.analyticsData;

    const summary = groupAnalyticsData(analyticsData);

    const errorReportReadResult =
      await readErrorReportBufferSnapshotWithFallback(request, endpoint);
    const telemetryWriteHealthReadResult =
      await readTelemetryWriteHealthSnapshotResult();
    const refreshBatchReadResult =
      await readCronRefreshBatchTelemetrySnapshotResult();
    const configuredWebhook = getConfiguredAlertWebhook(endpoint, request);

    let alertSummary: ErrorSpikeAlertSummary;
    let errorReportSummary: AnalyticsMetricGroup;
    let storedErrorReportSummary: AnalyticsMetricGroup;

    if (errorReportReadResult.degraded) {
      alertSummary = buildUnavailableErrorSpikeAlertSummary({
        skippedReason: errorReportReadResult.failure,
        webhookConfigured: configuredWebhook !== null,
      });
      errorReportSummary = toDegradedErrorReportBufferMetricGroup(
        errorReportReadResult.failure,
      );
      storedErrorReportSummary = toDegradedErrorReportBufferMetricGroup(
        errorReportReadResult.failure,
      );
    } else {
      const previousErrorReportSnapshot = getPreviousErrorReportBufferSnapshot(
        latestStoredReport?.summary,
      );
      const errorReportSnapshot = errorReportReadResult.snapshot;

      alertSummary = buildErrorSpikeAlertSummary({
        current: errorReportSnapshot,
        previous: previousErrorReportSnapshot,
        previousReportGeneratedAt: latestStoredReport?.generatedAt,
        webhookConfigured: configuredWebhook !== null,
      });

      if (alertSummary.triggered && configuredWebhook) {
        alertSummary = {
          ...alertSummary,
          delivery: await finalizeErrorSpikeAlertDelivery({
            endpoint,
            operationId,
            request,
            requestId,
            summary: alertSummary,
            snapshot: errorReportSnapshot,
            webhook: configuredWebhook,
          }),
        };
      }

      errorReportSummary = toErrorReportBufferMetricGroup(errorReportSnapshot);
      storedErrorReportSummary =
        toStoredErrorReportBufferMetricGroup(errorReportSnapshot);
    }

    const observabilitySummary: AnalyticsMetricGroup = {
      analyticsRead: analyticsDataReadResult.rollup,
      errorReports: errorReportSummary,
      alerts: toErrorSpikeAlertMetricGroup(alertSummary),
      telemetry: buildTelemetryReadMetricGroup(
        telemetryWriteHealthReadResult,
        toTelemetryWriteHealthMetricGroup(
          telemetryWriteHealthReadResult.snapshot ?? {
            currentFailureStreak: 0,
            degraded: false,
            pendingFailureCount: 0,
          },
        ),
      ),
      refreshBatch: buildRefreshBatchMetricGroup(refreshBatchReadResult),
    };

    const storedObservabilitySummary: AnalyticsMetricGroup = {
      analyticsRead: analyticsDataReadResult.rollup,
      errorReports: storedErrorReportSummary,
      alerts: toErrorSpikeAlertMetricGroup(alertSummary),
      telemetry: buildTelemetryReadMetricGroup(
        telemetryWriteHealthReadResult,
        toTelemetryWriteHealthMetricGroup(
          telemetryWriteHealthReadResult.snapshot ?? {
            currentFailureStreak: 0,
            degraded: false,
            pendingFailureCount: 0,
          },
        ),
      ),
      refreshBatch: buildRefreshBatchMetricGroup(refreshBatchReadResult),
    };

    const reportSummary: AnalyticsSummary = {
      ...summary,
      observability: observabilitySummary,
    };
    const storedReportSummary: AnalyticsSummary = {
      ...summary,
      observability: storedObservabilitySummary,
    };

    const duration = Date.now() - startTime;
    const reportMeta = buildAnalyticsReportMeta({
      alertDelivery: alertSummary.delivery,
      durationMs: duration,
      operationId,
      requestId,
    });
    const generatedAt = new Date().toISOString();
    const report = buildAnalyticsReport(
      reportSummary,
      includeRawAnalyticsData ? analyticsData : undefined,
      reportMeta,
      generatedAt,
    );
    const storedReport = buildStoredAnalyticsReport(
      storedReportSummary,
      reportMeta,
      generatedAt,
    );

    await createAndSaveReport(redisClient, storedReport);

    logPrivacySafe(
      "log",
      endpoint,
      "Analytics and reporting job completed",
      { durationMs: duration },
      request,
    );

    trackAlertDeliveryDegradation(request, alertSummary.delivery);

    trackAnalyticsReportingOutcome(request, duration, "success");

    return new Response(JSON.stringify(report), {
      status: 200,
      headers: apiJsonHeaders(request),
    });
  } catch (error: unknown) {
    const normalizedError =
      error instanceof Error ? error : new Error(String(error));

    logPrivacySafe(
      "error",
      endpoint,
      "Analytics and reporting job failed",
      {
        error: normalizedError.message,
        ...(normalizedError.stack ? { stack: normalizedError.stack } : {}),
      },
      request,
    );
    trackAnalyticsReportingOutcome(
      request,
      Date.now() - startTime,
      "failure",
      "analytics_reporting_failed",
    );
    return apiErrorResponse(request, 500, "Analytics and reporting job failed");
  }
}
