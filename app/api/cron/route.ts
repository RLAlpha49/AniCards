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

		console.log(`🚀 Starting cron job with ${users.length} users to process`);

		// Process users in batches of 10 per minute
		while (processedCount < totalUsers) {
			const batch = users.slice(processedCount, processedCount + ANILIST_RATE_LIMIT);
			console.log(
				`🔧 Processing batch ${processedCount / ANILIST_RATE_LIMIT + 1}: Users ${
					processedCount + 1
				}-${processedCount + batch.length}`
			);

			await Promise.all(
				batch.map(async (user) => {
					const userLogPrefix = `👤 User ${user.userId} (${
						user.username || "no username"
					})`;
					console.log(`${userLogPrefix}: Starting update`);

					try {
						// Add retry logic with 3 attempts
						let retries = 3;
						while (retries > 0) {
							try {
								console.log(
									`${userLogPrefix}: Attempt ${
										4 - retries
									}/3 - Fetching AniList data`
								);

								const statsResponse = await fetch("https://graphql.anilist.co", {
									method: "POST",
									headers: { "Content-Type": "application/json" },
									body: JSON.stringify({
										query: USER_STATS_QUERY,
										variables: { userId: user.userId },
									}),
								});

								if (!statsResponse.ok) {
									console.error(
										`${userLogPrefix}: API responded with ${statsResponse.status}`
									);
									throw new Error(`HTTP ${statsResponse.status}`);
								}

								const statsData = await statsResponse.json();
								console.log(
									`${userLogPrefix}: Received ${
										Object.keys(statsData.data).length
									} stats`
								);

								await db
									.collection("users")
									.updateOne(
										{ userId: user.userId },
										{ $set: { stats: statsData.data, updatedAt: new Date() } }
									);
								console.log(`${userLogPrefix}: Successfully updated database`);
								break;
								// eslint-disable-next-line @typescript-eslint/no-explicit-any
							} catch (error: any) {
								retries--;
								if (retries === 0) {
									console.error(
										`${userLogPrefix}: Final attempt failed - ${error.message}`
									);
								} else {
									console.warn(
										`${userLogPrefix}: Retrying (${retries} left) - ${error.message}`
									);
								}
							}
						}
						// eslint-disable-next-line @typescript-eslint/no-explicit-any
					} catch (error: any) {
						console.error(`${userLogPrefix}: Update failed - ${error.message}`);
					}
				})
			);

			processedCount += batch.length;
			console.log(`✅ Completed batch. Total processed: ${processedCount}/${totalUsers}`);

			// Wait 1 minute between batches unless we're done
			if (processedCount < totalUsers) {
				console.log(`⏳ Waiting ${DELAY_MS / 1000} seconds before next batch...`);
				await new Promise((resolve) => setTimeout(resolve, DELAY_MS));
			}
		}

		console.log(
			`🎉 Cron job completed successfully. Total updated: ${processedCount}/${totalUsers}`
		);
		return new Response(`Updated ${processedCount}/${totalUsers} users successfully`, {
			status: 200,
		});
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
	} catch (error: any) {
		console.error(`💥 Cron job failed: ${error.message}`);
		return new Response("Cron job failed", { status: 500 });
	}
}
