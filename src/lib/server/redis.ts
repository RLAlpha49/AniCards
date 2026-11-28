/**
 * The shared Upstash Redis client and the read helpers built on it.
 *
 * One lazily created client, a keep-alive agent for Node runtimes, and the
 * paginated `SCAN` and batched `MGET` helpers the rest of the server uses.
 * @source
 */
import { after } from "next/server";
import { Redis } from "@upstash/redis";
import { logWith } from "@/lib/log";
import type { Agent as HttpAgent } from "node:http";
import type { Agent as HttpsAgent } from "node:https";

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
    logWith(
      "debug",
      "HTTP agent",
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
export function createRealRedisClient(): Redis {
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
 * Redis and the HTTP client both handle. The batches are independent reads, so
 * they are issued together and the replies are flattened in key order.
 *
 * @param keys - Keys to read, in order.
 * @param batchSize - Keys per `MGET`.
 * @returns One value per key, in the same order.
 */
export async function mgetInBatches<T>(
  keys: string[],
  batchSize: number = 500,
): Promise<(T | null)[]> {
  const batches: string[][] = [];
  for (let offset = 0; offset < keys.length; offset += batchSize) {
    batches.push(keys.slice(offset, offset + batchSize));
  }

  const replies = await Promise.all(
    batches.map((batch) => redisClient.mget<(T | null)[]>(...batch)),
  );
  return replies.flat();
}
