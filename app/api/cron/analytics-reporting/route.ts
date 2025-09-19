import { Redis } from "@upstash/redis";
import { safeParse } from "@/lib/utils";

// Helper function for cron authorization
function checkCronAuthorization(request: Request): Response | null {
  const CRON_SECRET = process.env.CRON_SECRET;
  const cronSecretHeader = request.headers.get("x-cron-secret");

  if (CRON_SECRET) {
    if (cronSecretHeader !== CRON_SECRET) {
      console.error(
        "🔒 [Analytics & Reporting] Unauthorized: Invalid Cron secret",
      );
      return new Response("Unauthorized", { status: 401 });
    }
  } else {
    console.warn(
      "No CRON_SECRET env variable set. Skipping authorization check.",
    );
  }
  return null;
}

// Helper function to fetch and parse analytics data
async function fetchAnalyticsData(
  redisClient: Redis,
): Promise<Record<string, number>> {
  const analyticsPattern = "analytics:*";
  const analyticsKeysAll = await redisClient.keys(analyticsPattern);
  const analyticsKeys = analyticsKeysAll.filter(
    (key) => key !== "analytics:reports",
  );

  const analyticsData: Record<string, number> = {};

  for (const key of analyticsKeys) {
    const valueStr = await redisClient.get(key);
    if (!valueStr) {
      analyticsData[key] = 0;
      continue;
    }

    let parsedValue = Number(valueStr);
    if (isNaN(parsedValue)) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      parsedValue = safeParse<any>(valueStr);
    }
    analyticsData[key] = parsedValue;
  }

  return analyticsData;
}

// Helper function to group analytics data by service and metric
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

// Helper function to create and save analytics report
async function createAndSaveReport(
  redisClient: Redis,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  summary: Record<string, any>,
  analyticsData: Record<string, number>,
): Promise<Record<string, unknown>> {
  const report = {
    summary,
    raw_data: analyticsData,
    generatedAt: new Date().toISOString(),
  };

  await redisClient.rpush("analytics:reports", JSON.stringify(report));
  return report;
}

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
    const redisClient = Redis.fromEnv();

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
      headers: { "Content-Type": "application/json" },
    });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } catch (error: any) {
    console.error(`🔥 [Analytics & Reporting] Job failed: ${error.message}`);
    if (error.stack) {
      console.error(`💥 [Analytics & Reporting] Stack Trace: ${error.stack}`);
    }
    return new Response("Analytics and reporting job failed", { status: 500 });
  }
}
