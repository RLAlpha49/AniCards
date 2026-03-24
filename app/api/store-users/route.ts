import type { NextResponse } from "next/server";

import {
  apiJsonHeaders,
  buildAnalyticsMetricKey,
  handleError,
  incrementAnalytics,
  initializeApiRequest,
  jsonWithCors,
  logSuccess,
  redisClient,
  validateUserData,
} from "@/lib/api-utils";
import { validateAndNormalizeUserRecord } from "@/lib/card-data";
import { fetchUserDataParts, saveUserRecord } from "@/lib/server/user-data";
import { UserRecord } from "@/lib/types/records";

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

    const validationResult = validateUserData(
      data as Record<string, unknown>,
      endpoint,
      request,
    );
    if (!validationResult.success) {
      await incrementAnalytics(
        buildAnalyticsMetricKey(endpointKey, "failed_requests"),
      );
      return validationResult.error;
    }

    const { userId, username, stats } = validationResult.data;

    let createdAt = new Date().toISOString();

    const partsData = await fetchUserDataParts(userId, ["meta"]);
    if (partsData.meta) {
      const meta = partsData.meta as Record<string, unknown>;
      createdAt = (meta.createdAt as string) || createdAt;
    }

    const userData: UserRecord = {
      userId: String(userId),
      username,
      stats: stats as unknown as UserRecord["stats"],
      ip,
      createdAt,
      updatedAt: new Date().toISOString(),
    };

    const normalizationResult = validateAndNormalizeUserRecord(userData);
    const finalUserData =
      "normalized" in normalizationResult
        ? normalizationResult.normalized
        : userData;

    console.log(
      `📝 [${endpoint}] Saving user data to Redis in split format for userId: ${userId}`,
    );

    await saveUserRecord(finalUserData);

    if (username) {
      const normalizedUsername = username.trim().toLowerCase();
      const usernameIndexKey = `username:${normalizedUsername}`;
      console.log(
        `📝 [${endpoint}] Updating username index for: ${normalizedUsername}`,
      );
      await redisClient.set(usernameIndexKey, userId.toString());
    }

    const duration = Date.now() - startTime;
    logSuccess(endpoint, userId, duration);
    await incrementAnalytics(
      buildAnalyticsMetricKey(endpointKey, "successful_requests"),
    );

    return jsonWithCors({ success: true, userId }, request);
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
