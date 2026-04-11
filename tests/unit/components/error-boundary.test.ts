import "@/tests/unit/__setup__";

import { cleanup, render, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, mock } from "bun:test";
import { Window } from "happy-dom";
import { createElement, type ErrorInfo } from "react";
import { renderToStaticMarkup } from "react-dom/server";

import {
  buildErrorFallbackModel,
  ErrorBoundary,
  ErrorFallbackPanel,
} from "@/components/ErrorBoundary";
import { useAppRouterErrorBoundaryReporting } from "@/hooks/useAppRouterErrorBoundaryReporting";
import { allowConsoleWarningsAndErrors } from "@/tests/unit/__setup__";

let restoreDomGlobals: (() => Promise<void>) | null = null;

function installDomGlobals() {
  const window = new Window({
    url: "http://localhost/error-boundary",
  });
  Object.assign(window, {
    Error,
    SyntaxError,
    TypeError,
  });
  const descriptors = new Map<string, PropertyDescriptor | undefined>();
  const animationFrameHandles = new Set<ReturnType<typeof setTimeout>>();

  const assignGlobal = (key: string, value: unknown) => {
    descriptors.set(key, Object.getOwnPropertyDescriptor(globalThis, key));
    Object.defineProperty(globalThis, key, {
      configurable: true,
      value,
      writable: true,
    });
  };

  assignGlobal("window", window);
  assignGlobal("document", window.document);
  assignGlobal("location", window.location);
  assignGlobal("navigator", window.navigator);
  assignGlobal("CustomEvent", window.CustomEvent);
  assignGlobal("Element", window.Element);
  assignGlobal("Event", window.Event);
  assignGlobal("EventTarget", window.EventTarget);
  assignGlobal("FocusEvent", window.FocusEvent);
  assignGlobal("HTMLElement", window.HTMLElement);
  assignGlobal("HTMLAnchorElement", window.HTMLAnchorElement);
  assignGlobal("HTMLButtonElement", window.HTMLButtonElement);
  assignGlobal("Node", window.Node);
  assignGlobal("SVGElement", window.SVGElement);
  assignGlobal("Text", window.Text);
  assignGlobal("getComputedStyle", window.getComputedStyle.bind(window));
  assignGlobal("requestAnimationFrame", ((callback: FrameRequestCallback) => {
    const handle = setTimeout(() => {
      animationFrameHandles.delete(handle);
      callback(Date.now());
    }, 0);

    animationFrameHandles.add(handle);
    return handle;
  }) as unknown as typeof requestAnimationFrame);
  assignGlobal("cancelAnimationFrame", ((
    handle: ReturnType<typeof setTimeout>,
  ) => {
    animationFrameHandles.delete(handle);
    clearTimeout(handle);
  }) as unknown as typeof cancelAnimationFrame);
  assignGlobal("IS_REACT_ACT_ENVIRONMENT", true);

  return async () => {
    cleanup();

    await Promise.resolve();
    await new Promise<void>((resolve) => {
      setTimeout(resolve, 0);
    });

    for (const handle of animationFrameHandles) {
      clearTimeout(handle);
    }
    animationFrameHandles.clear();

    window.document.body.innerHTML = "";

    if (typeof window.close === "function") {
      window.close();
    }

    for (const [key, descriptor] of descriptors) {
      if (descriptor) {
        Object.defineProperty(globalThis, key, descriptor);
      } else {
        Reflect.deleteProperty(globalThis, key);
      }
    }
  };
}

function readLastConsoleJsonLog(method: "error" | "log") {
  const calls = (
    console[method] as unknown as {
      mock: {
        calls: Array<[string]>;
      };
    }
  ).mock.calls;

  expect(calls.length).toBeGreaterThan(0);

  return JSON.parse(String(calls.at(-1)?.[0])) as {
    endpoint?: string;
    message?: string;
    context?: Record<string, string>;
  };
}

function AppRouterBoundaryHarness(
  props: Readonly<{
    error: Error & { digest?: string };
  }>,
) {
  useAppRouterErrorBoundaryReporting({
    error: props.error,
    boundary: "app_root_error",
    defaultErrorName: "AppRouteError",
    logLabel: "[AppErrorBoundary] Caught route error:",
    userAction: "route_segment_render",
  });

  return null;
}

function ThrowingComponent(props: Readonly<{ error: Error }>): null {
  throw props.error;
}

beforeEach(() => {
  allowConsoleWarningsAndErrors();
  restoreDomGlobals = installDomGlobals();
});

afterEach(async () => {
  await restoreDomGlobals?.();
  restoreDomGlobals = null;
});

describe("ErrorBoundary fallback model", () => {
  it("maps raw runtime errors to safe user-facing fallback copy", () => {
    const model = buildErrorFallbackModel(
      new Error("Failed to fetch user Alex profile"),
    );

    expect(model.heading).toBe("Something went wrong");
    expect(model.message).toBe("Network connection error");
    expect(model.retryable).toBe(true);
    expect(
      model.suggestions.some(
        (suggestion) => suggestion.title === "Check your connection",
      ),
    ).toBe(true);
  });

  it("renders a privacy-safe incident reference when provided", () => {
    const markup = renderToStaticMarkup(
      createElement(ErrorFallbackPanel, {
        incidentReference: "digest-prod-12345",
      }),
    );

    expect(markup).toContain("Incident reference");
    expect(markup).toContain("digest-prod-12345");
    expect(markup).toContain('role="alert"');
    expect(markup).toContain('aria-live="assertive"');
  });

  it("surfaces the resolved structured incident ID in the client boundary fallback", async () => {
    const originalFetch = globalThis.fetch;
    const fetchMock = mock(() =>
      Promise.resolve(new Response(null, { status: 202 })),
    );

    Object.defineProperty(globalThis, "fetch", {
      value: fetchMock,
      configurable: true,
      writable: true,
    });

    try {
      render(
        createElement(ErrorBoundary, {
          children: createElement(ThrowingComponent, {
            error: new Error("Failed to fetch user Alex profile"),
          }),
        }),
      );

      await waitFor(() => {
        expect(fetchMock).toHaveBeenCalledTimes(1);
      });

      const firstFetchCall = fetchMock.mock.calls[0] as unknown[] | undefined;
      expect(firstFetchCall).toBeTruthy();

      const requestInit = firstFetchCall?.[1] as RequestInit | undefined;
      const payload = JSON.parse(String(requestInit?.body)) as {
        id?: string;
      };

      await waitFor(() => {
        expect(payload.id).toBeTruthy();
        expect(document.body.textContent).toContain("Incident reference");
        expect(document.body.textContent).toContain(String(payload.id));
      });
    } finally {
      Object.defineProperty(globalThis, "fetch", {
        value: originalFetch,
        configurable: true,
        writable: true,
      });
    }
  });

  it("moves focus to the announced fallback region when mounted", async () => {
    const { getByRole } = render(
      createElement(ErrorFallbackPanel, {
        error: new Error("Network request failed"),
        onRetry: () => undefined,
      }),
    );

    const alertRegion = getByRole("alert");

    await waitFor(() => {
      expect(document.activeElement).toBe(alertRegion);
    });
  });

  it("logs client boundary captures through the privacy-safe pipeline in production", async () => {
    const originalFetch = globalThis.fetch;
    const originalNodeEnv = process.env.NODE_ENV;
    const fetchMock = mock(() =>
      Promise.resolve(new Response(null, { status: 202 })),
    );

    Object.defineProperty(globalThis, "fetch", {
      value: fetchMock,
      configurable: true,
      writable: true,
    });
    (process.env as Record<string, string | undefined>).NODE_ENV = "production";

    try {
      const error = new Error(
        "Render failed for alex@example.com via https://example.com/reset?token=super-secret-token-value-1234567890",
      );
      error.name = "BoundaryError";
      error.stack = [
        "BoundaryError: Render failed for alex@example.com",
        "    at UserPage (/Users/Alex/private/project/file.ts:10:5)",
        "    at fetchProfile (https://example.com/profile?token=super-secret-token-value-1234567890:2:3)",
      ].join("\n");

      const boundary = new ErrorBoundary({ children: null });
      boundary.componentDidCatch(error, {
        componentStack: [
          "    at PrivateCard (/Users/Alex/private/project/PrivateCard.tsx:12:3)",
          "    at Layout (https://example.com/app/layout.tsx:20:2)",
        ].join("\n"),
      } as ErrorInfo);

      await waitFor(() => {
        expect(fetchMock).toHaveBeenCalledTimes(1);
      });

      const logEntry = readLastConsoleJsonLog("error");

      expect(logEntry.endpoint).toBe("ErrorBoundary");
      expect(logEntry.message).toBe("React error boundary caught render error");
      expect(logEntry.context?.boundary).toBe("client_error_boundary");
      expect(logEntry.context?.route).toBe("/error-boundary");
      expect(logEntry.context?.error).toContain("[redacted-email]");
      expect(logEntry.context?.error).toContain("[redacted-url]");
      expect(logEntry.context?.componentStack).toContain("at PrivateCard");
      expect(JSON.stringify(logEntry)).not.toContain("alex@example.com");
      expect(JSON.stringify(logEntry)).not.toContain(
        "super-secret-token-value-1234567890",
      );
      expect(JSON.stringify(logEntry)).not.toContain("/Users/Alex/private");
    } finally {
      Object.defineProperty(globalThis, "fetch", {
        value: originalFetch,
        configurable: true,
        writable: true,
      });
      (process.env as Record<string, string | undefined>).NODE_ENV =
        originalNodeEnv;
    }
  });

  it("logs App Router boundary captures through the privacy-safe pipeline in production", async () => {
    const originalFetch = globalThis.fetch;
    const originalNodeEnv = process.env.NODE_ENV;
    const fetchMock = mock(() =>
      Promise.resolve(new Response(null, { status: 202 })),
    );

    Object.defineProperty(globalThis, "fetch", {
      value: fetchMock,
      configurable: true,
      writable: true,
    });
    (process.env as Record<string, string | undefined>).NODE_ENV = "production";

    try {
      const error = Object.assign(
        new Error(
          "Route failed for alex@example.com via https://example.com/route?token=super-secret-token-value-1234567890",
        ),
        {
          digest: "digest-route-12345",
        },
      );
      error.name = "AppRouteError";
      error.stack = [
        "AppRouteError: Route failed for alex@example.com",
        "    at RouteSegment (/Users/Alex/private/project/segment.tsx:10:5)",
        "    at recoverRoute (https://example.com/error?token=super-secret-token-value-1234567890:2:3)",
      ].join("\n");

      render(createElement(AppRouterBoundaryHarness, { error }));

      await waitFor(() => {
        expect(fetchMock).toHaveBeenCalledTimes(1);
      });

      const logEntry = readLastConsoleJsonLog("error");

      expect(logEntry.endpoint).toBe("AppRouterErrorBoundary");
      expect(logEntry.message).toBe(
        "App Router error boundary caught route error",
      );
      expect(logEntry.context?.boundary).toBe("app_root_error");
      expect(logEntry.context?.digest).toBe("digest-route-12345");
      expect(logEntry.context?.route).toBe("/error-boundary");
      expect(logEntry.context?.error).toContain("[redacted-email]");
      expect(logEntry.context?.error).toContain("[redacted-url]");
      expect(JSON.stringify(logEntry)).not.toContain("alex@example.com");
      expect(JSON.stringify(logEntry)).not.toContain(
        "super-secret-token-value-1234567890",
      );
      expect(JSON.stringify(logEntry)).not.toContain("/Users/Alex/private");
    } finally {
      Object.defineProperty(globalThis, "fetch", {
        value: originalFetch,
        configurable: true,
        writable: true,
      });
      (process.env as Record<string, string | undefined>).NODE_ENV =
        originalNodeEnv;
    }
  });
});
