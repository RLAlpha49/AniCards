import { NextResponse } from "next/server";
import { MongoClient, MongoServerError, ServerApiVersion } from "mongodb";
import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";
import { UserDocument } from "@/lib/types/card";
import { extractErrorInfo } from "@/lib/utils";

const ratelimit = new Ratelimit({
	redis: Redis.fromEnv(),
	limiter: Ratelimit.slidingWindow(5, "10 s"),
});

export async function POST(request: Request) {
	const startTime = Date.now();
	const ip = request.headers.get("x-forwarded-for") || "127.0.0.1";
	console.log(`🔵 [Store Users] Request from IP: ${ip}`);

	const { success } = await ratelimit.limit(ip);
	if (!success) {
		console.warn(`⚠️ [Store Users] Rate limited IP: ${ip}`);
		return NextResponse.json({ error: "Too many requests" }, { status: 429 });
	}

	const authToken = request.headers.get("Authorization");
	if (!authToken || authToken !== `Bearer ${process.env.API_AUTH_TOKEN}`) {
		console.warn(`⚠️ [Store Users] Invalid auth token from IP: ${ip}`);
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

		console.log(
			`🔍 [Store Users] Processing user ${data.userId} (${data.username || "no username"})`
		);

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
		const duration = Date.now() - startTime;

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
		if (error instanceof MongoServerError) {
			error = extractErrorInfo(error);
		}
		console.error(`🔴 [Store Users] Error after ${duration}ms:`, error);
		return NextResponse.json({ error: "User storage failed" }, { status: 500 });
	}
}
