import { USER_STATS_QUERY } from "@/lib/anilist/queries";
import { isValidUsername, redisClient } from "@/lib/api-utils";
import { validateAndNormalizeUserRecord } from "@/lib/card-data/validation";
import {
  buildUsernameIndexKey,
  deleteUserStorage,
  fetchUserDataParts,
  reconstructUserRecord,
  saveUserRecord,
  syncUsernameIndex,
  USER_DATA_PARTS,
  USER_REFRESH_INDEX_KEY,
} from "@/lib/server/user-data";
import {
  buildFailureClaimKey,
  buildRefreshCooldownKey,
  REFRESH_COOLDOWN_SECONDS,
} from "@/lib/server/refresh-cooldown";
import type { UserStatsData } from "@/lib/types/records";

const MAX_GRAPHQL_INT = 2_147_483_647;
const STATS_FETCH_TIMEOUT_MS = 15_000;
const ANILIST_GRAPHQL_URL = "https://graphql.anilist.co";
/** AniList 404s tolerated before the stored user is removed. */
const FAILURES_BEFORE_REMOVAL = 3;

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

/**
 * Why an attempt did not update the record, as a short code.
 *
 * The route returns these in the response body, and QStash keeps the body for
 * days and shows it in its console. An exception message would carry the Redis
 * endpoint or SDK detail there, so the detail goes to the server log and only
 * the code leaves the process.
 * @source
 */
export type RefreshUserFailureCode =
  | "invalid-stored-user-id"
  | "anilist-unavailable"
  | "redis-read-failed"
  | "index-entry-removal-failed"
  | "failure-claim-failed"
  | "failure-record-failed"
  | "record-save-failed"
  | "record-validation-failed";

/**
 * What one refresh attempt did, in terms the caller maps to an HTTP status.
 *
 * `retryable` is the only outcome worth another delivery. Everything else is
 * final for this message: the next scheduled dispatch re-queues the user if
 * they are still due.
 * @source
 */
export type RefreshUserOutcome =
  | { status: "updated" }
  | { status: "stale" }
  | { status: "not-found"; failures: number }
  | { status: "removed" }
  | { status: "duplicate" }
  | { status: "rejected"; reason: RefreshUserFailureCode }
  | { status: "retryable"; reason: RefreshUserFailureCode };

type StatsFetchResult =
  | { kind: "ok"; statsData: UserStatsData }
  | { kind: "not-found" }
  | { kind: "invalid-id" }
  | { kind: "retryable"; reason: string };

/**
 * Parses an AniList user id.
 * @param userId - Candidate identifier.
 * @returns The numeric id, or null when the value is not a usable AniList id.
 * @source
 */
export function parseAniListUserId(userId: string): number | null {
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
 * Fetches a user's stats from AniList with one attempt.
 *
 * The retry that used to live here moved to QStash. A message retry survives
 * a crash of the invocation itself, which an in-process loop cannot, and it
 * keeps the invocation short enough that one slow user cannot hold a whole
 * batch open.
 *
 * @param userId - AniList identifier whose stats should be refreshed.
 * @returns The parsed stats, or why the attempt did not produce them.
 * @source
 */
async function fetchUserStats(userId: string): Promise<StatsFetchResult> {
  const graphqlUserId = parseAniListUserId(userId);
  if (graphqlUserId === null) return { kind: "invalid-id" };

  try {
    console.log(`🔄 [Cron Job] User ${userId}: Fetching AniList data`);

    const statsResponse = await fetch(ANILIST_GRAPHQL_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      signal: AbortSignal.timeout(STATS_FETCH_TIMEOUT_MS),
      body: JSON.stringify({
        query: USER_STATS_QUERY,
        variables: { userId: graphqlUserId },
      }),
    });

    if (statsResponse.status === 404) return { kind: "not-found" };
    if (!statsResponse.ok) {
      return { kind: "retryable", reason: `HTTP ${statsResponse.status}` };
    }

    const payload: unknown = await statsResponse.json();
    return { kind: "ok", statsData: parseUserStatsResponse(payload) };
  } catch (error) {
    return {
      kind: "retryable",
      reason: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * Marks a user as cooling down, which keeps the dispatcher from selecting
 * them again on its next run.
 *
 * The write is `NX`. The dispatcher claims the same key for longer than the
 * QStash retry window when it publishes, and a failure must not shorten that
 * claim: the remaining retries are still in flight and the next dispatch would
 * queue the user a second time.
 *
 * @param userId - AniList identifier to cool down.
 * @source
 */
async function setRefreshCooldown(userId: string): Promise<void> {
  try {
    await redisClient.set(buildRefreshCooldownKey(userId), "1", {
      ex: REFRESH_COOLDOWN_SECONDS,
      nx: true,
    });
  } catch (error) {
    console.error(
      `[Cron Job] User ${userId}: Failed to set refresh cooldown: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}

/**
 * Clears stored failure and cooldown state after a successful update.
 * @param userId - AniList identifier whose failure tracking should be removed.
 * @source
 */
async function clearRefreshState(userId: string): Promise<void> {
  await redisClient.del(
    `failed_updates:${userId}`,
    buildRefreshCooldownKey(userId),
    buildFailureClaimKey(userId),
  );
}

/**
 * Claims the cooldown window for a 404 before counting it.
 *
 * QStash delivers at least once, so the same 404 can arrive twice. The
 * increment is guarded by this claim rather than by a read followed by a
 * write: `SET NX` is atomic, so two deliveries cannot both win it. A delivery
 * that loses the claim is a duplicate and counts nothing, which stops a
 * duplicate from removing a live user one run early.
 *
 * The claim has its own key. It used to share the cooldown key, which meant a
 * delivery that ended retryable had already taken the window and the retry's
 * 404 was dropped as a duplicate.
 *
 * @param userId - AniList identifier whose 404 is being counted.
 * @returns True when this delivery owns the count, false when the window is
 *   already claimed.
 * @source
 */
async function claimFailureWindow(userId: string): Promise<boolean> {
  const claimed = await redisClient.set(buildFailureClaimKey(userId), "1", {
    nx: true,
    ex: REFRESH_COOLDOWN_SECONDS,
  });
  return claimed !== null;
}

/**
 * Records one AniList 404 and removes the user after the third.
 *
 * Removal is delegated to `deleteUserStorage`, which owns the full list of
 * keys a user has.
 *
 * @param userId - AniList identifier whose 404 was just observed.
 * @returns The outcome for the caller, including the new failure count.
 * @source
 */
async function recordAniListNotFound(
  userId: string,
): Promise<RefreshUserOutcome> {
  let claimed: boolean;
  try {
    claimed = await claimFailureWindow(userId);
  } catch (error) {
    console.error(
      `🔥 [Cron Job] User ${userId}: could not claim the failure window: ${
        error instanceof Error ? error.message : String(error)
      }`,
    );
    return { status: "retryable", reason: "failure-claim-failed" };
  }

  if (!claimed) {
    console.log(
      `[Cron Job] User ${userId}: 404 inside an active cooldown window; counting it once.`,
    );
    return { status: "duplicate" };
  }

  try {
    const failureKey = `failed_updates:${userId}`;
    const currentFailureCount = (await redisClient.get(failureKey)) || 0;
    const failures = Number(currentFailureCount) + 1;

    console.log(
      `📋 [Cron Job] User ${userId}: Recording 404 failure (attempt ${failures}/${FAILURES_BEFORE_REMOVAL})`,
    );

    if (failures >= FAILURES_BEFORE_REMOVAL) {
      const { usernameKeyRemoved } = await deleteUserStorage(userId);
      await redisClient.del(failureKey);
      console.log(
        `🗑️ [Cron Job] User ${userId}: Removed from database after ${FAILURES_BEFORE_REMOVAL} failed attempts${
          usernameKeyRemoved ? " (removed the username key)" : ""
        }`,
      );
      return { status: "removed" };
    }

    await redisClient.set(failureKey, failures);
    return { status: "not-found", failures };
  } catch (error) {
    // The count did not land, so release the claim and let the retry count
    // this 404 instead of dropping it.
    await redisClient.del(buildFailureClaimKey(userId)).catch(() => {});
    console.error(
      `🔥 [Cron Job] User ${userId}: could not record the 404: ${
        error instanceof Error ? error.message : String(error)
      }`,
    );
    return { status: "retryable", reason: "failure-record-failed" };
  }
}

/**
 * Reads the username AniList reports in a stats response.
 *
 * AniList returns the account's current handle as `User.name`. The stats query
 * already requests it, so the refresh gets the current name without an extra
 * request.
 *
 * @param statsData - Stats payload returned by AniList.
 * @returns The reported username, or null when it is absent or implausible.
 */
function readReportedUsername(statsData: UserStatsData): string | null {
  const name = statsData?.User?.name;
  if (typeof name !== "string" || !isValidUsername(name)) return null;
  return name.trim();
}

/**
 * Moves the username index from the stored handle to the one AniList reports.
 *
 * A rename is only visible here for a user who never saves through the
 * generator, so this is the only place that can keep their index entry
 * current. A failed sync is logged and does not fail the refresh, but it must
 * not leave the record naming a handle the index does not point at: the next
 * refresh would see the two as equal and skip the repair.
 *
 * @param userId - User whose index entry should follow the rename.
 * @param storedUsername - Username held by the stored record.
 * @param reportedUsername - Username in the fresh AniList response.
 * @returns True when the index now matches the reported username.
 */
async function syncRefreshedUsername(
  userId: string,
  storedUsername: string | undefined,
  reportedUsername: string,
): Promise<boolean> {
  const previousKey = buildUsernameIndexKey(storedUsername);
  const currentKey = buildUsernameIndexKey(reportedUsername);
  if (previousKey === currentKey) return true;

  try {
    await syncUsernameIndex(redisClient, previousKey, currentKey, userId);
    console.log(
      `🔁 [Cron Job] User ${userId}: Username index moved from ${previousKey ?? "no username"} to ${currentKey ?? "no username"}.`,
    );
    return true;
  } catch (error) {
    console.warn(
      `⚠️ [Cron Job] User ${userId}: Failed to sync the username index; keeping the stored username so the next refresh retries: ${error instanceof Error ? error.message : String(error)}`,
    );
    return false;
  }
}

/**
 * Applies a fresh stats payload to the stored record and saves it.
 * @param partsData - Parts read for the user, used as the write baseline.
 * @param statsData - Stats returned by AniList.
 * @returns The outcome for the caller.
 * @source
 */
async function applyFreshStats(
  partsData: Awaited<ReturnType<typeof fetchUserDataParts>>,
  statsData: UserStatsData,
): Promise<RefreshUserOutcome> {
  const user = reconstructUserRecord(partsData);
  user.stats = statsData;

  const normalizationResult = validateAndNormalizeUserRecord(user, {
    recomputeAggregates: true,
  });
  if ("error" in normalizationResult) {
    await setRefreshCooldown(user.userId);
    console.warn(
      `⚠️ [Cron Job] User ${user.userId}: the refreshed record failed validation: ${normalizationResult.error}`,
    );
    return { status: "rejected", reason: "record-validation-failed" };
  }

  const finalUser = normalizationResult.normalized;

  // Normalization keeps the stored username, but AniList now reports the
  // handle the account currently uses. The refresh response is the only
  // place a rename shows up for a user who never saves through the
  // generator, so the username index is moved first. The record keeps the
  // old handle when that fails, which makes the next refresh retry instead
  // of accepting a record that names a key the index lacks.
  const reportedUsername = readReportedUsername(statsData);
  if (reportedUsername) {
    const indexSynced = await syncRefreshedUsername(
      user.userId,
      user.username,
      reportedUsername,
    );
    if (indexSynced) finalUser.username = reportedUsername;
  }

  finalUser.updatedAt = new Date().toISOString();
  await saveUserRecord(finalUser, partsData);
  await clearRefreshState(user.userId);

  console.log(`✅ [Cron Job] User ${user.userId}: Successfully updated`);
  return { status: "updated" };
}

/**
 * Refreshes one user's AniList stats.
 *
 * Every write is derived from the fresh response, so a redelivered message
 * rewrites the same values. The 404 counter is the one side effect that is not
 * idempotent, and it is guarded separately.
 *
 * @param userId - AniList identifier to refresh.
 * @returns What the attempt did, in terms the route maps to a status code.
 * @source
 */
export async function refreshUser(userId: string): Promise<RefreshUserOutcome> {
  let partsData: Awaited<ReturnType<typeof fetchUserDataParts>>;
  try {
    partsData = await fetchUserDataParts(userId, USER_DATA_PARTS);
  } catch (error) {
    console.error(
      `🔥 [Cron Job] User ${userId}: could not read the stored record: ${
        error instanceof Error ? error.message : String(error)
      }`,
    );
    return { status: "retryable", reason: "redis-read-failed" };
  }

  if (!partsData.meta) {
    console.warn(
      `[Cron Job] User ${userId}: no stored meta; removing stale refresh index entry.`,
    );
    try {
      await redisClient.zrem(USER_REFRESH_INDEX_KEY, userId);
    } catch (error) {
      console.error(
        `🔥 [Cron Job] User ${userId}: could not drop the stale index entry: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
      return { status: "retryable", reason: "index-entry-removal-failed" };
    }
    return { status: "stale" };
  }

  const user = reconstructUserRecord(partsData);
  console.log(
    `👤 [Cron Job] User ${user.userId} (${user.username || "no username"}): Starting update`,
  );

  const fetchResult = await fetchUserStats(user.userId);
  switch (fetchResult.kind) {
    case "invalid-id":
      await setRefreshCooldown(userId);
      console.warn(
        `⚠️ [Cron Job] User ${userId}: the stored record names an unusable AniList id: ${user.userId || "(empty)"}`,
      );
      return { status: "rejected", reason: "invalid-stored-user-id" };
    case "not-found":
      return recordAniListNotFound(userId);
    case "retryable":
      console.error(
        `🔥 [Cron Job] User ${userId}: AniList request failed: ${fetchResult.reason}`,
      );
      await setRefreshCooldown(userId);
      return { status: "retryable", reason: "anilist-unavailable" };
    case "ok":
      break;
  }

  try {
    return await applyFreshStats(partsData, fetchResult.statsData);
  } catch (error) {
    await setRefreshCooldown(userId);
    console.error(
      `🔥 [Cron Job] User ${userId}: could not save the refreshed record: ${
        error instanceof Error ? error.message : String(error)
      }`,
    );
    return { status: "retryable", reason: "record-save-failed" };
  }
}
