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
  apiErrorResponse,
  apiJsonHeaders,
  createRateLimiter,
  incrementAnalytics,
  initializeApiRequest,
  isValidUsername,
  jsonWithCors,
  logPrivacySafe,
  parseStrictPositiveInteger,
  redisClient,
} from "@/lib/api-utils";
import {
  ALL_USER_DATA_PARTS,
  fetchUserDataParts,
  normalizeUsernameIndexValue,
  reconstructPublicUserRecord,
  reconstructUserBootstrapRecord,
  USER_BOOTSTRAP_DATA_PARTS,
  UserDataIntegrityError,
} from "@/lib/server/user-data";

const ratelimit = createRateLimiter({ limit: 60, window: "10 s" });
const USER_API_ENDPOINT = "User API";
const USER_API_FAILED_METRIC = "analytics:user_api:failed_requests";
const USER_API_SUCCESS_METRIC = "analytics:user_api:successful_requests";

function trackUserApiMetric(metric: string): void {
  incrementAnalytics(metric).catch(() => {});
}

function respondWithUserApiError(
  request: Request,
  status: number,
  error: string,
  logMessage: string,
  context?: Record<string, unknown>,
): Response {
  logPrivacySafe("warn", USER_API_ENDPOINT, logMessage, context);
  trackUserApiMetric(USER_API_FAILED_METRIC);
  return apiErrorResponse(request, status, error);
}

async function resolveUserIdFromUsername(
  username: string,
  request?: Request,
): Promise<number | null> {
  const normalizedUsername = normalizeUsernameIndexValue(username);
  if (!normalizedUsername) return null;

  const usernameIndexKey = `username:${normalizedUsername}`;
  logPrivacySafe(
    "log",
    USER_API_ENDPOINT,
    "Searching username index",
    {
      username: normalizedUsername,
    },
    request,
  );
  const userIdFromIndex = await redisClient.get(usernameIndexKey);
  if (!userIdFromIndex) return null;

  const candidate = parseStrictPositiveInteger(String(userIdFromIndex));
  if (!candidate) return null;

  logPrivacySafe(
    "log",
    USER_API_ENDPOINT,
    "Resolved lookup by username",
    {
      username: normalizedUsername,
      userId: candidate,
    },
    request,
  );
  return candidate;
}

async function resolveLookupTarget(
  request: Request,
  userIdParam: string | null,
  usernameParam: string | null,
): Promise<
  | {
      userId: number;
      normalizedLookupUsername?: string;
    }
  | Response
> {
  if (!userIdParam && !usernameParam) {
    return respondWithUserApiError(
      request,
      400,
      "Missing userId or username parameter",
      "Missing userId or username parameter",
    );
  }

  if (userIdParam) {
    const numericUserId = parseStrictPositiveInteger(userIdParam);
    if (!numericUserId) {
      return respondWithUserApiError(
        request,
        400,
        "Invalid userId parameter",
        "Invalid userId parameter provided",
        { userId: userIdParam },
      );
    }

    logPrivacySafe("log", USER_API_ENDPOINT, "Resolved lookup by userId", {
      userId: numericUserId,
    });
    return { userId: numericUserId };
  }

  if (!isValidUsername(usernameParam)) {
    return respondWithUserApiError(
      request,
      400,
      "Invalid username parameter",
      "Invalid username parameter provided",
      { username: usernameParam },
    );
  }

  const normalizedLookupUsername = normalizeUsernameIndexValue(usernameParam);
  const userId = await resolveUserIdFromUsername(usernameParam!, request);
  if (!userId) {
    return respondWithUserApiError(
      request,
      404,
      "User not found",
      "User not found for username",
      { username: usernameParam },
    );
  }

  return { userId, normalizedLookupUsername };
}

async function handleStaleUsernameAlias(
  request: Request,
  userId: number,
  normalizedLookupUsername: string,
): Promise<Response> {
  await redisClient.del(`username:${normalizedLookupUsername}`);
  logPrivacySafe(
    "warn",
    USER_API_ENDPOINT,
    "Removed stale username alias that no longer matches stored record",
    {
      userId,
      username: normalizedLookupUsername,
    },
  );
  trackUserApiMetric(USER_API_FAILED_METRIC);
  return apiErrorResponse(request, 404, "User not found");
}

/**
 * Retrieves user data by userId or username and records analytics around the lookup.
 * @param request - Incoming request with query parameters and headers.
 * @returns NextResponse carrying the user data or the relevant error payload.
 * @source
 */
export async function GET(request: Request) {
  const init = await initializeApiRequest(
    request,
    "User API",
    "user_api",
    ratelimit,
    { skipSameOrigin: true },
  );
  if (init.errorResponse) return init.errorResponse;

  const { startTime } = init;

  logPrivacySafe(
    "log",
    USER_API_ENDPOINT,
    "Received public user lookup request",
    undefined,
    request,
  );

  const { searchParams } = new URL(request.url);
  const userIdParam = searchParams.get("userId");
  const usernameParam = searchParams.get("username");
  const view = searchParams.get("view");
  const shouldReturnBootstrap = view === "bootstrap";

  const resolvedLookup = await resolveLookupTarget(
    request,
    userIdParam,
    usernameParam,
  );
  if (resolvedLookup instanceof Response) {
    return resolvedLookup;
  }

  const { userId: numericUserId, normalizedLookupUsername } = resolvedLookup;

  try {
    const userDataParts = await fetchUserDataParts(
      numericUserId,
      shouldReturnBootstrap
        ? [...USER_BOOTSTRAP_DATA_PARTS]
        : [...ALL_USER_DATA_PARTS],
    );
    const duration = Date.now() - startTime;

    if (!userDataParts.meta) {
      logPrivacySafe(
        "warn",
        "User API",
        "User record not found",
        {
          userId: numericUserId,
          durationMs: duration,
        },
        request,
      );
      return apiErrorResponse(request, 404, "User not found");
    }

    const userData = shouldReturnBootstrap
      ? reconstructUserBootstrapRecord(userDataParts)
      : reconstructPublicUserRecord(userDataParts);
    const persistedNormalizedUsername = normalizeUsernameIndexValue(
      userData.username,
    );
    if (
      normalizedLookupUsername &&
      persistedNormalizedUsername !== normalizedLookupUsername
    ) {
      return handleStaleUsernameAlias(
        request,
        numericUserId,
        normalizedLookupUsername,
      );
    }

    logPrivacySafe(
      "log",
      USER_API_ENDPOINT,
      "Successfully fetched public user data",
      {
        userId: numericUserId,
        durationMs: duration,
      },
      request,
    );
    trackUserApiMetric(USER_API_SUCCESS_METRIC);
    return jsonWithCors(userData, request);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } catch (error: any) {
    const duration = Date.now() - startTime;
    const errorMessage =
      error instanceof UserDataIntegrityError
        ? "Stored user record is incomplete or corrupted"
        : "Failed to fetch user data";
    logPrivacySafe(
      "error",
      USER_API_ENDPOINT,
      "Error fetching user data",
      {
        userId: numericUserId,
        durationMs: duration,
        error: error.message,
        ...(error.stack ? { stack: error.stack } : {}),
      },
      request,
    );
    trackUserApiMetric(USER_API_FAILED_METRIC);
    return apiErrorResponse(request, 500, errorMessage);
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
