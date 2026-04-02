import { Ratelimit } from "@upstash/ratelimit";
import { afterEach, beforeEach, describe, expect, it, mock } from "bun:test";

import {
  createRequestProofToken,
  REQUEST_PROOF_COOKIE_NAME,
  resolveVerifiedClientIp,
} from "@/lib/api/request-proof";
import {
  ANALYTICS_COUNTER_TTL_SECONDS,
  apiErrorResponse,
  buildAnalyticsStorageKey,
  checkRateLimit,
  createRateLimiter,
  flushScheduledTelemetryTasksForTests,
  getRequestIp,
  handleError,
  incrementAnalytics,
  incrementAnalyticsBatch,
  initializeApiRequest,
  invalidJsonResponse,
  readJsonRequestBody,
  scheduleTelemetryTask,
  validateSameOrigin,
} from "@/lib/api-utils";
import {
  allowConsoleWarningsAndErrors,
  sharedRatelimitMockSlidingWindow,
  sharedRedisMockExpire,
  sharedRedisMockIncr,
  sharedRedisMockIncrRaw,
  sharedRedisMockPipeline,
  sharedRedisMockPipelineExec,
} from "@/tests/unit/__setup__";

function createApiRequest(headers?: Record<string, string>): Request {
  return new Request("http://localhost/api/test", {
    method: "POST",
    headers: {
      origin: "http://localhost",
      ...headers,
    },
  });
}

function getLastRatelimitConstructorOptions(): Record<string, unknown> {
  const constructorCalls = (
    Ratelimit as unknown as {
      mock: { calls: Array<[Record<string, unknown>]> };
    }
  ).mock.calls;

  const options = constructorCalls.at(-1)?.[0];
  expect(options).toBeDefined();
  return options ?? {};
}

describe("api-utils hardening", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    allowConsoleWarningsAndErrors();
    process.env = {
      ...originalEnv,
      NEXT_PUBLIC_APP_URL: "http://localhost",
      NODE_ENV: "test",
    };
    sharedRedisMockIncr.mockReset();
    sharedRedisMockIncr.mockResolvedValue(1);
    sharedRedisMockIncrRaw.mockReset();
    sharedRedisMockIncrRaw.mockResolvedValue(1);
    sharedRedisMockExpire.mockReset();
    sharedRedisMockExpire.mockResolvedValue(1);
    sharedRedisMockPipeline.mockReset();
    sharedRedisMockPipelineExec.mockReset();
    sharedRedisMockPipelineExec.mockResolvedValue([]);
    sharedRatelimitMockSlidingWindow.mockReset();
    sharedRatelimitMockSlidingWindow.mockImplementation(() => "fake-limiter");
  });

  afterEach(async () => {
    await flushScheduledTelemetryTasksForTests();
    process.env = originalEnv;
    mock.clearAllMocks();
  });

  it("rejects missing Origin headers by default", async () => {
    const response = validateSameOrigin(
      new Request("http://localhost/api/test", { method: "POST" }),
      "Test API",
      "test_api",
    );

    await Promise.resolve();

    expect(response?.status).toBe(401);
    expect(sharedRedisMockIncr).toHaveBeenCalledWith(
      "analytics:test_api:failed_requests",
    );
  });

  it("allows missing Origin headers only when requireOrigin is explicitly disabled", () => {
    const response = validateSameOrigin(
      new Request("http://localhost/api/test", { method: "POST" }),
      "Trusted Test API",
      "trusted_test_api",
      { requireOrigin: false },
    );

    expect(response).toBeNull();
  });

  it("prefers trusted deployment IP headers over spoofable forwarded headers", () => {
    const request = new Request("http://localhost/api/test", {
      headers: {
        "x-forwarded-for": "203.0.113.99",
        "x-vercel-forwarded-for": "198.51.100.24",
      },
    });

    expect(getRequestIp(request)).toBe("198.51.100.24");
  });

  it("ignores spoofable x-forwarded-for when no trusted proxy header is present", () => {
    const request = new Request("http://localhost/api/test", {
      headers: {
        "x-forwarded-for": "203.0.113.99",
      },
    });

    expect(getRequestIp(request)).toBe("127.0.0.1");
  });

  it("resolves verified client IPs from configurable trusted headers", () => {
    process.env = {
      ...process.env,
      NODE_ENV: "production",
      TRUSTED_CLIENT_IP_HEADERS: "x-real-ip",
    };

    const result = resolveVerifiedClientIp(
      new Request("http://localhost/api/test", {
        headers: {
          "x-real-ip": "198.51.100.24",
        },
      }),
    );

    expect(result).toEqual({
      verified: true,
      ip: "198.51.100.24",
      source: "x-real-ip",
    });
  });

  it("tracks rate-limit timeouts with dedicated analytics while preserving fail-open behavior", async () => {
    const limiter = {
      limit: mock().mockResolvedValue({
        success: true,
        reason: "timeout",
        limit: 10,
        remaining: 9,
        reset: Date.now() + 5_000,
        pending: Promise.resolve(),
      }),
    } as never;

    const response = await checkRateLimit(
      new Request("http://localhost/api/test"),
      "127.0.0.1",
      "Test API",
      "test_api",
      limiter,
    );

    await flushScheduledTelemetryTasksForTests();

    expect(response).toBeNull();
    expect(sharedRedisMockIncr).toHaveBeenCalledWith(
      "analytics:test_api:rate_limit_timeouts",
    );
  });

  it("rejects oversized JSON payloads before handlers parse them", async () => {
    const request = new Request("http://localhost/api/test", {
      method: "POST",
      headers: {
        origin: "http://localhost",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ payload: "x".repeat(513 * 1024) }),
    });

    const bodyResult = await readJsonRequestBody<Record<string, unknown>>(
      request,
      {
        endpointName: "Test API",
        endpointKey: "test_api",
      },
    );

    await flushScheduledTelemetryTasksForTests();

    expect(bodyResult.success).toBe(false);
    if (bodyResult.success) {
      throw new Error("Expected oversized body to be rejected");
    }

    expect(bodyResult.errorResponse.status).toBe(413);
    expect((await bodyResult.errorResponse.json()).error).toBe(
      "Request body too large",
    );
    expect(sharedRedisMockIncr).toHaveBeenCalledWith(
      "analytics:test_api:failed_requests",
    );
  });

  it("stores analytics counters in monthly buckets with a bounded TTL", async () => {
    const now = new Date("2026-03-27T12:00:00.000Z");
    const metric = "analytics:test_api:successful_requests";
    const storageKey = buildAnalyticsStorageKey(metric, now);

    await incrementAnalytics(metric, { now });

    expect(storageKey).toBe(
      "analytics:test_api:successful_requests:month:2026-03",
    );
    expect(sharedRedisMockIncrRaw).toHaveBeenCalledWith(storageKey);
    expect(sharedRedisMockExpire).toHaveBeenCalledWith(
      storageKey,
      ANALYTICS_COUNTER_TTL_SECONDS,
    );
    expect(sharedRedisMockIncr).toHaveBeenCalledWith(metric);
  });

  it("falls back to immediate telemetry scheduling when waitUntil throws", async () => {
    const requestContextSymbol = Symbol.for("@next/request-context");
    const globalWithRequestContext = globalThis as typeof globalThis & {
      [key: symbol]:
        | {
            get?: () => {
              waitUntil?: (promise: Promise<unknown>) => void;
            };
          }
        | undefined;
    };
    const originalRequestContext =
      globalWithRequestContext[requestContextSymbol];
    const originalTelemetryTestFlag = process.env.ANICARDS_UNIT_TEST;
    let executions = 0;

    process.env.ANICARDS_UNIT_TEST = "false";
    globalWithRequestContext[requestContextSymbol] = {
      get: () => ({
        waitUntil: () => {
          throw new Error("waitUntil unavailable");
        },
      }),
    };

    try {
      scheduleTelemetryTask(
        () => {
          executions += 1;
        },
        {
          endpoint: "Test API",
          taskName: "waitUntil-fallback",
          request: createApiRequest(),
        },
      );

      await new Promise<void>((resolve) => {
        globalThis.setTimeout(resolve, 0);
      });

      expect(executions).toBe(1);
    } finally {
      process.env.ANICARDS_UNIT_TEST = originalTelemetryTestFlag;
      globalWithRequestContext[requestContextSymbol] = originalRequestContext;
    }
  });

  it("batches analytics increments through a single Redis pipeline while preserving monthly buckets", async () => {
    const now = new Date("2026-03-27T12:00:00.000Z");
    const metrics = [
      "analytics:test_api:cache_misses",
      "analytics:test_api:cache_misses:redis",
    ];

    await incrementAnalyticsBatch(metrics, { now });

    expect(sharedRedisMockPipeline).toHaveBeenCalledTimes(1);
    expect(sharedRedisMockPipelineExec).toHaveBeenCalledTimes(1);
    expect(sharedRedisMockIncrRaw).toHaveBeenCalledWith(
      "analytics:test_api:cache_misses:month:2026-03",
    );
    expect(sharedRedisMockIncrRaw).toHaveBeenCalledWith(
      "analytics:test_api:cache_misses:redis:month:2026-03",
    );
    expect(sharedRedisMockExpire).toHaveBeenCalledWith(
      "analytics:test_api:cache_misses:month:2026-03",
      ANALYTICS_COUNTER_TTL_SECONDS,
    );
    expect(sharedRedisMockExpire).toHaveBeenCalledWith(
      "analytics:test_api:cache_misses:redis:month:2026-03",
      ANALYTICS_COUNTER_TTL_SECONDS,
    );
    expect(sharedRedisMockIncr).toHaveBeenCalledWith(
      "analytics:test_api:cache_misses",
    );
    expect(sharedRedisMockIncr).toHaveBeenCalledWith(
      "analytics:test_api:cache_misses:redis",
    );
  });

  it("preserves safe public error detail exposed by structured errors", async () => {
    const error = Object.assign(new Error("private integrity detail"), {
      statusCode: 500,
      publicMessage: "Stored user record is incomplete or corrupted",
      retryable: false,
    });

    const response = handleError(
      error,
      "Test API",
      Date.now() - 25,
      "analytics:test_api:failed_requests",
      "Fallback error",
      new Request("http://localhost/api/test"),
    );

    expect(response.status).toBe(500);
    const body = await response.json();
    expect(body.error).toBe("Stored user record is incomplete or corrupted");
    expect(body.retryable).toBe(false);
    expect(body.status).toBe(500);
  });

  it("sanitizes long stack frames without relying on backtracking regexes", () => {
    const request = createApiRequest();
    const error = new Error("private integrity detail");
    error.stack = [
      "Error: private integrity detail",
      `    at ${"veryLongFunctionName".repeat(18)}    (file:///tmp/${"segment/".repeat(24)}example.ts:12:34)`,
      "    at nextFrame (file:///app/example.ts:56:78)",
    ].join("\n");

    handleError(
      error,
      "Test API",
      Date.now() - 25,
      "analytics:test_api:failed_requests",
      "Fallback error",
      request,
    );

    const consoleErrorCalls = (
      console.error as unknown as { mock: { calls: Array<[string]> } }
    ).mock.calls;
    expect(consoleErrorCalls.length).toBeGreaterThan(0);

    const logEntry = JSON.parse(String(consoleErrorCalls.at(-1)?.[0])) as {
      context?: { stack?: string };
      message?: string;
    };

    expect(logEntry.message).toBe("Request failed");
    expect(logEntry.context?.stack).toContain("at veryLongFunctionName");
    expect(logEntry.context?.stack).toContain("nextFrame");
    expect(logEntry.context?.stack).not.toContain("file:///tmp/");
    expect(logEntry.context?.stack).not.toContain("file:///app/example.ts");
    expect(logEntry.context?.stack?.length).toBeLessThanOrEqual(200);
  });

  it("maps Redis availability failures to a 503 degraded response when configured", async () => {
    const response = handleError(
      new Error("Redis connection failed"),
      "Test API",
      Date.now() - 25,
      "analytics:test_api:failed_requests",
      "Fallback error",
      new Request("http://localhost/api/test"),
      {
        redisUnavailableMessage: "Stored data is temporarily unavailable",
      },
    );

    expect(response.status).toBe(503);
    const body = await response.json();
    expect(body.error).toBe("Stored data is temporarily unavailable");
    expect(body.category).toBe("server_error");
    expect(body.retryable).toBe(true);
    expect(body.status).toBe(503);
  });

  it("merges explicit createRateLimiter overrides ahead of env-backed defaults", () => {
    const customRedis = { label: "custom-redis" } as never;

    process.env.UPSTASH_RATELIMIT_ANALYTICS = "false";
    process.env.UPSTASH_RATELIMIT_PROTECTION = "true";
    process.env.UPSTASH_RATELIMIT_PREFIX = "env-prefix";
    process.env.UPSTASH_RATELIMIT_TIMEOUT_MS = "2500";

    createRateLimiter({
      limit: 25,
      window: "1 m",
      redis: customRedis,
      analytics: true,
      enableProtection: false,
      prefix: "custom-prefix",
      timeout: 9000,
    });

    expect(sharedRatelimitMockSlidingWindow).toHaveBeenCalledWith(25, "1 m");
    expect(getLastRatelimitConstructorOptions()).toMatchObject({
      redis: customRedis,
      limiter: "fake-limiter",
      analytics: true,
      enableProtection: false,
      prefix: "custom-prefix",
      timeout: 9000,
    });
  });

  it("uses env-backed createRateLimiter defaults when explicit overrides are omitted", () => {
    process.env.UPSTASH_RATELIMIT_ANALYTICS = "false";
    process.env.UPSTASH_RATELIMIT_PROTECTION = "true";
    process.env.UPSTASH_RATELIMIT_PREFIX = "env-fallback";
    process.env.UPSTASH_RATELIMIT_TIMEOUT_MS = "3456";

    createRateLimiter({ limit: 12, window: "30 s" });

    expect(sharedRatelimitMockSlidingWindow).toHaveBeenCalledWith(12, "30 s");
    expect(getLastRatelimitConstructorOptions()).toMatchObject({
      limiter: "fake-limiter",
      analytics: false,
      enableProtection: true,
      prefix: "env-fallback",
      timeout: 3456,
    });
  });

  it("passes request metadata into successful rate-limit checks", async () => {
    const limit = mock().mockResolvedValue({
      success: true,
      limit: 20,
      remaining: 19,
      reset: Date.now() + 10_000,
      pending: Promise.resolve(),
    });
    const limiter = { limit };

    const request = createApiRequest({
      "user-agent": "AniCardsTest/1.0",
      "x-vercel-ip-country": "GB",
    });

    const response = await checkRateLimit(
      request,
      "198.51.100.24",
      "Test API",
      "test_api",
      limiter as never,
    );

    expect(response).toBeNull();
    expect(limit).toHaveBeenCalledWith("198.51.100.24", {
      ip: "198.51.100.24",
      userAgent: "AniCardsTest/1.0",
      country: "GB",
    });
  });

  it("returns a 429 response with rate-limit headers and request-id propagation", async () => {
    const reset = Date.now() + 5_000;
    const limit = mock().mockResolvedValue({
      success: false,
      reason: "denyList",
      deniedValue: "198.51.100.24",
      limit: 15,
      remaining: -2,
      reset,
      pending: Promise.resolve(),
    });
    const limiter = { limit };

    const request = createApiRequest({
      "cf-ipcountry": "CA",
      "user-agent": "AniCardsTest/2.0",
      "x-request-id": "req-rate-limit-12345",
    });

    const response = await checkRateLimit(
      request,
      "198.51.100.24",
      "Test API",
      "test_api",
      limiter as never,
    );

    await flushScheduledTelemetryTasksForTests();

    expect(response).not.toBeNull();
    expect(response?.status).toBe(429);
    expect(limit).toHaveBeenCalledWith("198.51.100.24", {
      ip: "198.51.100.24",
      userAgent: "AniCardsTest/2.0",
      country: "CA",
    });

    const body = await response?.json();
    expect(body).toMatchObject({
      error: "Too many requests",
      category: "rate_limited",
      retryable: true,
      status: 429,
    });
    expect(response?.headers.get("Retry-After")).toBeTruthy();
    expect(response?.headers.get("X-RateLimit-Limit")).toBe("15");
    expect(response?.headers.get("X-RateLimit-Remaining")).toBe("0");
    expect(response?.headers.get("X-RateLimit-Reset")).toBe(String(reset));
    expect(response?.headers.get("X-Request-Id")).toBe("req-rate-limit-12345");
    expect(response?.headers.get("Access-Control-Expose-Headers")).toContain(
      "X-Request-Id",
    );
    expect(sharedRedisMockIncr).toHaveBeenCalledWith(
      "analytics:test_api:failed_requests",
    );
  });

  it("rejects rate limiting when a verified client IP is required but unavailable", async () => {
    const response = await checkRateLimit(
      createApiRequest(),
      { ip: "unknown", verified: false },
      "Test API",
      "test_api",
      undefined,
      { requireVerifiedIp: true },
    );

    await flushScheduledTelemetryTasksForTests();

    expect(response?.status).toBe(503);
    expect(await response?.json()).toMatchObject({
      error: "Client IP could not be verified",
      retryable: true,
      status: 503,
    });
    expect(sharedRedisMockIncr).toHaveBeenCalledWith(
      "analytics:test_api:failed_requests",
    );
  });

  it("records dedicated analytics when the rate-limit provider throws", async () => {
    const limiter = {
      limit: mock().mockRejectedValue(new Error("Upstash exploded")),
    } as never;

    await expect(
      checkRateLimit(
        createApiRequest(),
        "127.0.0.1",
        "Test API",
        "test_api",
        limiter,
      ),
    ).rejects.toThrow("Upstash exploded");

    await flushScheduledTelemetryTasksForTests();

    expect(sharedRedisMockIncr).toHaveBeenCalledWith(
      "analytics:test_api:rate_limit_errors",
    );
  });

  it("returns initializeApiRequest context from request headers on success", async () => {
    const limit = mock().mockResolvedValue({
      success: true,
      limit: 10,
      remaining: 9,
      reset: Date.now() + 10_000,
      pending: Promise.resolve(),
    });
    const limiter = { limit };

    const result = await initializeApiRequest(
      createApiRequest({
        "user-agent": "AniCardsTest/3.0",
        "x-request-id": "req-init-12345",
        "x-vercel-forwarded-for": "198.51.100.42",
        "x-vercel-ip-country": "US",
      }),
      "Test API",
      "test_api",
      limiter as never,
    );

    expect(result.errorResponse).toBeUndefined();
    expect(result.endpoint).toBe("Test API");
    expect(result.endpointKey).toBe("test_api");
    expect(result.ip).toBe("198.51.100.42");
    expect(result.requestId).toBe("req-init-12345");
    expect(typeof result.startTime).toBe("number");
    expect(limit).toHaveBeenCalledWith("198.51.100.42", {
      ip: "198.51.100.42",
      userAgent: "AniCardsTest/3.0",
      country: "US",
    });
  });

  it("short-circuits initializeApiRequest with a request-id aware rate-limit response", async () => {
    const limiter = {
      limit: mock().mockResolvedValue({
        success: false,
        limit: 3,
        remaining: 0,
        reset: Date.now() + 5_000,
        pending: Promise.resolve(),
      }),
    } as never;

    const result = await initializeApiRequest(
      createApiRequest({
        "x-request-id": "req-init-limited-12345",
      }),
      "Test API",
      "test_api",
      limiter,
    );

    await flushScheduledTelemetryTasksForTests();

    expect(result.requestId).toBe("req-init-limited-12345");
    expect(result.errorResponse?.status).toBe(429);
    expect(result.errorResponse?.headers.get("X-Request-Id")).toBe(
      "req-init-limited-12345",
    );
  });

  it("rejects initializeApiRequest when request proof is missing for protected routes", async () => {
    process.env.API_SECRET_TOKEN = "test-request-proof-secret";

    const limiter = {
      limit: mock().mockResolvedValue({
        success: true,
        limit: 10,
        remaining: 9,
        reset: Date.now() + 10_000,
        pending: Promise.resolve(),
      }),
    };

    const result = await initializeApiRequest(
      createApiRequest({
        "user-agent": "AniCardsTest/Protected",
        "x-vercel-forwarded-for": "198.51.100.50",
      }),
      "Test API",
      "test_api",
      limiter as never,
      {
        requireRequestProof: true,
        requireVerifiedClientIp: true,
      },
    );

    expect(result.errorResponse?.status).toBe(401);
  });

  it("accepts initializeApiRequest when request proof matches the verified IP and user agent", async () => {
    process.env.API_SECRET_TOKEN = "test-request-proof-secret";

    const userAgent = "AniCardsTest/Protected";
    const clientIp = "198.51.100.50";
    const token = await createRequestProofToken({
      ip: clientIp,
      userAgent,
    });
    if (!token) {
      throw new Error("Expected request proof token to be generated");
    }

    const limiter = {
      limit: mock().mockResolvedValue({
        success: true,
        limit: 10,
        remaining: 9,
        reset: Date.now() + 10_000,
        pending: Promise.resolve(),
      }),
    };

    const result = await initializeApiRequest(
      createApiRequest({
        cookie: `${REQUEST_PROOF_COOKIE_NAME}=${token}`,
        "user-agent": userAgent,
        "x-vercel-forwarded-for": clientIp,
      }),
      "Test API",
      "test_api",
      limiter as never,
      {
        requireRequestProof: true,
        requireVerifiedClientIp: true,
      },
    );

    expect(result.errorResponse).toBeUndefined();
    expect(result.ip).toBe(clientIp);
  });

  it("builds apiErrorResponse payloads with merged headers and request-id exposure", async () => {
    const response = apiErrorResponse(
      createApiRequest({
        "x-request-id": "req-api-error-12345",
      }),
      422,
      "Invalid filter",
      {
        headers: {
          "Access-Control-Expose-Headers": "X-Debug-Token",
          "X-Debug-Token": "trace-123",
        },
        category: "invalid_data",
        retryable: false,
        additionalFields: {
          field: "username",
        },
      },
    );

    expect(response.status).toBe(422);
    expect(response.headers.get("Access-Control-Allow-Origin")).toBe(
      "http://localhost",
    );
    expect(response.headers.get("X-Debug-Token")).toBe("trace-123");
    expect(response.headers.get("X-Request-Id")).toBe("req-api-error-12345");
    expect(response.headers.get("Access-Control-Expose-Headers")).toContain(
      "X-Debug-Token",
    );
    expect(response.headers.get("Access-Control-Expose-Headers")).toContain(
      "X-Request-Id",
    );

    const body = await response.json();
    expect(body).toMatchObject({
      error: "Invalid filter",
      category: "invalid_data",
      retryable: false,
      status: 422,
      field: "username",
    });
  });

  it("builds invalidJsonResponse payloads with the expected invalid-data contract", async () => {
    const response = invalidJsonResponse(
      createApiRequest({
        "x-request-id": "req-invalid-json-12345",
      }),
      {
        headers: {
          "X-Test-Source": "unit",
        },
      },
    );

    expect(response.status).toBe(400);
    expect(response.headers.get("X-Test-Source")).toBe("unit");
    expect(response.headers.get("X-Request-Id")).toBe("req-invalid-json-12345");

    const body = await response.json();
    expect(body).toMatchObject({
      error: "Invalid JSON body",
      category: "invalid_data",
      retryable: false,
      status: 400,
    });
  });
});
