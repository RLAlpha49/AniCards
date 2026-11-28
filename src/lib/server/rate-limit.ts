/**
 * Request rate limiting backed by Upstash Redis.
 *
 * A lazily created limiter and a bounded in-memory cache, so a burst of
 * requests from one address shares a single limiter instance.
 * @source
 */
import { NextResponse, after } from "next/server";
import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";
import { logWith } from "@/lib/log";
import { ApiError } from "@/lib/api/errors";
import { jsonWithCors } from "@/lib/api/http";
import {
  buildAnalyticsMetricKey,
  incrementAnalytics,
  runAfterResponse,
} from "@/lib/server/analytics-counters";
import { createRealRedisClient } from "@/lib/server/redis";

/**
 * Maximum identifiers held in one ephemeral rate limit cache.
 *
 * The cache stores `identifier -> reset time` and only evicts an entry when the
 * same identifier is looked up after its window ends. A client that varies its
 * `x-forwarded-for` value would otherwise grow the map for the life of the
 * process, so entries are capped and the oldest is dropped first.
 * @source
 */
const RATE_LIMIT_CACHE_MAX_ENTRIES = 10_000;

/**
 * Builds an ephemeral cache bounded to {@link RATE_LIMIT_CACHE_MAX_ENTRIES}.
 *
 * The SDK accepts a plain `Map` and calls `set`/`get` on it, so overriding
 * `set` is enough to evict. Insertion order is preserved by `Map`, so the
 * first key it yields is the oldest.
 * @returns A Map the limiter can use as its ephemeral cache.
 * @source
 */
function createBoundedRateLimitCache(): Map<string, number> {
  const cache = new Map<string, number>();
  const originalSet = cache.set.bind(cache);
  cache.set = (key: string, value: number) => {
    if (!cache.has(key) && cache.size >= RATE_LIMIT_CACHE_MAX_ENTRIES) {
      const oldest = cache.keys().next();
      if (!oldest.done) cache.delete(oldest.value);
    }
    return originalSet(key, value);
  };
  return cache;
}

/**
 * Backing instance for the {@link ratelimit} proxy, created on first use.
 * @source
 */
let _realRatelimit: Ratelimit | undefined;

/**
 * A lazily-initialized Upstash rate limiter proxy which creates the
 * RateLimit instance on first use with a default sliding window limiter.
 *
 * Every limiter this module builds leaves the SDK's analytics stream off.
 * `analytics: true` made `@upstash/ratelimit` issue one `ZINCRBY` into
 * `@upstash/ratelimit:events:<hour>` on each `limit()` call, and nothing here
 * reads that stream: the SDK's `getUsage` and `series` APIs are unused, so the
 * Upstash console was its only consumer. Each event also cost an `EXPIRE` from
 * a client wrapper that kept the bucket from living forever, so the stream was
 * two commands per request, or 22 to 29% of what a card request costs. The
 * per-endpoint `failed_requests` counters below are unaffected and still
 * record rejections. Turn the stream back on only when something reads it.
 * @source
 */
export const ratelimit: Ratelimit = new Proxy({} as Record<string, unknown>, {
  get(_: unknown, prop: string | symbol) {
    _realRatelimit ??= new Ratelimit({
      redis: createRealRedisClient(),
      limiter: Ratelimit.slidingWindow(10, "5 s"),
      ephemeralCache: createBoundedRateLimitCache(),
    });
    const val: unknown = (_realRatelimit as unknown as Record<string, unknown>)[
      prop as keyof typeof _realRatelimit
    ];
    if (typeof val === "function")
      return (...args: unknown[]) =>
        (val as (...args: unknown[]) => unknown).apply(_realRatelimit, args);
    return val;
  },
  set(_: unknown, prop: string | symbol, value: unknown) {
    _realRatelimit ??= new Ratelimit({
      redis: createRealRedisClient(),
      limiter: Ratelimit.slidingWindow(10, "5 s"),
      ephemeralCache: createBoundedRateLimitCache(),
    });
    (_realRatelimit as unknown as Record<string, unknown>)[
      prop as keyof typeof _realRatelimit
    ] = value;
    return true;
  },
}) as unknown as Ratelimit;

/**
 * Creates a new Upstash Ratelimit instance using the shared Redis client.
 * Allows per-endpoint overrides for window/limit settings.
 *
 * An ephemeral cache answers a repeat rejection from instance memory, so an
 * over-limit caller that keeps retrying stops costing the limiter's Redis
 * command. Each instance gets its own cache because the cached reset time
 * belongs to that instance's limit and window.
 *
 * The cache does not replace Redis as the shared counter: an instance that
 * has not seen the caller still asks Redis, and a new process starts empty.
 *
 * @param options.limit - Maximum number of requests allowed per window
 * @param options.window - Duration string (e.g. "10 s", "1 m")
 * @returns A configured Ratelimit instance ready to be used for limiting
 * @source
 */
export function createRateLimiter(options?: {
  limit?: number;
  window?: Parameters<typeof Ratelimit.slidingWindow>[1];
  redis?: Redis;
}): Ratelimit {
  const limit = options?.limit ?? 10;
  const window =
    options?.window ?? ("5 s" as Parameters<typeof Ratelimit.slidingWindow>[1]);
  const redis = options?.redis ?? createRealRedisClient();

  return new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(limit, window),
    ephemeralCache: createBoundedRateLimitCache(),
  });
}

/**
 * Enforces a rate limit for an IP address using the configured Upstash
 * rate limiter. Records a `failed_requests` counter on rejection and returns a
 * 429 response on limit.
 *
 * The limiter itself runs without the SDK's analytics stream, so a check costs
 * one command instead of three. See {@link ratelimit} for why.
 * @param ip - IP address to check.
 * @param endpointName - Friendly endpoint name used for logging.
 * @param endpointKey - Stable canonical endpoint key used for analytics metric keys.
 * @param limiter - Optional per-endpoint Ratelimit instance used for rate limiting.
 * @returns A NextResponse with an ApiError when limited, or null when allowed.
 * @source
 */
export async function checkRateLimit(
  request: Request | undefined,
  ip: string,
  endpointName: string,
  endpointKey: string,
  limiter?: Ratelimit,
): Promise<NextResponse<ApiError> | null> {
  const effectiveLimiter = limiter ?? ratelimit;
  const { success, pending, reason } = await effectiveLimiter.limit(ip);
  // `pending` is the limiter's own handle on work it started but did not wait
  // for, such as the deny-list refresh it runs when protection is enabled. It
  // resolves immediately while nothing of the kind is in flight, and a
  // serverless runtime can freeze before any real work lands, so hand it to
  // `after` to keep the invocation alive without delaying this response.
  runAfterResponse(pending);
  if (!success) {
    logWith("warn", endpointName, `Rate limited IP: ${ip}`);
    // A `cacheBlock` was answered from instance memory without touching Redis.
    // Recording it would add the Redis write the cache exists to avoid.
    if (reason !== "cacheBlock") {
      await incrementAnalytics(
        buildAnalyticsMetricKey(endpointKey, "failed_requests"),
      );
    }
    return jsonWithCors({ error: "Too many requests" }, request, 429);
  }
  return null;
}
