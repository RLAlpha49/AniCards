import { NextResponse } from "next/server";
import { MongoServerError } from "mongodb";
import { extractErrorInfo } from "@/lib/utils";
import { connectToDatabase } from "@/lib/utils/mongodb";

// API endpoint for retrieving user card configurations
export async function GET(request: Request) {
	const startTime = Date.now();
	const { searchParams } = new URL(request.url);
	const userId = searchParams.get("userId");

	console.log(`🔵 [Cards API] Request received for userId: ${userId}`);

	// Validate required user ID parameter
	if (!userId) {
		console.warn("⚠️ [Cards API] Missing user ID parameter");
		return NextResponse.json({ error: "Missing user ID parameter" }, { status: 400 });
	}

	// Convert and validate numeric user ID
	const numericUserId = parseInt(userId);
	if (isNaN(numericUserId)) {
		console.warn(`⚠️ [Cards API] Invalid user ID format: ${userId}`);
		return NextResponse.json({ error: "Invalid user ID format" }, { status: 400 });
	}

	try {
		console.log(`🔍 [Cards API] Querying cards for user ${numericUserId}`);
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

		// Use the db instance
		const cards = await db
			.collection("cards")
			.find(
				{ userId: numericUserId },
				{
					projection: {
						_id: 0, // Exclude MongoDB ID
						updatedAt: 0, // Exclude internal timestamp
						userId: 0, // Exclude redundant user ID
					},
				}
			)
			.toArray();

		const duration = Date.now() - startTime;

		console.log(
			`✅ [Cards API] Found ${cards[0].cards.length} cards for user ${numericUserId} [${duration}ms]`
		);
		// Return formatted response
		return NextResponse.json(cards);
	} catch (error) {
		const duration = Date.now() - startTime;
		// Handle MongoDB-specific errors
		if (error instanceof MongoServerError) {
			error = extractErrorInfo(error);
		}
		console.error(
			`🔴 [Cards API] Error fetching cards for user ${numericUserId} [${duration}ms]:`,
			error
		);
		return NextResponse.json({ error: "Failed to fetch cards" }, { status: 500 });
	}
}
