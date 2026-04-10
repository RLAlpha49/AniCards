/**
 * Background refresh job for cached AniList user data.
 *
 * The cron route updates the oldest stored users in small batches so cached
 * profiles stay reasonably fresh without overwhelming AniList, and it removes
 * records only after repeated 404s to distinguish deleted accounts from
 * transient upstream failures. The repository's cron contract lives in
 * `vercel.json`, and this route returns capacity/budget context so operators can
 * see when the fixed cadence no longer meets the 24-hour freshness goal.
 */
import type { Redis as UpstashRedis } from "@upstash/redis";

import { USER_STATS_QUERY } from "@/lib/anilist/queries";
import { redisClient } from "@/lib/api/clients";
import { apiTextHeaders } from "@/lib/api/cors";
import { apiErrorResponse } from "@/lib/api/errors";
import { logPrivacySafe } from "@/lib/api/logging";
import { initializeApiRequest } from "@/lib/api/request-guards";
import {
  ANILIST_GRAPHQL_CIRCUIT_BREAKER,
  ANILIST_GRAPHQL_URL,
  authorizeCronRequest,
  buildAniListGraphQlRequestInit,
  fetchUpstreamWithRetry,
  UpstreamTransportError,
} from "@/lib/api/upstream";
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
import type { UserStatsData } from "@/lib/types/records";

/**
 * Tracks the outcome of a user's AniList stats refresh.
 * @source
 */
type UpdateResult =
  | {
      success: true;
      is404Error: false;
      statsData: AniListUserStatsData;
    }
  | {
      success: false;
      is404Error: boolean;
    };

const FAILED_UPDATE_TTL_SECONDS = 14 * 24 * 60 * 60;
const USER_REFRESH_DEFERRED_DATA_PARTS = ALL_USER_DATA_PARTS.filter(
  (part) => part !== "meta",
);
const CRON_REFRESH_BATCH_SIZE = 5;
const CRON_REFRESH_SCHEDULE = "0 */20 * * *";
const CRON_REFRESH_RUNS_PER_DAY = 4;

type AniListUserStatsData = UserStatsData & {
  User: UserStatsData["User"] & {
    id: number | string;
  };
};

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

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function getAniListGraphQlErrorMessage(payload: unknown): string | null {
  if (!isRecord(payload) || !Array.isArray(payload.errors)) {
    return null;
  }

  const messages = payload.errors
    .map((error) => {
      if (!isRecord(error) || typeof error.message !== "string") {
        return "";
      }

      return error.message.trim();
    })
    .filter((message) => message.length > 0);

  if (messages.length > 0) {
    return messages.join("; ");
  }

  return payload.errors.length > 0 ? "AniList returned GraphQL errors" : null;
}

function isAniListUserStatsData(
  value: unknown,
  expectedUserId: string,
): value is AniListUserStatsData {
  if (!isRecord(value)) {
    return false;
  }

  const user = value.User;
  if (!isRecord(user)) {
    return false;
  }

  const resolvedUserId =
    typeof user.id === "number"
      ? String(user.id)
      : typeof user.id === "string"
        ? user.id.trim()
        : "";

  return resolvedUserId === expectedUserId;
}

function summarizeCronRefreshBudget(totalUsers: number): {
  dailyCapacity: number;
  estimatedSweepHours: number;
  note: string;
} {
  const dailyCapacity = CRON_REFRESH_BATCH_SIZE * CRON_REFRESH_RUNS_PER_DAY;
  let estimatedSweepHours = 0;
  if (totalUsers > 0) {
    estimatedSweepHours = Math.max(
      1,
      Math.ceil((totalUsers / dailyCapacity) * 24),
    );
  }

  if (totalUsers === 0) {
    return {
      dailyCapacity,
      estimatedSweepHours,
      note: "No stored users are currently queued for refresh.",
    };
  }

  if (totalUsers <= dailyCapacity) {
    return {
      dailyCapacity,
      estimatedSweepHours,
      note: "Current footprint fits within the repo-managed 24-hour freshness budget.",
    };
  }

  return {
    dailyCapacity,
    estimatedSweepHours,
    note: `Current footprint exceeds the repo-managed 24-hour freshness budget by ${totalUsers - dailyCapacity} users; change cadence and per-run batch budget together in a follow-up instead of only increasing invocation frequency.`,
  };
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
      executionEnvironment: "server",
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
      url: ANILIST_GRAPHQL_URL,
      init: buildAniListGraphQlRequestInit({
        query: USER_STATS_QUERY,
        request,
        signal,
        variables: { userId },
      }),
      circuitBreaker: ANILIST_GRAPHQL_CIRCUIT_BREAKER,
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

    const statsPayload = (await statsResponse.json()) as unknown;
    const graphQlErrorMessage = getAniListGraphQlErrorMessage(statsPayload);
    if (graphQlErrorMessage) {
      logPrivacySafe(
        "warn",
        "Cron Job",
        "AniList returned GraphQL errors during scheduled refresh",
        { userId, error: graphQlErrorMessage },
        request,
      );
      return { success: false, is404Error: false };
    }

    const statsData = isRecord(statsPayload) ? statsPayload.data : undefined;
    if (!isAniListUserStatsData(statsData, userId)) {
      logPrivacySafe(
        "warn",
        "Cron Job",
        "AniList returned a malformed stats payload during scheduled refresh",
        { userId },
        request,
      );
      return { success: false, is404Error: false };
    }

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
      "Authorized cron request, starting background update",
      undefined,
      request,
    );

    // Refresh the stalest records first and keep the batch small. That trades a
    // little peak freshness for predictable AniList load and more stable cron runs.
    const { userIds, totalUsers } = await listStalestUserIds(
      CRON_REFRESH_BATCH_SIZE,
    );
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
            user.stats = updateResult.statsData;

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

    const refreshBudget = summarizeCronRefreshBudget(totalUsers);

    logPrivacySafe(
      "log",
      endpoint,
      "Generated repo-managed refresh budget summary",
      {
        configuredBatchSize: CRON_REFRESH_BATCH_SIZE,
        dailyCapacity: refreshBudget.dailyCapacity,
        estimatedSweepHours: refreshBudget.estimatedSweepHours,
        schedule: CRON_REFRESH_SCHEDULE,
      },
      request,
    );

    const headers = apiTextHeaders(request);

    const scheduleMessage = [
      `Updated ${successfulUpdates}/${batch.length} users successfully. Failed: ${failedUpdates}, Removed: ${removedUsers}`,
      "",
      `Repo-managed refresh schedule: ${CRON_REFRESH_SCHEDULE} (${CRON_REFRESH_RUNS_PER_DAY} runs/day).`,
      `Refresh capacity budget: ${CRON_REFRESH_BATCH_SIZE} users/run, ${refreshBudget.dailyCapacity} users/day.`,
      `Current stored users: ${totalUsers}. Estimated full-sweep window: ~${refreshBudget.estimatedSweepHours} hours.`,
      refreshBudget.note,
    ].join("\n");

    return new Response(scheduleMessage, { status: 200, headers });
  } catch (error: unknown) {
    const normalizedError =
      error instanceof Error ? error : new Error(String(error));

    logPrivacySafe(
      "error",
      endpoint,
      "Cron job failed",
      {
        error: normalizedError.message,
        ...(normalizedError.stack ? { stack: normalizedError.stack } : {}),
      },
      request,
    );
    return apiErrorResponse(request, 500, "Cron job failed");
  }
}
