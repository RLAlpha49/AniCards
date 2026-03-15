import { useSearchParams } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";

import { fetchUserCards } from "@/lib/api/cards";
import { isValidUsername } from "@/lib/api-utils";
import { statCardTypes } from "@/lib/card-types";
import { getErrorDetails } from "@/lib/error-messages";
import { trackUserActionError } from "@/lib/error-tracking";
import { useUserPageEditor } from "@/lib/stores/user-page-editor";
import type { LoadingPhase } from "@/lib/types/loading";
import type { ReconstructedUserRecord } from "@/lib/types/records";
import { getResponseErrorMessage,parseResponsePayload } from "@/lib/utils";

import { useNewUserSetup } from "./useNewUserSetup";

const ALL_CARD_IDS = statCardTypes.map((t) => t.id);

async function fetchUserData(
  userId: string | null,
  username: string | null,
): Promise<
  | { userId: string; username: string | null; avatarUrl: string | null }
  | { error: string; notFound?: boolean }
> {
  const params = new URLSearchParams();
  if (userId) params.set("userId", userId);
  else if (username) params.set("username", username);

  try {
    const res = await fetch(`/api/get-user?${params.toString()}`);
    const payload = await parseResponsePayload(res);

    if (!res.ok) {
      const msg = getResponseErrorMessage(res, payload);
      if (res.status === 404) {
        return { error: msg, notFound: true };
      }
      return { error: msg };
    }

    const data = payload as ReconstructedUserRecord;

    // Accept numeric userId values even when they're returned as strings
    // (reconstructed records store many fields as strings). Normalize to a
    // numeric value and reject only when parsing fails.
    if (data?.userId === undefined || data?.userId === null) {
      return { error: "Invalid user data received" };
    }

    const parsedUserId =
      typeof data.userId === "number"
        ? data.userId
        : Number.parseInt(String(data.userId), 10);

    if (Number.isNaN(parsedUserId)) {
      return { error: "Invalid user data received" };
    }

    return {
      userId: String(parsedUserId),
      username: data.username || null,
      avatarUrl:
        data.stats?.User?.avatar?.medium ||
        data.stats?.User?.avatar?.large ||
        null,
    };
  } catch (err) {
    console.error("Error fetching user:", err);
    return {
      error:
        "Failed to fetch user data. Please check your connection and try again.",
    };
  }
}

export function useUserDataLoader() {
  const searchParams = useSearchParams();
  const lastLoadedUserRef = useRef<string | null>(null);
  const [loadingPhase, setLoadingPhase] = useState<LoadingPhase>("idle");

  const {
    setUserData,
    initializeFromServerData,
    setLoading,
    setLoadError,
    isLoading,
    loadError,
  } = useUserPageEditor();
  const { startSetup } = useNewUserSetup();

  const handleCardsForExistingUser = useCallback(
    async (userIdStr: string, uname: string | null, aUrl: string | null) => {
      const cardsResult = await fetchUserCards(userIdStr);

      if ("error" in cardsResult) {
        if (cardsResult.notFound) {
          initializeFromServerData(
            userIdStr,
            uname,
            aUrl,
            [],
            undefined,
            ALL_CARD_IDS,
          );
          setLoadingPhase("complete");
          return;
        } else {
          const errorDetails = getErrorDetails(
            cardsResult.error ?? "Unknown error",
          );
          trackUserActionError(
            "user_page_load_fetch_cards",
            new Error(cardsResult.error ?? "Unknown error"),
            errorDetails.category,
            { userId: userIdStr, username: uname ?? undefined },
          );
          // fall back to empty
          setLoadingPhase("complete");
          setLoading(false);
          setLoadError(
            "Failed to load saved cards due to a server error. Default cards are shown for now.",
          );
          initializeFromServerData(
            userIdStr,
            uname,
            aUrl,
            [],
            undefined,
            ALL_CARD_IDS,
          );
          return;
        }
      }

      initializeFromServerData(
        userIdStr,
        uname,
        aUrl,
        cardsResult.cards,
        cardsResult.globalSettings,
        ALL_CARD_IDS,
        cardsResult.updatedAt ?? null,
      );
      setLoading(false);
      setLoadingPhase("complete");
    },
    [initializeFromServerData, setLoading, setLoadError, setLoadingPhase],
  );

  const load = useCallback(async () => {
    const rawUserIdParam = searchParams.get("userId");
    const rawUsernameParam = searchParams.get("username");

    let userIdParam = rawUserIdParam?.trim() ?? null;
    let usernameParam = rawUsernameParam?.trim() ?? null;

    if (!/^\d+$/.test(userIdParam ?? "")) userIdParam = null;
    if (usernameParam === null || !isValidUsername(usernameParam))
      usernameParam = null;

    const requestedId = `${userIdParam ?? ""}|${usernameParam ?? ""}`;

    if (lastLoadedUserRef.current === requestedId) {
      setLoading(false);
      return;
    }
    lastLoadedUserRef.current = requestedId;

    setLoadError(null);
    // Reset other transient UI state handled by hooks if needed

    if (!userIdParam && !usernameParam) {
      if (rawUserIdParam || rawUsernameParam) {
        setLoadError(
          "Invalid user specified. Please check the username/user ID and try again.",
        );
      } else {
        setLoadError("No user specified. Please search for a user first.");
      }
      setLoading(false);
      setLoadingPhase("error");
      lastLoadedUserRef.current = null;
      return;
    }

    setLoading(true);
    setLoadingPhase("checking");

    const userResult = await fetchUserData(userIdParam, usernameParam);

    if ("error" in userResult && userResult.notFound) {
      // New user
      setLoadingPhase("setting_up");
      const setupResult = await startSetup(
        userIdParam,
        usernameParam,
        setLoadingPhase,
      );

      if ("error" in setupResult) {
        setLoading(false);
        setLoadError(setupResult.error ?? "Unknown error");
        setLoadingPhase("error");
        lastLoadedUserRef.current = null;
        return;
      }

      setLoadingPhase("complete");
      return;
    }

    if ("error" in userResult) {
      const errorDetails = getErrorDetails(userResult.error ?? "Unknown error");
      trackUserActionError(
        "user_page_load",
        new Error(userResult.error ?? "Unknown error"),
        errorDetails.category,
      );
      setLoading(false);
      setLoadError(userResult.error ?? "Unknown error");
      setLoadingPhase("error");
      lastLoadedUserRef.current = null;
      return;
    }

    setLoadingPhase("loading_cards");
    setUserData(userResult.userId, userResult.username, userResult.avatarUrl);

    await handleCardsForExistingUser(
      userResult.userId,
      userResult.username,
      userResult.avatarUrl,
    );

    setLoading(false);
    setLoadingPhase("complete");
  }, [
    searchParams,
    setLoading,
    setLoadError,
    setUserData,
    startSetup,
    handleCardsForExistingUser,
    setLoadingPhase,
  ]);

  useEffect(() => {
    load().catch((err) => {
      console.error("Error loading user data:", err);
      lastLoadedUserRef.current = null;
      setLoadError(
        "Failed to fetch user data. Please check your connection and try again.",
      );
      setLoadingPhase("error");
    });
  }, [load]);

  const reload = useCallback(() => {
    lastLoadedUserRef.current = null;
    return load();
  }, [load]);

  return { isLoading, loadError, loadingPhase, reload } as const;
}
