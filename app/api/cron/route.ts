import { MongoServerError } from "mongodb";
import { USER_STATS_QUERY } from "@/lib/anilist/queries";
import { extractErrorInfo } from "@/lib/utils";
import clientPromise from "@/lib/utils/mongodb";
// Background job for batch updating user stats from AniList

export async function GET(request: Request) {
	try {
		// Authorization check
		const authHeader = request.headers.get("Authorization");
		if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
			console.error("Unauthorized cron job attempt");
			return new Response("Unauthorized", { status: 401 });
		}

		const client = await clientPromise;
		const db = client.db("anicards");
		const users = await db.collection("users").find().toArray();
		const totalUsers = users.length;
		let processedCount = 0;

		console.log(`🚀 Starting cron job with ${users.length} users to process`);

		// Batch processing configuration
		const ANILIST_RATE_LIMIT = 10; // Max requests per minute to AniList API
		const DELAY_MS = 60000; // 1 minute between batches

		// Process users in rate-limited batches
		while (processedCount < totalUsers) {
			const batch = users.slice(processedCount, processedCount + ANILIST_RATE_LIMIT);
			console.log(
				`🔧 Processing batch ${processedCount / ANILIST_RATE_LIMIT + 1}: Users ${
					processedCount + 1
				}-${processedCount + batch.length}`
			);

			// Parallel processing of batch with retry logic
			await Promise.all(
				batch.map(async (user) => {
					const userLogPrefix = `👤 User ${user.userId} (${
						user.username || "no username"
					})`;
					console.log(`${userLogPrefix}: Starting update`);

					// Retry failed requests up to 3 times
					let retries = 3;
					while (retries > 0) {
						try {
							console.log(
								`${userLogPrefix}: Attempt ${4 - retries}/3 - Fetching AniList data`
							);

							// Fetch latest stats from AniList GraphQL API
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

							// Update MongoDB with new stats
							await db
								.collection("users")
								.updateOne(
									{ userId: user.userId },
									{ $set: { stats: statsData.data, updatedAt: new Date() } }
								);
							console.log(`${userLogPrefix}: Successfully updated database`);
							break; // Exit retry loop on success
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
				})
			);

			processedCount += batch.length;
			console.log(`✅ Completed batch. Total processed: ${processedCount}/${totalUsers}`);

			// Rate limit enforcement between batches
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
		if (error instanceof MongoServerError) {
			error = extractErrorInfo(error);
		}
		console.error(`💥 Cron job failed: ${error.message}`);
		return new Response("Cron job failed", { status: 500 });
	}
}
