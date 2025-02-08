import { NextResponse } from "next/server";
import { MongoClient, ServerApiVersion } from "mongodb";
import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";
import { UserDocument } from "@/lib/types/card";

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
	if (!authToken || authToken !== `Bearer ${process.env.API_AUTH_TOKEN}`) {
		return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
	}

	try {
		const client = new MongoClient(process.env.MONGODB_URI!, {
			serverApi: {
				version: ServerApiVersion.v1,
				strict: true,
				deprecationErrors: true,
			},
		});
		const db = client.db("anicards");
		const data = await request.json();

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

		await client.close();

		return NextResponse.json({
			success: true,
			userId: data.userId,
			isNewUser: userResult.upsertedId !== null,
		});
	} catch (error) {
		console.error("Database error:", error);
		return NextResponse.json({ error: "User storage failed" }, { status: 500 });
	}
}
