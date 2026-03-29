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
const originalGtag = (globalThis as typeof globalThis & { gtag?: unknown })
  .gtag;
const gtagMock = mock(() => {});

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

beforeEach(() => {
  resetHappyDom();
  pathname = "/user/Alex";
  searchParams = new URLSearchParams("q=naruto");
  gtagMock.mockReset();
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
});

afterEach(() => {
  cleanup();
  Object.defineProperty(globalThis, "gtag", {
    configurable: true,
    value: originalGtag,
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
});
