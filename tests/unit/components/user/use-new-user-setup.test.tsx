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

import { statCardTypes } from "@/lib/card-types";
import {
  buildNewUserStarterCardsSnapshot,
  NEW_USER_STARTER_GLOBAL_SETTINGS,
} from "@/lib/user-page-starters";
import {
  flushMicrotasks,
  installHappyDom,
  resetHappyDom,
  restoreHappyDom,
} from "@/tests/unit/hooks/test-helpers";

const initializeFromServerData = mock(() => {});
const trackUserActionErrorMock = mock(async () => undefined);
const originalFetch = globalThis.fetch;

const useUserPageEditorMock = (() =>
  undefined) as unknown as typeof import("@/lib/stores/user-page-editor").useUserPageEditor;

useUserPageEditorMock.getState = () =>
  ({
    initializeFromServerData,
  }) as unknown as ReturnType<
    typeof import("@/lib/stores/user-page-editor").useUserPageEditor.getState
  >;

mock.module("@/lib/stores/user-page-editor", () => ({
  useUserPageEditor: useUserPageEditorMock,
}));

mock.module("@/lib/error-tracking", () => ({
  trackUserActionError: trackUserActionErrorMock,
}));

installHappyDom();

const { act, cleanup, renderHook } = await import("@testing-library/react");
const { USER_ID_QUERY, USER_STATS_QUERY } =
  await import("@/lib/anilist/queries");
const { useNewUserSetup } =
  await import("@/components/user/hooks/useNewUserSetup");

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

function parseJsonRequestBody<T>(
  body: RequestInit["body"] | null | undefined,
): T {
  if (body === null || body === undefined) {
    return {} as T;
  }

  if (typeof body === "string") {
    return JSON.parse(body) as T;
  }

  throw new TypeError("Expected a JSON request body string.");
}

function createAniListStatsResponse(
  overrides: Partial<{
    avatar: { large?: string; medium?: string };
    name: string;
  }> = {},
) {
  return {
    User: {
      avatar: {
        large: "https://example.com/avatar-large.png",
        medium: "https://example.com/avatar-medium.png",
        ...overrides.avatar,
      },
      name: overrides.name ?? "Alpha49",
    },
  };
}

async function flushSetup(rounds = 10) {
  await act(async () => {
    await flushMicrotasks(rounds);
  });
}

describe("useNewUserSetup", () => {
  beforeEach(() => {
    resetHappyDom();
    initializeFromServerData.mockReset();
    trackUserActionErrorMock.mockReset();
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    cleanup();
  });

  afterAll(() => {
    mock.restore();
    restoreHappyDom();
  });

  it("bootstraps a direct numeric userId path and hydrates one authoritative saved starter state", async () => {
    const fetchMock = mock(
      async (input: RequestInfo | URL, init?: RequestInit) => {
        const requestUrl = getRequestUrl(input);

        if (requestUrl === "/api/anilist") {
          const requestBody = parseJsonRequestBody<{ query?: string }>(
            init?.body,
          );

          expect(requestBody.query).toBe(USER_STATS_QUERY);
          return createJsonResponse(createAniListStatsResponse());
        }

        if (requestUrl === "/api/store-users") {
          return createJsonResponse({ success: true });
        }

        if (requestUrl === "/api/store-cards") {
          return createJsonResponse({ updatedAt: "2026-04-03T15:00:00.000Z" });
        }

        throw new Error(
          `Unexpected request during direct userId setup: ${requestUrl}`,
        );
      },
    );
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    const { result } = renderHook(() => useNewUserSetup());
    const setLoadingPhase = mock((phase: string) => phase);

    let setupResult:
      | Awaited<ReturnType<typeof result.current.startSetup>>
      | undefined;

    await act(async () => {
      setupResult = await result.current.startSetup(
        "42",
        null,
        setLoadingPhase,
      );
    });
    await flushSetup();

    expect(setupResult).toEqual({
      success: true,
      userId: 42,
      username: "Alpha49",
    });
    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(initializeFromServerData).toHaveBeenCalledWith(
      "42",
      "Alpha49",
      "https://example.com/avatar-medium.png",
      buildNewUserStarterCardsSnapshot(),
      NEW_USER_STARTER_GLOBAL_SETTINGS,
      statCardTypes.map((cardType) => cardType.id),
      "2026-04-03T15:00:00.000Z",
    );
    expect(result.current.isNewUser).toBe(true);
    expect(result.current.cardsWarning).toBeNull();
    expect(result.current.hasPendingSetup("42", null)).toBe(false);
  });

  it("resolves username lookups through AniList before saving and hydrating starter cards", async () => {
    const fetchMock = mock(
      async (input: RequestInfo | URL, init?: RequestInit) => {
        const requestUrl = getRequestUrl(input);

        if (requestUrl === "/api/anilist") {
          const requestBody = parseJsonRequestBody<{ query?: string }>(
            init?.body,
          );

          if (requestBody.query === USER_ID_QUERY) {
            return createJsonResponse({ User: { id: 542244 } });
          }

          if (requestBody.query === USER_STATS_QUERY) {
            return createJsonResponse(
              createAniListStatsResponse({ name: "Alpha49" }),
            );
          }
        }

        if (requestUrl === "/api/store-users") {
          return createJsonResponse({ success: true });
        }

        if (requestUrl === "/api/store-cards") {
          return createJsonResponse({ updatedAt: "2026-04-03T15:05:00.000Z" });
        }

        throw new Error(
          `Unexpected request during username setup: ${requestUrl}`,
        );
      },
    );
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    const { result } = renderHook(() => useNewUserSetup());

    let setupResult:
      | Awaited<ReturnType<typeof result.current.startSetup>>
      | undefined;

    await act(async () => {
      setupResult = await result.current.startSetup(null, "Alpha49");
    });
    await flushSetup();

    expect(setupResult).toEqual({
      success: true,
      userId: 542244,
      username: "Alpha49",
    });
    expect(fetchMock).toHaveBeenCalledTimes(4);
    const firstAniListBody = parseJsonRequestBody<{ query?: string }>(
      (fetchMock.mock.calls[0]?.[1] as RequestInit | undefined)?.body,
    );
    expect(firstAniListBody.query).toBe(USER_ID_QUERY);
  });

  it("returns a retryable error when AniList rate limits the username-to-ID lookup", async () => {
    const fetchMock = mock(async (input: RequestInfo | URL) => {
      const requestUrl = getRequestUrl(input);

      if (requestUrl === "/api/anilist") {
        return createJsonResponse(
          { error: "Too many requests" },
          { status: 429, statusText: "Too Many Requests" },
        );
      }

      throw new Error(`Unexpected rate-limit test request: ${requestUrl}`);
    });
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    const { result } = renderHook(() => useNewUserSetup());

    let setupResult:
      | Awaited<ReturnType<typeof result.current.startSetup>>
      | undefined;

    await act(async () => {
      setupResult = await result.current.startSetup(null, "Alpha49");
    });
    await flushSetup();

    expect(setupResult).toEqual({
      error: "AniList rate limit reached. Please wait a moment and try again.",
      retryable: true,
    });
    expect(initializeFromServerData).not.toHaveBeenCalled();
    expect(result.current.hasPendingSetup(null, "Alpha49")).toBe(false);
  });

  it("returns a non-retryable not-found error when AniList does not resolve a numeric user ID", async () => {
    const fetchMock = mock(async (input: RequestInfo | URL) => {
      const requestUrl = getRequestUrl(input);

      if (requestUrl === "/api/anilist") {
        return createJsonResponse({});
      }

      throw new Error(`Unexpected missing-id test request: ${requestUrl}`);
    });
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    const { result } = renderHook(() => useNewUserSetup());

    let setupResult:
      | Awaited<ReturnType<typeof result.current.startSetup>>
      | undefined;

    await act(async () => {
      setupResult = await result.current.startSetup(null, "Alpha49");
    });
    await flushSetup();

    expect(setupResult).toEqual({
      error: 'User "Alpha49" not found on AniList.',
      retryable: false,
    });
    expect(initializeFromServerData).not.toHaveBeenCalled();
  });

  it("surfaces store-users failures without hydrating the editor or leaving a pending starter save", async () => {
    const fetchMock = mock(
      async (input: RequestInfo | URL, init?: RequestInit) => {
        const requestUrl = getRequestUrl(input);

        if (requestUrl === "/api/anilist") {
          const requestBody = parseJsonRequestBody<{ query?: string }>(
            init?.body,
          );

          expect(requestBody.query).toBe(USER_STATS_QUERY);
          return createJsonResponse(createAniListStatsResponse());
        }

        if (requestUrl === "/api/store-users") {
          return createJsonResponse(
            { error: "User save failed" },
            { status: 503, statusText: "Service Unavailable" },
          );
        }

        throw new Error(
          `Unexpected store-users failure request: ${requestUrl}`,
        );
      },
    );
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    const { result } = renderHook(() => useNewUserSetup());

    let setupResult:
      | Awaited<ReturnType<typeof result.current.startSetup>>
      | undefined;

    await act(async () => {
      setupResult = await result.current.startSetup("42", null);
    });
    await flushSetup();

    expect(setupResult).toEqual({
      error: "User save failed",
      retryable: true,
    });
    expect(initializeFromServerData).not.toHaveBeenCalled();
    expect(result.current.hasPendingSetup("42", null)).toBe(false);
  });

  it("keeps starter-card persistence retryable and resumes it without re-fetching AniList or re-saving the user", async () => {
    let userIdLookups = 0;
    let statsLookups = 0;
    let storeUserWrites = 0;
    let storeCardsAttempts = 0;
    let shouldPersistCards = false;

    const fetchMock = mock(
      async (input: RequestInfo | URL, init?: RequestInit) => {
        const requestUrl = getRequestUrl(input);

        if (requestUrl === "/api/anilist") {
          const requestBody = parseJsonRequestBody<{ query?: string }>(
            init?.body,
          );

          if (requestBody.query === USER_ID_QUERY) {
            userIdLookups += 1;
            return createJsonResponse({ User: { id: 542244 } });
          }

          if (requestBody.query === USER_STATS_QUERY) {
            statsLookups += 1;
            return createJsonResponse(
              createAniListStatsResponse({ name: "Alpha49" }),
            );
          }
        }

        if (requestUrl === "/api/store-users") {
          storeUserWrites += 1;
          return createJsonResponse({ success: true });
        }

        if (requestUrl === "/api/store-cards") {
          storeCardsAttempts += 1;

          if (!shouldPersistCards) {
            return createJsonResponse(
              { error: "Starter cards unavailable" },
              { status: 503, statusText: "Service Unavailable" },
            );
          }

          return createJsonResponse({ updatedAt: "2026-04-03T16:00:00.000Z" });
        }

        throw new Error(`Unexpected starter-card retry request: ${requestUrl}`);
      },
    );
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    const { result } = renderHook(() => useNewUserSetup());

    let firstAttempt:
      | Awaited<ReturnType<typeof result.current.startSetup>>
      | undefined;

    await act(async () => {
      firstAttempt = await result.current.startSetup(null, "Alpha49");
    });
    await flushSetup();

    expect(firstAttempt).toEqual({
      error:
        "We created your profile, but couldn't save your starter cards yet. Try again to finish setup.",
      retryable: true,
    });
    expect(result.current.hasPendingSetup(null, "Alpha49")).toBe(true);
    expect(initializeFromServerData).not.toHaveBeenCalled();

    shouldPersistCards = true;

    let secondAttempt:
      | Awaited<ReturnType<typeof result.current.startSetup>>
      | undefined;

    await act(async () => {
      secondAttempt = await result.current.startSetup(null, "Alpha49");
    });
    await flushSetup();

    expect(secondAttempt).toEqual({
      success: true,
      userId: 542244,
      username: "Alpha49",
    });
    expect(userIdLookups).toBe(1);
    expect(statsLookups).toBe(1);
    expect(storeUserWrites).toBe(1);
    expect(storeCardsAttempts).toBe(2);
    expect(initializeFromServerData).toHaveBeenCalledWith(
      "542244",
      "Alpha49",
      "https://example.com/avatar-medium.png",
      buildNewUserStarterCardsSnapshot(),
      NEW_USER_STARTER_GLOBAL_SETTINGS,
      statCardTypes.map((cardType) => cardType.id),
      "2026-04-03T16:00:00.000Z",
    );
    expect(result.current.hasPendingSetup(null, "Alpha49")).toBe(false);
  });
});
