import {
  redisClient,
  incrementAnalytics,
  isValidUsername,
  jsonWithCors,
  apiJsonHeaders,
} from "@/lib/api-utils";
import {
  fetchUserDataParts,
  reconstructUserRecord,
  USER_DATA_PARTS,
} from "@/lib/server/user-data";
import { getUserActivity } from "@/lib/server/user-activity";

/**
 * Retrieves user data by userId or username and records analytics around the lookup.
 * @param request - Incoming request with query parameters and headers.
 * @returns NextResponse carrying the user data or the relevant error payload.
 * @source
 */
export async function GET(request: Request) {
  const startTime = Date.now();
  const ip = request.headers.get("x-forwarded-for") || "127.0.0.1";
  console.log(`🚀 [User API] Received request from IP: ${ip}`);

  const { searchParams } = new URL(request.url);
  const userIdParam = searchParams.get("userId");
  const usernameParam = searchParams.get("username");

  if (!userIdParam && !usernameParam) {
    console.warn("⚠️ [User API] Missing userId or username parameter");
    incrementAnalytics("analytics:user_api:failed_requests").catch(() => {});
    return jsonWithCors(
      { error: "Missing userId or username parameter" },
      request,
      400,
    );
  }
  let numericUserId: number | null = null;

  if (userIdParam) {
    numericUserId = Number.parseInt(userIdParam, 10);
    if (Number.isNaN(numericUserId)) {
      console.warn(
        `⚠️ [User API] Invalid userId parameter provided: ${userIdParam}`,
      );
      incrementAnalytics("analytics:user_api:failed_requests").catch(() => {});
      return jsonWithCors({ error: "Invalid userId parameter" }, request, 400);
    }
    console.log(`🚀 [User API] Request received for userId: ${numericUserId}`);
  } else {
    if (!isValidUsername(usernameParam)) {
      console.warn(
        `⚠️ [User API] Invalid username parameter provided: ${usernameParam}`,
      );
      incrementAnalytics("analytics:user_api:failed_requests").catch(() => {});
      return jsonWithCors(
        { error: "Invalid username parameter" },
        request,
        400,
      );
    }

    /**
     * Resolves a normalized username to a numeric user ID via the Redis username index.
     * @param u - The username to normalize and resolve.
     * @returns The resolved user ID or null when the lookup fails.
     * @source
     */
    async function resolveUserIdFromUsername(
      u: string,
    ): Promise<number | null> {
      const normalizedUsername = u.trim().toLowerCase();
      const usernameIndexKey = `username:${normalizedUsername}`;
      console.log(
        `🔍 [User API] Searching user index for username: ${normalizedUsername}`,
      );
      const userIdFromIndex = await redisClient.get(usernameIndexKey);
      if (!userIdFromIndex) return null;
      const candidate = Number.parseInt(userIdFromIndex as string, 10);
      if (Number.isNaN(candidate)) return null;
      console.log(
        `🚀 [User API] Request received for username: ${normalizedUsername} (userId: ${candidate})`,
      );
      return candidate;
    }

    const userId = await resolveUserIdFromUsername(usernameParam!);
    if (!userId) {
      console.warn(
        `⚠️ [User API] User not found for username: ${usernameParam}`,
      );
      incrementAnalytics("analytics:user_api:failed_requests").catch(() => {});
      return jsonWithCors({ error: "User not found" }, request, 404);
    }

    numericUserId = userId;
  }

  try {
    const userDataParts = await fetchUserDataParts(
      numericUserId,
      USER_DATA_PARTS,
    );
    const duration = Date.now() - startTime;

    if (!userDataParts.meta) {
      console.warn(
        `⚠️ [User API] User record not found for userId ${numericUserId} [${duration}ms]`,
      );
      return jsonWithCors({ error: "User not found" }, request, 404);
    }

    const userData = reconstructUserRecord(userDataParts);
    // Activity is derived from card requests only, so a cron refresh that
    // rewrites the record does not make the user look active.
    const activity = await getUserActivity(numericUserId);
    console.log(
      `✅ [User API] Successfully fetched and reconstructed user data for user ${numericUserId} [${duration}ms]`,
    );
    incrementAnalytics("analytics:user_api:successful_requests").catch(
      () => {},
    );
    return jsonWithCors({ ...userData, ...activity }, request);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } catch (error: any) {
    const duration = Date.now() - startTime;
    console.error(
      `🔥 [User API] Error fetching user data for user ${numericUserId} [${duration}ms]: ${error.message}`,
    );
    if (error.stack) {
      console.error(`💥 [User API] Stack Trace: ${error.stack}`);
    }
    incrementAnalytics("analytics:user_api:failed_requests").catch(() => {});
    return jsonWithCors({ error: "Failed to fetch user data" }, request, 500);
  }
}

export function OPTIONS(request: Request) {
  const headers = apiJsonHeaders(request);
  return new Response(null, {
    headers: {
      ...headers,
      "Access-Control-Allow-Headers": "Content-Type",
      "Access-Control-Allow-Methods": "GET, HEAD, OPTIONS",
    },
  });
}
