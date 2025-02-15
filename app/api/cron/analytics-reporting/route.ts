import { Redis } from "@upstash/redis";
import { safeParse } from "@/lib/utils";

export async function POST(request: Request) {
	// Check for the required cron secret
	const CRON_SECRET = process.env.CRON_SECRET;
	const cronSecretHeader = request.headers.get("x-cron-secret");

	if (CRON_SECRET) {
		if (cronSecretHeader !== CRON_SECRET) {
			console.error("🔒 [Analytics & Reporting] Unauthorized: Invalid Cron secret");
			return new Response("Unauthorized", { status: 401 });
		}
	} else {
		console.warn("No CRON_SECRET env variable set. Skipping authorization check.");
	}

	const startTime = Date.now();
	console.log("🛠️ [Analytics & Reporting] Starting analytics and reporting job...");

	try {
		const redisClient = Redis.fromEnv();

		// Define Redis key patterns to fetch analytics data.
		const analyticsPattern = "analytics:*";
		const analyticsKeys = await redisClient.keys(analyticsPattern);

		// Object to store raw analytics data
		const analyticsData: Record<string, number> = {};

		// For each key, get its value and try parsing it.
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

		// Group analytics data by service and metric.
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		const summary: Record<string, any> = {};
		for (const [key, value] of Object.entries(analyticsData)) {
			const parts = key.split(":");
			// keys like "analytics:visits" fall here
			if (parts.length === 2) {
				summary[parts[1]] = value;
			} else if (parts.length >= 3) {
				// keys like "analytics:anilist_api:successful_requests" or even dynamic ones (e.g. card_svg subtypes)
				const service = parts[1];
				const metric = parts.slice(2).join(":");
				if (!summary[service]) {
					summary[service] = {};
				}
				summary[service][metric] = value;
			}
		}

		// Build the analytics report (excluding visits and clicks)
		const report = {
			summary, // Grouped analytics data by service names
			raw_data: analyticsData,
			generatedAt: new Date().toISOString(),
		};

		// Save the report into the database.
		await redisClient.lpush("analytics:reports", JSON.stringify(report));

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
