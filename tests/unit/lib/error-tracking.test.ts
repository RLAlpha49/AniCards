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
});
