import {
  afterAll,
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  mock,
} from "bun:test";

import type { UserPageEditorStore } from "@/lib/stores/user-page-editor";
import type { StructuredResponseError } from "@/lib/utils";
import { allowConsoleWarningsAndErrors } from "@/tests/unit/__setup__";
import {
  createDeferred,
  flushMicrotasks,
  installHappyDom,
  resetHappyDom,
  restoreHappyDom,
} from "@/tests/unit/hooks/test-helpers";

const routerReplace = mock((href: string) => href);
const fetchUserCardsMock = mock();
const originalFetch = globalThis.fetch;
const router = { replace: routerReplace };

let pathname = "/user";
let routeSearchParams = new URLSearchParams("username=Alex");

const editorStoreState = {
  isLoading: false,
  loadError: null as string | null,
};

const editorStoreActions = {
  initializeFromServerData: mock(() => {
    editorStoreState.isLoading = false;
    editorStoreState.loadError = null;
  }),
  setLoadError: mock((error: string | null) => {
    editorStoreState.loadError = error;
    editorStoreState.isLoading = false;
  }),
  setLoading: mock((loading: boolean) => {
    editorStoreState.isLoading = loading;
  }),
  setUserData: mock(() => {}),
};

const useUserPageEditorMock = ((
  selector?: (state: {
    isLoading: boolean;
    loadError: string | null;
  }) => unknown,
) => {
  const state = {
    ...editorStoreState,
    ...editorStoreActions,
  };

  return selector ? selector(state) : state;
}) as typeof import("@/lib/stores/user-page-editor").useUserPageEditor;

useUserPageEditorMock.getState = () =>
  ({
    ...editorStoreState,
    ...editorStoreActions,
  }) as unknown as UserPageEditorStore;

mock.module("next/navigation", () => ({
  usePathname: () => pathname,
  useRouter: () => router,
  useSearchParams: () => routeSearchParams,
}));

mock.module("@/lib/api/cards", () => ({
  fetchUserCards: fetchUserCardsMock,
}));

mock.module("@/lib/stores/user-page-editor", () => ({
  useUserPageEditor: useUserPageEditorMock,
}));

installHappyDom();

const { act, cleanup, renderHook } = await import("@testing-library/react");
const { useUserDataLoader } =
  await import("@/components/user/hooks/useUserDataLoader");

function createJsonResponse(
  body: unknown,
  options?: {
    headers?: HeadersInit;
    status?: number;
    statusText?: string;
  },
) {
  return new Response(JSON.stringify(body), {
    headers: {
      "Content-Type": "application/json",
      ...options?.headers,
    },
    status: options?.status ?? 200,
    statusText: options?.statusText,
  });
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

function createStructuredError(
  overrides: Partial<StructuredResponseError> &
    Pick<StructuredResponseError, "message">,
): StructuredResponseError {
  return {
    message: overrides.message,
    status: overrides.status,
    category: overrides.category ?? "server_error",
    retryable: overrides.retryable ?? false,
    recoverySuggestions: overrides.recoverySuggestions ?? [],
    ...(overrides.requestId ? { requestId: overrides.requestId } : {}),
    ...(overrides.additionalFields
      ? { additionalFields: overrides.additionalFields }
      : {}),
  };
}

function createSuccessfulBootstrapResponse(
  overrides: Partial<{
    avatarUrl: string | null;
    userId: number;
    username: string | null;
  }> = {},
) {
  return createJsonResponse({
    avatarUrl: "https://example.com/avatar.png",
    userId: 42,
    username: "Alex",
    ...overrides,
  });
}

async function flushLoader(rounds = 12) {
  await act(async () => {
    await flushMicrotasks(rounds);
    await new Promise<void>((resolve) => {
      globalThis.setTimeout(resolve, 0);
    });
    await flushMicrotasks(rounds);
  });
}

describe("useUserDataLoader", () => {
  beforeEach(() => {
    resetHappyDom();
    pathname = "/user";
    routeSearchParams = new URLSearchParams("username=Alex");
    editorStoreState.isLoading = false;
    editorStoreState.loadError = null;
    routerReplace.mockReset();
    fetchUserCardsMock.mockReset();
    editorStoreActions.initializeFromServerData.mockReset();
    editorStoreActions.setLoadError.mockReset();
    editorStoreActions.setLoading.mockReset();
    editorStoreActions.setUserData.mockReset();
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    cleanup();
  });

  afterAll(async () => {
    await flushMicrotasks(10);
    await new Promise<void>((resolve) => {
      globalThis.setTimeout(resolve, 0);
    });
    await flushMicrotasks(10);
    mock.restore();
    restoreHappyDom();
  });

  it("tracks top-level request IDs and preserves structured retry facts for user-load failures", async () => {
    const fetchMock = mock(async (input: RequestInfo | URL) => {
      const requestUrl = getRequestUrl(input);

      if (requestUrl.startsWith("/api/get-user?")) {
        return createJsonResponse(
          {
            error: "User bootstrap temporarily unavailable",
            category: "server_error",
            retryable: false,
            status: 503,
            recoverySuggestions: [
              {
                title: "Retry later",
                description:
                  "Wait for the backend to recover, then retry loading your profile.",
                actionLabel: "Retry",
              },
            ],
          },
          {
            headers: {
              "X-Request-Id": "req-user-load-12345",
            },
            status: 503,
            statusText: "Service Unavailable",
          },
        );
      }

      if (requestUrl === "/api/error-reports") {
        return createJsonResponse({ recorded: true });
      }

      throw new Error(
        `Unexpected fetch request in useUserDataLoader test: ${requestUrl}`,
      );
    });
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    const startSetup = mock(async () => ({
      success: true as const,
      userId: 42,
      username: "Alex",
    }));

    renderHook(() => useUserDataLoader({ startSetup }));

    await flushLoader();

    expect(fetchUserCardsMock).not.toHaveBeenCalled();
    expect(fetchMock).toHaveBeenCalled();
    const firstRequestInput = fetchMock.mock.calls[0]?.[0];

    if (!firstRequestInput) {
      throw new TypeError(
        "Expected useUserDataLoader to issue a bootstrap request.",
      );
    }

    expect(getRequestUrl(firstRequestInput as RequestInfo | URL)).toMatch(
      /^\/api\/get-user\?/i,
    );
    expect(editorStoreActions.setLoadError).toHaveBeenCalledWith(
      "Server error. Wait for the backend to recover, then retry loading your profile.",
    );
  });

  it("rejects malformed direct user IDs before any network request begins", async () => {
    pathname = "/user";
    routeSearchParams = new URLSearchParams("userId=abc");

    const fetchMock = mock(async () => {
      throw new Error("The loader should not fetch for malformed IDs.");
    });
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    const startSetup = mock(async () => ({
      success: true as const,
      userId: 42,
      username: "Alex",
    }));

    const { result } = renderHook(() => useUserDataLoader({ startSetup }));

    await flushLoader();

    expect(fetchMock).not.toHaveBeenCalled();
    expect(fetchUserCardsMock).not.toHaveBeenCalled();
    expect(editorStoreActions.setLoadError).toHaveBeenCalledWith(
      "Invalid user specified. Please check the username/user ID and try again.",
    );
    expect(result.current.loadingPhase).toBe("error");
  });

  it("normalizes known numeric user IDs and starts card loading before bootstrap resolves", async () => {
    pathname = "/user";
    routeSearchParams = new URLSearchParams("userId=00042&q=wide");

    const bootstrapResponse = createDeferred<Response>();

    const fetchMock = mock(async (input: RequestInfo | URL) => {
      const requestUrl = getRequestUrl(input);

      if (requestUrl.startsWith("/api/get-user?")) {
        return bootstrapResponse.promise;
      }

      if (requestUrl === "/api/error-reports") {
        return createJsonResponse({ recorded: true });
      }

      throw new Error(`Unexpected bootstrap request: ${requestUrl}`);
    });
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    fetchUserCardsMock.mockImplementation(async () => ({
      userId: 42,
      cards: [],
      updatedAt: "2026-04-03T12:00:00.000Z",
    }));

    const { unmount } = renderHook(() =>
      useUserDataLoader({
        startSetup: mock(async () => ({
          success: true as const,
          userId: 42,
          username: "Alex",
        })),
      }),
    );

    await act(async () => {
      await flushMicrotasks(6);
    });

    expect(fetchMock.mock.calls[0]?.[0]).toBe(
      "/api/get-user?userId=42&view=bootstrap",
    );
    expect(fetchUserCardsMock).toHaveBeenCalledTimes(1);
    expect(fetchUserCardsMock.mock.calls[0]?.[0]).toBe("42");

    unmount();
    bootstrapResponse.resolve(createSuccessfulBootstrapResponse());
  });

  it("suppresses duplicate loads for the same selection, but reload() forces a fresh request", async () => {
    pathname = "/user/Alex";
    routeSearchParams = new URLSearchParams();

    const fetchMock = mock(async (input: RequestInfo | URL) => {
      const requestUrl = getRequestUrl(input);

      if (requestUrl.startsWith("/api/get-user?")) {
        return createSuccessfulBootstrapResponse();
      }

      if (requestUrl === "/api/error-reports") {
        return createJsonResponse({ recorded: true });
      }

      throw new Error(
        `Unexpected request during duplicate-load test: ${requestUrl}`,
      );
    });
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    fetchUserCardsMock.mockImplementation(async () => ({
      userId: 42,
      cards: [],
      updatedAt: "2026-04-03T13:00:00.000Z",
    }));

    const startSetup = mock(async () => ({
      success: true as const,
      userId: 42,
      username: "Alex",
    }));

    const { result, rerender } = renderHook(() =>
      useUserDataLoader({ routeUsername: "Alex", startSetup }),
    );

    await flushLoader();

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchUserCardsMock).toHaveBeenCalledTimes(1);

    routeSearchParams = new URLSearchParams();
    rerender();
    await flushLoader();

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchUserCardsMock).toHaveBeenCalledTimes(1);

    await act(async () => {
      await result.current.reload();
    });
    await flushLoader();

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchUserCardsMock).toHaveBeenCalledTimes(2);
  });

  it("falls back to new-user setup when bootstrap returns 404", async () => {
    pathname = "/user";
    routeSearchParams = new URLSearchParams("username=FreshUser");

    const fetchMock = mock(async (input: RequestInfo | URL) => {
      const requestUrl = getRequestUrl(input);

      if (requestUrl.startsWith("/api/get-user?")) {
        return createJsonResponse(
          {
            error: "User not found",
            category: "not_found",
            retryable: false,
            status: 404,
          },
          { status: 404, statusText: "Not Found" },
        );
      }

      throw new Error(`Unexpected setup-fallback request: ${requestUrl}`);
    });
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    const startSetup = mock(async () => ({
      success: true as const,
      userId: 77,
      username: "FreshUser",
    }));

    renderHook(() => useUserDataLoader({ startSetup }));

    await flushLoader();

    expect(startSetup).toHaveBeenCalledTimes(1);
    const firstStartSetupCall = startSetup.mock.calls[0] as unknown as
      | [string | null, string | null]
      | undefined;

    expect(firstStartSetupCall?.[0]).toBeNull();
    expect(firstStartSetupCall?.[1]).toBe("FreshUser");
    expect(fetchUserCardsMock).not.toHaveBeenCalled();
    expect(routerReplace).toHaveBeenCalledWith("/user/FreshUser");
  });

  it("initializes an empty authoritative state when the saved cards record is missing", async () => {
    pathname = "/user/Alex";
    routeSearchParams = new URLSearchParams();

    const fetchMock = mock(async (input: RequestInfo | URL) => {
      const requestUrl = getRequestUrl(input);

      if (requestUrl.startsWith("/api/get-user?")) {
        return createSuccessfulBootstrapResponse();
      }

      if (requestUrl === "/api/error-reports") {
        return createJsonResponse({ recorded: true });
      }

      throw new Error(`Unexpected cards-missing request: ${requestUrl}`);
    });
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    fetchUserCardsMock.mockImplementation(async () => ({
      error: createStructuredError({
        message: "Cards not found",
        category: "user_not_found",
        retryable: false,
        status: 404,
      }),
      notFound: true as const,
    }));

    const { result } = renderHook(() =>
      useUserDataLoader({
        routeUsername: "Alex",
        startSetup: mock(async () => ({
          success: true as const,
          userId: 42,
          username: "Alex",
        })),
      }),
    );

    await flushLoader();

    expect(editorStoreActions.initializeFromServerData).toHaveBeenCalledWith(
      "42",
      "Alex",
      "https://example.com/avatar.png",
      [],
      undefined,
      expect.any(Array),
    );
    expect(result.current.loadError).toBeNull();
    expect(result.current.loadingPhase).toBe("complete");
  });

  it("forwards saved cardOrder into editor initialization when card data loads successfully", async () => {
    pathname = "/user/Alex";
    routeSearchParams = new URLSearchParams();

    const fetchMock = mock(async (input: RequestInfo | URL) => {
      const requestUrl = getRequestUrl(input);

      if (requestUrl.startsWith("/api/get-user?")) {
        return createSuccessfulBootstrapResponse();
      }

      if (requestUrl === "/api/error-reports") {
        return createJsonResponse({ recorded: true });
      }

      throw new Error(`Unexpected card-order request: ${requestUrl}`);
    });
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    fetchUserCardsMock.mockImplementation(async () => ({
      userId: 42,
      cards: [{ cardName: "animeStats", titleColor: "#000" }],
      cardOrder: ["favoritesGrid", "animeStats"],
      updatedAt: "2026-04-03T14:00:00.000Z",
    }));

    renderHook(() =>
      useUserDataLoader({
        routeUsername: "Alex",
        startSetup: mock(async () => ({
          success: true as const,
          userId: 42,
          username: "Alex",
        })),
      }),
    );

    await flushLoader();

    expect(editorStoreActions.initializeFromServerData).toHaveBeenCalledWith(
      "42",
      "Alex",
      "https://example.com/avatar.png",
      [{ cardName: "animeStats", titleColor: "#000" }],
      undefined,
      expect.any(Array),
      "2026-04-03T14:00:00.000Z",
      ["favoritesGrid", "animeStats"],
    );
  });

  it("seeds default cards behind a retryable load error when saved-card bootstrap fails", async () => {
    const { consoleError } = allowConsoleWarningsAndErrors();

    pathname = "/user/Alex";
    routeSearchParams = new URLSearchParams();

    const fetchMock = mock(async (input: RequestInfo | URL) => {
      const requestUrl = getRequestUrl(input);

      if (requestUrl.startsWith("/api/get-user?")) {
        return createSuccessfulBootstrapResponse();
      }

      if (requestUrl === "/api/error-reports") {
        return createJsonResponse({ recorded: true });
      }

      throw new Error(`Unexpected cards-error request: ${requestUrl}`);
    });
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    fetchUserCardsMock.mockImplementation(async () => ({
      error: createStructuredError({
        message: "Cards temporarily unavailable",
        category: "server_error",
        retryable: true,
        recoverySuggestions: [
          {
            title: "Retry later",
            description:
              "Try loading your cards again after the server recovers.",
            actionLabel: "Retry",
          },
        ],
        status: 503,
      }),
    }));

    const { unmount } = renderHook(() =>
      useUserDataLoader({
        routeUsername: "Alex",
        startSetup: mock(async () => ({
          success: true as const,
          userId: 42,
          username: "Alex",
        })),
      }),
    );

    await flushMicrotasks(20);

    expect(editorStoreActions.initializeFromServerData).toHaveBeenCalled();
    expect(editorStoreActions.setLoadError).toHaveBeenCalledWith(
      "Failed to load saved cards due to a server error. Default cards are shown for now.",
    );
    expect(consoleError).toHaveBeenCalled();

    unmount();
  });
});
