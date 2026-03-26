import { NextResponse } from "next/server";

import { USER_ID_QUERY, USER_STATS_QUERY } from "@/lib/anilist/queries";
import {
  apiErrorResponse,
  apiJsonHeaders,
  buildAnalyticsMetricKey,
  fetchUpstreamWithRetry,
  incrementAnalytics,
  initializeApiRequest,
  invalidJsonResponse,
  isValidUsername,
  jsonWithCors,
  logPrivacySafe,
  redactUserIdentifier,
  UpstreamTransportError,
} from "@/lib/api-utils";
import { categorizeByStatusCode, categorizeError } from "@/lib/error-messages";
import { trackUserActionError } from "@/lib/error-tracking";

/**
 * Payload sent to AniList, containing the GraphQL query and optional variables.
 * @source
 */
interface GraphQLRequest {
  operation?: string;
  query?: string;
  variables?: Record<string, unknown>;
}

type AllowedAniListOperationName = "GetUserId" | "GetUserStats";

interface ResolvedAniListRequest {
  operationName: AllowedAniListOperationName;
  userIdentifier: string;
  query: string;
  variables: Record<string, string | number>;
}

class AniListRequestError extends Error {
  readonly statusCode: number;
  readonly retryAfterSeconds?: number;

  constructor(message: string, statusCode: number, retryAfterSeconds?: number) {
    super(message);
    this.name = "AniListRequestError";
    this.statusCode = statusCode;
    this.retryAfterSeconds = retryAfterSeconds;
  }
}

/**
 * Details extracted from a GraphQL operation, including an identifying user.
 * @source
 */
interface OperationInfo {
  name: string;
  userIdentifier: string;
}

/**
 * Simulates specific AniList responses when running in development.
 * @param request - Incoming request that can carry the test status header.
 * @returns A crafted NextResponse for the simulated status or null when no simulation applies.
 * @source
 */
function handleTestSimulation(request: Request): NextResponse | null {
  if (process.env.NODE_ENV !== "development") {
    return null;
  }

  const testHeader = request.headers.get("X-Test-Status");
  if (testHeader === "429") {
    return apiErrorResponse(request, 429, "Rate limited (test simulation)", {
      headers: { "Retry-After": "60" },
      category: "rate_limited",
      retryable: true,
    });
  }

  if (testHeader === "500") {
    return apiErrorResponse(
      request,
      500,
      "Internal server error (test simulation)",
    );
  }

  return null;
}

function normalizeGraphQlDocument(document: string): string {
  return document.replaceAll(/\s+/g, " ").trim();
}

const ALLOWED_ANILIST_QUERY_BY_OPERATION: Record<
  AllowedAniListOperationName,
  string
> = {
  GetUserId: USER_ID_QUERY,
  GetUserStats: USER_STATS_QUERY,
};

const ALLOWED_ANILIST_OPERATION_BY_QUERY = new Map(
  Object.entries(ALLOWED_ANILIST_QUERY_BY_OPERATION).map(
    ([operation, query]) => [
      normalizeGraphQlDocument(query),
      operation as AllowedAniListOperationName,
    ],
  ),
);

function resolveAniListOperationName(
  requestData: GraphQLRequest,
): AllowedAniListOperationName {
  if (
    typeof requestData.operation === "string" &&
    requestData.operation in ALLOWED_ANILIST_QUERY_BY_OPERATION
  ) {
    return requestData.operation as AllowedAniListOperationName;
  }

  if (typeof requestData.query !== "string") {
    throw new AniListRequestError("Unsupported AniList operation", 400);
  }

  const normalizedQuery = normalizeGraphQlDocument(requestData.query);
  const operationName = ALLOWED_ANILIST_OPERATION_BY_QUERY.get(normalizedQuery);
  if (!operationName) {
    throw new AniListRequestError("Unsupported AniList operation", 400);
  }

  return operationName;
}

function resolveAniListVariables(
  operationName: AllowedAniListOperationName,
  variables: Record<string, unknown> | undefined,
): { userIdentifier: string; variables: Record<string, string | number> } {
  if (operationName === "GetUserId") {
    const userName = variables?.userName;
    if (!isValidUsername(userName)) {
      throw new AniListRequestError("Invalid AniList username", 400);
    }

    const normalizedUserName = String(userName).trim();
    return {
      userIdentifier: normalizedUserName,
      variables: { userName: normalizedUserName },
    };
  }

  const rawUserId = variables?.userId;
  const numericUserId =
    typeof rawUserId === "number" ? rawUserId : Number(rawUserId);
  if (!Number.isInteger(numericUserId) || numericUserId <= 0) {
    throw new AniListRequestError("Invalid AniList userId", 400);
  }

  return {
    userIdentifier: String(numericUserId),
    variables: { userId: numericUserId },
  };
}

function resolveAniListRequest(
  requestData: GraphQLRequest,
): ResolvedAniListRequest {
  const operationName = resolveAniListOperationName(requestData);
  const resolvedVariables = resolveAniListVariables(
    operationName,
    requestData.variables,
  );

  return {
    operationName,
    userIdentifier: resolvedVariables.userIdentifier,
    query: ALLOWED_ANILIST_QUERY_BY_OPERATION[operationName],
    variables: resolvedVariables.variables,
  };
}

/**
 * Derives the GraphQL operation name and a related user identifier for analytics.
 * @param requestData - GraphQL payload containing the query and variables.
 * @returns OperationInfo populated with defaults when the query lacks context.
 * @source
 */
function parseOperationInfo(
  requestData: ResolvedAniListRequest,
): OperationInfo {
  return {
    name: requestData.operationName,
    userIdentifier: requestData.userIdentifier,
  };
}

function getAniListStatusCode(error: unknown, errorMessage: string): number {
  if (
    error instanceof AniListRequestError ||
    error instanceof UpstreamTransportError
  ) {
    return error.statusCode;
  }

  const statusMatch = /status:\s?(\d+)/.exec(errorMessage);
  return statusMatch ? Number.parseInt(statusMatch[1], 10) : 500;
}

function getAniListResponseHeaders(
  error: unknown,
): Record<string, string> | undefined {
  const responseHeaders: Record<string, string> = {};

  if (error instanceof AniListRequestError && error.retryAfterSeconds) {
    responseHeaders["Retry-After"] = String(error.retryAfterSeconds);
  }

  if (
    error instanceof UpstreamTransportError &&
    typeof error.retryAfterMs === "number"
  ) {
    responseHeaders["Retry-After"] = String(
      Math.max(1, Math.ceil(error.retryAfterMs / 1000)),
    );
  }

  return Object.keys(responseHeaders).length > 0 ? responseHeaders : undefined;
}

async function executeAniListRequest(
  requestData: GraphQLRequest,
  request: Request,
  startTime: number,
): Promise<{ data: unknown; operationInfo: OperationInfo }> {
  const resolvedRequest = resolveAniListRequest(requestData);
  const operationInfo = parseOperationInfo(resolvedRequest);

  logPrivacySafe(
    "log",
    "AniList API",
    "Forwarding AniList operation",
    {
      operation: operationInfo.name,
      userIdentifier: operationInfo.userIdentifier,
    },
    request,
  );

  const data = await makeAniListRequest(resolvedRequest, request);
  const duration = Date.now() - startTime;

  if (duration > 1000) {
    logPrivacySafe(
      "warn",
      "AniList API",
      "Slow AniList request",
      {
        operation: operationInfo.name,
        durationMs: duration,
      },
      request,
    );
  }

  logPrivacySafe(
    "log",
    "AniList API",
    "AniList operation completed",
    {
      operation: operationInfo.name,
      userIdentifier: operationInfo.userIdentifier,
      durationMs: duration,
    },
    request,
  );

  return { data, operationInfo };
}

/**
 * Increments the given analytics metric, allowing failures to silently pass.
 * @param metric - Metric name used for analytics tracking.
 * @source
 */
async function trackAnalytics(metric: string): Promise<void> {
  try {
    await incrementAnalytics(metric);
  } catch {}
}

/**
 * Partial AniList error payload returned for failed requests.
 * @source
 */
interface ErrorResponse {
  error?: unknown;
}

/**
 * Builds an Error that includes HTTP status and retry metadata from AniList.
 * @param response - Fetch response received from AniList.
 * @param errorData - Parsed body containing the error details.
 * @returns An Error describing the failed AniList call.
 * @source
 */
function createApiError(
  response: Response,
  errorData: unknown,
): AniListRequestError {
  const retryAfter = response.headers.get("retry-after");
  const retryAfterSeconds = retryAfter ? Number(retryAfter) : undefined;
  const retryAfterMsg = retryAfter ? ` (Retry-After: ${retryAfter})` : "";

  const errorResponse = errorData as ErrorResponse;
  const errorMessage =
    typeof errorResponse.error === "object" && errorResponse.error !== null
      ? JSON.stringify(errorResponse.error)
      : (errorResponse.error as string) ||
        `HTTP error! status: ${response.status}`;

  return new AniListRequestError(
    `HTTP error! status: ${response.status} - ${errorMessage}${retryAfterMsg}`,
    response.status,
    Number.isFinite(retryAfterSeconds) ? retryAfterSeconds : undefined,
  );
}

/**
 * Forwards a GraphQL payload to AniList, including dev-only headers when requested.
 * @param requestData - The GraphQL query and variables to send.
 * @param request - Original request used to mirror test headers in development.
 * @returns A promise that resolves to AniList's data payload.
 * @throws {Error} When AniList returns an unsuccessful response or errors in payload.
 * @source
 */
async function makeAniListRequest(
  requestData: ResolvedAniListRequest,
  request: Request,
): Promise<unknown> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Accept: "application/json",
  };
  const anilistToken = process.env.ANILIST_TOKEN?.trim();
  if (anilistToken) {
    headers.Authorization = `Bearer ${anilistToken}`;
  }
  if (process.env.NODE_ENV === "development") {
    headers["X-Test-Status"] = request.headers.get("X-Test-Status") || "";
  }

  const response = await fetchUpstreamWithRetry({
    service: "AniList GraphQL",
    url: "https://graphql.anilist.co",
    init: {
      method: "POST",
      headers,
      body: JSON.stringify({
        query: requestData.query,
        variables: requestData.variables,
      }),
    },
    circuitBreaker: {
      key: "anilist-graphql",
      degradedModeEnvVar: "ANILIST_UPSTREAM_DEGRADED_MODE",
    },
  });

  const rateLimitLimit = response.headers.get("X-RateLimit-Limit");
  const rateLimitRemaining = response.headers.get("X-RateLimit-Remaining");
  const rateLimitReset = response.headers.get("X-RateLimit-Reset");
  if (rateLimitLimit || rateLimitRemaining || rateLimitReset) {
    logPrivacySafe(
      "log",
      "AniList API",
      "Observed AniList upstream rate-limit headers",
      {
        rateLimitLimit: rateLimitLimit || "?",
        rateLimitRemaining: rateLimitRemaining || "?",
        rateLimitReset: rateLimitReset || "?",
      },
      request,
    );
  }

  if (!response.ok) {
    const errorData = await response.json();
    throw createApiError(response, errorData);
  }

  const json = (await response.json()) as {
    data?: unknown;
    errors?: Array<{ message?: string }>;
  };
  if (json.errors) {
    throw new AniListRequestError(
      json.errors[0]?.message || "AniList request failed",
      500,
    );
  }

  return json.data;
}

/**
 * Proxy endpoint for AniList GraphQL requests that enforces origin guards and analytics.
 * @param request - Incoming POST request from the client.
 * @returns AniList data or an error response mirroring any upstream failure.
 * @source
 */
export async function POST(request: Request) {
  const init = await initializeApiRequest(
    request,
    "AniList API",
    "anilist_api",
  );
  if (init.errorResponse) return init.errorResponse;

  const testResponse = handleTestSimulation(request);
  if (testResponse) {
    return testResponse;
  }

  const { startTime } = init;
  let operationInfo: OperationInfo = {
    name: "unknown",
    userIdentifier: "not_provided",
  };

  try {
    let requestData: GraphQLRequest;
    try {
      requestData = (await request.json()) as GraphQLRequest;
    } catch {
      await trackAnalytics(
        buildAnalyticsMetricKey("anilist_api", "failed_requests"),
      );
      return invalidJsonResponse(request);
    }

    const result = await executeAniListRequest(requestData, request, startTime);
    operationInfo = result.operationInfo;

    await trackAnalytics(
      buildAnalyticsMetricKey("anilist_api", "successful_requests"),
    );
    return jsonWithCors(result.data, request);
  } catch (error: unknown) {
    const duration = Date.now() - startTime;
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error";

    const statusCode = getAniListStatusCode(error, errorMessage);

    logPrivacySafe(
      "error",
      "AniList API",
      "AniList request failed",
      {
        operation: operationInfo.name,
        userIdentifier: operationInfo.userIdentifier,
        durationMs: duration,
        statusCode,
        error: errorMessage,
        ...(error instanceof Error && error.stack
          ? { stack: error.stack }
          : {}),
      },
      request,
    );

    const errorCategory =
      statusCode === 500
        ? categorizeError(errorMessage)
        : categorizeByStatusCode(statusCode);

    await Promise.resolve(
      trackUserActionError(
        `anilist_api_${operationInfo.name}`,
        error instanceof Error ? error : new Error(errorMessage),
        errorCategory,
        {
          userId: redactUserIdentifier(operationInfo.userIdentifier),
          statusCode,
          source: "api_route",
          metadata: {
            endpoint: "anilist_api",
            operation: operationInfo.name,
          },
        },
      ),
    );

    await trackAnalytics(
      buildAnalyticsMetricKey("anilist_api", "failed_requests"),
    );

    return apiErrorResponse(
      request,
      statusCode,
      errorMessage || "Failed to fetch AniList data",
      {
        headers: getAniListResponseHeaders(error),
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
      "Access-Control-Allow-Methods": "POST, OPTIONS",
    },
  });
}
