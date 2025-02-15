import { USER_STATS_QUERY } from "@/lib/anilist/queries";
import { UserRecord } from "@/lib/types/records";
import { safeParse } from "@/lib/utils";
import { Redis } from "@upstash/redis";

// Background job for batch updating user stats from AniList
export async function POST(request: Request) {
	const CRON_SECRET = process.env.CRON_SECRET;
	const cronSecretHeader = request.headers.get("x-cron-secret");

	if (CRON_SECRET) {
		if (cronSecretHeader !== CRON_SECRET) {
			console.error("🔒 [Cron Job] Unauthorized: Invalid Cron secret");
			return new Response("Unauthorized", { status: 401 });
		}
	} else {
		console.warn("No CRON_SECRET env variable set. Skipping authorization check.");
	}

	try {
		console.log("🛠️ [Cron Job] QStash authorized, starting background update...");

		const redisClient = Redis.fromEnv();
		const userKeys = await redisClient.keys("user:*");
		const totalUsers = userKeys.length;

		// Fetch and parse user records from Redis
		const userRecords = await Promise.all(
			userKeys.map(async (key) => {
				const userDataStr = await redisClient.get(key);
				if (userDataStr) {
					const user = safeParse<UserRecord>(userDataStr);
					return { key, user };
				} else {
					return null;
				}
			})
		);

		// Filter out missing records
		const validUsers = userRecords.filter(
			(x): x is { key: string; user: UserRecord } => x !== null
		);

		// Sort by updatedAt (oldest first)
		validUsers.sort((a, b) => {
			const dateA = new Date(a.user.updatedAt || 0).getTime();
			const dateB = new Date(b.user.updatedAt || 0).getTime();
			return dateA - dateB;
		});

		// Select the 10 oldest users
		const ANILIST_RATE_LIMIT = 10;
		const batch = validUsers.slice(0, ANILIST_RATE_LIMIT);

		console.log(
			`🚀 [Cron Job] Starting background update for ${batch.length} users (10 oldest out of ${totalUsers}).`
		);

		await Promise.all(
			batch.map(async ({ key, user }) => {
				try {
					console.log(
						`👤 [Cron Job] User ${user.userId} (${
							user.username || "no username"
						}): Starting update`
					);

					let retries = 3;
					while (retries > 0) {
						try {
							console.log(
								`🔄 [Cron Job] User ${user.userId}: Attempt ${
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
								throw new Error(`HTTP ${statsResponse.status}`);
							}

							const statsData = await statsResponse.json();
							user.stats = statsData.data;
							user.updatedAt = new Date().toISOString();
							await redisClient.set(key, JSON.stringify(user));
							console.log(`✅ [Cron Job] User ${user.userId}: Successfully updated`);
							break;
							// eslint-disable-next-line @typescript-eslint/no-explicit-any
						} catch (error: any) {
							retries--;
							if (error.stack) {
								console.error(
									`💥 [Cron Job] User ${user.userId}: Error detail: ${error.stack}`
								);
							}
							if (retries === 0) {
								console.error(
									`🔥 [Cron Job] User ${user.userId}: Final attempt failed - ${error.message}`
								);
							} else {
								console.warn(
									`⚠️ [Cron Job] User ${user.userId}: Retrying (${retries} left) - ${error.message}`
								);
							}
						}
					}
					// eslint-disable-next-line @typescript-eslint/no-explicit-any
				} catch (error: any) {
					console.error(`🔥 [Cron Job] Error processing key ${key}: ${error.message}`);
					if (error.stack) {
						console.error(`💥 [Cron Job] Stack Trace: ${error.stack}`);
					}
				}
			})
		);

		console.log(
			`🎉 [Cron Job] Cron job completed successfully. Processed ${batch.length} users out of total ${totalUsers} users.`
		);
		return new Response(`Updated ${batch.length}/${totalUsers} users successfully`, {
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
