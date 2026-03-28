import {
  apiErrorResponse,
  apiJsonHeaders,
  createRateLimiter,
  handleError,
  incrementAnalytics,
  initializeApiRequest,
  jsonWithCors,
  logPrivacySafe,
  parseStrictPositiveInteger,
  redisClient,
} from "@/lib/api-utils";
import type {
  CardsRecord,
  GlobalCardSettings,
  StoredCardConfig,
} from "@/lib/types/records";
import { safeParse, validateColorValue } from "@/lib/utils";

const ratelimit = createRateLimiter({ limit: 60, window: "10 s" });
const CARDS_API_ENDPOINT = "Cards API";
const CARDS_API_FAILED_METRIC = "analytics:cards_api:failed_requests";
const CARDS_API_SUCCESS_METRIC = "analytics:cards_api:successful_requests";

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function isOptionalString(value: unknown): value is string | undefined {
  return value === undefined || typeof value === "string";
}

function isOptionalBoolean(value: unknown): value is boolean | undefined {
  return value === undefined || typeof value === "boolean";
}

function isOptionalFiniteNumber(value: unknown): value is number | undefined {
  return (
    value === undefined || (typeof value === "number" && Number.isFinite(value))
  );
}

function isOptionalColorValue(
  value: unknown,
): value is StoredCardConfig["titleColor"] | undefined {
  return value === undefined || validateColorValue(value);
}

function isValidStoredCardConfig(value: unknown): value is StoredCardConfig {
  if (!isPlainObject(value)) return false;

  return (
    isNonEmptyString(value.cardName) &&
    isOptionalString(value.variation) &&
    isOptionalString(value.colorPreset) &&
    isOptionalColorValue(value.titleColor) &&
    isOptionalColorValue(value.backgroundColor) &&
    isOptionalColorValue(value.textColor) &&
    isOptionalColorValue(value.circleColor) &&
    isOptionalString(value.borderColor) &&
    isOptionalFiniteNumber(value.borderRadius) &&
    isOptionalBoolean(value.showFavorites) &&
    isOptionalBoolean(value.useStatusColors) &&
    isOptionalBoolean(value.showPiePercentages) &&
    isOptionalFiniteNumber(value.gridCols) &&
    isOptionalFiniteNumber(value.gridRows) &&
    isOptionalBoolean(value.useCustomSettings) &&
    isOptionalBoolean(value.disabled)
  );
}

function isValidGlobalCardSettings(
  value: unknown,
): value is GlobalCardSettings {
  if (!isPlainObject(value)) return false;

  return (
    isOptionalString(value.colorPreset) &&
    isOptionalColorValue(value.titleColor) &&
    isOptionalColorValue(value.backgroundColor) &&
    isOptionalColorValue(value.textColor) &&
    isOptionalColorValue(value.circleColor) &&
    isOptionalBoolean(value.borderEnabled) &&
    isOptionalString(value.borderColor) &&
    isOptionalFiniteNumber(value.borderRadius) &&
    isOptionalBoolean(value.useStatusColors) &&
    isOptionalBoolean(value.showPiePercentages) &&
    isOptionalBoolean(value.showFavorites) &&
    isOptionalFiniteNumber(value.gridCols) &&
    isOptionalFiniteNumber(value.gridRows)
  );
}

class CardsRecordIntegrityError extends Error {
  statusCode = 500 as const;

  constructor(message: string) {
    super(message);
    this.name = "CardsRecordIntegrityError";
  }
}

function assertValidCardsRecord(
  value: unknown,
  expectedUserId: number,
): asserts value is CardsRecord {
  if (!isPlainObject(value)) {
    throw new CardsRecordIntegrityError("Stored cards record is not an object");
  }

  const storedUserId = value.userId;

  if (
    typeof storedUserId !== "number" ||
    !Number.isInteger(storedUserId) ||
    storedUserId <= 0
  ) {
    throw new CardsRecordIntegrityError(
      "Stored cards record has an invalid userId",
    );
  }

  if (storedUserId !== expectedUserId) {
    throw new CardsRecordIntegrityError(
      "Stored cards record userId does not match requested user",
    );
  }

  if (!Array.isArray(value.cards)) {
    throw new CardsRecordIntegrityError(
      "Stored cards record has an invalid cards array",
    );
  }

  if (!value.cards.every((card) => isValidStoredCardConfig(card))) {
    throw new CardsRecordIntegrityError(
      "Stored cards record contains an invalid card entry",
    );
  }

  if (
    value.globalSettings !== undefined &&
    !isValidGlobalCardSettings(value.globalSettings)
  ) {
    throw new CardsRecordIntegrityError(
      "Stored cards record has invalid global settings",
    );
  }

  if (!isNonEmptyString(value.updatedAt)) {
    throw new CardsRecordIntegrityError(
      "Stored cards record has an invalid updatedAt value",
    );
  }
}

/**
 * Serves cached card configurations for the requested user from Redis.
 * @param request - HTTP request carrying the userId query and related headers.
 * @returns JSON response containing the card data or an explanatory error payload.
 * @source
 */
export async function GET(request: Request) {
  const init = await initializeApiRequest(
    request,
    CARDS_API_ENDPOINT,
    "cards_api",
    ratelimit,
    { skipSameOrigin: true },
  );
  if (init.errorResponse) return init.errorResponse;

  const { startTime, endpoint } = init;
  const { searchParams } = new URL(request.url);
  const userId = searchParams.get("userId");

  logPrivacySafe(
    "log",
    endpoint,
    "Processing cards lookup",
    { userId },
    request,
  );

  if (!userId) {
    logPrivacySafe(
      "warn",
      endpoint,
      "Missing user ID parameter",
      undefined,
      request,
    );
    return apiErrorResponse(request, 400, "Missing user ID parameter");
  }

  const numericUserId = parseStrictPositiveInteger(userId);
  if (!numericUserId) {
    logPrivacySafe(
      "warn",
      endpoint,
      "Invalid user ID format",
      { userId },
      request,
    );
    incrementAnalytics(CARDS_API_FAILED_METRIC).catch(() => {});
    return apiErrorResponse(request, 400, "Invalid user ID format", {
      category: "invalid_data",
      retryable: false,
    });
  }

  try {
    logPrivacySafe(
      "log",
      endpoint,
      "Fetching card configuration from Redis",
      { userId: numericUserId },
      request,
    );
    const key = `cards:${numericUserId}`;
    const cardDataStr = await redisClient.get(key);
    const duration = Date.now() - startTime;

    if (!cardDataStr) {
      logPrivacySafe(
        "warn",
        endpoint,
        "Cards not found",
        { userId: numericUserId, durationMs: duration },
        request,
      );
      return apiErrorResponse(request, 404, "Cards not found");
    }

    const cardData = safeParse<unknown>(
      cardDataStr,
      `${endpoint}:cards:${numericUserId}`,
    );
    assertValidCardsRecord(cardData, numericUserId);

    logPrivacySafe(
      "log",
      endpoint,
      "Successfully returned card data",
      { userId: numericUserId, durationMs: duration },
      request,
    );

    if (duration > 500) {
      logPrivacySafe(
        "warn",
        endpoint,
        "Slow response time",
        { userId: numericUserId, durationMs: duration },
        request,
      );
    }
    incrementAnalytics(CARDS_API_SUCCESS_METRIC).catch(() => {});
    return jsonWithCors(cardData, request);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } catch (error: any) {
    return handleError(
      error as Error,
      endpoint,
      startTime,
      CARDS_API_FAILED_METRIC,
      "Failed to fetch cards",
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
      "Access-Control-Allow-Methods": "GET, HEAD, OPTIONS",
    },
  });
}
