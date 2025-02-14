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
			console.error("🔒 [Cron Job] Unauthorized cron job attempt: Missing or invalid secret");
			return new Response("Unauthorized", { status: 401 });
		}

		console.log("🛠️ [Cron Job] Authorized, starting background update...");

		const redisClient = Redis.fromEnv();
		const userKeys = await redisClient.keys("user:*");
		const totalUsers = userKeys.length;
		let processedCount = 0;

		console.log(`🚀 [Cron Job] Starting cron job with ${totalUsers} users to process`);

		const ANILIST_RATE_LIMIT = 10; // Max requests per minute
		const DELAY_MS = 60000; // 1 minute delay between batches

		// Process users in rate-limited batches
		while (processedCount < totalUsers) {
			const batchStartTime = Date.now();
			const batch = userKeys.slice(processedCount, processedCount + ANILIST_RATE_LIMIT);
			console.log(
				`🔧 [Cron Job] Processing batch ${
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
								`👤 [Cron Job] User ${userData.userId} (${
									userData.username || "no username"
								}): Starting update`
							);

							// Retry failed requests up to 3 times
							let retries = 3;
							while (retries > 0) {
								try {
									console.log(
										`🔄 [Cron Job] User ${userData.userId}: Attempt ${
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
									console.log(
										`✅ [Cron Job] User ${userData.userId}: Successfully updated`
									);
									break; // Break out of the retry loop on success
									// eslint-disable-next-line @typescript-eslint/no-explicit-any
								} catch (error: any) {
									retries--;
									if (error.stack) {
										console.error(
											`💥 [Cron Job] User ${userData.userId}: Error detail: ${error.stack}`
										);
									}
									if (retries === 0) {
										console.error(
											`🔥 [Cron Job] User ${userData.userId}: Final attempt failed - ${error.message}`
										);
									} else {
										console.warn(
											`⚠️ [Cron Job] User ${userData.userId}: Retrying (${retries} left) - ${error.message}`
										);
									}
								}
							}
						} else {
							console.warn(`⚠️ [Cron Job] User data not found for key ${key}`);
						}
						// eslint-disable-next-line @typescript-eslint/no-explicit-any
					} catch (error: any) {
						console.error(
							`🔥 [Cron Job] Error processing key ${key}: ${error.message}`
						);
						if (error.stack) {
							console.error(`💥 [Cron Job] Stack Trace: ${error.stack}`);
						}
					}
				})
			);

			const batchDuration = Date.now() - batchStartTime;
			console.log(
				`✅ [Cron Job] Completed batch in ${batchDuration}ms. Total processed: ${
					processedCount + batch.length
				}/${totalUsers}`
			);
			processedCount += batch.length;

			if (processedCount < totalUsers) {
				console.log(
					`⏳ [Cron Job] Waiting ${DELAY_MS / 1000} seconds before next batch...`
				);
				await new Promise((resolve) => setTimeout(resolve, DELAY_MS));
			}
		}

		console.log(
			`🎉 [Cron Job] Cron job completed successfully. Total updated: ${processedCount}/${totalUsers}`
		);
		return new Response(`Updated ${processedCount}/${totalUsers} users successfully`, {
			status: 200,
		});
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
	} catch (error: any) {
		console.error(`🔥 [Cron Job] Cron job failed: ${error.message}`);
		if (error.stack) {
			console.error(`💥 [Cron Job] Stack Trace: ${error.stack}`);
		}
		return new Response("Cron job failed", { status: 500 });
	}
}
