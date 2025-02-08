import { NextResponse } from "next/server";
import { MongoClient } from "mongodb";
import { ServerApiVersion } from "mongodb";

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
		const cards = await db
			.collection("cards")
			.find({ userId: numericUserId }, { projection: { _id: 0, updatedAt: 0, userId: 0 } })
			.toArray();
		await client.close();

		return NextResponse.json(cards);
	} catch (error) {
		console.error("Database error:", error);
		return NextResponse.json({ error: "Failed to fetch cards" }, { status: 500 });
	}
}
