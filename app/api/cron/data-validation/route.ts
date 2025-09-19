import { Redis } from "@upstash/redis";
import { safeParse } from "@/lib/utils";

// Helper function for cron authorization
function checkCronAuthorization(request: Request): Response | null {
  const CRON_SECRET = process.env.CRON_SECRET;
  const cronSecretHeader = request.headers.get("x-cron-secret");

  if (CRON_SECRET) {
    if (cronSecretHeader !== CRON_SECRET) {
      console.error(
        "🔒 [Data Validation Check] Unauthorized: Invalid Cron secret",
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

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function validateUserRecord(obj: any): string[] {
  const issues: string[] = [];
  if (typeof obj.userId !== "number") {
    issues.push("userId is missing or not a number");
  }
  if (typeof obj.username !== "string") {
    issues.push("username is missing or not a string");
  }
  if (typeof obj.ip !== "string") {
    issues.push("ip is missing or not a string");
  }
  if (typeof obj.createdAt !== "string") {
    issues.push("createdAt is missing or not a string");
  }
  if (typeof obj.updatedAt !== "string") {
    issues.push("updatedAt is missing or not a string");
  }
  if (typeof obj.stats !== "object" || obj.stats === null) {
    issues.push("stats is missing or not an object");
  }
  return issues;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function validateCardsRecord(obj: any): string[] {
  const issues: string[] = [];
  if (typeof obj.userId !== "number") {
    issues.push("userId is missing or not a number");
  }
  if (!Array.isArray(obj.cards)) {
    issues.push("cards is missing or not an array");
  } else {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    obj.cards.forEach((card: any, index: number) => {
      if (typeof card !== "object" || card === null) {
        issues.push(`cards[${index}] is not an object`);
        return;
      }
      if (typeof card.cardName !== "string") {
        issues.push(`cards[${index}].cardName is missing or not a string`);
      }
      if (typeof card.variation !== "string") {
        issues.push(`cards[${index}].variation is missing or not a string`);
      }
      if (typeof card.titleColor !== "string") {
        issues.push(`cards[${index}].titleColor is missing or not a string`);
      }
      if (typeof card.backgroundColor !== "string") {
        issues.push(
          `cards[${index}].backgroundColor is missing or not a string`,
        );
      }
      if (typeof card.textColor !== "string") {
        issues.push(`cards[${index}].textColor is missing or not a string`);
      }
      if (typeof card.circleColor !== "string") {
        issues.push(`cards[${index}].circleColor is missing or not a string`);
      }
    });
  }
  if (typeof obj.updatedAt !== "string") {
    issues.push("updatedAt is missing or not a string");
  }
  return issues;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function validateUsernameRecord(obj: any): string[] {
  const issues: string[] = [];
  if (typeof obj !== "number") {
    issues.push("username record is not a number");
  }
  return issues;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function validateAnalyticsMetric(val: any): string[] {
  const issues: string[] = [];
  if (typeof val !== "number") {
    issues.push(`Expected a number but got ${typeof val}`);
  }
  return issues;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function validateAnalyticsReport(obj: any): string[] {
  const issues: string[] = [];
  if (typeof obj !== "object" || obj === null) {
    issues.push("Report is not an object");
    return issues;
  }
  if (!("generatedAt" in obj) || typeof obj.generatedAt !== "string") {
    issues.push("generatedAt is missing or not a string");
  }
  if (
    !("raw_data" in obj) ||
    typeof obj.raw_data !== "object" ||
    obj.raw_data === null
  ) {
    issues.push("raw_data is missing or not an object");
  }
  if (
    !("summary" in obj) ||
    typeof obj.summary !== "object" ||
    obj.summary === null
  ) {
    issues.push("summary is missing or not an object");
  }
  return issues;
}

// Helper function to validate analytics reports list
async function validateAnalyticsReportsList(
  redisClient: Redis,
  key: string,
  inconsistencies: Array<{ key: string; issues: string[] }>,
): Promise<{ keysChecked: number; issuesFound: number }> {
  const listElements = await redisClient.lrange(key, 0, -1);

  if (!listElements || listElements.length === 0) {
    inconsistencies.push({ key, issues: ["List is empty"] });
    return { keysChecked: 0, issuesFound: 1 };
  }

  let keysChecked = 0;
  let issuesFound = 0;

  for (let i = 0; i < listElements.length; i++) {
    const reportStr = listElements[i];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const parsedReport = safeParse<any>(reportStr);
    const reportIssues = validateAnalyticsReport(parsedReport);

    if (reportIssues.length > 0) {
      issuesFound++;
      inconsistencies.push({
        key: `${key}[${i}]`,
        issues: reportIssues,
      });
    }
    keysChecked++;
  }

  return { keysChecked, issuesFound };
}

// Helper function to validate individual key
async function validateIndividualKey(
  redisClient: Redis,
  key: string,
  inconsistencies: Array<{ key: string; issues: string[] }>,
): Promise<{ keysChecked: number; issuesFound: number }> {
  const valueStr = await redisClient.get(key);

  if (!valueStr) {
    inconsistencies.push({ key, issues: ["Value is null or missing"] });
    return { keysChecked: 1, issuesFound: 1 };
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const parsed = safeParse<any>(valueStr);
  if ((parsed === null || parsed === undefined) && parsed !== 0) {
    inconsistencies.push({ key, issues: ["Failed to parse JSON"] });
    return { keysChecked: 1, issuesFound: 1 };
  }

  const issues: string[] = [];
  if (key.startsWith("user:")) {
    issues.push(...validateUserRecord(parsed));
  } else if (key.startsWith("cards:")) {
    issues.push(...validateCardsRecord(parsed));
  } else if (key.startsWith("username:")) {
    issues.push(...validateUsernameRecord(parsed));
  } else if (key.startsWith("analytics:")) {
    issues.push(...validateAnalyticsMetric(parsed));
  }

  if (issues.length > 0) {
    inconsistencies.push({ key, issues });
    return { keysChecked: 1, issuesFound: 1 };
  }

  return { keysChecked: 1, issuesFound: 0 };
}

// Helper function to validate keys for a pattern
async function validatePatternKeys(
  redisClient: Redis,
  pattern: string,
  inconsistencies: Array<{ key: string; issues: string[] }>,
): Promise<{ checked: number; inconsistencies: number }> {
  const keys = await redisClient.keys(pattern);
  let patternChecked = 0;
  let patternIssues = 0;

  for (const key of keys) {
    try {
      let result;

      if (key === "analytics:reports") {
        result = await validateAnalyticsReportsList(
          redisClient,
          key,
          inconsistencies,
        );
      } else {
        result = await validateIndividualKey(redisClient, key, inconsistencies);
      }

      patternChecked += result.keysChecked;
      patternIssues += result.issuesFound;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (error: any) {
      patternIssues++;
      inconsistencies.push({ key, issues: [error.message] });
    }
  }

  return { checked: patternChecked, inconsistencies: patternIssues };
}

// Helper function to create and save validation report
async function createAndSaveReport(
  redisClient: Redis,
  summary: string,
  details: Record<string, { checked: number; inconsistencies: number }>,
  inconsistencies: Array<{ key: string; issues: string[] }>,
): Promise<Record<string, unknown>> {
  const report = {
    summary,
    details,
    issues: inconsistencies,
    generatedAt: new Date().toISOString(),
  };

  await redisClient.rpush("data_validation:reports", JSON.stringify(report));
  return report;
}

export async function POST(request: Request) {
  // Check authorization
  const authError = checkCronAuthorization(request);
  if (authError) {
    return authError;
  }

  const startTime = Date.now();
  console.log("🛠️ [Data Validation Check] Starting data validation check...");

  try {
    const redisClient = Redis.fromEnv();
    const patterns = ["user:*", "cards:*", "username:*", "analytics:*"];
    let totalKeysChecked = 0;
    let totalInconsistencies = 0;
    const inconsistencies: Array<{ key: string; issues: string[] }> = [];
    const details: Record<
      string,
      { checked: number; inconsistencies: number }
    > = {};

    // Validate keys for each pattern
    for (const pattern of patterns) {
      const result = await validatePatternKeys(
        redisClient,
        pattern,
        inconsistencies,
      );
      details[pattern] = result;
      totalKeysChecked += result.checked;
      totalInconsistencies += result.inconsistencies;
    }

    const duration = Date.now() - startTime;
    const summary = `Data validation check completed in ${duration}ms: ${totalKeysChecked} keys checked, ${totalInconsistencies} issues found.`;

    console.log(`🛠️ [Data Validation Check] ${summary}`);
    if (inconsistencies.length > 0) {
      console.warn("🛠️ [Data Validation Check] Issues found:", inconsistencies);
    }

    // Create and save the validation report
    const report = await createAndSaveReport(
      redisClient,
      summary,
      details,
      inconsistencies,
    );

    return new Response(JSON.stringify(report), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } catch (error: any) {
    console.error(`🔥 [Data Validation Check] Job failed: ${error.message}`);
    if (error.stack) {
      console.error(`💥 [Data Validation Check] Stack Trace: ${error.stack}`);
    }
    return new Response("Data validation check failed", { status: 500 });
  }
}
