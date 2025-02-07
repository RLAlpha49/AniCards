import { NextResponse } from "next/server";
import { MongoClient, ServerApiVersion } from "mongodb";
import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

const ratelimit = new Ratelimit({
	redis: Redis.fromEnv(),
	limiter: Ratelimit.slidingWindow(5, "10 s"),
});

export async function POST(request: Request) {
	const ip = request.headers.get("x-forwarded-for") || "127.0.0.1";
	const { success } = await ratelimit.limit(ip);

	if (!success) {
		return NextResponse.json({ error: "Too many requests" }, { status: 429 });
	}

	const authToken = request.headers.get("Authorization");
	const data = await request.json();

	// Basic validation
	if (!authToken || authToken !== `Bearer ${process.env.API_AUTH_TOKEN}`) {
		return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
	}

	if (!data.username || !data.selectedCards?.length) {
		return NextResponse.json({ error: "Invalid data" }, { status: 400 });
	}

	try {
		const client = new MongoClient(process.env.MONGODB_URI!, {
			serverApi: {
				version: ServerApiVersion.v1,
				strict: true,
				deprecationErrors: true,
			},
		});
		const db = client.db("main");

		const result = await db.collection("cards").updateOne(
			{ userId: data.userId },
			{
				$set: {
					username: data.username,
					titleColor: data.titleColor,
					backgroundColor: data.backgroundColor,
					textColor: data.textColor,
					circleColor: data.circleColor,
					selectedCards: data.selectedCards,
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

		await client.close();

		return NextResponse.json({
			success: true,
			id: result.upsertedId || data.userId,
			existed: result.matchedCount > 0,
		});
	} catch (error) {
		console.error("Database error:", error);
		return NextResponse.json({ error: "Database operation failed" }, { status: 500 });
	}
}
