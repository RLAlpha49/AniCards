import {
  buildAnalyticsMetricKey,
  incrementAnalytics,
  isRedisBackplaneUnavailable,
  redisClient,
} from "@/lib/api-utils";
import {
  fetchUserDataParts,
  getPartsForCard,
  reconstructUserRecord,
  UserDataPart,
} from "@/lib/server/user-data";
import { CardsRecord, UserRecord } from "@/lib/types/records";
import { safeParse } from "@/lib/utils";

import { CardDataError } from "./validation";

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
  const normalizedUsername = username.trim().toLowerCase();
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
  try {
    const parts = getPartsForCard(cardName);
    const userDataParts = await fetchUserDataParts(numericUserId, parts);

    if (!userDataParts.meta) {
      throw new CardDataError("Not Found: User data not found", 404);
    }

    return reconstructUserRecord(userDataParts);
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

  const [cardsDataResult, userDataPartsResult] = await Promise.all([
    redisClient.get(`cards:${numericUserId}`).then(
      (value) => ({ ok: true as const, value }),
      (error) => ({ ok: false as const, error }),
    ),
    fetchUserDataParts(numericUserId, parts).then(
      (value) => ({ ok: true as const, value }),
      (error) => ({ ok: false as const, error }),
    ),
  ]);

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

  const userDataParts = userDataPartsResult.value;

  if (!cardsDataStr || cardsDataStr === "null" || !userDataParts.meta) {
    throw new CardDataError("Not Found: User data not found", 404);
  }

  let cardDoc: CardsRecord;
  let userDoc: UserRecord;
  try {
    cardDoc = safeParse<CardsRecord>(
      cardsDataStr as string,
      `Card SVG: cards:${numericUserId}`,
    );
  } catch {
    incrementAnalytics(
      buildAnalyticsMetricKey("card_svg", "corrupted_card_records"),
    ).catch(() => {});
    throw new CardDataError("Server Error: Corrupted card configuration", 500);
  }

  try {
    userDoc = reconstructUserRecord(userDataParts);
  } catch {
    incrementAnalytics(
      buildAnalyticsMetricKey("card_svg", "corrupted_user_records"),
    ).catch(() => {});
    throw new CardDataError("Server Error: Corrupted user record", 500);
  }

  return { cardDoc, userDoc };
}
