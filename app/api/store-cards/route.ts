import { CardConfig } from "@/lib/types/records";
import { NextResponse } from "next/server";
import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";
import { CardsRecord } from "@/lib/types/records";

const redisClient = Redis.fromEnv();
const ratelimit = new Ratelimit({
	redis: redisClient,
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

		// Use a Redis key to store the user's card configurations
		const cardsKey = `cards:${userId}`;
		const cardData: CardsRecord = {
			userId,
			cards: incomingCards.map((card: CardConfig) => ({
				cardName: card.cardName,
				variation: card.variation || "default",
				titleColor: card.titleColor,
				backgroundColor: card.backgroundColor,
				textColor: card.textColor,
				circleColor: card.circleColor,
			})),
			updatedAt: new Date().toISOString(),
		};

		// Save card configuration to Redis
		await redisClient.set(cardsKey, JSON.stringify(cardData));

		const duration = Date.now() - startTime;
		console.log(`✅ [Store Cards] Stored cards for user ${userId} [${duration}ms]`);

		return NextResponse.json({
			success: true,
			userId,
		});
	} catch (error) {
		const duration = Date.now() - startTime;
		console.error(`🔴 [Store Cards] Error after ${duration}ms:`, error);
		return NextResponse.json({ error: "Card storage failed" }, { status: 500 });
	}
}
