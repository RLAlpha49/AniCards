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
import type { ComponentProps, ReactNode } from "react";

import {
  flushMicrotasks,
  installHappyDom,
  resetHappyDom,
  restoreHappyDom,
} from "@/tests/unit/hooks/test-helpers";

installHappyDom("https://anicards.test/user/Alpha49");

const { cleanup, fireEvent, render, waitFor } =
  await import("@testing-library/react");

let restoreMatchMedia: (() => void) | null = null;
let restoreElementConstructors: (() => void) | null = null;
let restoreNodeFilter: (() => void) | null = null;
let restoreScrollTo: (() => void) | null = null;

function installMatchMediaStub() {
  const domWindow = globalThis.window;
  const previousMatchMedia = domWindow.matchMedia;
  const matchMedia = (query: string): MediaQueryList => ({
    matches: false,
    media: query,
    onchange: null,
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
    addListener: () => undefined,
    removeListener: () => undefined,
    dispatchEvent: () => false,
  });

  Object.defineProperty(domWindow, "matchMedia", {
    configurable: true,
    value: matchMedia,
    writable: true,
  });

  return () => {
    if (previousMatchMedia) {
      Object.defineProperty(domWindow, "matchMedia", {
        configurable: true,
        value: previousMatchMedia,
        writable: true,
      });
      return;
    }

    Reflect.deleteProperty(domWindow, "matchMedia");
  };
}

function installScrollToStub() {
  const previousScrollTo = HTMLElement.prototype.scrollTo;

  Object.defineProperty(HTMLElement.prototype, "scrollTo", {
    configurable: true,
    value: () => undefined,
    writable: true,
  });

  return () => {
    if (previousScrollTo) {
      Object.defineProperty(HTMLElement.prototype, "scrollTo", {
        configurable: true,
        value: previousScrollTo,
        writable: true,
      });
      return;
    }

    Reflect.deleteProperty(HTMLElement.prototype, "scrollTo");
  };
}

function installNodeFilterStub() {
  const domWindow = globalThis.window;
  const previousNodeFilter = globalThis.NodeFilter;

  Object.defineProperty(globalThis, "NodeFilter", {
    configurable: true,
    value: domWindow.NodeFilter,
    writable: true,
  });

  return () => {
    if (previousNodeFilter) {
      Object.defineProperty(globalThis, "NodeFilter", {
        configurable: true,
        value: previousNodeFilter,
        writable: true,
      });
      return;
    }

    Reflect.deleteProperty(globalThis, "NodeFilter");
  };
}

function installElementConstructorStubs() {
  const domWindow = globalThis.window;
  const constructors = [
    ["HTMLInputElement", domWindow.HTMLInputElement],
    ["HTMLSelectElement", domWindow.HTMLSelectElement],
    ["HTMLTextAreaElement", domWindow.HTMLTextAreaElement],
  ] as const;
  const previousConstructors = new Map<string, unknown>();

  for (const [name, ctor] of constructors) {
    previousConstructors.set(
      name,
      (globalThis as Record<string, unknown>)[name],
    );
    Object.defineProperty(globalThis, name, {
      configurable: true,
      value: ctor,
      writable: true,
    });
  }

  return () => {
    for (const [name, previousValue] of previousConstructors) {
      if (previousValue) {
        Object.defineProperty(globalThis, name, {
          configurable: true,
          value: previousValue,
          writable: true,
        });
        continue;
      }

      Reflect.deleteProperty(globalThis, name);
    }
  };
}

beforeEach(() => {
  resetHappyDom();
  restoreMatchMedia = installMatchMediaStub();
  restoreElementConstructors = installElementConstructorStubs();
  restoreNodeFilter = installNodeFilterStub();
  restoreScrollTo = installScrollToStub();
});

afterEach(async () => {
  cleanup();
  await flushMicrotasks();
  await new Promise<void>((resolve) => {
    setTimeout(resolve, 0);
  });
  restoreMatchMedia?.();
  restoreElementConstructors?.();
  restoreNodeFilter?.();
  restoreScrollTo?.();
  restoreMatchMedia = null;
  restoreElementConstructors = null;
  restoreNodeFilter = null;
  restoreScrollTo = null;
});

afterAll(async () => {
  await flushMicrotasks();
  await new Promise<void>((resolve) => {
    setTimeout(resolve, 0);
  });
  mock.restore();
  restoreHappyDom();
});

describe("UserHelpDialog topic semantics", () => {
  it("uses pressed state for topic buttons instead of aria-current", async () => {
    mock.module("@/hooks/useMotionPreferences", () => ({
      useMotionPreferences: () => ({
        prefersReducedMotion: false,
        prefersReducedData: false,
        prefersCoarsePointer: false,
        prefersSimplifiedMotion: false,
      }),
    }));

    mock.module("@/components/ui/Dialog", () => ({
      Dialog: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
      DialogContent: ({ children, ...props }: ComponentProps<"div">) => (
        <div {...props}>{children}</div>
      ),
      DialogHeader: ({ children, ...props }: ComponentProps<"div">) => (
        <div {...props}>{children}</div>
      ),
      DialogTitle: ({ children, ...props }: ComponentProps<"h2">) => (
        <h2 {...props}>{children}</h2>
      ),
      DialogDescription: ({ children, ...props }: ComponentProps<"p">) => (
        <p {...props}>{children}</p>
      ),
      DialogClose: ({
        asChild,
        children,
      }: {
        asChild?: boolean;
        children?: ReactNode;
      }) =>
        asChild ? <>{children}</> : <button type="button">{children}</button>,
    }));

    mock.module("@/components/ui/Button", () => ({
      Button: ({
        asChild,
        children,
        type = "button",
        ...props
      }: ComponentProps<"button"> & {
        asChild?: boolean;
        children?: ReactNode;
      }) =>
        asChild ? (
          <>{children}</>
        ) : (
          <button type={type} {...props}>
            {children}
          </button>
        ),
    }));

    const { UserHelpDialog } = await import("@/components/user/UserHelpDialog");

    const view = render(<UserHelpDialog open onOpenChange={() => undefined} />);

    const quickStartButtons = await view.findAllByRole("button", {
      name: /quick start/i,
    });
    const guidedTourButtons = await view.findAllByRole("button", {
      name: /guided tour/i,
    });

    expect(quickStartButtons.length).toBeGreaterThan(0);
    expect(guidedTourButtons.length).toBeGreaterThan(0);

    for (const button of quickStartButtons) {
      const controlsId = button.getAttribute("aria-controls");

      expect(button.getAttribute("aria-pressed")).toBe("true");
      expect(button.hasAttribute("aria-current")).toBe(false);
      expect(controlsId).not.toBeNull();
    }

    fireEvent.click(guidedTourButtons[0]!);

    await waitFor(() => {
      for (const button of guidedTourButtons) {
        expect(button.getAttribute("aria-pressed")).toBe("true");
        expect(button.hasAttribute("aria-current")).toBe(false);
      }

      for (const button of quickStartButtons) {
        expect(button.getAttribute("aria-pressed")).toBe("false");
      }
    });
  });
});
