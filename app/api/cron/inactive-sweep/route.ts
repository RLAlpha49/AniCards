import { redisClient, apiJsonHeaders } from "@/lib/api-utils";
import { authorizeCronRequest } from "@/lib/server/cron-auth";
import {
  INACTIVE_SWEEP_LIMIT,
  sweepInactiveUsers,
  type InactiveSweepResult,
} from "@/lib/server/inactive-users";
import { createLogger } from "@/lib/log";

const log = createLogger("Cron Job");

/**
 * Caps the invocation. The sweep reads the whole user key space, and an
 * explicit limit turns a run that would be killed into a retryable failure
 * instead.
 * @source
 */
export const maxDuration = 300;

/**
 * Overlap guard, not the cadence.
 *
 * The daily schedule sets when the sweep runs. This lease only stops a retried
 * message, or a manual invocation, from walking the key space a second time
 * while the first run is still going. It is well under a day so a lease left
 * behind by a killed invocation expires long before the next scheduled run.
 * @source
 */
const SWEEP_OVERLAP_SECONDS = 15 * 60;

/** Lease key for the inactive-user sweep. @source */
export const INACTIVE_SWEEP_LEASE_KEY = "users:inactive-sweep:lease";

/**
 * Whether this run is allowed to delete.
 *
 * A dry run is the default, so a missing or misspelled variable cannot start
 * removing users. Deletion requires `INACTIVE_SWEEP_DELETE=true`, which is set
 * in the deployment environment after a dry run has been read.
 *
 * @param request - Incoming request, whose query string may override the flag.
 * @returns True when deletions should be attempted.
 */
function shouldDelete(request: Request): boolean {
  const override = new URL(request.url).searchParams.get("dryRun");
  if (override === "false") return true;
  if (override === "true") return false;
  return process.env.INACTIVE_SWEEP_DELETE === "true";
}

/**
 * Claims the sweep lease.
 * @returns True when this invocation owns the run.
 * @source
 */
async function claimSweepLease(): Promise<boolean> {
  const claimed = await redisClient.set(INACTIVE_SWEEP_LEASE_KEY, "1", {
    nx: true,
    ex: SWEEP_OVERLAP_SECONDS,
  });
  return claimed !== null;
}

/**
 * Releases the lease so a retry can run immediately.
 * @source
 */
async function releaseSweepLease(): Promise<void> {
  try {
    await redisClient.del(INACTIVE_SWEEP_LEASE_KEY);
  } catch (error) {
    // The lease expires on its own; nothing to do here.
    log.warn(
      `Could not release the inactive sweep lease: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}

/**
 * Reads the remaining lease lifetime for the skip report.
 * @returns Seconds until the lease expires, or -1 when it has no TTL.
 * @source
 */
async function readLeaseTtl(): Promise<number> {
  try {
    return Number(await redisClient.ttl(INACTIVE_SWEEP_LEASE_KEY)) || -1;
  } catch {
    return -1;
  }
}

/**
 * Maps a sweep result to the status QStash acts on.
 *
 * A completed run is 200 even when individual deletions failed: the failures
 * are retried by the next run, and a 500 here would make QStash redeliver a
 * message whose useful work is already done. Only a run that could not
 * complete answers 500.
 *
 * @param result - Counts from the run.
 * @returns The status code and the body to report.
 */
function statusForSweepResult(result: InactiveSweepResult): {
  status: number;
  body: Record<string, unknown>;
} {
  const outcome = result.failed > 0 ? "partial" : "swept";
  return { status: 200, body: { outcome, ...result } };
}

/**
 * Removes stored users that no card request has reached inside the window.
 *
 * This is its own schedule rather than part of the refresh dispatch. The work
 * scales with the whole key space, and it must still run when the refresh is
 * failing.
 *
 * @param request - Incoming request which must include the cron secret header.
 * @returns The sweep counts and the status that tells QStash what to do.
 * @source
 */
export async function POST(request: Request) {
  const authorizationFailure = authorizeCronRequest(request);
  if (authorizationFailure) return authorizationFailure;

  let ownsLease: boolean;
  try {
    ownsLease = await claimSweepLease();
  } catch (error) {
    log.error(
      `Could not claim the inactive sweep lease: ${error instanceof Error ? error.message : String(error)}`,
    );
    return new Response(
      JSON.stringify({ outcome: "failed", reason: "sweep-lease-unavailable" }),
      { status: 500, headers: apiJsonHeaders(request) },
    );
  }

  if (!ownsLease) {
    const leaseExpiresInSeconds = await readLeaseTtl();
    log.log(
      `Another invocation holds the inactive sweep lease (expires in ${leaseExpiresInSeconds}s); skipping this run.`,
    );
    return new Response(
      JSON.stringify({
        outcome: "skipped",
        reason: "another invocation holds the sweep lease",
        leaseExpiresInSeconds,
      }),
      { status: 200, headers: apiJsonHeaders(request) },
    );
  }

  try {
    const dryRun = !shouldDelete(request);
    const result = await sweepInactiveUsers({
      dryRun,
      limit: INACTIVE_SWEEP_LIMIT,
    });
    if (dryRun) await releaseSweepLease();
    const { status, body } = statusForSweepResult(result);
    return new Response(JSON.stringify(body), {
      status,
      headers: apiJsonHeaders(request),
    });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } catch (error: any) {
    log.error(`Inactive sweep failed: ${error.message}`);
    if (error.stack) {
      log.error(`Stack Trace: ${error.stack}`);
    }
    // Release the lease so the retry can run instead of waiting it out.
    await releaseSweepLease();
    return new Response(
      JSON.stringify({ outcome: "failed", reason: "inactive-sweep-failed" }),
      { status: 500, headers: apiJsonHeaders(request) },
    );
  }
}
