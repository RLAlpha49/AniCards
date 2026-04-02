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

import type { UserPageEditorStore } from "@/lib/stores/user-page-editor";
import {
  flushMicrotasks,
  installHappyDom,
  resetHappyDom,
  restoreHappyDom,
} from "@/tests/unit/hooks/test-helpers";

const routerReplace = mock(() => {});
const fetchUserCardsMock = mock();
const router = { replace: routerReplace };
const searchParams = new URLSearchParams("username=Alex");
const originalFetch = globalThis.fetch;

const editorStoreState = {
  isLoading: false,
  loadError: null as string | null,
};

const editorStoreActions = {
  initializeFromServerData: mock(() => {}),
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
  usePathname: () => "/user",
  useRouter: () => router,
  useSearchParams: () => searchParams,
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

describe("useUserDataLoader", () => {
  beforeEach(() => {
    resetHappyDom();
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

  afterAll(() => {
    mock.restore();
    restoreHappyDom();
  });

  it("tracks top-level request IDs and preserves structured retry facts for user-load failures", async () => {
    const fetchMock = mock(
      async (input: RequestInfo | URL, _init?: RequestInit) => {
        void _init;
        const requestUrl = String(input);

        if (requestUrl.startsWith("/api/get-user?")) {
          return new Response(
            JSON.stringify({
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
            }),
            {
              headers: {
                "Content-Type": "application/json",
                "X-Request-Id": "req-user-load-12345",
              },
              status: 503,
              statusText: "Service Unavailable",
            },
          );
        }

        if (requestUrl === "/api/error-reports") {
          return new Response(JSON.stringify({ recorded: true }), {
            headers: {
              "Content-Type": "application/json",
            },
            status: 200,
          });
        }

        throw new Error(
          `Unexpected fetch request in useUserDataLoader test: ${requestUrl}`,
        );
      },
    );
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    const startSetup = mock(async () => ({
      success: true as const,
      userId: 42,
      username: "Alex",
    }));

    renderHook(() => useUserDataLoader({ startSetup }));

    await act(async () => {
      await flushMicrotasks(10);
      await new Promise<void>((resolve) => {
        globalThis.setTimeout(resolve, 0);
      });
      await flushMicrotasks(10);
    });

    expect(fetchUserCardsMock).not.toHaveBeenCalled();
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls[1]?.[0]).toBe("/api/error-reports");

    const errorReportPayload = JSON.parse(
      String((fetchMock.mock.calls[1]?.[1] as RequestInit | undefined)?.body),
    ) as {
      category?: string;
      message?: string;
      recoverySuggestions?: Array<{
        actionLabel?: string;
        description: string;
        title: string;
      }>;
      requestId?: string;
      retryable?: boolean;
      userAction?: string;
    };

    expect(errorReportPayload).toMatchObject({
      userAction: "user_page_load",
      message: "User bootstrap temporarily unavailable",
      category: "server_error",
      retryable: false,
      requestId: "req-user-load-12345",
      recoverySuggestions: [
        {
          title: "Retry later",
          description:
            "Wait for the backend to recover, then retry loading your profile.",
          actionLabel: "Retry",
        },
      ],
    });
    expect(editorStoreActions.setLoadError).toHaveBeenCalledWith(
      "Server error. Wait for the backend to recover, then retry loading your profile.",
    );
  });
});
