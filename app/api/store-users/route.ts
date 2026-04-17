// app/api/store-users/route.ts
//
// Persists the split Redis user record that powers the user page and analytics cards.
// This boundary normalizes incoming AniList data, preserves the original `createdAt`
// across overwrites, and keeps the username lookup index in sync with the saved record.
//
// Clients can send compare-and-set metadata on updates so stale writes are
// rejected instead of silently overwriting fresher data from another tab or
// device.

import type { NextResponse } from "next/server";

import { apiJsonHeaders, jsonWithCors } from "@/lib/api/cors";
import { apiErrorResponse, handleError } from "@/lib/api/errors";
import {
  buildPersistedRequestMetadata,
  logPrivacySafe,
  logSuccess,
} from "@/lib/api/logging";
import {
  createProtectedWriteGrantCookieHeader,
  getAuthoritativeUsernameFromUserStats,
} from "@/lib/api/protected-write-grants";
import { readJsonRequestBody } from "@/lib/api/request-body";
import {
  initializeApiRequest,
  validateProtectedWriteGrant,
} from "@/lib/api/request-guards";
import {
  buildAnalyticsMetricKey,
  incrementAnalytics,
  scheduleTelemetryTask,
} from "@/lib/api/telemetry";
import {
  getSchemaValidationIssueSummary,
  validatePersistedUserRecord,
  validateUserData,
} from "@/lib/api/validation";
import { validateAndNormalizeUserRecord } from "@/lib/card-data";
import {
  getPersistedUserState,
  type PersistedUserState,
  saveUserRecord,
  UserDataIntegrityError,
  UserRecordConflictError,
  UserRecordUsernameConflictError,
} from "@/lib/server/user-data";
import { PersistedUserRecord, UserRecord } from "@/lib/types/records";

const STORE_USERS_JSON_BODY_LIMIT_BYTES = 2 * 1024 * 1024;

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
  currentRevision?: number;
  currentSnapshotToken?: string;
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
      additionalFields: buildStoreUsersConflictAdditionalFields({
        currentUpdatedAt: params.currentUpdatedAt,
        currentRevision: params.currentRevision,
        currentSnapshotToken: params.currentSnapshotToken,
      }),
    },
  );
}

function buildStoreUsersConflictAdditionalFields(params: {
  currentUpdatedAt?: string;
  currentRevision?: number;
  currentSnapshotToken?: string;
}): Record<string, number | string> | undefined {
  const additionalFields: Record<string, number | string> = {};

  if (params.currentUpdatedAt) {
    additionalFields.currentUpdatedAt = params.currentUpdatedAt;
  }

  if (params.currentRevision) {
    additionalFields.currentRevision = params.currentRevision;
  }

  if (params.currentSnapshotToken) {
    additionalFields.currentSnapshotToken = params.currentSnapshotToken;
  }

  return Object.keys(additionalFields).length > 0
    ? additionalFields
    : undefined;
}

function hasStoreUsersCompareToken(options: {
  ifMatchRevision?: number;
  ifMatchSnapshotToken?: string;
  ifMatchUpdatedAt?: string;
}): boolean {
  return (
    Boolean(options.ifMatchUpdatedAt) ||
    typeof options.ifMatchRevision === "number" ||
    Boolean(options.ifMatchSnapshotToken)
  );
}

function resolveStoreUsersCompareConflict(params: {
  endpoint: string;
  endpointKey: string;
  existingState?: PersistedUserState | null;
  ifMatchRevision?: number;
  ifMatchSnapshotToken?: string;
  ifMatchUpdatedAt?: string;
  request: Request;
}): NextResponse | null {
  if (!params.existingState) {
    return null;
  }

  const currentRevision =
    params.existingState.revision > 0
      ? params.existingState.revision
      : undefined;
  const currentSnapshotToken = params.existingState.snapshot?.token;
  const currentUpdatedAt = params.existingState.updatedAt;

  if (!hasStoreUsersCompareToken(params)) {
    return createStoreUsersConflictResponse({
      endpoint: params.endpoint,
      endpointKey: params.endpointKey,
      currentRevision,
      currentSnapshotToken,
      request: params.request,
      currentUpdatedAt,
    });
  }

  if (params.ifMatchUpdatedAt && currentUpdatedAt !== params.ifMatchUpdatedAt) {
    return createStoreUsersConflictResponse({
      endpoint: params.endpoint,
      endpointKey: params.endpointKey,
      currentRevision,
      currentSnapshotToken,
      request: params.request,
      currentUpdatedAt,
    });
  }

  if (
    typeof params.ifMatchRevision === "number" &&
    currentRevision !== params.ifMatchRevision
  ) {
    return createStoreUsersConflictResponse({
      endpoint: params.endpoint,
      endpointKey: params.endpointKey,
      currentRevision,
      currentSnapshotToken,
      request: params.request,
      currentUpdatedAt,
    });
  }

  if (
    params.ifMatchSnapshotToken &&
    currentSnapshotToken !== params.ifMatchSnapshotToken
  ) {
    return createStoreUsersConflictResponse({
      endpoint: params.endpoint,
      endpointKey: params.endpointKey,
      currentRevision,
      currentSnapshotToken,
      request: params.request,
      currentUpdatedAt,
    });
  }

  return null;
}

function createStoreUsersUsernameConflictResponse(params: {
  endpoint: string;
  endpointKey: string;
  request: Request;
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
    "Conflict: username is already bound to another stored user.",
    {
      category: "invalid_data",
      retryable: false,
    },
  );
}

function normalizeComparableUsername(
  value: string | null | undefined,
): string | undefined {
  const normalized = value?.trim().toLowerCase();
  return normalized || undefined;
}

function resolveAuthoritativeStoreUsersUsername(params: {
  endpoint: string;
  request: Request;
  grant: {
    source: string;
    username?: string | null;
  };
  authoritativeUsernameFromStats?: string;
  requestedUsername?: string;
  userId: number;
}): string | undefined {
  const {
    endpoint,
    request,
    grant,
    authoritativeUsernameFromStats,
    requestedUsername,
    userId,
  } = params;

  let authoritativeUsername = requestedUsername;
  if (grant.source !== "test_bypass" && grant.username) {
    authoritativeUsername = grant.username;
  }
  if (authoritativeUsernameFromStats) {
    authoritativeUsername = authoritativeUsernameFromStats;
  }

  const normalizedGrantUsername = normalizeComparableUsername(grant.username);
  const normalizedStatsUsername = normalizeComparableUsername(
    authoritativeUsernameFromStats,
  );

  if (
    normalizedGrantUsername &&
    normalizedStatsUsername &&
    normalizedGrantUsername !== normalizedStatsUsername
  ) {
    logPrivacySafe(
      "warn",
      endpoint,
      "Protected write grant username no longer matched the authoritative AniList stats username; preferring the stats payload",
      {
        grantUsername: grant.username,
        authoritativeUsername: authoritativeUsernameFromStats,
        requestedUserId: userId,
      },
      request,
    );
  }

  const normalizedRequestedUsername =
    normalizeComparableUsername(requestedUsername);
  const normalizedAuthoritativeUsername = normalizeComparableUsername(
    authoritativeUsername,
  );

  if (
    normalizedRequestedUsername &&
    normalizedAuthoritativeUsername &&
    normalizedRequestedUsername !== normalizedAuthoritativeUsername
  ) {
    logPrivacySafe(
      "warn",
      endpoint,
      "Ignoring client-supplied username that did not match the bound AniList snapshot",
      {
        authoritativeUsername,
        requestedUserId: userId,
        suppliedUsername: requestedUsername,
      },
      request,
    );
  }

  return authoritativeUsername;
}

async function loadExistingStoreUsersState(params: {
  endpoint: string;
  request: Request;
  userId: number;
}): Promise<PersistedUserState | undefined> {
  try {
    const existingState = await getPersistedUserState(params.userId);
    return existingState ?? undefined;
  } catch (error) {
    if (error instanceof UserDataIntegrityError) {
      logPrivacySafe(
        "warn",
        params.endpoint,
        "Ignoring corrupt persisted user state during overwrite",
        {
          userId: params.userId,
          error: error.message,
        },
        params.request,
      );
      return undefined;
    }

    throw error;
  }
}

function buildStoreUsersUserData(params: {
  authoritativeUsername?: string;
  createdAt: string;
  requestMetadata?: PersistedUserRecord["requestMetadata"];
  stats: UserRecord["stats"];
  updatedAt: string;
  userId: number;
}): UserRecord {
  const {
    authoritativeUsername,
    createdAt,
    requestMetadata,
    stats,
    updatedAt,
    userId,
  } = params;

  return {
    userId: String(userId),
    username: authoritativeUsername,
    stats,
    ...(requestMetadata ? { requestMetadata } : {}),
    createdAt,
    updatedAt,
  };
}

async function createStoreUsersSuccessResponse(params: {
  request: Request;
  userId: number;
  username?: string;
  saveResult: {
    updatedAt: string;
    revision: number;
    snapshotToken: string;
  };
}): Promise<NextResponse> {
  const protectedWriteGrantHeader = await createProtectedWriteGrantCookieHeader(
    {
      source: "stored_user",
      userId: params.userId,
      username: params.username,
    },
  );

  return jsonWithCors(
    {
      success: true,
      userId: params.userId,
      updatedAt: params.saveResult.updatedAt,
      revision: params.saveResult.revision,
      snapshotToken: params.saveResult.snapshotToken,
    },
    params.request,
    undefined,
    protectedWriteGrantHeader
      ? {
          "Set-Cookie": protectedWriteGrantHeader,
        }
      : undefined,
  );
}

async function persistPreparedUserRecord(params: {
  endpoint: string;
  endpointKey: string;
  ifMatchRevision?: number;
  ifMatchSnapshotToken?: string;
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
      expectedRevision: params.ifMatchRevision,
      expectedSnapshotToken: params.ifMatchSnapshotToken,
      expectedUpdatedAt: params.ifMatchUpdatedAt,
    });

    return { saveResult };
  } catch (error) {
    if (error instanceof UserRecordConflictError) {
      return {
        errorResponse: createStoreUsersConflictResponse({
          endpoint: params.endpoint,
          endpointKey: params.endpointKey,
          currentRevision: error.currentRevision,
          currentSnapshotToken: error.currentSnapshotToken,
          request: params.request,
          currentUpdatedAt: error.currentUpdatedAt,
        }),
      };
    }

    if (error instanceof UserRecordUsernameConflictError) {
      return {
        errorResponse: createStoreUsersUsernameConflictResponse({
          endpoint: params.endpoint,
          endpointKey: params.endpointKey,
          request: params.request,
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
    undefined,
    {
      requireRequestProof: true,
      requireVerifiedClientIp: true,
    },
  );
  if (init.errorResponse) return init.errorResponse;

  const { startTime, ip, endpoint, endpointKey } = init;

  try {
    const bodyResult = await readJsonRequestBody<Record<string, unknown>>(
      request,
      {
        endpointName: endpoint,
        endpointKey,
        maxBytes: STORE_USERS_JSON_BODY_LIMIT_BYTES,
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

    const {
      userId,
      username,
      stats,
      ifMatchRevision,
      ifMatchSnapshotToken,
      ifMatchUpdatedAt,
    } = validationResult.data;

    const protectedWriteGrantResult = await validateProtectedWriteGrant({
      endpointKey,
      endpointName: endpoint,
      request,
      requireStatsHash: true,
      statsPayload: stats,
      userId,
    });
    if ("errorResponse" in protectedWriteGrantResult) {
      return protectedWriteGrantResult.errorResponse;
    }

    const grant = protectedWriteGrantResult.grant;
    const authoritativeUsernameFromStats =
      getAuthoritativeUsernameFromUserStats(stats);
    const authoritativeUsername = resolveAuthoritativeStoreUsersUsername({
      endpoint,
      request,
      grant,
      authoritativeUsernameFromStats,
      requestedUsername: username,
      userId,
    });

    const requestMetadata = buildPersistedRequestMetadata(ip);

    const now = new Date().toISOString();
    const existingState = await loadExistingStoreUsersState({
      endpoint,
      request,
      userId,
    });
    const createdAt = existingState?.createdAt ?? now;

    const compareConflictResponse = resolveStoreUsersCompareConflict({
      endpoint,
      endpointKey,
      existingState,
      ifMatchRevision,
      ifMatchSnapshotToken,
      ifMatchUpdatedAt,
      request,
    });
    if (compareConflictResponse) {
      return compareConflictResponse;
    }

    const userData = buildStoreUsersUserData({
      authoritativeUsername,
      createdAt,
      requestMetadata,
      stats: stats as unknown as UserRecord["stats"],
      updatedAt: now,
      userId,
    });

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
      ifMatchRevision,
      ifMatchSnapshotToken,
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

    return createStoreUsersSuccessResponse({
      request,
      userId,
      username: preparedRecord.persistedUserData.username,
      saveResult: persistResult.saveResult,
    });
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
