// Bootstraps a missing AniCards profile from AniList and then hydrates the
// shared editor store through the same path used for returning users. The flow
// is intentionally staged: resolve identity, fetch AniList stats, persist the
// user, seed starter cards, then load the editor from the data that actually
// lives in storage.

import { useCallback, useRef, useState } from "react";

import { USER_ID_QUERY, USER_STATS_QUERY } from "@/lib/anilist/queries";
import {
  isClientAbortError,
  isClientRequestCancelled,
  isClientTimeoutError,
  requestClientJson,
  throwIfClientRequestAborted,
} from "@/lib/api/client-fetch";
import { parseStrictPositiveInteger } from "@/lib/api/primitives";
import { statCardTypes } from "@/lib/card-types";
import { getErrorDetails } from "@/lib/error-messages";
import { trackUserActionError } from "@/lib/error-tracking";
import { useUserPageEditor } from "@/lib/stores/user-page-editor";
import type { LoadingPhase } from "@/lib/types/loading";
import {
  buildNewUserStarterCardsSnapshot,
  NEW_USER_STARTER_GLOBAL_SETTINGS,
} from "@/lib/user-page-starters";
import { getResponseErrorMessage } from "@/lib/utils";

interface AniListStatsResponse {
  User?: Record<string, unknown>;
  [key: string]: unknown;
}

export type NewUserSetupResult =
  | {
      success: true;
      userId: number;
      username: string | null;
      avatarUrl: string | null;
      initialCards: ReturnType<typeof buildNewUserStarterCardsSnapshot>;
      cardsUpdatedAt: string | null;
    }
  | { error: string; retryable: boolean };

const ALL_CARD_IDS = statCardTypes.map((t) => t.id);
const NEW_USER_SETUP_REQUEST_TIMEOUT_MS = 20_000;

export interface StartNewUserSetupRequestOptions {
  signal?: AbortSignal;
  isCurrentRequest?: () => boolean;
  timeoutMs?: number;
}

export type StartNewUserSetup = (
  userIdParam: string | null,
  usernameParam: string | null,
  setLoadingPhase?: (phase: LoadingPhase) => void,
  requestOptions?: StartNewUserSetupRequestOptions,
) => Promise<
  | { success: true; userId: number; username: string | null }
  | { error: string; retryable: boolean }
>;

export type HasPendingNewUserSetup = (
  userIdParam: string | null,
  usernameParam: string | null,
) => boolean;

type PendingNewUserSetupState = {
  userId: number;
  username: string | null;
  avatarUrl: string | null;
  stats: AniListStatsResponse;
};

function createNewUserSetupError(
  message: string,
  retryable = getErrorDetails(message).retryable,
): Extract<NewUserSetupResult, { error: string }> {
  return { error: message, retryable };
}

function getAvatarUrlFromStats(stats: AniListStatsResponse): string | null {
  const userStats = stats.User;
  const avatar = userStats?.avatar as Record<string, string> | undefined;
  return avatar?.medium || avatar?.large || null;
}

function matchesPendingSetup(
  pendingSetup: PendingNewUserSetupState | null,
  userIdParam: string | null,
  usernameParam: string | null,
): boolean {
  if (!pendingSetup) {
    return false;
  }

  const normalizedUserId = parseStrictPositiveInteger(userIdParam);
  if (normalizedUserId !== null) {
    return normalizedUserId === pendingSetup.userId;
  }

  const normalizedUsername = usernameParam?.trim().toLowerCase();
  const pendingUsername = pendingSetup.username?.trim().toLowerCase();

  return Boolean(
    normalizedUsername &&
    pendingUsername &&
    normalizedUsername === pendingUsername,
  );
}

function isSupersededNewUserSetupRequest(
  error: unknown,
  requestOptions?: StartNewUserSetupRequestOptions,
): boolean {
  if (!isClientAbortError(error)) {
    return false;
  }

  if (requestOptions?.signal?.aborted) {
    return true;
  }

  return requestOptions?.isCurrentRequest
    ? !requestOptions.isCurrentRequest()
    : false;
}

function assertSetupRequestIsCurrent(
  requestOptions?: StartNewUserSetupRequestOptions,
): void {
  throwIfClientRequestAborted(requestOptions?.signal);

  if (requestOptions?.isCurrentRequest && !requestOptions.isCurrentRequest()) {
    throw new DOMException(
      "The new-user setup request was superseded by a newer load.",
      "AbortError",
    );
  }
}

async function fetchUserIdFromAniList(
  username: string,
  requestOptions?: StartNewUserSetupRequestOptions,
): Promise<{ userId: number } | { error: string }> {
  try {
    const { response: res, payload } = await requestClientJson("/api/anilist", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        query: USER_ID_QUERY,
        variables: { userName: username },
      }),
      signal: requestOptions?.signal,
      timeoutMs: requestOptions?.timeoutMs ?? NEW_USER_SETUP_REQUEST_TIMEOUT_MS,
    });

    if (!res.ok) {
      if (res.status === 404) {
        return {
          error: `User "${username}" not found on AniList. Please check the username and try again.`,
        };
      }
      if (res.status === 429) {
        return {
          error:
            "AniList rate limit reached. Please wait a moment and try again.",
        };
      }
      const msg = getResponseErrorMessage(res, payload);
      return { error: msg };
    }

    const data = payload as { User?: { id: number } };
    if (!data.User?.id) {
      return { error: `User "${username}" not found on AniList.` };
    }

    return { userId: data.User.id };
  } catch (err) {
    if (isClientRequestCancelled(err, requestOptions?.signal)) {
      throw err;
    }

    console.error("Error fetching user ID from AniList:", err);

    if (isClientTimeoutError(err)) {
      return {
        error: "Fetching your AniList profile timed out. Please try again.",
      };
    }

    return {
      error:
        "Failed to connect to AniList. Please check your connection and try again.",
    };
  }
}

async function fetchUserStatsFromAniList(
  userId: number,
  requestOptions?: StartNewUserSetupRequestOptions,
): Promise<{ stats: AniListStatsResponse } | { error: string }> {
  try {
    const { response: res, payload } = await requestClientJson("/api/anilist", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query: USER_STATS_QUERY, variables: { userId } }),
      signal: requestOptions?.signal,
      timeoutMs: requestOptions?.timeoutMs ?? NEW_USER_SETUP_REQUEST_TIMEOUT_MS,
    });

    if (!res.ok) {
      if (res.status === 429) {
        return {
          error:
            "AniList rate limit reached. Please wait a moment and try again.",
        };
      }
      const msg = getResponseErrorMessage(res, payload);
      return { error: msg };
    }

    return { stats: payload as AniListStatsResponse };
  } catch (err) {
    if (isClientRequestCancelled(err, requestOptions?.signal)) {
      throw err;
    }

    console.error("Error fetching user stats from AniList:", err);

    if (isClientTimeoutError(err)) {
      return {
        error: "Fetching your AniList stats timed out. Please try again.",
      };
    }

    return {
      error: "Failed to fetch stats from AniList. Please try again.",
    };
  }
}

async function saveUserToDatabase(
  userId: number,
  username: string,
  stats: AniListStatsResponse,
  requestOptions?: StartNewUserSetupRequestOptions,
): Promise<{ success: true } | { error: string }> {
  try {
    const { response: res, payload } = await requestClientJson(
      "/api/store-users",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, username, stats }),
        signal: requestOptions?.signal,
        timeoutMs:
          requestOptions?.timeoutMs ?? NEW_USER_SETUP_REQUEST_TIMEOUT_MS,
      },
    );

    if (!res.ok) {
      const msg = getResponseErrorMessage(res, payload);
      return { error: msg };
    }

    return { success: true };
  } catch (err) {
    if (isClientRequestCancelled(err, requestOptions?.signal)) {
      throw err;
    }

    console.error("Error saving user to database:", err);

    if (isClientTimeoutError(err)) {
      return { error: "Saving your profile timed out. Please try again." };
    }

    return { error: "Failed to save your profile. Please try again." };
  }
}

async function saveInitialCards(
  userId: number,
  stats: unknown,
  requestOptions?: StartNewUserSetupRequestOptions,
) {
  try {
    const initialCards = buildNewUserStarterCardsSnapshot();

    const { response: res, payload } = await requestClientJson(
      "/api/store-cards",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId,
          cards: initialCards,
          statsData: stats,
          globalSettings: NEW_USER_STARTER_GLOBAL_SETTINGS,
        }),
        signal: requestOptions?.signal,
        timeoutMs:
          requestOptions?.timeoutMs ?? NEW_USER_SETUP_REQUEST_TIMEOUT_MS,
      },
    );

    if (!res.ok) {
      const msg = getResponseErrorMessage(res, payload);
      return { error: msg };
    }

    const data = payload as { updatedAt?: string | null };

    return {
      success: true as const,
      initialCards,
      globalSettings: NEW_USER_STARTER_GLOBAL_SETTINGS,
      updatedAt: data.updatedAt ?? null,
    };
  } catch (err) {
    if (isClientRequestCancelled(err, requestOptions?.signal)) {
      throw err;
    }

    console.error("Error saving initial cards:", err);

    if (isClientTimeoutError(err)) {
      return {
        error: "Initializing your starter cards timed out. Please try again.",
      };
    }

    return { error: "Failed to initialize cards. Please try again." };
  }
}

export function useNewUserSetup() {
  const [isNewUser, setIsNewUser] = useState(false);
  const [cardsWarning, setCardsWarning] = useState<string | null>(null);
  const pendingSetupRef = useRef<PendingNewUserSetupState | null>(null);

  const hasPendingSetup = useCallback<HasPendingNewUserSetup>(
    (userIdParam, usernameParam) =>
      matchesPendingSetup(pendingSetupRef.current, userIdParam, usernameParam),
    [],
  );

  const setupNewUserNetwork = useCallback(
    async (
      userIdParam: string | null,
      usernameParam: string | null,
      setLoadingPhase?: (phase: LoadingPhase) => void,
      requestOptions?: StartNewUserSetupRequestOptions,
    ): Promise<NewUserSetupResult> => {
      assertSetupRequestIsCurrent(requestOptions);
      setLoadingPhase?.("setting_up");

      const pendingSetup = matchesPendingSetup(
        pendingSetupRef.current,
        userIdParam,
        usernameParam,
      )
        ? pendingSetupRef.current
        : null;

      if (pendingSetup) {
        setLoadingPhase?.("saving");

        const saveCardsResult = await saveInitialCards(
          pendingSetup.userId,
          pendingSetup.stats,
          requestOptions,
        );

        assertSetupRequestIsCurrent(requestOptions);

        if ("error" in saveCardsResult) {
          const errorDetails = getErrorDetails(
            saveCardsResult.error ?? "Unknown error",
          );
          void trackUserActionError(
            "new_user_setup_save_cards",
            new Error(saveCardsResult.error ?? "Unknown error"),
            errorDetails.category,
          );

          return createNewUserSetupError(
            "We created your profile, but couldn't save your starter cards yet. Try again to finish setup.",
            true,
          );
        }

        pendingSetupRef.current = null;

        return {
          success: true,
          userId: pendingSetup.userId,
          username: pendingSetup.username,
          avatarUrl: pendingSetup.avatarUrl,
          initialCards: saveCardsResult.initialCards,
          cardsUpdatedAt: saveCardsResult.updatedAt,
        };
      }

      let resolvedUserId: number | null = null;
      let resolvedUsername: string | null = usernameParam;

      if (userIdParam) {
        resolvedUserId = Number.parseInt(userIdParam, 10);
      } else if (usernameParam) {
        assertSetupRequestIsCurrent(requestOptions);
        setLoadingPhase?.("fetching_anilist");
        const anilistIdResult = await fetchUserIdFromAniList(
          usernameParam,
          requestOptions,
        );

        assertSetupRequestIsCurrent(requestOptions);

        if ("error" in anilistIdResult) {
          const errorDetails = getErrorDetails(anilistIdResult.error);
          void trackUserActionError(
            "new_user_setup_fetch_id",
            new Error(anilistIdResult.error),
            errorDetails.category,
          );
          return createNewUserSetupError(
            anilistIdResult.error,
            errorDetails.retryable,
          );
        }

        resolvedUserId = anilistIdResult.userId;
      }

      if (!resolvedUserId) {
        return createNewUserSetupError(
          "Could not determine user ID. Please try again.",
        );
      }

      assertSetupRequestIsCurrent(requestOptions);
      setLoadingPhase?.("fetching_anilist");
      const statsResult = await fetchUserStatsFromAniList(
        resolvedUserId,
        requestOptions,
      );

      assertSetupRequestIsCurrent(requestOptions);

      if ("error" in statsResult) {
        const errorDetails = getErrorDetails(statsResult.error);
        void trackUserActionError(
          "new_user_setup_fetch_stats",
          new Error(statsResult.error),
          errorDetails.category,
        );
        return createNewUserSetupError(
          statsResult.error,
          errorDetails.retryable,
        );
      }

      const stats = statsResult.stats;
      const statsUsername = (stats.User as Record<string, unknown>)?.name as
        | string
        | undefined;
      if (!resolvedUsername && statsUsername) resolvedUsername = statsUsername;
      const resolvedAvatarUrl = getAvatarUrlFromStats(statsResult.stats);

      assertSetupRequestIsCurrent(requestOptions);
      setLoadingPhase?.("saving");
      const saveUserResult = await saveUserToDatabase(
        resolvedUserId,
        resolvedUsername || "",
        statsResult.stats,
        requestOptions,
      );

      assertSetupRequestIsCurrent(requestOptions);

      if ("error" in saveUserResult) {
        const errorDetails = getErrorDetails(saveUserResult.error);
        void trackUserActionError(
          "new_user_setup_save_user",
          new Error(saveUserResult.error),
          errorDetails.category,
        );
        return createNewUserSetupError(saveUserResult.error, true);
      }

      pendingSetupRef.current = {
        userId: resolvedUserId,
        username: resolvedUsername,
        avatarUrl: resolvedAvatarUrl,
        stats: statsResult.stats,
      };

      const saveCardsResult = await saveInitialCards(
        resolvedUserId,
        statsResult.stats,
        requestOptions,
      );

      assertSetupRequestIsCurrent(requestOptions);

      if ("error" in saveCardsResult) {
        const errorDetails = getErrorDetails(
          saveCardsResult.error ?? "Unknown error",
        );
        void trackUserActionError(
          "new_user_setup_save_cards",
          new Error(saveCardsResult.error ?? "Unknown error"),
          errorDetails.category,
        );

        return createNewUserSetupError(
          "We created your profile, but couldn't save your starter cards yet. Try again to finish setup.",
          true,
        );
      }

      pendingSetupRef.current = null;

      return {
        success: true,
        userId: resolvedUserId,
        username: resolvedUsername,
        avatarUrl: resolvedAvatarUrl,
        initialCards: saveCardsResult.initialCards,
        cardsUpdatedAt: saveCardsResult.updatedAt,
      };
    },
    [],
  );

  const hydrateNewUserCards = useCallback(
    (
      params: {
        userId: number;
        username: string | null;
        avatarUrl: string | null;
        initialCards: ReturnType<typeof buildNewUserStarterCardsSnapshot>;
        updatedAt: string | null;
      },
      requestOptions?: StartNewUserSetupRequestOptions,
    ) => {
      assertSetupRequestIsCurrent(requestOptions);

      useUserPageEditor
        .getState()
        .initializeFromServerData(
          String(params.userId),
          params.username,
          params.avatarUrl,
          params.initialCards,
          NEW_USER_STARTER_GLOBAL_SETTINGS,
          ALL_CARD_IDS,
          params.updatedAt,
        );

      assertSetupRequestIsCurrent(requestOptions);

      setCardsWarning(null);
    },
    [],
  );

  const startSetup = useCallback<StartNewUserSetup>(
    async (
      userIdParam: string | null,
      usernameParam: string | null,
      setLoadingPhase?: (phase: LoadingPhase) => void,
      requestOptions?: StartNewUserSetupRequestOptions,
    ) => {
      assertSetupRequestIsCurrent(requestOptions);
      setIsNewUser(true);
      setCardsWarning(null);

      try {
        const setupResult = await setupNewUserNetwork(
          userIdParam,
          usernameParam,
          setLoadingPhase,
          requestOptions,
        );

        assertSetupRequestIsCurrent(requestOptions);

        if ("error" in setupResult) {
          setIsNewUser(false);
          return {
            error: setupResult.error,
            retryable: setupResult.retryable,
          } as const;
        }

        setLoadingPhase?.("loading_cards");
        assertSetupRequestIsCurrent(requestOptions);

        hydrateNewUserCards(
          {
            userId: setupResult.userId,
            username: setupResult.username,
            avatarUrl: setupResult.avatarUrl,
            initialCards: setupResult.initialCards,
            updatedAt: setupResult.cardsUpdatedAt,
          },
          requestOptions,
        );

        assertSetupRequestIsCurrent(requestOptions);

        setLoadingPhase?.("complete");

        return {
          success: true,
          userId: setupResult.userId,
          username: setupResult.username,
        } as const;
      } catch (err) {
        if (isSupersededNewUserSetupRequest(err, requestOptions)) {
          throw err;
        }

        setIsNewUser(false);
        setLoadingPhase?.("error");

        const message =
          err instanceof Error
            ? err.message
            : "Failed to set up your profile. Please try again.";

        const details = getErrorDetails(message);
        void trackUserActionError(
          "new_user_setup_unhandled",
          new Error(message),
          details.category,
        );

        console.error("Unhandled error during new user setup:", err);
        return {
          error: message,
          retryable: details.retryable,
        } as const;
      }
    },
    [setupNewUserNetwork, hydrateNewUserCards],
  );

  return {
    isNewUser,
    setIsNewUser,
    cardsWarning,
    setCardsWarning,
    startSetup,
    hasPendingSetup,
  } as const;
}
