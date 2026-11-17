/**
 * Caching for rendered cards.
 *
 * A rendered card reaches a client through two layers, neither of which
 * touches the database: the CDN, which files the response for a day, and the
 * in-memory LRU below, which covers the requests that reach this process.
 * There is no server-side cache of record. One used to exist in Redis, and it
 * cost a write on every render plus a scan on every configuration save for
 * cards the CDN was already holding.
 *
 * The CDN only helps when a card URL is stable, so the page no longer appends
 * a per-load timestamp to it. The `_t` parameter is a cache buster: a URL
 * that carries it asks not to use a stored copy, and the value it holds does
 * not matter. See `components/user/UserPageClient.tsx`.
 *
 * @source
 */

import { LRUCache } from "lru-cache";

/**
 * Represents a cached SVG entry with metadata.
 *
 * Expiry belongs to the LRU, which drops an entry past its ttl and returns a
 * miss. An entry only needs to describe what a hit must return.
 *
 * @source
 */
export interface CachedSvgEntry {
  /** SVG content as a trusted SVG string */
  svg: string;
  /**
   * The card's configured border radius.
   *
   * Stored with the entry because the `X-Card-Border-Radius` header is built
   * from it. A cache hit that forgot it would advertise the default radius for
   * a card rendered with a custom one.
   */
  borderRadius?: number;
}

/**
 * Represents a cache key with user context.
 * @source
 */
export interface CacheKey {
  userId: number;
  cardType: string;
  hash: string; // Hash of parameters to differentiate variations
}

/**
 * How long one process keeps a rendered card in its own memory.
 *
 * Five minutes bounds how long an instance can serve a card rendered before a
 * configuration change reached it.
 *
 * @source
 */
const LOCAL_SVG_CACHE_TTL_MS = 5 * 60 * 1000;

/**
 * In-memory LRU cache for frequently accessed SVG cards.
 *
 * The only server-side cache tier. It exists to absorb a burst of concurrent
 * misses for one card, not to hold a card between deploys.
 *
 * Configuration:
 * - max: 1000 most recent cards
 * - maxSize: ~100MB estimated size limit (based on average SVG ~100KB)
 *
 * @source
 */
const svgCache = new LRUCache<string, CachedSvgEntry>({
  max: 1000,
  maxSize: 100 * 1024 * 1024, // 100MB
  ttl: LOCAL_SVG_CACHE_TTL_MS,
  sizeCalculation: (entry: CachedSvgEntry) => {
    // Estimate size: SVG content + metadata
    return Buffer.byteLength(entry.svg, "utf-8") + 256;
  },
  updateAgeOnGet: false,
  updateAgeOnHas: false,
});

/**
 * Global tracking of most requested users for cache warming.
 * Maintains a list of top 100 users by request count.
 *
 * @source
 */
interface UserRequestStats {
  userId: number;
  requestCount: number;
  lastRequested: number;
}

const userRequestStats = new Map<number, UserRequestStats>();

/**
 * Query parameters that only bust downstream caches and never change the
 * rendered SVG.
 *
 * `_t` is a cache buster. It is not part of the render, so it never belongs
 * in the key: two requests that render the same card share one key. Its
 * presence is handled by the card route, which skips the stored copy for a
 * request that carries it.
 *
 * @source
 */
const NON_RENDERING_PARAMS = new Set(["_t"]);

/**
 * Generates a stable cache key for an SVG based on user and card parameters.
 *
 * Parameters are normalized so two requests that would render the same SVG
 * produce the same key. Cache-busting parameters are dropped for that reason.
 *
 * @param userId - The user ID
 * @param cardType - The card type (e.g., "animeStats")
 * @param params - Additional parameters that affect rendering (serialized)
 * @returns A cache key identifier
 * @source
 */
export function generateCacheKey(
  userId: number,
  cardType: string,
  params: Record<string, string | number | boolean | null | undefined> = {},
): string {
  // Create a stable hash of parameters (excluding null/undefined and cache busters)
  const sortedParams = Object.entries(params)
    .filter(
      ([k, v]) => v !== null && v !== undefined && !NON_RENDERING_PARAMS.has(k),
    )
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => `${k}=${v}`)
    .join("&");

  // Create a deterministic key
  const suffix = sortedParams ? `:${sortedParams}` : "";
  return `svg:${userId}:${cardType}${suffix}`;
}

/**
 * Retrieves an SVG from the in-memory LRU cache.
 *
 * @param cacheKey - The cache key to look up
 * @returns The cached entry, or null when absent or expired.
 * @source
 */
export function getSvgFromMemoryCache(cacheKey: string): CachedSvgEntry | null {
  return svgCache.get(cacheKey) ?? null;
}

/**
 * Stores a rendered card in this process's memory.
 *
 * Every entry uses {@link LOCAL_SVG_CACHE_TTL_MS}. A longer lifetime would let
 * an instance keep serving a replaced configuration after the write that
 * replaced it.
 *
 * @param cacheKey - The cache key to store under.
 * @param svg - The SVG content.
 * @param userId - User ID for tracking request stats.
 * @param borderRadius - Border radius to return with this card on a hit.
 * @source
 */
export function setSvgInMemoryCache(
  cacheKey: string,
  svg: string,
  userId?: number,
  borderRadius?: number,
): void {
  const entry: CachedSvgEntry = {
    svg,
    borderRadius,
  };

  svgCache.set(cacheKey, entry);

  // Track user request statistics for cache warming
  if (userId) {
    updateUserRequestStats(userId);
  }
}

/**
 * Updates request statistics for a user, used to identify top users for cache warming.
 *
 * @param userId - The user ID to track
 * @source
 */
function updateUserRequestStats(userId: number): void {
  const current = userRequestStats.get(userId);
  const now = Date.now();

  if (current) {
    current.requestCount++;
    current.lastRequested = now;
  } else {
    userRequestStats.set(userId, {
      userId,
      requestCount: 1,
      lastRequested: now,
    });
  }

  // Keep only top 100 users in memory
  if (userRequestStats.size > 100) {
    const sorted = Array.from(userRequestStats.values()).sort(
      (a, b) => b.requestCount - a.requestCount,
    );
    const keepIds = new Set(sorted.slice(0, 100).map((s) => s.userId));
    for (const [id] of userRequestStats.entries()) {
      if (!keepIds.has(id)) {
        userRequestStats.delete(id);
      }
    }
  }
}

/**
 * Retrieves the list of top N most requested users.
 * Used for cache warming strategies.
 *
 * @param limit - Number of top users to return (default: 100)
 * @returns Array of user IDs sorted by request count
 * @source
 */
export function getTopRequestedUsers(limit: number = 100): number[] {
  return Array.from(userRequestStats.values())
    .sort((a, b) => b.requestCount - a.requestCount)
    .slice(0, limit)
    .map((s) => s.userId);
}

/**
 * Clears the entire in-memory SVG cache.
 * Useful for memory cleanup or testing.
 *
 * @source
 */
export function clearSvgCache(): void {
  svgCache.clear();
}

/**
 * Clears user request statistics.
 * Useful for testing to ensure clean state between tests.
 *
 * @source
 */
export function clearUserRequestStats(): void {
  userRequestStats.clear();
}

/**
 * Gets cache statistics for monitoring and debugging.
 *
 * @returns Object with cache metrics
 * @source
 */
export function getSvgCacheStats() {
  return {
    size: svgCache.size,
    itemCount: svgCache.size, // LRUCache.size is the item count
    maxSize: svgCache.maxSize,
    maxItems: svgCache.max,
  };
}

/**
 * Drops the cached renders of one user from this process.
 *
 * Only this process can be reached from here, and that is enough. The other
 * layers expire on their own: the CDN copy is keyed by a URL that carries the
 * data timestamp, and the stored configuration it renders from is what the
 * timestamp moves. An instance that never sees this call still holds an entry
 * that expires within {@link LOCAL_SVG_CACHE_TTL_MS}.
 *
 * @param userId - User ID whose cached cards should be dropped.
 * @param cardType - Specific card type to invalidate, or undefined for all.
 * @source
 */
export function invalidateSvgCache(userId: number, cardType?: string): void {
  const pattern = cardType ? `svg:${userId}:${cardType}` : `svg:${userId}:`;

  for (const key of svgCache.keys()) {
    if (key.startsWith(pattern)) {
      svgCache.delete(key);
    }
  }
}
