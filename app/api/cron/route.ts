import { USER_STATS_QUERY } from "@/lib/anilist/queries";
import { UserRecord } from "@/lib/types/records";
import { safeParse } from "@/lib/utils";
import { redisClient, apiJsonHeaders } from "@/lib/api-utils";
import type { Redis as UpstashRedis } from "@upstash/redis";
import { validateAndNormalizeUserRecord } from "@/lib/card-data/validation";
import {
  fetchUserDataParts,
  reconstructUserRecord,
  saveUserRecord,
  deleteUserRecord,
  UserDataPart,
} from "@/lib/server/user-data";

/**
 * Tracks the outcome of a user's AniList stats refresh.
 * @source
 */
interface UpdateResult {
  success: boolean;
  is404Error: boolean;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  statsData?: any;
}

/**
 * Attempts to fetch AniList stats for the given user with up to three retries.
 * @param userId - AniList identifier whose stats should be refreshed.
 * @returns Result detailing the fetch success, 404 status, and payload if available.
 * @source
 */
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

/**
 * Records repeated AniList 404 failures and removes stale entries after three attempts.
 * @param redisClient - Redis client used to store failure counters and related keys.
 * @param userId - AniList identifier whose failures are being tracked.
 * @param userKey - Redis key for the user's record to delete when removing.
 * @returns True when the user was removed from Redis, false otherwise.
 * @source
 */
async function getUsernameIndexKey(
  redisClient: UpstashRedis,
  userId: string,
): Promise<string | null> {
  try {
    const metaRaw = await redisClient.get(`user:${userId}:meta`);
    if (!metaRaw) return null;

    const parsed =
      typeof metaRaw === "string"
        ? safeParse<Record<string, unknown>>(metaRaw)
        : (metaRaw as Record<string, unknown>);

    const rawUsername = parsed ? parsed["username"] : undefined;
    if (typeof rawUsername === "string" && rawUsername.trim()) {
      return `username:${rawUsername.trim().toLowerCase()}`;
    }
  } catch (err) {
    console.warn(
      `⚠️ [Cron Job] User ${userId}: Failed to read meta for username cleanup: ${err}`,
    );
  }

  return null;
}

async function handleFailureTracking(
  redisClient: UpstashRedis,
  userId: string,
): Promise<boolean> {
  const failureKey = `failed_updates:${userId}`;
  const currentFailureCount = (await redisClient.get(failureKey)) || 0;
  const newFailureCount = Number(currentFailureCount) + 1;

  console.log(
    `📋 [Cron Job] User ${userId}: Recording 404 failure (attempt ${newFailureCount}/3)`,
  );

  if (newFailureCount >= 3) {
    const cardsKey = `cards:${userId}`;
    const usernameIndexKey = await getUsernameIndexKey(redisClient, userId);

    const deletions = [
      deleteUserRecord(userId), // Remove user data (all parts)
      redisClient.del(failureKey), // Remove failure tracking
      redisClient.del(cardsKey), // Remove user's card configurations
      ...(usernameIndexKey ? [redisClient.del(usernameIndexKey)] : []),
    ];

    await Promise.all(deletions);

    console.log(
      `🗑️ [Cron Job] User ${userId}: Removed from database after 3 failed attempts${
        usernameIndexKey ? ` (removed ${usernameIndexKey})` : ""
      }`,
    );
    return true; // User was removed
  } else {
    await redisClient.set(failureKey, newFailureCount);
    return false; // User was not removed
  }
}

/**
 * Clears any stored failure counter for the specified user after a successful update.
 * @param redisClient - Redis client managing failure counters.
 * @param userId - AniList identifier whose failure tracking should be removed.
 * @returns Promise that resolves once the failure counter is deleted.
 * @source
 */
async function clearFailureTracking(
  redisClient: UpstashRedis,
  userId: string,
): Promise<void> {
  const failureKey = `failed_updates:${userId}`;
  await redisClient.del(failureKey);
}

/**
 * Computes a recommended cron expression so that all users are refreshed at least once
 * every 24 hours given the number of users and the number processed per run.
 *
 * Strategy:
 * - runsNeeded = ceil(totalUsers / batchSize)
 * - If runsNeeded <= 1 => run once per day ("0 0 * * *").
 * - If runsNeeded > 1440 => impossible with this batch size, suggest every minute ("* * * * *").
 * - Otherwise pick N = floor(1440 / runsNeeded) minutes.
 *   - If N >= 60, convert to an hourly schedule (e.g. run at minute 0 every H hours).
 *   - Else use a minute-based schedule (every N minutes).
 *
 * Returns cron expression, estimated runs/day, and approximate interval (minutes).
 */
function computeCronForBatch(
  totalUsers: number,
  batchSize: number,
): {
  runsNeeded: number;
  cron: string;
  runsPerDay: number;
  intervalMinutes: number;
  note?: string;
} {
  const runsNeeded =
    totalUsers === 0 ? 0 : Math.max(1, Math.ceil(totalUsers / batchSize));

  if (totalUsers === 0) {
    return {
      runsNeeded: 0,
      cron: "0 0 * * *",
      runsPerDay: 1,
      intervalMinutes: 1440,
      note: "No users",
    };
  }

  if (runsNeeded <= 1) {
    return {
      runsNeeded,
      cron: "0 0 * * *",
      runsPerDay: 1,
      intervalMinutes: 1440,
    };
  }

  if (runsNeeded > 1440) {
    return {
      runsNeeded,
      cron: "* * * * *",
      runsPerDay: 1440,
      intervalMinutes: 1,
      note: "Cannot satisfy with this batch size; consider increasing batch size or parallelism",
    };
  }

  const Nmin = Math.max(1, Math.floor(1440 / runsNeeded));
  if (Nmin >= 60) {
    const H = Math.max(1, Math.floor(Nmin / 60));
    if (H >= 24) {
      return {
        runsNeeded,
        cron: "0 0 * * *",
        runsPerDay: 1,
        intervalMinutes: 1440,
      };
    }
    const runsPerDay = Math.ceil(24 / H);
    const interval = Math.round(1440 / runsPerDay);
    return {
      runsNeeded,
      cron: `0 */${H} * * *`,
      runsPerDay,
      intervalMinutes: interval,
    };
  } else {
    const cron = Nmin === 1 ? "* * * * *" : `*/${Nmin} * * * *`;
    const runsPerHour = Math.ceil(60 / Nmin);
    const runsPerDay = runsPerHour * 24;
    const interval = Math.round(1440 / runsPerDay);
    return { runsNeeded, cron, runsPerDay, intervalMinutes: interval };
  }
}

/**
 * Executes the cron job that batches AniList stat refreshes for the oldest users.
 * @param request - Incoming request which must include the cron secret header.
 * @returns Response summarizing processed, failed, and removed users.
 * @source
 */
export async function POST(request: Request) {
  const CRON_SECRET = process.env.CRON_SECRET;
  const cronSecretHeader = request.headers.get("x-cron-secret");

  if (CRON_SECRET) {
    if (cronSecretHeader !== CRON_SECRET) {
      console.error("🔒 [Cron Job] Unauthorized: Invalid Cron secret");
      return new Response("Unauthorized", {
        status: 401,
        headers: apiJsonHeaders(request),
      });
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

    const allKeys = await redisClient.keys("user:*");
    // Filter to only include numeric user IDs and avoid analytics or other keys
    const userIds = Array.from(
      new Set(
        allKeys
          .map((k) => k.split(":")[1])
          .filter((id) => id && /^\d+$/.test(id)),
      ),
    );
    const totalUsers = userIds.length;

    // Fetch meta for all users to sort by updatedAt
    const metaKeys = userIds.map((id) => `user:${id}:meta`);
    const metaResults = await Promise.all(
      metaKeys.map((key) => redisClient.get(key)),
    );

    const missingMetaIndices: number[] = [];
    const validUsers: { id: string; updatedAt: string | number }[] = [];

    metaResults.forEach((meta, i) => {
      if (meta) {
        const parsed = typeof meta === "string" ? JSON.parse(meta) : meta;
        validUsers.push({ id: userIds[i], updatedAt: parsed.updatedAt || 0 });
      } else {
        missingMetaIndices.push(i);
      }
    });

    if (missingMetaIndices.length > 0) {
      const legacyKeys = missingMetaIndices.map((i) => `user:${userIds[i]}`);
      const legacyResults = await Promise.all(
        legacyKeys.map((key) => redisClient.get(key)),
      );

      legacyResults.forEach((legacy, i) => {
        if (legacy) {
          const record = safeParse<UserRecord>(legacy as string);
          validUsers.push({
            id: userIds[missingMetaIndices[i]],
            updatedAt: record?.updatedAt || 0,
          });
        }
      });
    }

    // Sort by updatedAt (oldest first)
    validUsers.sort((a, b) => {
      const dateA = new Date(a.updatedAt || 0).getTime();
      const dateB = new Date(b.updatedAt || 0).getTime();
      return dateA - dateB;
    });

    // Select the 5 oldest users
    const batch = validUsers.slice(0, 5);

    console.log(
      `🚀 [Cron Job] Starting background update for ${batch.length} users (5 oldest out of ${totalUsers}).`,
    );

    let successfulUpdates = 0;
    let failedUpdates = 0;
    let removedUsers = 0;

    const allParts: UserDataPart[] = [
      "meta",
      "activity",
      "favourites",
      "statistics",
      "pages",
      "planning",
      "current",
      "rewatched",
      "completed",
      "aggregates",
    ];

    await Promise.all(
      batch.map(async ({ id }) => {
        try {
          const partsData = await fetchUserDataParts(id, allParts);
          const user = reconstructUserRecord(partsData);

          console.log(
            `👤 [Cron Job] User ${user.userId} (${
              user.username || "no username"
            }): Starting update`,
          );

          const updateResult = await updateUserStats(user.userId);

          if (updateResult.success) {
            // Update user data in Redis with the fetched stats
            user.stats = updateResult.statsData.data;

            // Normalize and prune data before saving to keep Redis size down
            const normalizationResult = validateAndNormalizeUserRecord(user);
            const finalUser =
              "normalized" in normalizationResult
                ? normalizationResult.normalized
                : user;

            finalUser.updatedAt = new Date().toISOString();

            await saveUserRecord(finalUser);

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
            );
            if (wasRemoved) {
              removedUsers++;
            }
          }
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
        } catch (error: any) {
          console.error(
            `🔥 [Cron Job] Error processing user ${id}: ${error.message}`,
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

    // Compute recommended cron expressions for 5 and 10 users per run
    const recFor5 = computeCronForBatch(totalUsers, 5);
    const recFor10 = computeCronForBatch(totalUsers, 10);

    console.log(
      `🔁 [Cron Job] Scheduling recommendation: 5/users -> ${recFor5.cron} (${recFor5.runsPerDay} runs/day, ~every ${recFor5.intervalMinutes} min).`,
    );
    console.log(
      `🔁 [Cron Job] Scheduling recommendation: 10/users -> ${recFor10.cron} (${recFor10.runsPerDay} runs/day, ~every ${recFor10.intervalMinutes} min).`,
    );

    const headers = apiJsonHeaders(request);
    headers["Content-Type"] = "text/plain";

    const recFor5Note = recFor5.note ? ` — ${recFor5.note}` : "";
    const recFor10Note = recFor10.note ? ` — ${recFor10.note}` : "";

    const scheduleMessage = [
      `Updated ${successfulUpdates}/${batch.length} users successfully. Failed: ${failedUpdates}, Removed: ${removedUsers}`,
      "",
      `Recommended schedules to refresh all ${totalUsers} users at least once per 24 hours:`,
      ` - Update 5 users/run: ${recFor5.cron} (${recFor5.runsPerDay} runs/day, ~every ${recFor5.intervalMinutes} min)${recFor5Note}`,
      ` - Update 10 users/run: ${recFor10.cron} (${recFor10.runsPerDay} runs/day, ~every ${recFor10.intervalMinutes} min)${recFor10Note}`,
    ].join("\n");

    return new Response(scheduleMessage, { status: 200, headers });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } catch (error: any) {
    console.error(`🔥 [Cron Job] Cron job failed: ${error.message}`);
    if (error.stack) {
      console.error(`💥 [Cron Job] Stack Trace: ${error.stack}`);
    }
    const headers = apiJsonHeaders(request);
    headers["Content-Type"] = "text/plain";
    return new Response("Cron job failed", { status: 500, headers });
  }
}
