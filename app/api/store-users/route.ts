import { NextResponse } from "next/server";
import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";
import { UserRecord } from "@/lib/types/records";
import { safeParse } from "@/lib/utils";

const redisClient = Redis.fromEnv();
const ratelimit = new Ratelimit({
	redis: redisClient,
	limiter: Ratelimit.slidingWindow(5, "5 s"),
});

// API endpoint for storing/updating user data using Redis as the persistent store
export async function POST(request: Request) {
	const startTime = Date.now();
	const ip = request.headers.get("x-forwarded-for") || "127.0.0.1";
	console.log(`🚀 [Store Users] Incoming request from IP: ${ip}`);

	// Rate limiting (5 requests/5 seconds per IP)
	const { success } = await ratelimit.limit(ip);
	if (!success) {
		console.warn(`🚨 [Store Users] Rate limited IP: ${ip}`);
		const analyticsClient = Redis.fromEnv();
		analyticsClient.incr("analytics:store_users:failed_requests").catch(() => {});
		return NextResponse.json({ error: "Too many requests" }, { status: 429 });
	}

	const authToken = request.headers.get("Authorization");
	// Validate API authorization token
	if (!authToken || authToken !== `Bearer ${process.env.API_AUTH_TOKEN}`) {
		console.warn(`⚠️ [Store Users] Invalid auth token from IP: ${ip}`);
		const analyticsClient = Redis.fromEnv();
		analyticsClient.incr("analytics:store_users:failed_requests").catch(() => {});
		return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
	}

	try {
		const data = await request.json();
		console.log(
			`📝 [Store Users] Processing user ${data.userId} (${data.username || "no username"})`
		);

		// Define a Redis key for the user data
		const userKey = `user:${data.userId}`;
		let createdAt = new Date().toISOString();

		// Retrieve the stored record from Redis
		const storedRecordRaw = await redisClient.get(userKey);
		if (storedRecordRaw) {
			console.log(`🔍 [Store Users] Found existing record for user ${data.userId}`);
			try {
				// Directly parse the JSON string from Redis
				const parsedUser = safeParse<UserRecord>(storedRecordRaw);
				createdAt = parsedUser.createdAt || createdAt;
				// eslint-disable-next-line @typescript-eslint/no-explicit-any
			} catch (error: any) {
				console.error(
					`🔥 [Store Users] Failed to parse user record from Redis. Data received: ${storedRecordRaw}`
				);
				if (error.stack) {
					console.error(`💥 [Store Users] Stack Trace: ${error.stack}`);
				}
			}
		} else {
			console.log(
				`📝 [Store Users] No existing record found for user ${data.userId}. Creating new record.`
			);
		}

		const userData: UserRecord = {
			userId: data.userId,
			username: data.username,
			stats: data.stats,
			ip,
			createdAt,
			updatedAt: new Date().toISOString(),
		};

		console.log(`📝 [Store Users] Saving user data to Redis under key: ${userKey}`);
		// Save (or update) the user data in Redis
		await redisClient.set(userKey, JSON.stringify(userData));

		// Create/update the username index if a username is provided.
		if (data.username) {
			const normalizedUsername = data.username.trim().toLowerCase();
			const usernameIndexKey = `username:${normalizedUsername}`;
			console.log(`📝 [Store Users] Updating username index for: ${normalizedUsername}`);
			await redisClient.set(usernameIndexKey, data.userId.toString());
		}

		const duration = Date.now() - startTime;
		console.log(`✅ [Store Users] Successfully stored user ${data.userId} [${duration}ms]`);

		const analyticsClient = Redis.fromEnv();
		analyticsClient.incr("analytics:store_users:successful_requests").catch(() => {});
		return NextResponse.json({
			success: true,
			userId: data.userId,
		});
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
	} catch (error: any) {
		const duration = Date.now() - startTime;
		console.error(`🔥 [Store Users] Error after ${duration}ms: ${error.message}`);
		if (error.stack) {
			console.error(`💥 [Store Users] Stack Trace: ${error.stack}`);
		}
		const analyticsClient = Redis.fromEnv();
		analyticsClient.incr("analytics:store_users:failed_requests").catch(() => {});
		return NextResponse.json({ error: "User storage failed" }, { status: 500 });
	}
}
