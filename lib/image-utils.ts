/**
 * Utility functions for fetching and embedding AniList images as data URLs.
 * This ensures images render reliably in SVGs and downloads by avoiding CORS issues.
 *
 * SECURITY: All image fetches are allow-listed to known AniList hosts to prevent SSRF.
 */

import { createHash } from "node:crypto";

import { redisClient } from "@/lib/api/clients";
import type { MediaListEntry, UserFavourites } from "@/lib/types/records";

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

/** Maximum total bytes retained in memory per process for transformed assets. */
export const IMAGE_DATA_URL_MEMORY_CACHE_MAX_BYTES = 16 * 1024 * 1024;

/** Maximum data URL payload persisted to the shared Redis cache. */
export const IMAGE_DATA_URL_SHARED_CACHE_MAX_BYTES = 1 * 1024 * 1024;

/** In-memory cache for fetched image data URLs. */
type ImageCacheEntry = {
  dataUrl: string;
  expiresAt: number;
  byteLength: number;
};
type ImageCacheEntryShape = Pick<ImageCacheEntry, "dataUrl" | "expiresAt"> &
  Partial<Pick<ImageCacheEntry, "byteLength">>;

interface FetchImageAsDataUrlOptions {
  cacheOnly?: boolean;
}

type EmbedImageOptions = FetchImageAsDataUrlOptions;

export const imageDataUrlCache = new Map<string, ImageCacheEntry>();
let imageDataUrlCacheBytes = 0;
const imageDataUrlInflightCache = new Map<string, Promise<string | null>>();

function getDataUrlByteLength(dataUrl: string): number {
  return Buffer.byteLength(dataUrl, "utf8");
}

function normalizeImageCacheEntry(value: unknown): ImageCacheEntry | null {
  if (value === null || typeof value !== "object") return null;

  const record = value as ImageCacheEntryShape;
  if (
    typeof record.dataUrl !== "string" ||
    typeof record.expiresAt !== "number" ||
    !Number.isFinite(record.expiresAt)
  ) {
    return null;
  }

  const byteLength =
    typeof record.byteLength === "number" &&
    Number.isFinite(record.byteLength) &&
    record.byteLength > 0
      ? Math.trunc(record.byteLength)
      : getDataUrlByteLength(record.dataUrl);

  return {
    dataUrl: record.dataUrl,
    expiresAt: record.expiresAt,
    byteLength,
  };
}

function syncMemoryCacheByteUsage(): void {
  const normalizedEntries: Array<[string, ImageCacheEntry]> = [];
  const invalidKeys: string[] = [];
  let totalBytes = 0;

  for (const [key, value] of imageDataUrlCache.entries()) {
    const normalizedEntry = normalizeImageCacheEntry(value);
    if (!normalizedEntry) {
      invalidKeys.push(key);
      continue;
    }

    totalBytes += normalizedEntry.byteLength;

    if (
      value.byteLength !== normalizedEntry.byteLength ||
      value.dataUrl !== normalizedEntry.dataUrl ||
      value.expiresAt !== normalizedEntry.expiresAt
    ) {
      normalizedEntries.push([key, normalizedEntry]);
    }
  }

  for (const key of invalidKeys) {
    imageDataUrlCache.delete(key);
  }

  for (const [key, normalizedEntry] of normalizedEntries) {
    imageDataUrlCache.set(key, normalizedEntry);
  }

  imageDataUrlCacheBytes = totalBytes;
}

function removeMemoryCachedDataUrl(urlString: string): void {
  const cached = imageDataUrlCache.get(urlString);
  if (!cached) return;

  const normalizedEntry = normalizeImageCacheEntry(cached);
  imageDataUrlCache.delete(urlString);

  if (!normalizedEntry) {
    syncMemoryCacheByteUsage();
    return;
  }

  imageDataUrlCacheBytes = Math.max(
    0,
    imageDataUrlCacheBytes - normalizedEntry.byteLength,
  );
}

function enforceMemoryCacheBudgets(): void {
  syncMemoryCacheByteUsage();

  while (
    imageDataUrlCache.size > IMAGE_DATA_URL_MEMORY_CACHE_MAX_ENTRIES ||
    imageDataUrlCacheBytes > IMAGE_DATA_URL_MEMORY_CACHE_MAX_BYTES
  ) {
    const oldestKey = imageDataUrlCache.keys().next().value;
    if (typeof oldestKey !== "string") {
      break;
    }

    removeMemoryCachedDataUrl(oldestKey);
  }
}

function touchMemoryCachedDataUrl(
  urlString: string,
  entryValue: ImageCacheEntryShape,
): void {
  const entry = normalizeImageCacheEntry(entryValue);
  if (!entry) {
    removeMemoryCachedDataUrl(urlString);
    return;
  }

  removeMemoryCachedDataUrl(urlString);

  if (entry.byteLength > IMAGE_DATA_URL_MEMORY_CACHE_MAX_BYTES) {
    return;
  }

  imageDataUrlCache.set(urlString, entry);
  imageDataUrlCacheBytes += entry.byteLength;
  enforceMemoryCacheBudgets();
}

function getImageDataUrlCacheKey(urlString: string): string {
  const digest = createHash("sha256").update(urlString).digest("hex");
  return `${IMAGE_DATA_URL_SHARED_CACHE_KEY_PREFIX}:${digest}`;
}

function getFreshMemoryCachedDataUrl(
  urlString: string,
  now: number,
): string | null {
  const cached = imageDataUrlCache.get(urlString);
  if (!cached) return null;

  const normalizedEntry = normalizeImageCacheEntry(cached);
  if (!normalizedEntry) {
    removeMemoryCachedDataUrl(urlString);
    return null;
  }

  if (normalizedEntry.expiresAt <= now) {
    removeMemoryCachedDataUrl(urlString);
    return null;
  }

  touchMemoryCachedDataUrl(urlString, normalizedEntry);
  return normalizedEntry.dataUrl;
}

function setMemoryCachedDataUrl(
  urlString: string,
  dataUrl: string,
  expiresAt: number,
  byteLength = getDataUrlByteLength(dataUrl),
): void {
  touchMemoryCachedDataUrl(urlString, { dataUrl, expiresAt, byteLength });
}

async function readSharedCachedDataUrl(
  urlString: string,
  now: number,
): Promise<string | null> {
  const cacheKey = getImageDataUrlCacheKey(urlString);

  try {
    const rawEntry = await redisClient.get(cacheKey);
    if (typeof rawEntry !== "string") return null;

    const parsedEntry = normalizeImageCacheEntry(
      JSON.parse(rawEntry) as unknown,
    );
    if (!parsedEntry) return null;

    if (parsedEntry.expiresAt <= now) {
      void redisClient.del(cacheKey).catch(() => {});
      return null;
    }

    if (parsedEntry.byteLength > IMAGE_DATA_URL_SHARED_CACHE_MAX_BYTES) {
      void redisClient.del(cacheKey).catch(() => {});
    }

    setMemoryCachedDataUrl(
      urlString,
      parsedEntry.dataUrl,
      parsedEntry.expiresAt,
      parsedEntry.byteLength,
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
  if (entry.byteLength > IMAGE_DATA_URL_SHARED_CACHE_MAX_BYTES) {
    return;
  }

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
  imageDataUrlCacheBytes = 0;
  imageDataUrlInflightCache.clear();
}

/** Returns the current in-memory image cache byte usage. Intended for tests. */
export function getImageDataUrlMemoryCacheSizeBytes(): number {
  syncMemoryCacheByteUsage();
  return imageDataUrlCacheBytes;
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
  options: FetchImageAsDataUrlOptions = {},
): Promise<string | null> {
  if (!urlString || typeof urlString !== "string") return null;
  if (urlString.startsWith("data:")) return urlString;
  if (!isAllowedAniListImageUrl(urlString)) return null;

  const now = Date.now();
  const memoryCached = getFreshMemoryCachedDataUrl(urlString, now);
  if (memoryCached) return memoryCached;

  if (options.cacheOnly) {
    return readSharedCachedDataUrl(urlString, now);
  }

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
        redirect: "manual",
        signal: controller.signal,
        headers: {
          "User-Agent": "AniCards/1.0",
          Accept:
            "image/webp,image/avif,image/png,image/jpeg,image/*,*/*;q=0.8",
        },
      });

      if (response.type === "opaqueredirect") return null;
      if (response.status >= 300 && response.status < 400) return null;
      if (!isAllowedAniListImageUrl(response.url || urlString)) return null;
      if (!response.ok) return null;

      const contentType = response.headers.get("content-type");
      if (!contentType?.startsWith("image/")) return null;

      const buffer = await response.arrayBuffer();
      if (buffer.byteLength > IMAGE_MAX_BYTES) return null;

      const base64 = Buffer.from(buffer).toString("base64");
      const dataUrl = `data:${contentType};base64,${base64}`;
      const byteLength = getDataUrlByteLength(dataUrl);
      const expiresAt = Date.now() + IMAGE_DATA_URL_CACHE_TTL_MS;

      setMemoryCachedDataUrl(urlString, dataUrl, expiresAt, byteLength);
      await writeSharedCachedDataUrl(urlString, {
        dataUrl,
        expiresAt,
        byteLength,
      });

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
async function embedCover(
  cover: {
    large?: string;
    medium?: string;
  },
  options: EmbedImageOptions = {},
): Promise<{ large?: string; medium?: string }> {
  const url = cover.large || cover.medium;
  if (!url) return cover;
  const dataUrl = await fetchImageAsDataUrl(url, options);
  if (!dataUrl) return cover;
  return { ...cover, large: dataUrl, medium: dataUrl };
}

/**
 * Embed a generic image (used for character images).
 */
async function embedImage(
  image: {
    large?: string;
    medium?: string;
  },
  options: EmbedImageOptions = {},
): Promise<{ large?: string; medium?: string }> {
  const url = image.large || image.medium;
  if (!url) return image;
  const dataUrl = await fetchImageAsDataUrl(url, options);
  if (!dataUrl) return image;
  return { ...image, large: dataUrl, medium: dataUrl };
}

/**
 * Embed cover images for up to `limit` nodes with `coverImage` property.
 */
async function embedCoverNodesWithLimit<
  T extends { coverImage: { large?: string; medium?: string } },
>(nodes: T[], limit: number, options: EmbedImageOptions = {}): Promise<T[]> {
  const head = nodes.slice(0, limit);
  const tail = nodes.slice(limit);
  const embeddedHead = await Promise.all(
    head.map(async (n) => ({
      ...n,
      coverImage: await embedCover(n.coverImage, options),
    })),
  );
  return [...embeddedHead, ...tail];
}

/**
 * Embed images for up to `limit` nodes with `image` property.
 */
async function embedCharacterNodesWithLimit<
  T extends { image: { large?: string; medium?: string } },
>(nodes: T[], limit: number, options: EmbedImageOptions = {}): Promise<T[]> {
  const head = nodes.slice(0, limit);
  const tail = nodes.slice(limit);
  const embeddedHead = await Promise.all(
    head.map(async (n) => ({
      ...n,
      image: await embedImage(n.image, options),
    })),
  );
  return [...embeddedHead, ...tail];
}

export async function embedMediaListCoverImages(
  entries: MediaListEntry[],
  options: EmbedImageOptions = {},
): Promise<MediaListEntry[]> {
  return Promise.all(
    entries.map(async (entry) => {
      const coverImage = entry.media.coverImage;
      if (!coverImage) return entry;

      return {
        ...entry,
        media: {
          ...entry.media,
          coverImage: await embedCover(coverImage, options),
        },
      };
    }),
  );
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
  variant: "anime" | "manga" | "characters",
  limit: number,
  options: EmbedImageOptions = {},
): Promise<UserFavourites> {
  switch (variant) {
    case "anime":
      return {
        ...favourites,
        anime: favourites.anime
          ? {
              ...favourites.anime,
              nodes: await embedCoverNodesWithLimit(
                favourites.anime.nodes ?? [],
                limit,
                options,
              ),
            }
          : undefined,
      };
    case "manga":
      return {
        ...favourites,
        manga: favourites.manga
          ? {
              ...favourites.manga,
              nodes: await embedCoverNodesWithLimit(
                favourites.manga.nodes ?? [],
                limit,
                options,
              ),
            }
          : undefined,
      };
    case "characters":
      return {
        ...favourites,
        characters: favourites.characters
          ? {
              ...favourites.characters,
              nodes: await embedCharacterNodesWithLimit(
                favourites.characters.nodes ?? [],
                limit,
                options,
              ),
            }
          : undefined,
      };
  }
}

export async function embedFavoritesGridImages(
  favourites: UserFavourites,
  variant: "anime" | "manga" | "characters" | "staff" | "studios" | "mixed",
  gridRows?: number,
  gridCols?: number,
  options: EmbedImageOptions = {},
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
      nodes: await embedCharacterNodesWithLimit(staffNodes, capacity, options),
    };
    return { ...favourites, staff };
  }

  if (variant !== "mixed") {
    return await embedNonMixed(favourites, variant, capacity, options);
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
          nodes: await embedCoverNodesWithLimit(
            animeNodes,
            counts.anime,
            options,
          ),
        }
      : undefined;
    const manga = favourites.manga
      ? {
          ...favourites.manga,
          nodes: await embedCoverNodesWithLimit(
            mangaNodes,
            counts.manga,
            options,
          ),
        }
      : undefined;
    const characters = favourites.characters
      ? {
          ...favourites.characters,
          nodes: await embedCharacterNodesWithLimit(
            characterNodes,
            counts.characters,
            options,
          ),
        }
      : undefined;

    const staffLimit =
      counts.staff && counts.staff > 0
        ? counts.staff
        : Math.min(staffNodes.length, capacity);
    const staff = {
      ...(favourites.staff ?? { nodes: [] }),
      nodes: await embedCharacterNodesWithLimit(
        staffNodes,
        staffLimit,
        options,
      ),
    };

    return { ...favourites, anime, manga, characters, staff };
  }
}
