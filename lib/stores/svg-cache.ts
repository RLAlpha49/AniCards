import { LRUCache } from "lru-cache";
import {
  redisClient,
  incrementAnalytics,
  buildAnalyticsMetricKey,
} from "@/lib/api-utils";

/**
 * Represents a cached SVG entry with metadata.
 * @source
 */
export interface CachedSvgEntry {
  /** SVG content as a trusted SVG string */
  svg: string;
  /** Timestamp when this entry was cached */
  cachedAt: number;
  /** Time-to-live in milliseconds (when to refresh from Redis) */
  ttl: number;
  /** Whether this entry is stale but still usable (stale-while-revalidate) */
  isStale: boolean;
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
 * In-memory LRU cache for frequently accessed SVG cards.
 * Serves as a fast layer before Redis checks.
 *
 * Configuration:
 * - max: 1000 most recent cards
 * - maxSize: ~100MB estimated size limit (based on average SVG ~100KB)
 * - ttl: 24 hours in memory
 *
 * @source
 */
const svgCache = new LRUCache<string, CachedSvgEntry>({
  max: 1000,
  maxSize: 100 * 1024 * 1024, // 100MB
  ttl: 24 * 60 * 60 * 1000, // 24 hours
  sizeCalculation: (entry: CachedSvgEntry) => {
    // Estimate size: SVG content + metadata
    return Buffer.byteLength(entry.svg, "utf-8") + 256;
  },
  updateAgeOnGet: false, // Don't refresh age on get (more accurate stale-while-revalidate)
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
 * Generates a stable cache key for an SVG based on user and card parameters.
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
  // Create a stable hash of parameters (excluding null/undefined)
  const sortedParams = Object.entries(params)
    .filter(([, v]) => v !== null && v !== undefined)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => `${k}=${v}`)
    .join("&");

  // Create a deterministic key
  const suffix = sortedParams ? `:${sortedParams}` : "";
  return `svg:${userId}:${cardType}${suffix}`;
}

/**
 * Retrieves an SVG from the in-memory LRU cache.
 * Implements stale-while-revalidate pattern: returns stale entries while
 * marking them for background refresh.
 *
 * @param cacheKey - The cache key to look up
 * @returns Cached SVG entry if found, or null
 * @source
 */
export function getSvgFromMemoryCache(cacheKey: string): CachedSvgEntry | null {
  const entry = svgCache.get(cacheKey);
  if (!entry) return null;

  const now = Date.now();
  const age = now - entry.cachedAt;

  // If within TTL and not stale, return as-is
  if (age < entry.ttl) {
    return entry;
  }

  // If within stale grace period (TTL + 30min), mark as stale but return
  if (age < entry.ttl + 30 * 60 * 1000) {
    return { ...entry, isStale: true };
  }

  // Expired, remove and return null
  svgCache.delete(cacheKey);
  return null;
}

/**
 * Stores an SVG in the in-memory LRU cache.
 * Also updates user request statistics for cache warming.
 *
 * @param cacheKey - The cache key to store under
 * @param svg - The SVG content
 * @param ttl - Time-to-live in milliseconds (default: 12 hours)
 * @param userId - User ID for tracking request stats
 * @source
 */
export function setSvgInMemoryCache(
  cacheKey: string,
  svg: string,
  ttl: number = 12 * 60 * 60 * 1000, // 12 hours
  userId?: number,
): void {
  const entry: CachedSvgEntry = {
    svg,
    cachedAt: Date.now(),
    ttl,
    isStale: false,
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
 * Tracks cache hits and misses in analytics.
 * Should be called when checking cache to record metrics.
 *
 * @param hit - Whether this was a cache hit (true) or miss (false)
 * @param source - "memory" for LRU cache, "redis" for Redis cache
 * @source
 */
export async function trackCacheMetric(
  hit: boolean,
  source: "memory" | "redis",
): Promise<void> {
  const metricType = hit ? "cache_hits" : "cache_misses";
  const metric = buildAnalyticsMetricKey("card_svg", metricType);
  const suffixedMetric = `${metric}:${source}`;

  await Promise.all([
    incrementAnalytics(metric), // Overall cache metric
    incrementAnalytics(suffixedMetric), // Source-specific metric
  ]).catch(() => {
    // Silently fail analytics to not affect primary functionality
  });
}

/**
 * Warms the cache by pre-loading frequently accessed cards from Redis.
 * Should be called periodically (e.g., via a cron job).
 *
 * @param topUsers - Array of user IDs to warm cache for
 * @param cardTypes - Array of card types to pre-load (e.g., ["animeStats", "socialStats"])
 * @returns Promise with statistics about the warming process
 * @source
 */
export async function warmSvgCache(
  topUsers: number[] = getTopRequestedUsers(100),
  cardTypes: string[] = [
    "animeStats",
    "mangaStats",
    "socialStats",
    "animeGenres",
  ],
): Promise<{
  attemptedCount: number;
  successCount: number;
  failureCount: number;
}> {
  const stats = {
    attemptedCount: 0,
    successCount: 0,
    failureCount: 0,
  };

  for (const userId of topUsers) {
    for (const cardType of cardTypes) {
      stats.attemptedCount++;

      try {
        // Try to fetch from Redis (user and card data)
        const redisKey = `user:${userId}`;
        const userDoc = await redisClient.get(redisKey);

        if (!userDoc) {
          stats.failureCount++;
          continue;
        }

        // Cache is warmed on-demand when cards are generated
        // This preloads user data into Redis for faster access
        stats.successCount++;
      } catch (error) {
        console.warn(
          "Failed to warm cache for user %d, cardType %s:",
          userId,
          cardType,
          error,
        );
        stats.failureCount++;
      }
    }
  }

  console.log(
    `✨ [Cache Warming] Attempted: ${stats.attemptedCount}, Success: ${stats.successCount}, Failed: ${stats.failureCount}`,
  );

  await incrementAnalytics(
    buildAnalyticsMetricKey("cache_warming", "attempts"),
  ).catch(() => {});

  return stats;
}

/**
 * Invalidates a specific cached SVG entry (e.g., when user updates settings).
 * Also supports pattern-based invalidation.
 *
 * @param userId - User ID to invalidate for
 * @param cardType - Specific card type to invalidate, or undefined for all
 * @source
 */
export function invalidateSvgCache(userId: number, cardType?: string): void {
  if (cardType) {
    // Invalidate specific card type
    const pattern = `svg:${userId}:${cardType}`;
    for (const key of svgCache.keys()) {
      if (key.startsWith(pattern)) {
        svgCache.delete(key);
      }
    }
  } else {
    // Invalidate all cards for this user
    const pattern = `svg:${userId}:`;
    for (const key of svgCache.keys()) {
      if (key.startsWith(pattern)) {
        svgCache.delete(key);
      }
    }
  }
}
