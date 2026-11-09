import {
  redisClient,
  incrementAnalyticsInBackground,
  buildAnalyticsMetricKey,
} from "@/lib/api-utils";
import { safeParse } from "@/lib/utils";
import { UserRecord, CardsRecord } from "@/lib/types/records";
import { CardDataError } from "./validation";
import {
  fetchUserDataParts,
  reconstructUserRecord,
  USER_DATA_PARTS,
  UserDataPart,
} from "@/lib/server/user-data";
import { getPartsForCard } from "./requirements";

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

    incrementAnalyticsInBackground(
      buildAnalyticsMetricKey("card_svg", "corrupted_user_records"),
    );
    throw new CardDataError("Server Error: Corrupted user record", 500);
  }
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
  try {
    const userDataParts = await fetchUserDataParts(
      numericUserId,
      USER_DATA_PARTS,
    );

    if (!userDataParts.meta) {
      throw new CardDataError("Not Found: User data not found", 404);
    }

    return reconstructUserRecord(userDataParts);
  } catch (error) {
    if (error instanceof CardDataError) throw error;

    incrementAnalyticsInBackground(
      buildAnalyticsMetricKey("card_svg", "corrupted_user_records"),
    );
    throw new CardDataError("Server Error: Corrupted user record", 500);
  }
}

/**
 * Reads the requested user record parts, mapping a Redis failure to the
 * corrupted-record error the card route renders.
 *
 * Extracted from {@link fetchUserData} so the part read keeps its own error
 * mapping while running at the same time as the independent card-document
 * read.
 *
 * @param numericUserId - Numeric user id stored in Redis keys 'user:{id}'.
 * @param parts - Record parts to read.
 * @returns The parsed parts that were stored.
 * @throws {CardDataError} If a part cannot be read from Redis.
 * @source
 */
async function loadUserDataPartsOrThrow(
  numericUserId: number,
  parts: UserDataPart[],
): Promise<Partial<Record<UserDataPart, unknown>>> {
  try {
    return await fetchUserDataParts(numericUserId, parts);
  } catch (error) {
    if (error instanceof CardDataError) throw error;

    incrementAnalyticsInBackground(
      buildAnalyticsMetricKey("card_svg", "corrupted_user_records"),
    );
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
  const parts = cardName ? getPartsForCard(cardName) : USER_DATA_PARTS;
  const [cardsDataStr, userDataParts] = await Promise.all([
    redisClient.get(`cards:${numericUserId}`),
    loadUserDataPartsOrThrow(numericUserId, parts),
  ]);

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
    incrementAnalyticsInBackground(
      buildAnalyticsMetricKey("card_svg", "corrupted_card_records"),
    );
    throw new CardDataError("Server Error: Corrupted card configuration", 500);
  }

  try {
    userDoc = reconstructUserRecord(userDataParts);
  } catch {
    incrementAnalyticsInBackground(
      buildAnalyticsMetricKey("card_svg", "corrupted_user_records"),
    );
    throw new CardDataError("Server Error: Corrupted user record", 500);
  }

  return { cardDoc, userDoc };
}
