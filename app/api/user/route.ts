import { NextResponse } from "next/server";
import { MongoClient } from "mongodb";
import { ServerApiVersion } from "mongodb";
import { UserStats } from "@/lib/types/card";

export async function GET(request: Request) {
	const { searchParams } = new URL(request.url);
	const userId = searchParams.get("userId");

	if (!userId) {
		return NextResponse.json({ error: "Missing user ID parameter" }, { status: 400 });
	}

	const numericUserId = parseInt(userId);
	if (isNaN(numericUserId)) {
		return NextResponse.json({ error: "Invalid user ID format" }, { status: 400 });
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
		const userData = (await db.collection("users").findOne(
			{ userId: numericUserId },
			{ projection: { _id: 0, createdAt: 0, ip: 0, updatedAt: 0 } }
		)) as unknown as UserStats;

		await client.close();

		if (!userData) {
			return NextResponse.json({ error: "User not found" }, { status: 404 });
		}

		return NextResponse.json(userData);
	} catch (error) {
		console.error("Database error:", error);
		return NextResponse.json({ error: "Failed to fetch user data" }, { status: 500 });
	}
}
