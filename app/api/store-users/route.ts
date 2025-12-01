import type { NextResponse } from "next/server";
import { UserRecord } from "@/lib/types/records";
import { safeParse } from "@/lib/utils";
import {
  incrementAnalytics,
  handleError,
  apiJsonHeaders,
  logSuccess,
  redisClient,
  initializeApiRequest,
  validateUserData,
  buildAnalyticsMetricKey,
  jsonWithCors,
} from "@/lib/api-utils";

/**
 * Persists or updates a user record in Redis while keeping analytics and the username index aligned.
 * @param request - Incoming POST request for the store-users endpoint.
 * @returns A NextResponse signaling success or an error handled upstream.
 * @source
 */
export async function POST(request: Request): Promise<NextResponse> {
  const init = await initializeApiRequest(
    request,
    "Store Users",
    "store_users",
  );
  if (init.errorResponse) return init.errorResponse;

  const { startTime, ip, endpoint, endpointKey } = init;

  try {
    const data = await request.json();
    console.log(
      `📝 [${endpoint}] Processing user ${data.userId} (${data.username || "no username"})`,
    );

    // Validate incoming data
    const validationError = validateUserData(
      data as Record<string, unknown>,
      endpoint,
      request,
    );
    if (validationError) {
      await incrementAnalytics(
        buildAnalyticsMetricKey(endpointKey, "failed_requests"),
      );
      return validationError;
    }

    // Define a Redis key for the user data
    const userKey = `user:${data.userId}`;
    let createdAt = new Date().toISOString();

    // Retrieve the stored record from Redis
    const storedRecordRaw = await redisClient.get(userKey);
    if (storedRecordRaw) {
      console.log(
        `🔍 [${endpoint}] Found existing record for user ${data.userId}`,
      );
      try {
        // Directly parse the JSON string from Redis
        const parsedUser = safeParse<UserRecord>(storedRecordRaw);
        createdAt = parsedUser.createdAt || createdAt;
      } catch (error) {
        console.error(
          `🔥 [${endpoint}] Failed to parse user record from Redis. Data received: ${storedRecordRaw}`,
        );
        if (error instanceof Error && error.stack) {
          console.error(`💥 [${endpoint}] Stack Trace: ${error.stack}`);
        }
      }
    } else {
      console.log(
        `📝 [${endpoint}] No existing record found for user ${data.userId}. Creating new record.`,
      );
    }

    const userData: UserRecord = {
      userId: data.userId,
      username: data.username,
      stats: data.stats,
      ip,
      createdAt,
      updatedAt: new Date().toISOString(),
    };

    console.log(
      `📝 [${endpoint}] Saving user data to Redis under key: ${userKey}`,
    );
    // Save (or update) the user data in Redis
    await redisClient.set(userKey, JSON.stringify(userData));

    // Create/update the username index if a username is provided.
    if (data.username) {
      const normalizedUsername = data.username.trim().toLowerCase();
      const usernameIndexKey = `username:${normalizedUsername}`;
      console.log(
        `📝 [${endpoint}] Updating username index for: ${normalizedUsername}`,
      );
      await redisClient.set(usernameIndexKey, data.userId.toString());
    }

    const duration = Date.now() - startTime;
    logSuccess(endpoint, data.userId, duration);
    await incrementAnalytics(
      buildAnalyticsMetricKey(endpointKey, "successful_requests"),
    );

    return jsonWithCors({ success: true, userId: data.userId }, request);
  } catch (error) {
    return handleError(
      error as Error,
      endpoint,
      startTime,
      buildAnalyticsMetricKey(endpointKey, "failed_requests"),
      "User storage failed",
      request,
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
