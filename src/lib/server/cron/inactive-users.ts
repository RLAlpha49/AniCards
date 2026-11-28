/**
 * Removes stored users that nobody has asked a card for.
 *
 * A user is inactive when all three of these hold:
 *
 * 1. `user_activity:<id>` does not exist, so no card has been requested for
 *    them inside the activity window.
 * 2. `user:<id>:meta` is at least one activity window old, counted from
 *    `createdAt`.
 * 3. The run is not a dry run.
 *
 * The second condition is not a refinement, it is what makes the rule safe.
 * Activity tracking started on 2026-10-17, so a user who was active before
 * that date has no key and never will. `createdAt` is the only field that
 * answers "has this record had a chance to collect a key yet", and it survives
 * every save. `updatedAt` cannot be used: the refresh cron writes it, so it
 * records when AniList was last called, not when a person used the service.
 *
 * The listing of stored users comes from `listUserMetaKeys`, the same function
 * the refresh index rebuild uses. The complement of the activity key family is
 * what this needs, and a search index can only return keys that exist.
 *
 * @source
 */

import "server-only";

import { mgetInBatches } from "@/lib/api-utils";
import {
  ACTIVE_USER_WINDOW_MS,
  getUserActivityKey,
  USER_ACTIVITY_KEY_PREFIX,
} from "@/lib/server/user-activity";
import { deleteUserStorage, listUserMetaKeys } from "@/lib/server/user-data";
import { createLogger } from "@/lib/log";

const log = createLogger("Inactive Users");

/**
 * Users removed or would be removed in one sweep run.
 *
 * A full first sweep on a database that predates activity tracking touches
 * most of the key space. The cap keeps one invocation inside the route's time
 * limit; deletion is idempotent, so the next run continues where this one
 * stopped.
 * @source
 */
export const INACTIVE_SWEEP_LIMIT = 200;

/** Counts from one sweep run. @source */
export interface InactiveSweepResult {
  /** Stored users examined. */
  usersScanned: number;
  /** Users with no activity key that are old enough to remove. */
  candidates: number;
  /** Users whose storage was removed. Always 0 on a dry run. */
  deleted: number;
  /** Users skipped because a deletion failed; the next run retries them. */
  failed: number;
  /** True when no deletion was attempted. */
  dryRun: boolean;
}

/** One sweep run's options. @source */
export interface InactiveSweepOptions {
  /** Report what would be removed without removing anything. */
  dryRun?: boolean;
  /** Maximum users to remove in this run. */
  limit?: number;
  /** Reference time for the record-age check; defaults to now. */
  now?: Date;
}

/**
 * Reads `createdAt` out of a stored meta value.
 *
 * A meta that cannot be read is treated as too new. Deleting on an unreadable
 * record would remove a user the sweep cannot actually judge, and the record
 * is readable again on the next run once Redis answers.
 *
 * @param raw - Raw meta value returned by Redis.
 * @returns The creation time in milliseconds, or null when unreadable.
 */
function readStoredCreatedAt(raw: unknown): number | null {
  if (raw === null || raw === undefined) return null;
  let parsed: unknown = raw;
  if (typeof parsed === "string") {
    try {
      parsed = JSON.parse(parsed);
    } catch {
      return null;
    }
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    return null;
  }
  const createdAt = (parsed as Record<string, unknown>).createdAt;
  if (typeof createdAt !== "string" && typeof createdAt !== "number") {
    return null;
  }
  const timestamp =
    typeof createdAt === "number" ? createdAt : Date.parse(createdAt);
  return Number.isFinite(timestamp) && timestamp > 0 ? timestamp : null;
}

/**
 * Reads the stored users that have no activity key.
 *
 * Both reads are one `MGET` family over the whole user set, so the cost is two
 * round trips per batch rather than one per user. The meta read is needed
 * anyway to judge record age, and reading both together means a user saved
 * between the two reads cannot appear as "no key and no record".
 *
 * @param userIds - Stored user IDs.
 * @returns IDs with no activity key, and how many are old enough to remove.
 */
async function selectInactiveUserIds(
  userIds: string[],
  cutoff: number,
): Promise<{ inactive: string[]; oldEnough: string[] }> {
  const activityKeys = userIds.map((id) => getUserActivityKey(id));
  const metaKeys = userIds.map((id) => `user:${id}:meta`);
  const [activityValues, metaValues] = await Promise.all([
    mgetInBatches<unknown>(activityKeys),
    mgetInBatches<unknown>(metaKeys),
  ]);

  const inactive: string[] = [];
  const oldEnough: string[] = [];
  userIds.forEach((id, index) => {
    if (activityValues[index] != null) return;
    inactive.push(id);
    const createdAt = readStoredCreatedAt(metaValues[index]);
    if (createdAt !== null && createdAt <= cutoff) oldEnough.push(id);
  });

  return { inactive, oldEnough };
}

/**
 * Removes stored users that have no activity key and are past the window.
 *
 * Each deletion goes through `deleteUserStorage`, which owns the full list of
 * keys a user has. A second deletion path here would drift from it.
 *
 * A failed deletion does not stop the run. The user keeps their keys and the
 * next run sees them again, which is the same retry behaviour the rest of the
 * cron path uses.
 *
 * @param options - Dry-run flag, per-run cap, and reference time.
 * @returns Counts for the run.
 * @source
 */
export async function sweepInactiveUsers(
  options: InactiveSweepOptions = {},
): Promise<InactiveSweepResult> {
  const dryRun = options.dryRun ?? true;
  const limit = options.limit ?? INACTIVE_SWEEP_LIMIT;
  const now = options.now ?? new Date();
  const cutoff = now.getTime() - ACTIVE_USER_WINDOW_MS;

  const metaKeys = await listUserMetaKeys();
  const userIds = Array.from(
    new Set(
      metaKeys
        .map((key) => key.slice("user:".length, key.lastIndexOf(":")))
        .filter((id) => /^\d+$/.test(id)),
    ),
  );

  const { inactive, oldEnough } = await selectInactiveUserIds(userIds, cutoff);
  const batch = oldEnough.slice(0, limit);

  let deleted = 0;
  let failed = 0;
  if (!dryRun) {
    for (const id of batch) {
      try {
        await deleteUserStorage(id);
        deleted++;
      } catch (error) {
        failed++;
        log.error(
          `Failed to delete user ${id}: ${error instanceof Error ? error.message : String(error)}`,
        );
      }
    }
  }

  log.log(
    `${dryRun ? "Dry run" : "Sweep"}: ${userIds.length} stored users, ${inactive.length} without ${USER_ACTIVITY_KEY_PREFIX}*, ${oldEnough.length} past the window, ${dryRun ? `${batch.length} would be removed` : `${deleted} removed, ${failed} failed`}.`,
  );

  return {
    usersScanned: userIds.length,
    candidates: oldEnough.length,
    deleted,
    failed,
    dryRun,
  };
}
