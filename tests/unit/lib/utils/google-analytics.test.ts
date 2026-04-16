import { afterEach, beforeEach, describe, expect, it, mock } from "bun:test";

import {
  ANALYTICS_CONSENT_STORAGE_KEY,
  event,
  getAnalyticsConsentState,
  hasAnalyticsConsent,
  normalizeAnalyticsPage,
  pageview,
  safeTrack,
  setAnalyticsConsentState,
  trackError,
} from "@/lib/utils/google-analytics";
import { parseRequestInitJson } from "@/tests/unit/__setup__";

async function flushAnalyticsTelemetry(cycles = 6): Promise<void> {
  for (let index = 0; index < cycles; index++) {
    await Promise.resolve();
  }

  await new Promise<void>((resolve) => {
    globalThis.setTimeout(resolve, 0);
  });

  for (let index = 0; index < cycles; index++) {
    await Promise.resolve();
  }
}

async function waitForReportedAnalyticsCalls(
  fetchMock: ReturnType<typeof mock>,
  expectedCalls: number,
  maxAttempts = 10,
): Promise<void> {
  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    if (fetchMock.mock.calls.length >= expectedCalls) {
      return;
    }

    await flushAnalyticsTelemetry();
  }
}

function createStorageMock() {
  const backingStore = new Map<string, string>();

  const storage: Storage = {
    getItem: (key) => backingStore.get(key) ?? null,
    setItem: (key, value) => {
      backingStore.set(key, String(value));
    },
    removeItem: (key) => {
      backingStore.delete(key);
    },
    clear: () => {
      backingStore.clear();
    },
    key: (index) => Array.from(backingStore.keys())[index] ?? null,
    get length() {
      return backingStore.size;
    },
  };

  return storage;
}

describe("google analytics privacy utilities", () => {
  const originalWindow = globalThis.window;
  const originalLocation = globalThis.location;
  const originalCustomEvent = globalThis.CustomEvent;
  const originalFetch = globalThis.fetch;
  const originalGtag = (globalThis as typeof globalThis & { gtag?: unknown })
    .gtag;
  const originalDateNow = Date.now;

  let fetchMock: ReturnType<typeof mock>;
  let gtagMock: ReturnType<typeof mock>;
  let dispatchEventMock: ReturnType<typeof mock>;

  const getReportedErrorPayload = (callIndex = 0) => {
    const fetchCall = fetchMock.mock.calls[callIndex] as
      | [string, RequestInit]
      | undefined;

    expect(fetchCall?.[0]).toBe("/api/error-reports");
    expect(fetchCall?.[1]?.method).toBe("POST");

    return parseRequestInitJson<{
      category?: string;
      metadata?: Record<string, unknown>;
      source?: string;
      userAction?: string;
    }>(fetchCall?.[1]);
  };

  beforeEach(() => {
    process.env = {
      ...process.env,
      NEXT_PUBLIC_GOOGLE_ANALYTICS_ID: "G-TEST123",
      NODE_ENV: "test",
    };

    const storage = createStorageMock();
    gtagMock = mock(() => {});
    dispatchEventMock = mock(() => true);
    fetchMock = mock(
      async () =>
        new Response(JSON.stringify({ recorded: true }), {
          headers: { "Content-Type": "application/json" },
          status: 200,
        }),
    );

    const testWindow = {
      localStorage: storage,
      gtag: gtagMock,
      dispatchEvent: dispatchEventMock,
    } as unknown as Window;

    Object.defineProperty(globalThis, "window", {
      value: testWindow,
      configurable: true,
      writable: true,
    });
    Object.defineProperty(globalThis, "gtag", {
      value: gtagMock,
      configurable: true,
      writable: true,
    });

    Object.defineProperty(globalThis, "location", {
      value: new URL("https://anicards.test"),
      configurable: true,
      writable: true,
    });
    Object.defineProperty(globalThis, "fetch", {
      value: fetchMock,
      configurable: true,
      writable: true,
    });

    if (globalThis.CustomEvent === undefined) {
      class TestCustomEvent<T = unknown> extends Event {
        detail: T | undefined;

        constructor(type: string, init?: CustomEventInit<T>) {
          super(type);
          this.detail = init?.detail;
        }
      }

      Object.defineProperty(globalThis, "CustomEvent", {
        value: TestCustomEvent,
        configurable: true,
        writable: true,
      });
    }

    globalThis.window.localStorage.removeItem(ANALYTICS_CONSENT_STORAGE_KEY);
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
    Object.defineProperty(globalThis, "CustomEvent", {
      value: originalCustomEvent,
      configurable: true,
      writable: true,
    });
    Object.defineProperty(globalThis, "gtag", {
      value: originalGtag,
      configurable: true,
      writable: true,
    });
    Object.defineProperty(globalThis, "fetch", {
      value: originalFetch,
      configurable: true,
      writable: true,
    });
    Date.now = originalDateNow;

    delete process.env.NEXT_PUBLIC_GOOGLE_ANALYTICS_ID;
  });

  it("defaults analytics consent to unset and disabled", () => {
    expect(getAnalyticsConsentState()).toBe("unset");
    expect(hasAnalyticsConsent()).toBe(false);
  });

  it("reports consent update failures when the analytics bootstrap is not ready", async () => {
    Object.defineProperty(globalThis, "window", {
      value: {
        localStorage: createStorageMock(),
        dispatchEvent: dispatchEventMock,
      } as unknown as Window,
      configurable: true,
      writable: true,
    });
    Object.defineProperty(globalThis, "gtag", {
      value: undefined,
      configurable: true,
      writable: true,
    });

    setAnalyticsConsentState("granted");
    await waitForReportedAnalyticsCalls(fetchMock, 1);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(getReportedErrorPayload(0)).toMatchObject({
      source: "analytics_instrumentation",
      userAction: "analytics_consent_update",
      metadata: expect.objectContaining({
        analyticsBootstrapReady: false,
        analyticsDataLayerAvailable: false,
        analyticsFailureReason: "bootstrap_not_ready",
        analyticsGtagAvailable: false,
        consentGranted: true,
        pagePath: "/",
      }),
    });
  });

  it("normalizes user routes and stat card paths without leaking identifiers", () => {
    expect(
      normalizeAnalyticsPage({
        pathname: "/user/Alex///",
        search: "q=naruto&visibility=all",
      }),
    ).toEqual({
      pagePath: "/user/[username]?filter=search",
      pageTitle: "user_profile",
      pageLocation: "https://anicards.test/user/[username]?filter=search",
    });

    expect(
      normalizeAnalyticsPage({
        pathname: "/StatCards/Alex///",
      }).pagePath,
    ).toBe("/StatCards/[username]");
  });

  it("collapses long separator runs in analytics labels", () => {
    setAnalyticsConsentState("granted");

    event({
      action: "navigation",
      category: "engagement",
      label: `source${"!".repeat(50)}dest`,
    });

    expect(gtagMock).toHaveBeenNthCalledWith(
      2,
      "event",
      "navigation",
      expect.objectContaining({ event_label: "source_dest" }),
    );
  });

  it("blocks analytics events until consent is granted", () => {
    event({
      action: "button_clicked",
      category: "engagement",
      label: "hero_cta",
    });

    expect(gtagMock).not.toHaveBeenCalled();
  });

  it("sends normalized pageviews and low-cardinality labels after consent", () => {
    setAnalyticsConsentState("granted");

    pageview({
      pathname: "/user/Alex",
      search: "q=naruto",
    });
    event({
      action: "editor_tour_dismissed",
      category: "engagement",
      label: "1742771200000",
    });

    expect(gtagMock).toHaveBeenNthCalledWith(
      1,
      "consent",
      "update",
      expect.objectContaining({ analytics_storage: "granted" }),
    );
    expect(gtagMock).toHaveBeenNthCalledWith(
      2,
      "event",
      "page_view",
      expect.objectContaining({
        page_path: "/user/[username]?filter=search",
        page_title: "user_profile",
        page_location: "https://anicards.test/user/[username]?filter=search",
      }),
    );
    expect(gtagMock).toHaveBeenNthCalledWith(
      3,
      "event",
      "editor_tour_dismissed",
      expect.objectContaining({ event_label: "numeric_value" }),
    );
  });

  it("replaces raw error text with bounded error labels", () => {
    setAnalyticsConsentState("granted");

    trackError("TypeError", "Failed to fetch user Alex");

    expect(gtagMock).toHaveBeenNthCalledWith(
      2,
      "event",
      "error_occurred",
      expect.objectContaining({ event_label: "typeerror_network" }),
    );
    expect(dispatchEventMock).toHaveBeenCalledTimes(1);
  });

  it("reports repeated pageview dispatch failures through structured telemetry without flooding every occurrence", async () => {
    let fakeNow = 1_000;
    Date.now = () => fakeNow;

    setAnalyticsConsentState("granted");
    gtagMock.mockImplementation(() => {
      const error = new Error("Failed to fetch analytics beacon");
      error.name = "PageviewTelemetryTestError";
      throw error;
    });

    pageview({
      pathname: "/user/Alex",
      search: "q=naruto",
    });
    await waitForReportedAnalyticsCalls(fetchMock, 1);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(getReportedErrorPayload(0)).toMatchObject({
      source: "analytics_instrumentation",
      userAction: "analytics_pageview_dispatch",
      category: "network_error",
      metadata: expect.objectContaining({
        analyticsFailureBucket: "network",
        analyticsFailureCount: 1,
        analyticsFailureReason: "dispatch_call_failed",
        analyticsSuppressedDuplicates: 0,
        pagePath: "/user/[username]?filter=[redacted]",
        pageTitle: "user_profile",
      }),
    });

    pageview({
      pathname: "/user/Alex",
      search: "q=naruto",
    });
    await flushAnalyticsTelemetry();

    expect(fetchMock).toHaveBeenCalledTimes(1);

    fakeNow += 60_001;
    pageview({
      pathname: "/user/Alex",
      search: "q=naruto",
    });
    await waitForReportedAnalyticsCalls(fetchMock, 2);

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(getReportedErrorPayload(1)).toMatchObject({
      source: "analytics_instrumentation",
      userAction: "analytics_pageview_dispatch",
      metadata: expect.objectContaining({
        analyticsFailureCount: 3,
        analyticsSuppressedDuplicates: 1,
        pagePath: "/user/[username]?filter=[redacted]",
      }),
    });
  });

  it("reports safeTrack callback failures through the structured telemetry path", async () => {
    setAnalyticsConsentState("granted");

    safeTrack(() => {
      throw new Error("analytics callback exploded");
    });
    await waitForReportedAnalyticsCalls(fetchMock, 1);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(getReportedErrorPayload(0)).toMatchObject({
      source: "analytics_instrumentation",
      userAction: "analytics_safe_track",
      metadata: expect.objectContaining({
        analyticsFailureBucket: "unknown",
        analyticsFailureCount: 1,
        analyticsSuppressedDuplicates: 0,
      }),
    });
  });

  it("reports analytics consent persistence failures with bounded route metadata", async () => {
    Object.defineProperty(globalThis, "window", {
      value: {
        localStorage: {
          ...createStorageMock(),
          setItem: () => {
            throw new Error("localStorage write blocked");
          },
        } as Storage,
        gtag: gtagMock,
        dispatchEvent: dispatchEventMock,
      } as unknown as Window,
      configurable: true,
      writable: true,
    });

    setAnalyticsConsentState("granted");
    await waitForReportedAnalyticsCalls(fetchMock, 1);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(getReportedErrorPayload(0)).toMatchObject({
      route: "/",
      source: "analytics_instrumentation",
      userAction: "analytics_consent_update",
      metadata: expect.objectContaining({
        analyticsConsentPersistence: "local_storage",
        analyticsFailureReason: "storage_write_failed",
        consentGranted: true,
        consentState: "granted",
      }),
    });
  });
});
