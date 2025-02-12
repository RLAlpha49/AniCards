import { NextResponse } from "next/server";
import { Redis } from "@upstash/redis";
import { CardsRecord } from "@/lib/types/records";
import { safeParse } from "@/lib/utils";

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
		const redisClient = Redis.fromEnv();
		const key = `cards:${numericUserId}`;
		const cardDataStr = await redisClient.get(key);
		const duration = Date.now() - startTime;

		if (!cardDataStr) {
			console.warn(
				`⚠️ [Cards API] Cards for user ${numericUserId} not found [${duration}ms]`
			);
			return NextResponse.json({ error: "Cards not found" }, { status: 404 });
		}

		const cardData: CardsRecord = safeParse<CardsRecord>(cardDataStr);
		console.log(
			`✅ [Cards API] Successfully returned card data for user ${numericUserId} [${duration}ms]`
		);
		return NextResponse.json(cardData);
	} catch (error) {
		const duration = Date.now() - startTime;
		console.error(`🔴 [Cards API] Error for user ${numericUserId} [${duration}ms]:`, error);
		return NextResponse.json({ error: "Failed to fetch cards" }, { status: 500 });
	}
}
