import { afterEach, describe, expect, it, mock } from "bun:test";
import { Ratelimit } from "@upstash/ratelimit";
import {
  sharedRatelimitMockLimit,
  sharedRedisMockPipelineExpire,
  sharedRedisMockPipelineExec,
  sharedRedisMockPipelineZincrby,
} from "@/tests/unit/__setup__.test";
import { createRateLimiter, getAllowedApiOrigin } from "@/lib/api-utils";

/**
 * Retention the wrapper applies to rate limit analytics buckets (90 days).
 * @source
 */
const EXPECTED_TTL_SECONDS = 90 * 24 * 60 * 60;

const ANALYTICS_KEY = "@upstash/ratelimit:events:1234567890";

/**
 * Reads the Redis client handed to the most recent Ratelimit constructor call.
 * `createRateLimiter` wraps that client, so calling through it exercises the
 * real wrapper rather than a stub.
 * @returns The wrapped client, or undefined when no limiter was constructed.
 * @source
 */
function getWrappedRedisClient():
  | {
      zincrby: (key: string, increment: number, member: unknown) => unknown;
    }
  | undefined {
  const calls = (
    Ratelimit as unknown as { mock: { calls: [unknown, ...unknown[]][] } }
  ).mock.calls;
  const lastCall = calls[calls.length - 1];
  if (!lastCall) return undefined;
  const options = lastCall[0] as { redis?: unknown };
  return options.redis as {
    zincrby: (key: string, increment: number, member: unknown) => unknown;
  };
}

describe("Rate limit analytics expiry", () => {
  afterEach(() => {
    // Only the mocks this file drives are reset. A blanket clearAllMocks would
    // wipe implementations other test files arm in their own setup, because
    // Bun shares one module registry across the suite.
    sharedRedisMockPipelineZincrby.mockClear();
    sharedRedisMockPipelineExpire.mockClear();
    sharedRedisMockPipelineExec.mockClear();
    sharedRedisMockPipelineExec.mockResolvedValue([]);
  });

  it("should pipeline an EXPIRE alongside an analytics zincrby", async () => {
    sharedRedisMockPipelineExec.mockResolvedValueOnce([1, 1] as never);

    createRateLimiter();
    const client = getWrappedRedisClient();
    expect(client).toBeDefined();

    const result = await client!.zincrby(ANALYTICS_KEY, 1, "member");

    expect(sharedRedisMockPipelineZincrby).toHaveBeenCalledWith(
      ANALYTICS_KEY,
      1,
      "member",
    );
    expect(sharedRedisMockPipelineExpire).toHaveBeenCalledWith(
      ANALYTICS_KEY,
      EXPECTED_TTL_SECONDS,
      "NX",
    );
    // The wrapper resolves with the write result, not the expiry result.
    expect(result).toBe(1);
  });

  it("should leave non-analytics writes unwrapped", async () => {
    // No exec result is queued on purpose: this path must not reach the
    // pipeline at all, and a leftover queued value would leak into later tests.
    createRateLimiter();
    const client = getWrappedRedisClient();
    expect(client).toBeDefined();

    await client!.zincrby("some:other:sorted:set", 3, "member");

    expect(sharedRedisMockPipelineExpire).not.toHaveBeenCalled();
    expect(sharedRedisMockPipelineZincrby).not.toHaveBeenCalled();
  });

  it("should stay quiet when EXPIRE NX reports an existing TTL", async () => {
    // 0 is the steady state: the bucket already carries the TTL set by the
    // first write in the hour, so warning here would fire on nearly every
    // request and report a bucket that does expire as unprotected.
    sharedRedisMockPipelineExec.mockResolvedValueOnce([1, 0] as never);
    const warnSpy = mock();
    const originalWarn = console.warn;
    console.warn = warnSpy as unknown as typeof console.warn;

    try {
      createRateLimiter();
      const client = getWrappedRedisClient();
      const result = await client!.zincrby(ANALYTICS_KEY, 1, "member");

      expect(warnSpy).not.toHaveBeenCalled();
      expect(result).toBe(1);
    } finally {
      console.warn = originalWarn;
    }
  });

  it("should warn when the expiry reply is not 0 or 1", async () => {
    // -2 means the key did not exist for the EXPIRE, so nothing applied the
    // retention and the bucket could outlive it. That is worth surfacing.
    sharedRedisMockPipelineExec.mockResolvedValueOnce([1, -2] as never);
    const warnSpy = mock();
    const originalWarn = console.warn;
    console.warn = warnSpy as unknown as typeof console.warn;

    try {
      createRateLimiter();
      const client = getWrappedRedisClient();
      await client!.zincrby(ANALYTICS_KEY, 1, "member");

      expect(warnSpy).toHaveBeenCalled();
    } finally {
      console.warn = originalWarn;
    }
  });

  it("should keep wrapping zincrby, the command core-analytics ingests with", async () => {
    // The wrapper keys off the command name. If an upgrade switched ingest to
    // zadd or a Lua eval, analytics keys would silently stop expiring, so the
    // command name is pinned here rather than left to the dependency.
    sharedRedisMockPipelineExec.mockResolvedValueOnce([1, 1] as never);

    createRateLimiter();
    const client = getWrappedRedisClient();
    await client!.zincrby(ANALYTICS_KEY, 1, "member");

    expect(sharedRedisMockPipelineZincrby).toHaveBeenCalledTimes(1);
    expect(sharedRedisMockPipelineExpire).toHaveBeenCalledTimes(1);
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

  it("should not throw when the limiter reports pending analytics work", async () => {
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
