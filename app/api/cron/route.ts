import {
  redisClient,
  apiJsonHeaders,
  incrementAnalytics,
  buildAnalyticsMetricKey,
} from "@/lib/api-utils";
import { authorizeCronRequest } from "@/lib/server/cron-auth";
import {
  buildRefreshCooldownKey,
  REFRESH_IN_FLIGHT_SECONDS,
} from "@/lib/server/refresh-cooldown";
import {
  getQstashClient,
  REFRESH_FLOW_CONTROL,
  REFRESH_MESSAGE_RETRIES,
} from "@/lib/server/qstash";
import { bootstrapRefreshIndexIfEmpty } from "@/lib/server/refresh-index-repair";
import {
  USER_REFRESH_INDEX_KEY,
  USER_REFRESH_INDEX_UNREADABLE_SCORE,
} from "@/lib/server/user-data";

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

type PublishResult =
  { userId: string; messageId: string } | { userId: string; error: string };

/** Users published per run. */
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
  const cooldownKeys = candidateIds.map(buildRefreshCooldownKey);
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
    selection.indexExhausted = start + INDEX_WINDOW_PAGE_SIZE >= totalUsers;

    const page = await readRefreshIndexPage(start, seenUserIds);
    if (!page) continue;

    selection.fetchedCandidateIds.push(...page.candidateIds);
    selection.cooldownResults.push(...page.cooldowns);
    collectEligibleRefreshCandidates(page, selection);
  }

  return selection;
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
    // A circular or otherwise unserializable value cannot be stored in Redis
    // either, so it contributes no measurable payload bytes.
    return 0;
  }
}

/**
 * Origins that may be addressed over plain HTTP.
 *
 * The cron secret travels in each published message header, so a deployment
 * that publishes over HTTP would send it in cleartext. Loopback is the only
 * exception, because that is what local development uses.
 * @source
 */
const INSECURE_DISPATCH_HOSTS = new Set(["localhost", "127.0.0.1", "[::1]"]);

/**
 * Resolves the origin the per-user messages are published to.
 *
 * The value comes from `NEXT_PUBLIC_APP_URL` or `NEXT_PUBLIC_SITE_URL`. Both
 * are documented as public configuration, and the example environment uses
 * `http://localhost:3000`, so the scheme is checked here rather than assumed.
 *
 * @returns A base URL without a trailing slash, or null when none is usable.
 * @source
 */
function resolveDispatchBaseUrl(): string | null {
  const configured =
    process.env.NEXT_PUBLIC_APP_URL || process.env.NEXT_PUBLIC_SITE_URL;
  if (!configured) return null;
  let url: URL;
  try {
    url = new URL(configured);
  } catch {
    return null;
  }
  if (url.protocol === "https:") return url.origin;
  if (url.protocol === "http:" && INSECURE_DISPATCH_HOSTS.has(url.hostname)) {
    return url.origin;
  }
  console.error(
    `[Cron Job] Refusing to dispatch to ${url.origin}: the cron secret would travel in cleartext. Use an https origin, or loopback for local development.`,
  );
  return null;
}

/**
 * Marks a user as queued so the next dispatch does not publish them again.
 *
 * QStash retries a failed delivery for up to about 32 minutes, and a dispatch
 * runs every 20. Without this marker the second dispatch would publish the
 * same user again while the first message is still retrying, which doubles the
 * AniList traffic the flow control exists to bound.
 *
 * The write is best effort. A missing marker only means a duplicate message,
 * and the consumer rewrites the same stats on a duplicate, so it cannot fail
 * the run.
 *
 * @param userIds - Users whose messages QStash accepted.
 * @source
 */
async function markUsersInFlight(userIds: string[]): Promise<void> {
  await Promise.all(
    userIds.map((userId) =>
      redisClient
        .set(buildRefreshCooldownKey(userId), "1", {
          ex: REFRESH_IN_FLIGHT_SECONDS,
        })
        .catch((error) => {
          console.warn(
            `[Cron Job] User ${userId}: could not mark the message in flight: ${
              error instanceof Error ? error.message : String(error)
            }`,
          );
        }),
    ),
  );
}

/**
 * Publishes one refresh message per selected user.
 *
 * Flow control keeps cron traffic inside the AniList budget: the messages
 * share one key, so they queue behind each other instead of all reaching
 * AniList at once. A failed publish leaves the user in the refresh index, so
 * the next dispatch selects them again.
 *
 * The error string is a short code, not the SDK message: QStash and Upstash
 * persist the response body and show it in their consoles.
 *
 * @param baseUrl - Origin of the deployment that hosts the consumer route.
 * @param userIds - Users selected for this run.
 * @returns One entry per user: the message id, or a failure code.
 * @source
 */
async function publishRefreshMessages(
  baseUrl: string,
  userIds: string[],
): Promise<PublishResult[]> {
  const client = getQstashClient();
  const cronSecret = process.env.CRON_SECRET;
  const url = `${baseUrl}/api/cron/refresh-user`;

  const results = await Promise.allSettled(
    userIds.map((userId) =>
      client.publishJSON({
        url,
        body: { userId },
        headers: cronSecret ? { "x-cron-secret": cronSecret } : undefined,
        retries: REFRESH_MESSAGE_RETRIES,
        flowControl: REFRESH_FLOW_CONTROL,
      }),
    ),
  );

  return results.map((result, index) => {
    const userId = userIds[index];
    if (result.status === "fulfilled") {
      return { userId, messageId: result.value.messageId };
    }
    // The detail stays in the server log.
    console.error(
      `🔥 [Cron Job] User ${userId}: publish failed - ${
        result.reason instanceof Error
          ? result.reason.message
          : String(result.reason)
      }`,
    );
    return { userId, error: "publish-failed" };
  });
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
    console.error(
      "[Cron Job] Neither NEXT_PUBLIC_APP_URL nor NEXT_PUBLIC_SITE_URL is set; cannot address the consumer route.",
    );
    return new Response(
      JSON.stringify({
        error: "Cron dispatch is not configured: no app origin",
      }),
      { status: 503, headers: apiJsonHeaders(request) },
    );
  }

  try {
    console.log("🛠️ [Cron Job] Authorized, starting refresh dispatch...");

    const selectionStartedAt = Date.now();
    // The dispatch cannot select from an empty index, so it rebuilds one when
    // it finds none. Correcting drift in a populated index belongs to the
    // scheduled repair (`/api/cron/repair-index`), not to every dispatch.
    const { totalUsers, rebuilt: indexRebuilt } =
      await bootstrapRefreshIndexIfEmpty(
        Number(await redisClient.zcard(USER_REFRESH_INDEX_KEY)),
      );

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
      `🚀 [Cron Job] Publishing ${batch.length} refresh messages (${eligibleUsers.length} eligible, ${cooledDownUserIds.size} cooling down, ${candidateIds.length} candidates over ${indexPagesRead} pages, ${totalUsers} indexed).`,
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
      console.error(
        `🔥 [Cron Job] Could not publish: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
      return new Response(
        JSON.stringify({
          published: 0,
          failed: batch.length,
          messageIds: [],
          failedUserIds: batch.map(({ id }) => id),
          selection: {
            indexedUsers: totalUsers,
            candidates: candidateIds.length,
            coolingDown: cooledDownUserIds.size,
            eligible: eligibleUsers.length,
            pagesRead: indexPagesRead,
            indexExhausted,
            oldestStaleRecord: oldestStaleAge,
          },
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
      console.log(
        `📨 [Cron Job] User ${result.userId}: queued as ${result.messageId}`,
      );
    }

    // Only the users QStash accepted get the in-flight marker. A user whose
    // publish failed stays selectable, which is what re-queues them next run.
    await markUsersInFlight(published.map(({ userId }) => userId));

    const payload = {
      published: published.length,
      failed: failed.length,
      messageIds: published.map(({ messageId }) => messageId),
      failedUserIds: failed.map(({ userId }) => userId),
      selection: {
        indexedUsers: totalUsers,
        candidates: candidateIds.length,
        coolingDown: cooledDownUserIds.size,
        eligible: eligibleUsers.length,
        pagesRead: indexPagesRead,
        indexExhausted,
        oldestStaleRecord: oldestStaleAge,
      },
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

    console.log(
      `🎉 [Cron Job] Dispatch complete: ${published.length} published, ${failed.length} failed. Oldest stale record: ${oldestStaleAge}.`,
    );

    return new Response(JSON.stringify(payload), {
      status,
      headers: apiJsonHeaders(request),
    });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } catch (error: any) {
    console.error(`🔥 [Cron Job] Cron job failed: ${error.message}`);
    if (error.stack) {
      console.error(`💥 [Cron Job] Stack Trace: ${error.stack}`);
    }
    return new Response(JSON.stringify({ error: "Cron job failed" }), {
      status: 500,
      headers: apiJsonHeaders(request),
    });
  }
}
