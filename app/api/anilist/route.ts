import { Redis } from "@upstash/redis";
import { NextResponse } from "next/server";
import { initializeApiRequest } from "@/lib/api-utils";

interface GraphQLRequest {
  query: string;
  variables?: Record<string, unknown>;
}

interface OperationInfo {
  name: string;
  userIdentifier: string;
}

// Handle development test simulations
function handleTestSimulation(request: Request): NextResponse | null {
  if (process.env.NODE_ENV !== "development") {
    return null;
  }

  const testHeader = request.headers.get("X-Test-Status");
  if (testHeader === "429") {
    return NextResponse.json(
      { error: "Rate limited (test simulation)" },
      {
        status: 429,
        headers: { "Retry-After": "60" },
      },
    );
  }

  if (testHeader === "500") {
    return NextResponse.json(
      { error: "Internal server error (test simulation)" },
      { status: 500 },
    );
  }

  return null;
}

// Extract operation details from GraphQL request
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

// Track analytics for API requests
async function trackAnalytics(metric: string): Promise<void> {
  try {
    const analyticsClient = Redis.fromEnv();
    await analyticsClient.incr(metric);
  } catch {
    // Silently fail for analytics
  }
}

// Handle API response errors
interface ErrorResponse {
  error?: unknown;
}

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

// Make request to AniList API
async function makeAniListRequest(
  requestData: GraphQLRequest,
  request: Request,
): Promise<unknown> {
  const response = await fetch("https://graphql.anilist.co", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
      Authorization: `Bearer ${process.env.ANILIST_TOKEN}`,
      ...(process.env.NODE_ENV === "development" && {
        "X-Test-Status": request.headers.get("X-Test-Status") || "",
      }),
    },
    body: JSON.stringify(requestData),
  });

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

// Proxy endpoint for AniList GraphQL API with testing simulations
export async function POST(request: Request) {
  // Handle test simulations in development
  const testResponse = handleTestSimulation(request);
  if (testResponse) {
    return testResponse;
  }
  const init = await initializeApiRequest(request, "AniList API");
  if (init.errorResponse) return init.errorResponse;

  const { startTime } = init;
  let operationInfo: OperationInfo = {
    name: "unknown",
    userIdentifier: "not_provided",
  };

  try {
    const ip = request.headers.get("x-forwarded-for") || "127.0.0.1";
    console.log(`🚀 [AniList API] Incoming request from IP: ${ip}`);

    // Parse request and extract operation details
    const requestData = (await request.json()) as GraphQLRequest;
    operationInfo = parseOperationInfo(requestData);

    console.log(
      `🚀 [AniList API] Anilist request: ${operationInfo.name} for ${operationInfo.userIdentifier}`,
    );

    // Make the API request
    const data = await makeAniListRequest(requestData, request);

    const duration = Date.now() - startTime;

    // Log slow requests
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

    await trackAnalytics("analytics:anilist_api:successful_requests");
    return NextResponse.json(data);
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

    // Extract status code from error message
    const statusPattern = /status:\s?(\d+)/;
    const statusMatch = statusPattern.exec(errorMessage);
    const statusCode = statusMatch ? Number.parseInt(statusMatch[1], 10) : 500;

    await trackAnalytics("analytics:anilist_api:failed_requests");

    return NextResponse.json(
      { error: errorMessage || "Failed to fetch AniList data" },
      { status: statusCode },
    );
  }
}
