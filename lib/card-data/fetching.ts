import {
  redisClient,
  incrementAnalytics,
  buildAnalyticsMetricKey,
} from "@/lib/api-utils";
import { safeParse } from "@/lib/utils";
import { UserRecord, CardsRecord } from "@/lib/types/records";
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
 * Loads only the user record from Redis for a numeric user ID.
 * This is used when card configuration can be built entirely from URL params.
 * @param numericUserId - Numeric user id stored in Redis key 'user:{id}'.
 * @returns Parsed UserRecord.
 * @throws {CardDataError} If no data exists (404) or parsed data is corrupted (500).
 * @source
 */
export async function fetchUserDataOnly(
  numericUserId: number,
): Promise<UserRecord> {
  const userDataStr = await redisClient.get(`user:${numericUserId}`);

  if (!userDataStr || userDataStr === "null") {
    throw new CardDataError("Not Found: User data not found", 404);
  }

  try {
    return safeParse<UserRecord>(
      userDataStr,
      `Card SVG: user:${numericUserId}`,
    );
  } catch {
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
 * @returns Object containing parsed card (CardsRecord) and user (UserRecord) documents.
 * @throws {CardDataError} If no data exists (404) or parsed data is corrupted (500).
 * @source
 */
export async function fetchUserData(
  numericUserId: number,
): Promise<{ cardDoc: CardsRecord; userDoc: UserRecord }> {
  const [cardsDataStr, userDataStr] = await Promise.all([
    redisClient.get(`cards:${numericUserId}`),
    redisClient.get(`user:${numericUserId}`),
  ]);

  if (
    !cardsDataStr ||
    cardsDataStr === "null" ||
    !userDataStr ||
    userDataStr === "null"
  ) {
    throw new CardDataError("Not Found: User data not found", 404);
  }

  let cardDoc: CardsRecord;
  let userDoc: UserRecord;
  try {
    cardDoc = safeParse<CardsRecord>(
      cardsDataStr,
      `Card SVG: cards:${numericUserId}`,
    );
  } catch {
    incrementAnalytics(
      buildAnalyticsMetricKey("card_svg", "corrupted_card_records"),
    ).catch(() => {});
    throw new CardDataError("Server Error: Corrupted card configuration", 500);
  }
  try {
    userDoc = safeParse<UserRecord>(
      userDataStr,
      `Card SVG: user:${numericUserId}`,
    );
  } catch {
    incrementAnalytics(
      buildAnalyticsMetricKey("card_svg", "corrupted_user_records"),
    ).catch(() => {});
    throw new CardDataError("Server Error: Corrupted user record", 500);
  }

  return { cardDoc, userDoc };
}
