/**
 * User activity tracking.
 *
 * A user counts as active when a card was requested for them within the last
 * 30 days. The signal is recorded only by the card endpoint, and only when a
 * card is actually served. A cron stats refresh writes `updatedAt`, so it must
 * never be treated as activity: the two values answer different questions.
 *
 * Each user gets one key holding the ISO timestamp of their most recent card
 * request. The key expires 30 days after that request and the TTL is refreshed
 * on every request, so storage stays bounded and a stale record disappears on
 * its own once the user falls out of the activity window.
 *
 * The value is a JSON object rather than the bare timestamp it used to be. A
 * `STRING` search index only reads paths inside a JSON object, so the bare
 * string could not be indexed at all. Reads still accept the old shape, and
 * an old key becomes indexable the next time that user requests a card.
 *
 * @source
 */

import { redisClient } from "@/lib/api-utils";

/** Days without a card request after which a user is inactive. @source */
export const ACTIVE_USER_WINDOW_DAYS = 30;

/** The activity window in milliseconds. @source */
export const ACTIVE_USER_WINDOW_MS =
  ACTIVE_USER_WINDOW_DAYS * 24 * 60 * 60 * 1000;

/** Retention for a user's activity key, matching the activity window. @source */
const USER_ACTIVITY_TTL_SECONDS = ACTIVE_USER_WINDOW_DAYS * 24 * 60 * 60;

/**
 * Redis key prefix for per-user activity records.
 *
 * Exported so `lib/server/search-indexes.ts` indexes the same prefix this
 * module writes. A literal in both places would drift silently: the index
 * would keep reporting a healthy count for a key family nobody writes.
 * @source
 */
export const USER_ACTIVITY_KEY_PREFIX = "user_activity:";

/**
 * Builds the Redis key holding a user's last card request time.
 * @param userId - Resolved numeric AniList user ID.
 * @returns Key in the form `user_activity:<userId>`.
 * @source
 */
export const getUserActivityKey = (userId: string | number): string =>
  `${USER_ACTIVITY_KEY_PREFIX}${userId}`;

/** Activity state derived from a user's last card request. @source */
export interface UserActivity {
  /** ISO timestamp of the most recent card request, or null when none is stored. */
  lastCardRequestAt: string | null;
  /** True when the most recent card request falls inside the activity window. */
  isActive: boolean;
}

/**
 * Reads the timestamp out of a stored activity value.
 *
 * Two shapes are accepted. The current shape is the object
 * `{ lastCardRequestAt }`. The previous shape was the bare ISO string, and a
 * key written by the old code survives up to 30 days, so a bare string is
 * still a valid record rather than a corrupt one.
 *
 * @param raw - Value returned by Redis, which may be a parsed object, a string,
 *   or a number.
 * @returns The timestamp in milliseconds, or null when it is absent or invalid.
 * @source
 */
function parseStoredCardRequest(raw: unknown): number | null {
  const value =
    raw !== null && typeof raw === "object"
      ? (raw as Record<string, unknown>).lastCardRequestAt
      : raw;

  if (typeof value !== "string" && typeof value !== "number") return null;
  const timestamp = typeof value === "number" ? value : Date.parse(value);
  return Number.isFinite(timestamp) && timestamp > 0 ? timestamp : null;
}

/**
 * Records a card request for a user, restarting the activity window.
 *
 * Tracking is best-effort: failures are logged and swallowed so activity
 * bookkeeping never affects the card response.
 *
 * The value is written as a JSON object so `idx:activity` can index
 * `lastCardRequestAt`. The SDK serializes an object argument itself, so the
 * stored bytes are identical to a manual `JSON.stringify`.
 *
 * @param userId - Resolved numeric AniList user ID.
 * @param now - Time of the request; defaults to the current time.
 * @source
 */
export async function recordUserCardRequest(
  userId: string | number,
  now: Date = new Date(),
): Promise<void> {
  try {
    await redisClient.set(
      getUserActivityKey(userId),
      { lastCardRequestAt: now.toISOString() },
      { ex: USER_ACTIVITY_TTL_SECONDS },
    );
  } catch (error) {
    console.warn(
      `[User Activity] Failed to record card request for user ${userId}:`,
      error,
    );
  }
}

/**
 * Reads a user's activity state.
 *
 * A read failure is reported as inactive rather than thrown, so an optional
 * activity lookup cannot turn a successful user lookup into an error. A key
 * written by the previous bare-string format reads the same way.
 *
 *
 * @param userId - Resolved numeric AniList user ID.
 * @param now - Reference time for the activity window; defaults to now.
 * @returns The last card request time and whether the user is active.
 * @source
 */
export async function getUserActivity(
  userId: string | number,
  now: Date = new Date(),
): Promise<UserActivity> {
  try {
    const raw = await redisClient.get(getUserActivityKey(userId));
    const lastRequestAt = parseStoredCardRequest(raw);
    if (lastRequestAt === null) {
      return { lastCardRequestAt: null, isActive: false };
    }

    return {
      lastCardRequestAt: new Date(lastRequestAt).toISOString(),
      isActive: now.getTime() - lastRequestAt <= ACTIVE_USER_WINDOW_MS,
    };
  } catch (error) {
    console.warn(
      `[User Activity] Failed to read activity for user ${userId}:`,
      error,
    );
    return { lastCardRequestAt: null, isActive: false };
  }
}
