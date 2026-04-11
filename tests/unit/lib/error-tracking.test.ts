import { afterEach, beforeEach, describe, expect, it, mock } from "bun:test";

import {
  flushClientErrorReportBacklog,
  getErrorReportBufferSnapshot,
  trackUserActionError,
} from "@/lib/error-tracking";
import {
  allowConsoleWarningsAndErrors,
  parseRequestInitJson,
  sharedRedisMockGet,
  sharedRedisMockIncr,
  sharedRedisMockLrange,
  sharedRedisMockLtrim,
  sharedRedisMockMget,
  sharedRedisMockRpush,
  sharedRedisMockSet,
} from "@/tests/unit/__setup__";

const CLIENT_ERROR_REPORT_QUEUE_STORAGE_KEY = "anicards:error-report-queue:v1";

function createStorageMock(storageState: Map<string, string>): Storage {
  return {
    clear() {
      storageState.clear();
    },
    getItem(key: string) {
      return storageState.get(key) ?? null;
    },
    key(index: number) {
      return [...storageState.keys()][index] ?? null;
    },
    get length() {
      return storageState.size;
    },
    removeItem(key: string) {
      storageState.delete(key);
    },
    setItem(key: string, value: string) {
      storageState.set(key, value);
    },
  } satisfies Storage;
}

function readStoredClientQueueState(storageState: Map<string, string>): {
  reports: Array<{
    body: string;
    nextAttemptAt?: number;
  }>;
  stats: {
    storage: string;
    totalQueued: number;
    totalDelivered: number;
    totalEvicted: number;
    totalExpired: number;
    totalDroppedAfterMaxAttempts: number;
    totalNonRetryableDeliveryFailures: number;
    totalRateLimited: number;
    recentDrops: Array<{
      reason: string;
    }>;
  };
  pendingDurableOutcomes: {
    nonRetryableDeliveryCount: number;
    queueEvictedCount: number;
    queueExpiredCount: number;
    queueMaxAttemptsCount: number;
    recentOutcomes: Array<{
      reason: string;
      statusCode?: number;
      source?: string;
      userAction?: string;
    }>;
  };
} {
  const rawQueueState = storageState.get(CLIENT_ERROR_REPORT_QUEUE_STORAGE_KEY);
  expect(rawQueueState).toBeTruthy();
  return JSON.parse(String(rawQueueState)) as {
    reports: Array<{
      body: string;
      nextAttemptAt?: number;
    }>;
    stats: {
      storage: string;
      totalQueued: number;
      totalDelivered: number;
      totalEvicted: number;
      totalExpired: number;
      totalDroppedAfterMaxAttempts: number;
      totalNonRetryableDeliveryFailures: number;
      totalRateLimited: number;
      recentDrops: Array<{
        reason: string;
      }>;
    };
    pendingDurableOutcomes: {
      nonRetryableDeliveryCount: number;
      queueEvictedCount: number;
      queueExpiredCount: number;
      queueMaxAttemptsCount: number;
      recentOutcomes: Array<{
        reason: string;
        statusCode?: number;
        source?: string;
        userAction?: string;
      }>;
    };
  };
}

describe("error tracking", () => {
  const originalWindow = globalThis.window;
  const originalLocation = globalThis.location;
  const originalFetch = globalThis.fetch;
  const originalSetTimeout = globalThis.setTimeout;
  const originalClearTimeout = globalThis.clearTimeout;

  beforeEach(() => {
    allowConsoleWarningsAndErrors();
    sharedRedisMockGet.mockReset();
    sharedRedisMockIncr.mockReset();
    sharedRedisMockLrange.mockReset();
    sharedRedisMockMget.mockReset();
    sharedRedisMockRpush.mockReset();
    sharedRedisMockSet.mockReset();
    sharedRedisMockLtrim.mockReset();
    sharedRedisMockGet.mockResolvedValue(null);
    sharedRedisMockIncr.mockResolvedValue(1);
    sharedRedisMockLrange.mockResolvedValue([]);
    sharedRedisMockRpush.mockResolvedValue(1);
    sharedRedisMockSet.mockResolvedValue("OK");
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
    Object.defineProperty(globalThis, "setTimeout", {
      value: originalSetTimeout,
      configurable: true,
      writable: true,
    });
    Object.defineProperty(globalThis, "clearTimeout", {
      value: originalClearTimeout,
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

  it("preserves explicit retryability and recovery suggestions when callers provide them", async () => {
    const suggestions = [
      {
        title: "Reload the page",
        description: "Reload the page after the upstream recovers.",
        actionLabel: "Reload",
      },
    ];

    const report = await trackUserActionError(
      "user_page_load",
      new Error("Upstream bootstrap temporarily unavailable"),
      "server_error",
      {
        retryable: false,
        recoverySuggestions: suggestions,
        source: "client_hook",
      },
    );

    expect(report?.retryable).toBe(false);
    expect(report?.suggestions).toEqual(suggestions);

    const serializedReport = sharedRedisMockRpush.mock.calls.at(-1)?.[1] as
      | string
      | undefined;
    const payload = JSON.parse(String(serializedReport)) as {
      retryable: boolean;
      suggestions: Array<{
        title: string;
        description: string;
        actionLabel?: string;
      }>;
    };

    expect(payload.retryable).toBe(false);
    expect(payload.suggestions).toEqual(suggestions);
  });

  it("preserves safe recovery action URLs while stripping unsafe ones", async () => {
    const suggestions = [
      {
        title: "Go home",
        description: "Return to the AniCards home page and retry there.",
        actionLabel: "Go home",
        actionUrl: "/?from=error",
      },
      {
        title: "Visit AniList",
        description: "Open AniList directly to confirm the upstream status.",
        actionLabel: "Visit AniList",
        actionUrl: "https://anilist.co",
      },
      {
        title: "Unsafe HTTP link",
        description: "HTTP recovery links should not be persisted.",
        actionLabel: "Do not persist",
        actionUrl: "http://example.com/recovery",
      },
      {
        title: "Unsafe script link",
        description: "Script URLs should not be persisted.",
        actionLabel: "Do not persist",
        actionUrl: "javascript:alert(1)",
      },
    ];

    const report = await trackUserActionError(
      "user_page_load",
      new Error("Recovery guidance should preserve safe links only"),
      "server_error",
      {
        recoverySuggestions: suggestions,
        source: "client_hook",
      },
    );

    if (!report) {
      throw new Error("Expected structured error report to be returned");
    }

    expect(report.suggestions).toEqual([
      {
        title: "Go home",
        description: "Return to the AniCards home page and retry there.",
        actionLabel: "Go home",
        actionUrl: "/?from=error",
      },
      {
        title: "Visit AniList",
        description: "Open AniList directly to confirm the upstream status.",
        actionLabel: "Visit AniList",
        actionUrl: "https://anilist.co/",
      },
      {
        title: "Unsafe HTTP link",
        description: "HTTP recovery links should not be persisted.",
        actionLabel: "Do not persist",
      },
      {
        title: "Unsafe script link",
        description: "Script URLs should not be persisted.",
        actionLabel: "Do not persist",
      },
    ]);

    const serializedReport = sharedRedisMockRpush.mock.calls.at(-1)?.[1] as
      | string
      | undefined;
    const payload = JSON.parse(String(serializedReport)) as {
      suggestions: Array<{
        title: string;
        description: string;
        actionLabel?: string;
        actionUrl?: string;
      }>;
    };

    expect(payload.suggestions).toEqual(report.suggestions);
  });

  it("redacts sensitive message fragments and drops sensitive metadata before persistence", async () => {
    const report = await trackUserActionError(
      "user_page_load",
      new Error(
        "Failed request for alex@example.com with token=super-secret-token-value-1234567890",
      ),
      "network_error",
      {
        metadata: {
          authToken: "super-secret-token-value-1234567890",
          boundary: "client_hook",
          email: "alex@example.com",
          note: "retry email=alex@example.com token=super-secret-token-value-1234567890",
        },
        source: "client_hook",
      },
    );

    expect(report).not.toBeNull();
    expect(report?.metadata?.boundary).toBe("client_hook");
    expect(report?.metadata).not.toHaveProperty("authToken");
    expect(report?.metadata).not.toHaveProperty("email");
    expect(report?.technicalMessage).not.toContain("alex@example.com");
    expect(report?.technicalMessage).not.toContain(
      "super-secret-token-value-1234567890",
    );

    const serializedReport = sharedRedisMockRpush.mock.calls.at(-1)?.[1] as
      | string
      | undefined;
    expect(serializedReport).toBeTruthy();
    expect(serializedReport).not.toContain("alex@example.com");
    expect(serializedReport).not.toContain(
      "super-secret-token-value-1234567890",
    );

    const payload = JSON.parse(String(serializedReport)) as {
      metadata?: Record<string, string>;
      technicalMessage: string;
    };

    expect(payload.metadata?.boundary).toBe("client_hook");
    expect(payload.metadata).not.toHaveProperty("authToken");
    expect(payload.metadata).not.toHaveProperty("email");
    expect(payload.technicalMessage).not.toContain("alex@example.com");
    expect(payload.technicalMessage).not.toContain(
      "super-secret-token-value-1234567890",
    );
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
    sharedRedisMockLrange.mockResolvedValueOnce([
      JSON.stringify({
        id: "rep-evicted-1",
        timestamp: 1_710_000_000_000,
        source: "api_route",
        userAction: "render_component_tree",
        category: "server_error",
        retryable: false,
        technicalMessage: "Oldest retained error",
        errorName: "Error",
      }),
    ]);
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
    expect(sharedRedisMockSet).toHaveBeenCalledWith(
      "telemetry:error-reports:v1:evicted-summary",
      expect.any(String),
    );
  });

  it("reads the current ring-buffer saturation snapshot", async () => {
    sharedRedisMockMget.mockResolvedValueOnce(["18", "4"]);
    sharedRedisMockLrange.mockResolvedValueOnce([
      JSON.stringify({
        id: "rep-retained-1",
        timestamp: 1_710_000_100_000,
        source: "react_error_boundary",
        userAction: "render_component_tree",
        category: "network_error",
        retryable: true,
        technicalMessage: "Segment render failed after retry",
        errorName: "Error",
        route: "/user/Alex",
        requestId: "req-retained-12345",
        digest: "digest-retained-1",
      }),
      JSON.stringify({
        id: "rep-retained-2",
        timestamp: 1_710_000_200_000,
        source: "client_hook",
        userAction: "bootstrap_user_page",
        category: "server_error",
        retryable: false,
        technicalMessage: "Bootstrap payload missing required shape",
        errorName: "TypeError",
        route: "/user/Alex?tab=cards",
      }),
    ]);
    sharedRedisMockGet.mockResolvedValueOnce(
      JSON.stringify({
        totalReports: 4,
        updatedAt: 1_710_000_300_000,
        routes: {
          "/user/Alex": {
            reports: 3,
            latest: {
              id: "rep-evicted-1",
              timestamp: 1_710_000_250_000,
              source: "react_error_boundary",
              userAction: "render_component_tree",
              category: "network_error",
              retryable: true,
              technicalMessage: "Earlier incident rolled out of the buffer",
              errorName: "Error",
              route: "/user/Alex",
              requestId: "req-evicted-12345",
              digest: "digest-evicted-1",
            },
          },
        },
        categories: {
          network_error: {
            reports: 4,
            latest: {
              id: "rep-evicted-1",
              timestamp: 1_710_000_250_000,
              source: "react_error_boundary",
              userAction: "render_component_tree",
              category: "network_error",
              retryable: true,
              technicalMessage: "Earlier incident rolled out of the buffer",
              errorName: "Error",
            },
          },
        },
        sources: {
          react_error_boundary: {
            reports: 4,
            latest: {
              id: "rep-evicted-1",
              timestamp: 1_710_000_250_000,
              source: "react_error_boundary",
              userAction: "render_component_tree",
              category: "network_error",
              retryable: true,
              technicalMessage: "Earlier incident rolled out of the buffer",
              errorName: "Error",
            },
          },
        },
        userActions: {
          render_component_tree: {
            reports: 4,
            latest: {
              id: "rep-evicted-1",
              timestamp: 1_710_000_250_000,
              source: "react_error_boundary",
              userAction: "render_component_tree",
              category: "network_error",
              retryable: true,
              technicalMessage: "Earlier incident rolled out of the buffer",
              errorName: "Error",
            },
          },
        },
        recentReports: [
          {
            id: "rep-evicted-1",
            timestamp: 1_710_000_250_000,
            source: "react_error_boundary",
            userAction: "render_component_tree",
            category: "network_error",
            retryable: true,
            technicalMessage: "Earlier incident rolled out of the buffer",
            errorName: "Error",
          },
        ],
      }),
    );

    const snapshot = await getErrorReportBufferSnapshot();

    expect(snapshot).toMatchObject({
      capacity: 250,
      retained: 14,
      totalCaptured: 18,
      totalDropped: 4,
      cumulativeSaturationRate: 0.2222,
      retainedTriage: {
        totalReports: 2,
      },
      evictedTriage: {
        totalReports: 4,
        updatedAt: 1_710_000_300_000,
      },
    });
    expect(
      snapshot.retainedTriage.topRoutes.some(
        (bucket) =>
          bucket.value === "/user/Alex" &&
          bucket.reports === 1 &&
          bucket.latest.requestId === "req-retained-12345" &&
          bucket.latest.digest === "digest-retained-1",
      ),
    ).toBe(true);
    expect(snapshot.evictedTriage.topCategories[0]).toMatchObject({
      value: "network_error",
      reports: 4,
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
    const payload = parseRequestInitJson<Record<string, unknown>>(requestInit);

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
    const localStorageState = new Map<string, string>();

    Object.defineProperty(globalThis, "window", {
      value: {
        localStorage: createStorageMock(localStorageState),
      } satisfies Pick<Window, "localStorage">,
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

  it("treats client delivery timeouts as retryable queue failures", async () => {
    const localStorageState = new Map<string, string>();
    const fetchMock = mock((_: RequestInfo | URL, init?: RequestInit) => {
      const signal = init?.signal;

      return new Promise<Response>((_resolve, reject) => {
        if (!(signal instanceof AbortSignal)) {
          reject(new Error("Expected an abort signal for timeout coverage."));
          return;
        }

        if (signal.aborted) {
          reject(signal.reason);
          return;
        }

        signal.addEventListener("abort", () => reject(signal.reason), {
          once: true,
        });
      });
    });

    Object.defineProperty(globalThis, "window", {
      value: {
        localStorage: createStorageMock(localStorageState),
      } satisfies Pick<Window, "localStorage">,
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
    Object.defineProperty(globalThis, "setTimeout", {
      value: ((
        handler: TimerHandler,
        _timeout?: number,
        ...args: unknown[]
      ) => {
        queueMicrotask(() => {
          if (typeof handler === "function") {
            handler(...args);
          }
        });

        return 1 as unknown as ReturnType<typeof setTimeout>;
      }) as unknown as typeof setTimeout,
      configurable: true,
      writable: true,
    });
    Object.defineProperty(globalThis, "clearTimeout", {
      value: (() => undefined) as typeof clearTimeout,
      configurable: true,
      writable: true,
    });

    const report = await trackUserActionError(
      "render_component_tree",
      new Error("Timed out while uploading client telemetry"),
      "timeout",
      { source: "react_error_boundary" },
    );

    expect(report).not.toBeNull();
    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(readStoredClientQueueState(localStorageState)).toMatchObject({
      reports: [expect.any(Object)],
      stats: {
        totalQueued: 1,
      },
    });
  });

  it("flushes queued client error reports through the backlog helper while preserving client incident identity", async () => {
    const localStorageState = new Map<string, string>();
    const fetchMock = mock(() =>
      Promise.resolve(new Response(null, { status: 503 })),
    );

    Object.defineProperty(globalThis, "window", {
      value: {
        localStorage: createStorageMock(localStorageState),
      } satisfies Pick<Window, "localStorage">,
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
    expect(
      localStorageState.get(CLIENT_ERROR_REPORT_QUEUE_STORAGE_KEY),
    ).toBeTruthy();

    const queuedState = readStoredClientQueueState(localStorageState);
    expect(queuedState.reports).toHaveLength(1);
    expect(queuedState.stats).toMatchObject({
      storage: "local_storage",
      totalQueued: 1,
      totalDelivered: 0,
    });

    const queuedPayload = JSON.parse(String(queuedState.reports[0]?.body)) as {
      id?: string;
      timestamp?: number;
    };

    expect(queuedPayload.id).toBe(report?.id);
    expect(queuedPayload.timestamp).toBe(report?.timestamp);

    fetchMock.mockImplementation(() =>
      Promise.resolve(new Response(null, { status: 202 })),
    );

    await flushClientErrorReportBacklog();

    expect(fetchMock).toHaveBeenCalledTimes(4);

    const flushedCalls = fetchMock.mock.calls as unknown as Array<
      [RequestInfo | URL, RequestInit | undefined]
    >;
    const flushedRequestInit = flushedCalls.at(-1)?.[1];
    const flushedPayload = parseRequestInitJson<{
      id?: string;
      timestamp?: number;
    }>(flushedRequestInit);

    expect(flushedPayload.id).toBe(report?.id);
    expect(flushedPayload.timestamp).toBe(report?.timestamp);
    expect(readStoredClientQueueState(localStorageState)).toMatchObject({
      reports: [],
      stats: {
        storage: "local_storage",
        totalQueued: 1,
        totalDelivered: 1,
      },
    });
  });

  it("tracks queue evictions when durable client storage reaches capacity", async () => {
    const localStorageState = new Map<string, string>();
    localStorageState.set(
      CLIENT_ERROR_REPORT_QUEUE_STORAGE_KEY,
      JSON.stringify(
        Array.from({ length: 24 }, (_, index) => ({
          attempts: 0,
          body: JSON.stringify({
            source: "react_error_boundary",
            userAction: `queued_report_${index}`,
            message: `Queued report ${index}`,
            category: "network_error",
            errorName: "Error",
          }),
          requestId: `req-queued-${index}`,
        })),
      ),
    );

    const fetchMock = mock(() =>
      Promise.resolve(new Response(null, { status: 503 })),
    );

    Object.defineProperty(globalThis, "window", {
      value: {
        localStorage: createStorageMock(localStorageState),
      } satisfies Pick<Window, "localStorage">,
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
      new Error("Client error burst exceeded durable queue capacity"),
      "network_error",
      { source: "react_error_boundary" },
    );

    const queueState = readStoredClientQueueState(localStorageState);
    expect(queueState.reports).toHaveLength(24);
    expect(queueState.stats).toMatchObject({
      totalQueued: 25,
      totalEvicted: 1,
    });
    expect(queueState.stats.recentDrops[0]?.reason).toBe("queue_evicted");
  });

  it("persists and flushes bounded non-retryable delivery outcomes without queueing the failed report", async () => {
    const localStorageState = new Map<string, string>();
    const fetchMock = mock(() =>
      Promise.resolve(
        new Response(
          JSON.stringify({
            category: "invalid_data",
            error: "Invalid error report payload",
            retryable: false,
            status: 400,
          }),
          {
            headers: {
              "Content-Type": "application/json",
            },
            status: 400,
            statusText: "Bad Request",
          },
        ),
      ),
    );

    Object.defineProperty(globalThis, "window", {
      value: {
        localStorage: createStorageMock(localStorageState),
      } satisfies Pick<Window, "localStorage">,
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

    expect(fetchMock).toHaveBeenCalledTimes(1);

    const storedState = readStoredClientQueueState(localStorageState);
    expect(storedState.reports).toHaveLength(0);
    expect(storedState.stats).toMatchObject({
      totalQueued: 0,
      totalNonRetryableDeliveryFailures: 1,
    });
    expect(storedState.pendingDurableOutcomes).toMatchObject({
      nonRetryableDeliveryCount: 1,
    });
    expect(storedState.pendingDurableOutcomes.recentOutcomes[0]).toMatchObject({
      reason: "non_retryable_delivery",
      statusCode: 400,
      source: "react_error_boundary",
      userAction: "render_component_tree",
    });

    fetchMock.mockImplementation(() =>
      Promise.resolve(new Response(null, { status: 202 })),
    );

    await flushClientErrorReportBacklog();

    expect(fetchMock).toHaveBeenCalledTimes(2);

    const summaryCalls = fetchMock.mock.calls as unknown as Array<
      [RequestInfo | URL, RequestInit | undefined]
    >;
    const summaryPayload = parseRequestInitJson<Record<string, unknown>>(
      summaryCalls.at(-1)?.[1],
    );

    expect(summaryPayload).toMatchObject({
      source: "client_hook",
      userAction: "client_error_report_delivery_outcomes",
      category: "unknown",
      metadata: expect.objectContaining({
        clientDeliveryOutcomeNonRetryableCount: 1,
        clientDeliveryOutcome1Reason: "non_retryable_delivery",
        clientDeliveryOutcome1StatusCode: 400,
        clientDeliveryOutcome1Source: "react_error_boundary",
        clientDeliveryOutcome1UserAction: "render_component_tree",
      }),
    });
    expect(readStoredClientQueueState(localStorageState)).toMatchObject({
      reports: [],
      pendingDurableOutcomes: {
        nonRetryableDeliveryCount: 0,
        queueEvictedCount: 0,
        queueExpiredCount: 0,
        queueMaxAttemptsCount: 0,
        recentOutcomes: [],
      },
    });
  });

  it("defers queued client error report replay until Retry-After elapses", async () => {
    const localStorageState = new Map<string, string>();
    const replayNotBefore = Date.now() + 60_000;

    localStorageState.set(
      CLIENT_ERROR_REPORT_QUEUE_STORAGE_KEY,
      JSON.stringify([
        {
          attempts: 1,
          body: JSON.stringify({
            message: "Queued error report",
            source: "react_error_boundary",
            userAction: "queued_report",
          }),
          nextAttemptAt: replayNotBefore,
          requestId: "req-queued-12345",
        },
      ]),
    );

    const fetchMock = mock(() =>
      Promise.resolve(new Response(null, { status: 202 })),
    );

    Object.defineProperty(globalThis, "window", {
      value: {
        localStorage: createStorageMock(localStorageState),
      } satisfies Pick<Window, "localStorage">,
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

    expect(fetchMock).toHaveBeenCalledTimes(1);

    expect(readStoredClientQueueState(localStorageState).reports).toHaveLength(
      1,
    );
    expect(
      readStoredClientQueueState(localStorageState).reports[0]?.nextAttemptAt,
    ).toBe(replayNotBefore);
  });

  it("stores only minimized payloads in the client retry queue", async () => {
    const localStorageState = new Map<string, string>();
    const fetchMock = mock(() =>
      Promise.resolve(new Response(null, { status: 503 })),
    );

    Object.defineProperty(globalThis, "window", {
      value: {
        localStorage: createStorageMock(localStorageState),
      } satisfies Pick<Window, "localStorage">,
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
      new Error(
        "Failed request for alex@example.com with token=super-secret-token-value-1234567890",
      ),
      "network_error",
      {
        metadata: {
          authToken: "super-secret-token-value-1234567890",
          boundary: "client_error_boundary",
          email: "alex@example.com",
          note: "retry email=alex@example.com token=super-secret-token-value-1234567890",
        },
        source: "react_error_boundary",
      },
    );

    const queuedState = readStoredClientQueueState(localStorageState);
    const queuedPayload = JSON.stringify(queuedState);
    expect(queuedPayload).not.toContain("alex@example.com");
    expect(queuedPayload).not.toContain("super-secret-token-value-1234567890");
    expect(queuedPayload).not.toContain("authToken");
    expect(queuedPayload).toContain("client_error_boundary");
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

    const payload = parseRequestInitJson<{
      stack?: string;
      componentStack?: string;
    }>(requestInit as RequestInit);

    expect(payload.stack).toBe("at renderUser\nat fetchProfile");
    expect(payload.componentStack).toBe("at UserPage\nat Layout");
    expect(payload).not.toHaveProperty("userId");
    expect(payload).not.toHaveProperty("username");
    expect(JSON.stringify(payload)).not.toContain("/Users/Alex/private");
    expect(JSON.stringify(payload)).not.toContain("http://localhost:3000");
    expect(JSON.stringify(payload)).not.toContain("token=secret");
  });
});
