import { afterEach, beforeEach, describe, expect, it, mock } from "bun:test";

import {
  ANALYTICS_COUNTER_TTL_SECONDS,
  buildAnalyticsStorageKey,
  checkRateLimit,
  getRequestIp,
  handleError,
  incrementAnalytics,
  incrementAnalyticsBatch,
  readJsonRequestBody,
  validateSameOrigin,
} from "@/lib/api-utils";
import {
  allowConsoleWarningsAndErrors,
  sharedRedisMockExpire,
  sharedRedisMockIncr,
  sharedRedisMockIncrRaw,
  sharedRedisMockPipeline,
  sharedRedisMockPipelineExec,
} from "@/tests/unit/__setup__";

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
  });

  afterEach(() => {
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
});
