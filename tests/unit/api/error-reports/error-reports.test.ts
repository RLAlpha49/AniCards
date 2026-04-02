import { afterEach, beforeEach, describe, expect, it, mock } from "bun:test";

import { OPTIONS, POST } from "@/app/api/error-reports/route";
import {
  createRequestProofToken,
  REQUEST_PROOF_COOKIE_NAME,
} from "@/lib/api/request-proof";
import { ERROR_REPORT_REQUEST_MAX_BYTES } from "@/lib/error-tracking";
import {
  allowConsoleWarningsAndErrors,
  sharedRatelimitMockLimit,
  sharedRatelimitMockSlidingWindow,
  sharedRedisMockLtrim,
  sharedRedisMockRpush,
} from "@/tests/unit/__setup__";

process.env.NEXT_PUBLIC_APP_URL = "http://localhost";

const BASE_URL = "http://localhost/api/error-reports";

function createRequest(
  body?: Record<string, unknown>,
  headers?: Record<string, string>,
) {
  return createRawRequest(
    JSON.stringify(
      body ?? {
        source: "react_error_boundary",
        userAction: "render_component_tree",
        message: "Failed to fetch user Alex profile",
        route: "/user/Alex?tab=cards",
      },
    ),
    headers,
  );
}

function createRawRequest(body: string, headers?: Record<string, string>) {
  return new Request(BASE_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      origin: "http://localhost",
      ...headers,
    },
    body,
  });
}

describe("error reports API route", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    allowConsoleWarningsAndErrors();
    process.env = { ...originalEnv, NEXT_PUBLIC_APP_URL: "http://localhost" };
    sharedRatelimitMockLimit.mockReset();
    sharedRedisMockRpush.mockReset();
    sharedRedisMockLtrim.mockReset();
    sharedRatelimitMockLimit.mockResolvedValue({
      success: true,
      limit: 10,
      remaining: 9,
      reset: Date.now() + 5_000,
      pending: Promise.resolve(),
    });
    sharedRedisMockRpush.mockResolvedValue(1);
    sharedRedisMockLtrim.mockResolvedValue("OK");
  });

  afterEach(() => {
    process.env = originalEnv;
    mock.clearAllMocks();
  });

  it("uses a dedicated 3 requests / 10 seconds limiter", () => {
    expect(sharedRatelimitMockSlidingWindow).toHaveBeenCalledWith(3, "10 s");
  });

  it("ignores spoofed client identifiers and persists the sanitized report", async () => {
    const response = await POST(
      createRequest({
        source: "react_error_boundary",
        userAction: "render_component_tree",
        message: "Failed to fetch user Alex profile",
        route: "/user/Alex?tab=cards",
        userId: "999999",
        username: "SpoofedUser",
      }),
    );
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload).toEqual({ recorded: true });

    expect(sharedRedisMockRpush).toHaveBeenCalledWith(
      "telemetry:error-reports:v1",
      expect.any(String),
    );

    const serializedReport = sharedRedisMockRpush.mock.calls[0]?.[1] as string;
    const report = JSON.parse(serializedReport) as {
      route?: string;
      source: string;
      category: string;
    };

    expect(report.route).toBe("/user/[username]");
    expect(report.source).toBe("react_error_boundary");
    expect(report.category).toBe("network_error");
    expect(report).not.toHaveProperty("userId");
    expect(report).not.toHaveProperty("username");
  });

  it("persists the resolved request ID in the structured report", async () => {
    const response = await POST(
      createRequest(undefined, {
        "x-request-id": "req-error-route-12345",
      }),
    );

    expect(response.status).toBe(200);

    const serializedReport = sharedRedisMockRpush.mock.calls.at(-1)?.[1] as
      | string
      | undefined;
    const report = JSON.parse(String(serializedReport)) as {
      requestId?: string;
    };

    expect(report.requestId).toBe("req-error-route-12345");
  });

  it("prefers payload request IDs when the client cannot rely on headers alone", async () => {
    const response = await POST(
      createRequest(
        {
          source: "react_error_boundary",
          userAction: "render_component_tree",
          message: "Failed to fetch user Alex profile",
          requestId: "req-payload-12345",
          route: "/user/Alex?tab=cards",
        },
        {
          "x-request-id": "req-ingestion-99999",
        },
      ),
    );

    expect(response.status).toBe(200);

    const serializedReport = sharedRedisMockRpush.mock.calls.at(-1)?.[1] as
      | string
      | undefined;
    const report = JSON.parse(String(serializedReport)) as {
      requestId?: string;
    };

    expect(report.requestId).toBe("req-payload-12345");
  });

  it("persists structured API error facts supplied by the client payload", async () => {
    const response = await POST(
      createRequest(
        {
          source: "client_hook",
          userAction: "user_page_load",
          message:
            "Conflict: data was updated elsewhere. Please reload and try again.",
          category: "invalid_data",
          retryable: false,
          requestId: "req-structured-client-12345",
          route: "/user/Alex?tab=cards",
          statusCode: 409,
          recoverySuggestions: [
            {
              title: "Reload the page",
              description: "Refresh the page to load the latest saved data.",
              actionLabel: "Reload",
            },
          ],
          metadata: {
            currentUpdatedAt: "2026-04-02T12:34:56.000Z",
          },
        },
        {
          "x-request-id": "req-ingestion-99999",
        },
      ),
    );

    expect(response.status).toBe(200);

    const serializedReport = sharedRedisMockRpush.mock.calls.at(-1)?.[1] as
      | string
      | undefined;
    const report = JSON.parse(String(serializedReport)) as {
      category: string;
      retryable: boolean;
      requestId?: string;
      route?: string;
      statusCode?: number;
      suggestions: Array<{
        title: string;
        description: string;
        actionLabel?: string;
      }>;
      metadata?: Record<string, string>;
    };

    expect(report.category).toBe("invalid_data");
    expect(report.retryable).toBe(false);
    expect(report.requestId).toBe("req-structured-client-12345");
    expect(report.route).toBe("/user/[username]");
    expect(report.statusCode).toBe(409);
    expect(report.suggestions).toEqual([
      {
        title: "Reload the page",
        description: "Refresh the page to load the latest saved data.",
        actionLabel: "Reload",
      },
    ]);
    expect(report.metadata?.currentUpdatedAt).toBe("2026-04-02T12:34:56.000Z");
  });

  it("returns 429 when the dedicated error-report limiter is exceeded", async () => {
    sharedRatelimitMockLimit.mockResolvedValueOnce({
      success: false,
      limit: 3,
      remaining: 0,
      reset: Date.now() + 5_000,
      pending: Promise.resolve(),
    });

    const response = await POST(createRequest());

    expect(response.status).toBe(429);
    expect((await response.json()).error).toBe("Too many requests");
    expect(sharedRedisMockRpush).not.toHaveBeenCalled();
  });

  it("rejects missing request proof when API_SECRET_TOKEN is configured", async () => {
    process.env.API_SECRET_TOKEN = "test-request-proof-secret";

    const response = await POST(createRequest());

    expect(response.status).toBe(401);
    expect((await response.json()).error).toBe("Unauthorized");
    expect(sharedRedisMockRpush).not.toHaveBeenCalled();
  });

  it("accepts authenticated error reports when a valid request proof cookie is present", async () => {
    process.env.API_SECRET_TOKEN = "test-request-proof-secret";

    const token = await createRequestProofToken({ ip: "127.0.0.1" });
    if (!token) {
      throw new Error("Expected request proof token to be generated");
    }

    const response = await POST(
      createRequest(undefined, {
        cookie: `${REQUEST_PROOF_COOKIE_NAME}=${token}`,
      }),
    );

    expect(response.status).toBe(200);
  });

  it("rejects oversized JSON payloads before validation or persistence", async () => {
    const response = await POST(
      createRawRequest(
        JSON.stringify({
          source: "react_error_boundary",
          userAction: "render_component_tree",
          message: "x".repeat(ERROR_REPORT_REQUEST_MAX_BYTES),
        }),
      ),
    );

    expect(response.status).toBe(413);
    expect((await response.json()).error).toBe("Request body too large");
    expect(sharedRedisMockRpush).not.toHaveBeenCalled();
  });

  it("waits for durable error persistence before returning success", async () => {
    let resolveRpush: ((value: number) => void) | undefined;
    let persistenceStarted = false;

    sharedRedisMockRpush.mockImplementationOnce(() => {
      persistenceStarted = true;

      return new Promise<number>((resolve) => {
        resolveRpush = resolve;
      });
    });

    let responseSettled = false;
    const responsePromise = POST(createRequest()).then((response) => {
      responseSettled = true;
      return response;
    });

    for (let attempt = 0; attempt < 10 && !persistenceStarted; attempt += 1) {
      await Promise.resolve();
    }

    expect(persistenceStarted).toBe(true);
    expect(responseSettled).toBe(false);
    expect(sharedRedisMockRpush).toHaveBeenCalledWith(
      "telemetry:error-reports:v1",
      expect.any(String),
    );
    expect(sharedRedisMockLtrim).not.toHaveBeenCalled();

    resolveRpush?.(1);

    const response = await responsePromise;

    expect(sharedRedisMockLtrim).toHaveBeenCalledWith(
      "telemetry:error-reports:v1",
      -250,
      -1,
    );
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ recorded: true });
  });

  it("returns 503 when durable error persistence is temporarily unavailable", async () => {
    sharedRedisMockRpush.mockRejectedValueOnce(
      new Error("Upstash Redis connection failed"),
    );

    const response = await POST(createRequest());

    expect(response.status).toBe(503);
    expect(await response.json()).toMatchObject({
      error: "Structured error reporting is temporarily unavailable",
      category: "server_error",
      retryable: true,
      status: 503,
    });
  });

  it("rejects missing required fields", async () => {
    const response = await POST(
      createRequest({
        source: "react_error_boundary",
      }),
    );

    expect(response.status).toBe(400);
    expect((await response.json()).error).toBe("Invalid error report payload");
  });

  it("persists redacted error text and minimized metadata", async () => {
    const response = await POST(
      createRequest({
        source: "react_error_boundary",
        userAction: "render_component_tree",
        message:
          "Failed request for alex@example.com with token=super-secret-token-value-1234567890",
        route: "/user/Alex?token=secret",
        metadata: {
          authToken: "super-secret-token-value-1234567890",
          boundary: "client_error_boundary",
          email: "alex@example.com",
          note: "retry email=alex@example.com token=super-secret-token-value-1234567890",
        },
      }),
    );

    expect(response.status).toBe(200);

    const serializedReport = sharedRedisMockRpush.mock.calls.at(-1)?.[1] as
      | string
      | undefined;
    const report = JSON.parse(String(serializedReport)) as {
      metadata?: Record<string, string>;
      route?: string;
      technicalMessage: string;
    };

    expect(report.route).toBe("/user/[username]");
    expect(report.metadata?.boundary).toBe("client_error_boundary");
    expect(report.metadata).not.toHaveProperty("authToken");
    expect(report.metadata).not.toHaveProperty("email");
    expect(report.technicalMessage).not.toContain("alex@example.com");
    expect(report.technicalMessage).not.toContain(
      "super-secret-token-value-1234567890",
    );
    expect(JSON.stringify(report)).not.toContain("token=secret");
  });

  it("returns the expected CORS headers on OPTIONS", () => {
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
    expect(response.headers.get("Access-Control-Allow-Headers")).toContain(
      "X-Request-Id",
    );
    expect(response.headers.get("Access-Control-Allow-Methods")).toContain(
      "POST",
    );
  });
});
