import { redisClient } from "@/lib/api-utils";
import {
  rebuildUserRefreshIndex,
  reconcileUserKeyOrphans,
  USER_REFRESH_INDEX_KEY,
  type UserKeyReconciliationResult,
  type UserRefreshIndexRebuildResult,
} from "@/lib/server/user-data";

/**
 * How long the repair lease suppresses a second concurrent rebuild.
 *
 * The daily schedule at `0 3 * * *` sets the cadence, not this value. The
 * lease is only an overlap guard: a retried message, or a manual invocation,
 * finds the lease held and returns without scanning the keyspace twice.
 *
 * Keeping it well below a day is deliberate. A lease left behind by an
 * invocation the platform killed expires long before the next scheduled run,
 * so a killed repair cannot turn tomorrow's run into a silent skip.
 * @source
 */
const INDEX_REPAIR_OVERLAP_SECONDS = 15 * 60;

/** Lease key shared by every invocation that may rebuild the index. */
export const INDEX_REPAIR_LEASE_KEY = "users:refresh-index:repair-lease";

/**
 * Outcome of a repair attempt, in terms the route maps to a status code.
 * - `repaired`: the rebuild and the reconciliation both ran.
 * - `partial`: the rebuild ran and the reconciliation did not, so a retry can
 *   still do useful work.
 * - `skipped`: another invocation holds the lease.
 * - `failed`: the attempt did not complete and another delivery could help.
 *
 * `reason` carries a short code, not an exception message. QStash persists the
 * response body and shows it in its console, so client errors stay in the
 * server log.
 * @source
 */
export type RefreshIndexRepairResult =
  | {
      status: "repaired";
      totalUsers: number;
      rebuildCounts: UserRefreshIndexRebuildResult;
      reconciliation: UserKeyReconciliationResult;
    }
  | {
      status: "partial";
      totalUsers: number;
      rebuildCounts: UserRefreshIndexRebuildResult;
      reason: string;
    }
  | { status: "skipped"; totalUsers: number; leaseExpiresInSeconds: number }
  | { status: "failed"; reason: string };

/**
 * Result of the dispatcher's empty-index check.
 * @source
 */
export type RefreshIndexBootstrapResult = {
  totalUsers: number;
  rebuilt: boolean;
  rebuildCounts: UserRefreshIndexRebuildResult | null;
};

/**
 * Claims the repair lease.
 * @returns True when this invocation owns the rebuild, false when another
 *   invocation holds the lease.
 * @source
 */
async function claimRepairLease(): Promise<boolean> {
  const claimed = await redisClient.set(INDEX_REPAIR_LEASE_KEY, "1", {
    nx: true,
    ex: INDEX_REPAIR_OVERLAP_SECONDS,
  });
  return claimed !== null;
}

/**
 * Releases the repair lease so a retry can run immediately.
 *
 * Called whenever an attempt does not finish cleanly, including a partial
 * repair. Waiting out the lease instead would postpone the retry, and a stale
 * lease left by a killed invocation would turn the next run into a skip.
 * @source
 */
async function releaseRepairLease(): Promise<void> {
  try {
    await redisClient.del(INDEX_REPAIR_LEASE_KEY);
  } catch (error) {
    // The lease expires on its own; nothing to do here.
    console.warn(
      `⚠️ [Cron Job] Could not release the index repair lease: ${
        error instanceof Error ? error.message : String(error)
      }`,
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
    return Number(await redisClient.ttl(INDEX_REPAIR_LEASE_KEY)) || -1;
  } catch {
    return -1;
  }
}

/**
 * Reads the current size of the refresh index.
 * @returns The number of indexed users.
 * @source
 */
async function readIndexSize(): Promise<number> {
  return Number(await redisClient.zcard(USER_REFRESH_INDEX_KEY)) || 0;
}

/**
 * Rebuilds the refresh index when it is empty.
 *
 * A dispatch cannot select from an empty index, so this stays in the
 * dispatcher rather than waiting for the daily repair schedule: a wiped index
 * would otherwise stall every refresh until the next repair run. The rebuild
 * is fatal here on purpose. With no index there is nothing to select from, and
 * answering 500 lets QStash retry the dispatch.
 *
 * A non-empty index is left alone. `saveUserRecord` rescores a user on every
 * save, so the index maintains itself through normal traffic, and correcting
 * drift is the scheduled repair's job.
 *
 * @param initialTotalUsers - Index size read before selection.
 * @returns The index size to select from and whether it was rebuilt.
 * @source
 */
export async function bootstrapRefreshIndexIfEmpty(
  initialTotalUsers: number,
): Promise<RefreshIndexBootstrapResult> {
  if (initialTotalUsers > 0) {
    return {
      totalUsers: initialTotalUsers,
      rebuilt: false,
      rebuildCounts: null,
    };
  }

  let rebuildCounts: UserRefreshIndexRebuildResult;
  try {
    rebuildCounts = await rebuildUserRefreshIndex();
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(
      `🔥 [Cron Job] The refresh index is empty and could not be rebuilt: ${message}`,
    );
    throw error;
  }

  const totalUsers = await readIndexSize();
  console.log(
    `🧭 [Cron Job] The refresh index was empty; rebuilt it from stored meta (indexed ${rebuildCounts.indexedUsers} users, missing meta ${rebuildCounts.missingMetaCount}, unreadable meta ${rebuildCounts.malformedMetaCount}, dropped ${rebuildCounts.droppedStaleMembers} stale entries). It now holds ${totalUsers} users.`,
  );

  return { totalUsers, rebuilt: true, rebuildCounts };
}

/**
 * Reconciles orphaned `cards:` and `username:` keys.
 *
 * Split out from the repair so a rebuild failure still leaves the cleanup
 * attemptable, and so a cleanup failure cannot fail the rebuild that just
 * succeeded. A null result becomes the `partial` outcome, which answers 500
 * so the cleanup gets one more delivery instead of waiting a day.
 *
 * @returns Reconciliation counts, or null when the scan failed.
 * @source
 */
async function reconcileOrphanedUserKeys(): Promise<UserKeyReconciliationResult | null> {
  try {
    const reconciliation = await reconcileUserKeyOrphans();
    console.log(
      `🧹 [Cron Job] Key reconciliation: cards ${reconciliation.cardsKeysScanned} scanned, ${reconciliation.deletedCardsKeys} orphaned deleted; usernames ${reconciliation.usernameKeysScanned} scanned, ${reconciliation.deletedUsernameKeys} orphaned deleted.`,
    );
    return reconciliation;
  } catch (error) {
    console.warn(
      `⚠️ [Cron Job] Key reconciliation failed: ${error instanceof Error ? error.message : String(error)}`,
    );
    return null;
  }
}

/**
 * Rebuilds the refresh index from storage and reconciles orphaned keys.
 *
 * This is the scheduled repair. It used to run inside the dispatch, coupled to
 * it by the "repair due" lease: a failed rebuild skipped the cleanup for a
 * full day and the dispatch still answered 200, so QStash never retried
 * either. As its own message, a failure is visible and retried on its own.
 *
 * Every exit that is not a completed repair releases the lease, so the retry
 * can run instead of waiting out the window. That includes a rebuild that
 * throws, a size read that throws, and a reconciliation that fails.
 *
 * @returns What the attempt did, in terms the route maps to a status code.
 * @source
 */
export async function repairRefreshIndex(): Promise<RefreshIndexRepairResult> {
  let ownsLease: boolean;
  try {
    ownsLease = await claimRepairLease();
  } catch (error) {
    console.error(
      `🔥 [Cron Job] Could not claim the index repair lease: ${
        error instanceof Error ? error.message : String(error)
      }`,
    );
    return { status: "failed", reason: "repair-lease-unavailable" };
  }

  if (!ownsLease) {
    const leaseExpiresInSeconds = await readLeaseTtl();
    console.log(
      `[Cron Job] Another invocation holds the index repair lease (expires in ${leaseExpiresInSeconds}s); skipping this run.`,
    );
    try {
      return {
        status: "skipped",
        totalUsers: await readIndexSize(),
        leaseExpiresInSeconds,
      };
    } catch {
      // The skip decision does not depend on the size, so an unreadable
      // count is not a failure.
      return { status: "skipped", totalUsers: 0, leaseExpiresInSeconds };
    }
  }

  let outcome: RefreshIndexRepairResult;
  try {
    const rebuildCounts = await rebuildUserRefreshIndex();
    const totalUsers = await readIndexSize();
    console.log(
      `🧭 [Cron Job] Repaired the user index: indexed ${rebuildCounts.indexedUsers} users, missing meta ${rebuildCounts.missingMetaCount}, unreadable meta ${rebuildCounts.malformedMetaCount}, dropped ${rebuildCounts.droppedStaleMembers} stale entries. It now holds ${totalUsers} users.`,
    );

    const reconciliation = await reconcileOrphanedUserKeys();
    outcome = reconciliation
      ? { status: "repaired", totalUsers, rebuildCounts, reconciliation }
      : {
          status: "partial",
          totalUsers,
          rebuildCounts,
          reason: "key-reconciliation-failed",
        };
  } catch (error) {
    console.error(
      `🔥 [Cron Job] Index rebuild failed: ${
        error instanceof Error ? error.message : String(error)
      }`,
    );
    outcome = { status: "failed", reason: "index-rebuild-failed" };
  }

  // A partial result still has work for a retry: the rebuild is idempotent, and
  // the cleanup that failed is the part that scales with the keyspace.
  if (outcome.status !== "repaired") await releaseRepairLease();

  return outcome;
}
