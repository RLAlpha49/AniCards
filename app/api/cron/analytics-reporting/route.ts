import type { Redis as UpstashRedis } from "@upstash/redis";

import {
  apiErrorResponse,
  apiJsonHeaders,
  authorizeCronRequest,
  fetchUpstreamWithRetry,
  initializeApiRequest,
  logPrivacySafe,
  redisClient,
  scanAllKeys,
} from "@/lib/api-utils";
import {
  type ErrorReportBufferSnapshot,
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

interface AnalyticsReport {
  generatedAt: string;
  raw_data: AnalyticsData;
  summary: AnalyticsSummary;
}

interface AnalyticsReportListResponse {
  count: number;
  reports: AnalyticsReport[];
  retentionLimit: number;
}

type ErrorSpikeAlertReason = "error_spike" | "ring_buffer_saturation";

interface ErrorSpikeAlertDelivery {
  attempted: boolean;
  delivered: boolean;
  destinationHost?: string;
  failure?: string;
  skippedReason?: string;
  statusCode?: number;
}

interface ErrorSpikeAlertSummary {
  webhookConfigured: boolean;
  baselineAvailable: boolean;
  triggered: boolean;
  reasons: ErrorSpikeAlertReason[];
  minNewReportsThreshold: number;
  newCapturedSinceLastReport: number | null;
  newDroppedSinceLastReport: number | null;
  intervalSaturationRate: number | null;
  delivery: ErrorSpikeAlertDelivery;
}

const ANALYTICS_KEYS_PATTERN = "analytics:*";
const ANALYTICS_REPORTS_KEY = "analytics:reports";
const DEFAULT_REPORT_READ_LIMIT = 10;
const MAX_STORED_ANALYTICS_REPORTS = 50;
const DEFAULT_ERROR_SPIKE_MIN_NEW_REPORTS = 25;
const ERROR_ALERT_TIMEOUT_MS = 4_000;
const ERROR_ALERT_WEBHOOK_ENV_NAME = "ERROR_ALERT_WEBHOOK_URL";

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
): Promise<AnalyticsData> {
  const analyticsKeysAll = await scanAllKeys(ANALYTICS_KEYS_PATTERN);
  const analyticsKeys = analyticsKeysAll.filter(
    (key) => key !== ANALYTICS_REPORTS_KEY,
  );

  if (analyticsKeys.length === 0) {
    return {};
  }

  const values = await redisClient.mget(...analyticsKeys);

  return Object.fromEntries(
    analyticsKeys.map((key, index) => [
      key,
      parseAnalyticsValue(values[index]),
    ]),
  );
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

function createEmptyErrorReportBufferSnapshot(): ErrorReportBufferSnapshot {
  return {
    capacity: 250,
    retained: 0,
    totalCaptured: 0,
    totalDropped: 0,
    cumulativeSaturationRate: 0,
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

function buildErrorSpikeAlertSummary(options: {
  current: ErrorReportBufferSnapshot;
  previous: ErrorReportBufferSnapshot | null;
  webhookConfigured: boolean;
}): ErrorSpikeAlertSummary {
  const minNewReportsThreshold = parseErrorSpikeThreshold();

  if (
    !options.previous ||
    options.current.totalCaptured < options.previous.totalCaptured ||
    options.current.totalDropped < options.previous.totalDropped
  ) {
    return {
      webhookConfigured: options.webhookConfigured,
      baselineAvailable: false,
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

  const newCapturedSinceLastReport =
    options.current.totalCaptured - options.previous.totalCaptured;
  const newDroppedSinceLastReport =
    options.current.totalDropped - options.previous.totalDropped;
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
    baselineAvailable: true,
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
    ...(delivery.skippedReason
      ? { skippedReason: delivery.skippedReason }
      : {}),
    ...(typeof delivery.statusCode === "number"
      ? { statusCode: delivery.statusCode }
      : {}),
  };
}

function toErrorSpikeAlertMetricGroup(
  summary: ErrorSpikeAlertSummary,
): AnalyticsMetricGroup {
  return {
    webhookConfigured: summary.webhookConfigured,
    baselineAvailable: summary.baselineAvailable,
    triggered: summary.triggered,
    reasons: summary.reasons,
    minNewReportsThreshold: summary.minNewReportsThreshold,
    newCapturedSinceLastReport: summary.newCapturedSinceLastReport,
    newDroppedSinceLastReport: summary.newDroppedSinceLastReport,
    intervalSaturationRate: summary.intervalSaturationRate,
    delivery: toErrorSpikeAlertDeliveryMetricGroup(summary.delivery),
  };
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

  return [
    `[AniCards] ${reasonLabels.join(" + ")}`,
    `${options.summary.newCapturedSinceLastReport ?? 0} new structured error reports since the previous analytics report (threshold ${options.summary.minNewReportsThreshold}).`,
    `${options.summary.newDroppedSinceLastReport ?? 0} reports rolled out of the ring buffer in that interval (${intervalSaturationRatePercent} interval saturation).`,
    `Current retained buffer: ${options.snapshot.retained}/${options.snapshot.capacity}; cumulative dropped: ${options.snapshot.totalDropped}/${options.snapshot.totalCaptured} (${cumulativeSaturationRatePercent}).`,
  ].join("\n");
}

async function sendErrorSpikeAlert(options: {
  endpoint: string;
  request: Request;
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
          details: {
            reasons: options.summary.reasons,
            errorReports: options.snapshot,
            interval: {
              newCapturedSinceLastReport:
                options.summary.newCapturedSinceLastReport,
              newDroppedSinceLastReport:
                options.summary.newDroppedSinceLastReport,
              intervalSaturationRate: options.summary.intervalSaturationRate,
            },
          },
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

async function readLatestStoredReportBaseline(
  request: Request,
  endpoint: string,
): Promise<AnalyticsReport | null> {
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
): Promise<ErrorReportBufferSnapshot> {
  try {
    return await getErrorReportBufferSnapshot();
  } catch (error) {
    logPrivacySafe(
      "warn",
      endpoint,
      "Failed to read error-report buffer saturation counters; continuing with an empty snapshot",
      {
        error: error instanceof Error ? error.message : String(error),
      },
      request,
    );
    return createEmptyErrorReportBufferSnapshot();
  }
}

/**
 * Reads a bounded slice of stored analytics reports, newest first.
 */
async function fetchStoredReports(
  redisClient: UpstashRedis,
  limit: number,
): Promise<AnalyticsReport[]> {
  const storedReports = await redisClient.lrange(
    ANALYTICS_REPORTS_KEY,
    -limit,
    -1,
  );

  return storedReports
    .map((entry, index) => parseStoredReport(entry, index))
    .reverse();
}

/**
 * Parses a persisted analytics report from the Redis list.
 */
function parseStoredReport(value: unknown, index: number): AnalyticsReport {
  if (typeof value === "string") {
    return safeParse<AnalyticsReport>(
      value,
      `${ANALYTICS_REPORTS_KEY}[${index}]`,
    );
  }

  return value as AnalyticsReport;
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
async function createAndSaveReport(
  redisClient: UpstashRedis,
  summary: AnalyticsSummary,
  analyticsData: AnalyticsData,
): Promise<AnalyticsReport> {
  const report: AnalyticsReport = {
    summary,
    raw_data: analyticsData,
    generatedAt: new Date().toISOString(),
  };

  await redisClient.rpush(ANALYTICS_REPORTS_KEY, JSON.stringify(report));
  await redisClient.ltrim(
    ANALYTICS_REPORTS_KEY,
    -MAX_STORED_ANALYTICS_REPORTS,
    -1,
  );

  return report;
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
    return apiErrorResponse(request, 400, "Invalid limit parameter");
  }

  try {
    const reports = await fetchStoredReports(redisClient, limit);
    const response: AnalyticsReportListResponse = {
      reports,
      count: reports.length,
      retentionLimit: MAX_STORED_ANALYTICS_REPORTS,
    };

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

  const { startTime, endpoint } = init;
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
    const analyticsData = await fetchAnalyticsData(redisClient);

    const summary = groupAnalyticsData(analyticsData);

    const errorReportSnapshot = await readErrorReportBufferSnapshotWithFallback(
      request,
      endpoint,
    );
    const previousErrorReportSnapshot = getPreviousErrorReportBufferSnapshot(
      latestStoredReport?.summary,
    );
    const configuredWebhook = getConfiguredAlertWebhook(endpoint, request);

    let alertSummary = buildErrorSpikeAlertSummary({
      current: errorReportSnapshot,
      previous: previousErrorReportSnapshot,
      webhookConfigured: configuredWebhook !== null,
    });

    if (alertSummary.triggered && configuredWebhook) {
      alertSummary = {
        ...alertSummary,
        delivery: await sendErrorSpikeAlert({
          endpoint,
          request,
          summary: alertSummary,
          snapshot: errorReportSnapshot,
          webhook: configuredWebhook,
        }),
      };
    }

    const observabilitySummary: AnalyticsMetricGroup = {
      errorReports: toErrorReportBufferMetricGroup(errorReportSnapshot),
      alerts: toErrorSpikeAlertMetricGroup(alertSummary),
    };

    summary.observability = observabilitySummary;

    const report = await createAndSaveReport(
      redisClient,
      summary,
      analyticsData,
    );

    const duration = Date.now() - startTime;
    logPrivacySafe(
      "log",
      endpoint,
      "Analytics and reporting job completed",
      { durationMs: duration },
      request,
    );

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
    return apiErrorResponse(request, 500, "Analytics and reporting job failed");
  }
}
