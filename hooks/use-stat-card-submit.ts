import { useState } from "react";
import { USER_ID_QUERY, USER_STATS_QUERY } from "@/lib/anilist/queries";
import type { ColorValue } from "@/lib/types/card";

/**
 * Parameters for creating and storing user stat cards.
 * @property username - AniList username of the user.
 * @property selectedCards - List of selected card identifiers (may include variation suffixes).
 * @property colors - Array of colors applied to cards: [title, background, text, circle].
 * @property showFavoritesByCard - Map of card IDs to a boolean to show favorites on that card.
 * @property showPiePercentages - Whether chart cards include pie percentages.
 * @property useAnimeStatusColors - Apply anime status color scheme for relevant charts.
 * @property useMangaStatusColors - Apply manga status color scheme for relevant charts.
 * @property borderEnabled - Whether cards should show a border.
 * @property borderColor - Hex or CSS color string to use for a border.
 * @source
 */
interface SubmitParams {
  username: string;
  selectedCards: string[];
  colors: ColorValue[];
  showFavoritesByCard: Record<string, boolean>;
  showPiePercentages?: boolean;
  useAnimeStatusColors?: boolean;
  useMangaStatusColors?: boolean;
  borderEnabled?: boolean;
  borderColor?: string;
}

/**
 * The subset of card names that support showing favorites.
 * @source
 */
const FAVORITE_CARD_IDS = new Set([
  "animeVoiceActors",
  "animeStudios",
  "animeStaff",
  "mangaStaff",
]);

/**
 * Build the payload of card configuration objects to send to the store-cards API.
 * Splits selected card ids into card name and optional variation and enriches
 * each entry with the provided display and styling options.
 * @param params - Object containing selection and display options.
 * @returns An array of card configuration objects.
 * @source
 */
function buildCardsPayload(params: {
  selectedCards: string[];
  colors: ColorValue[];
  showPiePercentages?: boolean;
  useAnimeStatusColors?: boolean;
  useMangaStatusColors?: boolean;
  borderEnabled?: boolean;
  borderColor?: string;
  showFavoritesByCard: Record<string, boolean>;
}) {
  const {
    selectedCards,
    colors,
    showPiePercentages,
    useAnimeStatusColors,
    useMangaStatusColors,
    borderEnabled,
    borderColor,
    showFavoritesByCard,
  } = params;

  return selectedCards.map((cardId) => {
    // Card identifiers may include a variation suffix, e.g. `cardName-variation`.
    const [cardName, rawVariation] = cardId.split("-");
    const variation = rawVariation || "default";
    const baseConfig = {
      cardName,
      variation,
      titleColor: colors[0],
      backgroundColor: colors[1],
      textColor: colors[2],
      circleColor: colors[3],
      showPiePercentages,
      ...(cardName === "animeStatusDistribution" && useAnimeStatusColors
        ? { useStatusColors: true }
        : {}),
      ...(cardName === "mangaStatusDistribution" && useMangaStatusColors
        ? { useStatusColors: true }
        : {}),
      ...(borderEnabled && borderColor ? { borderColor } : {}),
    } as Record<string, unknown>;
    if (FAVORITE_CARD_IDS.has(cardName)) {
      return {
        ...baseConfig,
        showFavorites: showFavoritesByCard[cardName] || false,
      };
    }
    return baseConfig;
  });
}

/**
 * Attempt to extract a human-friendly error message from an API payload.
 * @param payload - The response payload to inspect.
 * @returns A string message if found, otherwise undefined.
 * @source
 */
function extractErrorMessageFromPayload(payload: unknown) {
  if (!payload) return undefined;
  if (typeof payload !== "object" || payload === null) return undefined;
  const p = payload as Record<string, unknown>;
  if (typeof p.error === "string") return p.error;
  if (typeof p.message === "string") return p.message;
  if (
    Array.isArray(p.errors) &&
    p.errors[0] &&
    typeof (p.errors[0] as Record<string, unknown>).message === "string"
  ) {
    return (p.errors[0] as Record<string, unknown>).message as string;
  }
  return undefined;
}

const DEFAULT_RETRY_ATTEMPTS = 3;

function isRetryableError(error: unknown, statusCode?: number) {
  if (typeof statusCode === "number") {
    if (statusCode === 429) return true;
    if (statusCode >= 500) return true;
  }
  if (typeof error === "object" && error !== null) {
    const candidate = error as Error & { name?: string };
    // Guard DOMException checks for non-browser environments
    if (
      typeof DOMException !== "undefined" &&
      candidate instanceof DOMException &&
      candidate.name === "AbortError"
    ) {
      return true;
    }
    if (candidate.name === "AbortError") {
      return true;
    }
  }
  if (error instanceof Error) {
    const message = error.message.toLowerCase();
    if (
      message.includes("timeout") ||
      message.includes("network") ||
      message.includes("failed to fetch")
    ) {
      return true;
    }
  }
  return false;
}

function calculateBackoffDelay(attempt: number) {
  const safeAttempt = Math.max(0, attempt);
  const baseDelay = Math.min(1000 * Math.pow(2, safeAttempt), 10000);
  const jitter = 0.5 + Math.random() * 0.5;
  return Math.round(baseDelay * jitter);
}

function attemptSuffix(retries: number) {
  if (retries <= 0) return "";
  const plural = retries === 1 ? "" : "s";
  return ` after ${retries} attempt${plural}`;
}

function formatFailure(
  operationName: string,
  retries: number,
  message: string,
) {
  return `${operationName} failed${attemptSuffix(retries)}: ${message}`;
}

function ensureBudgetForNextRetry(
  start: number,
  totalTimeoutMs: number | undefined,
  delay: number,
  operationName: string,
  retries: number,
  errorInstance: Error,
) {
  const remaining = remainingBudgetMs(start, totalTimeoutMs);
  if (remaining <= 0)
    throw new Error(
      formatFailure(operationName, retries, errorInstance.message),
    );
  if (delay >= remaining)
    throw new Error(
      formatFailure(operationName, retries, errorInstance.message),
    );
}

function computeAttemptTimeout(
  start: number,
  totalTimeoutMs: number | undefined,
  timeoutMs: number,
  operationName: string,
) {
  const rem = remainingBudgetMs(start, totalTimeoutMs);
  const t = Math.min(timeoutMs, rem);
  if (t <= 0) {
    throw new Error(`${operationName} failed: total timeout exceeded`);
  }
  return t;
}

async function handleAttemptFailure(
  err: unknown,
  start: number,
  totalTimeoutMs: number | undefined,
  operationName: string,
  retries: number,
  maxRetries: number,
  onRetry?: (attempt: number, operation: string) => void,
): Promise<number> {
  const errorInstance =
    err instanceof Error ? err : new Error(String(err ?? "Unknown error"));
  const statusCode =
    typeof (err as { statusCode?: number }).statusCode === "number"
      ? (err as { statusCode?: number }).statusCode
      : undefined;
  const shouldRetry =
    retries < maxRetries && isRetryableError(errorInstance, statusCode);
  if (!shouldRetry)
    throw new Error(
      formatFailure(operationName, retries, errorInstance.message),
    );

  const delay = calculateBackoffDelay(retries);
  ensureBudgetForNextRetry(
    start,
    totalTimeoutMs,
    delay,
    operationName,
    retries,
    errorInstance,
  );
  const nextRetries = retries + 1;
  onRetry?.(nextRetries, operationName);
  await new Promise((resolve) => setTimeout(resolve, delay));
  return nextRetries;
}

function remainingBudgetMs(start: number, totalTimeoutMs?: number) {
  return typeof totalTimeoutMs === "number"
    ? Math.max(0, totalTimeoutMs - (Date.now() - start))
    : Infinity;
}

/**
 * Hook exposing stat-card submission helpers and state.
 * Provides `loading`, `error`, `submit`, and `clearError` to callers.
 * Use `submit` to begin the multi-step write process (fetch AniList data and store results).
 * @returns An object containing submission state and control functions.
 * @source
 */
export function useStatCardSubmit() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [retryAttempt, setRetryAttempt] = useState(0);
  const [retryOperation, setRetryOperation] = useState<string | null>(null);

  /**
   * Perform a fetch with an abort timeout and normalize errors with context.
   * @param url - Resource path to request.
   * @param options - RequestInit options for fetch.
   * @param timeoutMs - Timeout in milliseconds before aborting the request.
   * @param contextName - Context string used in thrown errors.
   * @returns The original Response when successful.
   * @throws Error with contextual message on failure.
   * @source
   */
  async function fetchWithTimeout(
    url: string,
    options: RequestInit,
    timeoutMs = 10000,
    contextName = "Request",
  ): Promise<Response> {
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetch(url, {
        ...options,
        signal: controller.signal,
      });
      return response;
    } catch (err) {
      // Normalize AbortError across environments
      const errName =
        typeof err === "object" && err !== null
          ? (err as { name?: string }).name
          : undefined;
      if (
        (typeof DOMException !== "undefined" &&
          err instanceof DOMException &&
          errName === "AbortError") ||
        errName === "AbortError"
      ) {
        throw new Error(
          `${contextName} request timed out after ${timeoutMs}ms`,
        );
      }
      // Bubble other errors up with context
      throw new Error(
        `${contextName} failed: ${(err as Error)?.message ?? String(err)}`,
      );
    } finally {
      clearTimeout(id);
    }
  }

  async function attemptFetchOnce(
    url: string,
    options: RequestInit,
    timeoutMs: number,
    contextName: string,
  ) {
    const response = await fetchWithTimeout(
      url,
      options,
      timeoutMs,
      contextName,
    );
    if (!response.ok) {
      if (
        isRetryableError(
          new Error(`HTTP status ${response.status}`),
          response.status,
        )
      ) {
        const statusError = new Error(`HTTP status ${response.status}`);
        (statusError as { statusCode?: number }).statusCode = response.status;
        throw statusError;
      }
    }
    return response;
  }

  async function fetchWithRetry(
    url: string,
    options: RequestInit,
    config: {
      maxRetries?: number;
      timeoutMs?: number;
      contextName?: string;
      operationName?: string;
      totalTimeoutMs?: number;
      onRetry?: (attempt: number, operation: string) => void;
    } = {},
  ): Promise<Response> {
    const {
      maxRetries = DEFAULT_RETRY_ATTEMPTS,
      timeoutMs = 10000,
      contextName = "Request",
      operationName = "request",
      totalTimeoutMs,
      onRetry,
    } = config;

    const start = Date.now();
    let retries = 0;

    while (true) {
      try {
        const attemptTimeout = computeAttemptTimeout(
          start,
          totalTimeoutMs,
          timeoutMs,
          operationName,
        );
        const response = await attemptFetchOnce(
          url,
          options,
          attemptTimeout,
          contextName,
        );
        if (response.ok) return response;
        if (
          isRetryableError(
            new Error(`HTTP status ${response.status}`),
            response.status,
          )
        ) {
          const statusError = new Error(`HTTP status ${response.status}`);
          (statusError as { statusCode?: number }).statusCode = response.status;
          throw statusError;
        }
        return response;
      } catch (err) {
        // Delegate retry decision, budget checks and delay / backoff handling
        retries = await handleAttemptFailure(
          err,
          start,
          totalTimeoutMs,
          operationName,
          retries,
          maxRetries,
          onRetry,
        );
      }
    }
  }

  /**
   * Validate the submission parameters and throw a descriptive Error if invalid.
   * @param params - The submission input to validate.
   * @throws {Error} When validation fails (missing or invalid fields).
   * @source
   */
  function validateSubmission(params: {
    username: string;
    selectedCards: string[];
    colors: ColorValue[];
    borderEnabled?: boolean;
    borderColor?: string;
  }) {
    const { username, selectedCards, colors, borderEnabled, borderColor } =
      params;
    if (!username.trim()) throw new Error("Please enter your AniList username");
    if (selectedCards.length === 0)
      throw new Error("Please select at least one stat card");
    if (colors.some((color) => !color))
      throw new Error("All color fields must be filled");
    if (borderEnabled && !borderColor)
      throw new Error("Border color must be set when the border is enabled");
  }

  /**
   * Assert that a fetch response is ok, otherwise throw an Error with an extracted message.
   * @param response - The fetch Response to validate.
   * @param context - A human-readable context used in the thrown error.
   * @throws Error when the response is not ok.
   * @source
   */
  async function checkResponseOrThrow(response: Response, context: string) {
    if (response.ok) return;
    let errorData: unknown = undefined;
    try {
      errorData = await response.json();
    } catch {}
    const errMsg =
      extractErrorMessageFromPayload(errorData) ??
      `HTTP status ${response.status}`;
    throw new Error(`${context}: ${errMsg}`);
  }

  /**
   * Helper to POST GraphQL queries to the local AniList proxy endpoint with timeout behavior.
   * @param query - GraphQL query string.
   * @param variables - Query variables to send.
   * @param timeoutMs - Optional fetch timeout.
   * @param contextLabel - Context label used for error messages.
   * @returns The parsed response JSON.
   * @throws Error when AniList returns a non-OK response.
   * @source
   */
  async function fetchAniListQuery(
    query: string,
    variables: Record<string, unknown>,
    timeoutMs = 10000,
    contextLabel = "query",
    onRetry?: (attempt: number, operation: string) => void,
  ) {
    const response = await fetchWithRetry(
      "/api/anilist",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query, variables }),
      },
      {
        timeoutMs,
        contextName: `AniList - ${contextLabel}`,
        operationName: `AniList ${contextLabel}`,
        maxRetries: DEFAULT_RETRY_ATTEMPTS,
        totalTimeoutMs: 15000,
        onRetry,
      },
    );

    if (!response.ok) {
      let errorData: unknown = undefined;
      try {
        errorData = await response.json();
      } catch {}
      const errMsg =
        extractErrorMessageFromPayload(errorData) ??
        `HTTP status ${response.status}`;
      throw new Error(`AniList ${contextLabel} failed: ${errMsg}`);
    }
    return response.json();
  }

  /**
   * Perform the full submission sequence: validate inputs, fetch AniList user/data,
   * build card payloads, and call storage endpoints. Returns an object with success status
   * and userId on success.
   * @param params - The submission parameters.
   * @returns A Promise resolving to an object with success and optional userId.
   * @source
   */
  const submit = async ({
    username,
    selectedCards,
    colors,
    showFavoritesByCard,
    showPiePercentages,
    useAnimeStatusColors,
    useMangaStatusColors,
    borderEnabled,
    borderColor,
  }: SubmitParams): Promise<{ success: boolean; userId?: string }> => {
    setLoading(true);
    setError(null);
    setRetryAttempt(0);
    setRetryOperation(null);

    const handleRetryUpdate = (attempt: number, operation: string) => {
      setRetryAttempt(attempt);
      setRetryOperation(operation);
    };

    try {
      validateSubmission({
        username,
        selectedCards,
        colors,
        borderEnabled,
        borderColor,
      });

      const userIdData = await fetchAniListQuery(
        USER_ID_QUERY,
        { userName: username },
        10000,
        "user ID fetch",
        handleRetryUpdate,
      );
      if (!userIdData?.User?.id) {
        throw new Error(
          `AniList user fetch failed: No user found for ${username}`,
        );
      }

      const statsData = await fetchAniListQuery(
        USER_STATS_QUERY,
        { userId: userIdData.User.id },
        10000,
        "user stats fetch",
        handleRetryUpdate,
      );
      if (!statsData) {
        throw new Error(
          `AniList stats fetch failed: no stats returned for user ${userIdData.User.id}`,
        );
      }

      const writeTimeout = 15000;
      const cardsPayload = buildCardsPayload({
        selectedCards,
        colors,
        showPiePercentages,
        useAnimeStatusColors,
        useMangaStatusColors,
        borderEnabled,
        borderColor,
        showFavoritesByCard,
      });

      // The store endpoints deduplicate by userId/username (with upsert semantics), so retrying the same payload is safe.
      const storeUserPromise = fetchWithRetry(
        "/api/store-users",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            userId: userIdData.User.id,
            username,
            stats: statsData,
          }),
        },
        {
          timeoutMs: writeTimeout,
          contextName: "Store - store-users",
          operationName: "Store users",
          maxRetries: DEFAULT_RETRY_ATTEMPTS,
          onRetry: handleRetryUpdate,
        },
      );

      const storeCardsPromise = fetchWithRetry(
        "/api/store-cards",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            userId: userIdData.User.id,
            cards: cardsPayload,
          }),
        },
        {
          timeoutMs: writeTimeout,
          contextName: "Store - store-cards",
          operationName: "Store cards",
          maxRetries: DEFAULT_RETRY_ATTEMPTS,
          onRetry: handleRetryUpdate,
        },
      );

      const [storeUserResponse, storeCardsResponse] = await Promise.all([
        storeUserPromise,
        storeCardsPromise,
      ]);

      // Validate storage responses and surface helpful errors
      checkResponseOrThrow(storeUserResponse, "Store users failed");
      checkResponseOrThrow(storeCardsResponse, "Store cards failed");

      return { success: true, userId: userIdData.User.id };
    } catch (err) {
      console.error("useStatCardSubmit error:", err);
      if (err instanceof Error) {
        setError(err);
      }
      return { success: false };
    } finally {
      setLoading(false);
      setRetryAttempt(0);
      setRetryOperation(null);
    }
  };

  /**
   * Clear the current error state for the hook.
   * @returns {void}
   * @source
   */
  const clearError = () => {
    setError(null);
    setRetryAttempt(0);
    setRetryOperation(null);
  };

  return {
    loading,
    error,
    submit,
    clearError,
    retryAttempt,
    retryOperation,
    retryLimit: DEFAULT_RETRY_ATTEMPTS,
  };
}
