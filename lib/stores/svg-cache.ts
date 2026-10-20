import { LRUCache } from "lru-cache";
import { redisClient, scanAllKeys } from "@/lib/api-utils";

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
 * Default lifetime of a rendered card in the shared tier, in seconds.
 *
 * Shorter than the CDN's `s-maxage` on purpose: a stored card can be
 * invalidated when its configuration changes, but an entry that outlives the
 * CDN copy serves no extra request and only occupies the keyspace.
 *
 * @source
 */
export const SVG_CACHE_TTL_SECONDS = 12 * 60 * 60;

/**
 * How long one process keeps a rendered card in its own memory.
 *
 * The shared tier is the source of truth. A local entry is only a latency
 * shortcut, so it expires quickly and is re-read from Redis on the next
 * request. Five minutes bounds how long an instance can keep serving a card
 * whose stored configuration another instance just replaced.
 *
 * @source
 */
const LOCAL_SVG_CACHE_TTL_MS = 5 * 60 * 1000;

/**
 * Prefix for the shared, cross-instance SVG cache keys.
 *
 * The in-memory LRU below is per process. A serverless deployment runs many
 * processes and recycles them, so a card rendered by one instance was invisible
 * to the next request whenever that request landed elsewhere. That is why a
 * card requested twenty minutes apart could miss despite the earlier write.
 *
 * @source
 */
const SHARED_SVG_CACHE_PREFIX = "svg_cache:";

/**
 * Builds the Redis key that holds one rendered card.
 *
 * The local cache key is reused verbatim so a single `generateCacheKey` result
 * identifies the same render in both tiers.
 *
 * @param cacheKey - Key produced by `generateCacheKey`.
 * @returns The namespaced Redis key.
 * @source
 */
export function getSharedSvgCacheKey(cacheKey: string): string {
  return `${SHARED_SVG_CACHE_PREFIX}${cacheKey}`;
}

/**
 * In-memory LRU cache for frequently accessed SVG cards.
 *
 * A short-lived hot path in front of the shared Redis tier, not a cache of
 * record. See {@link LOCAL_SVG_CACHE_TTL_MS} for why its lifetime is short.
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
 * `_t` is appended by the user page on every load and by `UserCard` when it is
 * absent, so including it in the key made every request a unique key. Each miss
 * then stored a single-use entry that evicted genuinely reusable cards. The
 * key must describe the output, not the caller's cache intent.
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
    .filter(([k, v]) => v !== null && v !== undefined && !NON_RENDERING_PARAMS.has(k))
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
 * Stores a rendered card in this process's memory.
 *
 * The local entry always uses {@link LOCAL_SVG_CACHE_TTL_MS}, never the
 * shared tier's longer lifetime. The shared tier is the source of truth, and a
 * long-lived local copy is what let one instance keep serving a replaced
 * configuration after another instance had already invalidated it.
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
    cachedAt: Date.now(),
    ttl: LOCAL_SVG_CACHE_TTL_MS,
    isStale: false,
    borderRadius,
  };

  svgCache.set(cacheKey, entry);

  // Track user request statistics for cache warming
  if (userId) {
    updateUserRequestStats(userId);
  }
}

/**
 * Reads a rendered card from the shared Redis tier.
 *
 * The in-memory LRU only serves the process that rendered the card. A
 * serverless deployment spreads requests across many short-lived processes, so
 * without this tier a card rendered twenty minutes ago can miss because the
 * next request reached a different instance.
 *
 * A Redis failure is treated as a miss: the render still happens, and the
 * caller is never failed by a cache outage.
 *
 * @param cacheKey - Key produced by `generateCacheKey`.
 * @returns The stored card and its border radius, or null on a miss or a read
 *   failure.
 * @source
 */
export async function getSvgFromSharedCache(
  cacheKey: string,
): Promise<{ svg: string; borderRadius?: number } | null> {
  try {
    const stored = await redisClient.get<unknown>(
      getSharedSvgCacheKey(cacheKey),
    );
    if (!stored) return null;

    // The value is a JSON envelope so the border radius survives a hit.
    const parsed: unknown =
      typeof stored === "string" ? safeParseSharedEntry(stored) : stored;
    if (!parsed || typeof parsed !== "object") return null;

    const { svg, borderRadius } = parsed as {
      svg?: unknown;
      borderRadius?: unknown;
    };
    if (typeof svg !== "string" || svg.length === 0) return null;

    return {
      svg,
      borderRadius:
        typeof borderRadius === "number" ? borderRadius : undefined,
    };
  } catch (error) {
    console.warn("[SVG Cache] Shared cache read failed:", error);
    return null;
  }
}

/**
 * Parses a shared cache value, tolerating a bare SVG string.
 *
 * A bare string is still valid because the first version of this tier stored
 * the markup directly. Treating it as corrupt would throw away every card
 * cached before the envelope existed.
 *
 * @param raw - Raw string returned by Redis.
 * @returns The parsed envelope, or null when the value is unusable.
 * @source
 */
function safeParseSharedEntry(raw: string): unknown {
  if (raw.startsWith("<") || raw.startsWith("<?xml")) {
    return { svg: raw };
  }
  try {
    return JSON.parse(raw);
  } catch {
    return { svg: raw };
  }
}

/**
 * Writes a rendered card to the shared Redis tier and this process's memory.
 *
 * The local entry is written first so the instance that rendered the card can
 * serve its next request without a network round trip, and it expires on the
 * shorter local window. The Redis write is best-effort: losing a cache entry
 * only costs one extra render.
 *
 * @param cacheKey - Key produced by `generateCacheKey`.
 * @param svg - Rendered SVG markup.
 * @param ttl - Lifetime of the shared entry in milliseconds.
 * @param userId - User ID for local request statistics.
 * @param borderRadius - Border radius to return with this card on a hit.
 * @returns Promise that resolves once the Redis write settles.
 * @source
 */
export async function setSvgInCache(
  cacheKey: string,
  svg: string,
  ttl: number = SVG_CACHE_TTL_SECONDS * 1000,
  userId?: number,
  borderRadius?: number,
): Promise<void> {
  setSvgInMemoryCache(cacheKey, svg, userId, borderRadius);

  try {
    await redisClient.set(
      getSharedSvgCacheKey(cacheKey),
      JSON.stringify({ svg, borderRadius }),
      { ex: Math.max(1, Math.round(ttl / 1000)) },
    );
  } catch (error) {
    console.warn("[SVG Cache] Shared cache write failed:", error);
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
 * Invalidates every cached SVG for one user.
 *
 * Both tiers are cleared, because the stored configuration is an input to the
 * render and a `colorPreset=custom` URL carries none of it. The local tier is
 * only cleared in the process that handles the write, so the shared keys are
 * listed and deleted as well; another instance would otherwise keep serving the
 * configuration the user just replaced until its own entry expired.
 *
 * @param userId - User ID whose cached cards should be dropped.
 * @param cardType - Specific card type to invalidate, or undefined for all.
 * @returns Promise that resolves once the shared keys are deleted.
 * @source
 */
export async function invalidateSvgCache(
  userId: number,
  cardType?: string,
): Promise<void> {
  const pattern = cardType ? `svg:${userId}:${cardType}` : `svg:${userId}:`;

  for (const key of svgCache.keys()) {
    if (key.startsWith(pattern)) {
      svgCache.delete(key);
    }
  }

  try {
    const keys = await scanAllKeys(`${SHARED_SVG_CACHE_PREFIX}${pattern}*`);
    if (keys.length === 0) return;
    await redisClient.del(...keys);
  } catch (error) {
    console.warn("[SVG Cache] Shared cache invalidation failed:", error);
  }
}
