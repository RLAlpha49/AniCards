/**
 * Reads a stored AniCards user record by numeric AniList id or username.
 *
 * This route is the lookup bridge between the public search flow and the split
 * Redis storage format in `lib/server/user-data`. It resolves usernames through
 * the normalized username index, then reconstructs the full stored record so
 * the client can hydrate from one response instead of stitching sections
 * together with follow-up requests.
 */
import {
  apiJsonHeaders,
  checkRateLimit,
  createRateLimiter,
  getRequestIp,
  incrementAnalytics,
  isValidUsername,
  jsonWithCors,
  logPrivacySafe,
  redisClient,
} from "@/lib/api-utils";
import {
  fetchUserDataParts,
  reconstructPublicUserRecord,
  UserDataPart,
} from "@/lib/server/user-data";

const ratelimit = createRateLimiter({ limit: 60, window: "10 s" });

/**
 * Retrieves user data by userId or username and records analytics around the lookup.
 * @param request - Incoming request with query parameters and headers.
 * @returns NextResponse carrying the user data or the relevant error payload.
 * @source
 */
export async function GET(request: Request) {
  const startTime = Date.now();
  const ip = getRequestIp(request);

  const rateLimitResponse = await checkRateLimit(
    request,
    ip,
    "User API",
    "user_api",
    ratelimit,
  );
  if (rateLimitResponse) {
    return rateLimitResponse;
  }

  logPrivacySafe("log", "User API", "Received public user lookup request", {
    ip,
  });

  const { searchParams } = new URL(request.url);
  const userIdParam = searchParams.get("userId");
  const usernameParam = searchParams.get("username");

  if (!userIdParam && !usernameParam) {
    logPrivacySafe("warn", "User API", "Missing userId or username parameter");
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
      logPrivacySafe("warn", "User API", "Invalid userId parameter provided", {
        userId: userIdParam,
      });
      incrementAnalytics("analytics:user_api:failed_requests").catch(() => {});
      return jsonWithCors({ error: "Invalid userId parameter" }, request, 400);
    }
    logPrivacySafe("log", "User API", "Resolved lookup by userId", {
      userId: numericUserId,
    });
  } else {
    if (!isValidUsername(usernameParam)) {
      logPrivacySafe(
        "warn",
        "User API",
        "Invalid username parameter provided",
        {
          username: usernameParam,
        },
      );
      incrementAnalytics("analytics:user_api:failed_requests").catch(() => {});
      return jsonWithCors(
        { error: "Invalid username parameter" },
        request,
        400,
      );
    }

    // Username lookups use the same trim+lowercase normalization as the write
    // path in `/api/store-users`, so searches stay case-insensitive and stable.
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
      logPrivacySafe("log", "User API", "Searching username index", {
        username: normalizedUsername,
      });
      const userIdFromIndex = await redisClient.get(usernameIndexKey);
      if (!userIdFromIndex) return null;
      const candidate = Number.parseInt(userIdFromIndex as string, 10);
      if (Number.isNaN(candidate)) return null;
      logPrivacySafe("log", "User API", "Resolved lookup by username", {
        username: normalizedUsername,
        userId: candidate,
      });
      return candidate;
    }

    const userId = await resolveUserIdFromUsername(usernameParam!);
    if (!userId) {
      logPrivacySafe("warn", "User API", "User not found for username", {
        username: usernameParam,
      });
      incrementAnalytics("analytics:user_api:failed_requests").catch(() => {});
      return jsonWithCors({ error: "User not found" }, request, 404);
    }

    numericUserId = userId;
  }

  try {
    const allParts: UserDataPart[] = [
      "meta",
      "activity",
      "favourites",
      "statistics",
      "pages",
      "planning",
      "current",
      "rewatched",
      "completed",
      "aggregates",
    ];

    // Fetch every persisted section up front so the editor and public user page
    // can bootstrap from one payload instead of making section-specific reads.
    const userDataParts = await fetchUserDataParts(numericUserId, allParts);
    const duration = Date.now() - startTime;

    if (!userDataParts.meta) {
      logPrivacySafe("warn", "User API", "User record not found", {
        userId: numericUserId,
        durationMs: duration,
      });
      return jsonWithCors({ error: "User not found" }, request, 404);
    }

    const userData = reconstructPublicUserRecord(userDataParts);
    logPrivacySafe("log", "User API", "Successfully fetched public user data", {
      userId: numericUserId,
      durationMs: duration,
    });
    incrementAnalytics("analytics:user_api:successful_requests").catch(
      () => {},
    );
    return jsonWithCors(userData, request);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } catch (error: any) {
    const duration = Date.now() - startTime;
    logPrivacySafe("error", "User API", "Error fetching user data", {
      userId: numericUserId,
      durationMs: duration,
      error: error.message,
    });
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
