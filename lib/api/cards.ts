import {
  isClientRequestCancelled,
  isClientTimeoutError,
  requestClientJson,
} from "@/lib/api/client-fetch";
import { getErrorDetails } from "@/lib/error-messages";
import type {
  CardsRecord,
  CardsRecordUserSnapshot,
  GlobalCardSettings,
  StoredCardConfig,
} from "@/lib/types/records";
import {
  getStructuredResponseError,
  type StructuredResponseError,
} from "@/lib/utils";

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

export type FetchUserCardsError = {
  error: StructuredResponseError;
  notFound?: true;
};

export interface FetchUserCardsOptions {
  signal?: AbortSignal;
  timeoutMs?: number;
}

function isStrictPositiveInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value > 0;
}

function isStrictPositiveIntegerString(value: unknown): value is string {
  return typeof value === "string" && /^[1-9]\d*$/.test(value.trim());
}

function normalizeCardOrder(value: unknown): string[] | undefined {
  if (!Array.isArray(value)) {
    return undefined;
  }

  const normalized: string[] = [];
  const seen = new Set<string>();

  for (const item of value) {
    if (typeof item !== "string") {
      continue;
    }

    const trimmed = item.trim();
    if (!trimmed || seen.has(trimmed)) {
      continue;
    }

    seen.add(trimmed);
    normalized.push(trimmed);
  }

  return normalized.length > 0 ? normalized : undefined;
}

function normalizeOptionalPositiveInteger(value: unknown): number | undefined {
  if (isStrictPositiveInteger(value)) {
    return value;
  }

  if (isStrictPositiveIntegerString(value)) {
    return Number(value.trim());
  }

  return undefined;
}

function normalizeCardsRecordUserSnapshot(
  value: unknown,
): CardsRecordUserSnapshot | undefined {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return undefined;
  }

  const data = value as {
    token?: unknown;
    revision?: unknown;
    updatedAt?: unknown;
    committedAt?: unknown;
  };

  const token =
    typeof data.token === "string" && data.token.trim().length > 0
      ? data.token.trim()
      : undefined;
  const revision = normalizeOptionalPositiveInteger(data.revision);
  const updatedAt =
    typeof data.updatedAt === "string" && data.updatedAt.trim().length > 0
      ? data.updatedAt.trim()
      : undefined;
  const committedAt =
    typeof data.committedAt === "string" && data.committedAt.trim().length > 0
      ? data.committedAt.trim()
      : undefined;

  if (!token && !revision && !updatedAt && !committedAt) {
    return undefined;
  }

  return {
    ...(token ? { token } : {}),
    ...(revision ? { revision } : {}),
    ...(updatedAt ? { updatedAt } : {}),
    ...(committedAt ? { committedAt } : {}),
  };
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
    cardOrder?: unknown;
    globalSettings?: ServerGlobalSettings;
    updatedAt?: unknown;
    version?: unknown;
    schemaVersion?: unknown;
    userSnapshot?: unknown;
  };

  let userId: number | null = null;
  if (isStrictPositiveInteger(data.userId)) {
    userId = data.userId;
  } else if (isStrictPositiveIntegerString(data.userId)) {
    userId = Number(data.userId.trim());
  }

  const updatedAt =
    typeof data.updatedAt === "string" ? data.updatedAt.trim() : "";
  const cardOrder = normalizeCardOrder(data.cardOrder);
  const version = normalizeOptionalPositiveInteger(data.version);
  const schemaVersion = normalizeOptionalPositiveInteger(data.schemaVersion);
  const userSnapshot = normalizeCardsRecordUserSnapshot(data.userSnapshot);

  if (userId === null || !Array.isArray(data.cards) || updatedAt.length === 0) {
    return null;
  }

  return {
    userId,
    cards: data.cards as ServerCardData[],
    ...(cardOrder ? { cardOrder } : {}),
    ...(data.globalSettings === undefined
      ? {}
      : { globalSettings: data.globalSettings }),
    ...(version ? { version } : {}),
    ...(schemaVersion ? { schemaVersion } : {}),
    ...(userSnapshot ? { userSnapshot } : {}),
    updatedAt,
  };
}

function createFetchUserCardsError(
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

/**
 * Fetch cards and optional global settings for a user from the server.
 * Behavior and error handling preserved from previous hook-local implementations.
 */
export async function fetchUserCards(
  userId: string,
  options: FetchUserCardsOptions = {},
): Promise<FetchUserCardsSuccess | FetchUserCardsError> {
  try {
    const { response: res, payload } = await requestClientJson(
      `/api/get-cards?userId=${encodeURIComponent(userId)}`,
      {
        cache: "no-store",
        signal: options.signal,
        timeoutMs: options.timeoutMs,
      },
    );

    if (!res.ok) {
      const error = getStructuredResponseError(res, payload);
      if (res.status === 404) return { error, notFound: true };
      return { error };
    }

    const data = normalizeFetchUserCardsSuccess(payload);
    if (!data) {
      return {
        error: createFetchUserCardsError("Invalid cards data received"),
      };
    }

    return data;
  } catch (err) {
    if (isClientRequestCancelled(err, options.signal)) {
      throw err;
    }

    console.error("Error fetching cards:", err);

    if (isClientTimeoutError(err)) {
      return {
        error: createFetchUserCardsError(
          "Loading your cards timed out. Please try again.",
        ),
      };
    }

    return {
      error: createFetchUserCardsError(
        "Failed to fetch cards. Please check your connection and try again.",
      ),
    };
  }
}
