import { afterEach, beforeEach, describe, expect, it, mock } from "bun:test";

import { OPTIONS, POST } from "@/app/api/anilist/route";
import { USER_ID_QUERY, USER_STATS_QUERY } from "@/lib/anilist/queries";
import {
  createRequestProofToken,
  REQUEST_PROOF_COOKIE_NAME,
} from "@/lib/api/request-proof";
import { flushScheduledTelemetryTasksForTests } from "@/lib/api/telemetry";
import {
  allowConsoleWarningsAndErrors,
  captureSharedRedisIncrCalls,
  captureSharedRedisRpushCalls,
  parseRequestInitJson,
  sharedRatelimitMockLimit,
  sharedRedisMockGet,
  sharedRedisMockIncr,
  sharedRedisMockLtrim,
  sharedRedisMockRpush,
} from "@/tests/unit/__setup__";

process.env.NEXT_PUBLIC_APP_URL = "http://localhost";

const BASE_URL = "http://localhost/api/anilist";

function createAniListRequest(options?: {
  body?: Record<string, unknown>;
  headers?: Record<string, string>;
}) {
  const extraHeaders = options?.headers;
  return new Request(BASE_URL, {
    method: "POST",
    headers: new Headers({
      "Content-Type": "application/json",
      origin: "http://localhost",
      "x-vercel-forwarded-for": "127.0.0.1",
      ...extraHeaders,
    }),
    body: JSON.stringify(options?.body ?? {}),
  });
}

function setEnvironment(
  nodeEnv: "development" | "production" | "test",
  includeToken = false,
) {
  process.env = { ...process.env, NODE_ENV: nodeEnv };
  if (includeToken) {
    process.env.ANILIST_TOKEN = "dummy-token";
  } else {
    delete process.env.ANILIST_TOKEN;
  }
}

async function createRequestProofCookie(): Promise<string> {
  const token = await createRequestProofToken({ ip: "127.0.0.1" });
  if (!token) {
    throw new Error("Expected request proof token to be generated");
  }

  return `${REQUEST_PROOF_COOKIE_NAME}=${token}`;
}

function mockJsonFetch(
  payload: unknown,
  init: {
    headers?: Record<string, string>;
    status?: number;
  } = {},
) {
  const extraHeaders = init.headers;
  const response = new Response(JSON.stringify(payload), {
    status: init.status ?? 200,
    headers: {
      "Content-Type": "application/json",
      ...extraHeaders,
    },
  });

  globalThis.fetch = mock(() =>
    Promise.resolve(response),
  ) as unknown as typeof fetch;
}

describe("AniList API Route", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    allowConsoleWarningsAndErrors();
    process.env = {
      ...originalEnv,
      NEXT_PUBLIC_APP_URL: "http://localhost",
      NODE_ENV: "test",
    };
    sharedRatelimitMockLimit.mockReset();
    sharedRedisMockGet.mockReset();
    sharedRedisMockIncr.mockReset();
    sharedRedisMockRpush.mockReset();
    sharedRedisMockLtrim.mockReset();
    sharedRatelimitMockLimit.mockResolvedValue({
      success: true,
      limit: 10,
      remaining: 9,
      reset: Date.now() + 5_000,
      pending: Promise.resolve(),
    });
    sharedRedisMockGet.mockResolvedValue(null);
    sharedRedisMockIncr.mockResolvedValue(1);
    sharedRedisMockRpush.mockResolvedValue(1);
    sharedRedisMockLtrim.mockResolvedValue("OK");
  });

  afterEach(async () => {
    await flushScheduledTelemetryTasksForTests();
    process.env = originalEnv;
    mock.clearAllMocks();
  });

  it("simulates a 429 test response only in development", async () => {
    setEnvironment("development");
    const requestProofCookie = await createRequestProofCookie();

    const response = await POST(
      createAniListRequest({
        headers: {
          cookie: requestProofCookie,
          "X-Test-Status": "429",
        },
      }),
    );

    expect(response.status).toBe(429);
    expect(response.headers.get("Retry-After")).toBe("60");
    expect((await response.json()).error).toBe(
      "Rate limited (test simulation)",
    );
  });

  it("accepts the explicit GetUserStats contract and forwards the canonical query", async () => {
    setEnvironment("test", true);
    const capturedIncr = captureSharedRedisIncrCalls();
    mockJsonFetch({ data: { User: { id: 123 } } });

    try {
      const response = await POST(
        createAniListRequest({
          body: {
            operation: "GetUserStats",
            variables: { userId: 123 },
          },
        }),
      );

      expect(response.status).toBe(200);
      expect(await response.json()).toEqual({ User: { id: 123 } });

      const [, init] = (globalThis.fetch as unknown as ReturnType<typeof mock>)
        .mock.calls[0] as [string, RequestInit];
      const body = parseRequestInitJson<{
        query: string;
        variables: Record<string, unknown>;
      }>(init);
      expect(body.query).toBe(USER_STATS_QUERY);
      expect(body.variables).toEqual({ userId: 123 });
      expect(init.headers).toMatchObject({
        Authorization: "Bearer dummy-token",
      });

      await flushScheduledTelemetryTasksForTests();
      expect(capturedIncr.calls).toContainEqual([
        "analytics:anilist_api:successful_requests",
      ]);
    } finally {
      capturedIncr.release();
    }
  });

  it("accepts the exact approved GetUserId query for backward compatibility", async () => {
    setEnvironment("test");
    mockJsonFetch({ data: { User: { id: 99 } } });

    const response = await POST(
      createAniListRequest({
        body: {
          query: USER_ID_QUERY,
          variables: { userName: "testUser" },
        },
      }),
    );

    expect(response.status).toBe(200);

    const [, init] = (globalThis.fetch as unknown as ReturnType<typeof mock>)
      .mock.calls[0] as [string, RequestInit];
    const body = parseRequestInitJson<{
      query: string;
      variables: Record<string, unknown>;
    }>(init);
    expect(body.query).toBe(USER_ID_QUERY);
    expect(body.variables).toEqual({ userName: "testUser" });
  });

  it("accepts the explicit GetUserId contract and forwards the canonical query", async () => {
    setEnvironment("test");
    mockJsonFetch({ data: { User: { id: 99 } } });

    const response = await POST(
      createAniListRequest({
        body: {
          operation: "GetUserId",
          variables: { userName: "testUser" },
        },
      }),
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ User: { id: 99 } });

    const [, init] = (globalThis.fetch as unknown as ReturnType<typeof mock>)
      .mock.calls[0] as [string, RequestInit];
    const body = parseRequestInitJson<{
      query: string;
      variables: Record<string, unknown>;
    }>(init);
    expect(body.query).toBe(USER_ID_QUERY);
    expect(body.variables).toEqual({ userName: "testUser" });
  });

  it("rejects unsupported operations", async () => {
    setEnvironment("test");

    const response = await POST(
      createAniListRequest({
        body: {
          query: "query TotallyUnsupported { Viewer { id } }",
          variables: {},
        },
      }),
    );

    expect(response.status).toBe(400);
    expect((await response.json()).error).toContain(
      "Unsupported AniList operation",
    );
    expect(globalThis.fetch).not.toHaveBeenCalled();
  });

  it("rejects invalid user identifiers before contacting AniList", async () => {
    setEnvironment("test");

    const invalidUserIdResponse = await POST(
      createAniListRequest({
        body: {
          operation: "GetUserStats",
          variables: { userId: -1 },
        },
      }),
    );
    expect(invalidUserIdResponse.status).toBe(400);
    expect((await invalidUserIdResponse.json()).error).toContain(
      "Invalid AniList userId",
    );

    const invalidUserNameResponse = await POST(
      createAniListRequest({
        body: {
          operation: "GetUserId",
          variables: { userName: "   " },
        },
      }),
    );
    expect(invalidUserNameResponse.status).toBe(400);
    expect((await invalidUserNameResponse.json()).error).toContain(
      "Invalid AniList username",
    );
    expect(globalThis.fetch).not.toHaveBeenCalled();
  });

  it("rejects missing or mismatched origins for browser-facing mutations", async () => {
    setEnvironment("production");
    process.env.API_SECRET_TOKEN = "test-request-proof-secret";
    const requestProofCookie = await createRequestProofCookie();

    const missingOriginResponse = await POST(
      createAniListRequest({
        headers: { cookie: requestProofCookie, origin: "" },
        body: {
          operation: "GetUserStats",
          variables: { userId: 123 },
        },
      }),
    );
    expect(missingOriginResponse.status).toBe(401);

    const crossOriginResponse = await POST(
      createAniListRequest({
        headers: {
          cookie: requestProofCookie,
          origin: "https://evil.example",
        },
        body: {
          operation: "GetUserStats",
          variables: { userId: 123 },
        },
      }),
    );
    expect(crossOriginResponse.status).toBe(401);
    expect(globalThis.fetch).not.toHaveBeenCalled();
  });

  it("rejects requests without request proof when API_SECRET_TOKEN is configured", async () => {
    setEnvironment("production");
    process.env.API_SECRET_TOKEN = "test-request-proof-secret";

    const response = await POST(
      createAniListRequest({
        body: {
          operation: "GetUserStats",
          variables: { userId: 123 },
        },
      }),
    );

    expect(response.status).toBe(401);
    expect((await response.json()).error).toBe("Unauthorized");
    expect(globalThis.fetch).not.toHaveBeenCalled();
  });

  it("fails closed when NEXT_PUBLIC_APP_URL is missing in production", async () => {
    setEnvironment("production");
    process.env.API_SECRET_TOKEN = "test-request-proof-secret";
    const requestProofCookie = await createRequestProofCookie();
    delete process.env.NEXT_PUBLIC_APP_URL;

    const response = await POST(
      createAniListRequest({
        headers: { cookie: requestProofCookie },
        body: {
          operation: "GetUserStats",
          variables: { userId: 123 },
        },
      }),
    );

    expect(response.status).toBe(503);
    expect((await response.json()).error).toBe("Server misconfigured");
    expect(globalThis.fetch).not.toHaveBeenCalled();
  });

  it("surfaces non-retried AniList HTTP errors", async () => {
    setEnvironment("test");
    const capturedIncr = captureSharedRedisIncrCalls();
    const capturedRpush = captureSharedRedisRpushCalls();

    try {
      mockJsonFetch(
        { error: "Invalid query" },
        {
          status: 400,
        },
      );

      const response = await POST(
        createAniListRequest({
          body: {
            operation: "GetUserStats",
            variables: { userId: 123 },
          },
        }),
      );

      expect(response.status).toBe(400);
      expect((await response.json()).error).toContain("Invalid query");

      await flushScheduledTelemetryTasksForTests();
      expect(capturedIncr.calls).toContainEqual([
        "analytics:anilist_api:failed_requests",
      ]);

      const errorReportCall = capturedRpush.calls.find(
        ([key]) => key === "telemetry:error-reports:v1",
      );
      expect(errorReportCall).toBeDefined();
      expect(errorReportCall).toEqual([
        "telemetry:error-reports:v1",
        expect.any(String),
      ]);
    } finally {
      capturedIncr.release();
      capturedRpush.release();
    }
  });

  it("returns GraphQL payload errors as 500s", async () => {
    setEnvironment("test");
    mockJsonFetch({ errors: [{ message: "User not found" }] });

    const response = await POST(
      createAniListRequest({
        body: {
          operation: "GetUserStats",
          variables: { userId: 123 },
        },
      }),
    );

    expect(response.status).toBe(500);
    expect((await response.json()).error).toBe("User not found");
  });

  it("wraps upstream transport failures", async () => {
    setEnvironment("test");
    globalThis.fetch = mock(() =>
      Promise.reject(new Error("Network error")),
    ) as unknown as typeof fetch;

    const response = await POST(
      createAniListRequest({
        body: {
          operation: "GetUserStats",
          variables: { userId: 123 },
        },
      }),
    );

    expect(response.status).toBe(502);
    expect((await response.json()).error).toContain("Network error");
  });

  it("surfaces upstream timeouts as 504 responses", async () => {
    setEnvironment("test");
    globalThis.fetch = mock(() =>
      Promise.reject(new DOMException("Timed out", "TimeoutError")),
    ) as unknown as typeof fetch;

    const response = await POST(
      createAniListRequest({
        body: {
          operation: "GetUserStats",
          variables: { userId: 123 },
        },
      }),
    );

    expect(response.status).toBe(504);
    expect((await response.json()).error).toContain("timed out");
  });

  it("propagates Retry-After when the shared upstream circuit is already open", async () => {
    setEnvironment("test");

    const openedUntil = Date.now() + 30_000;
    sharedRedisMockGet.mockImplementation((key: string) => {
      if (key === "upstream:circuit:anilist-graphql:opened-until") {
        return Promise.resolve(String(openedUntil));
      }

      return Promise.resolve(null);
    });

    globalThis.fetch = mock(() =>
      Promise.resolve(
        new Response(JSON.stringify({ data: { User: { id: 123 } } }), {
          status: 200,
          headers: {
            "Content-Type": "application/json",
          },
        }),
      ),
    ) as unknown as typeof fetch;

    const response = await POST(
      createAniListRequest({
        body: {
          operation: "GetUserStats",
          variables: { userId: 123 },
        },
      }),
    );

    expect(response.status).toBe(503);
    expect(response.headers.get("Retry-After")).toBeTruthy();
    expect(globalThis.fetch).not.toHaveBeenCalled();

    const body = (await response.json()) as { error: string };
    expect(body.error).toContain("circuit breaker is open");
  });

  it("handles invalid JSON request bodies gracefully", async () => {
    setEnvironment("test");

    const response = await POST(
      new Request(BASE_URL, {
        method: "POST",
        headers: {
          origin: "http://localhost",
          "Content-Type": "application/json",
          "x-vercel-forwarded-for": "127.0.0.1",
        },
        body: "{ invalid json",
      }),
    );

    const payload = await response.json();
    expect(response.status).toBe(400);
    expect(payload.error).toBe("Invalid JSON body");
    expect(payload.category).toBe("invalid_data");
  });

  it("returns CORS headers on OPTIONS", () => {
    const response = OPTIONS(
      new Request(BASE_URL, {
        method: "OPTIONS",
        headers: { origin: "http://localhost" },
      }),
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("Access-Control-Allow-Origin")).toBe(
      "http://localhost",
    );
    expect(response.headers.get("Access-Control-Allow-Methods")).toContain(
      "POST",
    );
  });

  it("echoes X-Request-Id on successful responses", async () => {
    setEnvironment("test");
    mockJsonFetch({ data: { User: { id: 123 } } });

    const response = await POST(
      createAniListRequest({
        headers: { "x-request-id": "req-anilist-12345" },
        body: {
          operation: "GetUserStats",
          variables: { userId: 123 },
        },
      }),
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("X-Request-Id")).toBe("req-anilist-12345");
    expect(response.headers.get("Access-Control-Expose-Headers")).toContain(
      "X-Request-Id",
    );
  });
});
