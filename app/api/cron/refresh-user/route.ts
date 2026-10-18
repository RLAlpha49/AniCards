import { apiJsonHeaders } from "@/lib/api-utils";
import { authorizeCronRequest } from "@/lib/server/cron-auth";
import { parseAniListUserId, refreshUser } from "@/lib/server/refresh-user";
import type { RefreshUserOutcome } from "@/lib/server/refresh-user";

/** Status QStash reads as "do not retry; move the message to the dead letter queue". @source */
const NON_RETRYABLE_STATUS = 489;

/**
 * Builds a JSON response for one refresh attempt.
 * @param request - Request used to compute the allowed CORS origin.
 * @param body - JSON payload.
 * @param status - HTTP status.
 * @param nonRetryable - Whether to stop QStash from retrying the message.
 * @source
 */
function respond(
  request: Request,
  body: Record<string, unknown>,
  status: number,
  nonRetryable = false,
): Response {
  const headers = apiJsonHeaders(request);
  if (nonRetryable) headers["Upstash-NonRetryable-Error"] = "true";
  return new Response(JSON.stringify(body), { status, headers });
}

/**
 * Maps an outcome to the status that tells QStash whether to retry.
 *
 * Every outcome the code handles returns 200. Only a failure that another
 * delivery could fix returns 500.
 *
 * @param outcome - Result of the refresh attempt.
 * @returns The status code and the fields to report.
 * @source
 */
function statusForOutcome(outcome: RefreshUserOutcome): {
  status: number;
  body: Record<string, unknown>;
} {
  switch (outcome.status) {
    case "updated":
      return { status: 200, body: { outcome: "updated" } };
    case "stale":
      return { status: 200, body: { outcome: "stale-index-entry-removed" } };
    case "not-found":
      return {
        status: 200,
        body: { outcome: "not-found", failures: outcome.failures },
      };
    case "removed":
      return { status: 200, body: { outcome: "removed" } };
    case "duplicate":
      return { status: 200, body: { outcome: "duplicate-delivery" } };
    case "rejected":
      return {
        status: 200,
        body: { outcome: "rejected", reason: outcome.reason },
      };
    case "retryable":
      return {
        status: 500,
        body: { outcome: "retryable", reason: outcome.reason },
      };
  }
}

/**
 * Reads the user id out of a QStash message body.
 * @param body - Parsed JSON body.
 * @returns The id as a string, or null when the body carries no usable id.
 * @source
 */
function readUserId(body: unknown): string | null {
  if (typeof body !== "object" || body === null || Array.isArray(body)) {
    return null;
  }
  const raw = (body as Record<string, unknown>).userId;
  if (typeof raw === "number")
    return Number.isSafeInteger(raw) ? String(raw) : null;
  if (typeof raw !== "string") return null;
  return raw.trim() || null;
}

/**
 * Refreshes one user's AniList stats on behalf of a QStash message.
 *
 * The dispatcher publishes one message per selected user. This route runs the
 * refresh and reports a status QStash can act on. A malformed body answers 489
 * with `Upstash-NonRetryable-Error`, which sends it straight to the dead letter
 * queue instead of spending three retries on a body no retry can fix.
 *
 * @param request - Message delivery from QStash, or a manual call.
 * @returns The refresh outcome and the status that tells QStash what to do.
 * @source
 */
export async function POST(request: Request) {
  const authorizationFailure = authorizeCronRequest(request);
  if (authorizationFailure) return authorizationFailure;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return respond(
      request,
      { error: "Request body is not valid JSON" },
      NON_RETRYABLE_STATUS,
      true,
    );
  }

  const userId = readUserId(body);
  if (!userId || parseAniListUserId(userId) === null) {
    return respond(
      request,
      { error: "Request body must carry a valid AniList userId" },
      NON_RETRYABLE_STATUS,
      true,
    );
  }

  const outcome = await refreshUser(userId);
  const { status, body: payload } = statusForOutcome(outcome);

  if (status >= 500) {
    console.error(
      `🔥 [Cron Job] User ${userId}: refresh failed and will be retried - ${
        outcome.status === "retryable" ? outcome.reason : "unknown error"
      }`,
    );
  }

  return respond(request, { userId, ...payload }, status);
}
