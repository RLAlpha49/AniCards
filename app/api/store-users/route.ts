import { NextResponse } from "next/server";
import { MongoServerError } from "mongodb";
import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";
import { UserDocument } from "@/lib/types/card";
import { extractErrorInfo } from "@/lib/utils";
import { connectToDatabase } from "@/lib/utils/mongodb";

const ratelimit = new Ratelimit({
	redis: Redis.fromEnv(),
	limiter: Ratelimit.slidingWindow(1, "1 s"),
});

// API endpoint for storing/updating user data with rate limiting
export async function POST(request: Request) {
	const startTime = Date.now();
	const ip = request.headers.get("x-forwarded-for") || "127.0.0.1";
	console.log(`🔵 [Store Users] Request from IP: ${ip}`);

	// Rate limiting configuration (5 requests/10 seconds per IP)
	const { success } = await ratelimit.limit(ip);
	if (!success) {
		console.warn(`⚠️ [Store Users] Rate limited IP: ${ip}`);
		return NextResponse.json({ error: "Too many requests" }, { status: 429 });
	}

	const authToken = request.headers.get("Authorization");
	// Validate API authorization token
	if (!authToken || authToken !== `Bearer ${process.env.API_AUTH_TOKEN}`) {
		console.warn(`⚠️ [Store Users] Invalid auth token from IP: ${ip}`);
		return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
	}

	try {
		// Establish connection with type safety
		const mongooseInstance = await connectToDatabase();

		// Verify connection state
		if (mongooseInstance.connection.readyState !== 1) {
			throw new Error("MongoDB connection not ready");
		}

		// Access database with proper typing
		const db = mongooseInstance.connection.db;
		if (!db) {
			throw new Error("Database instance not available");
		}
		const data = await request.json();

		console.log(
			`🔍 [Store Users] Processing user ${data.userId} (${data.username || "no username"})`
		);

		// MongoDB update/insert operation
		const userResult = await db.collection<UserDocument>("users").updateOne(
			{ userId: data.userId },
			{
				$set: {
					username: data.username,
					stats: data.stats,
					updatedAt: new Date(),
				},
				$setOnInsert: {
					createdAt: new Date(),
					ip: ip,
					userId: data.userId,
				},
			},
			{ upsert: true }
		);

		const duration = Date.now() - startTime;

		// Determine if user was created or updated
		const isNewUser = userResult.upsertedId !== null;
		console.log(
			`✅ [Store Users] ${isNewUser ? "Created" : "Updated"} user ${
				data.userId
			} [${duration}ms]`
		);

		return NextResponse.json({
			success: true,
			userId: data.userId,
			isNewUser: isNewUser,
		});
	} catch (error) {
		const duration = Date.now() - startTime;
		// Handle MongoDB validation errors
		if (error instanceof MongoServerError) {
			error = extractErrorInfo(error);
		}
		console.error(`🔴 [Store Users] Error after ${duration}ms:`, error);
		return NextResponse.json({ error: "User storage failed" }, { status: 500 });
	}
}
