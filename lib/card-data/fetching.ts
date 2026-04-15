import { redisClient } from "@/lib/api/clients";
import { isRedisBackplaneUnavailable } from "@/lib/api/errors";
import { logPrivacySafe } from "@/lib/api/logging";
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
  resolveCommittedUserSnapshotState,
  UserDataPart,
} from "@/lib/server/user-data";
import {
  CardsRecord,
  CardsRecordMetadata,
  UserRecord,
} from "@/lib/types/records";
import { safeParse } from "@/lib/utils";

import { CardDataError } from "./validation";

const getStoredCardsKey = (numericUserId: number) => `cards:${numericUserId}`;
export const getStoredCardsMetaKey = (numericUserId: number) =>
  `cards:${numericUserId}:meta`;

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

function normalizeCardsRecordVersion(value: unknown): number | undefined {
  return typeof value === "number" && Number.isInteger(value) && value > 0
    ? value
    : undefined;
}

export function hasDurableStoredCardsUserSnapshot(
  snapshot: CardsRecord["userSnapshot"] | undefined,
): snapshot is Required<NonNullable<CardsRecord["userSnapshot"]>> {
  return Boolean(
    snapshot &&
    typeof snapshot.token === "string" &&
    snapshot.token.length > 0 &&
    typeof snapshot.updatedAt === "string" &&
    snapshot.updatedAt.length > 0 &&
    typeof snapshot.committedAt === "string" &&
    snapshot.committedAt.length > 0 &&
    typeof snapshot.revision === "number" &&
    snapshot.revision > 0,
  );
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

function normalizeStoredCardsRecordCardOrder(
  value: unknown,
): string[] | undefined {
  if (!Array.isArray(value)) {
    return undefined;
  }

  const normalized: string[] = [];
  const seen = new Set<string>();

  for (const item of value) {
    if (!isNonEmptyString(item)) {
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

export function buildStoredCardsRecordMetadata(
  record: CardsRecord,
): CardsRecordMetadata {
  return {
    userId: record.userId,
    updatedAt: record.updatedAt,
    ...(typeof record.version === "number" && record.version > 0
      ? { version: record.version }
      : {}),
    ...(typeof record.schemaVersion === "number" && record.schemaVersion > 0
      ? { schemaVersion: record.schemaVersion }
      : {}),
    ...(record.userSnapshot ? { userSnapshot: record.userSnapshot } : {}),
  };
}

export function parseStoredCardsRecordMetadata(
  rawValue: unknown,
  context: string,
  expectedUserId: number,
  options?: {
    allowLegacyMissingUpdatedAt?: boolean;
    allowLegacyMissingUserId?: boolean;
  },
): CardsRecordMetadata {
  let parsedValue: unknown;

  try {
    parsedValue = safeParse<unknown>(rawValue, context);
  } catch {
    throw new CardsRecordIntegrityError(
      "Stored cards metadata is not valid JSON",
    );
  }

  if (!isPlainObject(parsedValue)) {
    throw new CardsRecordIntegrityError(
      "Stored cards metadata is not an object",
    );
  }

  const storedUserId = normalizeStoredCardsRecordUserId({
    rawStoredUserId: parsedValue.userId,
    expectedUserId,
    allowLegacyMissingUserId: options?.allowLegacyMissingUserId,
  });

  if (!storedUserId) {
    throw new CardsRecordIntegrityError(
      "Stored cards metadata has an invalid userId",
    );
  }

  if (storedUserId !== expectedUserId) {
    throw new CardsRecordIntegrityError(
      "Stored cards metadata userId does not match requested user",
    );
  }

  const updatedAt = normalizeStoredCardsRecordUpdatedAt({
    rawUpdatedAt: parsedValue.updatedAt,
    allowLegacyMissingUpdatedAt: options?.allowLegacyMissingUpdatedAt,
  });

  if (updatedAt === undefined) {
    throw new CardsRecordIntegrityError(
      "Stored cards metadata has an invalid updatedAt value",
    );
  }

  const normalizedUserSnapshot = normalizeCardsRecordUserSnapshot(
    parsedValue.userSnapshot,
  );

  return {
    userId: storedUserId,
    updatedAt,
    ...(normalizeCardsRecordVersion(parsedValue.version)
      ? { version: normalizeCardsRecordVersion(parsedValue.version) }
      : {}),
    ...(typeof parsedValue.schemaVersion === "number" &&
    parsedValue.schemaVersion > 0
      ? { schemaVersion: parsedValue.schemaVersion }
      : {}),
    ...(normalizedUserSnapshot ? { userSnapshot: normalizedUserSnapshot } : {}),
  };
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
  const normalizedCardOrder = normalizeStoredCardsRecordCardOrder(
    parsedValue.cardOrder,
  );
  const globalSettings = parsedValue.globalSettings;

  return {
    userId: storedUserId,
    cards: parsedValue.cards,
    ...(normalizedCardOrder ? { cardOrder: normalizedCardOrder } : {}),
    ...(globalSettings == null ? {} : { globalSettings }),
    updatedAt,
    ...(normalizeCardsRecordVersion(parsedValue.version)
      ? { version: normalizeCardsRecordVersion(parsedValue.version) }
      : {}),
    ...(typeof parsedValue.schemaVersion === "number" &&
    parsedValue.schemaVersion > 0
      ? { schemaVersion: parsedValue.schemaVersion }
      : {}),
    ...(normalizedUserSnapshot ? { userSnapshot: normalizedUserSnapshot } : {}),
  };
}

export async function fetchStoredCardsRecord(
  numericUserId: number,
): Promise<CardsRecord> {
  const cardsDataResult = await redisClient
    .get(getStoredCardsKey(numericUserId))
    .then(
      (value) => ({ ok: true as const, value }),
      (error) => ({ ok: false as const, error }),
    );

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

  try {
    return parseStoredCardsRecord(
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
}

export async function fetchStoredCardsRecordCacheStamp(
  numericUserId: number,
): Promise<{
  cardMeta: CardsRecordMetadata;
  preloadedCardDoc?: CardsRecord;
}> {
  const cardsMetaResult = await redisClient
    .get(getStoredCardsMetaKey(numericUserId))
    .then(
      (value) => ({ ok: true as const, value }),
      (error) => ({ ok: false as const, error }),
    );

  if (!cardsMetaResult.ok) {
    const { error } = cardsMetaResult;
    if (isRedisBackplaneUnavailable(error)) {
      throw new CardDataError(
        "Server Error: Card data is temporarily unavailable",
        503,
      );
    }

    throw error;
  }

  const cardsMetaRaw = cardsMetaResult.value;
  if (cardsMetaRaw && cardsMetaRaw !== "null") {
    try {
      return {
        cardMeta: parseStoredCardsRecordMetadata(
          cardsMetaRaw as string,
          `Card SVG: cards-meta:${numericUserId}`,
          numericUserId,
          {
            allowLegacyMissingUpdatedAt: true,
            allowLegacyMissingUserId: true,
          },
        ),
      };
    } catch {
      try {
        const preloadedCardDoc = parseStoredCardsRecord(
          cardsMetaRaw as string,
          `Card SVG: cards-meta-fallback:${numericUserId}`,
          numericUserId,
          {
            allowLegacyMissingUpdatedAt: true,
            allowLegacyMissingUserId: true,
          },
        );

        return {
          cardMeta: buildStoredCardsRecordMetadata(preloadedCardDoc),
          preloadedCardDoc,
        };
      } catch {
        // Fall through to the canonical full-record lookup below.
      }
    }
  }

  const preloadedCardDoc = await fetchStoredCardsRecord(numericUserId);

  return {
    cardMeta: buildStoredCardsRecordMetadata(preloadedCardDoc),
    preloadedCardDoc,
  };
}

export async function resolveStoredCardsParentSnapshotState(
  numericUserId: number,
  cardDoc: CardsRecord,
): Promise<PersistedUserState | null> {
  if (!hasDurableStoredCardsUserSnapshot(cardDoc.userSnapshot)) {
    return null;
  }

  const snapshotState = await resolveCommittedUserSnapshotState(numericUserId, {
    expectedSnapshotToken: cardDoc.userSnapshot.token,
    expectedUpdatedAt: cardDoc.userSnapshot.updatedAt,
  });

  return snapshotState.snapshotMatched ? snapshotState.state : null;
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
  logPrivacySafe("log", "Card Data", "Searching username index", {
    username: normalizedUsername,
  });
  const userIdFromIndex = await redisClient.get(usernameIndexKey);
  if (!userIdFromIndex) return null;
  const candidate = Number.parseInt(userIdFromIndex as string, 10);
  if (Number.isNaN(candidate)) return null;
  logPrivacySafe("log", "Card Data", "Resolved lookup by username", {
    username: normalizedUsername,
    userId: candidate,
  });
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

function getRequestedUserDataParts(cardName?: string): UserDataPart[] {
  return cardName
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
}

async function fetchUserDataForStoredCardRecord(params: {
  cardDoc: CardsRecord;
  cardName?: string;
  numericUserId: number;
}): Promise<{
  userDoc: UserRecord;
  userReadState: PersistedUserState | null;
  snapshotMatched: boolean;
}> {
  const { cardDoc, cardName, numericUserId } = params;
  const parts = getRequestedUserDataParts(cardName);
  const requiresCommittedSnapshot = hasDurableStoredCardsUserSnapshot(
    cardDoc.userSnapshot,
  );

  if (requiresCommittedSnapshot) {
    const snapshotState = await resolveStoredCardsParentSnapshotState(
      numericUserId,
      cardDoc,
    );

    if (!snapshotState) {
      throw new CardDataError(
        "Not Found: Card configuration snapshot is no longer available. Try to regenerate the card.",
        404,
      );
    }
  }

  const hasRequestedSnapshot = requiresCommittedSnapshot;

  let userDataPartsResult;
  try {
    userDataPartsResult = await fetchUserDataSnapshot(numericUserId, parts, {
      audit: false,
      ...(hasRequestedSnapshot
        ? {
            expectedSnapshotToken: cardDoc.userSnapshot?.token,
            expectedUpdatedAt: cardDoc.userSnapshot?.updatedAt,
          }
        : {}),
    });
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

  const userDataParts = userDataPartsResult.parts;

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
    userDoc,
    userReadState: userDataPartsResult.state,
    snapshotMatched: userDataPartsResult.snapshotMatched,
  };
}

export async function fetchUserDataWithState(
  numericUserId: number,
  cardName?: string,
  options?: {
    preloadedCardDoc?: CardsRecord;
  },
): Promise<{
  cardDoc: CardsRecord;
  userDoc: UserRecord;
  userReadState: PersistedUserState | null;
  snapshotMatched: boolean;
}> {
  const cardDoc =
    options?.preloadedCardDoc ?? (await fetchStoredCardsRecord(numericUserId));

  const { userDoc, userReadState, snapshotMatched } =
    await fetchUserDataForStoredCardRecord({
      cardDoc,
      cardName,
      numericUserId,
    });

  return {
    cardDoc,
    userDoc,
    userReadState,
    snapshotMatched,
  };
}
