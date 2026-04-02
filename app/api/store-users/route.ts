// app/api/store-users/route.ts
//
// Persists the split Redis user record that powers the user page and analytics cards.
// This boundary normalizes incoming AniList data, preserves the original `createdAt`
// across overwrites, and keeps the username lookup index in sync with the saved record.
//
// Clients can send `ifMatchUpdatedAt` to reject stale writes instead of silently
// overwriting fresher data from another tab or device.

import type { NextResponse } from "next/server";

import {
  getSchemaValidationIssueSummary,
  validatePersistedUserRecord,
} from "@/lib/api/validation";
import {
  apiErrorResponse,
  apiJsonHeaders,
  buildAnalyticsMetricKey,
  buildPersistedRequestMetadata,
  handleError,
  incrementAnalytics,
  initializeApiRequest,
  jsonWithCors,
  logPrivacySafe,
  logSuccess,
  readJsonRequestBody,
  scheduleTelemetryTask,
  validateUserData,
} from "@/lib/api-utils";
import { validateAndNormalizeUserRecord } from "@/lib/card-data";
import {
  getPersistedUserState,
  saveUserRecord,
  UserDataIntegrityError,
  UserRecordConflictError,
} from "@/lib/server/user-data";
import { PersistedUserRecord, UserRecord } from "@/lib/types/records";

function scheduleStoreUsersMetric(
  endpoint: string,
  endpointKey: string,
  metric: "failed_requests" | "successful_requests",
  request: Request,
): void {
  const analyticsMetric = buildAnalyticsMetricKey(endpointKey, metric);
  scheduleTelemetryTask(() => incrementAnalytics(analyticsMetric), {
    endpoint,
    taskName: analyticsMetric,
    request,
  });
}

function rejectInvalidStoreUsersPayload(params: {
  endpoint: string;
  endpointKey: string;
  request: Request;
  userId: number;
  message: string;
  context?: Record<string, unknown>;
}): NextResponse {
  logPrivacySafe(
    "warn",
    params.endpoint,
    params.message,
    params.context
      ? { userId: params.userId, ...params.context }
      : { userId: params.userId },
    params.request,
  );
  scheduleStoreUsersMetric(
    params.endpoint,
    params.endpointKey,
    "failed_requests",
    params.request,
  );

  return apiErrorResponse(params.request, 400, "Invalid data", {
    category: "invalid_data",
    retryable: false,
  });
}

function createStoreUsersConflictResponse(params: {
  endpoint: string;
  endpointKey: string;
  request: Request;
  currentUpdatedAt?: string;
}): NextResponse {
  scheduleStoreUsersMetric(
    params.endpoint,
    params.endpointKey,
    "failed_requests",
    params.request,
  );

  return apiErrorResponse(
    params.request,
    409,
    "Conflict: data was updated elsewhere. Please reload and try again.",
    {
      category: "invalid_data",
      retryable: false,
      additionalFields: params.currentUpdatedAt
        ? {
            currentUpdatedAt: params.currentUpdatedAt,
          }
        : undefined,
    },
  );
}

async function persistPreparedUserRecord(params: {
  endpoint: string;
  endpointKey: string;
  request: Request;
  persistedUserData: PersistedUserRecord;
  existingState?: Awaited<ReturnType<typeof getPersistedUserState>>;
  ifMatchUpdatedAt?: string;
}): Promise<
  | {
      saveResult: {
        updatedAt: string;
        revision: number;
        snapshotToken: string;
      };
    }
  | { errorResponse: NextResponse }
> {
  try {
    const saveResult = await saveUserRecord(params.persistedUserData, {
      existingState: params.existingState ?? undefined,
      expectedUpdatedAt: params.ifMatchUpdatedAt,
    });

    return { saveResult };
  } catch (error) {
    if (error instanceof UserRecordConflictError) {
      return {
        errorResponse: createStoreUsersConflictResponse({
          endpoint: params.endpoint,
          endpointKey: params.endpointKey,
          request: params.request,
          currentUpdatedAt: error.currentUpdatedAt,
        }),
      };
    }

    throw error;
  }
}

function preparePersistedUserRecord(params: {
  endpoint: string;
  endpointKey: string;
  request: Request;
  requestMetadata?: PersistedUserRecord["requestMetadata"];
  userData: UserRecord;
  userId: number;
}):
  | { persistedUserData: PersistedUserRecord }
  | { errorResponse: NextResponse } {
  const normalizationResult = validateAndNormalizeUserRecord(params.userData, {
    mode: "write",
  });
  if (!("normalized" in normalizationResult)) {
    return {
      errorResponse: rejectInvalidStoreUsersPayload({
        endpoint: params.endpoint,
        endpointKey: params.endpointKey,
        request: params.request,
        userId: params.userId,
        message: "Rejected store-users payload that failed normalization",
        context: {
          validationError: normalizationResult.error,
          validationStatus: normalizationResult.status,
        },
      }),
    };
  }

  const finalUserData = normalizationResult.normalized;
  const persistedRequestMetadata =
    finalUserData.requestMetadata ?? params.requestMetadata;

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

  const persistedValidation = validatePersistedUserRecord(persistedUserData);
  if (!persistedValidation.success) {
    return {
      errorResponse: rejectInvalidStoreUsersPayload({
        endpoint: params.endpoint,
        endpointKey: params.endpointKey,
        request: params.request,
        userId: params.userId,
        message:
          "Rejected normalized user record that failed write-boundary schema validation",
        context: {
          validationIssue: getSchemaValidationIssueSummary(
            persistedValidation.error,
          ),
        },
      }),
    };
  }

  return {
    persistedUserData: persistedValidation.data,
  };
}

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
    const bodyResult = await readJsonRequestBody<Record<string, unknown>>(
      request,
      {
        endpointName: endpoint,
        endpointKey,
      },
    );
    if (!bodyResult.success) return bodyResult.errorResponse;

    const data = bodyResult.data;

    logPrivacySafe(
      "log",
      endpoint,
      "Processing store-users payload",
      {
        userId: data.userId,
        username: data.username,
      },
      request,
    );

    const validationResult = validateUserData(data, endpoint, request);
    if (!validationResult.success) {
      scheduleStoreUsersMetric(
        endpoint,
        endpointKey,
        "failed_requests",
        request,
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
          request,
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
      return createStoreUsersConflictResponse({
        endpoint,
        endpointKey,
        request,
        currentUpdatedAt: existingState.updatedAt,
      });
    }

    const userData: UserRecord = {
      userId: String(userId),
      username,
      stats: stats as unknown as UserRecord["stats"],
      ...(requestMetadata ? { requestMetadata } : {}),
      createdAt,
      updatedAt: now,
    };

    const preparedRecord = preparePersistedUserRecord({
      endpoint,
      endpointKey,
      request,
      requestMetadata,
      userData,
      userId,
    });
    if ("errorResponse" in preparedRecord) {
      return preparedRecord.errorResponse;
    }

    logPrivacySafe(
      "log",
      endpoint,
      "Saving user data to split Redis record",
      {
        userId,
      },
      request,
    );

    const persistResult = await persistPreparedUserRecord({
      endpoint,
      endpointKey,
      request,
      persistedUserData: preparedRecord.persistedUserData,
      existingState,
      ifMatchUpdatedAt,
    });
    if ("errorResponse" in persistResult) {
      return persistResult.errorResponse;
    }

    const duration = Date.now() - startTime;
    logSuccess(endpoint, userId, duration, undefined, request);
    scheduleStoreUsersMetric(
      endpoint,
      endpointKey,
      "successful_requests",
      request,
    );

    return jsonWithCors(
      { success: true, userId, updatedAt: persistResult.saveResult.updatedAt },
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
      {
        redisUnavailableMessage: "User storage is temporarily unavailable",
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
