/**
 * Background refresh job for cached AniList user data.
 *
 * The cron route updates the oldest stored users in small batches so cached
 * profiles stay reasonably fresh without overwhelming AniList, and it removes
 * records only after repeated 404s to distinguish deleted accounts from
 * transient upstream failures. It also returns scheduling guidance so whoever
 * owns the external cron job can tune refresh frequency without doing the math
 * by hand every time the user count changes.
 */
import type { Redis as UpstashRedis } from "@upstash/redis";

import { USER_STATS_QUERY } from "@/lib/anilist/queries";
import {
  apiJsonHeaders,
  authorizeCronRequest,
  fetchUpstreamWithRetry,
  redisClient,
  UpstreamTransportError,
} from "@/lib/api-utils";
import { validateAndNormalizeUserRecord } from "@/lib/card-data/validation";
import {
  ALL_USER_DATA_PARTS,
  deleteUserRecord,
  fetchUserDataParts,
  listStalestUserIds,
  reconstructUserRecord,
  saveUserRecord,
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
  try {
    console.log(`🔄 [Cron Job] User ${userId}: Fetching AniList data`);

    const statsResponse = await fetchUpstreamWithRetry({
      service: "AniList GraphQL",
      url: "https://graphql.anilist.co",
      init: {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          query: USER_STATS_QUERY,
          variables: { userId },
        }),
      },
      circuitBreaker: {
        key: "anilist-graphql",
        degradedModeEnvVar: "ANILIST_UPSTREAM_DEGRADED_MODE",
      },
    });

    if (!statsResponse.ok) {
      const is404Error = statsResponse.status === 404;
      console.warn(
        `⚠️ [Cron Job] User ${userId}: AniList returned HTTP ${statsResponse.status}`,
      );
      return { success: false, is404Error };
    }

    const statsData = await statsResponse.json();
    return { success: true, is404Error: false, statsData };
  } catch (error) {
    if (error instanceof UpstreamTransportError) {
      console.error(`🔥 [Cron Job] User ${userId}: ${error.message}`);
      return { success: false, is404Error: false };
    }

    const message = error instanceof Error ? error.message : String(error);
    console.error(
      `🔥 [Cron Job] User ${userId}: Final attempt failed - ${message}`,
    );
    if (error instanceof Error && error.stack) {
      console.error(
        `💥 [Cron Job] User ${userId}: Error detail: ${error.stack}`,
      );
    }
    return { success: false, is404Error: false };
  }
}

/**
 * Counts repeated AniList 404 responses before deleting a stored user.
 *
 * AniList can fail transiently, so a single 404 is not enough to treat an
 * account as gone forever. The third consecutive 404 is the point where this
 * route chooses cleanup over retrying stale data indefinitely.
 */
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
    const deleteResult = await deleteUserRecord(userId);

    console.log(
      `🗑️ [Cron Job] User ${userId}: Removed from database after 3 failed attempts${
        deleteResult.usernameIndexKeys.length > 0
          ? ` (removed ${deleteResult.usernameIndexKeys.join(", ")})`
          : ""
      }`,
    );
    return true;
  } else {
    await redisClient.set(failureKey, newFailureCount);
    return false;
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
  const authorizationError = authorizeCronRequest(request, "Cron Job");
  if (authorizationError) return authorizationError;

  try {
    console.log(
      "🛠️ [Cron Job] QStash authorized, starting background update...",
    );

    // Refresh the stalest records first and keep the batch small. That trades a
    // little peak freshness for predictable AniList load and more stable cron runs.
    const { userIds, totalUsers } = await listStalestUserIds(5);
    const batch = userIds.map((id) => ({ id }));

    console.log(
      `🚀 [Cron Job] Starting background update for ${batch.length} users (5 oldest out of ${totalUsers}).`,
    );

    let successfulUpdates = 0;
    let failedUpdates = 0;
    let removedUsers = 0;

    await Promise.all(
      batch.map(async ({ id }) => {
        try {
          const partsData = await fetchUserDataParts(id, [
            ...ALL_USER_DATA_PARTS,
          ]);
          const user = reconstructUserRecord(partsData);

          console.log(
            `👤 [Cron Job] User ${user.userId} (${
              user.username || "no username"
            }): Starting update`,
          );

          const updateResult = await updateUserStats(user.userId);

          if (updateResult.success) {
            user.stats = updateResult.statsData.data;

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

    const recFor5 = computeCronForBatch(totalUsers, 5);
    const recFor10 = computeCronForBatch(totalUsers, 10);

    // These recommendations are only operator-facing hints returned in the
    // response body. The route reports the schedule math, but an external cron
    // service still decides when to invoke it.

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
