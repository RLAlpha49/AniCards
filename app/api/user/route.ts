import { NextResponse } from "next/server";
import { MongoClient } from "mongodb";
import { ServerApiVersion } from "mongodb";
import { UserStats } from "@/lib/types/card";

export async function GET(request: Request) {
	const startTime = Date.now();
	const { searchParams } = new URL(request.url);
	const userId = searchParams.get("userId");

	console.log(`🔵 [User API] Request received for userId: ${userId}`);

	if (!userId) {
		console.warn("⚠️ [User API] Missing user ID parameter");
		return NextResponse.json({ error: "Missing user ID parameter" }, { status: 400 });
	}

	const numericUserId = parseInt(userId);
	if (isNaN(numericUserId)) {
		console.warn(`⚠️ [User API] Invalid user ID format: ${userId}`);
		return NextResponse.json({ error: "Invalid user ID format" }, { status: 400 });
	}

	try {
		console.log(`🔍 [User API] Querying database for user ${numericUserId}`);
		const client = new MongoClient(process.env.MONGODB_URI!, {
			serverApi: {
				version: ServerApiVersion.v1,
				strict: true,
				deprecationErrors: true,
			},
		});

		const db = client.db("anicards");
		const userData = (await db
			.collection("users")
			.findOne(
				{ userId: numericUserId },
				{ projection: { _id: 0, createdAt: 0, ip: 0, updatedAt: 0 } }
			)) as unknown as UserStats;

		await client.close();
		const duration = Date.now() - startTime;

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
		console.error(
			`🔴 [User API] Database error for user ${numericUserId} [${duration}ms]:`,
			error
		);
		return NextResponse.json({ error: "Failed to fetch user data" }, { status: 500 });
	}
}
