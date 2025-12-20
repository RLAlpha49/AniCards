/**
 * Utility functions for fetching and embedding AniList images as data URLs.
 * This ensures images render reliably in SVGs and downloads by avoiding CORS issues.
 *
 * SECURITY: All image fetches are allow-listed to known AniList hosts to prevent SSRF.
 */

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

/** In-memory cache for fetched image data URLs. */
type ImageCacheEntry = { dataUrl: string; expiresAt: number };
export const imageDataUrlCache = new Map<string, ImageCacheEntry>();

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
  if (urlString.startsWith("data:")) return urlString; // Already a data URL
  if (!isAllowedAniListImageUrl(urlString)) return null;

  const now = Date.now();
  const cached = imageDataUrlCache.get(urlString);
  if (cached && cached.expiresAt > now) return cached.dataUrl;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), IMAGE_FETCH_TIMEOUT_MS);

  try {
    const response = await fetch(urlString, {
      signal: controller.signal,
      headers: {
        "User-Agent": "AniCards/1.0",
        Accept: "image/webp,image/avif,image/png,image/jpeg,image/*,*/*;q=0.8",
      },
    });

    if (!response.ok) return null;

    const contentType = response.headers.get("content-type");
    if (!contentType?.startsWith("image/")) return null;

    const buffer = await response.arrayBuffer();
    if (buffer.byteLength > IMAGE_MAX_BYTES) return null;

    // Convert to base64 without any compression or quality loss
    const base64 = Buffer.from(buffer).toString("base64");
    const dataUrl = `data:${contentType};base64,${base64}`;

    // Cache the result
    imageDataUrlCache.set(urlString, {
      dataUrl,
      expiresAt: now + IMAGE_DATA_URL_CACHE_TTL_MS,
    });

    // Trim cache if it grows too large
    if (imageDataUrlCache.size > 500) {
      const oldestKey = imageDataUrlCache.keys().next().value;
      if (oldestKey) {
        imageDataUrlCache.delete(oldestKey);
      }
    }

    return dataUrl;
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
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
async function embedCover(cover: { large?: string; medium?: string }): Promise<{ large?: string; medium?: string }> {
  const url = cover.large || cover.medium;
  if (!url) return cover;
  const dataUrl = await fetchImageAsDataUrl(url);
  if (!dataUrl) return cover;
  return { ...cover, large: dataUrl, medium: dataUrl };
}

/**
 * Embed a generic image (used for character images).
 */
async function embedImage(image: { large?: string; medium?: string }): Promise<{ large?: string; medium?: string }> {
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
    head.map(async (n) => ({ ...n, coverImage: await embedCover(n.coverImage) })),
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
): Record<"anime" | "manga" | "characters", number> {
  const counts: Record<"anime" | "manga" | "characters", number> = {
    anime: 0,
    manga: 0,
    characters: 0,
  };

  const categories = [
    { key: "anime" as const, available: animeAvailable },
    { key: "manga" as const, available: mangaAvailable },
    { key: "characters" as const, available: charactersAvailable },
  ].filter((c) => c.available > 0);

  if (categories.length === 0) return counts;

  const totalAvailable = animeAvailable + mangaAvailable + charactersAvailable;
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
async function embedNonMixed(favourites: UserFavourites, limit: number): Promise<UserFavourites> {
  const anime = favourites.anime
    ? { ...favourites.anime, nodes: await embedCoverNodesWithLimit(favourites.anime.nodes ?? [], limit) }
    : undefined;
  const manga = favourites.manga
    ? { ...favourites.manga, nodes: await embedCoverNodesWithLimit(favourites.manga.nodes ?? [], limit) }
    : undefined;
  const characters = favourites.characters
    ? { ...favourites.characters, nodes: await embedCharacterNodesWithLimit(favourites.characters.nodes ?? [], limit) }
    : undefined;
  return { ...favourites, anime, manga, characters };
}

export async function embedFavoritesGridImages(
  favourites: UserFavourites,
  variant: "anime" | "manga" | "characters" | "mixed",
  gridRows?: number,
  gridCols?: number,
): Promise<UserFavourites> {
  const rows = clampGridDim(gridRows, 3);
  const cols = clampGridDim(gridCols, 3);
  const capacity = rows * cols;

  if (variant !== "mixed") {
    return await embedNonMixed(favourites, capacity);
  }

  const animeNodes = favourites.anime?.nodes ?? [];
  const mangaNodes = favourites.manga?.nodes ?? [];
  const characterNodes = favourites.characters?.nodes ?? [];

  const totalAvailable = animeNodes.length + mangaNodes.length + characterNodes.length;
  if (totalAvailable === 0) {
    return {
      ...favourites,
      anime: favourites.anime ? { ...favourites.anime, nodes: animeNodes } : undefined,
      manga: favourites.manga ? { ...favourites.manga, nodes: mangaNodes } : undefined,
      characters: favourites.characters ? { ...favourites.characters, nodes: characterNodes } : undefined,
    };
  }

  const counts = computeMixedCounts(capacity, animeNodes.length, mangaNodes.length, characterNodes.length);

  const anime = favourites.anime ? { ...favourites.anime, nodes: await embedCoverNodesWithLimit(animeNodes, counts.anime) } : undefined;
  const manga = favourites.manga ? { ...favourites.manga, nodes: await embedCoverNodesWithLimit(mangaNodes, counts.manga) } : undefined;
  const characters = favourites.characters ? { ...favourites.characters, nodes: await embedCharacterNodesWithLimit(characterNodes, counts.characters) } : undefined;

  return { ...favourites, anime, manga, characters };
}
