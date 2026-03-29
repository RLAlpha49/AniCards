import "@/tests/unit/__setup__";

import { cleanup, fireEvent, render, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  mock,
} from "bun:test";
import { Window } from "happy-dom";
import type { ComponentProps, ReactNode } from "react";

const routerPush = mock((href: string) => Promise.resolve(href));
const trackFormSubmission = mock(
  (formName: string, wasSuccessful: boolean) => ({
    formName,
    wasSuccessful,
  }),
);
const trackNavigation = mock((destination: string, source: string) => ({
  destination,
  source,
}));
const trackColorPresetSelection = mock((preset: string) => preset);
const NEXT_NAVIGATION_STATE_KEY = "__ANICARDS_TEST_NEXT_NAVIGATION__";
let rejectNextPush = false;
let restoreDomGlobals: (() => void) | null = null;
let SearchForm: typeof import("@/components/search/SearchForm").SearchForm;

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

type MotionDivProps = ComponentProps<"div"> & {
  animate?: unknown;
  exit?: unknown;
  initial?: unknown;
  transition?: unknown;
  variants?: unknown;
  viewport?: unknown;
  whileHover?: unknown;
  whileInView?: unknown;
  whileTap?: unknown;
};

type AlertProps = ComponentProps<"div"> & {
  variant?: string;
};

type ButtonProps = ComponentProps<"button"> & {
  size?: string;
  variant?: string;
};

mock.module("next/navigation", () => ({
  usePathname: () => getNextNavigationState().pathname,
  useRouter: () => ({
    push: (href: string) => getNextNavigationState().routerPush(href),
  }),
  useSearchParams: () => getNextNavigationState().searchParams,
}));

mock.module("framer-motion", () => {
  const MotionDiv = ({
    animate,
    children,
    exit,
    initial,
    transition,
    variants,
    viewport,
    whileHover,
    whileInView,
    whileTap,
    ...props
  }: MotionDivProps) => {
    void animate;
    void exit;
    void initial;
    void transition;
    void variants;
    void viewport;
    void whileHover;
    void whileInView;
    void whileTap;

    return <div {...props}>{children}</div>;
  };

  return {
    AnimatePresence: ({ children }: { children?: ReactNode }) => (
      <>{children}</>
    ),
    motion: {
      div: MotionDiv,
    },
  };
});

mock.module("@/components/ui/Alert", () => ({
  Alert: ({ children, variant, ...props }: AlertProps) => {
    void variant;
    return <div {...props}>{children}</div>;
  },
  AlertDescription: ({ children, ...props }: ComponentProps<"p">) => (
    <p {...props}>{children}</p>
  ),
  AlertTitle: ({ children, ...props }: ComponentProps<"h2">) => (
    <h2 {...props}>{children}</h2>
  ),
}));

mock.module("@/components/ui/Button", () => ({
  Button: ({
    children,
    size,
    type = "button",
    variant,
    ...props
  }: ButtonProps) => {
    void size;
    void variant;

    return (
      <button type={type} {...props}>
        {children}
      </button>
    );
  },
}));

mock.module("@/components/ui/Input", () => ({
  Input: (props: ComponentProps<"input">) => <input {...props} />,
}));

mock.module("@/lib/utils/google-analytics", () => ({
  safeTrack: (callback: () => void) => callback(),
  trackColorPresetSelection,
  trackFormSubmission,
  trackNavigation,
}));

function installDomGlobals() {
  const window = new Window({
    url: "http://localhost/search",
  });
  Object.assign(window, {
    Error,
    SyntaxError,
    TypeError,
  });
  const descriptors = new Map<string, PropertyDescriptor | undefined>();

  const assignGlobal = (key: string, value: unknown) => {
    descriptors.set(key, Object.getOwnPropertyDescriptor(globalThis, key));
    Object.defineProperty(globalThis, key, {
      configurable: true,
      value,
      writable: true,
    });
  };

  class ResizeObserverStub {
    observe() {
      return undefined;
    }

    unobserve() {
      return undefined;
    }

    disconnect() {
      return undefined;
    }
  }

  assignGlobal("window", window);
  assignGlobal("document", window.document);
  assignGlobal("navigator", window.navigator);
  assignGlobal("CustomEvent", window.CustomEvent);
  assignGlobal("Element", window.Element);
  assignGlobal("Event", window.Event);
  assignGlobal("EventTarget", window.EventTarget);
  assignGlobal("FocusEvent", window.FocusEvent);
  assignGlobal("HTMLElement", window.HTMLElement);
  assignGlobal("HTMLButtonElement", window.HTMLButtonElement);
  assignGlobal("HTMLFormElement", window.HTMLFormElement);
  assignGlobal("HTMLInputElement", window.HTMLInputElement);
  assignGlobal("InputEvent", window.InputEvent);
  assignGlobal("KeyboardEvent", window.KeyboardEvent);
  assignGlobal("MouseEvent", window.MouseEvent);
  assignGlobal("MutationObserver", window.MutationObserver);
  assignGlobal("Node", window.Node);
  assignGlobal("SVGElement", window.SVGElement);
  assignGlobal("Text", window.Text);
  assignGlobal("getComputedStyle", window.getComputedStyle.bind(window));
  assignGlobal("requestAnimationFrame", ((callback: FrameRequestCallback) =>
    setTimeout(
      () => callback(Date.now()),
      0,
    )) as unknown as typeof requestAnimationFrame);
  assignGlobal("cancelAnimationFrame", ((
    handle: ReturnType<typeof setTimeout>,
  ) => clearTimeout(handle)) as unknown as typeof cancelAnimationFrame);
  assignGlobal("ResizeObserver", ResizeObserverStub);
  assignGlobal("IS_REACT_ACT_ENVIRONMENT", true);

  return () => {
    cleanup();

    for (const [key, descriptor] of descriptors) {
      if (descriptor) {
        Object.defineProperty(globalThis, key, descriptor);
      } else {
        Reflect.deleteProperty(globalThis, key);
      }
    }

    window.document.body.innerHTML = "";

    if (typeof window.close === "function") {
      window.close();
    }
  };
}

function submitSearchForm() {
  const form = document.querySelector("form");
  if (!(form instanceof HTMLFormElement)) {
    throw new TypeError("Expected the search form to be rendered.");
  }

  fireEvent.submit(form);
}

describe("SearchForm", () => {
  beforeAll(async () => {
    ({ SearchForm } = await import("@/components/search/SearchForm"));
  });

  beforeEach(() => {
    rejectNextPush = false;
    restoreDomGlobals = installDomGlobals();
    routerPush.mockClear();
    trackFormSubmission.mockClear();
    trackNavigation.mockClear();
    (globalThis as Record<string, unknown>)[NEXT_NAVIGATION_STATE_KEY] = {
      pathname: "/search",
      routerPush: (href: string) => {
        const result = routerPush(href);

        if (rejectNextPush) {
          rejectNextPush = false;
          return Promise.reject(new Error("Navigation failed"));
        }

        return result;
      },
      searchParams: new URLSearchParams(),
    } satisfies NextNavigationState;
  });

  afterEach(() => {
    restoreDomGlobals?.();
    restoreDomGlobals = null;
  });

  afterAll(() => {
    mock.restore();
  });

  it("shows a validation error and records a failed search when the input is blank", async () => {
    const onLoadingChange = mock((loading: boolean) => loading);

    const view = render(<SearchForm onLoadingChange={onLoadingChange} />);
    submitSearchForm();

    const errorMessage = await view.findByText(
      "You'll need to enter a username first",
    );

    expect(errorMessage.textContent).toBe(
      "You'll need to enter a username first",
    );
    expect(routerPush.mock.calls).toHaveLength(0);
    expect(onLoadingChange.mock.calls).toHaveLength(0);
    expect(trackFormSubmission.mock.calls).toEqual([["user_search", false]]);
    expect(trackNavigation.mock.calls).toHaveLength(0);
  });

  it("switches to user ID mode, updates the form copy, and clears prior errors", async () => {
    const view = render(<SearchForm />);
    submitSearchForm();

    await view.findByText("You'll need to enter a username first");

    fireEvent.click(view.getByRole("radio", { name: "User ID" }));

    await waitFor(() => {
      expect(
        view.queryByText("You'll need to enter a username first"),
      ).toBeNull();
    });

    const userIdInput = view.getByLabelText(
      "AniList User ID",
    ) as HTMLInputElement;

    expect(userIdInput.placeholder).toBe("e.g., 542244");
    expect(view.getByRole("status").textContent).toContain(
      "Search mode changed to AniList user ID.",
    );
  });

  it("routes successful username lookups after paint and keeps the loading state visible", async () => {
    const onLoadingChange = mock((loading: boolean) => loading);

    const view = render(<SearchForm onLoadingChange={onLoadingChange} />);
    const user = userEvent.setup({ document: globalThis.document });

    await user.type(view.getByLabelText("AniList Username"), "  Alpha 49  ");
    submitSearchForm();

    await waitFor(() => {
      expect(routerPush.mock.calls).toEqual([["/user/Alpha%2049"]]);
    });

    expect(onLoadingChange.mock.calls).toEqual([[true]]);
    expect(trackFormSubmission.mock.calls).toEqual([["user_search", true]]);
    expect(trackNavigation.mock.calls).toEqual([["user_page", "search_form"]]);
    expect(
      view.getByRole("button", { name: /pulling up their page/i }),
    ).toBeTruthy();
  });

  it("surfaces navigation failures and restores the non-loading form state", async () => {
    const onLoadingChange = mock((loading: boolean) => loading);
    rejectNextPush = true;

    const view = render(<SearchForm onLoadingChange={onLoadingChange} />);
    const user = userEvent.setup({ document: globalThis.document });

    fireEvent.click(view.getByRole("radio", { name: "User ID" }));
    await user.type(view.getByLabelText("AniList User ID"), "542244");
    submitSearchForm();

    await waitFor(() => {
      expect(routerPush.mock.calls).toEqual([["/user?userId=542244"]]);
    });

    const errorMessage = await view.findByText(
      "Something went wrong with navigation. Try again?",
    );

    expect(errorMessage.textContent).toBe(
      "Something went wrong with navigation. Try again?",
    );
    expect(onLoadingChange.mock.calls).toEqual([[true], [false]]);
    expect(view.getByRole("button", { name: /find profile/i })).toBeTruthy();
  });
});
