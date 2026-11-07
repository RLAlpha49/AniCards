import { NextResponse, after } from "next/server";
import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";
import type { Agent as HttpAgent } from "node:http";
import type { Agent as HttpsAgent } from "node:https";
import {
  validateBorderRadius,
  validateColorValue,
  getColorInvalidReason,
} from "@/lib/utils";
import { displayNames, isValidCardType } from "@/lib/card-data/validation";
import { logRequest } from "@/lib/server/api-logging";
export { logRequest, logSuccess } from "@/lib/server/api-logging";

/**
 * Optional keep-alive HTTP(S) agent used only in Node runtimes to improve
 * connection reuse for Redis/Upstash requests.
 * @source
 */
let agent: HttpAgent | HttpsAgent | undefined = undefined;
try {
  // Prefer detecting the Edge runtime explicit flag for Next.js.
  const isEdge = process?.env?.NEXT_RUNTIME === "edge";
  const isNode = typeof process !== "undefined" && !!process.versions?.node;

  if (isNode && !isEdge) {
    // Use dynamic require here to keep this module compatible with edge runtimes
    const https = require("node:https");
    agent = new https.Agent({
      keepAlive: true,
      keepAliveMsecs: 30000,
      maxSockets: 100,
    });
  }
} catch {
  if (process.env.NODE_ENV !== "production") {
    console.debug(
      "Warning: HTTPS Agent not available; continuing without keepAlive agent.",
    );
  }
  agent = undefined;
}

// Create the Redis client lazily to prevent calling `Redis.fromEnv()` during module initialization.
// This avoids side effects in test environments (jest mocking) and preserves edge runtime safety.
let _realRedisClient: Redis | undefined;
/**
 * Create or return an existing Redis client instance using environment
 * configuration. This defers initialization until the client is used.
 * @returns The Upstash Redis client.
 * @source
 */
function createRealRedisClient(): Redis {
  _realRedisClient ??= Redis.fromEnv({
    agent,
    enableAutoPipelining: true,
    retry: {
      retries: 3,
      backoff: (retryCount: number) => Math.round(Math.exp(retryCount) * 50),
    },
    latencyLogging: process.env.NODE_ENV !== "production",
  });
  return _realRedisClient;
}

/**
 * Public site origin used as the production fallback for JSON API CORS.
 * Mirrors the default in `lib/seo.ts` so both read one value.
 * @source
 */
const DEFAULT_SITE_ORIGIN = "https://anicards.alpha49.com";

/**
 * Public API origin. Mirrors the default in `lib/utils.ts`.
 * @source
 */
const DEFAULT_API_ORIGIN = "https://api.anicards.alpha49.com";

/**
 * Resolves the configured site origin, or the hardcoded default.
 *
 * Read at call time rather than at import time so a test or a script can set
 * the variable after this module is loaded.
 *
 * @returns A parseable origin. Never empty, because a misconfigured value
 *   falls back to the default rather than to an empty string that no browser
 *   would match.
 * @source
 */
function getSiteOrigin(): string {
  const raw = process.env.NEXT_PUBLIC_SITE_URL || DEFAULT_SITE_ORIGIN;
  return normalizeOrigin(raw) ?? DEFAULT_SITE_ORIGIN;
}

/**
 * Resolves the origin configured for the JSON APIs.
 *
 * `NEXT_PUBLIC_APP_URL` is the API origin; `NEXT_PUBLIC_SITE_URL` is the
 * public site origin used by `lib/seo.ts`. They stay separate variables
 * because they describe different deployments, and the site origin is used
 * only as the production fallback below, never as a substitute for the
 * configured API origin.
 *
 * @returns The configured origin, or null when the variable is unset or unusable.
 * @source
 */
function getConfiguredApiOrigin(): string | null {
  return normalizeOrigin(process.env.NEXT_PUBLIC_APP_URL);
}

/**
 * Collects every origin this deployment serves to a browser.
 *
 * The site and the API are the same app on two hosts, so a page on either
 * host calls `/api/...` same-origin and the browser sends that host as
 * `Origin`. Accepting only `NEXT_PUBLIC_APP_URL` rejected every generator
 * request made from the API host, because its `Origin` is the API host.
 *
 * The request's own origin is included because `Origin` matching the host
 * that served the request is same-origin by definition: a page on another
 * site cannot make the browser send this host as `Origin`.
 *
 * @param request - The request whose URL origin is also accepted.
 * @returns Origins allowed to call the JSON APIs from a browser.
 * @source
 */
function getAllowedApiOrigins(request: Request): Set<string> {
  const origins = new Set<string>();
  const candidates = [
    process.env.NEXT_PUBLIC_APP_URL,
    process.env.NEXT_PUBLIC_SITE_URL ?? DEFAULT_SITE_ORIGIN,
    process.env.NEXT_PUBLIC_API_URL ?? DEFAULT_API_ORIGIN,
    request.url,
  ];

  for (const candidate of candidates) {
    const normalized = normalizeOrigin(candidate);
    if (normalized) origins.add(normalized);
  }

  return origins;
}

/**
 * Key prefix `@upstash/ratelimit` uses for its analytics event buckets.
 * Only keys with this prefix receive the analytics TTL below.
 * @source
 */
const RATE_LIMIT_ANALYTICS_KEY_PREFIX = "@upstash/ratelimit:events:";

/**
 * Retention applied to rate limit analytics buckets, in seconds (7 days).
 *
 * Deliberately shorter than the `retention: "90d"` value `@upstash/ratelimit`
 * asks `@upstash/core-analytics` for: the Upstash dashboard only shows the last
 * week of rate limit traffic, so older hourly buckets carry no readable data
 * and only cost keyspace. A week of hourly buckets is ~168 keys per limiter.
 * @source
 */
const RATE_LIMIT_ANALYTICS_TTL_SECONDS = 7 * 24 * 60 * 60;

/**
 * Wraps a Redis client so that rate limit analytics buckets expire.
 *
 * `@upstash/ratelimit` configures `@upstash/core-analytics` with a 90 day
 * retention, but core-analytics 0.0.10 ignores it: the shipped package contains
 * no `retention`, `expire`, or delete path, and reading a bucket does not evict
 * it either. Without this wrapper every `@upstash/ratelimit:events:<hour>` key
 * would live forever. The wrapper applies the 7 day retention below instead of
 * the SDK's 90 days, because the dashboard only reports the last week.
 *
 * The wrapper sends the analytics write and its `EXPIRE ... NX` as one
 * pipeline, so Redis runs them in order within a single request and the key
 * always exists before the expiry is applied. `NX` means only the first write
 * of an hour bucket sets the TTL, so later events in the same hour do not push
 * the expiry forward. Sending both commands in one request also makes the
 * ordering a property of the command batch rather than of a shared write
 * buffer, so the wrapper needs nothing from the client's auto-pipelining
 * configuration.
 *
 * `EXPIRE ... NX` returns 1 when it set the TTL and 0 when the key already had
 * one, so 0 is the healthy reply for every write after the first in a bucket.
 * Anything else means the bucket was missing or the reply could not be read,
 * and that is what the wrapper reports. Warning on 0 would fire on essentially
 * every request and misreport a bucket that does have a TTL.
 *
 * Only `zincrby` is wrapped, because it is the only write
 * `@upstash/core-analytics` issues against an events bucket; the aggregation
 * path reads through `eval` instead. `@upstash/ratelimit` is `~2.0.8` and it
 * depends on `@upstash/core-analytics` at `^0.0.10`, which for a 0.0.x version
 * resolves to 0.0.10 alone. An upgrade that switched ingest to another command
 * would create un-expiring keys again, so
 * `tests/unit/lib/api-utils.test.ts` pins the wrapped command name.
 *
 * @param client - The Redis client to wrap.
 * @returns A client whose rate limit analytics writes carry a TTL.
 * @source
 */
function withExpiringRateLimitAnalytics(client: Redis): Redis {
  return new Proxy(client as unknown as Record<string, unknown>, {
    get(target, prop: string | symbol) {
      const value: unknown = (target as Record<string | symbol, unknown>)[prop];
      if (prop === "zincrby" && typeof value === "function") {
        return (key: string, ...rest: unknown[]) => {
          if (!key.startsWith(RATE_LIMIT_ANALYTICS_KEY_PREFIX)) {
            return (value as (...args: unknown[]) => Promise<unknown>).apply(
              target,
              [key, ...rest],
            );
          }
          const pipeline = (
            target.pipeline as () => {
              zincrby: (
                key: string,
                increment: number,
                member: unknown,
              ) => unknown;
              expire: (key: string, seconds: number, mode: string) => unknown;
              exec: () => Promise<unknown[]>;
            }
          ).call(target);
          pipeline.zincrby(key, ...(rest as [number, unknown]));
          pipeline.expire(key, RATE_LIMIT_ANALYTICS_TTL_SECONDS, "NX");
          return pipeline.exec().then((results) => {
            const expiryReply = Number(results[1]);
            // 1 set the TTL, 0 found one already present. Any other reply means
            // the bucket did not exist for the EXPIRE or the reply was
            // unreadable, so the key could outlive its week of retention.
            if (expiryReply !== 1 && expiryReply !== 0) {
              console.warn(
                `[Rate Limit] Analytics expiry for ${key} returned ${String(results[1])}; the bucket may not expire.`,
              );
            }
            return results[0];
          });
        };
      }
      if (typeof value === "function")
        return (...args: unknown[]) =>
          (value as (...args: unknown[]) => unknown).apply(target, args);
      return value;
    },
  }) as unknown as Redis;
}

/**
 * Lazily-initialized Redis client reserved for rate limiter instances.
 *
 * Kept separate from {@link redisClient} so the analytics expiry wrapper sits
 * only on the limiter path and application reads and writes stay untouched.
 * @source
 */
let _rateLimitRedisClient: Redis | undefined;
function createRateLimitRedisClient(): Redis {
  _rateLimitRedisClient ??= withExpiringRateLimitAnalytics(
    createRealRedisClient(),
  );
  return _rateLimitRedisClient;
}

/**
 * A lazily-initialized proxy for the Upstash Redis client that forwards
 * operations to a real client when they are invoked. This keeps module
 * initialization side-effect free and supports edge runtimes.
 * @source
 */
export const redisClient: Redis = new Proxy({} as Record<string, unknown>, {
  get(_: unknown, prop: string | symbol) {
    const client = createRealRedisClient();
    const value: unknown = (client as unknown as Record<string, unknown>)[
      prop as keyof typeof client
    ];
    if (typeof value === "function")
      return (...args: unknown[]) =>
        (value as (...args: unknown[]) => unknown).apply(client, args);
    return value;
  },
  set(_: unknown, prop: string | symbol, value: unknown) {
    const client = createRealRedisClient();
    (client as unknown as Record<string, unknown>)[
      prop as keyof typeof client
    ] = value;
    return true;
  },
}) as unknown as Redis;

/**
 * Scans all keys matching a pattern using the Redis SCAN command.
 * This is safer and more efficient than the KEYS command for large datasets.
 * @param pattern - The pattern to match (e.g., "user:*").
 * @param count - The number of keys to fetch per scan iteration.
 * @param onScanPage - Optional callback invoked after each successful SCAN command.
 * @returns A promise that resolves to an array of all matching keys.
 * @source
 */
export async function scanAllKeys(
  pattern: string,
  count: number = 1000,
  onScanPage?: () => void,
  limit?: number,
): Promise<string[]> {
  let cursor: string | number = 0;
  const allKeys: string[] = [];

  do {
    const [nextCursor, keys] = (await redisClient.scan(cursor, {
      match: pattern,
      count,
    })) as [string | number, string[]];
    cursor = nextCursor;
    onScanPage?.();
    allKeys.push(...keys);
    // Stop as soon as the caller has enough keys. Without this the scan walks
    // the whole keyspace and the caller's slice throws away the rest.
    if (limit !== undefined && allKeys.length >= limit) {
      return allKeys.slice(0, limit);
    }
  } while (cursor !== 0 && cursor !== "0");

  return allKeys;
}

/**
 * Reads many keys in bounded batches.
 *
 * A single `MGET` over thousands of keys is one oversized command, and the
 * reply size grows with every key. Chunking keeps each round trip to a size
 * Redis and the HTTP client both handle.
 *
 * @param keys - Keys to read, in order.
 * @param batchSize - Keys per `MGET`.
 * @returns One value per key, in the same order.
 */
export async function mgetInBatches<T>(
  keys: string[],
  batchSize: number = 500,
): Promise<(T | null)[]> {
  const values: (T | null)[] = [];
  for (let offset = 0; offset < keys.length; offset += batchSize) {
    const batch = keys.slice(offset, offset + batchSize);
    const batchValues = await redisClient.mget<(T | null)[]>(...batch);
    values.push(...batchValues);
  }
  return values;
}

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

let _realRatelimit: Ratelimit | undefined;
/**
 * A lazily-initialized Upstash rate limiter proxy which creates the
 * RateLimit instance on first use with a default sliding window limiter.
 * @source
 */
export const ratelimit: Ratelimit = new Proxy({} as Record<string, unknown>, {
  get(_: unknown, prop: string | symbol) {
    _realRatelimit ??= new Ratelimit({
      redis: createRateLimitRedisClient(),
      limiter: Ratelimit.slidingWindow(10, "5 s"),
      analytics: true,
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
      redis: createRateLimitRedisClient(),
      limiter: Ratelimit.slidingWindow(10, "5 s"),
      analytics: true,
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
  // A supplied client is wrapped too, so analytics writes expire whichever
  // client the limiter was handed.
  const redis = withExpiringRateLimitAnalytics(
    options?.redis ?? createRealRedisClient(),
  );

  return new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(limit, window),
    analytics: true,
    ephemeralCache: createBoundedRateLimitCache(),
  });
}

/**
 * Standardized API error response shape returned from API routes.
 * @source
 */
export interface ApiError {
  error: string;
}

function normalizeOrigin(value: string | null | undefined): string | null {
  if (!value) return null;
  try {
    return new URL(value).origin;
  } catch {
    return null;
  }
}

/**
 * Reports whether `getAllowedCardSvgOrigin` can return a different value for
 * two requests to the same URL.
 *
 * The card SVG response declares `Vary: Origin`, which tells a shared cache to
 * store a separate copy per `Origin` value. That is only correct when the
 * origin really depends on the request. In production it is a single constant,
 * so declaring the variance split one cached card into one entry per embedding
 * context and per no-`Origin` request, and each of those paid for its own
 * render.
 *
 * @returns True when the origin is derived from the request, false when it is
 *   fixed for the deployment.
 * @source
 */
export function doesCardSvgOriginVary(): boolean {
  if (normalizeOrigin(process.env.NEXT_PUBLIC_CARD_SVG_ALLOWED_ORIGIN)) {
    return false;
  }
  return process.env.NODE_ENV !== "production";
}

/**
 * Determine the Access-Control-Allow-Origin value used by the Card SVG API.
 * Priority: NEXT_PUBLIC_CARD_SVG_ALLOWED_ORIGIN env -> production fallback -> request origin or '*'.
 * This helper centralizes CORS policy and is used by card route header helpers.
 * @param request - Optional Request used to extract the request origin in development.
 */
export function getAllowedCardSvgOrigin(request?: Request): string {
  const rawConfigured = process.env.NEXT_PUBLIC_CARD_SVG_ALLOWED_ORIGIN;
  const configured = normalizeOrigin(rawConfigured);

  let origin: string | undefined;

  if (configured) {
    origin = configured;
  } else if (process.env.NODE_ENV === "production") {
    origin = "https://anilist.co";
  } else {
    const requestOrigin = request?.headers?.get("origin");
    const requestNormalized = normalizeOrigin(requestOrigin);
    origin = requestNormalized ?? "*";
  }

  if (process.env.NODE_ENV === "production" && origin === "*") {
    console.warn(
      "[Card CORS] Computed Access-Control-Allow-Origin is '*' in production; forcing to https://anilist.co",
    );
    origin = "https://anilist.co";
  }

  return origin;
}

/**
 * Determine the Access-Control-Allow-Origin value used by JSON API endpoints.
 *
 * Precedence: the configured app or site origin, then the site origin in
 * production, then the request origin in development. The wildcard is only
 * reachable in development; in production the site origin is always available,
 * so a request origin is never reflected back.
 *
 * @param request - Optional Request used to extract the request origin in development.
 * @returns An origin, or `*` when running outside production with nothing configured.
 * @source
 */
export function getAllowedApiOrigin(request?: Request): string {
  const configured = getConfiguredApiOrigin();

  let origin: string;

  if (configured) {
    origin = configured;
  } else if (process.env.NODE_ENV === "production") {
    origin = getSiteOrigin();
    console.warn(
      "[API CORS] No API origin is configured; using the site origin for Access-Control-Allow-Origin",
    );
  } else {
    const requestOrigin = request?.headers?.get("origin");
    const requestNormalized = normalizeOrigin(requestOrigin);
    origin = requestNormalized ?? "*";
  }

  return origin;
}

/**
 * Standard headers for JSON API responses including CORS and Vary semantics.
 * @param request - Optional request to calculate the allowed origin in development.
 */
export function apiJsonHeaders(request?: Request): Record<string, string> {
  const allowedOrigin = getAllowedApiOrigin(request);
  return {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": allowedOrigin,
    "Access-Control-Allow-Methods": "GET, HEAD, OPTIONS, POST",
    Vary: "Origin",
  };
}

/**
 * JSON response factory that always applies API CORS headers so callers don't forget.
 * Use this instead of calling `NextResponse.json(...)` directly when returning JSON.
 * @param data - payload to serialize
 * @param request - Request used to compute the allowed origin in dev
 * @param status - optional HTTP status code
 */
export function jsonWithCors<T = unknown>(
  data: T,
  request?: Request,
  status?: number,
): NextResponse<T> {
  const opts: Record<string, unknown> = {
    headers: apiJsonHeaders(request),
  };
  if (typeof status === "number") opts.status = status;
  return NextResponse.json(
    data as unknown,
    opts as ResponseInit,
  ) as NextResponse<T>;
}

/**
 * Enforces a rate limit for an IP address using the configured Upstash
 * rate limiter. Records analytics and returns a 429 response on limit.
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
  // The analytics write is a separate request the limiter reports through
  // `pending`. Upstash documents that a serverless runtime can freeze before it
  // lands, which under-reports the dashboard, so hand it to `after` to keep the
  // invocation alive without delaying this response. Outside a request scope
  // (unit tests, scripts) the scheduling is skipped and the promise is left to
  // settle on its own.
  try {
    after(pending);
  } catch {
    /* no request scope; let `pending` settle on its own */
  }
  if (!success) {
    console.warn(`🚨 [${endpointName}] Rate limited IP: ${ip}`);
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

/**
 * Validates that a given request originates from a host this deployment
 * serves (or is an internal request with no origin header). Cross-origin
 * requests are rejected with a 401 response.
 * @param request - The incoming Request object to evaluate.
 * @param endpointName - Friendly endpoint name used for logs.
 * @param endpointKey - Stable canonical endpoint key used for analytics metric keys.
 * @returns A NextResponse with an ApiError when unauthorized, or null when allowed.
 * @source
 */
export function validateSameOrigin(
  request: Request,
  endpointName: string,
  endpointKey: string,
): NextResponse<ApiError> | null {
  const origin = request.headers.get("origin");
  const allowedOrigins = getAllowedApiOrigins(request);

  // Allow internal requests (no origin) or requests from a host we serve
  const isSameOrigin = !origin || allowedOrigins.has(origin);

  if (!isSameOrigin) {
    console.warn(
      `🔐 [${endpointName}] Rejected cross-origin request from: ${origin} (allowed: ${[...allowedOrigins].join(", ")})`,
    );

    const metric = buildAnalyticsMetricKey(endpointKey, "failed_requests");

    incrementAnalytics(metric).catch((err) => {
      if (process.env.NODE_ENV !== "production") {
        console.warn(`Analytics increment failed for ${metric}:`, err);
      }
    });

    if (process.env.NODE_ENV === "production") {
      return jsonWithCors({ error: "Unauthorized" }, request, 401);
    }
    // In dev mode, still return headers for consistent CORS behavior
    return jsonWithCors({ error: "Unauthorized" }, request, 401);
  }

  return null;
}

/**
 * Safely increments a Redis-based analytics counter. This function
 * intentionally swallows errors to avoid affecting primary request paths.
 * @param metric - Redis key for the analytics counter to increment.
 * @source
 */
export async function incrementAnalytics(metric: string): Promise<void> {
  try {
    await redisClient.incr(metric);
  } catch (error) {
    // Silently fail analytics to avoid affecting main functionality
    console.warn(`Failed to increment analytics for ${metric}:`, error);
  }
}

/**
 * Build a canonical analytics Redis key using a stable endpoint key.
 * Example: buildAnalyticsMetricKey("store_cards", "failed_requests")
 * returns "analytics:store_cards:failed_requests".
 * An optional extraSuffix is appended if provided for more granular metrics.
 */
export function buildAnalyticsMetricKey(
  endpointKey: string,
  metric: string,
  extraSuffix?: string,
): string {
  const normalized = String(endpointKey).toLowerCase().replaceAll(/\s+/g, "_");
  const base = `analytics:${normalized}:${metric}`;
  return extraSuffix ? `${base}:${extraSuffix}` : base;
}

/**
 * Centralized error handling for API routes that logs details,
 * increments an analytics metric, and returns a 500 error response.
 * @param error - Error object thrown by the route handler.
 * @param endpoint - Logical endpoint for logging context.
 * @param startTime - Request start timestamp used to calculate duration.
 * @param analyticsMetric - Redis metric key to increment on error.
 * @param errorMessage - User-facing error message returned in the response.
 * @returns A NextResponse containing an ApiError.
 * @source
 */
export function handleError(
  error: Error,
  endpoint: string,
  startTime: number,
  analyticsMetric: string,
  errorMessage: string,
  request?: Request,
): NextResponse<ApiError> {
  const duration = Date.now() - startTime;
  console.error(`🔥 [${endpoint}] Error after ${duration}ms: ${error.message}`);

  if (error.stack) {
    console.error(`💥 [${endpoint}] Stack Trace: ${error.stack}`);
  }

  incrementAnalytics(analyticsMetric).catch(() => {});

  return jsonWithCors({ error: errorMessage }, request, 500);
}

/**
 * Validates that the provided request data contains a valid userId.
 * @param data - The payload to validate.
 * @param endpoint - Logical endpoint name for logging context.
 * @returns A NextResponse with an ApiError when invalid, or null otherwise.
 * @source
 */
export function validateRequestData(
  data: Record<string, unknown>,
  endpoint: string,
  request?: Request,
): NextResponse<ApiError> | null {
  if (!data.userId) {
    console.warn(`⚠️ [${endpoint}] Missing userId in request`);
    return jsonWithCors(
      { error: "Missing required field: userId" },
      request,
      400,
    );
  }
  return null;
}

/**
 * Validates the payload for the store-users endpoint including userId,
 * optional username, and stats object shape.
 * @param data - The request data to validate.
 * @param endpoint - Logical endpoint name for logging/analytics.
 * @returns A NextResponse with an ApiError when invalid, or null otherwise.
 * @source
 */
export function validateUserData(
  data: Record<string, unknown>,
  endpoint: string,
  request?: Request,
): NextResponse<ApiError> | null {
  // Check required fields
  if (data.userId === undefined || data.userId === null) {
    console.warn(`⚠️ [${endpoint}] Missing userId`);
    return jsonWithCors({ error: "Invalid data" }, request, 400);
  }

  // Validate userId is a number
  const userId = Number(data.userId);
  if (!Number.isInteger(userId) || userId <= 0) {
    console.warn(`⚠️ [${endpoint}] Invalid userId format: ${data.userId}`);
    return jsonWithCors({ error: "Invalid data" }, request, 400);
  }

  // Validate username if provided
  if (data.username !== undefined && data.username !== null) {
    if (!isValidUsername(data.username)) {
      console.warn(`⚠️ [${endpoint}] Username invalid: ${data.username}`);
      return jsonWithCors({ error: "Invalid data" }, request, 400);
    }
  }

  // Validate stats exists and is an object
  if (!data.stats || typeof data.stats !== "object") {
    console.warn(`⚠️ [${endpoint}] Stats must be a valid object`);
    return jsonWithCors({ error: "Invalid data" }, request, 400);
  }

  return null;
}

/**
 * Validates a username string following project constraints: length,
 * permitted characters, and trimming. Used by both GET and POST paths.
 * @param value - Username value to validate.
 * @returns True if the username is valid.
 * @source
 */
export function isValidUsername(value: unknown): boolean {
  if (value === undefined || value === null) return false;
  if (typeof value !== "string") return false;
  const trimmed = value.trim();
  if (trimmed.length === 0 || trimmed.length > 100) return false;
  // Only allow letters, numbers, underscores, hyphens and whitespace inside usernames.
  return /^[a-zA-Z0-9_\-\s]*$/.test(trimmed);
}

/**
 * Ensures required string fields for a card are present and valid.
 * Validates color formats (hex or gradient) and length constraints on string fields.
 * @param card - Card object to validate.
 * @param cardIndex - Index of the card in the array for error messages.
 * @param endpoint - Endpoint name used for logging/analytics context.
 * @returns A NextResponse with an ApiError when invalid, or null otherwise.
 * @source
 */
function validateCardRequiredFields(
  card: Record<string, unknown>,
  cardIndex: number,
  endpoint: string,
  request?: Request,
): NextResponse<ApiError> | null {
  const requiredStringFields = ["cardName", "variation"];
  const requiredColorFields = [
    "titleColor",
    "backgroundColor",
    "textColor",
    "circleColor",
  ];

  /** Validate required string fields with length constraints. */
  function validateRequiredStringFields(
    cardObj: Record<string, unknown>,
    fields: string[],
  ): NextResponse<ApiError> | null {
    for (const field of fields) {
      if (typeof cardObj[field] !== "string") {
        console.warn(
          `⚠️ [${endpoint}] Card ${cardIndex} missing or invalid field: ${field}`,
        );
        return jsonWithCors({ error: "Invalid data" }, request, 400);
      }
      const value = cardObj[field];
      if (value.length === 0 || value.length > 100) {
        console.warn(
          `⚠️ [${endpoint}] Card ${cardIndex} field ${field} exceeds length limits`,
        );
        return NextResponse.json(
          { error: "Invalid data" },
          { status: 400, headers: apiJsonHeaders(request) },
        );
      }
    }
    return null;
  }

  /** Validate required color fields, allowing hex string or gradient defs. */
  function validateRequiredColorFields(
    cardObj: Record<string, unknown>,
    fields: string[],
  ): NextResponse<ApiError> | null {
    for (const field of fields) {
      const value = cardObj[field];
      if (value === undefined || value === null) {
        console.warn(
          `⚠️ [${endpoint}] Card ${cardIndex} missing required color field: ${field}`,
        );
        return NextResponse.json(
          { error: "Invalid data" },
          { status: 400, headers: apiJsonHeaders(request) },
        );
      }
      if (!validateColorValue(value)) {
        const reason = getColorInvalidReason(value);
        console.warn(
          `⚠️ [${endpoint}] Card ${cardIndex} invalid color or gradient format for ${field} (${reason})`,
        );
        return NextResponse.json(
          { error: "Invalid data" },
          { status: 400, headers: apiJsonHeaders(request) },
        );
      }
    }
    return null;
  }

  const reqStrErr = validateRequiredStringFields(card, requiredStringFields);
  if (reqStrErr) return reqStrErr;

  // Ensure the cardName points to a supported card type (base type validation)
  const cardNameRaw = card["cardName"];
  if (typeof cardNameRaw !== "string" || !isValidCardType(cardNameRaw)) {
    console.warn(
      `⚠️ [${endpoint}] Card ${cardIndex} has an invalid cardName: ${String(
        cardNameRaw,
      )}`,
    );
    return NextResponse.json(
      { error: "Invalid data: Invalid card type" },
      { status: 400, headers: apiJsonHeaders(request) },
    );
  }

  const rawPreset = card["colorPreset"];
  const preset =
    typeof rawPreset === "string" && rawPreset.trim().length > 0
      ? rawPreset
      : undefined;
  const requireColorFields = preset === undefined || preset === "custom";
  if (requireColorFields) {
    const reqColorErr = validateRequiredColorFields(card, requiredColorFields);
    if (reqColorErr) return reqColorErr;
  }

  return null;
}

/**
 * Validates optional fields for a card such as booleans and optional
 * borderColor (hex or gradient format).
 * @param card - Card object to validate.
 * @param cardIndex - Index of the card in the array for error messages.
 * @param endpoint - Endpoint name used for logging/analytics context.
 * @returns A NextResponse with an ApiError when invalid, or null otherwise.
 * @source
 */
function validateCardOptionalFields(
  card: Record<string, unknown>,
  cardIndex: number,
  endpoint: string,
  request?: Request,
): NextResponse<ApiError> | null {
  // Validate optional boolean fields
  const optionalBooleanFields = [
    "showFavorites",
    "useStatusColors",
    "showPiePercentages",
  ];

  for (const field of optionalBooleanFields) {
    const value = card[field];
    if (value !== undefined && typeof value !== "boolean") {
      console.warn(
        `⚠️ [${endpoint}] Card ${cardIndex} field ${field} must be boolean`,
      );
      return NextResponse.json(
        { error: "Invalid data" },
        { status: 400, headers: apiJsonHeaders(request) },
      );
    }
  }

  // Validate borderColor if present (optional, can be hex string or gradient)
  const borderColorValue = card.borderColor;
  const hasBorder = borderColorValue !== undefined && borderColorValue !== null;
  if (hasBorder) {
    if (!validateColorValue(borderColorValue)) {
      const reason = getColorInvalidReason(borderColorValue);
      console.warn(
        `⚠️ [${endpoint}] Card ${cardIndex} invalid borderColor format (${reason})`,
      );
      return NextResponse.json(
        { error: "Invalid data" },
        { status: 400, headers: apiJsonHeaders(request) },
      );
    }
  }

  const borderRadiusValue = card.borderRadius;
  const borderRadiusError = validateBorderRadiusField(
    borderRadiusValue,
    cardIndex,
    endpoint,
    { requireValue: hasBorder },
    request,
  );
  if (borderRadiusError) return borderRadiusError;

  const gridColsValue = card.gridCols;
  if (gridColsValue !== undefined) {
    const n = Number(gridColsValue);
    if (!Number.isInteger(n) || n < 1 || n > 5) {
      console.warn(
        `⚠️ [${endpoint}] Card ${cardIndex} gridCols must be an integer between 1 and 5`,
      );
      return NextResponse.json(
        { error: "Invalid data" },
        { status: 400, headers: apiJsonHeaders(request) },
      );
    }
  }

  const gridRowsValue = card.gridRows;
  if (gridRowsValue !== undefined) {
    const n = Number(gridRowsValue);
    if (!Number.isInteger(n) || n < 1 || n > 5) {
      console.warn(
        `⚠️ [${endpoint}] Card ${cardIndex} gridRows must be an integer between 1 and 5`,
      );
      return NextResponse.json(
        { error: "Invalid data" },
        { status: 400, headers: apiJsonHeaders(request) },
      );
    }
  }

  return null;
}

function validateBorderRadiusField(
  borderRadiusValue: unknown,
  cardIndex: number,
  endpoint: string,
  options?: { requireValue?: boolean },
  request?: Request,
): NextResponse<ApiError> | null {
  const { requireValue = false } = options ?? {};
  if (borderRadiusValue === undefined || borderRadiusValue === null) {
    if (requireValue) {
      console.warn(
        `⚠️ [${endpoint}] Card ${cardIndex} borderRadius required when border is enabled`,
      );
      return NextResponse.json(
        { error: "Invalid data" },
        { status: 400, headers: apiJsonHeaders(request) },
      );
    }
    return null;
  }
  if (typeof borderRadiusValue !== "number") {
    console.warn(
      `⚠️ [${endpoint}] Card ${cardIndex} borderRadius must be a number`,
    );
    return NextResponse.json(
      { error: "Invalid data" },
      { status: 400, headers: apiJsonHeaders(request) },
    );
  }
  if (!validateBorderRadius(borderRadiusValue)) {
    console.warn(
      `⚠️ [${endpoint}] Card ${cardIndex} borderRadius out of range: ${borderRadiusValue}`,
    );
    return NextResponse.json(
      { error: "Invalid data" },
      { status: 400, headers: apiJsonHeaders(request) },
    );
  }
  return null;
}

/**
 * Validates the provided userId and returns an API error response when
 * invalid. Keeps logging consistent with existing behavior.
 * @param userId - The incoming userId value
 * @param endpoint - Endpoint name used for logging
 */
function validateUserIdField(
  userId: unknown,
  endpoint: string,
  request?: Request,
): NextResponse<ApiError> | null {
  if (userId === undefined || userId === null) {
    console.warn(`⚠️ [${endpoint}] Missing userId`);
    return NextResponse.json(
      { error: "Invalid data" },
      { status: 400, headers: apiJsonHeaders(request) },
    );
  }

  const userIdNum = Number(userId);
  if (!Number.isInteger(userIdNum) || userIdNum <= 0) {
    console.warn(`⚠️ [${endpoint}] Invalid userId format: ${userId}`);
    return NextResponse.json(
      { error: "Invalid data" },
      { status: 400, headers: apiJsonHeaders(request) },
    );
  }

  return null;
}

/**
 * Ensures the payload is an array. Returns an API error response when not.
 */
function validateCardsArrayField(
  cards: unknown,
  endpoint: string,
  request?: Request,
): NextResponse<ApiError> | null {
  if (!Array.isArray(cards)) {
    console.warn(`⚠️ [${endpoint}] Cards must be an array`);
    return NextResponse.json(
      { error: "Invalid data" },
      { status: 400, headers: apiJsonHeaders(request) },
    );
  }
  return null;
}

/**
 * Collects card names from the provided card objects and separates them
 * into supported (uniqueSupportedNames) and unknownNames sets.
 */
function collectUniqueAndUnknownCardNames(
  cards: unknown[],
  supportedNames: Set<string>,
): { uniqueSupportedNames: Set<string>; unknownNames: Set<string> } {
  const uniqueSupportedNames = new Set<string>();
  const unknownNames = new Set<string>();

  for (const c of cards) {
    if (typeof c === "object" && c !== null) {
      const name = (c as Record<string, unknown>).cardName;
      if (typeof name === "string" && name.length > 0) {
        if (supportedNames.has(name)) uniqueSupportedNames.add(name);
        else unknownNames.add(name);
      }
    }
  }

  return { uniqueSupportedNames, unknownNames };
}

/**
 * Compute the Levenshtein edit distance between two strings.
 */
function levenshteinDistance(a: string, b: string): number {
  const n = a.length;
  const m = b.length;
  const dp: number[][] = Array.from({ length: n + 1 }, () =>
    new Array<number>(m + 1).fill(0),
  );

  for (let i = 0; i <= n; i++) dp[i][0] = i;
  for (let j = 0; j <= m; j++) dp[0][j] = j;

  for (let i = 1; i <= n; i++) {
    for (let j = 1; j <= m; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      dp[i][j] = Math.min(
        dp[i - 1][j] + 1,
        dp[i][j - 1] + 1,
        dp[i - 1][j - 1] + cost,
      );
    }
  }

  return dp[n][m];
}

/**
 * Build suggestion candidates for unknown names using Levenshtein distance.
 */
function buildLevenshteinSuggestions(
  unknownNames: Set<string>,
  supportedArray: string[],
  maxDistance = 3,
  topN = 3,
): Record<string, string[]> {
  const suggestions: Record<string, string[]> = {};
  for (const unknown of unknownNames) {
    const candidates = supportedArray
      .map((s) => ({ s, d: levenshteinDistance(unknown, s) }))
      .sort((a, b) => a.d - b.d)
      .slice(0, topN)
      .filter((c) => c.d <= maxDistance)
      .map((c) => c.s);
    if (candidates.length) suggestions[unknown] = candidates;
  }
  return suggestions;
}

/**
 * Enforces a maximum on unique card types and returns an API error if exceeded.
 */
function validateUniqueCardTypes(
  cards: unknown[],
  endpoint: string,
  request?: Request,
): NextResponse<ApiError> | null {
  const maxSupportedTypes = Object.keys(displayNames).length || 33;
  const MAX_ALLOWED_CARDS = Math.max(33, maxSupportedTypes);

  const supportedNames = new Set<string>(Object.keys(displayNames));
  const { uniqueSupportedNames, unknownNames } =
    collectUniqueAndUnknownCardNames(cards, supportedNames);

  // If any invalid/unsupported card names are present, return a clear error
  if (unknownNames.size > 0) {
    console.warn(
      `⚠️ [${endpoint}] Invalid card types provided: ${[...unknownNames].join(", ")}`,
    );

    const suggestions = buildLevenshteinSuggestions(unknownNames, [
      ...supportedNames,
    ]);

    return NextResponse.json(
      {
        error: "Invalid data: Invalid card type",
        invalidCardNames: [...unknownNames],
        suggestions,
      },
      { status: 400, headers: apiJsonHeaders(request) },
    );
  }

  // Enforce the allowed maximum against supported card types only
  if (uniqueSupportedNames.size > MAX_ALLOWED_CARDS) {
    console.warn(
      `⚠️ [${endpoint}] Too many unique card types provided: ${uniqueSupportedNames.size} (max ${MAX_ALLOWED_CARDS})`,
    );
    return NextResponse.json(
      {
        error: `Too many cards provided: ${uniqueSupportedNames.size} (max ${MAX_ALLOWED_CARDS})`,
      },
      { status: 400, headers: apiJsonHeaders(request) },
    );
  }

  return null;
}

/**
 * Validates each card object in the array using existing helper validators.
 */
function validateCardsItems(
  cards: unknown[],
  endpoint: string,
  request?: Request,
): NextResponse<ApiError> | null {
  for (let i = 0; i < cards.length; i++) {
    const card = cards[i];

    if (typeof card !== "object" || card === null) {
      console.warn(`⚠️ [${endpoint}] Card ${i} is not a valid object`);
      return NextResponse.json(
        { error: "Invalid data" },
        { status: 400, headers: apiJsonHeaders(request) },
      );
    }

    const cardRecord = card as Record<string, unknown>;

    // Validate required fields
    const requiredFieldsError = validateCardRequiredFields(
      cardRecord,
      i,
      endpoint,
      request,
    );
    if (requiredFieldsError) return requiredFieldsError;

    // Validate optional fields
    const optionalFieldsError = validateCardOptionalFields(
      cardRecord,
      i,
      endpoint,
      request,
    );
    if (optionalFieldsError) return optionalFieldsError;
  }

  return null;
}

/**
 * Validates an array of cards provided in the store-cards endpoint, ensuring
 * userId is valid and that each card's required and optional fields are valid.
 * @param cards - Payload expected to be an array of card objects.
 * @param userId - User identifier associated with the cards.
 * @param endpoint - Logical endpoint name for logging/analytics.
 * @returns A NextResponse with an ApiError when invalid, or null otherwise.
 * @source
 */
export function validateCardData(
  cards: unknown,
  userId: unknown,
  endpoint: string,
  request?: Request,
): NextResponse<ApiError> | null {
  // Validate userId
  const userIdError = validateUserIdField(userId, endpoint, request);
  if (userIdError) return userIdError;

  // Validate that cards is an array
  const cardsArrayError = validateCardsArrayField(cards, endpoint, request);
  if (cardsArrayError) return cardsArrayError;

  const cardsArr = cards as unknown[];

  // Validate unique card types limit
  const uniqueErr = validateUniqueCardTypes(cardsArr, endpoint, request);
  if (uniqueErr) return uniqueErr;

  // Validate each card's structure and fields
  const itemsErr = validateCardsItems(cardsArr, endpoint, request);
  if (itemsErr) return itemsErr;

  return null;
}

/**
 * The result returned from initializing an API request, including timing
 * context and any early error response encountered during initialization.
 * @source
 */
export interface ApiInitResult {
  startTime: number;
  ip: string;
  endpoint: string;
  endpointKey: string;
  errorResponse?: NextResponse<ApiError>;
}

/**
 * Performs common API request initialization checks (rate limit, same-origin)
 * and returns contextual information needed by handlers.
 * @param request - The incoming Request object.
 * @param endpointName - Friendly endpoint name used for logs.
 * @param endpointKey - Stable canonical endpoint key used for analytics metric keys.
 * @returns ApiInitResult with startTime, ip, endpoint and any early errorResponse.
 * @source
 */
export async function initializeApiRequest(
  request: Request,
  endpointName: string,
  endpointKey: string,
  limiter?: Ratelimit,
): Promise<ApiInitResult> {
  const startTime = Date.now();
  const ip = request.headers.get("x-forwarded-for") || "127.0.0.1";
  const endpoint = endpointName;

  logRequest(endpoint, ip);

  // Check rate limit
  const rateLimitResponse = await checkRateLimit(
    request,
    ip,
    endpoint,
    endpointKey,
    limiter,
  );
  if (rateLimitResponse) {
    return {
      startTime,
      ip,
      endpoint,
      endpointKey,
      errorResponse: rateLimitResponse,
    };
  }

  // Validate same-origin request (for write operations)
  const sameOriginResponse = validateSameOrigin(request, endpoint, endpointKey);
  if (sameOriginResponse) {
    return {
      startTime,
      ip,
      endpoint,
      endpointKey,
      errorResponse: sameOriginResponse,
    };
  }

  return { startTime, ip, endpoint, endpointKey };
}
