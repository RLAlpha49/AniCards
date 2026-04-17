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
import { type ComponentProps, forwardRef, type ReactNode } from "react";

import {
  installHappyDom,
  resetHappyDom,
  restoreHappyDom,
} from "@/tests/unit/hooks/test-helpers";

const routerPush = mock((href: string) => Promise.resolve(href));
const routerReplace = mock((href: string) => Promise.resolve(href));
const historyReplaceState = mock(
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  (_state: unknown, _title: string, _url?: string | URL | null) => undefined,
);
const ANALYTICS_CONSENT_STORAGE_KEY = "anicards:analytics-consent:v1";
const LAST_SUCCESSFUL_USER_PAGE_ROUTE_STORAGE_KEY =
  "anicards:last-successful-user-page-route:v1";
const PENDING_SETTINGS_TEMPLATE_APPLY_STORAGE_KEY =
  "anicards:user-page-settings-template-apply:v1";
const originalGtag = (globalThis as typeof globalThis & { gtag?: unknown })
  .gtag;
const originalTrackingId = process.env.NEXT_PUBLIC_GOOGLE_ANALYTICS_ID;
const originalFetch = globalThis.fetch;
const gtagMock = mock(
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  (_command: string, _action: string, _params: Record<string, unknown>) =>
    undefined,
);
const NEXT_NAVIGATION_STATE_KEY = "__ANICARDS_TEST_NEXT_NAVIGATION__";
let rejectNextPush = false;
let SearchForm: typeof import("@/components/search/SearchForm").SearchForm;
let SearchHeroShell: typeof import("@/app/search/SearchHeroShell").default;

installHappyDom({
  includeResizeObserver: true,
  url: "http://localhost/search",
});

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

function getRequestUrl(input: RequestInfo | URL): string {
  if (typeof input === "string") {
    return input;
  }

  if (input instanceof URL) {
    return input.toString();
  }

  if (input instanceof Request) {
    return input.url;
  }

  throw new TypeError("Expected fetch input to be a string, URL, or Request.");
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
    useReducedMotion: () => false,
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
    lastSuccessfulUserRoute,
    lookupResult,
    onOpenResolvedLookup,
    onLoadingChange,
    onResumeLastEditor,
    pendingTemplateApply,
  }: {
    lastSuccessfulUserRoute?: {
      href: string;
      userId: string;
      username?: string;
    } | null;
    lookupResult?: {
      href: string;
      isResolving?: boolean;
      kind: string;
      title: string;
      trackingSource: string;
    } | null;
    onOpenResolvedLookup?: (href: string, trackingSource: string) => void;
    onLoadingChange: (loading: boolean) => void;
    onResumeLastEditor?: () => void;
    pendingTemplateApply?: { templateName?: string } | null;
  }) => (
    <div>
      <button type="button" onClick={() => onLoadingChange(true)}>
        Start loading
      </button>
      <button type="button" onClick={() => onLoadingChange(false)}>
        Stop loading
      </button>
      <button type="button" onClick={() => onResumeLastEditor?.()}>
        Resume last editor
      </button>
      <button
        type="button"
        onClick={() => {
          if (!lookupResult) {
            return;
          }

          onOpenResolvedLookup?.(
            lookupResult.href,
            lookupResult.trackingSource,
          );
        }}
      >
        Open resolved lookup
      </button>
      <output data-testid="last-editor-href">
        {lastSuccessfulUserRoute?.href ?? ""}
      </output>
      <output data-testid="pending-template-name">
        {pendingTemplateApply?.templateName ?? ""}
      </output>
      <output data-testid="lookup-result-kind">
        {lookupResult?.kind ?? ""}
      </output>
      <output data-testid="lookup-result-href">
        {lookupResult?.href ?? ""}
      </output>
      <output data-testid="lookup-result-title">
        {lookupResult?.title ?? ""}
      </output>
      <output data-testid="lookup-result-resolving">
        {lookupResult?.isResolving ? "true" : "false"}
      </output>
    </div>
  ),
}));

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
    resetHappyDom("http://localhost/search");
    globalThis.window.localStorage.setItem(
      ANALYTICS_CONSENT_STORAGE_KEY,
      "granted",
    );
    process.env.NEXT_PUBLIC_GOOGLE_ANALYTICS_ID = "G-TEST123";
    routerPush.mockClear();
    routerReplace.mockClear();
    historyReplaceState.mockClear();
    gtagMock.mockClear();
    Object.defineProperty(globalThis, "gtag", {
      configurable: true,
      value: gtagMock,
      writable: true,
    });
    (
      globalThis.window as unknown as Window & {
        gtag?: (...args: unknown[]) => void;
      }
    ).gtag = gtagMock as unknown as (...args: unknown[]) => void;
    Object.defineProperty(globalThis.window.history, "replaceState", {
      configurable: true,
      value: historyReplaceState,
      writable: true,
    });
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
    globalThis.fetch = originalFetch;
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
    restoreHappyDom();
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
    expect(routerReplace.mock.calls).toHaveLength(0);
    expect(historyReplaceState.mock.calls).toEqual([
      [null, "", "/search?mode=userId"],
    ]);
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
    expect(userIdInput.getAttribute("name")).toBe("query");

    const form = document.querySelector("form");
    const hiddenModeInput = document.querySelector(
      'input[type="hidden"][name="mode"]',
    );

    expect(form?.getAttribute("method")).toBe("get");
    expect(form?.getAttribute("action")).toBe("/search");
    expect(hiddenModeInput?.getAttribute("value")).toBe("userId");
  });

  it("shows a server-provided validation error for the GET fallback state", async () => {
    const view = render(
      <SearchForm
        initialFieldError="That looks like a username or profile link. Switch to Username mode or paste a numeric AniList user ID."
        initialSearchMode="userId"
        initialSearchValue="54two24"
      />,
    );

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
    expect(userIdInput.getAttribute("aria-invalid")).toBe("true");
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
      expect(routerPush.mock.calls).toEqual([["/search?query=Alpha49"]]);
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
      expect(routerPush.mock.calls).toEqual([
        ["/search?mode=userId&query=542244"],
      ]);
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
      expect(routerPush.mock.calls).toEqual([
        ["/search?mode=userId&query=542244"],
      ]);
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
      expect(routerPush.mock.calls).toEqual([["/search?query=Alpha49"]]);
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
      event_label: "search_form_to_search",
      send_to: "G-TEST123",
    });
    expect(
      view.getByRole("button", { name: /checking profile/i }),
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
      expect(routerPush.mock.calls).toEqual([
        ["/search?mode=userId&query=542244"],
      ]);
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
      name: /working on your anilist lookup/i,
    });

    expect(loadingDialog.getAttribute("aria-modal")).toBe("true");
    expect(loadingDialog.getAttribute("aria-busy")).toBe("true");
    expect(loadingDialog.textContent).toContain("Preparing the next step...");
    expect(heroContent.getAttribute("aria-hidden")).toBe("true");
    expect(heroContent.hasAttribute("inert")).toBe(true);
    expect(outsideShellButton.getAttribute("aria-hidden")).toBe("true");
    expect(outsideShellButton.hasAttribute("inert")).toBe(true);

    await flushAnimationFrames();
    expect(document.activeElement === loadingDialog).toBe(true);

    fireEvent.click(stopLoadingButton);

    await waitFor(() => {
      expect(
        view.queryByRole("dialog", { name: /working on your anilist lookup/i }),
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
      expect(view.getByTestId("last-editor-href").textContent).toBe(
        "/user/Alpha49",
      );
    });

    expect(view.getByTestId("pending-template-name").textContent).toBe(
      "Anime Stats — Minimal (Light)",
    );

    fireEvent.click(view.getByRole("button", { name: /resume last editor/i }));

    await waitFor(() => {
      expect(routerPush.mock.calls).toContainEqual(["/user/Alpha49"]);
    });

    expect(
      view.getByRole("dialog", { name: /working on your anilist lookup/i }),
    ).toBeTruthy();
  });

  it("surfaces remembered editor continuity even without a queued template", async () => {
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
      expect(view.getByTestId("last-editor-href").textContent).toBe(
        "/user/Alpha49",
      );
    });

    expect(view.getByTestId("pending-template-name").textContent).toBe("");

    fireEvent.click(view.getByRole("button", { name: /resume last editor/i }));

    await waitFor(() => {
      expect(routerPush.mock.calls).toContainEqual(["/user/Alpha49"]);
    });
  });

  it("upgrades valid lookups to a confirmed canonical editor route in the shell", async () => {
    const fetchMock = mock(async (input: RequestInfo | URL) => {
      const requestUrl = getRequestUrl(input);

      if (requestUrl === "/api/get-user?view=bootstrap&username=Alpha49") {
        return new Response(
          JSON.stringify({
            avatarUrl: "https://example.com/avatar.png",
            userId: 542244,
            username: "Alpha49",
          }),
          {
            headers: {
              "Content-Type": "application/json",
            },
            status: 200,
          },
        );
      }

      throw new Error(`Unexpected fetch request in shell test: ${requestUrl}`);
    });
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    const view = render(
      <SearchHeroShell
        initialLookupAttempt={{
          fallbackHref: "/user?username=Alpha49",
          mode: "username",
          query: "Alpha49",
        }}
        initialSearchMode="username"
        initialSearchValue="Alpha49"
      />,
    );

    await waitFor(() => {
      expect(view.getByTestId("lookup-result-kind").textContent).toBe(
        "confirmed",
      );
    });

    expect(view.getByTestId("lookup-result-href").textContent).toBe(
      "/user/Alpha49",
    );
    expect(view.getByTestId("lookup-result-title").textContent).toBe(
      "@Alpha49",
    );

    fireEvent.click(
      view.getByRole("button", { name: /open resolved lookup/i }),
    );

    await waitFor(() => {
      expect(routerPush.mock.calls).toContainEqual(["/user/Alpha49"]);
    });
  });

  it("keeps the direct editor fallback when the bootstrap lookup is missing", async () => {
    const fetchMock = mock(async (input: RequestInfo | URL) => {
      const requestUrl = getRequestUrl(input);

      if (requestUrl === "/api/get-user?view=bootstrap&userId=542244") {
        return new Response(JSON.stringify({ error: "User not found" }), {
          headers: {
            "Content-Type": "application/json",
          },
          status: 404,
        });
      }

      throw new Error(
        `Unexpected fetch request in shell fallback test: ${requestUrl}`,
      );
    });
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    const view = render(
      <SearchHeroShell
        initialLookupAttempt={{
          fallbackHref: "/user?userId=542244",
          mode: "userId",
          query: "542244",
        }}
        initialSearchMode="userId"
        initialSearchValue="542244"
      />,
    );

    await waitFor(() => {
      expect(view.getByTestId("lookup-result-kind").textContent).toBe(
        "notFound",
      );
    });

    expect(view.getByTestId("lookup-result-href").textContent).toBe(
      "/user?userId=542244",
    );
  });
});
