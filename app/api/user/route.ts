import { NextResponse } from "next/server";
import { Redis } from "@upstash/redis";
import { UserRecord } from "@/lib/types/records";
import { safeParse } from "@/lib/utils";

// API endpoint for fetching user data from Redis
export async function GET(request: Request) {
	const startTime = Date.now();
	const { searchParams } = new URL(request.url);
	const userId = searchParams.get("userId");

	console.log(`🔵 [User API] Request received for userId: ${userId}`);

	// Validate required user ID parameter
	if (!userId) {
		console.warn("⚠️ [User API] Missing user ID parameter");
		return NextResponse.json({ error: "Missing user ID parameter" }, { status: 400 });
	}

	// Convert to numeric ID and validate format
	const numericUserId = parseInt(userId);
	if (isNaN(numericUserId)) {
		console.warn(`⚠️ [User API] Invalid user ID format: ${userId}`);
		return NextResponse.json({ error: "Invalid user ID format" }, { status: 400 });
	}

	try {
		const redisClient = Redis.fromEnv();
		const key = `user:${numericUserId}`;
		const userDataRaw = await redisClient.get(key);
		const duration = Date.now() - startTime;

		if (!userDataRaw) {
			console.warn(`⚠️ [User API] User ${numericUserId} not found [${duration}ms]`);
			return NextResponse.json({ error: "User not found" }, { status: 404 });
		}

		const userData: UserRecord = safeParse<UserRecord>(userDataRaw);
		console.log(
			`✅ [User API] Successfully returned data for user ${numericUserId} [${duration}ms]`
		);
		return NextResponse.json(userData);
	} catch (error) {
		const duration = Date.now() - startTime;
		console.error(`🔴 [User API] Error for user ${numericUserId} [${duration}ms]:`, error);
		return NextResponse.json({ error: "Failed to fetch user data" }, { status: 500 });
	}
}
