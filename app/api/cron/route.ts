import {
  redisClient,
  apiJsonHeaders,
  incrementAnalytics,
  buildAnalyticsMetricKey,
} from "@/lib/api-utils";
import { authorizeCronRequest } from "@/lib/server/cron-auth";
import { bootstrapRefreshIndexIfEmpty } from "@/lib/server/refresh-index-repair";
import { USER_REFRESH_INDEX_KEY } from "@/lib/server/user-data";
import {
  formatOldestStaleAge,
  measureRedisValueBytes,
  selectRefreshIndexUsers,
  type UserRefreshIndexSelection,
} from "@/lib/server/cron/select-candidates";
import {
  markUsersInFlight,
  publishRefreshMessages,
  resolveDispatchBaseUrl,
  type PublishResult,
} from "@/lib/server/cron/dispatch";
import { createLogger } from "@/lib/log";

const log = createLogger("Cron Job");

/**
 * Counts the Redis commands a selection took.
 *
 * One ZCARD for the index, two per page (ZRANGE plus the cooldown MGET), and
 * one command for the bootstrap read when the index had to be rebuilt.
 * @source
 */
function countSelectionCommands(indexPagesRead: number): number {
  return 1 + indexPagesRead * 2 + Number(indexPagesRead > 0);
}

/**
 * Shapes the selection summary every dispatch response carries.
 * @source
 */
function buildSelectionSummary(
  selection: UserRefreshIndexSelection,
  totalUsers: number,
  oldestStaleAge: string,
) {
  return {
    indexedUsers: totalUsers,
    batchSize: selection.batchSize,
    candidates: selection.fetchedCandidateIds.length,
    coolingDown: selection.cooledDownUserIds.size,
    eligible: selection.eligibleUsers.length,
    pagesRead: selection.indexPagesRead,
    indexExhausted: selection.indexExhausted,
    oldestStaleRecord: oldestStaleAge,
  };
}

/**
 * Dispatches the AniList stats refresh for the stalest users.
 *
 * The route keeps the selection work and publishes one message per selected
 * user to `/api/cron/refresh-user`. Each message is delivered, retried, and
 * logged on its own, so one slow or failing user cannot hold the run open or
 * cost the rest of the batch its retries.
 *
 * @param request - Incoming request which must include the cron secret header.
 * @returns JSON describing the messages published and the selection that
 *   produced them.
 * @source
 */
export async function POST(request: Request) {
  const authorizationFailure = authorizeCronRequest(request);
  if (authorizationFailure) return authorizationFailure;

  const baseUrl = resolveDispatchBaseUrl();
  if (!baseUrl) {
    log.error(
      "Neither NEXT_PUBLIC_APP_URL nor NEXT_PUBLIC_SITE_URL is set; cannot address the consumer route.",
    );
    return new Response(
      JSON.stringify({
        error: "Cron dispatch is not configured: no app origin",
      }),
      { status: 503, headers: apiJsonHeaders(request) },
    );
  }

  try {
    log.log("Authorized, starting refresh dispatch...");

    const selectionStartedAt = Date.now();
    // The dispatch cannot select from an empty index, so it rebuilds one when
    // it finds none. Correcting drift in a populated index belongs to the
    // scheduled repair (`/api/cron/repair-index`), not to every dispatch.
    const { totalUsers, rebuilt: indexRebuilt } =
      await bootstrapRefreshIndexIfEmpty(
        Number(await redisClient.zcard(USER_REFRESH_INDEX_KEY)),
      );

    // Walk the index from the stalest score upward, one page at a time, and
    // keep the first batch that is not cooling down. The batch is a 48th of
    // the index, clamped to 1..5, so every user is refreshed once a day. A
    // single page is not enough: cooled-down and stale entries stay in the
    // index until the job reaches them, so they can fill a page on their own
    // and would otherwise stall every later user behind them.
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
    const selectionRedisCommandCount = countSelectionCommands(indexPagesRead);

    log.log("User selection metrics:", {
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
      log.warn(
        `No user in the selection window was eligible (${candidateIds.length} checked, ${cooledDownUserIds.size} cooling down, index ${indexExhausted ? "exhausted" : "window limit reached"}).`,
      );
      await incrementAnalytics(
        buildAnalyticsMetricKey("cron", "ineligible_selection_windows"),
      ).catch(() => {});
    }

    log.log(
      `Publishing ${batch.length} refresh messages (batch of ${selection.batchSize}, ${eligibleUsers.length} eligible, ${cooledDownUserIds.size} cooling down, ${candidateIds.length} candidates over ${indexPagesRead} pages, ${totalUsers} indexed).`,
    );

    let publishResults: PublishResult[];
    try {
      publishResults = await publishRefreshMessages(
        baseUrl,
        batch.map(({ id }) => id),
      );
    } catch (error) {
      // `getQstashClient` throws before any publish when the token is missing.
      // That is a configuration failure for the whole run, so report it in the
      // same dispatch shape instead of the generic error body.
      log.error(
        `Could not publish: ${error instanceof Error ? error.message : String(error)}`,
      );
      return new Response(
        JSON.stringify({
          published: 0,
          failed: batch.length,
          messageIds: [],
          failedUserIds: batch.map(({ id }) => id),
          selection: buildSelectionSummary(
            selection,
            totalUsers,
            oldestStaleAge,
          ),
          indexRebuilt,
          error: "publish-unavailable",
        }),
        { status: 500, headers: apiJsonHeaders(request) },
      );
    }
    const published = publishResults.filter(
      (result): result is { userId: string; messageId: string } =>
        "messageId" in result,
    );
    const failed = publishResults.filter(
      (result): result is { userId: string; error: string } =>
        "error" in result,
    );

    for (const result of published) {
      log.log(`User ${result.userId}: queued as ${result.messageId}`);
    }

    // Only the users QStash accepted get the in-flight marker. A user whose
    // publish failed stays selectable, which is what re-queues them next run.
    await markUsersInFlight(published.map(({ userId }) => userId));

    const payload = {
      published: published.length,
      failed: failed.length,
      messageIds: published.map(({ messageId }) => messageId),
      failedUserIds: failed.map(({ userId }) => userId),
      selection: buildSelectionSummary(selection, totalUsers, oldestStaleAge),
      // Only the empty-index bootstrap runs here. Index repair and orphan
      // reconciliation run on their own schedule; read that route's response
      // for their counts.
      indexRebuilt,
    };

    // A run where every publish failed means the dispatcher is misconfigured or
    // the queue is unreachable. Answer 500 so the schedule's retry fires; a
    // partial success is reported as 200 because the unpublished users stay
    // in the index and the next run picks them up without republishing the
    // messages that already went out. A run that published nothing and failed
    // nothing (empty index, all cooling down) is healthy and answers 200.
    const status = published.length === 0 && failed.length > 0 ? 500 : 200;

    log.log(
      `Dispatch complete: ${published.length} published, ${failed.length} failed. Oldest stale record: ${oldestStaleAge}.`,
    );

    return new Response(JSON.stringify(payload), {
      status,
      headers: apiJsonHeaders(request),
    });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } catch (error: any) {
    log.error(`Cron job failed: ${error.message}`);
    if (error.stack) {
      log.error(`Stack Trace: ${error.stack}`);
    }
    return new Response(JSON.stringify({ error: "Cron job failed" }), {
      status: 500,
      headers: apiJsonHeaders(request),
    });
  }
}
