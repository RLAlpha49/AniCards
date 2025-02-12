import { USER_STATS_QUERY } from "@/lib/anilist/queries";
import { UserRecord } from "@/lib/types/records";
import { safeParse } from "@/lib/utils";
import { Redis } from "@upstash/redis";

// Background job for batch updating user stats from AniList

export async function GET(request: Request) {
	try {
		// Authorization check
		const authHeader = request.headers.get("Authorization");
		if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
			console.error("Unauthorized cron job attempt");
			return new Response("Unauthorized", { status: 401 });
		}

		const redisClient = Redis.fromEnv();
		// Get all user keys (assuming keys are stored as "user:{userId}")
		const userKeys = await redisClient.keys("user:*");
		const totalUsers = userKeys.length;
		let processedCount = 0;

		console.log(`🚀 Starting cron job with ${totalUsers} users to process`);

		const ANILIST_RATE_LIMIT = 10; // Max requests per minute
		const DELAY_MS = 60000; // 1 minute delay between batches

		// Process users in rate-limited batches
		while (processedCount < totalUsers) {
			const batch = userKeys.slice(processedCount, processedCount + ANILIST_RATE_LIMIT);
			console.log(
				`🔧 Processing batch ${
					Math.floor(processedCount / ANILIST_RATE_LIMIT) + 1
				}: Users ${processedCount + 1}-${processedCount + batch.length}`
			);

			await Promise.all(
				batch.map(async (key) => {
					try {
						const userDataStr = await redisClient.get(key);
						if (userDataStr) {
							const userData: UserRecord = safeParse<UserRecord>(userDataStr);
							console.log(
								`👤 User ${userData.userId} (${
									userData.username || "no username"
								}): Starting update`
							);

							// Retry failed requests up to 3 times
							let retries = 3;
							while (retries > 0) {
								try {
									console.log(
										`User ${userData.userId}: Attempt ${
											4 - retries
										}/3 - Fetching AniList data`
									);
									const statsResponse = await fetch(
										"https://graphql.anilist.co",
										{
											method: "POST",
											headers: { "Content-Type": "application/json" },
											body: JSON.stringify({
												query: USER_STATS_QUERY,
												variables: { userId: userData.userId },
											}),
										}
									);

									if (!statsResponse.ok) {
										throw new Error(`HTTP ${statsResponse.status}`);
									}

									const statsData = await statsResponse.json();
									userData.stats = statsData.data;
									userData.updatedAt = new Date().toISOString();
									await redisClient.set(key, JSON.stringify(userData));
									console.log(`User ${userData.userId}: Successfully updated`);
									break;
									// eslint-disable-next-line @typescript-eslint/no-explicit-any
								} catch (error: any) {
									retries--;
									if (retries === 0) {
										console.error(
											`User ${userData.userId}: Final attempt failed - ${error.message}`
										);
									} else {
										console.warn(
											`User ${userData.userId}: Retrying (${retries} left) - ${error.message}`
										);
									}
								}
							}
						} else {
							console.warn(`User data not found for key ${key}`);
						}
						// eslint-disable-next-line @typescript-eslint/no-explicit-any
					} catch (error: any) {
						console.error(`Error processing key ${key}: ${error.message}`);
					}
				})
			);

			processedCount += batch.length;
			console.log(`✅ Completed batch. Total processed: ${processedCount}/${totalUsers}`);

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
