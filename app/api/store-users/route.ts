import type { NextResponse } from "next/server";

import {
  apiJsonHeaders,
  buildAnalyticsMetricKey,
  buildPersistedRequestMetadata,
  handleError,
  incrementAnalytics,
  initializeApiRequest,
  jsonWithCors,
  logPrivacySafe,
  logSuccess,
  validateUserData,
} from "@/lib/api-utils";
import { validateAndNormalizeUserRecord } from "@/lib/card-data";
import {
  getPersistedUserState,
  saveUserRecord,
  UserDataIntegrityError,
} from "@/lib/server/user-data";
import { PersistedUserRecord, UserRecord } from "@/lib/types/records";

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
    logPrivacySafe("log", endpoint, "Processing store-users payload", {
      userId: data.userId,
      username: data.username,
    });

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

    const { userId, username, stats, ifMatchUpdatedAt } = validationResult.data;
    const requestMetadata = buildPersistedRequestMetadata(ip);

    const now = new Date().toISOString();
    let createdAt = now;

    let existingState;
    try {
      existingState = await getPersistedUserState(userId);
    } catch (error) {
      if (error instanceof UserDataIntegrityError) {
        logPrivacySafe(
          "warn",
          endpoint,
          "Ignoring corrupt persisted user state during overwrite",
          {
            userId,
            error: error.message,
          },
        );
      } else {
        throw error;
      }
    }

    if (existingState?.createdAt) {
      createdAt = existingState.createdAt;
    }

    if (
      ifMatchUpdatedAt &&
      existingState?.updatedAt &&
      existingState.updatedAt !== ifMatchUpdatedAt
    ) {
      await incrementAnalytics(
        buildAnalyticsMetricKey(endpointKey, "failed_requests"),
      );
      return jsonWithCors(
        {
          error:
            "Conflict: data was updated elsewhere. Please reload and try again.",
          currentUpdatedAt: existingState.updatedAt,
        },
        request,
        409,
      );
    }

    const userData: UserRecord = {
      userId: String(userId),
      username,
      stats: stats as unknown as UserRecord["stats"],
      ...(requestMetadata ? { requestMetadata } : {}),
      createdAt,
      updatedAt: now,
    };

    const normalizationResult = validateAndNormalizeUserRecord(userData);
    const finalUserData =
      "normalized" in normalizationResult
        ? normalizationResult.normalized
        : userData;
    const persistedRequestMetadata =
      finalUserData.requestMetadata ?? requestMetadata;

    const persistedUserData: PersistedUserRecord = {
      userId: finalUserData.userId,
      username: finalUserData.username,
      stats: finalUserData.stats,
      createdAt: finalUserData.createdAt,
      updatedAt: finalUserData.updatedAt,
      ...(finalUserData.aggregates
        ? { aggregates: finalUserData.aggregates }
        : {}),
      ...(persistedRequestMetadata
        ? { requestMetadata: persistedRequestMetadata }
        : {}),
    };

    logPrivacySafe("log", endpoint, "Saving user data to split Redis record", {
      userId,
    });

    const saveResult = await saveUserRecord(persistedUserData, {
      existingState: existingState ?? undefined,
    });

    const duration = Date.now() - startTime;
    logSuccess(endpoint, userId, duration);
    await incrementAnalytics(
      buildAnalyticsMetricKey(endpointKey, "successful_requests"),
    );

    return jsonWithCors(
      { success: true, userId, updatedAt: saveResult.updatedAt },
      request,
    );
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
