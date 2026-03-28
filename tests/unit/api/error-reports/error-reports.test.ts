import { afterEach, beforeEach, describe, expect, it, mock } from "bun:test";

import {
  allowConsoleWarningsAndErrors,
  sharedRatelimitMockLimit,
  sharedRatelimitMockSlidingWindow,
  sharedRedisMockLtrim,
  sharedRedisMockRpush,
} from "@/tests/unit/__setup__";

process.env.NEXT_PUBLIC_APP_URL = "http://localhost";

import { OPTIONS, POST } from "@/app/api/error-reports/route";

const BASE_URL = "http://localhost/api/error-reports";

function createRequest(
  body?: Record<string, unknown>,
  headers?: Record<string, string>,
) {
  return new Request(BASE_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      origin: "http://localhost",
      ...headers,
    },
    body: JSON.stringify(
      body ?? {
        source: "react_error_boundary",
        userAction: "render_component_tree",
        message: "Failed to fetch user Alex profile",
        route: "/user/Alex?tab=cards",
      },
    ),
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

    expect(response.status).toBe(202);
    expect(payload).toEqual({ accepted: true });
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

  it("rejects missing required fields", async () => {
    const response = await POST(
      createRequest({
        source: "react_error_boundary",
      }),
    );

    expect(response.status).toBe(400);
    expect((await response.json()).error).toBe("Invalid error report payload");
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
    expect(response.headers.get("Access-Control-Allow-Methods")).toContain(
      "POST",
    );
  });
});
