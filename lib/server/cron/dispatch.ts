/**
 * Publishing for the refresh dispatch.
 *
 * Each selected user gets one QStash message to `/api/cron/refresh-user`.
 * Delivery, retry and logging happen per message, so one slow or failing user
 * cannot hold the run open or cost the rest of the batch its retries.
 *
 * @source
 */

import "server-only";

import { redisClient } from "@/lib/api-utils";
import {
  buildRefreshCooldownKey,
  REFRESH_IN_FLIGHT_SECONDS,
} from "@/lib/server/refresh-cooldown";
import {
  getQstashClient,
  REFRESH_FLOW_CONTROL,
  REFRESH_MESSAGE_RETRIES,
} from "@/lib/server/qstash";
import { createLogger } from "@/lib/log";

const log = createLogger("Cron Job");

/** What one publish attempt produced for one user. @source */
export type PublishResult =
  { userId: string; messageId: string } | { userId: string; error: string };

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
export function resolveDispatchBaseUrl(): string | null {
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
  log.error(
    `Refusing to dispatch to ${url.origin}: the cron secret would travel in cleartext. Use an https origin, or loopback for local development.`,
  );
  return null;
}

/**
 * Marks users as queued so the next dispatch does not publish them again.
 *
 * QStash retries a failed delivery for up to about 32 minutes, and a dispatch
 * runs every 30. Without this marker the second dispatch would publish the
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
export async function markUsersInFlight(userIds: string[]): Promise<void> {
  await Promise.all(
    userIds.map((userId) =>
      redisClient
        .set(buildRefreshCooldownKey(userId), "1", {
          ex: REFRESH_IN_FLIGHT_SECONDS,
        })
        .catch((error) => {
          log.warn(
            `User ${userId}: could not mark the message in flight: ${error instanceof Error ? error.message : String(error)}`,
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
export async function publishRefreshMessages(
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
    log.error(
      `User ${userId}: publish failed - ${
        result.reason instanceof Error
          ? result.reason.message
          : String(result.reason)
      }`,
    );
    return { userId, error: "publish-failed" };
  });
}
