import "@/tests/unit/__setup__";

import { cleanup, render, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { Window } from "happy-dom";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

import {
  buildErrorFallbackModel,
  ErrorFallbackPanel,
} from "@/components/ErrorBoundary";

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

beforeEach(() => {
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
});
