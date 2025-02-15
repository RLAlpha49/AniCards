import { Redis } from "@upstash/redis";
import { safeParse } from "@/lib/utils";

export async function POST(request: Request) {
	// Check for the required cron secret
	const CRON_SECRET = process.env.CRON_SECRET;
	const cronSecretHeader = request.headers.get("x-cron-secret");

	if (CRON_SECRET) {
		if (cronSecretHeader !== CRON_SECRET) {
			console.error("🔒 [Usage Stats] Unauthorized: Invalid Cron secret");
			return new Response("Unauthorized", { status: 401 });
		}
	} else {
		console.warn("No CRON_SECRET env variable set. Skipping authorization check.");
	}

	const startTime = Date.now();
	console.log("🛠️ [Usage Stats] Starting usage statistics aggregation...");

	try {
		const redisClient = Redis.fromEnv();
		// Define Redis key pattern for usage statistics data
		const usageKeys = await redisClient.keys("usage:*");

		// Initialize aggregated statistics
		let totalKeys = 0;
		let totalViews = 0;
		let totalUniqueVisitors = 0;
		const details: Array<{ key: string; data?: any; error?: string }> = [];

		// Process each usage key
		for (const key of usageKeys) {
			totalKeys++;
			try {
				const valueStr = await redisClient.get(key);
				if (!valueStr) {
					details.push({ key, error: "Value is null or missing" });
					continue;
				}
				// Safely parse the JSON value stored in Redis
				const data = safeParse<any>(valueStr);
				if (!data) {
					details.push({ key, error: "Failed to parse JSON" });
					continue;
				}
				// Aggregate values if present
				if (typeof data.views === "number") {
					totalViews += data.views;
				}
				if (typeof data.uniqueVisitors === "number") {
					totalUniqueVisitors += data.uniqueVisitors;
				}
				details.push({ key, data });
			} catch (error: any) {
				details.push({ key, error: error.message });
			}
		}

		const duration = Date.now() - startTime;
		const summary = `Usage statistics aggregated in ${duration}ms: ${totalKeys} keys processed, total views: ${totalViews}, total unique visitors: ${totalUniqueVisitors}.`;

		console.log(`🛠️ [Usage Stats] ${summary}`);
		return new Response(JSON.stringify({ summary, details }), {
			status: 200,
			headers: { "Content-Type": "application/json" },
		});
	} catch (error: any) {
		console.error(`🔥 [Usage Stats] Job failed: ${error.message}`);
		if (error.stack) {
			console.error(`💥 [Usage Stats] Stack Trace: ${error.stack}`);
		}
		return new Response("Usage statistics aggregation failed", { status: 500 });
	}
} 