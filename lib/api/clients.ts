import { Redis } from "@upstash/redis";

let realRedisClient: Redis | undefined;

/**
 * Create or return an existing Redis client instance using environment
 * configuration. This defers initialization until the client is used.
 */
export function createRealRedisClient(): Redis {
  realRedisClient ??= Redis.fromEnv({
    enableAutoPipelining: true,
    retry: {
      retries: 3,
      backoff: (retryCount: number) => Math.round(Math.exp(retryCount) * 50),
    },
    latencyLogging: process.env.NODE_ENV !== "production",
  });

  return realRedisClient;
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
