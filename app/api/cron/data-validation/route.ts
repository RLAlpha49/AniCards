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
		const patterns = ["user:*", "cards:*"];
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
				totalKeysChecked++;
				try {
					const valueStr = await redisClient.get(key);
					if (!valueStr) {
						totalInconsistencies++;
						patternIssues++;
						inconsistencies.push({ key, issues: ["Value is null or missing"] });
						continue;
					}
					// Attempt to safely parse the Redis value.
					// eslint-disable-next-line @typescript-eslint/no-explicit-any
					const parsed = safeParse<any>(valueStr);
					if (!parsed) {
						totalInconsistencies++;
						patternIssues++;
						inconsistencies.push({ key, issues: ["Failed to parse JSON"] });
						continue;
					}

					// Validate record using the imported interfaces.
					const issues: string[] = [];
					if (key.startsWith("user:")) {
						issues.push(...validateUserRecord(parsed));
					} else if (key.startsWith("cards:")) {
						issues.push(...validateCardsRecord(parsed));
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

		return new Response(JSON.stringify({ summary, details, issues: inconsistencies }), {
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
