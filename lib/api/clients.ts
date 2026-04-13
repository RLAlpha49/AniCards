import { Redis } from "@upstash/redis";

import { readBooleanEnv } from "@/lib/api/config";
import { assertRequiredProductionEnv } from "@/lib/api/production-env";

let realRedisClient: Redis | undefined;

/**
 * Create or return an existing Redis client instance using environment
 * configuration. This defers initialization until the client is used.
 */
export function createRealRedisClient(): Redis {
  if (process.env.NODE_ENV === "production") {
    assertRequiredProductionEnv(process.env, {
      names: ["UPSTASH_REDIS_REST_URL", "UPSTASH_REDIS_REST_TOKEN"],
    });
  }

  realRedisClient ??= Redis.fromEnv({
    enableAutoPipelining: true,
    retry: {
      retries: 3,
      backoff: (retryCount: number) => Math.round(Math.exp(retryCount) * 50),
    },
    latencyLogging: readBooleanEnv("UPSTASH_REDIS_LATENCY_LOGGING") === true,
  });

  return realRedisClient;
}

export function resetRealRedisClientForTests(): void {
  if (process.env.ANICARDS_UNIT_TEST !== "true") {
    throw new Error("resetRealRedisClientForTests is only available in tests.");
  }

  realRedisClient = undefined;
}

/**
 * A lazily-initialized proxy for the Upstash Redis client that forwards
 * operations to a real client when they are invoked.
 */
export const redisClient: Redis = new Proxy({} as Record<string, unknown>, {
  get(_: unknown, prop: string | symbol) {
    const client = createRealRedisClient();
    const value: unknown = (client as unknown as Record<string, unknown>)[
      prop as keyof typeof client
    ];

    if (typeof value === "function") {
      return (...args: unknown[]) =>
        (value as (...callArgs: unknown[]) => unknown).apply(client, args);
    }

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
 */
export async function scanAllKeys(
  pattern: string,
  count: number = 1000,
): Promise<string[]> {
  let cursor: string | number = 0;
  const allKeys: string[] = [];

  do {
    const [nextCursor, keys] = (await redisClient.scan(cursor, {
      match: pattern,
      count,
    })) as [string | number, string[]];

    cursor = nextCursor;
    allKeys.push(...keys);
  } while (cursor !== 0 && cursor !== "0");

  return allKeys;
}
