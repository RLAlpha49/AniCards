import { NextResponse } from "next/server";
import {
  initializeApiRequest,
  incrementAnalytics,
  buildAnalyticsMetricKey,
  apiJsonHeaders,
  jsonWithCors,
} from "@/lib/api-utils";

/**
 * Payload sent to AniList, containing the GraphQL query and optional variables.
 * @source
 */
interface GraphQLRequest {
  query: string;
  variables?: Record<string, unknown>;
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
    const headers = apiJsonHeaders(request);
    headers["Retry-After"] = "60";
    return NextResponse.json(
      { error: "Rate limited (test simulation)" },
      {
        status: 429,
        headers,
      },
    );
  }

  if (testHeader === "500") {
    return jsonWithCors(
      { error: "Internal server error (test simulation)" },
      request,
      500,
    );
  }

  return null;
}

/**
 * Derives the GraphQL operation name and a related user identifier for analytics.
 * @param requestData - GraphQL payload containing the query and variables.
 * @returns OperationInfo populated with defaults when the query lacks context.
 * @source
 */
function parseOperationInfo(requestData: GraphQLRequest): OperationInfo {
  const { query, variables } = requestData;

  const operationPattern = /(query|mutation)\s+(\w+)/;
  const operationMatch = operationPattern.exec(query);
  const operationName = operationMatch?.[2] || "anonymous_operation";

  let userIdentifier = "not_provided";
  if (operationName === "GetUserId") {
    userIdentifier = variables?.userName
      ? String(variables.userName)
      : "no_username";
  } else if (operationName === "GetUserStats") {
    userIdentifier = variables?.userId ? String(variables.userId) : "no_userid";
  }

  return { name: operationName, userIdentifier };
}

/**
 * Increments the given analytics metric, allowing failures to silently pass.
 * @param metric - Metric name used for analytics tracking.
 * @source
 */
async function trackAnalytics(metric: string): Promise<void> {
  try {
    await incrementAnalytics(metric);
  } catch {
    // Silently fail for analytics
  }
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
function createApiError(response: Response, errorData: unknown): Error {
  const retryAfter = response.headers.get("retry-after");
  const retryAfterMsg = retryAfter ? ` (Retry-After: ${retryAfter})` : "";

  const errorResponse = errorData as ErrorResponse;
  const errorMessage =
    typeof errorResponse.error === "object" && errorResponse.error !== null
      ? JSON.stringify(errorResponse.error)
      : (errorResponse.error as string) ||
        `HTTP error! status: ${response.status}`;

  return new Error(
    `HTTP error! status: ${response.status} - ${errorMessage}${retryAfterMsg}`,
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
  requestData: GraphQLRequest,
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

  const response = await fetch("https://graphql.anilist.co", {
    method: "POST",
    headers,
    body: JSON.stringify(requestData),
  });

  const rateLimitLimit = response.headers.get("X-RateLimit-Limit");
  const rateLimitRemaining = response.headers.get("X-RateLimit-Remaining");
  const rateLimitReset = response.headers.get("X-RateLimit-Reset");
  if (rateLimitLimit || rateLimitRemaining || rateLimitReset) {
    console.log(
      `🧭 [AniList API] Rate Limit: ${rateLimitLimit || "?"} Remaining: ${
        rateLimitRemaining || "?"
      } Reset: ${rateLimitReset || "?"}`,
    );
  }

  if (!response.ok) {
    const errorData = await response.json();
    throw createApiError(response, errorData);
  }

  const json = await response.json();
  if (json.errors) {
    throw new Error(json.errors[0].message);
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
  const testResponse = handleTestSimulation(request);
  if (testResponse) {
    return testResponse;
  }
  const init = await initializeApiRequest(
    request,
    "AniList API",
    "anilist_api",
  );
  if (init.errorResponse) return init.errorResponse;

  const { startTime } = init;
  let operationInfo: OperationInfo = {
    name: "unknown",
    userIdentifier: "not_provided",
  };

  try {
    const ip = request.headers.get("x-forwarded-for") || "127.0.0.1";
    console.log(`🚀 [AniList API] Incoming request from IP: ${ip}`);

    const requestData = (await request.json()) as GraphQLRequest;
    operationInfo = parseOperationInfo(requestData);

    console.log(
      `🚀 [AniList API] Anilist request: ${operationInfo.name} for ${operationInfo.userIdentifier}`,
    );

    const data = await makeAniListRequest(requestData, request);

    const duration = Date.now() - startTime;

    if (duration > 1000) {
      console.warn(
        `⏳ [AniList API] Slow request detected: ${operationInfo.name} took ${duration}ms`,
      );
    }

    console.log(
      `✅ [AniList API] Anilist response: ${operationInfo.name} [200] ${duration}ms | Identifier: ${operationInfo.userIdentifier}`,
    );

    console.log(
      `✅ [AniList API] Anilist operation ${operationInfo.name} completed successfully.`,
    );

    await trackAnalytics(
      buildAnalyticsMetricKey("anilist_api", "successful_requests"),
    );
    return jsonWithCors(data, request);
  } catch (error: unknown) {
    const duration = Date.now() - startTime;
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error";

    console.error(
      `🔥 [AniList API] Anilist failed: ${operationInfo.name} [${duration}ms] | Identifier: ${operationInfo.userIdentifier} - ${errorMessage}`,
    );

    if (error instanceof Error && error.stack) {
      console.error(`💥 [AniList API] Stack Trace: ${error.stack}`);
    }

    const statusPattern = /status:\s?(\d+)/;
    const statusMatch = statusPattern.exec(errorMessage);
    const statusCode = statusMatch ? Number.parseInt(statusMatch[1], 10) : 500;

    await trackAnalytics(
      buildAnalyticsMetricKey("anilist_api", "failed_requests"),
    );

    return jsonWithCors(
      { error: errorMessage || "Failed to fetch AniList data" },
      request,
      statusCode,
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
