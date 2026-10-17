import { createHash, timingSafeEqual } from "node:crypto";
import { USER_STATS_QUERY } from "@/lib/anilist/queries";
import type { UserStatsData } from "@/lib/types/records";
import { safeParse } from "@/lib/utils";
import {
  redisClient,
  apiJsonHeaders,
  incrementAnalytics,
  buildAnalyticsMetricKey,
} from "@/lib/api-utils";
import type { Redis as UpstashRedis } from "@upstash/redis";
import { validateAndNormalizeUserRecord } from "@/lib/card-data/validation";
import {
  fetchUserDataParts,
  reconstructUserRecord,
  saveUserRecord,
  deleteUserRecord,
  buildUsernameIndexKey,
  syncUsernameIndex,
  rebuildUserRefreshIndex,
  USER_DATA_PARTS,
  USER_REFRESH_INDEX_KEY,
  USER_REFRESH_INDEX_UNREADABLE_SCORE,
  type UserRefreshIndexRebuildResult,
} from "@/lib/server/user-data";

/**
 * Compares the presented cron secret against the configured one without
 * letting the comparison time depend on how many leading characters match.
 * Both values are hashed first, so the comparison always covers 32 bytes and
 * no length information leaks either.
 * @param presented - Value of the x-cron-secret header, if any.
 * @returns True when the presented secret matches the configured one.
 * @source
 */
function cronSecretMatches(presented: string | null): boolean {
  const configuredSecret = process.env.CRON_SECRET ?? "";
  const configuredDigest = createHash("sha256")
    .update(configuredSecret)
    .digest();
  const presentedDigest = createHash("sha256")
    .update(presented ?? "")
    .digest();
  return timingSafeEqual(configuredDigest, presentedDigest);
}

/**
 * Tracks the outcome of a user's AniList stats refresh.
 * @source
 */
type UpdateResult =
  | { success: true; is404Error: false; statsData: UserStatsData }
  | { success: false; is404Error: boolean };

type UserRefreshCandidate = { id: string; updatedAt: number };

type UserRefreshIndexSelection = {
  cooldownResults: (string | number | null)[];
  fetchedCandidateIds: string[];
  candidates: UserRefreshCandidate[];
  cooledDownUserIds: Set<string>;
  eligibleUsers: UserRefreshCandidate[];
  indexPagesRead: number;
  indexExhausted: boolean;
};

type UserRefreshIndexPage = {
  candidateIds: string[];
  candidates: UserRefreshCandidate[];
  cooldowns: (string | number | null)[];
};

type UserRefreshIndexState = {
  totalUsers: number;
  indexRebuilt: boolean;
  rebuildCounts: UserRefreshIndexRebuildResult | null;
};

type UserRefreshOutcome = "success" | "failed" | "removed" | "stale";

type UserRefreshBatchResult = {
  successfulUpdates: number;
  failedUpdates: number;
  removedUsers: number;
  staleIndexEntriesRemoved: number;
};

const MAX_GRAPHQL_INT = 2_147_483_647;
const MAX_STATS_FETCH_ATTEMPTS = 3;
const STATS_FETCH_TIMEOUT_MS = 15_000;
const STATS_FETCH_RETRY_DELAY_MS = 500;
const REFRESH_COOLDOWN_SECONDS = 15 * 60;
/** Users refreshed per run. */
const BATCH_SIZE = 5;
/**
 * Index entries read per page. Five batches wide, so a page can lose users to
 * cooldown and still fill the batch from the rest of the page.
 * @source
 */
const INDEX_WINDOW_PAGE_SIZE = BATCH_SIZE * 5;
/**
 * Maximum index pages read per run. Reasons to page: skipped cooldown entries
 * and index entries whose record is gone. The cap bounds selection to ten
 * ZRANGE and ten MGET commands no matter how far the queue has drifted.
 * @source
 */
const INDEX_WINDOW_PAGE_LIMIT = 10;
/** How long an index repair marker suppresses the next rebuild. */
const INDEX_REPAIR_INTERVAL_SECONDS = 24 * 60 * 60;
const INDEX_REPAIR_LEASE_KEY = "users:refresh-index:repair-lease";

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

async function handleStatsFetchFailure(
  userId: string,
  attempt: number,
  error: unknown,
): Promise<void> {
  const errorMessage = error instanceof Error ? error.message : String(error);
  if (error instanceof Error && error.stack) {
    console.error(
      `💥 [Cron Job] User ${userId}: Error detail: ${error.stack}`,
    );
  }
  if (attempt === MAX_STATS_FETCH_ATTEMPTS) {
    console.error(
      `🔥 [Cron Job] User ${userId}: Final attempt failed - ${errorMessage}`,
    );
    return;
  }

  console.warn(
    `⚠️ [Cron Job] User ${userId}: Retrying (${MAX_STATS_FETCH_ATTEMPTS - attempt} left) - ${errorMessage}`,
  );
  await new Promise<void>((resolve) =>
    setTimeout(resolve, STATS_FETCH_RETRY_DELAY_MS * 2 ** (attempt - 1)),
  );
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
      await handleStatsFetchFailure(userId, attempt, error);
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

/**
 * Formats how long the oldest selected record has been waiting, using its
 * index score, which is already a millisecond timestamp.
 *
 * @param score - Score read from the refresh index, or undefined when nothing
 *   was selected.
 * @returns A minute count, `none` when nothing was selected, or `unknown` for
 *   a score that is not a usable timestamp.
 * @source
 */
function formatOldestStaleAge(score: number | undefined): string {
  if (score === undefined) return "none";
  if (score === USER_REFRESH_INDEX_UNREADABLE_SCORE) return "unknown";
  // A zero or non-finite score is not a timestamp, so it has no age to report.
  // Printing the epoch-relative difference here would read as tens of millions
  // of minutes and misrepresent the queue's health.
  if (!Number.isFinite(score) || score <= 0) return "unknown";
  return `${Math.floor(Math.max(0, Date.now() - score) / 60_000)} minutes`;
}

/**
 * Measures a value read back from Redis for the payload-size metric.
 *
 * The Upstash client parses stored JSON, so a cooldown written as `"1"` comes
 * back as the number `1`, and an absent key comes back as null. Coercing here
 * keeps the metric from throwing on a numeric reply.
 *
 * @param value - Value returned by a Redis read.
 * @returns Byte length of the value's serialized form, or 0 when it is empty.
 * Never throws on unusual or non-serializable values.
 * @source
 */
function measureRedisValueBytes(value: unknown): number {
  if (value === null || value === undefined) return 0;
  if (typeof value === "string") return Buffer.byteLength(value);
  if (typeof value === "number" || typeof value === "boolean") {
    return Buffer.byteLength(String(value));
  }
  try {
    return Buffer.byteLength(JSON.stringify(value) ?? "");
  } catch {
    return Buffer.byteLength(String(value));
  }
}

/**
 * Outcome of the index repair lease claim.
 * - `due`: this run won the lease and should rebuild.
 * - `held`: another run holds the lease, so this run normally skips the rebuild.
 * - `unavailable`: the claim itself failed, which is a Redis problem, not a
 *   cadence decision, and the log line says so.
 * @source
 */
type IndexRepairLeaseState = "due" | "held" | "unavailable";

/**
 * Claims the index repair lease so a rebuild runs at most once per interval.
 * The lease is a plain key with a TTL, so a failed run simply allows the next
 * run to try again after the TTL expires.
 * @returns Whether this run owns the repair cadence.
 * @source
 */
async function claimIndexRepairLease(): Promise<IndexRepairLeaseState> {
  try {
    const claimed = await redisClient.set(INDEX_REPAIR_LEASE_KEY, "1", {
      nx: true,
      ex: INDEX_REPAIR_INTERVAL_SECONDS,
    });
    return claimed !== null ? "due" : "held";
  } catch (error) {
    console.warn(
      `[Cron Job] Failed to claim the index repair lease; skipping the cadence repair: ${error instanceof Error ? error.message : String(error)}`,
    );
    return "unavailable";
  }
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

async function repairUserRefreshIndex(
  initialTotalUsers: number,
): Promise<UserRefreshIndexState> {
  let totalUsers = initialTotalUsers;
  let indexRebuilt = false;
  let rebuildCounts: UserRefreshIndexRebuildResult | null = null;
  const indexIsEmpty = totalUsers === 0;
  const indexRepair = indexIsEmpty ? "held" : await claimIndexRepairLease();

  if (indexIsEmpty || indexRepair === "due") {
    try {
      const rebuild = await rebuildUserRefreshIndex();
      totalUsers = Number(await redisClient.zcard(USER_REFRESH_INDEX_KEY)) || 0;
      rebuildCounts = rebuild;
      indexRebuilt = true;
      console.log(
        `🧭 [Cron Job] Refreshed the user index (${indexIsEmpty ? "empty" : "repair due"}); indexed ${rebuild.indexedUsers} users, missing meta ${rebuild.missingMetaCount}, unreadable meta ${rebuild.malformedMetaCount}, dropped ${rebuild.droppedStaleMembers} stale entries. It now holds ${totalUsers} users.`,
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (indexIsEmpty) {
        console.error(
          `🔥 [Cron Job] The refresh index is empty and could not be rebuilt: ${message}`,
        );
        throw error;
      }
      if (indexRepair === "due") {
        try {
          await redisClient.del(INDEX_REPAIR_LEASE_KEY);
        } catch {
          // The lease expires on its own; nothing to do here.
        }
      }
      console.error(
        `[Cron Job] Index repair failed; continuing with the current index: ${message}`,
      );
    }
  }

  return { totalUsers, indexRebuilt, rebuildCounts };
}

async function readRefreshIndexPage(
  start: number,
  seenUserIds: Set<string>,
): Promise<UserRefreshIndexPage | null> {
  const indexEntries = await redisClient.zrange<(number | string)[]>(
    USER_REFRESH_INDEX_KEY,
    start,
    start + INDEX_WINDOW_PAGE_SIZE - 1,
    { withScores: true },
  );

  const candidates: UserRefreshCandidate[] = [];
  for (let i = 0; i + 1 < indexEntries.length; i += 2) {
    const id = String(indexEntries[i]);
    if (!/^\d+$/.test(id)) continue;
    if (seenUserIds.has(id)) continue;
    seenUserIds.add(id);
    candidates.push({
      id,
      updatedAt: Number(indexEntries[i + 1]) || 0,
    });
  }

  if (candidates.length === 0) return null;

  const candidateIds = candidates.map(({ id }) => id);
  const cooldownKeys = candidateIds.map(
    (id) => `cron:refresh-cooldown:${id}`,
  );
  const cooldowns = await redisClient.mget<(string | number | null)[]>(
    ...cooldownKeys,
  );

  return { candidateIds, candidates, cooldowns };
}

function collectEligibleRefreshCandidates(
  page: UserRefreshIndexPage,
  selection: UserRefreshIndexSelection,
): void {
  for (let i = 0; i < page.candidateIds.length; i++) {
    if (page.cooldowns[i]) {
      selection.cooledDownUserIds.add(page.candidateIds[i]);
      continue;
    }
    selection.candidates.push(page.candidates[i]);
    if (selection.eligibleUsers.length < BATCH_SIZE) {
      selection.eligibleUsers.push(page.candidates[i]);
    }
  }
}

async function selectRefreshIndexUsers(
  totalUsers: number,
): Promise<UserRefreshIndexSelection> {
  const selection: UserRefreshIndexSelection = {
    cooldownResults: [],
    fetchedCandidateIds: [],
    candidates: [],
    cooledDownUserIds: new Set<string>(),
    eligibleUsers: [],
    indexPagesRead: 0,
    indexExhausted: true,
  };
  const seenUserIds = new Set<string>();

  for (
    let pageNumber = 0;
    pageNumber < INDEX_WINDOW_PAGE_LIMIT &&
    selection.eligibleUsers.length < BATCH_SIZE;
    pageNumber++
  ) {
    const start = pageNumber * INDEX_WINDOW_PAGE_SIZE;
    if (start >= totalUsers) {
      selection.indexExhausted = true;
      break;
    }

    selection.indexPagesRead++;
    selection.indexExhausted =
      start + INDEX_WINDOW_PAGE_SIZE >= totalUsers;

    const page = await readRefreshIndexPage(start, seenUserIds);
    if (!page) continue;

    selection.fetchedCandidateIds.push(...page.candidateIds);
    selection.cooldownResults.push(...page.cooldowns);
    collectEligibleRefreshCandidates(page, selection);
  }

  return selection;
}

async function setFailedRefreshCooldown(userId: string): Promise<void> {
  try {
    await setRefreshCooldown(redisClient, userId);
  } catch (error) {
    console.error(
      `[Cron Job] User ${userId}: Failed to set refresh cooldown: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}

function recordRefreshOutcome(
  result: UserRefreshBatchResult,
  outcome: UserRefreshOutcome,
): void {
  switch (outcome) {
    case "success":
      result.successfulUpdates++;
      return;
    case "stale":
      result.staleIndexEntriesRemoved++;
      return;
    case "removed":
      result.failedUpdates++;
      result.removedUsers++;
      return;
    case "failed":
      result.failedUpdates++;
  }
}

async function processRefreshUser(
  id: string,
  result: UserRefreshBatchResult,
): Promise<void> {
  let outcome: UserRefreshOutcome = "failed";
  try {
    const partsData = await fetchUserDataParts(id, USER_DATA_PARTS);
    if (!partsData.meta) {
      console.warn(
        `[Cron Job] User ${id}: no stored meta; removing stale refresh index entry.`,
      );
      await redisClient.zrem(USER_REFRESH_INDEX_KEY, id);
      outcome = "stale";
      return;
    }
    const user = reconstructUserRecord(partsData);

    console.log(
      `👤 [Cron Job] User ${user.userId} (${user.username || "no username"}): Starting update`,
    );

    const updateResult = await updateUserStats(user.userId);

    if (updateResult.success) {
      user.stats = updateResult.statsData;
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
      await saveUserRecord(finalUser, partsData);
      await clearRefreshState(redisClient, user.userId);
      outcome = "success";

      console.log(`✅ [Cron Job] User ${user.userId}: Successfully updated`);
    } else if (updateResult.is404Error) {
      const wasRemoved = await handleFailureTracking(
        redisClient,
        user.userId,
      );
      if (wasRemoved) {
        outcome = "removed";
      }
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error(
      `🔥 [Cron Job] Error processing user ${id}: ${errorMessage}`,
    );
    if (error instanceof Error && error.stack) {
      console.error(`💥 [Cron Job] Stack Trace: ${error.stack}`);
    }
  } finally {
    recordRefreshOutcome(result, outcome);
    if (outcome === "failed") {
      await setFailedRefreshCooldown(id);
    }
  }
}

async function processRefreshBatch(
  batch: UserRefreshCandidate[],
): Promise<UserRefreshBatchResult> {
  const result: UserRefreshBatchResult = {
    successfulUpdates: 0,
    failedUpdates: 0,
    removedUsers: 0,
    staleIndexEntriesRemoved: 0,
  };

  await Promise.all(
    batch.map(({ id }) => processRefreshUser(id, result)),
  );
  return result;
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

  if (!CRON_SECRET && process.env.NODE_ENV !== "development") {
    console.error("🔒 [Cron Job] CRON_SECRET is not configured");
    return new Response("Cron authorization is not configured", {
      status: 503,
      headers: apiJsonHeaders(request),
    });
  } else if (!CRON_SECRET) {
    console.warn(
      "[Cron Job] CRON_SECRET is not configured. Skipping authorization in development.",
    );
  } else if (!cronSecretMatches(cronSecretHeader)) {
    console.error("🔒 [Cron Job] Unauthorized: Invalid Cron secret");
    return new Response("Unauthorized", {
      status: 401,
      headers: apiJsonHeaders(request),
    });
  } else {
    console.info("[Cron Job] Cron secret verified.");
  }

  try {
    console.log("🛠️ [Cron Job] Authorized, starting background update...");

    const selectionStartedAt = Date.now();
    const indexState = await repairUserRefreshIndex(
      Number(await redisClient.zcard(USER_REFRESH_INDEX_KEY)),
    );
    const { totalUsers, indexRebuilt, rebuildCounts } = indexState;

    const rebuildSummary = rebuildCounts
      ? `Index spans ${rebuildCounts.indexedUsers}, unreadable meta ${rebuildCounts.malformedMetaCount}, missing meta ${rebuildCounts.missingMetaCount}, stale entries dropped ${rebuildCounts.droppedStaleMembers}.`
      : "";

    // Walk the index from the stalest score upward, one page at a time, and
    // keep the first batch that is not cooling down. A single page is not
    // enough: cooled-down and stale entries stay in the index until the job
    // reaches them, so they can fill a page on their own and would otherwise
    // stall every later user behind them.
    // Cooldown reads return a parsed number rather than a string, so the type
    // mirrors what the client actually hands back.
    const selection = await selectRefreshIndexUsers(totalUsers);
    const {
      cooldownResults,
      fetchedCandidateIds,
      candidates,
      cooledDownUserIds,
      eligibleUsers,
      indexPagesRead,
      indexExhausted,
    } = selection;
    const candidateIds = fetchedCandidateIds;
    const batch = eligibleUsers;
    const selectionDurationMs = Date.now() - selectionStartedAt;
    const selectionRedisCommandCount =
      1 + indexPagesRead * 2 + Number(indexPagesRead > 0);

    console.log("[Cron Job] User selection metrics:", {
      indexCommands: selectionRedisCommandCount,
      indexedUsers: totalUsers,
      indexRebuilt,
      indexPagesRead,
      candidateUsers: candidateIds.length,
      coolingDownUsers: cooledDownUserIds.size,
      approximateReturnedPayloadBytes:
        candidateIds.reduce((bytes, id) => bytes + Buffer.byteLength(id), 0) +
        cooldownResults.reduce<number>(
          (bytes, value) => bytes + measureRedisValueBytes(value),
          0,
        ),
      durationMs: selectionDurationMs,
    });

    const oldestStaleAge = formatOldestStaleAge(candidates[0]?.updatedAt);

    if (batch.length === 0 && totalUsers > 0) {
      console.warn(
        `⚠️ [Cron Job] No user in the selection window was eligible (${candidateIds.length} checked, ${cooledDownUserIds.size} cooling down, index ${indexExhausted ? "exhausted" : "window limit reached"}).`,
      );
      await incrementAnalytics(
        buildAnalyticsMetricKey("cron", "ineligible_selection_windows"),
      ).catch(() => {});
    }

    console.log(
      `🚀 [Cron Job] Starting background update for ${batch.length} eligible users (${eligibleUsers.length} eligible, ${cooledDownUserIds.size} cooling down, ${candidateIds.length} candidates over ${indexPagesRead} pages, ${totalUsers} indexed).`,
    );

    const {
      successfulUpdates,
      failedUpdates,
      removedUsers,
      staleIndexEntriesRemoved,
    } = await processRefreshBatch(batch);

    console.log(
      `🎉 [Cron Job] Cron job completed successfully. Processed ${batch.length} users out of total ${totalUsers} users.`,
      `📊 Results: ${successfulUpdates} successful, ${failedUpdates} failed, ${removedUsers} removed, ${staleIndexEntriesRemoved} stale index entries dropped. Oldest stale record: ${oldestStaleAge}.`,
    );

    // Compute recommended cron expressions for 5 and 10 users per run
    const recFor5 = computeCronForBatch(totalUsers, BATCH_SIZE);
    const recFor10 = computeCronForBatch(totalUsers, BATCH_SIZE * 2);

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

    const attemptedUsers = successfulUpdates + failedUpdates;
    const staleSuffix = staleIndexEntriesRemoved
      ? `, Stale index entries dropped: ${staleIndexEntriesRemoved}`
      : "";

    const scheduleMessage = [
      `Updated ${successfulUpdates}/${attemptedUsers} users successfully. Failed: ${failedUpdates}, Removed: ${removedUsers}${staleSuffix}`,
      `Eligible users: ${eligibleUsers.length}/${candidateIds.length}; cooling down: ${cooledDownUserIds.size}; indexes scanned: ${indexPagesRead} page(s) of ${INDEX_WINDOW_PAGE_SIZE}; oldest stale record: ${oldestStaleAge}.`,
      ...(rebuildSummary ? [rebuildSummary] : []),
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
