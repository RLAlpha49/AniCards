import { MongoClient } from "mongodb";
import { ServerApiVersion } from "mongodb";
import { USER_STATS_QUERY } from "@/lib/anilist/queries";

const ANILIST_RATE_LIMIT = 10;
const DELAY_MS = 60000;

export async function GET(request: Request) {
	try {
		// Authorization check
		const authHeader = request.headers.get("Authorization");
		if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
			console.error("Unauthorized cron job attempt");
			return new Response("Unauthorized", { status: 401 });
		}

		const client = new MongoClient(process.env.MONGODB_URI!, {
			serverApi: {
				version: ServerApiVersion.v1,
				strict: true,
				deprecationErrors: true,
			},
		});

		const db = client.db("anicards");
		const users = await db.collection("users").find().toArray();
		const totalUsers = users.length;
		let processedCount = 0;

		// Process users in batches of 10 per minute
		while (processedCount < totalUsers) {
			const batch = users.slice(processedCount, processedCount + ANILIST_RATE_LIMIT);

			await Promise.all(
				batch.map(async (user) => {
					try {
						// Add retry logic with 3 attempts
						let retries = 3;
						while (retries > 0) {
							try {
								const statsResponse = await fetch("https://graphql.anilist.co", {
									method: "POST",
									headers: { "Content-Type": "application/json" },
									body: JSON.stringify({
										query: USER_STATS_QUERY,
										variables: { userId: user.userId },
									}),
								});

								if (!statsResponse.ok)
									throw new Error(`HTTP ${statsResponse.status}`);

								const statsData = await statsResponse.json();
								await db
									.collection("users")
									.updateOne(
										{ userId: user.userId },
										{ $set: { stats: statsData.data, lastUpdated: new Date() } }
									);
								break;
							} catch (error) {
								retries--;
								if (retries === 0) {
									console.error(
										`Failed to update user ${user.userId} after 3 attempts:`,
										error
									);
								}
							}
						}
					} catch (error) {
						console.error(`User ${user.userId} failed completely:`, error);
					}
				})
			);

			processedCount += batch.length;

			// Wait 1 minute between batches unless we're done
			if (processedCount < totalUsers) {
				await new Promise((resolve) => setTimeout(resolve, DELAY_MS));
			}
		}

		return new Response(`Updated ${processedCount}/${totalUsers} users successfully`, {
			status: 200,
		});
	} catch (error) {
		console.error("Cron job failed:", error);
		return new Response("Cron job failed", { status: 500 });
	}
}
