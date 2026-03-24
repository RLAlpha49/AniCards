// Bootstraps a missing AniCards profile from AniList and then hydrates the
// shared editor store through the same path used for returning users. The flow
// is intentionally staged: resolve identity, fetch AniList stats, persist the
// user, seed starter cards, then load the editor from the data that actually
// lives in storage.

import { useCallback, useState } from "react";

import { USER_ID_QUERY, USER_STATS_QUERY } from "@/lib/anilist/queries";
import { fetchUserCards } from "@/lib/api/cards";
import { statCardTypes } from "@/lib/card-types";
import { getErrorDetails } from "@/lib/error-messages";
import { trackUserActionError } from "@/lib/error-tracking";
import { useUserPageEditor } from "@/lib/stores/user-page-editor";
import type { LoadingPhase } from "@/lib/types/loading";
import { getResponseErrorMessage, parseResponsePayload } from "@/lib/utils";

interface AniListStatsResponse {
  User?: Record<string, unknown>;
  [key: string]: unknown;
}

type NewUserSetupResult =
  | {
      success: true;
      userId: number;
      username: string | null;
      avatarUrl: string | null;
      stats: AniListStatsResponse;
    }
  | { error: string };

const ALL_CARD_IDS = statCardTypes.map((t) => t.id);

async function fetchUserIdFromAniList(
  username: string,
): Promise<{ userId: number } | { error: string }> {
  try {
    const res = await fetch("/api/anilist", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        query: USER_ID_QUERY,
        variables: { userName: username },
      }),
    });

    const payload = await parseResponsePayload(res);

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
    console.error("Error fetching user ID from AniList:", err);
    return {
      error:
        "Failed to connect to AniList. Please check your connection and try again.",
    };
  }
}

async function fetchUserStatsFromAniList(
  userId: number,
): Promise<{ stats: AniListStatsResponse } | { error: string }> {
  try {
    const res = await fetch("/api/anilist", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query: USER_STATS_QUERY, variables: { userId } }),
    });

    const payload = await parseResponsePayload(res);

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
    console.error("Error fetching user stats from AniList:", err);
    return { error: "Failed to fetch stats from AniList. Please try again." };
  }
}

async function saveUserToDatabase(
  userId: number,
  username: string,
  stats: AniListStatsResponse,
): Promise<{ success: true } | { error: string }> {
  try {
    const res = await fetch("/api/store-users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId, username, stats }),
    });

    const payload = await parseResponsePayload(res);

    if (!res.ok) {
      const msg = getResponseErrorMessage(res, payload);
      return { error: msg };
    }

    return { success: true };
  } catch (err) {
    console.error("Error saving user to database:", err);
    return { error: "Failed to save your profile. Please try again." };
  }
}
function buildInitialCardsSnapshot() {
  return statCardTypes.map((t) => ({
    cardName: t.id,
    disabled: false,
    variation: t.variations[0].id,
    colorPreset: "default",
  }));
}

async function saveInitialCards(userId: number, stats: unknown) {
  try {
    const initialCards = buildInitialCardsSnapshot();

    const res = await fetch("/api/store-cards", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        userId,
        cards: initialCards,
        statsData: stats,
        globalSettings: { colorPreset: "default", borderEnabled: false },
      }),
    });

    const payload = await parseResponsePayload(res);

    if (!res.ok) {
      const msg = getResponseErrorMessage(res, payload);
      return { error: msg };
    }

    return { success: true };
  } catch (err) {
    console.error("Error saving initial cards:", err);
    return { error: "Failed to initialize cards. Please try again." };
  }
}

export function useNewUserSetup() {
  const { setUserData, initializeFromServerData } = useUserPageEditor();
  const [isNewUser, setIsNewUser] = useState(false);
  const [cardsWarning, setCardsWarning] = useState<string | null>(null);

  const setupNewUserNetwork = useCallback(
    async (
      userIdParam: string | null,
      usernameParam: string | null,
      setLoadingPhase?: (phase: LoadingPhase) => void,
    ): Promise<NewUserSetupResult> => {
      setLoadingPhase?.("setting_up");

      let resolvedUserId: number | null = null;
      let resolvedUsername: string | null = usernameParam;

      if (userIdParam) {
        resolvedUserId = Number.parseInt(userIdParam, 10);
      } else if (usernameParam) {
        setLoadingPhase?.("fetching_anilist");
        const anilistIdResult = await fetchUserIdFromAniList(usernameParam);

        if ("error" in anilistIdResult) {
          const errorDetails = getErrorDetails(anilistIdResult.error);
          trackUserActionError(
            "new_user_setup_fetch_id",
            new Error(anilistIdResult.error),
            errorDetails.category,
            { username: usernameParam },
          );
          return { error: anilistIdResult.error };
        }

        resolvedUserId = anilistIdResult.userId;
      }

      if (!resolvedUserId) {
        return { error: "Could not determine user ID. Please try again." };
      }

      setLoadingPhase?.("fetching_anilist");
      const statsResult = await fetchUserStatsFromAniList(resolvedUserId);

      if ("error" in statsResult) {
        const errorDetails = getErrorDetails(statsResult.error);
        trackUserActionError(
          "new_user_setup_fetch_stats",
          new Error(statsResult.error),
          errorDetails.category,
          {
            userId: String(resolvedUserId),
            username: resolvedUsername ?? undefined,
          },
        );
        return { error: statsResult.error };
      }

      const stats = statsResult.stats;
      const statsUsername = (stats.User as Record<string, unknown>)?.name as
        | string
        | undefined;
      if (!resolvedUsername && statsUsername) resolvedUsername = statsUsername;

      setLoadingPhase?.("saving");
      const saveUserResult = await saveUserToDatabase(
        resolvedUserId,
        resolvedUsername || "",
        statsResult.stats,
      );

      if ("error" in saveUserResult) {
        const errorDetails = getErrorDetails(saveUserResult.error);
        trackUserActionError(
          "new_user_setup_save_user",
          new Error(saveUserResult.error),
          errorDetails.category,
          {
            userId: String(resolvedUserId),
            username: resolvedUsername ?? undefined,
          },
        );
        return { error: saveUserResult.error };
      }

      const saveCardsResult = await saveInitialCards(
        resolvedUserId,
        statsResult.stats,
      );
      if ("error" in saveCardsResult) {
        // Non-fatal: user account is created; cards will use defaults and can be re-saved later
        const errorDetails = getErrorDetails(
          saveCardsResult.error ?? "Unknown error",
        );
        trackUserActionError(
          "new_user_setup_save_cards",
          new Error(saveCardsResult.error ?? "Unknown error"),
          errorDetails.category,
          {
            userId: String(resolvedUserId),
            username: resolvedUsername ?? undefined,
          },
        );
      }

      const userStats = statsResult.stats.User;
      const avatar = userStats?.avatar as Record<string, string> | undefined;
      const resolvedAvatarUrl = avatar?.medium || avatar?.large || null;

      return {
        success: true,
        userId: resolvedUserId,
        username: resolvedUsername,
        avatarUrl: resolvedAvatarUrl,
        stats: statsResult.stats,
      };
    },
    [],
  );

  const handlePersistedCardsAfterNewUserSetup = useCallback(
    async (uid: number, uname: string | null, aUrl: string | null) => {
      // Re-read cards from storage even right after creating them so brand-new
      // users and returning users converge on the same hydration path.
      const persistedCardsResult = await fetchUserCards(String(uid));

      if ("error" in persistedCardsResult) {
        if (persistedCardsResult.notFound) {
          const initialCards = buildInitialCardsSnapshot();
          initializeFromServerData(
            String(uid),
            uname,
            aUrl,
            initialCards,
            undefined,
            ALL_CARD_IDS,
          );
        } else {
          const errorDetails = getErrorDetails(
            persistedCardsResult.error ?? "Unknown error",
          );
          trackUserActionError(
            "new_user_setup_fetch_cards",
            new Error(persistedCardsResult.error ?? "Unknown error"),
            errorDetails.category,
            { userId: String(uid), username: uname ?? undefined },
          );
          setCardsWarning(
            "We couldn't load your saved cards due to a server error. Default cards are displayed for now.",
          );
          const initialCards = buildInitialCardsSnapshot();
          initializeFromServerData(
            String(uid),
            uname,
            aUrl,
            initialCards,
            undefined,
            ALL_CARD_IDS,
          );
        }
        return;
      }

      if (
        Array.isArray(persistedCardsResult.cards) &&
        persistedCardsResult.cards.length === 0
      ) {
        const msg = "No persisted cards were returned after initial save";
        const details = getErrorDetails(msg);
        trackUserActionError(
          "new_user_setup_fetch_cards",
          new Error(msg),
          details.category,
          {
            userId: String(uid),
            username: uname ?? undefined,
          },
        );
        console.warn(msg, { userId: uid });
        const initialCards = buildInitialCardsSnapshot();
        initializeFromServerData(
          String(uid),
          uname,
          aUrl,
          initialCards,
          undefined,
          ALL_CARD_IDS,
        );
        return;
      }

      initializeFromServerData(
        String(uid),
        uname,
        aUrl,
        persistedCardsResult.cards,
        persistedCardsResult.globalSettings,
        ALL_CARD_IDS,
        persistedCardsResult.updatedAt ?? null,
      );
      setCardsWarning(null);
    },
    [initializeFromServerData],
  );

  const startSetup = useCallback(
    async (
      userIdParam: string | null,
      usernameParam: string | null,
      setLoadingPhase?: (phase: LoadingPhase) => void,
    ) => {
      setIsNewUser(true);

      try {
        const setupResult = await setupNewUserNetwork(
          userIdParam,
          usernameParam,
          setLoadingPhase,
        );

        if ("error" in setupResult) {
          setIsNewUser(false);
          return { error: setupResult.error } as const;
        }

        setLoadingPhase?.("loading_cards");
        // Expose the resolved identity first so the page shell can render the
        // correct user context while card hydration finishes in the next step.
        setUserData(
          setupResult.userId.toString(),
          setupResult.username,
          setupResult.avatarUrl,
        );

        await handlePersistedCardsAfterNewUserSetup(
          setupResult.userId,
          setupResult.username,
          setupResult.avatarUrl,
        );

        setLoadingPhase?.("complete");

        return { success: true } as const;
      } catch (err) {
        setIsNewUser(false);
        setLoadingPhase?.("error");

        const message =
          err instanceof Error
            ? err.message
            : "Failed to set up your profile. Please try again.";

        const details = getErrorDetails(message);
        trackUserActionError(
          "new_user_setup_unhandled",
          new Error(message),
          details.category,
          {
            userId: userIdParam ?? undefined,
            username: usernameParam ?? undefined,
          },
        );

        console.error("Unhandled error during new user setup:", err);
        return { error: message } as const;
      }
    },
    [setupNewUserNetwork, setUserData, handlePersistedCardsAfterNewUserSetup],
  );

  return {
    isNewUser,
    setIsNewUser,
    cardsWarning,
    setCardsWarning,
    startSetup,
  } as const;
}
