// Resolves the search params into either an existing-user load or a new-user
// bootstrap flow, while keeping the editor store's loading/error phases in sync
// with what the surrounding UI expects to render.

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";

import { fetchUserCards } from "@/lib/api/cards";
import { isValidUsername } from "@/lib/api-utils";
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
import { getResponseErrorMessage, parseResponsePayload } from "@/lib/utils";

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
  params.set("view", "bootstrap");

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

    const data = payload as PublicUserRecord | UserBootstrapRecord;

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
        ("avatarUrl" in data ? (data.avatarUrl ?? null) : null) ||
        ("stats" in data
          ? data.stats?.User?.avatar?.medium ||
            data.stats?.User?.avatar?.large ||
            null
          : null),
    };
  } catch (err) {
    console.error("Error fetching user:", err);
    return {
      error:
        "Failed to fetch user data. Please check your connection and try again.",
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

export function useUserDataLoader(options?: { routeUsername?: string }) {
  const router = useRouter();
  const pathname = usePathname();
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

  const navigateToCanonicalUserRoute = useCallback(
    (username: string | null | undefined) => {
      const normalizedUsername = username?.trim();

      if (!normalizedUsername || pathname !== "/user") {
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

  const handleCardsForExistingUser = useCallback(
    async (
      userIdStr: string,
      uname: string | null,
      aUrl: string | null,
      cardsResultPromise: ReturnType<typeof fetchUserCards>,
    ) => {
      const cardsResult = await cardsResultPromise;

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
          void trackUserActionError(
            "user_page_load_fetch_cards",
            new Error(cardsResult.error ?? "Unknown error"),
            errorDetails.category,
          );
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
    const rawUsernameParam =
      searchParams.get("username") ?? options?.routeUsername ?? null;

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
      setLoadingPhase("setting_up");
      const setupResult = await startSetup(
        userIdParam,
        usernameParam,
        setLoadingPhase,
      );

      if ("error" in setupResult) {
        setLoading(false);
        setLoadError(getSafeErrorSummary(setupResult.error ?? "Unknown error"));
        setLoadingPhase("error");
        lastLoadedUserRef.current = null;
        return;
      }

      navigateToCanonicalUserRoute(setupResult.username);
      setLoadingPhase("complete");
      return;
    }

    if ("error" in userResult) {
      const errorDetails = getErrorDetails(userResult.error ?? "Unknown error");
      void trackUserActionError(
        "user_page_load",
        new Error(userResult.error ?? "Unknown error"),
        errorDetails.category,
      );
      setLoading(false);
      setLoadError(getSafeErrorSummary(userResult.error ?? "Unknown error"));
      setLoadingPhase("error");
      lastLoadedUserRef.current = null;
      return;
    }

    setUserData(userResult.userId, userResult.username, userResult.avatarUrl);
    setLoadingPhase("loading_cards");

    const cardsResultPromise = fetchUserCards(userResult.userId);

    await handleCardsForExistingUser(
      userResult.userId,
      userResult.username,
      userResult.avatarUrl,
      cardsResultPromise,
    );

    navigateToCanonicalUserRoute(userResult.username);

    setLoading(false);
    setLoadingPhase("complete");
  }, [
    options?.routeUsername,
    navigateToCanonicalUserRoute,
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
