import { afterEach, describe, expect, it } from "bun:test";
import { Ratelimit } from "@upstash/ratelimit";
import {
  sharedRatelimitMockLimit,
  sharedRedisMockIncr,
  sharedRedisMockMget,
  sharedRedisMockScan,
} from "@/tests/unit/__setup__";
import {
  createRateLimiter,
  getAllowedApiOrigin,
  mgetInBatches,
  scanAllKeys,
} from "@/lib/api-utils";

/**
 * Reads the options handed to the most recent Ratelimit constructor call.
 * @returns The constructor options, or undefined when no limiter was built.
 * @source
 */
function getLastRatelimitOptions():
  | {
      ephemeralCache?: unknown;
      analytics?: boolean;
    }
  | undefined {
  const calls = (
    Ratelimit as unknown as { mock: { calls: [unknown, ...unknown[]][] } }
  ).mock.calls;
  const lastCall = calls[calls.length - 1];
  return lastCall?.[0] as
    { ephemeralCache?: unknown; analytics?: boolean } | undefined;
}

describe("Rate limit ephemeral cache", () => {
  it("should give each limiter its own ephemeral cache", () => {
    // The cache answers a repeat rejection from instance memory, so an
    // over-limit caller stops costing Redis commands. It must be a Map: the
    // constructor only enables the cache for one.
    createRateLimiter();
    const first = getLastRatelimitOptions();
    expect(first?.ephemeralCache).toBeInstanceOf(Map);

    createRateLimiter({ limit: 150, window: "10 s" });
    const second = getLastRatelimitOptions();
    expect(second?.ephemeralCache).toBeInstanceOf(Map);

    // Per instance: a shared Map would carry one caller's rejection state
    // into a limiter with a different limit.
    expect(second?.ephemeralCache).not.toBe(first?.ephemeralCache);
  });

  it("should leave analytics off so no event stream is written", () => {
    // `analytics: true` made every limit() issue a ZINCRBY into
    // `@upstash/ratelimit:events:<hour>` that nothing in this app reads. It is
    // the single largest avoidable cost in the rate-limit path.
    createRateLimiter();
    expect(getLastRatelimitOptions()?.analytics).toBeUndefined();
  });

  it("should cap the cache so a rotating identifier cannot grow it forever", () => {
    // The SDK only drops an entry when the same identifier is looked up after
    // its window ends, so a client that varies x-forwarded-for would grow the
    // map for the life of the process without a cap of its own.
    createRateLimiter();
    const cache = getLastRatelimitOptions()?.ephemeralCache as Map<
      string,
      number
    >;
    expect(cache).toBeInstanceOf(Map);

    for (let i = 0; i < 10_050; i++)
      cache.set(`10.0.0.${i}`, Date.now() + 1_000);

    expect(cache.size).toBe(10_000);
    // The oldest entries went first, so the newest key is still present.
    expect(cache.has("10.0.0.10049")).toBe(true);
    expect(cache.has("10.0.0.0")).toBe(false);
  });
});

describe("Cache-served rate limit rejections", () => {
  afterEach(() => {
    sharedRatelimitMockLimit.mockReset();
    sharedRatelimitMockLimit.mockResolvedValue({ success: true });
    sharedRedisMockIncr.mockClear();
  });

  it("should not write the failed_requests counter for a cache-served rejection", async () => {
    // The whole point of the ephemeral cache is to answer without a Redis
    // command, so recording the rejection there would undo it.
    sharedRatelimitMockLimit.mockResolvedValue({
      success: false,
      reason: "cacheBlock",
    });
    const { checkRateLimit } = await import("@/lib/api-utils");

    const response = await checkRateLimit(
      undefined,
      "127.0.0.1",
      "Test",
      "test",
    );

    expect(response?.status).toBe(429);
    expect(sharedRedisMockIncr).not.toHaveBeenCalled();
  });

  it("should still write the counter for a Redis-backed rejection", async () => {
    sharedRatelimitMockLimit.mockResolvedValue({ success: false });
    const { checkRateLimit } = await import("@/lib/api-utils");

    await checkRateLimit(undefined, "127.0.0.1", "Test", "test");

    expect(sharedRedisMockIncr).toHaveBeenCalledWith(
      "analytics:test:failed_requests",
    );
  });
});

describe("Bounded key reads", () => {
  afterEach(() => {
    sharedRedisMockScan.mockReset();
    sharedRedisMockMget.mockReset();
  });

  it("should stop scanning once the caller has enough keys", async () => {
    // The reconciliation passes a cap. Without the early stop it walked the
    // whole keyspace and the caller sliced afterwards, discarding the work.
    sharedRedisMockScan
      .mockResolvedValueOnce([1, ["cards:1", "cards:2"]])
      .mockResolvedValueOnce([2, ["cards:3", "cards:4"]])
      .mockResolvedValueOnce([0, ["cards:5"]]);

    const keys = await scanAllKeys("cards:*", undefined, undefined, 3);

    expect(keys).toEqual(["cards:1", "cards:2", "cards:3"]);
    expect(sharedRedisMockScan).toHaveBeenCalledTimes(2);
  });

  it("should read many keys in bounded batches", async () => {
    sharedRedisMockMget.mockImplementation(async (...keys: string[]) =>
      keys.map((key) => `value:${key}`),
    );

    const values = await mgetInBatches<string>(["a", "b", "c", "d", "e"], 2);

    expect(values).toEqual([
      "value:a",
      "value:b",
      "value:c",
      "value:d",
      "value:e",
    ]);
    expect(sharedRedisMockMget).toHaveBeenCalledTimes(3);
  });
});

describe("getAllowedApiOrigin", () => {
  const originalAppUrl = process.env.NEXT_PUBLIC_APP_URL;
  const originalSiteUrl = process.env.NEXT_PUBLIC_SITE_URL;
  const originalNodeEnv = process.env.NODE_ENV;

  afterEach(() => {
    (process.env as Record<string, string | undefined>)["NEXT_PUBLIC_APP_URL"] =
      originalAppUrl;
    (process.env as Record<string, string | undefined>)[
      "NEXT_PUBLIC_SITE_URL"
    ] = originalSiteUrl;
    (process.env as Record<string, string | undefined>)["NODE_ENV"] =
      originalNodeEnv;
  });

  it("should prefer the configured app URL over the request origin", () => {
    (process.env as Record<string, string | undefined>)["NEXT_PUBLIC_APP_URL"] =
      "https://configured.example";

    const request = new Request("https://api.example/x", {
      headers: { origin: "https://other.example" },
    });

    expect(getAllowedApiOrigin(request)).toBe("https://configured.example");
  });

  it("should fall back to the site origin in production, never to a wildcard", () => {
    // A production request origin must not be reflected back, and the wildcard
    // must not be reachable, because either would let any site call the API.
    delete (process.env as Record<string, string | undefined>)[
      "NEXT_PUBLIC_APP_URL"
    ];
    (process.env as Record<string, string | undefined>)[
      "NEXT_PUBLIC_SITE_URL"
    ] = "https://anicards.example";
    (process.env as Record<string, string | undefined>)["NODE_ENV"] =
      "production";

    const request = new Request("https://api.example/x", {
      headers: { origin: "https://attacker.example" },
    });

    expect(getAllowedApiOrigin(request)).toBe("https://anicards.example");
  });

  it("should fall back to the default origin when the site URL is unusable", () => {
    // A bare host is not a parseable origin. The fallback has to stay a real
    // origin rather than an empty string, which no browser would match.
    delete (process.env as Record<string, string | undefined>)[
      "NEXT_PUBLIC_APP_URL"
    ];
    (process.env as Record<string, string | undefined>)[
      "NEXT_PUBLIC_SITE_URL"
    ] = "anicards.test";
    (process.env as Record<string, string | undefined>)["NODE_ENV"] =
      "production";

    expect(getAllowedApiOrigin()).toBe("https://anicards.alpha49.com");
  });

  it("should reflect the request origin outside production", () => {
    delete (process.env as Record<string, string | undefined>)[
      "NEXT_PUBLIC_APP_URL"
    ];
    (process.env as Record<string, string | undefined>)["NODE_ENV"] =
      "development";

    const request = new Request("https://api.example/x", {
      headers: { origin: "https://dev.example" },
    });

    expect(getAllowedApiOrigin(request)).toBe("https://dev.example");
  });
});

describe("checkRateLimit analytics scheduling", () => {
  afterEach(() => {
    sharedRatelimitMockLimit.mockReset();
    sharedRatelimitMockLimit.mockResolvedValue({ success: true });
  });

  it("should not throw when the limiter reports no pending work", async () => {
    // `after` throws outside a request scope, which is exactly where this test
    // runs, so the guard has to absorb it rather than let it escape.
    sharedRatelimitMockLimit.mockResolvedValue({ success: true });
    const { checkRateLimit } = await import("@/lib/api-utils");

    await expect(
      checkRateLimit(undefined, "127.0.0.1", "Test", "test"),
    ).resolves.toBeNull();
  });

  it("should not throw when the limiter reports pending work", async () => {
    sharedRatelimitMockLimit.mockResolvedValue({
      success: true,
      pending: Promise.resolve(),
    });
    const { checkRateLimit } = await import("@/lib/api-utils");

    await expect(
      checkRateLimit(undefined, "127.0.0.1", "Test", "test"),
    ).resolves.toBeNull();
  });
});
