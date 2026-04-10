import { afterEach, beforeEach, describe, expect, it, mock } from "bun:test";

import {
  fetchUpstreamWithRetry,
  UpstreamCircuitOpenError,
} from "@/lib/api/upstream";
import {
  allowConsoleWarningsAndErrors,
  sharedRedisMockDel,
  sharedRedisMockGet,
  sharedRedisMockIncr,
  sharedRedisMockSet,
} from "@/tests/unit/__setup__";

const CIRCUIT_PREFIX = "upstream:circuit";

function getFailureCountKey(key: string): string {
  return `${CIRCUIT_PREFIX}:${key}:consecutive-failures`;
}

function getOpenedUntilKey(key: string): string {
  return `${CIRCUIT_PREFIX}:${key}:opened-until`;
}

function installRedisCircuitStore() {
  const store = new Map<string, string>();

  sharedRedisMockGet.mockImplementation((key: string) =>
    Promise.resolve(store.get(key) ?? null),
  );
  sharedRedisMockSet.mockImplementation(
    (key: string, value: string | number) => {
      store.set(key, String(value));
      return Promise.resolve("OK");
    },
  );
  sharedRedisMockDel.mockImplementation((...keys: string[]) => {
    let deleted = 0;

    for (const key of keys) {
      if (store.delete(key)) {
        deleted += 1;
      }
    }

    return Promise.resolve(deleted);
  });
  sharedRedisMockIncr.mockImplementation((...args: unknown[]) => {
    const storageKey = String(args[0] ?? "");
    const nextValue = Number.parseInt(store.get(storageKey) ?? "0", 10) + 1;
    store.set(storageKey, String(nextValue));
    return Promise.resolve(nextValue);
  });

  return store;
}

function createRetryableResponse(status = 503): Response {
  return new Response(JSON.stringify({ error: "upstream unavailable" }), {
    status,
    headers: {
      "Content-Type": "application/json",
    },
  });
}

describe("lib/api/upstream shared circuit breaker", () => {
  beforeEach(() => {
    allowConsoleWarningsAndErrors();
    process.env = {
      ...process.env,
      NODE_ENV: "test",
    };

    sharedRedisMockGet.mockReset();
    sharedRedisMockSet.mockReset();
    sharedRedisMockDel.mockReset();
    sharedRedisMockIncr.mockReset();

    sharedRedisMockGet.mockResolvedValue(null);
    sharedRedisMockSet.mockResolvedValue("OK");
    sharedRedisMockDel.mockResolvedValue(0);
    sharedRedisMockIncr.mockResolvedValue(1);
  });

  afterEach(() => {
    mock.clearAllMocks();
    delete process.env.ANILIST_UPSTREAM_CIRCUIT_FAILURE_THRESHOLD;
    delete process.env.ANILIST_UPSTREAM_CIRCUIT_COOLDOWN_MS;
  });

  it("reads an already-open circuit from Redis before making a fetch", async () => {
    const circuitKey = "anilist-graphql-redis-open";
    const redisStore = installRedisCircuitStore();
    redisStore.set(getOpenedUntilKey(circuitKey), String(Date.now() + 30_000));

    globalThis.fetch = mock(() =>
      Promise.resolve(
        new Response(JSON.stringify({ ok: true }), { status: 200 }),
      ),
    ) as unknown as typeof fetch;

    await expect(
      fetchUpstreamWithRetry({
        service: "AniList GraphQL",
        url: "https://graphql.anilist.co",
        maxAttempts: 1,
        circuitBreaker: {
          key: circuitKey,
          cooldownMs: 30_000,
        },
      }),
    ).rejects.toBeInstanceOf(UpstreamCircuitOpenError);

    expect(globalThis.fetch).not.toHaveBeenCalled();
  });

  it("persists retryable failures to Redis so circuit state can be shared", async () => {
    const circuitKey = "anilist-graphql-shared";
    const redisStore = installRedisCircuitStore();

    globalThis.fetch = mock(() =>
      Promise.resolve(createRetryableResponse()),
    ) as unknown as typeof fetch;

    const response = await fetchUpstreamWithRetry({
      service: "AniList GraphQL",
      url: "https://graphql.anilist.co",
      maxAttempts: 1,
      circuitBreaker: {
        key: circuitKey,
        cooldownMs: 30_000,
        failureThreshold: 1,
      },
    });

    expect(response.status).toBe(503);
    expect(redisStore.get(getFailureCountKey(circuitKey))).toBe("1");

    const openedUntil = Number(redisStore.get(getOpenedUntilKey(circuitKey)));
    expect(sharedRedisMockSet).toHaveBeenCalledWith(
      getOpenedUntilKey(circuitKey),
      expect.any(String),
      { ex: 30 },
    );
    expect(Number.isFinite(openedUntil)).toBe(true);
    expect(openedUntil).toBeGreaterThan(Date.now());
  });

  it("falls back to in-memory breaker state when Redis is unavailable", async () => {
    const circuitKey = "anilist-graphql-fallback";
    const redisError = new Error("Upstash Redis unavailable");

    sharedRedisMockGet.mockRejectedValue(redisError);
    sharedRedisMockSet.mockRejectedValue(redisError);
    sharedRedisMockDel.mockRejectedValue(redisError);
    sharedRedisMockIncr.mockRejectedValue(redisError);

    globalThis.fetch = mock(() =>
      Promise.resolve(createRetryableResponse()),
    ) as unknown as typeof fetch;

    const firstResponse = await fetchUpstreamWithRetry({
      service: "AniList GraphQL",
      url: "https://graphql.anilist.co",
      maxAttempts: 1,
      circuitBreaker: {
        key: circuitKey,
        cooldownMs: 30_000,
        failureThreshold: 1,
      },
    });

    expect(firstResponse.status).toBe(503);

    await expect(
      fetchUpstreamWithRetry({
        service: "AniList GraphQL",
        url: "https://graphql.anilist.co",
        maxAttempts: 1,
        circuitBreaker: {
          key: circuitKey,
          cooldownMs: 30_000,
          failureThreshold: 1,
        },
      }),
    ).rejects.toBeInstanceOf(UpstreamCircuitOpenError);

    expect(globalThis.fetch).toHaveBeenCalledTimes(1);
  });

  it("retries transport failures based on cause codes instead of brittle messages", async () => {
    let attempt = 0;

    globalThis.fetch = mock(() => {
      attempt += 1;

      if (attempt === 1) {
        const transportError = new TypeError("opaque upstream failure");
        (transportError as TypeError & { cause?: unknown }).cause =
          Object.assign(new Error("socket hang up"), {
            code: "ECONNRESET",
          });

        return Promise.reject(transportError);
      }

      return Promise.resolve(
        new Response(JSON.stringify({ ok: true }), {
          status: 200,
          headers: {
            "Content-Type": "application/json",
          },
        }),
      );
    }) as unknown as typeof fetch;

    const response = await fetchUpstreamWithRetry({
      service: "AniList GraphQL",
      url: "https://graphql.anilist.co",
      maxAttempts: 2,
      timeoutMs: 5_000,
      totalTimeoutMs: 5_000,
    });

    expect(response.status).toBe(200);
    expect(globalThis.fetch).toHaveBeenCalledTimes(2);
  });

  it("caps retrying within the total upstream request budget", async () => {
    globalThis.fetch = mock(() =>
      Promise.resolve(
        new Response(JSON.stringify({ error: "upstream unavailable" }), {
          status: 503,
          headers: {
            "Content-Type": "application/json",
            "Retry-After": "10",
          },
        }),
      ),
    ) as unknown as typeof fetch;

    const response = await fetchUpstreamWithRetry({
      service: "AniList GraphQL",
      url: "https://graphql.anilist.co",
      maxAttempts: 3,
      timeoutMs: 5_000,
      totalTimeoutMs: 1_000,
    });

    expect(response.status).toBe(503);
    expect(globalThis.fetch).toHaveBeenCalledTimes(1);
  });
});
