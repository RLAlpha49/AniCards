/**
 * Cooldown shared by the refresh dispatcher and the refresh consumer.
 *
 * Two markers are involved and they must not share a key:
 *
 * - The cooldown key keeps a user out of the selection window. The dispatcher
 *   writes it when it publishes a message and the consumer writes it after a
 *   failure, so a user is not queued twice while a message is in flight or
 *   retrying.
 * - The failure claim key makes the 404 counter idempotent. It is claimed with
 *   `SET NX` before the count increments, and it must be a separate key: if it
 *   shared the cooldown key, a delivery that ended retryable would already own
 *   the window and the next attempt's 404 would be dropped as a duplicate.
 * @source
 */

/** How long a failed refresh keeps a user out of the selection window. */
export const REFRESH_COOLDOWN_SECONDS = 15 * 60;

/**
 * How long a published message keeps the user out of the next dispatch.
 *
 * QStash retries a failed delivery after roughly 12 seconds, 2.5 minutes, then
 * 30 minutes. This window is longer than that last retry, so a dispatch that
 * runs every 20 minutes cannot queue a second message for the same user while
 * the first is still being retried.
 * @source
 */
export const REFRESH_IN_FLIGHT_SECONDS = 35 * 60;

/**
 * Builds the cooldown key for one user.
 * @param userId - AniList user identifier.
 * @returns The Redis key holding the cooldown marker.
 * @source
 */
export function buildRefreshCooldownKey(userId: string | number): string {
  return `cron:refresh-cooldown:${userId}`;
}

/**
 * Builds the key that makes the 404 counter idempotent.
 * @param userId - AniList user identifier.
 * @returns The Redis key claimed by the delivery that may count the 404.
 * @source
 */
export function buildFailureClaimKey(userId: string | number): string {
  return `cron:refresh-404-claim:${userId}`;
}
