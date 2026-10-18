import { apiJsonHeaders } from "@/lib/api-utils";
import { authorizeCronRequest } from "@/lib/server/cron-auth";
import { repairRefreshIndex } from "@/lib/server/refresh-index-repair";

/**
 * Caps the invocation. The repair is the only cron job whose cost scales with
 * the whole keyspace, and an explicit limit turns a run that would be killed
 * into a retryable failure instead.
 * @source
 */
export const maxDuration = 300;

/**
 * Maps a repair outcome to the status QStash acts on.
 *
 * A rebuild the code could not complete answers 500 so the schedule retries.
 * A rebuild whose cleanup failed also answers 500: the rebuild is idempotent,
 * and skipping the cleanup for a day is the coupling this route was split out
 * to remove. A skip is a handled outcome: another invocation owns this window.
 *
 * @param result - Outcome of the repair attempt.
 * @returns The status code and the body to report.
 * @source
 */
function statusForRepairResult(
  result: Awaited<ReturnType<typeof repairRefreshIndex>>,
): { status: number; body: Record<string, unknown> } {
  switch (result.status) {
    case "repaired":
      return {
        status: 200,
        body: {
          outcome: "repaired",
          totalUsers: result.totalUsers,
          rebuildCounts: result.rebuildCounts,
          reconciliation: result.reconciliation,
        },
      };
    case "partial":
      return {
        status: 500,
        body: {
          outcome: "partial",
          totalUsers: result.totalUsers,
          rebuildCounts: result.rebuildCounts,
          reason: result.reason,
        },
      };
    case "skipped":
      return {
        status: 200,
        body: {
          outcome: "skipped",
          totalUsers: result.totalUsers,
          reason: "another invocation holds the repair lease",
          leaseExpiresInSeconds: result.leaseExpiresInSeconds,
        },
      };
    case "failed":
      return {
        status: 500,
        body: { outcome: "failed", reason: result.reason },
      };
  }
}

/**
 * Repairs the user refresh index and reconciles orphaned keys.
 *
 * This is its own schedule rather than part of the refresh dispatch. The work
 * runs once a day, it is the only job in the cron path whose cost scales with
 * the whole database, and it should still run when the refresh is failing.
 *
 * @param request - Incoming request which must include the cron secret header.
 * @returns The repair outcome and the status that tells QStash what to do.
 * @source
 */
export async function POST(request: Request) {
  const authorizationFailure = authorizeCronRequest(request);
  if (authorizationFailure) return authorizationFailure;

  try {
    const result = await repairRefreshIndex();
    const { status, body } = statusForRepairResult(result);

    if (status >= 500) {
      console.error(
        `🔥 [Cron Job] Index repair failed and will be retried - ${
          result.status === "failed" ? result.reason : "unknown error"
        }`,
      );
    }

    return new Response(JSON.stringify(body), {
      status,
      headers: apiJsonHeaders(request),
    });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } catch (error: any) {
    console.error(`🔥 [Cron Job] Index repair route failed: ${error.message}`);
    if (error.stack) {
      console.error(`💥 [Cron Job] Stack Trace: ${error.stack}`);
    }
    return new Response(
      JSON.stringify({
        outcome: "failed",
        reason: "index-repair-route-failed",
      }),
      { status: 500, headers: apiJsonHeaders(request) },
    );
  }
}
