import { Redis } from "@upstash/redis";
import { safeParse } from "@/lib/utils";

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
				issues.push(`cards[${index}].backgroundColor is missing or not a string`);
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
	if (!("raw_data" in obj) || typeof obj.raw_data !== "object" || obj.raw_data === null) {
		issues.push("raw_data is missing or not an object");
	}
	if (!("summary" in obj) || typeof obj.summary !== "object" || obj.summary === null) {
		issues.push("summary is missing or not an object");
	}
	return issues;
}

export async function POST(request: Request) {
	// Check for the required cron secret
	const CRON_SECRET = process.env.CRON_SECRET;
	const cronSecretHeader = request.headers.get("x-cron-secret");

	if (CRON_SECRET) {
		if (cronSecretHeader !== CRON_SECRET) {
			console.error("🔒 [Data Validation Check] Unauthorized: Invalid Cron secret");
			return new Response("Unauthorized", { status: 401 });
		}
	} else {
		console.warn("No CRON_SECRET env variable set. Skipping authorization check.");
	}

	const startTime = Date.now();
	console.log("🛠️ [Data Validation Check] Starting data validation check...");

	try {
		const redisClient = Redis.fromEnv();

		// Define Redis key patterns to validate. Add more patterns as needed.
		const patterns = ["user:*", "cards:*", "username:*", "analytics:*"];
		let totalKeysChecked = 0;
		let totalInconsistencies = 0;
		const inconsistencies: Array<{ key: string; issues: string[] }> = [];
		const details: Record<string, { checked: number; inconsistencies: number }> = {};

		// Iterate over each pattern and check keys.
		for (const pattern of patterns) {
			const keys = await redisClient.keys(pattern);
			let patternChecked = 0;
			let patternIssues = 0;

			for (const key of keys) {
				patternChecked++;
				// For analytics keys, we handle list types or single number values
				try {
					// Special handling for the "analytics:reports" key (a list of reports)
					if (key === "analytics:reports") {
						const listElements = await redisClient.lrange(key, 0, -1);
						if (!listElements || listElements.length === 0) {
							totalInconsistencies++;
							patternIssues++;
							inconsistencies.push({ key, issues: ["List is empty"] });
						} else {
							// Validate each report in the list
							for (let i = 0; i < listElements.length; i++) {
								const reportStr = listElements[i];
								// eslint-disable-next-line @typescript-eslint/no-explicit-any
								const parsedReport = safeParse<any>(reportStr);
								const reportIssues = validateAnalyticsReport(parsedReport);
								if (reportIssues.length > 0) {
									totalInconsistencies++;
									patternIssues++;
									inconsistencies.push({
										key: `${key}[${i}]`,
										issues: reportIssues,
									});
								}
								totalKeysChecked++;
							}
						}
						continue;
					}

					// For all other keys, treat them as single value entries.
					totalKeysChecked++;
					const valueStr = await redisClient.get(key);
					if (!valueStr) {
						totalInconsistencies++;
						patternIssues++;
						inconsistencies.push({ key, issues: ["Value is null or missing"] });
						continue;
					}
					// Parse the value
					// eslint-disable-next-line @typescript-eslint/no-explicit-any
					const parsed = safeParse<any>(valueStr);
					if ((parsed === null || parsed === undefined) && parsed !== 0) {
						totalInconsistencies++;
						patternIssues++;
						inconsistencies.push({ key, issues: ["Failed to parse JSON"] });
						continue;
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
						totalInconsistencies++;
						patternIssues++;
						inconsistencies.push({ key, issues });
					}
					// eslint-disable-next-line @typescript-eslint/no-explicit-any
				} catch (error: any) {
					totalInconsistencies++;
					patternIssues++;
					inconsistencies.push({ key, issues: [error.message] });
				}
			}
			details[pattern] = { checked: patternChecked, inconsistencies: patternIssues };
		}

		const duration = Date.now() - startTime;
		const summary = `Data validation check completed in ${duration}ms: ${totalKeysChecked} keys checked, ${totalInconsistencies} issues found.`;

		console.log(`🛠️ [Data Validation Check] ${summary}`);
		if (inconsistencies.length > 0) {
			console.warn("🛠️ [Data Validation Check] Issues found:", inconsistencies);
		}

		// Build the data validation report
		const report = {
			summary,
			details,
			issues: inconsistencies,
			generatedAt: new Date().toISOString(),
		};

		// Save the validation report into the database (Redis list "data_validation:reports")
		await redisClient.lpush("data_validation:reports", JSON.stringify(report));

		// Return the report as the response
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
