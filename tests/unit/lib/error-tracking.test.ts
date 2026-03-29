import { afterEach, beforeEach, describe, expect, it, mock } from "bun:test";

import {
  getErrorReportBufferSnapshot,
  trackUserActionError,
} from "@/lib/error-tracking";
import {
  allowConsoleWarningsAndErrors,
  sharedRedisMockIncr,
  sharedRedisMockLtrim,
  sharedRedisMockMget,
  sharedRedisMockRpush,
} from "@/tests/unit/__setup__";

describe("error tracking", () => {
  const originalWindow = globalThis.window;
  const originalLocation = globalThis.location;
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    allowConsoleWarningsAndErrors();
    sharedRedisMockIncr.mockReset();
    sharedRedisMockMget.mockReset();
    sharedRedisMockRpush.mockReset();
    sharedRedisMockLtrim.mockReset();
    sharedRedisMockIncr.mockResolvedValue(1);
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
    expect(sharedRedisMockIncr).toHaveBeenCalledWith(
      "telemetry:error-reports:v1:total",
    );

    const serializedReport = sharedRedisMockRpush.mock.calls[0]?.[1] as string;
    const payload = JSON.parse(serializedReport) as {
      category: string;
      retryable: boolean;
      userMessage: string;
    };

    expect(payload.category).toBe("network_error");
    expect(payload.retryable).toBe(true);
    expect(payload.userMessage).toBe("Network connection error");
    expect(report).not.toHaveProperty("userId");
    expect(report).not.toHaveProperty("username");
    expect(payload).not.toHaveProperty("userId");
    expect(payload).not.toHaveProperty("username");
  });

  it("promotes request IDs into top-level structured reports", async () => {
    const report = await trackUserActionError(
      "user_page_load",
      new Error("Failed to fetch user Alex profile"),
      "network_error",
      {
        requestId: "req-track-12345",
        source: "client_hook",
      },
    );

    expect(report?.requestId).toBe("req-track-12345");

    const serializedReport = sharedRedisMockRpush.mock.calls.at(-1)?.[1] as
      | string
      | undefined;
    const payload = JSON.parse(String(serializedReport)) as {
      requestId?: string;
    };

    expect(payload.requestId).toBe("req-track-12345");
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

  it("increments the dropped counter when the ring buffer rolls over", async () => {
    sharedRedisMockRpush.mockResolvedValueOnce(251);

    await trackUserActionError(
      "render_component_tree",
      new Error("Ring buffer overflow during spike"),
      "server_error",
      { source: "api_route" },
    );

    expect(sharedRedisMockIncr).toHaveBeenCalledWith(
      "telemetry:error-reports:v1:total",
    );
    expect(sharedRedisMockIncr).toHaveBeenCalledWith(
      "telemetry:error-reports:v1:dropped",
    );
  });

  it("reads the current ring-buffer saturation snapshot", async () => {
    sharedRedisMockMget.mockResolvedValueOnce(["18", "4"]);

    const snapshot = await getErrorReportBufferSnapshot();

    expect(snapshot).toEqual({
      capacity: 250,
      retained: 14,
      totalCaptured: 18,
      totalDropped: 4,
      cumulativeSaturationRate: 0.2222,
    });
    expect(sharedRedisMockMget).toHaveBeenCalledWith(
      "telemetry:error-reports:v1:total",
      "telemetry:error-reports:v1:dropped",
    );
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

    const firstFetchCall = fetchMock.mock.calls[0] as unknown[] | undefined;
    expect(firstFetchCall).toBeTruthy();

    const requestInit = firstFetchCall?.[1] as RequestInit | undefined;
    const payload = JSON.parse(String(requestInit?.body)) as Record<
      string,
      unknown
    >;

    expect(payload).not.toHaveProperty("userId");
    expect(payload).not.toHaveProperty("username");
    expect(sharedRedisMockRpush).not.toHaveBeenCalled();
  });

  it("retries client error delivery before succeeding", async () => {
    let attempt = 0;
    const fetchMock = mock(() => {
      attempt += 1;

      if (attempt < 3) {
        return Promise.resolve(new Response(null, { status: 503 }));
      }

      return Promise.resolve(new Response(null, { status: 202 }));
    });

    Object.defineProperty(globalThis, "window", {
      value: {
        sessionStorage: {
          clear: () => undefined,
          getItem: () => null,
          key: () => null,
          length: 0,
          removeItem: () => undefined,
          setItem: () => undefined,
        } as Storage,
      } satisfies Pick<Window, "sessionStorage">,
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

    const report = await trackUserActionError(
      "render_component_tree",
      new Error("Failed to fetch user Alex profile"),
      "network_error",
      { source: "react_error_boundary" },
    );

    expect(report).not.toBeNull();
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it("queues failed client error reports and flushes them on the next success", async () => {
    const sessionStorageState = new Map<string, string>();
    const sessionStorageMock = {
      clear() {
        sessionStorageState.clear();
      },
      getItem(key: string) {
        return sessionStorageState.get(key) ?? null;
      },
      key(index: number) {
        return [...sessionStorageState.keys()][index] ?? null;
      },
      get length() {
        return sessionStorageState.size;
      },
      removeItem(key: string) {
        sessionStorageState.delete(key);
      },
      setItem(key: string, value: string) {
        sessionStorageState.set(key, value);
      },
    } satisfies Storage;
    const fetchMock = mock(() =>
      Promise.resolve(new Response(null, { status: 503 })),
    );

    Object.defineProperty(globalThis, "window", {
      value: {
        sessionStorage: sessionStorageMock,
      } satisfies Pick<Window, "sessionStorage">,
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

    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(
      sessionStorageState.get("anicards:error-report-queue:v1"),
    ).toBeTruthy();

    fetchMock.mockImplementation(() =>
      Promise.resolve(new Response(null, { status: 202 })),
    );

    await trackUserActionError(
      "render_component_tree_retry",
      new Error("Retry delivery after queue"),
      "network_error",
      { source: "react_error_boundary" },
    );

    expect(fetchMock).toHaveBeenCalledTimes(5);
    expect(
      sessionStorageState.get("anicards:error-report-queue:v1"),
    ).toBeUndefined();
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
    expect(payload).not.toHaveProperty("userId");
    expect(payload).not.toHaveProperty("username");
    expect(JSON.stringify(payload)).not.toContain("/Users/Alex/private");
    expect(JSON.stringify(payload)).not.toContain("http://localhost:3000");
    expect(JSON.stringify(payload)).not.toContain("token=secret");
  });
});
