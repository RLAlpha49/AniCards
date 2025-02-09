import { NextResponse } from "next/server";
import { MongoClient, ServerApiVersion } from "mongodb";

export async function GET(request: Request) {
	const startTime = Date.now();
	const { searchParams } = new URL(request.url);
	const userId = searchParams.get("userId");

	console.log(`🔵 [Cards API] Request received for userId: ${userId}`);

	if (!userId) {
		console.warn("⚠️ [Cards API] Missing user ID parameter");
		return NextResponse.json({ error: "Missing user ID parameter" }, { status: 400 });
	}

	const numericUserId = parseInt(userId);
	if (isNaN(numericUserId)) {
		console.warn(`⚠️ [Cards API] Invalid user ID format: ${userId}`);
		return NextResponse.json({ error: "Invalid user ID format" }, { status: 400 });
	}

	try {
		console.log(`🔍 [Cards API] Querying cards for user ${numericUserId}`);
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
		const duration = Date.now() - startTime;

		console.log(
			`✅ [Cards API] Found ${cards[0].cards.length} cards for user ${numericUserId} [${duration}ms]`
		);
		return NextResponse.json(cards);
	} catch (error) {
		const duration = Date.now() - startTime;
		console.error(
			`🔴 [Cards API] Error fetching cards for user ${numericUserId} [${duration}ms]:`,
			error
		);
		return NextResponse.json({ error: "Failed to fetch cards" }, { status: 500 });
	}
}
