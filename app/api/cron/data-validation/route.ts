import { redisClient } from "@/lib/api-utils";
import type { Redis as UpstashRedis } from "@upstash/redis";
import { safeParse } from "@/lib/utils";

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

/**
 * Validates that the stored user record contains the required typed fields.
 * @param obj - Parsed record to validate.
 * @returns List of missing or mistyped fields.
 * @source
 */
function validateUserRecord(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  obj: any,
): string[] {
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

/**
 * Definitions for required string properties on card records and their error messages.
 * @source
 */
const CARD_STRING_PROPERTIES: Array<[string, (idx: number) => string]> = [
  ["cardName", (idx) => `cards[${idx}].cardName is missing or not a string`],
  ["variation", (idx) => `cards[${idx}].variation is missing or not a string`],
  [
    "titleColor",
    (idx) => `cards[${idx}].titleColor is missing or not a string`,
  ],
  [
    "backgroundColor",
    (idx) => `cards[${idx}].backgroundColor is missing or not a string`,
  ],
  ["textColor", (idx) => `cards[${idx}].textColor is missing or not a string`],
  [
    "circleColor",
    (idx) => `cards[${idx}].circleColor is missing or not a string`,
  ],
];

/**
 * Ensures card-level string properties are present and reports missing ones.
 * @param card - Parsed card metadata being validated.
 * @param index - Index of the card inside the cards array.
 * @returns List of issues describing missing string properties.
 * @source
 */
function validateCardStringProps(card: Record<string, unknown>, index: number) {
  const issues: string[] = [];
  for (const [prop, messageFn] of CARD_STRING_PROPERTIES) {
    if (typeof card[prop] !== "string") {
      issues.push(messageFn(index));
    }
  }
  return issues;
}

/**
 * Ensures an optional border color is a string if provided.
 * @param card - Parsed card metadata that may include a borderColor.
 * @param index - Index of the card inside the cards array.
 * @returns Issues describing invalid border colors.
 * @source
 */
function validateCardBorderColor(card: Record<string, unknown>, index: number) {
  const borderValue = card["borderColor"];
  if (
    "borderColor" in card &&
    borderValue !== undefined &&
    typeof borderValue !== "string"
  ) {
    return [`cards[${index}].borderColor must be a string if provided`];
  }
  return [];
}

/**
 * Validates cards metadata, including nested arrays and optional border colors.
 * @param obj - Parsed cards record to validate.
 * @returns Collection of issues discovered in the cards payload.
 * @source
 */
function validateCardsRecord(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  obj: any,
): string[] {
  const issues: string[] = [];
  if (typeof obj.userId !== "number") {
    issues.push("userId is missing or not a number");
  }
  if (Array.isArray(obj.cards)) {
    for (const [index, card] of obj.cards.entries()) {
      if (typeof card !== "object" || card === null) {
        issues.push(`cards[${index}] is not an object`);
        continue;
      }

      const cardSpecificIssues = [
        ...validateCardStringProps(card, index),
        ...validateCardBorderColor(card, index),
      ];
      if (cardSpecificIssues.length > 0) {
        issues.push(...cardSpecificIssues);
      }
    }
  } else {
    issues.push("cards is missing or not an array");
  }
  if (typeof obj.updatedAt !== "string") {
    issues.push("updatedAt is missing or not a string");
  }
  return issues;
}

/**
 * Validates that a username record stores a numeric value.
 * @param obj - Parsed value from the username key.
 * @returns Issues describing missing or invalid numeric data.
 * @source
 */
function validateUsernameRecord(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  obj: any,
): string[] {
  const issues: string[] = [];
  if (typeof obj !== "number") {
    issues.push("username record is not a number");
  }
  return issues;
}

/**
 * Validates that an analytics value is numeric.
 * @param val - Value retrieved from an analytics key.
 * @returns Issues describing invalid types.
 * @source
 */
function validateAnalyticsMetric(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  val: any,
): string[] {
  const issues: string[] = [];
  if (typeof val !== "number") {
    issues.push(`Expected a number but got ${typeof val}`);
  }
  return issues;
}

/**
 * Validates that an analytics report entry contains the expected metadata.
 * @param obj - Parsed report object from Redis.
 * @returns List of detected structural issues in the report.
 * @source
 */
function validateAnalyticsReport(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  obj: any,
): string[] {
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

/**
 * Validates every analytics report stored under the given Redis list key.
 * @param redisClient - Redis client used to read the list.
 * @param key - Redis key pointing to the analytics reports list.
 * @param inconsistencies - Collector for any discovered problems.
 * @returns Counts of keys checked and issues found.
 * @source
 */
async function validateAnalyticsReportsList(
  redisClient: UpstashRedis,
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

/**
 * Validates a single Redis key according to its prefix pattern.
 * @param redisClient - Redis client used to read the key.
 * @param key - Redis key being validated.
 * @param inconsistencies - Collector for issues discovered during validation.
 * @returns Counts of keys checked and issues found for this key.
 * @source
 */
async function validateIndividualKey(
  redisClient: UpstashRedis,
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

/**
 * Iterates through keys matching the pattern and validates each entry.
 * @param redisClient - Redis client used to gather keys.
 * @param pattern - Key pattern to expand.
 * @param inconsistencies - Collector for any mismatches discovered.
 * @returns Totals for keys checked and inconsistencies found across the pattern.
 * @source
 */
async function validatePatternKeys(
  redisClient: UpstashRedis,
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

/**
 * Constructs and persists a validation report summarizing issues.
 * @param redisClient - Redis client used to push the report to a list.
 * @param summary - Summary string describing the validation run.
 * @param details - Per-pattern details including checked counts.
 * @param inconsistencies - Collected issues from the run.
 * @returns Saved report object ready to send back to the caller.
 * @source
 */
async function createAndSaveReport(
  redisClient: UpstashRedis,
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

/**
 * Runs the data validation cron job and returns a report of discovered issues.
 * @param request - Incoming request that must include the cron secret header.
 * @returns HTTP response containing the validation report or an error message.
 * @source
 */
export async function POST(request: Request) {
  // Check authorization
  const authError = checkCronAuthorization(request);
  if (authError) {
    return authError;
  }

  const startTime = Date.now();
  console.log("🛠️ [Data Validation Check] Starting data validation check...");

  try {
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
