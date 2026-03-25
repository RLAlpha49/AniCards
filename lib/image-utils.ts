/**
 * Utility functions for fetching and embedding AniList images as data URLs.
 * This ensures images render reliably in SVGs and downloads by avoiding CORS issues.
 *
 * SECURITY: All image fetches are allow-listed to known AniList hosts to prevent SSRF.
 */

import { createHash } from "node:crypto";

import { redisClient } from "@/lib/api-utils";
import type { UserFavourites } from "@/lib/types/records";

/**
 * Allowed AniList image hosts for fetching images.
 * Only these hosts are permitted to avoid SSRF vulnerabilities.
 */
export const ALLOWED_ANILIST_IMAGE_HOSTS = new Set([
  "s1.anilist.co",
  "s2.anilist.co",
  "s3.anilist.co",
  "s4.anilist.co",
  "img.anili.st",
]);

/** Cache TTL for image data URLs (12 hours). */
export const IMAGE_DATA_URL_CACHE_TTL_MS = 12 * 60 * 60 * 1000;

/** Timeout for image fetch requests (6 seconds). */
export const IMAGE_FETCH_TIMEOUT_MS = 6_000;

/** Maximum allowed image size (2.5MB). */
export const IMAGE_MAX_BYTES = 2_500_000;

/** Durable cache key prefix for transformed remote assets. */
export const IMAGE_DATA_URL_SHARED_CACHE_KEY_PREFIX = "image-data-url:v1";

/** Maximum number of transformed assets retained in memory per process. */
export const IMAGE_DATA_URL_MEMORY_CACHE_MAX_ENTRIES = 500;

/** In-memory cache for fetched image data URLs. */
type ImageCacheEntry = { dataUrl: string; expiresAt: number };
export const imageDataUrlCache = new Map<string, ImageCacheEntry>();
const imageDataUrlInflightCache = new Map<string, Promise<string | null>>();

function getImageDataUrlCacheKey(urlString: string): string {
  const digest = createHash("sha256").update(urlString).digest("hex");
  return `${IMAGE_DATA_URL_SHARED_CACHE_KEY_PREFIX}:${digest}`;
}

function isImageCacheEntry(value: unknown): value is ImageCacheEntry {
  return (
    value !== null &&
    typeof value === "object" &&
    typeof (value as ImageCacheEntry).dataUrl === "string" &&
    typeof (value as ImageCacheEntry).expiresAt === "number" &&
    Number.isFinite((value as ImageCacheEntry).expiresAt)
  );
}

function getFreshMemoryCachedDataUrl(
  urlString: string,
  now: number,
): string | null {
  const cached = imageDataUrlCache.get(urlString);
  if (!cached) return null;
  if (cached.expiresAt <= now) {
    imageDataUrlCache.delete(urlString);
    return null;
  }
  return cached.dataUrl;
}

function setMemoryCachedDataUrl(
  urlString: string,
  dataUrl: string,
  expiresAt: number,
): void {
  imageDataUrlCache.set(urlString, { dataUrl, expiresAt });

  if (imageDataUrlCache.size > IMAGE_DATA_URL_MEMORY_CACHE_MAX_ENTRIES) {
    const oldestKey = imageDataUrlCache.keys().next().value;
    if (oldestKey) {
      imageDataUrlCache.delete(oldestKey);
    }
  }
}

async function readSharedCachedDataUrl(
  urlString: string,
  now: number,
): Promise<string | null> {
  try {
    const rawEntry = await redisClient.get(getImageDataUrlCacheKey(urlString));
    if (typeof rawEntry !== "string") return null;

    const parsedEntry = JSON.parse(rawEntry) as unknown;
    if (!isImageCacheEntry(parsedEntry)) return null;

    if (parsedEntry.expiresAt <= now) {
      void redisClient.del(getImageDataUrlCacheKey(urlString)).catch(() => {});
      return null;
    }

    setMemoryCachedDataUrl(
      urlString,
      parsedEntry.dataUrl,
      parsedEntry.expiresAt,
    );
    return parsedEntry.dataUrl;
  } catch {
    return null;
  }
}

async function writeSharedCachedDataUrl(
  urlString: string,
  entry: ImageCacheEntry,
): Promise<void> {
  try {
    await redisClient.set(
      getImageDataUrlCacheKey(urlString),
      JSON.stringify(entry),
      { ex: Math.max(1, Math.ceil(IMAGE_DATA_URL_CACHE_TTL_MS / 1000)) },
    );
  } catch {
    // Swallow cache write failures so render-time asset embedding stays fail-open.
  }
}

/** Clears all local image data URL caches. Intended for tests. */
export function clearImageDataUrlCaches(): void {
  imageDataUrlCache.clear();
  imageDataUrlInflightCache.clear();
}

/**
 * Validates if a URL is allowed for AniList image fetching.
 * Checks HTTPS, host allowlist, and path prefix for sX.anilist.co.
 */
export function isAllowedAniListImageUrl(urlString: string): boolean {
  try {
    const url = new URL(urlString);
    if (url.protocol !== "https:") return false;
    if (!ALLOWED_ANILIST_IMAGE_HOSTS.has(url.hostname)) return false;
    // For sX.anilist.co, ensure path starts with /file/anilistcdn/
    if (
      url.hostname.startsWith("s") &&
      url.hostname.endsWith(".anilist.co") &&
      !url.pathname.startsWith("/file/anilistcdn/")
    ) {
      return false;
    }
    return true;
  } catch {
    return false;
  }
}

/**
 * Fetches an image from an allowed URL and converts it to a base64 data URL.
 * Uses caching to avoid repeated fetches. Preserves original image quality.
 */
export async function fetchImageAsDataUrl(
  urlString: string,
): Promise<string | null> {
  if (!urlString || typeof urlString !== "string") return null;
  if (urlString.startsWith("data:")) return urlString;
  if (!isAllowedAniListImageUrl(urlString)) return null;

  const now = Date.now();
  const memoryCached = getFreshMemoryCachedDataUrl(urlString, now);
  if (memoryCached) return memoryCached;

  const inflight = imageDataUrlInflightCache.get(urlString);
  if (inflight) {
    return inflight;
  }

  const fetchPromise = (async (): Promise<string | null> => {
    const sharedCached = await readSharedCachedDataUrl(urlString, now);
    if (sharedCached) {
      return sharedCached;
    }

    const controller = new AbortController();
    const timeout = setTimeout(
      () => controller.abort(),
      IMAGE_FETCH_TIMEOUT_MS,
    );

    try {
      const response = await fetch(urlString, {
        signal: controller.signal,
        headers: {
          "User-Agent": "AniCards/1.0",
          Accept:
            "image/webp,image/avif,image/png,image/jpeg,image/*,*/*;q=0.8",
        },
      });

      if (!response.ok) return null;

      const contentType = response.headers.get("content-type");
      if (!contentType?.startsWith("image/")) return null;

      const buffer = await response.arrayBuffer();
      if (buffer.byteLength > IMAGE_MAX_BYTES) return null;

      const base64 = Buffer.from(buffer).toString("base64");
      const dataUrl = `data:${contentType};base64,${base64}`;
      const expiresAt = Date.now() + IMAGE_DATA_URL_CACHE_TTL_MS;

      setMemoryCachedDataUrl(urlString, dataUrl, expiresAt);
      await writeSharedCachedDataUrl(urlString, { dataUrl, expiresAt });

      return dataUrl;
    } catch {
      return null;
    } finally {
      clearTimeout(timeout);
    }
  })();

  imageDataUrlInflightCache.set(urlString, fetchPromise);

  try {
    return await fetchPromise;
  } finally {
    imageDataUrlInflightCache.delete(urlString);
  }
}

/**
 * Embeds images in favorites grid data by converting URLs to data URLs.
 *
 * Supports a dynamic grid size via `gridRows` and `gridCols` (each 1-5). The embed
 * limit is calculated as `gridRows * gridCols`. This allows layouts other than the
 * base 3x3 (e.g., 5x2).
 *
 * For the "mixed" variant, this tries to fill the grid capacity by pulling from
 * whichever categories have remaining items (i.e., if a category doesn't have
 * enough, it will take more from others when possible).
 */

/**
 * Clamp a grid dimension to an integer in the range [1, 5].
 */
function clampGridDim(n: number | undefined, fallback: number): number {
  if (typeof n !== "number" || !Number.isFinite(n)) return fallback;
  return Math.max(1, Math.min(5, Math.trunc(n)));
}

/**
 * Embed a cover image object (large/medium) by converting its URL to a data URL.
 */
async function embedCover(cover: {
  large?: string;
  medium?: string;
}): Promise<{ large?: string; medium?: string }> {
  const url = cover.large || cover.medium;
  if (!url) return cover;
  const dataUrl = await fetchImageAsDataUrl(url);
  if (!dataUrl) return cover;
  return { ...cover, large: dataUrl, medium: dataUrl };
}

/**
 * Embed a generic image (used for character images).
 */
async function embedImage(image: {
  large?: string;
  medium?: string;
}): Promise<{ large?: string; medium?: string }> {
  const url = image.large || image.medium;
  if (!url) return image;
  const dataUrl = await fetchImageAsDataUrl(url);
  if (!dataUrl) return image;
  return { ...image, large: dataUrl, medium: dataUrl };
}

/**
 * Embed cover images for up to `limit` nodes with `coverImage` property.
 */
async function embedCoverNodesWithLimit<
  T extends { coverImage: { large?: string; medium?: string } },
>(nodes: T[], limit: number): Promise<T[]> {
  const head = nodes.slice(0, limit);
  const tail = nodes.slice(limit);
  const embeddedHead = await Promise.all(
    head.map(async (n) => ({
      ...n,
      coverImage: await embedCover(n.coverImage),
    })),
  );
  return [...embeddedHead, ...tail];
}

/**
 * Embed images for up to `limit` nodes with `image` property.
 */
async function embedCharacterNodesWithLimit<
  T extends { image: { large?: string; medium?: string } },
>(nodes: T[], limit: number): Promise<T[]> {
  const head = nodes.slice(0, limit);
  const tail = nodes.slice(limit);
  const embeddedHead = await Promise.all(
    head.map(async (n) => ({ ...n, image: await embedImage(n.image) })),
  );
  return [...embeddedHead, ...tail];
}

/**
 * Compute how many items to take from each available category when filling a mixed grid.
 * The algorithm splits evenly across present categories, then distributes remainder
 * in rounds to categories that still have spare items available.
 */
function computeMixedCounts(
  capacity: number,
  animeAvailable: number,
  mangaAvailable: number,
  charactersAvailable: number,
  staffAvailable: number,
): Record<"anime" | "manga" | "characters" | "staff", number> {
  const counts: Record<"anime" | "manga" | "characters" | "staff", number> = {
    anime: 0,
    manga: 0,
    characters: 0,
    staff: 0,
  };

  const categories = [
    { key: "anime" as const, available: animeAvailable },
    { key: "manga" as const, available: mangaAvailable },
    { key: "characters" as const, available: charactersAvailable },
    { key: "staff" as const, available: staffAvailable },
  ].filter((c) => c.available > 0);

  if (categories.length === 0) return counts;

  const totalAvailable =
    animeAvailable + mangaAvailable + charactersAvailable + staffAvailable;
  const targetTotal = Math.min(capacity, totalAvailable);
  const base = Math.floor(targetTotal / categories.length);
  let remainder = targetTotal - base * categories.length;

  for (const c of categories) {
    counts[c.key] = Math.min(base, c.available);
  }

  while (remainder > 0) {
    let progressed = false;
    for (const c of categories) {
      if (remainder <= 0) break;
      if (counts[c.key] < c.available) {
        counts[c.key] += 1;
        remainder -= 1;
        progressed = true;
      }
    }
    if (!progressed) break;
  }

  return counts;
}

/**
 * Helper that applies non-mixed embedding (single-variant) up to the given limit.
 */
async function embedNonMixed(
  favourites: UserFavourites,
  limit: number,
): Promise<UserFavourites> {
  const anime = favourites.anime
    ? {
        ...favourites.anime,
        nodes: await embedCoverNodesWithLimit(
          favourites.anime.nodes ?? [],
          limit,
        ),
      }
    : undefined;
  const manga = favourites.manga
    ? {
        ...favourites.manga,
        nodes: await embedCoverNodesWithLimit(
          favourites.manga.nodes ?? [],
          limit,
        ),
      }
    : undefined;
  const characters = favourites.characters
    ? {
        ...favourites.characters,
        nodes: await embedCharacterNodesWithLimit(
          favourites.characters.nodes ?? [],
          limit,
        ),
      }
    : undefined;
  return { ...favourites, anime, manga, characters };
}

export async function embedFavoritesGridImages(
  favourites: UserFavourites,
  variant: "anime" | "manga" | "characters" | "staff" | "studios" | "mixed",
  gridRows?: number,
  gridCols?: number,
): Promise<UserFavourites> {
  const rows = clampGridDim(gridRows, 3);
  const cols = clampGridDim(gridCols, 3);
  const capacity = rows * cols;

  // Studios don't have images, so return favourites as-is for that variant
  if (variant === "studios") {
    return favourites;
  }

  if (variant === "staff") {
    return await embedStaffVariant(favourites, capacity);
  }

  async function embedStaffVariant(
    favourites: UserFavourites,
    capacity: number,
  ): Promise<UserFavourites> {
    const staffNodes = favourites.staff?.nodes ?? [];
    const staff = {
      ...(favourites.staff ?? { nodes: [] }),
      nodes: await embedCharacterNodesWithLimit(staffNodes, capacity),
    };
    return { ...favourites, staff };
  }

  if (variant !== "mixed") {
    return await embedNonMixed(favourites, capacity);
  }

  return await embedMixedVariant(favourites, capacity);

  async function embedMixedVariant(
    favourites: UserFavourites,
    capacity: number,
  ): Promise<UserFavourites> {
    const animeNodes = favourites.anime?.nodes ?? [];
    const mangaNodes = favourites.manga?.nodes ?? [];
    const characterNodes = favourites.characters?.nodes ?? [];
    const staffNodes = favourites.staff?.nodes ?? [];

    const totalAvailable =
      animeNodes.length +
      mangaNodes.length +
      characterNodes.length +
      staffNodes.length;
    if (totalAvailable === 0) {
      return {
        ...favourites,
        anime: favourites.anime
          ? { ...favourites.anime, nodes: animeNodes }
          : undefined,
        manga: favourites.manga
          ? { ...favourites.manga, nodes: mangaNodes }
          : undefined,
        characters: favourites.characters
          ? { ...favourites.characters, nodes: characterNodes }
          : undefined,
        staff: favourites.staff
          ? { ...favourites.staff, nodes: staffNodes }
          : { nodes: [] },
      };
    }

    const counts = computeMixedCounts(
      capacity,
      animeNodes.length,
      mangaNodes.length,
      characterNodes.length,
      staffNodes.length,
    );

    const anime = favourites.anime
      ? {
          ...favourites.anime,
          nodes: await embedCoverNodesWithLimit(animeNodes, counts.anime),
        }
      : undefined;
    const manga = favourites.manga
      ? {
          ...favourites.manga,
          nodes: await embedCoverNodesWithLimit(mangaNodes, counts.manga),
        }
      : undefined;
    const characters = favourites.characters
      ? {
          ...favourites.characters,
          nodes: await embedCharacterNodesWithLimit(
            characterNodes,
            counts.characters,
          ),
        }
      : undefined;

    const staffLimit =
      counts.staff && counts.staff > 0
        ? counts.staff
        : Math.min(staffNodes.length, capacity);
    const staff = {
      ...(favourites.staff ?? { nodes: [] }),
      nodes: await embedCharacterNodesWithLimit(staffNodes, staffLimit),
    };

    return { ...favourites, anime, manga, characters, staff };
  }
}
