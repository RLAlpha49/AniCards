import {
  afterAll,
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  mock,
} from "bun:test";

import { ANALYTICS_CONSENT_STORAGE_KEY } from "@/lib/utils/google-analytics";
import {
  flushMicrotasks,
  installHappyDom,
  resetHappyDom,
  restoreHappyDom,
} from "@/tests/unit/hooks/test-helpers";

let pathname = "/";
let searchParams = new URLSearchParams();
const NEXT_NAVIGATION_STATE_KEY = "__ANICARDS_TEST_NEXT_NAVIGATION__";
const originalFetch = globalThis.fetch;
const originalGtag = (globalThis as typeof globalThis & { gtag?: unknown })
  .gtag;
const gtagMock = mock(() => {});
let fetchMock: ReturnType<typeof mock>;

type NextNavigationState = {
  pathname: string;
  routerPush: (href: string) => unknown;
  searchParams: URLSearchParams;
};

function getNextNavigationState(): NextNavigationState {
  const state = (globalThis as Record<string, unknown>)[
    NEXT_NAVIGATION_STATE_KEY
  ];

  if (state && typeof state === "object") {
    return state as NextNavigationState;
  }

  return {
    pathname: "/",
    routerPush: () => Promise.resolve(undefined),
    searchParams: new URLSearchParams(),
  };
}

mock.module("next/navigation", () => ({
  usePathname: () => getNextNavigationState().pathname,
  useRouter: () => ({
    push: (href: string) => getNextNavigationState().routerPush(href),
  }),
  useSearchParams: () => getNextNavigationState().searchParams,
}));

const originalTrackingId = process.env.NEXT_PUBLIC_GOOGLE_ANALYTICS_ID;

installHappyDom();

const { act, cleanup, renderHook } = await import("@testing-library/react");
const { useGoogleAnalytics } = await import("@/hooks/useGoogleAnalytics");

function parseRequestInitJson<T>(init: RequestInit | undefined): T {
  const body = init?.body;
  if (typeof body === "string") {
    return JSON.parse(body) as T;
  }

  if (body instanceof URLSearchParams) {
    return JSON.parse(body.toString()) as T;
  }

  throw new Error("Expected RequestInit.body to be a string.");
}

function getReportedErrorPayload(callIndex = 0) {
  const fetchCall = fetchMock.mock.calls[callIndex] as
    | [string, RequestInit]
    | undefined;

  expect(fetchCall?.[0]).toBe("/api/error-reports");
  expect(fetchCall?.[1]?.method).toBe("POST");

  return parseRequestInitJson<{
    metadata?: Record<string, unknown>;
    source?: string;
    userAction?: string;
  }>(fetchCall?.[1]);
}

beforeEach(() => {
  resetHappyDom();
  pathname = "/user/Alex";
  searchParams = new URLSearchParams("q=naruto");
  gtagMock.mockReset();
  fetchMock = mock(
    async () =>
      new Response(JSON.stringify({ recorded: true }), {
        headers: { "Content-Type": "application/json" },
        status: 200,
      }),
  );
  globalThis.window.localStorage.removeItem(ANALYTICS_CONSENT_STORAGE_KEY);
  (globalThis as Record<string, unknown>)[NEXT_NAVIGATION_STATE_KEY] = {
    pathname,
    routerPush: () => Promise.resolve(undefined),
    searchParams,
  } satisfies NextNavigationState;

  Object.defineProperty(globalThis, "gtag", {
    configurable: true,
    value: gtagMock,
    writable: true,
  });
  Object.defineProperty(globalThis, "fetch", {
    configurable: true,
    value: fetchMock,
    writable: true,
  });
});

afterEach(() => {
  cleanup();
  Object.defineProperty(globalThis, "gtag", {
    configurable: true,
    value: originalGtag,
    writable: true,
  });
  Object.defineProperty(globalThis, "fetch", {
    configurable: true,
    value: originalFetch,
    writable: true,
  });

  if (originalTrackingId === undefined) {
    delete process.env.NEXT_PUBLIC_GOOGLE_ANALYTICS_ID;
  } else {
    process.env.NEXT_PUBLIC_GOOGLE_ANALYTICS_ID = originalTrackingId;
  }
});

afterAll(() => {
  mock.restore();
  restoreHappyDom();
});

describe("useGoogleAnalytics", () => {
  it("tracks the current page and query when consent and the GA id are both available", async () => {
    process.env.NEXT_PUBLIC_GOOGLE_ANALYTICS_ID = "G-TEST123";
    globalThis.window.localStorage.setItem(
      ANALYTICS_CONSENT_STORAGE_KEY,
      "granted",
    );

    const { rerender } = renderHook(
      ({ consentGranted }: { consentGranted: boolean }) =>
        useGoogleAnalytics(consentGranted),
      {
        initialProps: {
          consentGranted: true,
        },
      },
    );

    await act(async () => {
      await flushMicrotasks();
    });

    expect(gtagMock).toHaveBeenNthCalledWith(
      1,
      "event",
      "page_view",
      expect.objectContaining({
        page_location: "https://anicards.test/user/[username]?filter=search",
        page_path: "/user/[username]?filter=search",
        page_title: "user_profile",
        send_to: "G-TEST123",
      }),
    );

    pathname = "/search";
    searchParams = new URLSearchParams("q=bleach&sort=top");
    (globalThis as Record<string, unknown>)[NEXT_NAVIGATION_STATE_KEY] = {
      pathname,
      routerPush: () => Promise.resolve(undefined),
      searchParams,
    } satisfies NextNavigationState;
    rerender({ consentGranted: true });

    await act(async () => {
      await flushMicrotasks();
    });

    expect(gtagMock).toHaveBeenNthCalledWith(
      2,
      "event",
      "page_view",
      expect.objectContaining({
        page_location: "https://anicards.test/search",
        page_path: "/search",
        page_title: "search",
        send_to: "G-TEST123",
      }),
    );
  });

  it("skips pageview tracking when consent is missing or the GA id is not configured", async () => {
    process.env.NEXT_PUBLIC_GOOGLE_ANALYTICS_ID = "G-TEST123";
    globalThis.window.localStorage.setItem(
      ANALYTICS_CONSENT_STORAGE_KEY,
      "granted",
    );

    const { rerender } = renderHook(
      ({ consentGranted }: { consentGranted: boolean }) =>
        useGoogleAnalytics(consentGranted),
      {
        initialProps: {
          consentGranted: false,
        },
      },
    );

    await act(async () => {
      await flushMicrotasks();
    });

    delete process.env.NEXT_PUBLIC_GOOGLE_ANALYTICS_ID;
    rerender({ consentGranted: true });

    await act(async () => {
      await flushMicrotasks();
    });

    expect(gtagMock).not.toHaveBeenCalled();
  });

  it("reports pageview dispatch failures with normalized page metadata", async () => {
    process.env.NEXT_PUBLIC_GOOGLE_ANALYTICS_ID = "G-TEST123";
    globalThis.window.localStorage.setItem(
      ANALYTICS_CONSENT_STORAGE_KEY,
      "granted",
    );
    gtagMock.mockImplementation(() => {
      throw new TypeError("Failed to fetch analytics beacon");
    });

    renderHook(() => useGoogleAnalytics(true));

    await act(async () => {
      await flushMicrotasks(10);
      await new Promise<void>((resolve) => {
        globalThis.setTimeout(resolve, 0);
      });
      await flushMicrotasks(10);
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(getReportedErrorPayload(0)).toMatchObject({
      source: "analytics_instrumentation",
      userAction: "analytics_pageview_dispatch",
      category: "network_error",
      metadata: expect.objectContaining({
        analyticsFailureBucket: "network",
        pagePath: "/user/[username]?filter=[redacted]",
        pageTitle: "user_profile",
      }),
    });
  });
});
