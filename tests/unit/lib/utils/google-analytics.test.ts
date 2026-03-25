import "@/tests/unit/__setup__";

import { afterEach, beforeEach, describe, expect, it, mock } from "bun:test";

import {
  ANALYTICS_CONSENT_STORAGE_KEY,
  event,
  getAnalyticsConsentState,
  hasAnalyticsConsent,
  normalizeAnalyticsPage,
  pageview,
  setAnalyticsConsentState,
  trackError,
} from "@/lib/utils/google-analytics";

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
  const originalGtag = (globalThis as typeof globalThis & { gtag?: unknown })
    .gtag;

  let gtagMock: ReturnType<typeof mock>;
  let dispatchEventMock: ReturnType<typeof mock>;

  beforeEach(() => {
    process.env = {
      ...process.env,
      NEXT_PUBLIC_GOOGLE_ANALYTICS_ID: "G-TEST123",
      NODE_ENV: "test",
    };

    const storage = createStorageMock();
    gtagMock = mock(() => {});
    dispatchEventMock = mock(() => true);

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

    delete process.env.NEXT_PUBLIC_GOOGLE_ANALYTICS_ID;
  });

  it("defaults analytics consent to unset and disabled", () => {
    expect(getAnalyticsConsentState()).toBe("unset");
    expect(hasAnalyticsConsent()).toBe(false);
  });

  it("normalizes user routes and stat card paths without leaking identifiers", () => {
    expect(
      normalizeAnalyticsPage({
        pathname: "/user/Alex",
        search: "q=naruto&visibility=all",
      }),
    ).toEqual({
      pagePath: "/user/[username]?filter=search",
      pageTitle: "user_profile",
      pageLocation: "https://anicards.test/user/[username]?filter=search",
    });

    expect(
      normalizeAnalyticsPage({
        pathname: "/StatCards/Alex",
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
});
