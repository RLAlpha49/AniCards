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
import { type ComponentProps, forwardRef, type ReactNode } from "react";

const routerPush = mock((href: string) => Promise.resolve(href));
const routerReplace = mock((href: string) => Promise.resolve(href));
const ANALYTICS_CONSENT_STORAGE_KEY = "anicards:analytics-consent:v1";
const LAST_SUCCESSFUL_USER_PAGE_ROUTE_STORAGE_KEY =
  "anicards:last-successful-user-page-route:v1";
const PENDING_SETTINGS_TEMPLATE_APPLY_STORAGE_KEY =
  "anicards:user-page-settings-template-apply:v1";
const originalGtag = (globalThis as typeof globalThis & { gtag?: unknown })
  .gtag;
const originalTrackingId = process.env.NEXT_PUBLIC_GOOGLE_ANALYTICS_ID;
const gtagMock = mock(
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  (_command: string, _action: string, _params: Record<string, unknown>) =>
    undefined,
);
const NEXT_NAVIGATION_STATE_KEY = "__ANICARDS_TEST_NEXT_NAVIGATION__";
let rejectNextPush = false;
let restoreDomGlobals: (() => void) | null = null;
let SearchForm: typeof import("@/components/search/SearchForm").SearchForm;
let SearchHeroShell: typeof import("@/app/search/SearchHeroShell").default;

type NextNavigationState = {
  pathname: string;
  routerPush: (href: string) => unknown;
  routerReplace: (href: string) => unknown;
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
    routerReplace: () => Promise.resolve(undefined),
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

function omitStubProps<T extends object, K extends keyof T>(
  props: T,
  keys: readonly K[],
): Omit<T, K> {
  const next = { ...props };

  for (const key of keys) {
    Reflect.deleteProperty(next, key);
  }

  return next as Omit<T, K>;
}

mock.module("next/navigation", () => ({
  usePathname: () => getNextNavigationState().pathname,
  useRouter: () => ({
    push: (href: string) => getNextNavigationState().routerPush(href),
    replace: (href: string) => getNextNavigationState().routerReplace(href),
  }),
  useSearchParams: () => getNextNavigationState().searchParams,
}));

mock.module("framer-motion", () => {
  const MotionDiv = ({ children, ...props }: MotionDivProps) => {
    const divProps = omitStubProps(props, [
      "animate",
      "exit",
      "initial",
      "transition",
      "variants",
      "viewport",
      "whileHover",
      "whileInView",
      "whileTap",
    ] as const);

    return <div {...divProps}>{children}</div>;
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
  Alert: ({ children, ...props }: AlertProps) => {
    const alertProps = omitStubProps(props, ["variant"] as const);

    return <div {...alertProps}>{children}</div>;
  },
  AlertDescription: ({ children, ...props }: ComponentProps<"p">) => (
    <p {...props}>{children}</p>
  ),
  AlertTitle: ({ children, ...props }: ComponentProps<"h2">) => (
    <h2 {...props}>{children}</h2>
  ),
}));

mock.module("@/components/ui/Button", () => ({
  Button: ({ children, type = "button", ...props }: ButtonProps) => {
    const buttonProps = omitStubProps(props, ["size", "variant"] as const);

    return (
      <button type={type} {...buttonProps}>
        {children}
      </button>
    );
  },
}));

mock.module("@/components/ui/Input", () => ({
  Input: forwardRef<HTMLInputElement, ComponentProps<"input">>((props, ref) => (
    <input ref={ref} {...props} />
  )),
}));

mock.module("@/components/ErrorBoundary", () => ({
  ErrorBoundary: ({ children }: { children?: ReactNode }) => <>{children}</>,
}));

mock.module("@/components/marketing/SectionReveal", () => ({
  SectionReveal: ({ children }: { children?: ReactNode }) => <>{children}</>,
}));

mock.module("@/components/search/SearchHeroSection", () => ({
  SearchHeroSection: ({
    onLoadingChange,
    onResumeQueuedEditor,
    queuedEditorResumeAvailable,
    pendingTemplateApply,
  }: {
    onLoadingChange: (loading: boolean) => void;
    onResumeQueuedEditor?: () => void;
    queuedEditorResumeAvailable?: boolean;
    pendingTemplateApply?: { templateName?: string } | null;
  }) => (
    <div>
      <button type="button" onClick={() => onLoadingChange(true)}>
        Start loading
      </button>
      <button type="button" onClick={() => onLoadingChange(false)}>
        Stop loading
      </button>
      <button type="button" onClick={() => onResumeQueuedEditor?.()}>
        Resume queued editor
      </button>
      <output data-testid="queued-editor-available">
        {queuedEditorResumeAvailable ? "true" : "false"}
      </output>
      <output data-testid="pending-template-name">
        {pendingTemplateApply?.templateName ?? ""}
      </output>
    </div>
  ),
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
  const animationFrameHandles = new Set<ReturnType<typeof setTimeout>>();

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
  assignGlobal("ResizeObserver", ResizeObserverStub);
  assignGlobal("IS_REACT_ACT_ENVIRONMENT", true);

  return () => {
    cleanup();

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

function submitSearchForm() {
  const form = document.querySelector("form");
  if (!(form instanceof HTMLFormElement)) {
    throw new TypeError("Expected the search form to be rendered.");
  }

  fireEvent.submit(form);
}

function switchToUserIdMode(view: ReturnType<typeof render>) {
  const radio = view.getByLabelText("User ID") as HTMLInputElement;

  fireEvent.click(radio);
  fireEvent.change(radio, {
    target: { checked: true },
  });
}

async function flushAnimationFrames(count = 2) {
  for (let frame = 0; frame < count; frame += 1) {
    await new Promise<void>((resolve) => {
      setTimeout(resolve, 0);
    });
  }
}

describe("SearchForm", () => {
  beforeAll(async () => {
    ({ SearchForm } = await import("@/components/search/SearchForm"));
    ({ default: SearchHeroShell } =
      await import("@/app/search/SearchHeroShell"));
  });

  beforeEach(() => {
    rejectNextPush = false;
    restoreDomGlobals = installDomGlobals();
    globalThis.window.localStorage.setItem(
      ANALYTICS_CONSENT_STORAGE_KEY,
      "granted",
    );
    process.env.NEXT_PUBLIC_GOOGLE_ANALYTICS_ID = "G-TEST123";
    routerPush.mockClear();
    routerReplace.mockClear();
    gtagMock.mockClear();
    Object.defineProperty(globalThis, "gtag", {
      configurable: true,
      value: gtagMock,
      writable: true,
    });
    (globalThis.window as unknown as Window & { gtag?: typeof gtagMock }).gtag =
      gtagMock;
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
      routerReplace: (href: string) => routerReplace(href),
      searchParams: new URLSearchParams(),
    } satisfies NextNavigationState;
  });

  afterEach(() => {
    restoreDomGlobals?.();
    restoreDomGlobals = null;
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
  });

  it("shows a validation error, restores focus, and records a failed search when the input is blank", async () => {
    const onLoadingChange = mock((loading: boolean) => loading);

    const view = render(<SearchForm onLoadingChange={onLoadingChange} />);
    submitSearchForm();

    const errorMessages = await view.findAllByText(
      "You'll need to enter an AniList username, profile link, or user ID first.",
    );
    const usernameInput = view.getByLabelText(
      "AniList Username",
    ) as HTMLInputElement;

    expect(errorMessages.length).toBeGreaterThan(0);
    expect(errorMessages[0]?.textContent).toBe(
      "You'll need to enter an AniList username, profile link, or user ID first.",
    );
    await flushAnimationFrames();
    expect(document.activeElement === usernameInput).toBe(true);
    expect(routerPush.mock.calls).toHaveLength(0);
    expect(onLoadingChange.mock.calls).toHaveLength(0);
    expect(gtagMock).toHaveBeenCalledTimes(1);
    expect(gtagMock.mock.calls[0]?.[0]).toBe("event");
    expect(gtagMock.mock.calls[0]?.[1]).toBe("form_submitted_error");
    expect(gtagMock.mock.calls[0]?.[2]).toMatchObject({
      event_category: "conversion",
      event_label: "user_search",
      send_to: "G-TEST123",
    });
  });

  it("switches to user ID mode, updates the form copy, and clears prior errors", async () => {
    const view = render(<SearchForm />);
    submitSearchForm();

    await view.findAllByText(
      "You'll need to enter an AniList username, profile link, or user ID first.",
    );

    switchToUserIdMode(view);

    await waitFor(() => {
      expect(
        view.queryAllByText(
          "You'll need to enter an AniList username, profile link, or user ID first.",
        ),
      ).toHaveLength(0);
    });

    const userIdInput = view.getByLabelText(
      "AniList User ID",
    ) as HTMLInputElement;

    expect(userIdInput.placeholder).toBe("e.g., 542244 or /user/542244");
    expect(view.getByRole("status").textContent).toContain(
      "Search mode changed to AniList user ID.",
    );
    expect(routerReplace.mock.calls).toEqual([["/search?mode=userId"]]);
  });

  it("honors the search page mode and query contract from server props", () => {
    const view = render(
      <SearchForm initialSearchMode="userId" initialSearchValue="542244" />,
    );
    const userIdInput = view.getByLabelText(
      "AniList User ID",
    ) as HTMLInputElement;

    expect(userIdInput.value).toBe("542244");
    expect(view.queryByLabelText("AniList Username")).toBeNull();
  });

  it("keeps username-like values in the user ID search UI and selects them for correction", async () => {
    const onLoadingChange = mock((loading: boolean) => loading);

    const view = render(<SearchForm onLoadingChange={onLoadingChange} />);
    const user = userEvent.setup({ document: globalThis.document });

    switchToUserIdMode(view);
    await user.type(view.getByLabelText("AniList User ID"), "54two24");
    submitSearchForm();

    const errorMessages = await view.findAllByText(
      "That looks like a username or profile link. Switch to Username mode or paste a numeric AniList user ID.",
    );
    const userIdInput = view.getByLabelText(
      "AniList User ID",
    ) as HTMLInputElement;

    expect(errorMessages.length).toBeGreaterThan(0);
    expect(errorMessages[0]?.textContent).toBe(
      "That looks like a username or profile link. Switch to Username mode or paste a numeric AniList user ID.",
    );
    expect(userIdInput.value).toBe("54two24");
    expect(routerPush.mock.calls).toHaveLength(0);
    expect(onLoadingChange.mock.calls).toHaveLength(0);
    expect(gtagMock).toHaveBeenCalledTimes(1);
    expect(gtagMock.mock.calls[0]?.[1]).toBe("form_submitted_error");
  });

  it("normalizes AniList profile URLs before navigating from username mode", async () => {
    const onLoadingChange = mock((loading: boolean) => loading);

    const view = render(<SearchForm onLoadingChange={onLoadingChange} />);
    const user = userEvent.setup({ document: globalThis.document });

    await user.type(
      view.getByLabelText("AniList Username"),
      "https://anilist.co/user/Alpha49/animelist",
    );
    submitSearchForm();

    await waitFor(() => {
      expect(routerPush.mock.calls).toEqual([["/user/Alpha49"]]);
    });

    expect(onLoadingChange.mock.calls).toEqual([[true]]);
  });

  it("treats bare numeric input in username mode as a user ID lookup", async () => {
    const onLoadingChange = mock((loading: boolean) => loading);

    const view = render(<SearchForm onLoadingChange={onLoadingChange} />);
    const user = userEvent.setup({ document: globalThis.document });

    await user.type(view.getByLabelText("AniList Username"), "000542244");
    submitSearchForm();

    await waitFor(() => {
      expect(routerPush.mock.calls).toEqual([["/user?userId=542244"]]);
    });

    expect(onLoadingChange.mock.calls).toEqual([[true]]);
  });

  it("normalizes numeric AniList IDs before navigating to the user lookup route", async () => {
    const onLoadingChange = mock((loading: boolean) => loading);

    const view = render(<SearchForm onLoadingChange={onLoadingChange} />);
    const user = userEvent.setup({ document: globalThis.document });

    switchToUserIdMode(view);
    await user.type(view.getByLabelText("AniList User ID"), " 000542244 ");
    submitSearchForm();

    await waitFor(() => {
      expect(routerPush.mock.calls).toEqual([["/user?userId=542244"]]);
    });

    expect(onLoadingChange.mock.calls).toEqual([[true]]);
    expect(gtagMock).toHaveBeenCalledTimes(2);
    expect(gtagMock.mock.calls[0]?.[1]).toBe("form_submitted_success");
    expect(gtagMock.mock.calls[1]?.[1]).toBe("navigation");
  });

  it("routes successful username lookups after paint and keeps the loading state visible", async () => {
    const onLoadingChange = mock((loading: boolean) => loading);

    const view = render(<SearchForm onLoadingChange={onLoadingChange} />);
    const user = userEvent.setup({ document: globalThis.document });

    await user.type(view.getByLabelText("AniList Username"), "  @Alpha49  ");
    submitSearchForm();

    await waitFor(() => {
      expect(routerPush.mock.calls).toEqual([["/user/Alpha49"]]);
    });

    expect(onLoadingChange.mock.calls).toEqual([[true]]);
    expect(gtagMock).toHaveBeenCalledTimes(2);
    expect(gtagMock.mock.calls[0]?.[0]).toBe("event");
    expect(gtagMock.mock.calls[0]?.[1]).toBe("form_submitted_success");
    expect(gtagMock.mock.calls[0]?.[2]).toMatchObject({
      event_category: "conversion",
      event_label: "user_search",
      send_to: "G-TEST123",
    });
    expect(gtagMock.mock.calls[1]?.[0]).toBe("event");
    expect(gtagMock.mock.calls[1]?.[1]).toBe("navigation");
    expect(gtagMock.mock.calls[1]?.[2]).toMatchObject({
      event_category: "engagement",
      event_label: "search_form_to_user_page",
      send_to: "G-TEST123",
    });
    expect(
      view.getByRole("button", { name: /pulling up the page/i }),
    ).toBeTruthy();
  });

  it("surfaces navigation failures and restores the non-loading form state", async () => {
    const onLoadingChange = mock((loading: boolean) => loading);
    rejectNextPush = true;

    const view = render(<SearchForm onLoadingChange={onLoadingChange} />);
    const user = userEvent.setup({ document: globalThis.document });

    switchToUserIdMode(view);
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

  it("treats the blocking search overlay like a modal status region and restores focus when loading ends", async () => {
    const outsideShellButton = document.createElement("button");
    outsideShellButton.type = "button";
    outsideShellButton.textContent = "Outside shell";
    document.body.append(outsideShellButton);

    const view = render(
      <SearchHeroShell initialSearchMode="username" initialSearchValue="" />,
    );

    const startLoadingButton = view.getByRole("button", {
      name: /start loading/i,
    }) as HTMLButtonElement;
    const stopLoadingButton = view.getByRole("button", {
      name: /stop loading/i,
    });
    const heroContent = view.getByTestId("search-hero-content");

    startLoadingButton.focus();
    expect(document.activeElement).toBe(startLoadingButton);

    fireEvent.click(startLoadingButton);

    const loadingDialog = await view.findByRole("dialog", {
      name: /opening anilist profile/i,
    });

    expect(loadingDialog.getAttribute("aria-modal")).toBe("true");
    expect(loadingDialog.getAttribute("aria-busy")).toBe("true");
    expect(loadingDialog.textContent).toContain(
      "Tracking down that profile...",
    );
    expect(heroContent.getAttribute("aria-hidden")).toBe("true");
    expect(heroContent.hasAttribute("inert")).toBe(true);
    expect(outsideShellButton.getAttribute("aria-hidden")).toBe("true");
    expect(outsideShellButton.hasAttribute("inert")).toBe(true);

    await flushAnimationFrames();
    expect(document.activeElement === loadingDialog).toBe(true);

    fireEvent.click(stopLoadingButton);

    await waitFor(() => {
      expect(
        view.queryByRole("dialog", { name: /opening anilist profile/i }),
      ).toBeNull();
    });

    expect(heroContent.hasAttribute("inert")).toBe(false);
    expect(outsideShellButton.hasAttribute("inert")).toBe(false);
    expect(outsideShellButton.hasAttribute("aria-hidden")).toBe(false);
    await flushAnimationFrames();
    expect(document.activeElement === startLoadingButton).toBe(true);
  });

  it("preserves queued example state and remembered editor resumes in the shell", async () => {
    globalThis.window.sessionStorage.setItem(
      PENDING_SETTINGS_TEMPLATE_APPLY_STORAGE_KEY,
      JSON.stringify({
        templateId: "example:anime-stats:minimal:light",
        templateName: "Anime Stats — Minimal (Light)",
        applyTo: "global",
        source: "examples",
        queuedAt: Date.now(),
      }),
    );
    globalThis.window.sessionStorage.setItem(
      LAST_SUCCESSFUL_USER_PAGE_ROUTE_STORAGE_KEY,
      JSON.stringify({
        href: "/user/Alpha49",
        userId: "542244",
        username: "Alpha49",
        savedAt: Date.now(),
      }),
    );

    const view = render(
      <SearchHeroShell initialSearchMode="username" initialSearchValue="" />,
    );

    await waitFor(() => {
      expect(view.getByTestId("queued-editor-available").textContent).toBe(
        "true",
      );
    });

    expect(view.getByTestId("pending-template-name").textContent).toBe(
      "Anime Stats — Minimal (Light)",
    );

    fireEvent.click(
      view.getByRole("button", { name: /resume queued editor/i }),
    );

    await waitFor(() => {
      expect(routerPush.mock.calls).toContainEqual(["/user/Alpha49"]);
    });

    expect(
      view.getByRole("dialog", { name: /opening anilist profile/i }),
    ).toBeTruthy();
  });
});
