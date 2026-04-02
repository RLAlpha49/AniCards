import "@/tests/unit/__setup__";

import {
  afterAll,
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  mock,
} from "bun:test";
import type { ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";

const capturedScripts: Array<{
  children?: ReactNode;
  id?: string;
  nonce?: string;
  onError?: (error: Error) => void;
  src?: string;
  strategy?: string;
}> = [];
const originalLocation = globalThis.location;
const originalWindow = globalThis.window;
const originalFetch = globalThis.fetch;
let fetchMock: ReturnType<typeof mock>;

mock.module("next/script", () => ({
  default: ({
    children,
    id,
    nonce,
    onError,
    src,
    strategy,
  }: {
    children?: ReactNode;
    id?: string;
    nonce?: string;
    onError?: (error: Error) => void;
    src?: string;
    strategy?: string;
  }) => {
    capturedScripts.push({
      children,
      id,
      nonce,
      onError,
      src,
      strategy,
    });

    return (
      <script data-src={src} data-strategy={strategy} id={id} nonce={nonce}>
        {children}
      </script>
    );
  },
}));

import GoogleAnalytics from "@/components/GoogleAnalytics";

function getReportedErrorPayload(callIndex = 0) {
  const fetchCall = fetchMock.mock.calls[callIndex] as
    | [string, RequestInit]
    | undefined;

  expect(fetchCall?.[0]).toBe("/api/error-reports");
  expect(fetchCall?.[1]?.method).toBe("POST");

  return JSON.parse(String(fetchCall?.[1]?.body)) as {
    category?: string;
    metadata?: Record<string, unknown>;
    source?: string;
    userAction?: string;
  };
}

function createStorageMock(): Storage {
  const values = new Map<string, string>();

  return {
    clear: () => {
      values.clear();
    },
    getItem: (key) => values.get(key) ?? null,
    key: (index) => Array.from(values.keys())[index] ?? null,
    get length() {
      return values.size;
    },
    removeItem: (key) => {
      values.delete(key);
    },
    setItem: (key, value) => {
      values.set(key, String(value));
    },
  };
}

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

describe("GoogleAnalytics", () => {
  beforeEach(() => {
    capturedScripts.length = 0;
    fetchMock = mock(
      async () =>
        new Response(JSON.stringify({ recorded: true }), {
          headers: { "Content-Type": "application/json" },
          status: 200,
        }),
    );

    Object.defineProperty(globalThis, "window", {
      value: {
        localStorage: createStorageMock(),
      } as Window,
      configurable: true,
      writable: true,
    });
    Object.defineProperty(globalThis, "location", {
      value: new URL("https://anicards.test/user/Alex"),
      configurable: true,
      writable: true,
    });
    Object.defineProperty(globalThis, "fetch", {
      value: fetchMock,
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
  });

  afterAll(() => {
    mock.restore();
  });

  it("omits the deprecated anonymize_ip flag while preserving privacy-safe GA config", () => {
    const markup = renderToStaticMarkup(
      <GoogleAnalytics
        trackingId="G-TEST123"
        consentGranted={true}
        nonce="nonce-123"
      />,
    );

    expect(markup).not.toContain("anonymize_ip");
    expect(markup).toContain("allow_google_signals: false");
    expect(markup).toContain("allow_ad_personalization_signals: false");
    expect(markup).toContain("send_page_view: false");
    expect(markup).toContain("window.gtag('consent', 'default'");
    expect(markup).toContain('nonce="nonce-123"');
    expect(markup).toContain(
      "https://www.googletagmanager.com/gtag/js?id=G-TEST123",
    );
  });

  it("reports loader failures through structured telemetry instead of console-only paths", async () => {
    renderToStaticMarkup(
      <GoogleAnalytics
        trackingId="G-TEST123"
        consentGranted={true}
        nonce="nonce-123"
      />,
    );

    const loaderScript = capturedScripts.find(
      (script) => script.id === "google-analytics-loader",
    );

    expect(loaderScript?.onError).toBeDefined();

    loaderScript?.onError?.(new TypeError("Failed to load script"));
    await flushAnalyticsTelemetry();

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(getReportedErrorPayload(0)).toMatchObject({
      source: "analytics_instrumentation",
      userAction: "analytics_script_load",
      category: "network_error",
      metadata: expect.objectContaining({
        analyticsFailureBucket: "runtime",
        consentGranted: true,
        pagePath: "/user/Alex",
      }),
    });
  });
});
