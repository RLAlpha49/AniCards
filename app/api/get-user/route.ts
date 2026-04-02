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
  handleError,
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
  fetchUserDataSnapshot,
  normalizeUsernameIndexValue,
  PersistedUserState,
  reconstructPublicUserRecord,
  reconstructUserBootstrapRecord,
  repairStaleUsernameAlias,
  USER_BOOTSTRAP_DATA_PARTS,
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
  canonicalUsername?: string,
  state?: PersistedUserState | null,
): Promise<Response> {
  logPrivacySafe(
    "warn",
    USER_API_ENDPOINT,
    "Detected stale username alias that no longer matches stored record",
    {
      userId,
      username: normalizedLookupUsername,
    },
    request,
  );

  await repairStaleUsernameAlias({
    userId,
    attemptedUsername: normalizedLookupUsername,
    canonicalUsername,
    state,
  });

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

  let resolvedUserId: number | undefined;

  try {
    const resolvedLookup = await resolveLookupTarget(
      request,
      userIdParam,
      usernameParam,
    );
    if (resolvedLookup instanceof Response) {
      return resolvedLookup;
    }

    const { userId: numericUserId, normalizedLookupUsername } = resolvedLookup;
    resolvedUserId = numericUserId;

    const userReadResult = await fetchUserDataSnapshot(
      numericUserId,
      shouldReturnBootstrap
        ? [...USER_BOOTSTRAP_DATA_PARTS]
        : [...ALL_USER_DATA_PARTS],
    );
    const { parts: userDataParts, state: userDataState } = userReadResult;
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
      ? reconstructUserBootstrapRecord(userDataParts, {
          state: userDataState,
        })
      : reconstructPublicUserRecord(userDataParts, {
          state: userDataState,
        });
    const canonicalUsername = userData.username ?? userDataState?.username;
    const persistedNormalizedUsername =
      normalizeUsernameIndexValue(canonicalUsername);
    if (
      normalizedLookupUsername &&
      persistedNormalizedUsername !== normalizedLookupUsername
    ) {
      return handleStaleUsernameAlias(
        request,
        numericUserId,
        normalizedLookupUsername,
        canonicalUsername,
        userDataState,
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
  } catch (error) {
    return handleError(
      error as Error,
      USER_API_ENDPOINT,
      startTime,
      USER_API_FAILED_METRIC,
      "Failed to fetch user data",
      request,
      {
        redisUnavailableMessage: "User data is temporarily unavailable",
        logContext:
          typeof resolvedUserId === "number"
            ? { userId: resolvedUserId }
            : undefined,
      },
    );
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
