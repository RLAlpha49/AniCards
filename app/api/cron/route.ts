import { USER_STATS_QUERY } from "@/lib/anilist/queries";
import { UserRecord } from "@/lib/types/records";
import { safeParse } from "@/lib/utils";
import { Redis } from "@upstash/redis";

interface UpdateResult {
  success: boolean;
  is404Error: boolean;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  statsData?: any;
}

// Attempt to update user stats with retry logic
async function updateUserStats(userId: string): Promise<UpdateResult> {
  let retries = 3;
  let is404Error = false;

  while (retries > 0) {
    try {
      console.log(
        `🔄 [Cron Job] User ${userId}: Attempt ${4 - retries}/3 - Fetching AniList data`,
      );

      const statsResponse = await fetch("https://graphql.anilist.co", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          query: USER_STATS_QUERY,
          variables: { userId },
        }),
      });

      if (!statsResponse.ok) {
        is404Error = statsResponse.status === 404;
        throw new Error(`HTTP ${statsResponse.status}`);
      }

      const statsData = await statsResponse.json();
      return { success: true, is404Error: false, statsData };
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (error: any) {
      retries--;
      if (error.stack) {
        console.error(
          `💥 [Cron Job] User ${userId}: Error detail: ${error.stack}`,
        );
      }
      if (retries === 0) {
        console.error(
          `🔥 [Cron Job] User ${userId}: Final attempt failed - ${error.message}`,
        );
      } else {
        console.warn(
          `⚠️ [Cron Job] User ${userId}: Retrying (${retries} left) - ${error.message}`,
        );
      }
    }
  }

  return { success: false, is404Error };
}

// Handle failure tracking and user removal
async function handleFailureTracking(
  redisClient: Redis,
  userId: string,
  userKey: string,
): Promise<boolean> {
  const failureKey = `failed_updates:${userId}`;
  const currentFailureCount = (await redisClient.get(failureKey)) || 0;
  const newFailureCount = Number(currentFailureCount) + 1;

  console.log(
    `📋 [Cron Job] User ${userId}: Recording 404 failure (attempt ${newFailureCount}/3)`,
  );

  if (newFailureCount >= 3) {
    await redisClient.del(userKey);
    await redisClient.del(failureKey);
    console.log(
      `🗑️ [Cron Job] User ${userId}: Removed from database after 3 failed attempts`,
    );
    return true; // User was removed
  } else {
    await redisClient.set(failureKey, newFailureCount);
    return false; // User was not removed
  }
}

// Clear failure tracking on successful update
async function clearFailureTracking(
  redisClient: Redis,
  userId: string,
): Promise<void> {
  const failureKey = `failed_updates:${userId}`;
  await redisClient.del(failureKey);
}

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
    console.warn(
      "No CRON_SECRET env variable set. Skipping authorization check.",
    );
  }

  try {
    console.log(
      "🛠️ [Cron Job] QStash authorized, starting background update...",
    );

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
      }),
    );

    // Filter out missing records
    const validUsers = userRecords.filter(
      (x): x is { key: string; user: UserRecord } => x !== null,
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
      `🚀 [Cron Job] Starting background update for ${batch.length} users (10 oldest out of ${totalUsers}).`,
    );

    let successfulUpdates = 0;
    let failedUpdates = 0;
    let removedUsers = 0;

    await Promise.all(
      batch.map(async ({ key, user }) => {
        try {
          console.log(
            `👤 [Cron Job] User ${user.userId} (${
              user.username || "no username"
            }): Starting update`,
          );

          const updateResult = await updateUserStats(user.userId);

          if (updateResult.success) {
            // Update user data in Redis with the fetched stats
            user.stats = updateResult.statsData.data;
            user.updatedAt = new Date().toISOString();
            await redisClient.set(key, JSON.stringify(user));

            console.log(
              `✅ [Cron Job] User ${user.userId}: Successfully updated`,
            );
            successfulUpdates++;
            await clearFailureTracking(redisClient, user.userId);
          } else if (updateResult.is404Error) {
            failedUpdates++;
            const wasRemoved = await handleFailureTracking(
              redisClient,
              user.userId,
              key,
            );
            if (wasRemoved) {
              removedUsers++;
            }
          }
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
        } catch (error: any) {
          console.error(
            `🔥 [Cron Job] Error processing key ${key}: ${error.message}`,
          );
          if (error.stack) {
            console.error(`💥 [Cron Job] Stack Trace: ${error.stack}`);
          }
        }
      }),
    );

    console.log(
      `🎉 [Cron Job] Cron job completed successfully. Processed ${batch.length} users out of total ${totalUsers} users.`,
      `📊 Results: ${successfulUpdates} successful, ${failedUpdates} failed (404), ${removedUsers} removed.`,
    );
    return new Response(
      `Updated ${successfulUpdates}/${batch.length} users successfully. Failed: ${failedUpdates}, Removed: ${removedUsers}`,
      {
        status: 200,
      },
    );
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } catch (error: any) {
    console.error(`🔥 [Cron Job] Cron job failed: ${error.message}`);
    if (error.stack) {
      console.error(`💥 [Cron Job] Stack Trace: ${error.stack}`);
    }
    return new Response("Cron job failed", { status: 500 });
  }
}
