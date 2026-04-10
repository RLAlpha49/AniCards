import { gunzipSync, gzipSync } from "node:zlib";

import { LRUCache } from "lru-cache";

import { redisClient } from "@/lib/api/clients";
import {
  buildAnalyticsMetricKey,
  incrementAnalyticsBatch,
} from "@/lib/api/telemetry";

const DEFAULT_MEMORY_TTL_MS = 12 * 60 * 60 * 1000;
const DEFAULT_SHARED_TTL_MS = 24 * 60 * 60 * 1000;
const SHARED_CACHE_KEY_PREFIX = "svg-cache";
const SHARED_CACHE_COMPRESSION = "gzip-base64-v1" as const;

type CacheMetricSource = "memory" | "redis";

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
  /** Border radius used to render the card so headers stay accurate on cache hits. */
  borderRadius?: number;
}

interface PersistedCachedSvgEntryBase {
  cachedAt: number;
  ttl: number;
  borderRadius?: number;
}

interface LegacyPersistedCachedSvgEntry extends PersistedCachedSvgEntryBase {
  svg: string;
}

interface CompressedPersistedCachedSvgEntry extends PersistedCachedSvgEntryBase {
  compression: typeof SHARED_CACHE_COMPRESSION;
  svgCompressed: string;
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
const staleSvgRevalidationLocks = new Set<string>();

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
  ttl: number = DEFAULT_MEMORY_TTL_MS,
  userId?: number,
  borderRadius?: number,
): void {
  const entry: CachedSvgEntry = {
    svg,
    cachedAt: Date.now(),
    ttl,
    isStale: false,
    ...(typeof borderRadius === "number" ? { borderRadius } : {}),
  };

  svgCache.set(cacheKey, entry);

  // Track user request statistics for cache warming
  if (userId) {
    updateUserRequestStats(userId);
  }
}

/**
 * Attempts to acquire the per-key stale revalidation lock.
 *
 * This coalesces stale-while-revalidate refresh work so concurrent stale hits
 * for the same SVG only trigger one background refresh.
 *
 * @param cacheKey - The cache key being revalidated.
 * @returns True when the caller acquired the lock, otherwise false.
 * @source
 */
export function tryAcquireSvgRevalidationLock(cacheKey: string): boolean {
  if (staleSvgRevalidationLocks.has(cacheKey)) {
    return false;
  }

  staleSvgRevalidationLocks.add(cacheKey);
  return true;
}

/**
 * Releases the per-key stale revalidation lock.
 *
 * @param cacheKey - The cache key whose lock should be cleared.
 * @source
 */
export function releaseSvgRevalidationLock(cacheKey: string): void {
  staleSvgRevalidationLocks.delete(cacheKey);
}

function getSharedCacheKey(cacheKey: string): string {
  return `${SHARED_CACHE_KEY_PREFIX}:${cacheKey}`;
}

function hasPersistedCachedSvgEntryMetadata(
  value: unknown,
): value is PersistedCachedSvgEntryBase {
  if (!value || typeof value !== "object") {
    return false;
  }

  const candidate = value as Record<string, unknown>;
  return (
    typeof candidate.cachedAt === "number" &&
    Number.isFinite(candidate.cachedAt) &&
    typeof candidate.ttl === "number" &&
    Number.isFinite(candidate.ttl) &&
    (candidate.borderRadius === undefined ||
      (typeof candidate.borderRadius === "number" &&
        Number.isFinite(candidate.borderRadius)))
  );
}

function isLegacyPersistedCachedSvgEntry(
  value: unknown,
): value is LegacyPersistedCachedSvgEntry {
  return (
    hasPersistedCachedSvgEntryMetadata(value) &&
    typeof (value as { svg?: unknown }).svg === "string"
  );
}

function isCompressedPersistedCachedSvgEntry(
  value: unknown,
): value is CompressedPersistedCachedSvgEntry {
  return (
    hasPersistedCachedSvgEntryMetadata(value) &&
    (value as { compression?: unknown }).compression ===
      SHARED_CACHE_COMPRESSION &&
    typeof (value as { svgCompressed?: unknown }).svgCompressed === "string"
  );
}

function compressSvg(svg: string): string {
  return gzipSync(Buffer.from(svg, "utf-8")).toString("base64");
}

function decompressSvg(svgCompressed: string): string {
  return gunzipSync(Buffer.from(svgCompressed, "base64")).toString("utf-8");
}

/**
 * Retrieves a cached SVG from the shared Redis-backed cache layer.
 *
 * This acts as an L2 cache so separate server instances can reuse previously
 * rendered SVGs even after their local L1 memory caches are cold.
 *
 * @param cacheKey - The normalized cache key to load.
 * @returns A cached SVG entry or null when missing/corrupt.
 * @source
 */
export async function getSvgFromSharedCache(
  cacheKey: string,
): Promise<CachedSvgEntry | null> {
  try {
    const raw = await redisClient.get(getSharedCacheKey(cacheKey));
    if (!raw) return null;

    const parsed = typeof raw === "string" ? JSON.parse(raw) : raw;
    if (isLegacyPersistedCachedSvgEntry(parsed)) {
      return {
        ...parsed,
        isStale: false,
      };
    }

    if (!isCompressedPersistedCachedSvgEntry(parsed)) {
      return null;
    }

    return {
      cachedAt: parsed.cachedAt,
      ttl: parsed.ttl,
      svg: decompressSvg(parsed.svgCompressed),
      isStale: false,
      ...(typeof parsed.borderRadius === "number"
        ? { borderRadius: parsed.borderRadius }
        : {}),
    };
  } catch (error) {
    console.warn("[Card SVG] Failed to read shared SVG cache entry:", error);
    return null;
  }
}

/**
 * Persists a rendered SVG to the shared Redis-backed cache layer.
 *
 * @param cacheKey - The normalized cache key to store under.
 * @param svg - The rendered SVG content.
 * @param ttl - Time-to-live in milliseconds.
 * @param userId - Optional user ID for request tracking.
 * @param borderRadius - Optional border radius metadata for response headers.
 * @source
 */
export async function setSvgInSharedCache(
  cacheKey: string,
  svg: string,
  ttl: number = DEFAULT_SHARED_TTL_MS,
  userId?: number,
  borderRadius?: number,
): Promise<void> {
  const entry: CompressedPersistedCachedSvgEntry = {
    compression: SHARED_CACHE_COMPRESSION,
    svgCompressed: compressSvg(svg),
    cachedAt: Date.now(),
    ttl,
    ...(typeof borderRadius === "number" ? { borderRadius } : {}),
  };

  try {
    await redisClient.set(getSharedCacheKey(cacheKey), JSON.stringify(entry), {
      ex: Math.max(1, Math.ceil(ttl / 1000)),
    });
  } catch (error) {
    console.warn("[Card SVG] Failed to write shared SVG cache entry:", error);
  }

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
 * Clears the entire in-memory SVG cache.
 * Useful for memory cleanup or testing.
 *
 * @source
 */
export function clearSvgCache(): void {
  svgCache.clear();
  staleSvgRevalidationLocks.clear();
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
 * Tracks cache hits and misses in analytics.
 * Should be called when checking cache to record metrics.
 *
 * @param hit - Whether this was a cache hit (true) or miss (false)
 * @param source - "memory" for LRU cache, "redis" for Redis cache
 * @source
 */
export async function trackCacheMetric(
  hit: boolean,
  source: CacheMetricSource,
  options?: { includeOverall?: boolean },
): Promise<void> {
  const metricType = hit ? "cache_hits" : "cache_misses";
  const metric = buildAnalyticsMetricKey("card_svg", metricType);
  const suffixedMetric = `${metric}:${source}`;
  const includeOverall = options?.includeOverall ?? true;

  const metrics = includeOverall ? [metric, suffixedMetric] : [suffixedMetric];
  await incrementAnalyticsBatch(metrics);
}
