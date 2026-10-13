import { redisClient, apiJsonHeaders, scanAllKeys } from "@/lib/api-utils";
import type { Redis as UpstashRedis } from "@upstash/redis";
import { safeParse } from "@/lib/utils";

const ANALYTICS_REPORTS_KEY = "analytics:reports";
const ANALYTICS_REPORT_RETENTION_MS = 90 * 24 * 60 * 60 * 1000;

function getReportMetadata(report: unknown): {
  timestamp: number;
  month: string;
} | null {
  try {
    const parsed: unknown =
      typeof report === "string" ? JSON.parse(report) : report;
    if (
      typeof parsed !== "object" ||
      parsed === null ||
      !("generatedAt" in parsed) ||
      typeof parsed.generatedAt !== "string"
    ) {
      return null;
    }

    const timestamp = Date.parse(parsed.generatedAt);
    if (!Number.isFinite(timestamp)) {
      return null;
    }

    const date = new Date(timestamp);
    const month = `${date.getUTCFullYear()}-${String(
      date.getUTCMonth() + 1,
    ).padStart(2, "0")}`;

    return { timestamp, month };
  } catch {
    return null;
  }
}

async function pruneAnalyticsReports(
  redisClient: UpstashRedis,
  now: Date,
): Promise<void> {
  const reports = await redisClient.lrange<unknown>(
    ANALYTICS_REPORTS_KEY,
    0,
    -1,
  );
  const cutoff = now.getTime() - ANALYTICS_REPORT_RETENTION_MS;
  const metadata = reports.map(getReportMetadata);
  const monthlyArchives = new Map<string, { index: number; timestamp: number }>();

  metadata.forEach((report, index) => {
    if (!report || report.timestamp >= cutoff) {
      return;
    }

    const existingArchive = monthlyArchives.get(report.month);
    if (!existingArchive || report.timestamp > existingArchive.timestamp) {
      monthlyArchives.set(report.month, { index, timestamp: report.timestamp });
    }
  });

  const archivedIndices = new Set(
    Array.from(monthlyArchives.values(), ({ index }) => index),
  );
  const reportsToRemove = metadata.flatMap((report, index) =>
    report && report.timestamp < cutoff && !archivedIndices.has(index)
      ? [reports[index]]
      : [],
  );

  if (reportsToRemove.length === 0) {
    return;
  }

  const pipeline = redisClient.pipeline();
  for (const report of reportsToRemove) {
    pipeline.lrem(ANALYTICS_REPORTS_KEY, 1, report);
  }
  await pipeline.exec();
}

/**
 * Validates the cron secret header and returns an error response on failure.
 * @param request - Incoming request whose headers provide the cron secret.
 * @returns Response when authorization fails or null when allowed.
 * @source
 */
function checkCronAuthorization(request: Request): Response | null {
  const CRON_SECRET = process.env.CRON_SECRET;
  const cronSecretHeader = request.headers.get("x-cron-secret");

  if (CRON_SECRET) {
    if (cronSecretHeader !== CRON_SECRET) {
      console.error(
        "🔒 [Analytics & Reporting] Unauthorized: Invalid Cron secret",
      );
      return new Response("Unauthorized", {
        status: 401,
        headers: apiJsonHeaders(request),
      });
    }
  } else {
    console.warn(
      "No CRON_SECRET env variable set. Skipping authorization check.",
    );
  }
  return null;
}

/**
 * Collects stored analytics metrics from Redis, mapping missing values to zero.
 * @param redisClient - Redis client used to read analytics keys.
 * @returns Mapping of analytics keys to their numeric values.
 * @source
 */
async function fetchAnalyticsData(
  redisClient: UpstashRedis,
): Promise<Record<string, number>> {
  const analyticsPattern = "analytics:*";
  const analyticsKeysAll = await scanAllKeys(analyticsPattern);
  const analyticsKeys = analyticsKeysAll.filter(
    (key) => key !== ANALYTICS_REPORTS_KEY,
  );

  const analyticsData: Record<string, number> = {};

  for (const key of analyticsKeys) {
    const valueStr = await redisClient.get(key);
    if (!valueStr) {
      analyticsData[key] = 0;
      continue;
    }

    let parsedValue = Number(valueStr);
    if (Number.isNaN(parsedValue)) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      parsedValue = safeParse<any>(valueStr);
    }
    analyticsData[key] = parsedValue;
  }

  return analyticsData;
}

/**
 * Reformats analytics rows by service and metric identifiers for reporting.
 * @param analyticsData - Flat mapping of analytics key strings to numeric values.
 * @returns Nested summary grouped by service and metric names.
 * @source
 */
function groupAnalyticsData(
  analyticsData: Record<string, number>,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
): Record<string, any> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const summary: Record<string, any> = {};

  for (const [key, value] of Object.entries(analyticsData)) {
    const parts = key.split(":");

    if (parts.length === 2) {
      // Keys like "analytics:visits"
      summary[parts[1]] = value;
    } else if (parts.length >= 3) {
      // Keys like "analytics:anilist_api:successful_requests"
      const service = parts[1];
      const metric = parts.slice(2).join(":");
      if (!summary[service]) {
        summary[service] = {};
      }
      summary[service][metric] = value;
    }
  }

  return summary;
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
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  summary: Record<string, any>,
  analyticsData: Record<string, number>,
): Promise<Record<string, unknown>> {
  const now = new Date();
  const report = {
    summary,
    raw_data: analyticsData,
    generatedAt: now.toISOString(),
  };

  await redisClient.rpush(ANALYTICS_REPORTS_KEY, JSON.stringify(report));
  await pruneAnalyticsReports(redisClient, now);
  return report;
}

/**
 * Runs the analytics and reporting cron job, returning the latest report.
 * @param request - Incoming request that must pass the cron secret check.
 * @returns HTTP response containing the generated analytics payload or an error.
 * @source
 */
export async function POST(request: Request) {
  // Check authorization
  const authError = checkCronAuthorization(request);
  if (authError) {
    return authError;
  }

  const startTime = Date.now();
  console.log(
    "🛠️ [Analytics & Reporting] Starting analytics and reporting job...",
  );

  try {
    // Fetch and parse analytics data
    const analyticsData = await fetchAnalyticsData(redisClient);

    // Group analytics data by service and metric
    const summary = groupAnalyticsData(analyticsData);

    // Create and save the analytics report
    const report = await createAndSaveReport(
      redisClient,
      summary,
      analyticsData,
    );

    const duration = Date.now() - startTime;
    console.log(`🛠️ [Analytics & Reporting] Job completed in ${duration}ms`);

    return new Response(JSON.stringify(report), {
      status: 200,
      headers: apiJsonHeaders(request),
    });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } catch (error: any) {
    console.error(`🔥 [Analytics & Reporting] Job failed: ${error.message}`);
    if (error.stack) {
      console.error(`💥 [Analytics & Reporting] Stack Trace: ${error.stack}`);
    }
    return new Response("Analytics and reporting job failed", {
      status: 500,
      headers: apiJsonHeaders(request),
    });
  }
}
