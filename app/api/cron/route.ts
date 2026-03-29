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
  apiTextHeaders,
  authorizeCronRequest,
  fetchUpstreamWithRetry,
  initializeApiRequest,
  logPrivacySafe,
  redisClient,
  UpstreamTransportError,
} from "@/lib/api-utils";
import { validateAndNormalizeUserRecord } from "@/lib/card-data/validation";
import { categorizeError } from "@/lib/error-messages";
import { trackUserActionError } from "@/lib/error-tracking";
import {
  ALL_USER_DATA_PARTS,
  deleteUserRecord,
  fetchUserDataParts,
  listStalestUserIds,
  reconstructUserRecord,
  saveUserRecord,
  USER_BOOTSTRAP_DATA_PARTS,
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

const FAILED_UPDATE_TTL_SECONDS = 14 * 24 * 60 * 60;
const USER_REFRESH_DEFERRED_DATA_PARTS = ALL_USER_DATA_PARTS.filter(
  (part) => part !== "meta",
);

type CronUserRefreshStage =
  | "fetch_user_data_parts"
  | "reconstruct_user_record"
  | "refresh_user_stats"
  | "normalize_user_record"
  | "save_user_record"
  | "clear_failure_tracking"
  | "handle_failure_tracking";

function normalizeCronUserRefreshError(error: unknown): Error {
  return error instanceof Error ? error : new Error(String(error));
}

async function reportCronUserRefreshError(options: {
  endpoint: string;
  error: unknown;
  request?: Request;
  requestId?: string;
  stage: CronUserRefreshStage;
  userId: string;
}): Promise<void> {
  const normalizedError = normalizeCronUserRefreshError(options.error);

  logPrivacySafe(
    "error",
    options.endpoint,
    "Error processing scheduled user refresh",
    {
      userId: options.userId,
      stage: options.stage,
      error: normalizedError.message,
      ...(normalizedError.stack ? { stack: normalizedError.stack } : {}),
    },
    options.request,
  );

  await trackUserActionError(
    "cron_refresh_user",
    normalizedError,
    categorizeError(normalizedError.message),
    {
      route: "/api/cron",
      source: "api_route",
      stack: normalizedError.stack,
      metadata: {
        endpoint: "cron_job",
        userId: options.userId,
        stage: options.stage,
        ...(options.requestId ? { requestId: options.requestId } : {}),
      },
    },
  );
}

/**
 * Attempts to fetch AniList stats for the given user with up to three retries.
 * @param userId - AniList identifier whose stats should be refreshed.
 * @returns Result detailing the fetch success, 404 status, and payload if available.
 * @source
 */
async function updateUserStats(
  userId: string,
  request?: Request,
  signal?: AbortSignal,
): Promise<UpdateResult> {
  try {
    logPrivacySafe(
      "log",
      "Cron Job",
      "Fetching AniList data for scheduled refresh",
      { userId },
      request,
    );

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
        signal,
      },
      circuitBreaker: {
        key: "anilist-graphql",
        degradedModeEnvVar: "ANILIST_UPSTREAM_DEGRADED_MODE",
      },
    });

    if (!statsResponse.ok) {
      const is404Error = statsResponse.status === 404;
      logPrivacySafe(
        "warn",
        "Cron Job",
        "AniList returned a non-success status during scheduled refresh",
        { userId, statusCode: statsResponse.status },
        request,
      );
      return { success: false, is404Error };
    }

    const statsData = await statsResponse.json();
    return { success: true, is404Error: false, statsData };
  } catch (error) {
    if (signal?.aborted) {
      return { success: false, is404Error: false };
    }

    if (error instanceof UpstreamTransportError) {
      logPrivacySafe(
        "error",
        "Cron Job",
        "AniList transport error during scheduled refresh",
        { userId, error: error.message },
        request,
      );
      return { success: false, is404Error: false };
    }

    logPrivacySafe(
      "error",
      "Cron Job",
      "AniList refresh failed after retries",
      {
        userId,
        error: error instanceof Error ? error.message : String(error),
        ...(error instanceof Error && error.stack
          ? { stack: error.stack }
          : {}),
      },
      request,
    );
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
  request?: Request,
): Promise<boolean> {
  const failureKey = `failed_updates:${userId}`;
  const currentFailureCount = (await redisClient.get(failureKey)) || 0;
  const newFailureCount = Number(currentFailureCount) + 1;

  logPrivacySafe(
    "warn",
    "Cron Job",
    "Recording repeated 404 failure for stored user",
    { userId, failureCount: newFailureCount },
    request,
  );

  if (newFailureCount >= 3) {
    const deleteResult = await deleteUserRecord(userId, {
      triggerSource: "cron_cleanup_404",
    });

    logPrivacySafe(
      "warn",
      "Cron Job",
      "Removed user after repeated AniList 404 responses",
      {
        userId,
        removedUsernameIndexKeys: deleteResult.usernameIndexKeys.join(","),
      },
      request,
    );
    return true;
  } else {
    await redisClient.set(failureKey, newFailureCount, {
      ex: FAILED_UPDATE_TTL_SECONDS,
    });
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
  const init = await initializeApiRequest(
    request,
    "Cron Job",
    "cron_job",
    undefined,
    { skipRateLimit: true, skipSameOrigin: true, requireOrigin: false },
  );
  if (init.errorResponse) return init.errorResponse;

  const { startTime, endpoint, requestId } = init;
  const authorizationError = authorizeCronRequest(request, endpoint);
  if (authorizationError) return authorizationError;

  try {
    logPrivacySafe(
      "log",
      endpoint,
      "QStash authorized, starting background update",
      undefined,
      request,
    );

    // Refresh the stalest records first and keep the batch small. That trades a
    // little peak freshness for predictable AniList load and more stable cron runs.
    const { userIds, totalUsers } = await listStalestUserIds(5);
    const batch = userIds.map((id) => ({ id }));

    logPrivacySafe(
      "log",
      endpoint,
      "Starting scheduled refresh batch",
      { batchSize: batch.length, totalUsers },
      request,
    );

    let successfulUpdates = 0;
    let failedUpdates = 0;
    let removedUsers = 0;

    await Promise.all(
      batch.map(async ({ id }) => {
        let stage: CronUserRefreshStage = "fetch_user_data_parts";
        let trackedUserId = id;
        const updateAbortController = new AbortController();
        const updateResultPromise = updateUserStats(
          id,
          request,
          updateAbortController.signal,
        );

        try {
          // Meta is enough to identify the stored user and log context. The
          // full split record is only needed when we actually have fresh stats
          // to persist, so defer the heavier Redis read until success.
          const metaParts = await fetchUserDataParts(
            id,
            [...USER_BOOTSTRAP_DATA_PARTS],
            {
              triggerSource: "cron_refresh",
            },
          );
          const meta = metaParts.meta as
            | { userId?: string; username?: string }
            | undefined;

          if (!meta) {
            throw new Error("Stored user metadata is missing");
          }

          trackedUserId =
            typeof meta.userId === "string" && meta.userId.length > 0
              ? meta.userId
              : id;

          logPrivacySafe(
            "log",
            endpoint,
            "Starting scheduled user refresh",
            {
              userId: trackedUserId,
              username:
                typeof meta.username === "string" && meta.username.length > 0
                  ? meta.username
                  : "no username",
            },
            request,
          );

          stage = "refresh_user_stats";
          const updateResult = await updateResultPromise;

          if (updateResult.success) {
            stage = "fetch_user_data_parts";
            const remainingParts = await fetchUserDataParts(
              trackedUserId,
              [...USER_REFRESH_DEFERRED_DATA_PARTS],
              {
                audit: false,
                triggerSource: "cron_refresh",
              },
            );

            stage = "reconstruct_user_record";
            const user = reconstructUserRecord({
              ...remainingParts,
              meta: metaParts.meta,
            });
            trackedUserId = user.userId || trackedUserId;
            user.stats = updateResult.statsData.data;

            stage = "normalize_user_record";
            const normalizationResult = validateAndNormalizeUserRecord(user);
            const finalUser =
              "normalized" in normalizationResult
                ? normalizationResult.normalized
                : user;

            finalUser.updatedAt = new Date().toISOString();

            stage = "save_user_record";
            await saveUserRecord(finalUser, {
              triggerSource: "cron_refresh",
            });

            logPrivacySafe(
              "log",
              endpoint,
              "Successfully refreshed stored user",
              { userId: trackedUserId },
              request,
            );
            successfulUpdates++;

            stage = "clear_failure_tracking";
            await clearFailureTracking(redisClient, trackedUserId);
          } else if (updateResult.is404Error) {
            failedUpdates++;

            stage = "handle_failure_tracking";
            const wasRemoved = await handleFailureTracking(
              redisClient,
              trackedUserId,
              request,
            );
            if (wasRemoved) {
              removedUsers++;
            }
          }
        } catch (error) {
          if (stage === "fetch_user_data_parts") {
            updateAbortController.abort(
              new Error(
                "Aborted scheduled refresh after bootstrap metadata load failed",
              ),
            );
            await updateResultPromise.catch(() => undefined);
          }

          await reportCronUserRefreshError({
            endpoint,
            error,
            request,
            requestId,
            stage,
            userId: trackedUserId,
          });
        }
      }),
    );

    logPrivacySafe(
      "log",
      endpoint,
      "Cron job completed",
      {
        durationMs: Date.now() - startTime,
        batchSize: batch.length,
        totalUsers,
        successfulUpdates,
        failedUpdates,
        removedUsers,
      },
      request,
    );

    const recFor5 = computeCronForBatch(totalUsers, 5);
    const recFor10 = computeCronForBatch(totalUsers, 10);

    // These recommendations are only operator-facing hints returned in the
    // response body. The route reports the schedule math, but an external cron
    // service still decides when to invoke it.

    logPrivacySafe(
      "log",
      endpoint,
      "Generated cron schedule recommendations",
      {
        recommendation5: recFor5.cron,
        recommendation10: recFor10.cron,
      },
      request,
    );

    const headers = apiTextHeaders(request);

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
    logPrivacySafe(
      "error",
      endpoint,
      "Cron job failed",
      {
        error: error.message,
        ...(error.stack ? { stack: error.stack } : {}),
      },
      request,
    );
    const headers = apiTextHeaders(request);
    return new Response("Cron job failed", { status: 500, headers });
  }
}
