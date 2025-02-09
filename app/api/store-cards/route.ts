import { NextResponse } from "next/server";
import { MongoClient, MongoServerError, ServerApiVersion } from "mongodb";
import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";
import { CardsDocument } from "@/lib/types/card";
import { extractErrorInfo } from "@/lib/utils";

const ratelimit = new Ratelimit({
	redis: Redis.fromEnv(),
	limiter: Ratelimit.slidingWindow(5, "10 s"),
});

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

		const client = new MongoClient(process.env.MONGODB_URI!, {
			serverApi: {
				version: ServerApiVersion.v1,
				strict: true,
				deprecationErrors: true,
			},
		});
		const db = client.db("anicards");
		const now = new Date();

		console.log(`🔄 [Store Cards] Updating cards for user ${userId}`);
		const updateResult = await db.collection<CardsDocument>("cards").updateOne(
			{ userId },
			[
				{
					$set: {
						cards: {
							$concatArrays: [
								// Update existing cards
								{
									$map: {
										input: { $ifNull: ["$cards", []] },
										as: "existingCard",
										in: {
											$mergeObjects: [
												"$$existingCard",
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
								// Add new cards with generated IDs
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
										in: {
											$mergeObjects: ["$$newCard"],
										},
									},
								},
							],
						},
						updatedAt: now,
						userId: { $ifNull: ["$userId", userId] },
					},
				},
			],
			{
				upsert: true,
				arrayFilters: undefined,
			}
		);

		const duration = Date.now() - startTime;
		const isNewDoc = updateResult.upsertedId !== null;
		console.log(
			`✅ [Store Cards] ${isNewDoc ? "Created" : "Updated"} cards for user ${userId} (${
				updateResult.modifiedCount
			} modified) [${duration}ms]`
		);

		return NextResponse.json({
			success: true,
			updatedCount: updateResult.modifiedCount,
			isNewDocument: isNewDoc,
		});
	} catch (error) {
		const duration = Date.now() - startTime;
		if (error instanceof MongoServerError) {
			error = extractErrorInfo(error);
		}
		console.error(`🔴 [Store Cards] Error after ${duration}ms:`, error);
		return NextResponse.json({ error: "Card storage failed" }, { status: 500 });
	}
}
