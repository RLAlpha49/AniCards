// Resolves the search params into either an existing-user load or a new-user
// bootstrap flow, while keeping the editor store's loading/error phases in sync
// with what the surrounding UI expects to render.

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { useShallow } from "zustand/react/shallow";

import { fetchUserCards } from "@/lib/api/cards";
import {
  isClientAbortError,
  isClientRequestCancelled,
  isClientTimeoutError,
  requestClientJson,
} from "@/lib/api/client-fetch";
import { normalizePositiveIntegerString } from "@/lib/api/primitives";
import { isValidUsername } from "@/lib/api/validation";
import { statCardTypes } from "@/lib/card-types";
import { getErrorDetails, getSafeErrorSummary } from "@/lib/error-messages";
import { trackUserActionError } from "@/lib/error-tracking";
import { getUserProfilePath } from "@/lib/seo";
import { useUserPageEditor } from "@/lib/stores/user-page-editor";
import type { LoadingPhase } from "@/lib/types/loading";
import type {
  PublicUserRecord,
  UserBootstrapRecord,
} from "@/lib/types/records";
import {
  getStructuredResponseError,
  type StructuredResponseError,
} from "@/lib/utils";

import type {
  HasPendingNewUserSetup,
  StartNewUserSetup,
} from "./useNewUserSetup";

const ALL_CARD_IDS = statCardTypes.map((t) => t.id);
const USER_ROUTE_REQUEST_TIMEOUT_MS = 15_000;

type UserLoadRequest = {
  id: number;
  requestedId: string;
  controller: AbortController;
};

type UserDataResult =
  | { userId: string; username: string | null; avatarUrl: string | null }
  | { error: StructuredResponseError; notFound?: boolean };

type SearchParamsReader = {
  get: (key: string) => string | null;
};

type RequestedUserSelection = {
  rawUserIdParam: string | null;
  rawUsernameParam: string | null;
  userIdParam: string | null;
  usernameParam: string | null;
  requestedId: string;
};

type ActiveLoadContext = {
  selection: RequestedUserSelection;
  controller: AbortController;
  requestId: number;
  isCurrentRequest: () => boolean;
  finishRequest: () => void;
  failLoad: (message: string, retryable: boolean) => void;
};

type UserCardsLoadOutcome =
  | { ok: true; result: Awaited<ReturnType<typeof fetchUserCards>> }
  | { ok: false; error: unknown };

function shouldSkipRequestedUserLoad(options: {
  activeLoadRequest: UserLoadRequest | null;
  clearAlreadyLoadedState: () => void;
  force?: boolean;
  lastLoadedUserId: string | null;
  requestedId: string;
}): boolean {
  if (options.force) {
    return false;
  }

  if (options.activeLoadRequest?.requestedId === options.requestedId) {
    return true;
  }

  if (options.lastLoadedUserId !== options.requestedId) {
    return false;
  }

  options.clearAlreadyLoadedState();
  return true;
}

function normalizeRequestedUserId(userIdParam: string | null): string | null {
  return normalizePositiveIntegerString(userIdParam);
}

function resolveRequestedUserSelection(
  searchParams: SearchParamsReader,
  routeUsername?: string,
): RequestedUserSelection {
  const rawUserIdParam = searchParams.get("userId");
  const rawUsernameParam =
    searchParams.get("username") ?? routeUsername ?? null;

  const userIdParam = normalizeRequestedUserId(rawUserIdParam);
  let usernameParam = rawUsernameParam?.trim() ?? null;

  if (usernameParam === null || !isValidUsername(usernameParam)) {
    usernameParam = null;
  }

  return {
    rawUserIdParam,
    rawUsernameParam,
    userIdParam,
    usernameParam,
    requestedId: `${userIdParam ?? ""}|${usernameParam ?? ""}`,
  };
}

function getRequestedUserValidationMessage(
  selection: RequestedUserSelection,
): string {
  return selection.rawUserIdParam || selection.rawUsernameParam
    ? "Invalid user specified. Please check the username/user ID and try again."
    : "No user specified. Please search for a user first.";
}

function createStructuredLoadError(
  message: string,
  status?: number,
): StructuredResponseError {
  const details = getErrorDetails(message, status);

  return {
    message,
    status,
    category: details.category,
    retryable: details.retryable,
    recoverySuggestions: details.suggestions,
  };
}

function getStructuredErrorUserMessage(error: StructuredResponseError): string {
  const derivedDetails = getErrorDetails(error.message, error.status);

  if (derivedDetails.category === error.category) {
    return derivedDetails.userMessage;
  }

  return getErrorDetails(error.category).userMessage;
}

function getStructuredErrorSummary(error: StructuredResponseError): string {
  const primarySuggestion = error.recoverySuggestions.find(
    (suggestion) => suggestion.description.trim().length > 0,
  )?.description;

  if (!primarySuggestion) {
    return getSafeErrorSummary(error.message, error.status);
  }

  const userMessage = getStructuredErrorUserMessage(error).trim();
  const suggestion = primarySuggestion.trim();

  if (!userMessage) {
    return suggestion;
  }

  if (suggestion.toLowerCase().startsWith(userMessage.toLowerCase())) {
    return suggestion;
  }

  const hasTerminalPunctuation = /[.!?]$/.test(userMessage);
  return `${userMessage}${hasTerminalPunctuation ? "" : "."} ${suggestion}`;
}

function buildStructuredErrorTrackingMetadata(
  error: StructuredResponseError,
): Record<string, unknown> | undefined {
  if (!error.additionalFields) {
    return undefined;
  }

  const metadataEntries = Object.entries(error.additionalFields).filter(
    (_entry): _entry is [string, string | number | boolean | null] => {
      const [, value] = _entry;
      return (
        value === null ||
        typeof value === "string" ||
        typeof value === "number" ||
        typeof value === "boolean"
      );
    },
  );

  if (metadataEntries.length === 0) {
    return undefined;
  }

  return Object.fromEntries(metadataEntries);
}

function buildUnexpectedLoadMessage(error: unknown): string {
  if (isClientTimeoutError(error)) {
    return "Loading your profile timed out. Please try again.";
  }

  if (error instanceof Error && error.message.trim().length > 0) {
    return error.message;
  }

  return "Failed to fetch user data. Please check your connection and try again.";
}

async function fetchUserData(
  userId: string | null,
  username: string | null,
  options: { signal?: AbortSignal; timeoutMs?: number } = {},
): Promise<UserDataResult> {
  const params = new URLSearchParams();
  if (userId) params.set("userId", userId);
  else if (username) params.set("username", username);
  params.set("view", "bootstrap");

  try {
    const { response: res, payload } = await requestClientJson(
      `/api/get-user?${params.toString()}`,
      {
        signal: options.signal,
        timeoutMs: options.timeoutMs,
      },
    );

    if (!res.ok) {
      const error = getStructuredResponseError(res, payload);
      if (res.status === 404) {
        return { error, notFound: true };
      }
      return { error };
    }

    const data = payload as PublicUserRecord | UserBootstrapRecord;

    // Public DTOs return numeric AniList IDs, but keep this tolerant of
    // legacy string responses during tests/backfills. Normalize to a numeric
    // value and reject only when parsing fails.
    if (data?.userId === undefined || data?.userId === null) {
      return { error: createStructuredLoadError("Invalid user data received") };
    }

    const parsedUserId =
      typeof data.userId === "number"
        ? data.userId
        : Number.parseInt(String(data.userId), 10);

    if (Number.isNaN(parsedUserId)) {
      return { error: createStructuredLoadError("Invalid user data received") };
    }

    return {
      userId: String(parsedUserId),
      username: data.username || null,
      avatarUrl:
        ("avatarUrl" in data ? (data.avatarUrl ?? null) : null) ||
        ("stats" in data
          ? data.stats?.User?.avatar?.medium ||
            data.stats?.User?.avatar?.large ||
            null
          : null),
    };
  } catch (err) {
    if (isClientRequestCancelled(err, options.signal)) {
      throw err;
    }

    console.error("Error fetching user:", err);

    if (isClientTimeoutError(err)) {
      return {
        error: createStructuredLoadError(
          "Loading your profile timed out. Please try again.",
        ),
      };
    }

    return {
      error: createStructuredLoadError(
        "Failed to fetch user data. Please check your connection and try again.",
      ),
    };
  }
}

function buildCanonicalUserPageUrl(
  username: string,
  searchParams: URLSearchParams,
): string {
  const nextSearchParams = new URLSearchParams(searchParams.toString());
  nextSearchParams.delete("userId");
  nextSearchParams.delete("username");

  const pathname = getUserProfilePath(username);
  const search = nextSearchParams.toString();

  return search ? `${pathname}?${search}` : pathname;
}

function isSupersededUserLoadRequest(
  error: unknown,
  signal: AbortSignal,
  isCurrentRequest: () => boolean,
): boolean {
  if (!isClientAbortError(error)) {
    return false;
  }

  if (signal.aborted) {
    return true;
  }

  return !isCurrentRequest();
}

function startUserCardsLoad(
  userId: string,
  signal: AbortSignal,
): Promise<UserCardsLoadOutcome> {
  return fetchUserCards(userId, {
    signal,
    timeoutMs: USER_ROUTE_REQUEST_TIMEOUT_MS,
  }).then(
    (result) => ({ ok: true, result }),
    (error) => ({ ok: false, error }),
  );
}

export function useUserDataLoader(options: {
  routeUsername?: string;
  startSetup: StartNewUserSetup;
  shouldResumeSetup?: HasPendingNewUserSetup;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const lastLoadedUserRef = useRef<string | null>(null);
  const activeLoadRequestRef = useRef<UserLoadRequest | null>(null);
  const nextLoadRequestIdRef = useRef(0);
  const [loadingPhase, setLoadingPhase] = useState<LoadingPhase>("idle");
  const [canRetryLoadInPlace, setCanRetryLoadInPlace] = useState(false);

  const { isLoading, loadError } = useUserPageEditor(
    useShallow((state) => ({
      isLoading: state.isLoading,
      loadError: state.loadError,
    })),
  );

  const beginLoadRequest = useCallback((requestedId: string) => {
    activeLoadRequestRef.current?.controller.abort(
      new DOMException(
        "The user load request was superseded by a newer request.",
        "AbortError",
      ),
    );

    const controller = new AbortController();
    const requestId = nextLoadRequestIdRef.current + 1;
    nextLoadRequestIdRef.current = requestId;

    activeLoadRequestRef.current = {
      id: requestId,
      requestedId,
      controller,
    };

    return {
      controller,
      requestId,
    };
  }, []);

  const clearActiveLoadRequest = useCallback((requestId: number) => {
    if (activeLoadRequestRef.current?.id === requestId) {
      activeLoadRequestRef.current = null;
    }
  }, []);

  useEffect(() => {
    return () => {
      activeLoadRequestRef.current?.controller.abort(
        new DOMException(
          "The user load request was cancelled during cleanup.",
          "AbortError",
        ),
      );
      activeLoadRequestRef.current = null;
    };
  }, []);

  const navigateToCanonicalUserRoute = useCallback(
    (username: string | null | undefined, isCurrentRequest: () => boolean) => {
      const normalizedUsername = username?.trim();

      if (!isCurrentRequest() || !normalizedUsername || pathname !== "/user") {
        return;
      }

      const currentSearch = new URLSearchParams(searchParams.toString());
      const nextUrl = buildCanonicalUserPageUrl(
        normalizedUsername,
        currentSearch,
      );
      const currentUrl = currentSearch.toString()
        ? `${pathname}?${currentSearch.toString()}`
        : pathname;

      if (nextUrl === currentUrl) {
        return;
      }

      lastLoadedUserRef.current = `|${normalizedUsername}`;
      router.replace(nextUrl);
    },
    [pathname, router, searchParams],
  );

  const handleMissingUserLoad = useCallback(
    async (request: ActiveLoadContext) => {
      setLoadingPhase("setting_up");

      const setupResult = await options.startSetup(
        request.selection.userIdParam,
        request.selection.usernameParam,
        setLoadingPhase,
        {
          signal: request.controller.signal,
          isCurrentRequest: request.isCurrentRequest,
          timeoutMs: USER_ROUTE_REQUEST_TIMEOUT_MS,
        },
      );

      if (!request.isCurrentRequest()) {
        return;
      }

      if ("error" in setupResult) {
        request.failLoad(
          getSafeErrorSummary(setupResult.error ?? "Unknown error"),
          setupResult.retryable,
        );
        return;
      }

      navigateToCanonicalUserRoute(
        setupResult.username,
        request.isCurrentRequest,
      );

      if (!request.isCurrentRequest()) {
        return;
      }

      setCanRetryLoadInPlace(false);
      setLoadingPhase("complete");
      request.finishRequest();
    },
    [navigateToCanonicalUserRoute, options.startSetup],
  );

  const handleExistingUserLoad = useCallback(
    async (
      userResult: Extract<UserDataResult, { userId: string }>,
      request: ActiveLoadContext,
      prefetchedCardsLoad?: Promise<UserCardsLoadOutcome> | null,
    ) => {
      const store = useUserPageEditor.getState();
      setLoadingPhase("loading_cards");

      const cardsLoadOutcome = await (prefetchedCardsLoad ??
        startUserCardsLoad(userResult.userId, request.controller.signal));

      if (!request.isCurrentRequest()) {
        return;
      }

      if (!cardsLoadOutcome.ok) {
        throw cardsLoadOutcome.error;
      }

      const cardsResult = cardsLoadOutcome.result;

      if ("error" in cardsResult) {
        if (cardsResult.notFound) {
          store.initializeFromServerData(
            userResult.userId,
            userResult.username,
            userResult.avatarUrl,
            [],
            undefined,
            ALL_CARD_IDS,
          );
        } else {
          const error = cardsResult.error;
          void trackUserActionError(
            "user_page_load_fetch_cards",
            new Error(error.message),
            error.category,
            {
              statusCode: error.status,
              requestId: error.requestId,
              retryable: error.retryable,
              recoverySuggestions: error.recoverySuggestions,
              metadata: buildStructuredErrorTrackingMetadata(error),
            },
          );

          store.initializeFromServerData(
            userResult.userId,
            userResult.username,
            userResult.avatarUrl,
            [],
            undefined,
            ALL_CARD_IDS,
          );

          request.failLoad(
            "Failed to load saved cards due to a server error. Default cards are shown for now.",
            error.retryable,
          );
          return;
        }
      } else {
        store.initializeFromServerData(
          userResult.userId,
          userResult.username,
          userResult.avatarUrl,
          cardsResult.cards,
          cardsResult.globalSettings,
          ALL_CARD_IDS,
          cardsResult.updatedAt ?? null,
          cardsResult.cardOrder,
        );
      }

      navigateToCanonicalUserRoute(
        userResult.username,
        request.isCurrentRequest,
      );

      if (!request.isCurrentRequest()) {
        return;
      }

      setCanRetryLoadInPlace(false);
      setLoadingPhase("complete");
      request.finishRequest();
    },
    [navigateToCanonicalUserRoute],
  );

  const load = useCallback(
    async (loadOptions?: { force?: boolean }) => {
      const selection = resolveRequestedUserSelection(
        searchParams,
        options.routeUsername,
      );
      const store = useUserPageEditor.getState();

      if (
        shouldSkipRequestedUserLoad({
          activeLoadRequest: activeLoadRequestRef.current,
          clearAlreadyLoadedState: () => {
            store.setLoading(false);
            setCanRetryLoadInPlace(false);
          },
          force: loadOptions?.force,
          lastLoadedUserId: lastLoadedUserRef.current,
          requestedId: selection.requestedId,
        })
      ) {
        return;
      }

      const { controller, requestId } = beginLoadRequest(selection.requestedId);
      const isCurrentRequest = () =>
        activeLoadRequestRef.current?.id === requestId &&
        !controller.signal.aborted;
      const finishRequest = () => {
        clearActiveLoadRequest(requestId);
      };
      const failLoad = (message: string, retryable: boolean) => {
        if (!isCurrentRequest()) {
          return;
        }

        store.setLoading(false);
        store.setLoadError(message);
        setCanRetryLoadInPlace(retryable);
        setLoadingPhase("error");
        lastLoadedUserRef.current = null;
        finishRequest();
      };
      const request: ActiveLoadContext = {
        selection,
        controller,
        requestId,
        isCurrentRequest,
        finishRequest,
        failLoad,
      };

      lastLoadedUserRef.current = selection.requestedId;
      setCanRetryLoadInPlace(false);
      store.setLoadError(null);

      try {
        if (!selection.userIdParam && !selection.usernameParam) {
          request.failLoad(getRequestedUserValidationMessage(selection), false);
          return;
        }

        store.setLoading(true);

        if (
          options.shouldResumeSetup?.(
            selection.userIdParam,
            selection.usernameParam,
          )
        ) {
          await handleMissingUserLoad(request);
          return;
        }

        setLoadingPhase("checking");

        const prefetchedCardsLoad = selection.userIdParam
          ? startUserCardsLoad(selection.userIdParam, controller.signal)
          : null;

        const userResult = await fetchUserData(
          selection.userIdParam,
          selection.usernameParam,
          {
            signal: controller.signal,
            timeoutMs: USER_ROUTE_REQUEST_TIMEOUT_MS,
          },
        );

        if (!request.isCurrentRequest()) {
          return;
        }

        if ("error" in userResult) {
          if (userResult.notFound) {
            await handleMissingUserLoad(request);
            return;
          }

          const error = userResult.error;
          void trackUserActionError(
            "user_page_load",
            new Error(error.message),
            error.category,
            {
              statusCode: error.status,
              requestId: error.requestId,
              retryable: error.retryable,
              recoverySuggestions: error.recoverySuggestions,
              metadata: buildStructuredErrorTrackingMetadata(error),
            },
          );

          request.failLoad(getStructuredErrorSummary(error), error.retryable);
          return;
        }

        await handleExistingUserLoad(userResult, request, prefetchedCardsLoad);
      } catch (err) {
        if (
          isSupersededUserLoadRequest(
            err,
            controller.signal,
            request.isCurrentRequest,
          )
        ) {
          request.finishRequest();
          return;
        }

        console.error("Error loading user data:", err);

        const fallbackMessage = buildUnexpectedLoadMessage(err);
        const errorDetails = createStructuredLoadError(fallbackMessage);

        request.failLoad(
          getStructuredErrorSummary(errorDetails),
          errorDetails.retryable,
        );
      }
    },
    [
      beginLoadRequest,
      clearActiveLoadRequest,
      handleExistingUserLoad,
      handleMissingUserLoad,
      navigateToCanonicalUserRoute,
      options.routeUsername,
      options.shouldResumeSetup,
      searchParams,
    ],
  );

  useEffect(() => {
    load().catch((error) => {
      console.error("Unexpected error loading user data:", error);
    });
  }, [load]);

  const reload = useCallback(() => {
    lastLoadedUserRef.current = null;
    return load({ force: true });
  }, [load]);

  return {
    isLoading,
    loadError,
    loadingPhase,
    reload,
    canRetryLoadInPlace,
  } as const;
}
