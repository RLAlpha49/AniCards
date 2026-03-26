import type { Redis as UpstashRedis } from "@upstash/redis";

import {
  apiJsonHeaders,
  apiTextHeaders,
  authorizeCronRequest,
  initializeApiRequest,
  logPrivacySafe,
  redisClient,
  scanAllKeys,
} from "@/lib/api-utils";
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

const ANALYTICS_KEYS_PATTERN = "analytics:*";
const ANALYTICS_REPORTS_KEY = "analytics:reports";
const DEFAULT_REPORT_READ_LIMIT = 10;
const MAX_STORED_ANALYTICS_REPORTS = 50;

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
    return new Response(JSON.stringify({ error: "Invalid limit parameter" }), {
      status: 400,
      headers: apiJsonHeaders(request),
    });
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

    return new Response(
      JSON.stringify({ error: "Failed to fetch analytics reports" }),
      {
        status: 500,
        headers: apiJsonHeaders(request),
      },
    );
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
    const analyticsData = await fetchAnalyticsData(redisClient);

    const summary = groupAnalyticsData(analyticsData);

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
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } catch (error: any) {
    logPrivacySafe(
      "error",
      endpoint,
      "Analytics and reporting job failed",
      {
        error: error.message,
        ...(error.stack ? { stack: error.stack } : {}),
      },
      request,
    );
    return new Response("Analytics and reporting job failed", {
      status: 500,
      headers: apiTextHeaders(request),
    });
  }
}
