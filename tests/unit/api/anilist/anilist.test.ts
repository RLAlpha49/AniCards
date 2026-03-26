import { afterEach, beforeEach, describe, expect, it, mock } from "bun:test";

import { USER_ID_QUERY, USER_STATS_QUERY } from "@/lib/anilist/queries";
import { sharedRatelimitMockLimit } from "@/tests/unit/__setup__";

process.env.NEXT_PUBLIC_APP_URL = "http://localhost";

import { OPTIONS, POST } from "@/app/api/anilist/route";

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
    process.env = { ...originalEnv, NEXT_PUBLIC_APP_URL: "http://localhost" };
    sharedRatelimitMockLimit.mockReset();
    sharedRatelimitMockLimit.mockResolvedValue({
      success: true,
      limit: 10,
      remaining: 9,
      reset: Date.now() + 5_000,
      pending: Promise.resolve(),
    });
  });

  afterEach(() => {
    process.env = originalEnv;
    mock.clearAllMocks();
  });

  it("simulates a 429 test response only in development", async () => {
    setEnvironment("development");

    const response = await POST(
      createAniListRequest({
        headers: { "X-Test-Status": "429" },
      }),
    );

    expect(response.status).toBe(429);
    expect(response.headers.get("Retry-After")).toBe("60");
    expect((await response.json()).error).toBe(
      "Rate limited (test simulation)",
    );
  });

  it("accepts the explicit GetUserStats contract and forwards the canonical query", async () => {
    setEnvironment("production", true);
    mockJsonFetch({ data: { User: { id: 123 } } });

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
    const body = JSON.parse(String(init.body));
    expect(body.query).toBe(USER_STATS_QUERY);
    expect(body.variables).toEqual({ userId: 123 });
    expect(init.headers).toMatchObject({
      Authorization: "Bearer dummy-token",
    });
  });

  it("accepts the exact approved GetUserId query for backward compatibility", async () => {
    setEnvironment("production");
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
    const body = JSON.parse(String(init.body));
    expect(body.query).toBe(USER_ID_QUERY);
    expect(body.variables).toEqual({ userName: "testUser" });
  });

  it("rejects unsupported operations", async () => {
    setEnvironment("production");

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
    setEnvironment("production");

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

    const missingOriginResponse = await POST(
      createAniListRequest({
        headers: { origin: "" },
        body: {
          operation: "GetUserStats",
          variables: { userId: 123 },
        },
      }),
    );
    expect(missingOriginResponse.status).toBe(401);

    const crossOriginResponse = await POST(
      createAniListRequest({
        headers: { origin: "https://evil.example" },
        body: {
          operation: "GetUserStats",
          variables: { userId: 123 },
        },
      }),
    );
    expect(crossOriginResponse.status).toBe(401);
    expect(globalThis.fetch).not.toHaveBeenCalled();
  });

  it("fails closed when NEXT_PUBLIC_APP_URL is missing in production", async () => {
    setEnvironment("production");
    delete process.env.NEXT_PUBLIC_APP_URL;

    const response = await POST(
      createAniListRequest({
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
    setEnvironment("production");
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
  });

  it("returns GraphQL payload errors as 500s", async () => {
    setEnvironment("production");
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
    setEnvironment("production");
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

  it("handles invalid JSON request bodies gracefully", async () => {
    setEnvironment("production");

    const response = await POST(
      new Request(BASE_URL, {
        method: "POST",
        headers: {
          origin: "http://localhost",
          "Content-Type": "application/json",
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
});
