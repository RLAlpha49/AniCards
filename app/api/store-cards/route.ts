import { NextResponse } from "next/server";
import { MongoClient, ServerApiVersion } from "mongodb";
import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";
import { CardsDocument } from "@/lib/types/card";

const ratelimit = new Ratelimit({
	redis: Redis.fromEnv(),
	limiter: Ratelimit.slidingWindow(10, "10 s"),
});

export async function POST(request: Request) {
	const ip = request.headers.get("x-forwarded-for") || "127.0.0.1";
	const { success } = await ratelimit.limit(ip);

	if (!success) {
		return NextResponse.json({ error: "Too many requests" }, { status: 429 });
	}

	const authToken = request.headers.get("Authorization");
	if (!authToken || authToken !== `Bearer ${process.env.API_AUTH_TOKEN}`) {
		return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
	}

	try {
		const body = await request.json();
		const { statsData, userId, cards: incomingCards } = body;

		if (statsData?.error) {
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

		return NextResponse.json({
			success: true,
			updatedCount: updateResult.modifiedCount,
			isNewDocument: updateResult.upsertedId !== null,
		});
	} catch (error) {
		console.error("Card storage failed:", error);
		return NextResponse.json({ error: "Card storage failed" }, { status: 500 });
	}
}
