import type { NextResponse } from "next/server";
import { UserRecord } from "@/lib/types/records";
import { validateAndNormalizeUserRecord } from "@/lib/card-data";
import { saveUserRecord, fetchUserDataParts } from "@/lib/server/user-data";
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

    let createdAt = new Date().toISOString();

    const partsData = await fetchUserDataParts(data.userId, ["meta"]);
    if (partsData.meta) {
      const meta = partsData.meta as Record<string, unknown>;
      createdAt = (meta.createdAt as string) || createdAt;
    }

    const userData: UserRecord = {
      userId: data.userId,
      username: data.username,
      stats: data.stats,
      ip,
      createdAt,
      updatedAt: new Date().toISOString(),
    };

    // Normalize and prune data before saving to Redis
    const normalizationResult = validateAndNormalizeUserRecord(userData);
    const finalUserData =
      "normalized" in normalizationResult
        ? normalizationResult.normalized
        : userData;

    console.log(
      `📝 [${endpoint}] Saving user data to Redis in split format for userId: ${data.userId}`,
    );

    await saveUserRecord(finalUserData);

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
