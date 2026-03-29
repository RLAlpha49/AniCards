import type {
  CardsRecord,
  GlobalCardSettings,
  StoredCardConfig,
} from "@/lib/types/records";
import { getResponseErrorMessage, parseResponsePayload } from "@/lib/utils";

/**
 * Shape of card data received from the server.
 * @source (moved from lib/stores/user-page-editor.ts)
 */
export type ServerCardData = StoredCardConfig;

/**
 * Shape of global settings received from the server.
 * @source (moved from lib/stores/user-page-editor.ts)
 */
export type ServerGlobalSettings = GlobalCardSettings;

export type FetchUserCardsSuccess = CardsRecord;

export type FetchUserCardsError = { error: string; notFound?: true };

function isStrictPositiveInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value > 0;
}

function isStrictPositiveIntegerString(value: unknown): value is string {
  return typeof value === "string" && /^[1-9]\d*$/.test(value.trim());
}

function normalizeFetchUserCardsSuccess(
  payload: unknown,
): FetchUserCardsSuccess | null {
  if (
    typeof payload !== "object" ||
    payload === null ||
    Array.isArray(payload)
  ) {
    return null;
  }

  const data = payload as {
    userId?: unknown;
    cards?: unknown;
    globalSettings?: ServerGlobalSettings;
    updatedAt?: unknown;
  };

  let userId: number | null = null;
  if (isStrictPositiveInteger(data.userId)) {
    userId = data.userId;
  } else if (isStrictPositiveIntegerString(data.userId)) {
    userId = Number(data.userId.trim());
  }

  const updatedAt =
    typeof data.updatedAt === "string" ? data.updatedAt.trim() : "";

  if (userId === null || !Array.isArray(data.cards) || updatedAt.length === 0) {
    return null;
  }

  return {
    userId,
    cards: data.cards as ServerCardData[],
    ...(data.globalSettings === undefined
      ? {}
      : { globalSettings: data.globalSettings }),
    updatedAt,
  };
}

/**
 * Fetch cards and optional global settings for a user from the server.
 * Behavior and error handling preserved from previous hook-local implementations.
 */
export async function fetchUserCards(
  userId: string,
): Promise<FetchUserCardsSuccess | FetchUserCardsError> {
  try {
    const res = await fetch(
      `/api/get-cards?userId=${encodeURIComponent(userId)}`,
    );
    const payload = await parseResponsePayload(res);

    if (!res.ok) {
      const msg = getResponseErrorMessage(res, payload);
      if (res.status === 404) return { error: msg, notFound: true };
      return { error: msg };
    }

    const data = normalizeFetchUserCardsSuccess(payload);
    if (!data) {
      return { error: "Invalid cards data received" };
    }

    return data;
  } catch (err) {
    console.error("Error fetching cards:", err);
    return { error: "Failed to fetch cards" };
  }
}
