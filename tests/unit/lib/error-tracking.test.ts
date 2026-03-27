import { afterEach, beforeEach, describe, expect, it, mock } from "bun:test";

import { trackUserActionError } from "@/lib/error-tracking";
import {
  allowConsoleWarningsAndErrors,
  sharedRedisMockLtrim,
  sharedRedisMockRpush,
} from "@/tests/unit/__setup__";

describe("error tracking", () => {
  const originalWindow = globalThis.window;
  const originalLocation = globalThis.location;
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    allowConsoleWarningsAndErrors();
    sharedRedisMockRpush.mockReset();
    sharedRedisMockLtrim.mockReset();
    sharedRedisMockRpush.mockResolvedValue(1);
    sharedRedisMockLtrim.mockResolvedValue("OK");

    Object.defineProperty(globalThis, "window", {
      value: undefined,
      configurable: true,
      writable: true,
    });
    Object.defineProperty(globalThis, "location", {
      value: undefined,
      configurable: true,
      writable: true,
    });
  });

  afterEach(() => {
    Object.defineProperty(globalThis, "window", {
      value: originalWindow,
      configurable: true,
      writable: true,
    });
    Object.defineProperty(globalThis, "location", {
      value: originalLocation,
      configurable: true,
      writable: true,
    });
    Object.defineProperty(globalThis, "fetch", {
      value: originalFetch,
      configurable: true,
      writable: true,
    });
    mock.clearAllMocks();
  });

  it("persists structured server reports to Redis", async () => {
    const report = await trackUserActionError(
      "user_page_load",
      new Error("Failed to fetch user Alex profile"),
      "network_error",
      {
        userId: "12345",
        username: "Alex",
        source: "client_hook",
      },
    );

    expect(report).not.toBeNull();
    expect(sharedRedisMockRpush).toHaveBeenCalledWith(
      "telemetry:error-reports:v1",
      expect.any(String),
    );
    expect(sharedRedisMockLtrim).toHaveBeenCalledWith(
      "telemetry:error-reports:v1",
      -250,
      -1,
    );

    const serializedReport = sharedRedisMockRpush.mock.calls[0]?.[1] as string;
    const payload = JSON.parse(serializedReport) as {
      category: string;
      retryable: boolean;
      userMessage: string;
      userId?: string;
      username?: string;
    };

    expect(payload.category).toBe("network_error");
    expect(payload.retryable).toBe(true);
    expect(payload.userMessage).toBe("Network connection error");
    expect(payload.userId).toBe("id:***45");
    expect(payload.username).toBe("Al***(4)");
  });

  it("sanitizes stack traces before persisting server reports", async () => {
    const report = await trackUserActionError(
      "render_component_tree",
      new Error("Top-level render failed"),
      "server_error",
      {
        source: "api_route",
        stack:
          "Error: leaked\n    at renderUser (/Users/Alex/private/project/file.ts:10:5)\n    at fetchProfile (https://example.com/profile?token=secret:2:3)",
        componentStack:
          "    at UserPage (http://localhost:3000/app/user/page.tsx:10:5)\n    at Layout (http://localhost:3000/app/layout.tsx:20:2)",
      },
    );

    expect(report).not.toBeNull();
    expect(report?.stack).toBe("at renderUser\nat fetchProfile");
    expect(report?.componentStack).toBe("at UserPage\nat Layout");

    const serializedReport = sharedRedisMockRpush.mock.calls.at(-1)?.[1];
    const payload = JSON.parse(String(serializedReport)) as {
      stack?: string;
      componentStack?: string;
    };

    expect(payload.stack).toBe("at renderUser\nat fetchProfile");
    expect(payload.componentStack).toBe("at UserPage\nat Layout");
    expect(JSON.stringify(payload)).not.toContain("/Users/Alex/private");
    expect(JSON.stringify(payload)).not.toContain("http://localhost:3000");
    expect(JSON.stringify(payload)).not.toContain("token=secret");
  });

  it("uses the client ingestion route when running in the browser", async () => {
    const fetchMock = mock(() =>
      Promise.resolve(new Response(null, { status: 202 })),
    );

    Object.defineProperty(globalThis, "window", {
      value: {} as Window,
      configurable: true,
      writable: true,
    });
    Object.defineProperty(globalThis, "location", {
      value: new URL("https://anicards.test/user/Alex?tab=cards"),
      configurable: true,
      writable: true,
    });
    Object.defineProperty(globalThis, "fetch", {
      value: fetchMock,
      configurable: true,
      writable: true,
    });

    await trackUserActionError(
      "render_component_tree",
      new Error("Failed to fetch user Alex profile"),
      "network_error",
      { source: "react_error_boundary" },
    );

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/error-reports",
      expect.objectContaining({
        method: "POST",
        keepalive: true,
      }),
    );
    expect(sharedRedisMockRpush).not.toHaveBeenCalled();
  });

  it("sends sanitized stacks to the client ingestion route", async () => {
    const fetchMock = mock(() =>
      Promise.resolve(new Response(null, { status: 202 })),
    );

    Object.defineProperty(globalThis, "window", {
      value: {} as Window,
      configurable: true,
      writable: true,
    });
    Object.defineProperty(globalThis, "location", {
      value: new URL("https://anicards.test/user/Alex?tab=cards"),
      configurable: true,
      writable: true,
    });
    Object.defineProperty(globalThis, "fetch", {
      value: fetchMock,
      configurable: true,
      writable: true,
    });

    await trackUserActionError(
      "render_component_tree",
      new Error("Failed to fetch user Alex profile"),
      "network_error",
      {
        source: "react_error_boundary",
        stack:
          "Error: leaked\n    at renderUser (/Users/Alex/private/project/file.ts:10:5)\n    at fetchProfile (https://example.com/profile?token=secret:2:3)",
        componentStack:
          "    at UserPage (http://localhost:3000/app/user/page.tsx:10:5)\n    at Layout (http://localhost:3000/app/layout.tsx:20:2)",
      },
    );

    const firstFetchCall = fetchMock.mock.calls[0] as unknown[] | undefined;
    expect(firstFetchCall).toBeTruthy();

    const requestInit = firstFetchCall?.[1];
    expect(requestInit).toBeTruthy();

    if (!requestInit || typeof requestInit !== "object") {
      throw new Error("Expected mocked fetch to receive a RequestInit object");
    }

    const payload = JSON.parse(String((requestInit as RequestInit).body)) as {
      stack?: string;
      componentStack?: string;
    };

    expect(payload.stack).toBe("at renderUser\nat fetchProfile");
    expect(payload.componentStack).toBe("at UserPage\nat Layout");
    expect(JSON.stringify(payload)).not.toContain("/Users/Alex/private");
    expect(JSON.stringify(payload)).not.toContain("http://localhost:3000");
    expect(JSON.stringify(payload)).not.toContain("token=secret");
  });
});
