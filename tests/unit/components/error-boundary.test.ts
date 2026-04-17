import { cleanup, render, waitFor } from "@testing-library/react";
import {
  afterAll,
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  mock,
} from "bun:test";
import { createElement, type ErrorInfo } from "react";
import { renderToStaticMarkup } from "react-dom/server";

import {
  buildErrorFallbackModel,
  ErrorBoundary,
  ErrorFallbackPanel,
} from "@/components/ErrorBoundary";
import { useAppRouterErrorBoundaryReporting } from "@/hooks/useAppRouterErrorBoundaryReporting";
import {
  allowConsoleWarningsAndErrors,
  parseRequestInitJson,
} from "@/tests/unit/__setup__";
import {
  installHappyDom,
  resetHappyDom,
  restoreHappyDom,
} from "@/tests/unit/hooks/test-helpers";

installHappyDom("http://localhost/error-boundary");

function parseJsonString<T>(value: unknown, label: string): T {
  if (typeof value !== "string") {
    throw new TypeError(`Expected ${label} to be a JSON string.`);
  }

  return JSON.parse(value) as T;
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

  return parseJsonString<{
    endpoint?: string;
    message?: string;
    context?: Record<string, string>;
  }>(calls.at(-1)?.[0], `${method} console payload`);
}

function AppRouterBoundaryHarness(
  props: Readonly<{
    error: Error & { digest?: string };
  }>,
) {
  const { incidentReference } = useAppRouterErrorBoundaryReporting({
    error: props.error,
    boundary: "app_root_error",
    defaultErrorName: "AppRouteError",
    logLabel: "[AppErrorBoundary] Caught route error:",
    userAction: "route_segment_render",
  });

  return createElement(
    "output",
    { "data-testid": "incident-reference" },
    incidentReference ?? "",
  );
}

function ThrowingComponent(props: Readonly<{ error: Error }>): null {
  throw props.error;
}

beforeEach(() => {
  allowConsoleWarningsAndErrors();
  resetHappyDom("http://localhost/error-boundary");
});

afterEach(async () => {
  cleanup();
  await Promise.resolve();
  await new Promise<void>((resolve) => {
    setTimeout(resolve, 0);
  });
});

afterAll(() => {
  restoreHappyDom();
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

  it("uses structured status, category, and recovery metadata when available", () => {
    const customSuggestions = [
      {
        title: "Reload the latest data",
        description: "Refresh the page before trying again.",
      },
    ];
    const forbiddenModel = buildErrorFallbackModel(
      Object.assign(new Error("Protected request rejected"), {
        statusCode: 403,
      }),
    );
    const validationModel = buildErrorFallbackModel(
      Object.assign(new Error("Validation failed"), {
        status: 422,
      }),
    );
    const conflictModel = buildErrorFallbackModel(
      Object.assign(new Error("Unexpected save failure"), {
        category: "conflict" as const,
        retryable: false,
        recoverySuggestions: customSuggestions,
      }),
    );

    expect(forbiddenModel.message).toBe("This request is blocked");
    expect(forbiddenModel.retryable).toBe(false);
    expect(validationModel.message).toBe(
      "Some information needs to be corrected",
    );
    expect(validationModel.retryable).toBe(false);
    expect(conflictModel.message).toBe("This page is out of date");
    expect(conflictModel.retryable).toBe(false);
    expect(conflictModel.suggestions).toEqual(customSuggestions);
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
        createElement(
          ErrorBoundary,
          undefined,
          createElement(ThrowingComponent, {
            error: new Error("Failed to fetch user Alex profile"),
          }),
        ),
      );

      await waitFor(() => {
        expect(fetchMock).toHaveBeenCalledTimes(1);
      });

      const firstFetchCall = fetchMock.mock.calls[0] as unknown[] | undefined;
      expect(firstFetchCall).toBeTruthy();

      const payload = parseRequestInitJson<{
        id?: string;
      }>(firstFetchCall?.[1] as RequestInit | undefined);

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

  it("hides retry by default for non-retryable fallbacks", () => {
    const { queryByRole } = render(
      createElement(ErrorFallbackPanel, {
        error: Object.assign(
          new Error(
            "Conflict: data was updated elsewhere. Please reload and try again.",
          ),
          {
            statusCode: 409,
          },
        ),
        onRetry: () => undefined,
      }),
    );

    expect(queryByRole("button", { name: /try again/i })).toBeNull();
  });

  it("allows retry to be explicitly opted in for non-retryable fallbacks", () => {
    const { getByRole } = render(
      createElement(ErrorFallbackPanel, {
        error: Object.assign(
          new Error(
            "Conflict: data was updated elsewhere. Please reload and try again.",
          ),
          {
            statusCode: 409,
          },
        ),
        onRetry: () => undefined,
        allowRetryWhenNonRetryable: true,
      }),
    );

    expect(getByRole("button", { name: /try again/i })).toBeTruthy();
  });

  it("surfaces the resolved structured incident ID for App Router boundaries", async () => {
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
      const error = Object.assign(
        new Error("Failed to fetch user Alex profile"),
        {
          digest: "digest-route-12345",
        },
      );
      const { getByTestId } = render(
        createElement(AppRouterBoundaryHarness, { error }),
      );

      await waitFor(() => {
        expect(fetchMock).toHaveBeenCalledTimes(1);
      });

      const firstFetchCall = fetchMock.mock.calls[0] as unknown[] | undefined;
      expect(firstFetchCall).toBeTruthy();

      const payload = parseRequestInitJson<{
        id?: string;
      }>(firstFetchCall?.[1] as RequestInit | undefined);

      await waitFor(() => {
        expect(payload.id).toBeTruthy();
        expect(getByTestId("incident-reference").textContent).toBe(
          String(payload.id),
        );
        expect(getByTestId("incident-reference").textContent).not.toBe(
          error.digest,
        );
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
      const serializedLogEntry = JSON.stringify(logEntry);

      expect(logEntry.endpoint).toBe("ErrorBoundary");
      expect(logEntry.message).toBe("React error boundary caught render error");
      expect(logEntry.context?.boundary).toBe("client_error_boundary");
      expect(logEntry.context?.route).toBe("/error-boundary");
      expect(logEntry.context?.error).toContain("[redacted-email]");
      expect(logEntry.context?.error).toContain("[redacted-url]");
      expect(logEntry.context?.componentStack).toContain("at PrivateCard");
      expect(serializedLogEntry).not.toContain("alex@example.com");
      expect(serializedLogEntry).not.toContain(
        "super-secret-token-value-1234567890",
      );
      expect(serializedLogEntry).not.toContain("/Users/Alex/private");
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
      const serializedLogEntry = JSON.stringify(logEntry);

      expect(logEntry.endpoint).toBe("AppRouterErrorBoundary");
      expect(logEntry.message).toBe(
        "App Router error boundary caught route error",
      );
      expect(logEntry.context?.boundary).toBe("app_root_error");
      expect(logEntry.context?.digest).toBe("digest-route-12345");
      expect(logEntry.context?.route).toBe("/error-boundary");
      expect(logEntry.context?.error).toContain("[redacted-email]");
      expect(logEntry.context?.error).toContain("[redacted-url]");
      expect(serializedLogEntry).not.toContain("alex@example.com");
      expect(serializedLogEntry).not.toContain(
        "super-secret-token-value-1234567890",
      );
      expect(serializedLogEntry).not.toContain("/Users/Alex/private");
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
