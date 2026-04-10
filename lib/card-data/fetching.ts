import { redisClient } from "@/lib/api/clients";
import { isRedisBackplaneUnavailable } from "@/lib/api/errors";
import {
  buildAnalyticsMetricKey,
  incrementAnalytics,
} from "@/lib/api/telemetry";
import {
  fetchUserDataSnapshot,
  getPartsForCard,
  normalizeUsernameIndexValue,
  PersistedUserState,
  reconstructUserRecord,
  UserDataPart,
} from "@/lib/server/user-data";
import { CardsRecord, UserRecord } from "@/lib/types/records";
import { safeParse } from "@/lib/utils";

import { CardDataError } from "./validation";

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function isOptionalString(value: unknown): value is string | undefined {
  return value === undefined || typeof value === "string";
}

function isOptionalBoolean(value: unknown): value is boolean | undefined {
  return value === undefined || typeof value === "boolean";
}

function isOptionalFiniteNumber(value: unknown): value is number | undefined {
  return (
    value === undefined || (typeof value === "number" && Number.isFinite(value))
  );
}

function isValidStoredCardConfig(value: unknown): boolean {
  if (!isPlainObject(value)) return false;

  return (
    isNonEmptyString(value.cardName) &&
    isOptionalString(value.variation) &&
    isOptionalString(value.colorPreset) &&
    isOptionalString(value.borderColor) &&
    isOptionalFiniteNumber(value.borderRadius) &&
    isOptionalBoolean(value.showFavorites) &&
    isOptionalBoolean(value.useStatusColors) &&
    isOptionalBoolean(value.showPiePercentages) &&
    isOptionalFiniteNumber(value.gridCols) &&
    isOptionalFiniteNumber(value.gridRows) &&
    isOptionalBoolean(value.useCustomSettings) &&
    isOptionalBoolean(value.disabled)
  );
}

function isValidGlobalCardSettings(value: unknown): boolean {
  if (!isPlainObject(value)) return false;

  return (
    isOptionalString(value.colorPreset) &&
    isOptionalString(value.borderColor) &&
    isOptionalBoolean(value.borderEnabled) &&
    isOptionalFiniteNumber(value.borderRadius) &&
    isOptionalBoolean(value.useStatusColors) &&
    isOptionalBoolean(value.showPiePercentages) &&
    isOptionalBoolean(value.showFavorites) &&
    isOptionalFiniteNumber(value.gridCols) &&
    isOptionalFiniteNumber(value.gridRows)
  );
}

function normalizeCardsRecordUserSnapshot(
  value: unknown,
): CardsRecord["userSnapshot"] | undefined {
  if (!isPlainObject(value)) {
    return undefined;
  }

  const normalized: NonNullable<CardsRecord["userSnapshot"]> = {
    ...(typeof value.token === "string" && value.token.length > 0
      ? { token: value.token }
      : {}),
    ...(typeof value.updatedAt === "string" && value.updatedAt.length > 0
      ? { updatedAt: value.updatedAt }
      : {}),
    ...(typeof value.committedAt === "string" && value.committedAt.length > 0
      ? { committedAt: value.committedAt }
      : {}),
    ...(typeof value.revision === "number" && value.revision > 0
      ? { revision: value.revision }
      : {}),
  };

  return Object.keys(normalized).length > 0 ? normalized : undefined;
}

class CardsRecordIntegrityError extends Error {
  statusCode = 500 as const;
  category = "server_error" as const;
  retryable = false;
  publicMessage = "Stored cards record is incomplete or corrupted";

  constructor(message: string) {
    super(message);
    this.name = "CardsRecordIntegrityError";
  }
}

function normalizeStoredCardsRecordUserId(options: {
  rawStoredUserId: unknown;
  expectedUserId: number;
  allowLegacyMissingUserId?: boolean;
}): number | undefined {
  if (
    typeof options.rawStoredUserId === "number" &&
    Number.isInteger(options.rawStoredUserId) &&
    options.rawStoredUserId > 0
  ) {
    return options.rawStoredUserId;
  }

  if (
    options.allowLegacyMissingUserId &&
    (options.rawStoredUserId === undefined || options.rawStoredUserId === null)
  ) {
    return options.expectedUserId;
  }

  return undefined;
}

function normalizeStoredCardsRecordUpdatedAt(options: {
  rawUpdatedAt: unknown;
  allowLegacyMissingUpdatedAt?: boolean;
}): string | undefined {
  if (isNonEmptyString(options.rawUpdatedAt)) {
    return options.rawUpdatedAt;
  }

  if (options.allowLegacyMissingUpdatedAt) {
    return "";
  }

  return undefined;
}

export function parseStoredCardsRecord(
  rawValue: unknown,
  context: string,
  expectedUserId: number,
  options?: {
    allowLegacyMissingUpdatedAt?: boolean;
    allowLegacyMissingUserId?: boolean;
  },
): CardsRecord {
  let parsedValue: unknown;

  try {
    parsedValue = safeParse<unknown>(rawValue, context);
  } catch {
    throw new CardsRecordIntegrityError(
      "Stored cards record is not valid JSON",
    );
  }

  if (!isPlainObject(parsedValue)) {
    throw new CardsRecordIntegrityError("Stored cards record is not an object");
  }

  const storedUserId = normalizeStoredCardsRecordUserId({
    rawStoredUserId: parsedValue.userId,
    expectedUserId,
    allowLegacyMissingUserId: options?.allowLegacyMissingUserId,
  });

  if (!storedUserId) {
    throw new CardsRecordIntegrityError(
      "Stored cards record has an invalid userId",
    );
  }

  if (storedUserId !== expectedUserId) {
    throw new CardsRecordIntegrityError(
      "Stored cards record userId does not match requested user",
    );
  }

  if (!Array.isArray(parsedValue.cards)) {
    throw new CardsRecordIntegrityError(
      "Stored cards record has an invalid cards array",
    );
  }

  if (!parsedValue.cards.every((card) => isValidStoredCardConfig(card))) {
    throw new CardsRecordIntegrityError(
      "Stored cards record contains an invalid card entry",
    );
  }

  if (
    parsedValue.globalSettings !== undefined &&
    !isValidGlobalCardSettings(parsedValue.globalSettings)
  ) {
    throw new CardsRecordIntegrityError(
      "Stored cards record has invalid global settings",
    );
  }

  const updatedAt = normalizeStoredCardsRecordUpdatedAt({
    rawUpdatedAt: parsedValue.updatedAt,
    allowLegacyMissingUpdatedAt: options?.allowLegacyMissingUpdatedAt,
  });

  if (updatedAt === undefined) {
    throw new CardsRecordIntegrityError(
      "Stored cards record has an invalid updatedAt value",
    );
  }

  const normalizedUserSnapshot = normalizeCardsRecordUserSnapshot(
    parsedValue.userSnapshot,
  );
  const globalSettings = parsedValue.globalSettings;

  return {
    userId: storedUserId,
    cards: parsedValue.cards,
    ...(globalSettings == null ? {} : { globalSettings }),
    updatedAt,
    ...(typeof parsedValue.schemaVersion === "number" &&
    parsedValue.schemaVersion > 0
      ? { schemaVersion: parsedValue.schemaVersion }
      : {}),
    ...(normalizedUserSnapshot ? { userSnapshot: normalizedUserSnapshot } : {}),
  };
}

/**
 * Resolves a username to a numeric user ID via the Redis username index.
 * Returns null if the username is not found or the lookup fails.
 *
 * @param username - The username to resolve (case-insensitive).
 * @returns The resolved user ID or null when the lookup fails.
 * @source
 */
export async function resolveUserIdFromUsername(
  username: string,
): Promise<number | null> {
  const normalizedUsername = normalizeUsernameIndexValue(username);
  if (!normalizedUsername) return null;
  const usernameIndexKey = `username:${normalizedUsername}`;
  console.log(
    `🔍 [Card Data] Searching user index for username: ${normalizedUsername}`,
  );
  const userIdFromIndex = await redisClient.get(usernameIndexKey);
  if (!userIdFromIndex) return null;
  const candidate = Number.parseInt(userIdFromIndex as string, 10);
  if (Number.isNaN(candidate)) return null;
  console.log(
    `✅ [Card Data] Resolved username ${normalizedUsername} to userId: ${candidate}`,
  );
  return candidate;
}

/**
 * Loads only the required user record parts from Redis for a numeric user ID and card name.
 * @param numericUserId - Numeric user id.
 * @param cardName - Name of the card to determine required parts.
 * @returns Parsed UserRecord (potentially partial).
 * @throws {CardDataError} If no data exists (404) or parsed data is corrupted (500).
 * @source
 */
export async function fetchUserDataForCard(
  numericUserId: number,
  cardName: string,
): Promise<UserRecord> {
  const result = await fetchUserDataForCardWithState(numericUserId, cardName);
  return result.userDoc;
}

export async function fetchUserDataForCardWithState(
  numericUserId: number,
  cardName: string,
): Promise<{
  userDoc: UserRecord;
  userReadState: PersistedUserState | null;
  snapshotMatched: boolean;
}> {
  try {
    const parts = getPartsForCard(cardName);
    const userDataResult = await fetchUserDataSnapshot(numericUserId, parts, {
      audit: false,
    });
    const userDataParts = userDataResult.parts;

    if (!userDataParts.meta) {
      throw new CardDataError("Not Found: User data not found", 404);
    }

    return {
      userDoc: reconstructUserRecord(userDataParts),
      userReadState: userDataResult.state,
      snapshotMatched: userDataResult.snapshotMatched,
    };
  } catch (error) {
    if (error instanceof CardDataError) throw error;

    if (isRedisBackplaneUnavailable(error)) {
      throw new CardDataError(
        "Server Error: User data is temporarily unavailable",
        503,
      );
    }

    incrementAnalytics(
      buildAnalyticsMetricKey("card_svg", "corrupted_user_records"),
    ).catch(() => {});
    throw new CardDataError("Server Error: Corrupted user record", 500);
  }
}

/**
 * Loads and parses cached cards and user records from Redis for a numeric user ID.
 * Validates presence and JSON structure; records corrupted or missing values will increment analytics and throw CardDataError.
 * @param numericUserId - Numeric user id stored in Redis keys 'cards:{id}' and 'user:{id}'.
 * @param cardName - Optional card name to fetch only required user data parts.
 * @returns Object containing parsed card (CardsRecord) and user (UserRecord) documents.
 * @throws {CardDataError} If no data exists (404) or parsed data is corrupted (500).
 * @source
 */
export async function fetchUserData(
  numericUserId: number,
  cardName?: string,
): Promise<{ cardDoc: CardsRecord; userDoc: UserRecord }> {
  const result = await fetchUserDataWithState(numericUserId, cardName);
  return {
    cardDoc: result.cardDoc,
    userDoc: result.userDoc,
  };
}

function matchesRequestedUserSnapshot(
  state: PersistedUserState | null,
  expectedSnapshot: CardsRecord["userSnapshot"],
): boolean {
  if (!expectedSnapshot?.token && !expectedSnapshot?.updatedAt) {
    return true;
  }

  return Boolean(
    (expectedSnapshot?.token &&
      state?.snapshot?.token === expectedSnapshot.token) ||
    (expectedSnapshot?.updatedAt &&
      state?.snapshot?.updatedAt === expectedSnapshot.updatedAt) ||
    (expectedSnapshot?.updatedAt &&
      state?.updatedAt === expectedSnapshot.updatedAt),
  );
}

export async function fetchUserDataWithState(
  numericUserId: number,
  cardName?: string,
): Promise<{
  cardDoc: CardsRecord;
  userDoc: UserRecord;
  userReadState: PersistedUserState | null;
  snapshotMatched: boolean;
}> {
  const parts = cardName
    ? getPartsForCard(cardName)
    : ([
        "meta",
        "activity",
        "favourites",
        "statistics",
        "pages",
        "planning",
        "current",
        "rewatched",
        "completed",
      ] as UserDataPart[]);

  const cardsDataPromise = redisClient.get(`cards:${numericUserId}`).then(
    (value) => ({ ok: true as const, value }),
    (error) => ({ ok: false as const, error }),
  );

  const optimisticUserDataPromise = fetchUserDataSnapshot(
    numericUserId,
    parts,
    { audit: false },
  ).then(
    (value) => ({ ok: true as const, value }),
    (error) => ({ ok: false as const, error }),
  );

  const cardsDataResult = await cardsDataPromise;

  if (!cardsDataResult.ok) {
    const { error } = cardsDataResult;
    if (isRedisBackplaneUnavailable(error)) {
      throw new CardDataError(
        "Server Error: Card data is temporarily unavailable",
        503,
      );
    }

    throw error;
  }

  const cardsDataStr = cardsDataResult.value;

  if (!cardsDataStr || cardsDataStr === "null") {
    throw new CardDataError("Not Found: User data not found", 404);
  }

  let cardDoc: CardsRecord;
  try {
    cardDoc = parseStoredCardsRecord(
      cardsDataStr as string,
      `Card SVG: cards:${numericUserId}`,
      numericUserId,
      {
        allowLegacyMissingUpdatedAt: true,
        allowLegacyMissingUserId: true,
      },
    );
  } catch {
    incrementAnalytics(
      buildAnalyticsMetricKey("card_svg", "corrupted_card_records"),
    ).catch(() => {});
    throw new CardDataError("Server Error: Corrupted card configuration", 500);
  }

  let userDataPartsResult = await optimisticUserDataPromise;

  if (
    !matchesRequestedUserSnapshot(
      userDataPartsResult.ok ? userDataPartsResult.value.state : null,
      cardDoc.userSnapshot,
    )
  ) {
    userDataPartsResult = await fetchUserDataSnapshot(numericUserId, parts, {
      expectedSnapshotToken: cardDoc.userSnapshot?.token,
      expectedUpdatedAt: cardDoc.userSnapshot?.updatedAt,
      audit: false,
    }).then(
      (value) => ({ ok: true as const, value }),
      (error) => ({ ok: false as const, error }),
    );
  }

  if (!userDataPartsResult.ok) {
    const { error } = userDataPartsResult;
    if (error instanceof CardDataError) throw error;

    if (isRedisBackplaneUnavailable(error)) {
      throw new CardDataError(
        "Server Error: User data is temporarily unavailable",
        503,
      );
    }

    incrementAnalytics(
      buildAnalyticsMetricKey("card_svg", "corrupted_user_records"),
    ).catch(() => {});
    throw new CardDataError("Server Error: Corrupted user record", 500);
  }

  const userDataParts = userDataPartsResult.value.parts;

  if (!userDataParts.meta) {
    throw new CardDataError("Not Found: User data not found", 404);
  }

  let userDoc: UserRecord;

  try {
    userDoc = reconstructUserRecord(userDataParts);
  } catch {
    incrementAnalytics(
      buildAnalyticsMetricKey("card_svg", "corrupted_user_records"),
    ).catch(() => {});
    throw new CardDataError("Server Error: Corrupted user record", 500);
  }

  return {
    cardDoc,
    userDoc,
    userReadState: userDataPartsResult.value.state,
    snapshotMatched: userDataPartsResult.value.snapshotMatched,
  };
}
