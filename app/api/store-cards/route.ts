import { NextResponse } from "next/server";
import { MongoServerError } from "mongodb";
import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";
import { CardsDocument } from "@/lib/types/card";
import { extractErrorInfo } from "@/lib/utils";
import { connectToDatabase } from "@/lib/utils/mongodb";

const ratelimit = new Ratelimit({
	redis: Redis.fromEnv(),
	limiter: Ratelimit.slidingWindow(5, "5 s"),
});

// API endpoint for storing/updating user card configurations
export async function POST(request: Request) {
	const startTime = Date.now();
	const ip = request.headers.get("x-forwarded-for") || "127.0.0.1";
	console.log(`🔵 [Store Cards] Request from IP: ${ip}`);

	const { success } = await ratelimit.limit(ip);
	if (!success) {
		console.warn(`⚠️ [Store Cards] Rate limited IP: ${ip}`);
		return NextResponse.json({ error: "Too many requests" }, { status: 429 });
	}

	const authToken = request.headers.get("Authorization");
	if (!authToken || authToken !== `Bearer ${process.env.API_AUTH_TOKEN}`) {
		console.warn(`⚠️ [Store Cards] Invalid auth token from IP: ${ip}`);
		return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
	}

	try {
		const body = await request.json();
		const { statsData, userId, cards: incomingCards } = body;
		console.log(
			`🔍 [Store Cards] Processing user ${userId} with ${incomingCards?.length || 0} cards`
		);

		if (statsData?.error) {
			console.warn(`⚠️ [Store Cards] Invalid data for user ${userId}: ${statsData.error}`);
			return NextResponse.json(
				{ error: "Invalid data: " + statsData.error },
				{ status: 400 }
			);
		}

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

		console.log(`🔄 [Store Cards] Updating cards for user ${userId}`);
		// Complex MongoDB array update using aggregation pipeline
		const updateResult = await db.collection<CardsDocument>("cards").updateOne(
			{ userId },
			[
				{
					$set: {
						cards: {
							$concatArrays: [
								// Merge existing cards with updated values
								{
									$map: {
										input: { $ifNull: ["$cards", []] },
										as: "existingCard",
										in: {
											$mergeObjects: [
												"$$existingCard",
												// Find matching incoming card data
												{
													$arrayElemAt: [
														{
															$filter: {
																input: incomingCards,
																as: "incoming",
																cond: {
																	$eq: [
																		"$$incoming.cardName",
																		"$$existingCard.cardName",
																	],
																},
															},
														},
														0,
													],
												},
											],
										},
									},
								},
								// Add new cards that don't exist yet
								{
									$map: {
										input: {
											$filter: {
												input: incomingCards,
												as: "incoming",
												cond: {
													$not: {
														$in: [
															"$$incoming.cardName",
															{ $ifNull: ["$cards.cardName", []] },
														],
													},
												},
											},
										},
										as: "newCard",
										in: { $mergeObjects: ["$$newCard"] },
									},
								},
							],
						},
						updatedAt: new Date(),
						userId: { $ifNull: ["$userId", userId] }, // Fallback for upsert
					},
				},
			],
			{ upsert: true } // Create document if it doesn't exist
		);

		// Track request duration for performance monitoring
		const duration = Date.now() - startTime;

		// Determine if document was newly created
		const isNewDoc = updateResult.upsertedId !== null;

		// Log operation outcome with performance metrics
		console.log(
			`✅ [Store Cards] ${isNewDoc ? "Created" : "Updated"} cards for user ${userId} (${
				updateResult.modifiedCount
			} modified) [${duration}ms]`
		);

		// Return standardized success response
		return NextResponse.json({
			success: true,
			updatedCount: updateResult.modifiedCount, // Number of modified documents
			isNewDocument: isNewDoc, // Flag for new document creation
		});
	} catch (error) {
		// Track request duration for performance monitoring
		const duration = Date.now() - startTime;

		// Handle MongoDB-specific validation errors
		if (error instanceof MongoServerError) {
			error = extractErrorInfo(error); // Simplify complex error structure
		}

		// Return generic error to client with server error status
		console.error(`🔴 [Store Cards] Error after ${duration}ms:`, error);
		return NextResponse.json({ error: "Card storage failed" }, { status: 500 });
	}
}
