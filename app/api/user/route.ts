import { NextResponse } from "next/server";
import { MongoServerError } from "mongodb";
import { UserStats } from "@/lib/types/card";
import { extractErrorInfo } from "@/lib/utils";
import clientPromise from "@/lib/utils/mongodb";

// API endpoint for fetching user data from MongoDB
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
		console.log(`🔍 [User API] Querying database for user ${numericUserId}`);
		// Configure MongoDB client with strict API versioning
		const client = await clientPromise;

		const db = client.db("anicards");
		// Find user while excluding sensitive/irrelevant fields
		const userData = (await db
			.collection("users")
			.findOne(
				{ userId: numericUserId },
				{ projection: { _id: 0, createdAt: 0, ip: 0, updatedAt: 0 } }
			)) as unknown as UserStats;

		const duration = Date.now() - startTime;

		// Handle user not found scenario
		if (!userData) {
			console.warn(`⚠️ [User API] User ${numericUserId} not found [${duration}ms]`);
			return NextResponse.json({ error: "User not found" }, { status: 404 });
		}

		console.log(
			`✅ [User API] Successfully returned data for user ${numericUserId} [${duration}ms]`
		);
		return NextResponse.json(userData);
	} catch (error) {
		const duration = Date.now() - startTime;
		// Handle MongoDB-specific errors
		if (error instanceof MongoServerError) {
			error = extractErrorInfo(error); // Simplify error structure
		}
		console.error(
			`🔴 [User API] Database error for user ${numericUserId} [${duration}ms]:`,
			error
		);
		return NextResponse.json({ error: "Failed to fetch user data" }, { status: 500 });
	}
}
