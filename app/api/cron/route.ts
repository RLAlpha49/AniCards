import { USER_STATS_QUERY } from "@/lib/anilist/queries";
import type { UserStatsData } from "@/lib/types/records";
import { safeParse } from "@/lib/utils";
import { redisClient, apiJsonHeaders, scanAllKeys } from "@/lib/api-utils";
import type { Redis as UpstashRedis } from "@upstash/redis";
import { validateAndNormalizeUserRecord } from "@/lib/card-data/validation";
import {
  fetchUserDataParts,
  reconstructUserRecord,
  saveUserRecord,
  deleteUserRecord,
  buildUsernameIndexKey,
  syncUsernameIndex,
  UserDataPart,
} from "@/lib/server/user-data";

/**
 * Tracks the outcome of a user's AniList stats refresh.
 * @source
 */
type UpdateResult =
  | { success: true; is404Error: false; statsData: UserStatsData }
  | { success: false; is404Error: boolean };

const MAX_GRAPHQL_INT = 2_147_483_647;
const MAX_STATS_FETCH_ATTEMPTS = 3;
const STATS_FETCH_TIMEOUT_MS = 5_000;
const STATS_FETCH_RETRY_DELAY_MS = 500;
const REFRESH_COOLDOWN_SECONDS = 15 * 60;

const USER_STATS_RESPONSE_FIELDS = [
  "User",
  "followersPage",
  "followingPage",
  "threadsPage",
  "threadCommentsPage",
  "reviewsPage",
  "userReviews",
  "userRecommendations",
  "animePlanning",
  "animeCurrent",
  "animeRewatched",
  "animeCompleted",
  "animeDropped",
  "mangaPlanning",
  "mangaCurrent",
  "mangaReread",
  "mangaCompleted",
  "mangaDropped",
] as const;

function parseAniListUserId(userId: string): number | null {
  if (!/^\d+$/.test(userId)) return null;

  const parsedUserId = Number(userId);
  return Number.isInteger(parsedUserId) &&
    parsedUserId > 0 &&
    parsedUserId <= MAX_GRAPHQL_INT
    ? parsedUserId
    : null;
}

function isObjectRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function hasStatsCount(value: unknown): boolean {
  if (!isObjectRecord(value)) return false;

  const count = value.count;
  return typeof count === "number" && Number.isInteger(count) && count >= 0;
}

function parseUserStatsResponse(payload: unknown): UserStatsData {
  if (!isObjectRecord(payload)) {
    throw new Error("Invalid GraphQL response");
  }

  if (payload.errors !== undefined) {
    if (!Array.isArray(payload.errors) || payload.errors.length === 0) {
      throw new Error("Malformed GraphQL errors field");
    }
    throw new Error("GraphQL response contained errors");
  }

  const data = payload.data;
  if (
    !isObjectRecord(data) ||
    !USER_STATS_RESPONSE_FIELDS.every((field) => Object.hasOwn(data, field)) ||
    !isObjectRecord(data.User)
  ) {
    throw new Error("GraphQL response is missing required stats data");
  }

  const statistics = data.User.statistics;
  if (
    !isObjectRecord(statistics) ||
    (!hasStatsCount(statistics.anime) && !hasStatsCount(statistics.manga))
  ) {
    throw new Error("GraphQL response is missing user statistics");
  }

  return data as unknown as UserStatsData;
}

/**
 * Attempts to fetch AniList stats with a timeout and delayed retries.
 * @param userId - AniList identifier whose stats should be refreshed.
 * @returns Result detailing the fetch success, 404 status, and payload if available.
 * @source
 */
async function updateUserStats(userId: string): Promise<UpdateResult> {
  const graphqlUserId = parseAniListUserId(userId);
  if (graphqlUserId === null) {
    console.error(`[Cron Job] User ${userId}: Invalid AniList user ID`);
    return { success: false, is404Error: false };
  }

  for (let attempt = 1; attempt <= MAX_STATS_FETCH_ATTEMPTS; attempt++) {
    try {
      console.log(
        `🔄 [Cron Job] User ${userId}: Attempt ${attempt}/${MAX_STATS_FETCH_ATTEMPTS} - Fetching AniList data`,
      );

      const statsResponse = await fetch("https://graphql.anilist.co", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: AbortSignal.timeout(STATS_FETCH_TIMEOUT_MS),
        body: JSON.stringify({
          query: USER_STATS_QUERY,
          variables: { userId: graphqlUserId },
        }),
      });

      if (statsResponse.status === 404) {
        return { success: false, is404Error: true };
      }

      if (!statsResponse.ok) {
        throw new Error(`HTTP ${statsResponse.status}`);
      }

      const payload: unknown = await statsResponse.json();
      const statsData = parseUserStatsResponse(payload);
      return { success: true, is404Error: false, statsData };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      if (error instanceof Error && error.stack) {
        console.error(
          `💥 [Cron Job] User ${userId}: Error detail: ${error.stack}`,
        );
      }
      if (attempt === MAX_STATS_FETCH_ATTEMPTS) {
        console.error(
          `🔥 [Cron Job] User ${userId}: Final attempt failed - ${errorMessage}`,
        );
      } else {
        console.warn(
          `⚠️ [Cron Job] User ${userId}: Retrying (${MAX_STATS_FETCH_ATTEMPTS - attempt} left) - ${errorMessage}`,
        );
        await new Promise<void>((resolve) =>
          setTimeout(resolve, STATS_FETCH_RETRY_DELAY_MS * 2 ** (attempt - 1)),
        );
      }
    }
  }

  return { success: false, is404Error: false };
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
      return buildUsernameIndexKey(rawUsername);
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
    const usernameIndexRemoval = usernameIndexKey
      ? syncUsernameIndex(redisClient, usernameIndexKey, null, userId)
      : Promise.resolve(false);

    const [usernameIndexRemoved] = await Promise.all([
      usernameIndexRemoval,
      deleteUserRecord(userId), // Remove user data (all parts)
      redisClient.del(failureKey), // Remove failure tracking
      redisClient.del(cardsKey), // Remove user's card configurations
    ]);

    console.log(
      `🗑️ [Cron Job] User ${userId}: Removed from database after 3 failed attempts${
        usernameIndexRemoved && usernameIndexKey
          ? ` (removed ${usernameIndexKey})`
          : ""
      }`,
    );
    return true; // User was removed
  } else {
    await redisClient.set(failureKey, newFailureCount);
    return false; // User was not removed
  }
}

/**
 * Clears stored failure and cooldown state after a successful update.
 * @param redisClient - Redis client managing failure counters.
 * @param userId - AniList identifier whose failure tracking should be removed.
 * @returns Promise that resolves once the failure counter is deleted.
 * @source
 */
async function clearRefreshState(
  redisClient: UpstashRedis,
  userId: string,
): Promise<void> {
  await redisClient.del(
    `failed_updates:${userId}`,
    `cron:refresh-cooldown:${userId}`,
  );
}

async function setRefreshCooldown(
  redisClient: UpstashRedis,
  userId: string,
): Promise<void> {
  await redisClient.set(`cron:refresh-cooldown:${userId}`, "1", {
    ex: REFRESH_COOLDOWN_SECONDS,
  });
}

function getUpdatedAtTimestamp(updatedAt: string | number): number {
  const timestamp = new Date(updatedAt || 0).getTime();
  return Number.isFinite(timestamp) ? timestamp : 0;
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

  if (!CRON_SECRET) {
    if (process.env.NODE_ENV !== "development") {
      console.error("🔒 [Cron Job] CRON_SECRET is not configured");
      return new Response("Cron authorization is not configured", {
        status: 503,
        headers: apiJsonHeaders(request),
      });
    }

    console.warn(
      "[Cron Job] CRON_SECRET is not configured. Skipping authorization in development.",
    );
  } else if (cronSecretHeader !== CRON_SECRET) {
    console.error("🔒 [Cron Job] Unauthorized: Invalid Cron secret");
    return new Response("Unauthorized", {
      status: 401,
      headers: apiJsonHeaders(request),
    });
  } else {
    console.info("[Cron Job] Cron secret verified.");
  }

  try {
    console.log(
      "🛠️ [Cron Job] QStash authorized, starting background update...",
    );

    const selectionStartedAt = Date.now();
    let scanCommandCount = 0;
    const allKeys = await scanAllKeys("user:*", 1000, () => {
      scanCommandCount++;
    });
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
    const metaResults: (Record<string, unknown> | string | null)[] =
      metaKeys.length
        ? await redisClient.mget<(Record<string, unknown> | string | null)[]>(
            ...metaKeys,
          )
        : [];

    const validUsers: { id: string; updatedAt: string | number }[] = [];
    let missingMetadataCount = 0;
    let malformedMetadataCount = 0;
    const missingMetadataSampleIds: string[] = [];
    const malformedMetadataSampleIds: string[] = [];

    metaResults.forEach((meta, i) => {
      const id = userIds[i];
      if (meta == null) {
        missingMetadataCount++;
        if (missingMetadataSampleIds.length < 5) {
          missingMetadataSampleIds.push(id);
        }
        return;
      }

      try {
        const parsed: unknown =
          typeof meta === "string" ? JSON.parse(meta) : meta;
        if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
          throw new TypeError("Expected user metadata to be an object");
        }

        const updatedAt = (parsed as Record<string, unknown>).updatedAt;
        if (
          updatedAt != null &&
          typeof updatedAt !== "string" &&
          (typeof updatedAt !== "number" || !Number.isFinite(updatedAt))
        ) {
          throw new TypeError(
            "Expected metadata.updatedAt to be a string or number",
          );
        }

        validUsers.push({
          id,
          updatedAt:
            typeof updatedAt === "string" || typeof updatedAt === "number"
              ? updatedAt
              : 0,
        });
      } catch {
        malformedMetadataCount++;
        if (malformedMetadataSampleIds.length < 5) {
          malformedMetadataSampleIds.push(id);
        }
      }
    });

    if (missingMetadataCount > 0) {
      console.warn(
        `[Cron Job] Skipping ${missingMetadataCount} user IDs without the required meta part. Sample IDs: ${missingMetadataSampleIds.join(", ")}`,
      );
    }
    if (malformedMetadataCount > 0) {
      console.error(
        `[Cron Job] Skipping ${malformedMetadataCount} users with malformed metadata; repair required. Sample IDs: ${malformedMetadataSampleIds.join(", ")}`,
      );
    }

    const cooldownKeys = userIds.map((id) => `cron:refresh-cooldown:${id}`);
    const cooldownResults: (string | null)[] = cooldownKeys.length
      ? await redisClient.mget<(string | null)[]>(...cooldownKeys)
      : [];
    const cooledDownUserIds = new Set(
      userIds.filter((_, index) => Boolean(cooldownResults[index])),
    );

    // Sort by last successful refresh, then skip records in cooldown.
    validUsers.sort(
      (a, b) =>
        getUpdatedAtTimestamp(a.updatedAt) - getUpdatedAtTimestamp(b.updatedAt),
    );

    const eligibleUsers = validUsers.filter(
      ({ id }) => !cooledDownUserIds.has(id),
    );
    const batch = eligibleUsers.slice(0, 5);
    const approximateReturnedPayloadBytes =
      allKeys.reduce((bytes, key) => bytes + Buffer.byteLength(key), 0) +
      metaResults.reduce(
        (bytes, value) =>
          bytes +
          Buffer.byteLength(
            typeof value === "string"
              ? value
              : (JSON.stringify(value ?? null) ?? ""),
          ),
        0,
      ) +
      cooldownResults.reduce(
        (bytes, value) => bytes + Buffer.byteLength(value ?? ""),
        0,
      );
    const selectionDurationMs = Date.now() - selectionStartedAt;
    const selectionRedisCommandCount =
      scanCommandCount +
      Number(metaKeys.length > 0) +
      Number(cooldownKeys.length > 0);

    console.log("[Cron Job] User selection metrics:", {
      scanCommands: scanCommandCount,
      redisCommands: selectionRedisCommandCount,
      scannedKeys: allKeys.length,
      numericUserIds: totalUsers,
      validMetadataUsers: validUsers.length,
      missingMetadata: missingMetadataCount,
      malformedMetadata: malformedMetadataCount,
      approximateReturnedPayloadBytes,
      durationMs: selectionDurationMs,
    });

    const oldestStaleAgeMinutes = validUsers.length
      ? Math.floor(
          Math.max(
            0,
            Date.now() - getUpdatedAtTimestamp(validUsers[0].updatedAt),
          ) / 60_000,
        )
      : null;

    console.log(
      `🚀 [Cron Job] Starting background update for ${batch.length} eligible users (${eligibleUsers.length} eligible, ${validUsers.length - eligibleUsers.length} cooling down, ${totalUsers} total).`,
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
        let outcome: "success" | "failed" | "removed" = "failed";
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
            user.stats = updateResult.statsData;

            // Normalize and prune data before saving to keep Redis size down
            const normalizationResult = validateAndNormalizeUserRecord(user, {
              recomputeAggregates: true,
            });
            if ("error" in normalizationResult) {
              console.warn(
                `[Cron Job] User ${user.userId}: Refresh rejected: ${normalizationResult.error}`,
              );
              return;
            }
            const finalUser = normalizationResult.normalized;

            finalUser.updatedAt = new Date().toISOString();

            await saveUserRecord(finalUser);

            await clearRefreshState(redisClient, user.userId);
            outcome = "success";

            console.log(
              `✅ [Cron Job] User ${user.userId}: Successfully updated`,
            );
          } else {
            if (updateResult.is404Error) {
              const wasRemoved = await handleFailureTracking(
                redisClient,
                user.userId,
              );
              if (wasRemoved) {
                outcome = "removed";
              }
            }
          }
        } catch (error) {
          const errorMessage =
            error instanceof Error ? error.message : String(error);
          console.error(
            `🔥 [Cron Job] Error processing user ${id}: ${errorMessage}`,
          );
          if (error instanceof Error && error.stack) {
            console.error(`💥 [Cron Job] Stack Trace: ${error.stack}`);
          }
        } finally {
          if (outcome === "success") {
            successfulUpdates++;
          } else {
            failedUpdates++;
            if (outcome === "removed") {
              removedUsers++;
            } else {
              try {
                await setRefreshCooldown(redisClient, id);
              } catch (error) {
                console.error(
                  `[Cron Job] User ${id}: Failed to set refresh cooldown: ${error instanceof Error ? error.message : String(error)}`,
                );
              }
            }
          }
        }
      }),
    );

    console.log(
      `🎉 [Cron Job] Cron job completed successfully. Processed ${batch.length} users out of total ${totalUsers} users.`,
      `📊 Results: ${successfulUpdates} successful, ${failedUpdates} failed, ${removedUsers} removed. Oldest stale record: ${oldestStaleAgeMinutes === null ? "none" : `${oldestStaleAgeMinutes} minutes`}.`,
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
      `Eligible users: ${eligibleUsers.length}/${validUsers.length}; cooling down: ${validUsers.length - eligibleUsers.length}; oldest stale record: ${oldestStaleAgeMinutes === null ? "none" : `${oldestStaleAgeMinutes} minutes`}.`,
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
