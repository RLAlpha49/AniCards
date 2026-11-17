/**
 * Loads a real user record from Redis for the visual audit.
 *
 * The audit used to render a synthetic fixture, which never produced the
 * shapes that actually break card layout: long AniList titles, six-digit
 * counters, many favourites, real studio names. This reads a real record
 * through the app's own loader so the captures show those cases.
 *
 * Read-only: it calls `fetchUserDataParts` and `reconstructUserRecord`, never
 * a write helper.
 *
 * @source
 */

import {
  fetchUserDataParts,
  reconstructUserRecord,
  USER_DATA_PARTS,
} from "@/lib/server/user-data";
import { getFavoritesForCardType } from "@/lib/card-data/validation";
import {
  fetchImageAsDataUrl,
  isAllowedAniListImageUrl,
} from "@/lib/image-utils";
import type { UserRecord } from "@/lib/types/records";

/**
 * Card types whose templates mark favourites with a heart.
 *
 * The same set `processFavorites` filters on. Kept here so the audit can
 * report how many favourites a record holds across those cards.
 * @source
 */
export const FAVORITE_CARD_TYPES = [
  "animeVoiceActors",
  "animeStudios",
  "animeStaff",
  "mangaStaff",
] as const;

/**
 * Reads and reconstructs one user record.
 *
 * @param userId - AniList user id to load.
 * @returns The reconstructed record, or `null` when the user is not stored.
 * @source
 */
export async function loadRealUserRecord(
  userId: string | number,
): Promise<UserRecord | null> {
  const parts = await fetchUserDataParts(userId, USER_DATA_PARTS);
  if (!parts.meta) return null;
  return reconstructUserRecord(parts) as unknown as UserRecord;
}

/**
 * Builds the favourite names one card highlights.
 *
 * Mirrors `processFavorites`: names come from the same helper and are only
 * returned for the four card types that draw hearts. Passing the right names
 * per card matters, because the templates match by name, so a name from
 * another category could mark the wrong row.
 *
 * @param record - A reconstructed user record.
 * @param cardId - Card type being rendered.
 * @returns Favourite names for that card type, empty for every other card.
 * @source
 */
export function realFavoriteNames(
  record: UserRecord,
  cardId: string,
): string[] {
  if (!(FAVORITE_CARD_TYPES as readonly string[]).includes(cardId)) return [];
  return getFavoritesForCardType(record.stats?.User?.favourites, cardId);
}

/**
 * Counts the favourites a record holds across the types that draw hearts.
 *
 * Reported once per run so the log makes clear how much favourite data the
 * capture had to work with.
 *
 * @param record - A reconstructed user record.
 * @returns Total favourite names across every heart-drawing card type.
 * @source
 */
export function countFavorites(record: UserRecord): number {
  return FAVORITE_CARD_TYPES.reduce(
    (total, cardId) => total + realFavoriteNames(record, cardId).length,
    0,
  );
}

/**
 * Pre-fetches every AniList image the record references into the shared image
 * cache.
 *
 * Rendering embeds cover art as data URLs, which needs network access. The
 * capture blocks network during rendering to prove the renderer is offline, so
 * the images have to be cached first. Failing to fetch one is not fatal: the
 * card falls back to its placeholder, which the manifest records.
 *
 * @param record - A reconstructed user record.
 * @returns URLs that could not be cached.
 * @source
 */
export async function primeImageCache(record: UserRecord): Promise<string[]> {
  const urls = new Set<string>();
  const add = (value: unknown): void => {
    if (typeof value === "string" && isAllowedAniListImageUrl(value)) {
      urls.add(value);
    }
  };
  const walk = (node: unknown, depth: number): void => {
    if (!node || depth > 12) return;
    if (Array.isArray(node)) {
      for (const item of node) walk(item, depth + 1);
      return;
    }
    if (typeof node !== "object") return;
    for (const [key, value] of Object.entries(node)) {
      // Only image-shaped fields matter; avoids crawling unrelated strings.
      if (/^(large|medium|image|avatar|bannerImage|coverImage)$/i.test(key)) {
        if (typeof value === "string") add(value);
        else walk(value, depth + 1);
      } else if (typeof value === "object") {
        walk(value, depth + 1);
      }
    }
  };
  walk(record, 0);

  const failed: string[] = [];
  // Bounded concurrency keeps AniList from rejecting the burst.
  const queue = [...urls];
  const workers = Array.from({ length: 8 }, async () => {
    for (;;) {
      const url = queue.shift();
      if (!url) return;
      const cached = await fetchImageAsDataUrl(url);
      if (!cached) failed.push(url);
    }
  });
  await Promise.all(workers);
  return failed;
}
