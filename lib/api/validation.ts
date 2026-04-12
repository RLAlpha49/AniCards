import type { NextResponse } from "next/server";
import { z } from "zod";

import { type ApiError, apiErrorResponse } from "@/lib/api/errors";
import { logPrivacySafe } from "@/lib/api/logging";
import { displayNames, isValidCardType } from "@/lib/card-data/validation";
import {
  sanitizeErrorReportMetadata,
  sanitizeErrorReportRoute,
  sanitizeErrorReportText,
} from "@/lib/error-report-sanitization";
import type {
  GlobalCardSettings,
  PersistedUserRecord,
  StoredCardConfig,
  UserStatsData,
} from "@/lib/types/records";
import {
  getColorInvalidReason,
  validateBorderRadius,
  validateColorValue,
} from "@/lib/utils";

const REQUEST_ID_PATTERN = /^[A-Za-z0-9._:-]{8,120}$/;
const USERNAME_PATTERN = /^[a-zA-Z0-9_\-\s]*$/;
const MAX_RECOVERY_SUGGESTION_ACTION_URL_LENGTH = 1024;
const RECOVERY_SUGGESTION_INTERNAL_URL_BASE = "https://anicards.local";

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function describeNonPrimitiveValidationValue(value: unknown): string {
  if (value instanceof Error) {
    return value.message || value.name;
  }

  if (typeof value === "function") {
    return value.name ? `[Function ${value.name}]` : "[Function]";
  }

  try {
    const serialized = JSON.stringify(value);
    if (typeof serialized === "string") {
      return serialized;
    }
  } catch {
    // Ignore serialization failures and fall back to a stable label below.
  }

  if (Array.isArray(value)) {
    return `[Array(${value.length})]`;
  }

  if (typeof value === "object" && value !== null) {
    const constructorName = value.constructor?.name;
    if (constructorName && constructorName !== "Object") {
      return `[${constructorName}]`;
    }

    return "[Object]";
  }

  return String(value);
}

function safeStringifyValue(value: unknown): string {
  if (value === undefined) return "undefined";
  if (value === null) return "null";
  if (typeof value === "string") return value;
  if (
    typeof value === "number" ||
    typeof value === "boolean" ||
    typeof value === "bigint" ||
    typeof value === "symbol"
  ) {
    return String(value);
  }

  return describeNonPrimitiveValidationValue(value);
}

function coerceToString(value: unknown): string {
  return typeof value === "string" ? value : safeStringifyValue(value);
}

function sanitizeOptionalTrimmedString(maxLength: number) {
  return z.preprocess((value) => {
    if (typeof value !== "string") {
      return undefined;
    }

    const trimmed = value.trim().slice(0, maxLength);
    return trimmed.length > 0 ? trimmed : undefined;
  }, z.string().min(1).max(maxLength).optional());
}

function sanitizeUsernameInput(value: unknown): unknown {
  if (value === null || value === undefined) {
    return undefined;
  }

  if (typeof value !== "string") {
    return value;
  }

  return value.trim();
}

function describeValueType(value: unknown): string {
  if (Array.isArray(value)) {
    return "array";
  }

  return value === null ? "null" : typeof value;
}

function logValidationWarning(
  endpoint: string,
  message: string,
  request?: Request,
  context?: Record<string, unknown>,
): void {
  logPrivacySafe("warn", endpoint, message, context, request);
}

function sanitizeRequiredErrorReportText(maxLength: number) {
  return z.preprocess((value) => {
    if (typeof value !== "string") {
      return value;
    }

    return sanitizeErrorReportText(value, maxLength);
  }, z.string().min(1).max(maxLength));
}

function sanitizeOptionalErrorReportText(maxLength: number) {
  return z.preprocess((value) => {
    if (typeof value !== "string") {
      return undefined;
    }

    return sanitizeErrorReportText(value, maxLength);
  }, z.string().min(1).max(maxLength).optional());
}

function sanitizeErrorReportRouteInput(value: unknown): unknown {
  if (typeof value !== "string") {
    return undefined;
  }

  return sanitizeErrorReportRoute(value);
}

function sanitizeErrorReportActionUrlInput(value: unknown): unknown {
  if (typeof value !== "string") {
    return undefined;
  }

  const trimmed = value.trim();
  if (
    trimmed.length === 0 ||
    trimmed.length > MAX_RECOVERY_SUGGESTION_ACTION_URL_LENGTH
  ) {
    return undefined;
  }

  if (trimmed.startsWith("/")) {
    if (trimmed.startsWith("//")) {
      return undefined;
    }

    try {
      const parsed = new URL(trimmed, RECOVERY_SUGGESTION_INTERNAL_URL_BASE);
      return `${parsed.pathname}${parsed.search}${parsed.hash}`;
    } catch {
      return undefined;
    }
  }

  try {
    const parsed = new URL(trimmed);
    return parsed.protocol === "https:" ? parsed.toString() : undefined;
  } catch {
    return undefined;
  }
}

function sanitizeErrorReportMetadataInput(
  value: unknown,
): Record<string, string | number | boolean | null> | undefined {
  if (!isPlainObject(value)) {
    return undefined;
  }

  return sanitizeErrorReportMetadata(value);
}

const finiteNumberSchema = z.number();
const nonNegativeIntegerSchema = z.number().int().nonnegative();
const pageInfoSchema = z.looseObject({ total: nonNegativeIntegerSchema });
const mediaTitleSchema = z.looseObject({
  english: z.string().optional(),
  romaji: z.string().optional(),
  native: z.string().optional(),
});
const mediaCoverImageSchema = z.looseObject({
  large: z.string().optional(),
  medium: z.string().optional(),
  color: z.string().optional(),
});
const characterImageSchema = z.looseObject({
  large: z.string().optional(),
  medium: z.string().optional(),
});
const staffImageSchema = z.looseObject({
  large: z.string().optional(),
  medium: z.string().optional(),
});
const favoriteAnimeNodeSchema = z.looseObject({
  id: nonNegativeIntegerSchema,
  title: mediaTitleSchema,
  coverImage: mediaCoverImageSchema,
});
const favoriteMangaNodeSchema = z.looseObject({
  id: nonNegativeIntegerSchema,
  title: mediaTitleSchema,
  coverImage: mediaCoverImageSchema,
});
const favoriteCharacterNodeSchema = z.looseObject({
  id: nonNegativeIntegerSchema,
  name: z.looseObject({
    full: z.string(),
    native: z.string().optional(),
  }),
  image: characterImageSchema,
});
const favoriteStaffNodeSchema = z.looseObject({
  id: nonNegativeIntegerSchema,
  name: z.looseObject({
    full: z.string(),
    native: z.string().optional(),
  }),
  image: staffImageSchema,
});
const favoriteStudioNodeSchema = z.looseObject({
  id: nonNegativeIntegerSchema,
  name: z.string(),
});
const favouritesPageSchema = <T extends z.ZodTypeAny>(nodeSchema: T) =>
  z.looseObject({
    nodes: z.array(nodeSchema),
    pageInfo: pageInfoSchema.optional(),
  });
const userFavouritesSchema = z.looseObject({
  anime: favouritesPageSchema(favoriteAnimeNodeSchema).optional(),
  manga: favouritesPageSchema(favoriteMangaNodeSchema).optional(),
  characters: favouritesPageSchema(favoriteCharacterNodeSchema).optional(),
  staff: favouritesPageSchema(favoriteStaffNodeSchema),
  studios: favouritesPageSchema(favoriteStudioNodeSchema),
});
const activityHistoryItemSchema = z.looseObject({
  date: finiteNumberSchema,
  amount: finiteNumberSchema,
});
const activityStatsSchema = z.looseObject({
  activityHistory: z.array(activityHistoryItemSchema),
});
const genreCountSchema = z.looseObject({
  genre: z.string(),
  count: finiteNumberSchema,
});
const tagCountSchema = z.looseObject({
  tag: z.looseObject({
    name: z.string(),
    category: z.string().optional(),
  }),
  count: finiteNumberSchema,
});
const voiceActorCountSchema = z.looseObject({
  voiceActor: z.looseObject({
    name: z.looseObject({
      full: z.string(),
    }),
  }),
  count: finiteNumberSchema,
});
const studioCountSchema = z.looseObject({
  studio: z.looseObject({
    name: z.string(),
  }),
  count: finiteNumberSchema,
});
const staffCountSchema = z.looseObject({
  staff: z.looseObject({
    name: z.looseObject({
      full: z.string(),
    }),
  }),
  count: finiteNumberSchema,
});
const statusCountSchema = z.looseObject({
  status: z.string(),
  count: finiteNumberSchema,
});
const formatCountSchema = z.looseObject({
  format: z.string(),
  count: finiteNumberSchema,
});
const scoreCountSchema = z.looseObject({
  score: finiteNumberSchema,
  count: finiteNumberSchema,
});
const releaseYearCountSchema = z.looseObject({
  releaseYear: finiteNumberSchema,
  count: finiteNumberSchema,
});
const countryCountSchema = z.looseObject({
  country: z.string(),
  count: finiteNumberSchema,
});
const startYearCountSchema = z.looseObject({
  startYear: finiteNumberSchema,
  count: finiteNumberSchema,
});
const lengthCountSchema = z.looseObject({
  length: z.string(),
  count: finiteNumberSchema,
});
const animeStatsSchema = z.looseObject({
  count: finiteNumberSchema,
  episodesWatched: finiteNumberSchema,
  minutesWatched: finiteNumberSchema,
  meanScore: finiteNumberSchema,
  standardDeviation: finiteNumberSchema,
  genres: z.array(genreCountSchema),
  tags: z.array(tagCountSchema),
  voiceActors: z.array(voiceActorCountSchema),
  studios: z.array(studioCountSchema),
  staff: z.array(staffCountSchema),
  statuses: z.array(statusCountSchema).optional(),
  formats: z.array(formatCountSchema).optional(),
  scores: z.array(scoreCountSchema).optional(),
  releaseYears: z.array(releaseYearCountSchema).optional(),
  countries: z.array(countryCountSchema).optional(),
  startYears: z.array(startYearCountSchema).optional(),
  lengths: z.array(lengthCountSchema).optional(),
});
const mangaStatsSchema = z.looseObject({
  count: finiteNumberSchema,
  chaptersRead: finiteNumberSchema,
  volumesRead: finiteNumberSchema,
  meanScore: finiteNumberSchema,
  standardDeviation: finiteNumberSchema,
  genres: z.array(genreCountSchema),
  tags: z.array(tagCountSchema),
  staff: z.array(staffCountSchema),
  statuses: z.array(statusCountSchema).optional(),
  formats: z.array(formatCountSchema).optional(),
  scores: z.array(scoreCountSchema).optional(),
  releaseYears: z.array(releaseYearCountSchema).optional(),
  countries: z.array(countryCountSchema).optional(),
  startYears: z.array(startYearCountSchema).optional(),
  lengths: z.array(lengthCountSchema).optional(),
});
const userStatisticsSchema = z.looseObject({
  anime: animeStatsSchema,
  manga: mangaStatsSchema,
});
const userAvatarSchema = z.looseObject({
  large: z.string().optional(),
  medium: z.string().optional(),
});
const userSectionSchema = z.looseObject({
  stats: activityStatsSchema,
  favourites: userFavouritesSchema,
  statistics: userStatisticsSchema,
  name: z.string().optional(),
  avatar: userAvatarSchema.optional(),
  bannerImage: z.string().optional(),
  createdAt: finiteNumberSchema.optional(),
});
const followersPageSchema = z.looseObject({
  pageInfo: pageInfoSchema,
  followers: z.array(z.looseObject({ id: nonNegativeIntegerSchema })),
});
const followingPageSchema = z.looseObject({
  pageInfo: pageInfoSchema,
  following: z.array(z.looseObject({ id: nonNegativeIntegerSchema })),
});
const threadsPageSchema = z.looseObject({
  pageInfo: pageInfoSchema,
  threads: z.array(z.looseObject({ id: nonNegativeIntegerSchema })),
});
const threadCommentsPageSchema = z.looseObject({
  pageInfo: pageInfoSchema,
  threadComments: z.array(z.looseObject({ id: nonNegativeIntegerSchema })),
});
const reviewsPageSchema = z.looseObject({
  pageInfo: pageInfoSchema,
  reviews: z.array(z.looseObject({ id: nonNegativeIntegerSchema })),
});
const reviewEntrySchema = z.looseObject({
  id: nonNegativeIntegerSchema,
  score: finiteNumberSchema,
  rating: finiteNumberSchema,
  ratingAmount: finiteNumberSchema,
  summary: z.string().optional(),
  createdAt: finiteNumberSchema.optional(),
  media: z.looseObject({
    id: nonNegativeIntegerSchema,
    title: z.looseObject({ romaji: z.string().optional() }),
    type: z.string().optional(),
    genres: z.array(z.string()).optional(),
  }),
});
const userReviewsPageSchema = z.looseObject({
  reviews: z.array(reviewEntrySchema),
});
const recommendationEntrySchema = z.looseObject({
  id: nonNegativeIntegerSchema,
  rating: finiteNumberSchema,
  media: z.looseObject({
    id: nonNegativeIntegerSchema,
    title: z.looseObject({ romaji: z.string().optional() }),
  }),
  mediaRecommendation: z.looseObject({
    id: nonNegativeIntegerSchema,
    title: z.looseObject({ romaji: z.string().optional() }),
  }),
});
const userRecommendationsPageSchema = z.looseObject({
  recommendations: z.array(recommendationEntrySchema),
});
const mediaListEntrySchema = z.looseObject({
  id: nonNegativeIntegerSchema,
  score: finiteNumberSchema.optional(),
  progress: finiteNumberSchema.optional(),
  repeat: finiteNumberSchema.optional(),
  media: z.looseObject({
    id: nonNegativeIntegerSchema,
    title: mediaTitleSchema,
    coverImage: mediaCoverImageSchema.optional(),
    episodes: finiteNumberSchema.optional(),
    chapters: finiteNumberSchema.optional(),
    volumes: finiteNumberSchema.optional(),
    averageScore: finiteNumberSchema.optional(),
    format: z.string().optional(),
    source: z.string().optional(),
    season: z.string().optional(),
    seasonYear: finiteNumberSchema.optional(),
    genres: z.array(z.string()).optional(),
    studios: z
      .looseObject({
        nodes: z.array(
          z.looseObject({ id: nonNegativeIntegerSchema, name: z.string() }),
        ),
      })
      .optional(),
  }),
});
const mediaListGroupSchema = z.looseObject({
  name: z.string().optional(),
  entries: z.array(mediaListEntrySchema),
});
const mediaListCollectionSchema = z.looseObject({
  lists: z.array(mediaListGroupSchema),
  count: finiteNumberSchema.optional(),
  totalRepeat: finiteNumberSchema.optional(),
});

export const userStatsDataSchema: z.ZodType<UserStatsData> = z.looseObject({
  User: userSectionSchema,
  followersPage: followersPageSchema,
  followingPage: followingPageSchema,
  threadsPage: threadsPageSchema,
  threadCommentsPage: threadCommentsPageSchema,
  reviewsPage: reviewsPageSchema,
  userReviews: userReviewsPageSchema.optional(),
  userRecommendations: userRecommendationsPageSchema.optional(),
  animePlanning: mediaListCollectionSchema.optional(),
  mangaPlanning: mediaListCollectionSchema.optional(),
  animeCurrent: mediaListCollectionSchema.optional(),
  mangaCurrent: mediaListCollectionSchema.optional(),
  animeRewatched: mediaListCollectionSchema.optional(),
  mangaReread: mediaListCollectionSchema.optional(),
  animeCompleted: mediaListCollectionSchema.optional(),
  mangaCompleted: mediaListCollectionSchema.optional(),
  animeDropped: mediaListCollectionSchema.optional(),
  mangaDropped: mediaListCollectionSchema.optional(),
});

const sourceMaterialDistributionTotalsEntrySchema = z.looseObject({
  source: z.string(),
  count: finiteNumberSchema,
});
const seasonalPreferenceTotalsEntrySchema = z.looseObject({
  season: z.string(),
  count: finiteNumberSchema,
});
const animeGenreSynergyTotalsEntrySchema = z.looseObject({
  a: z.string(),
  b: z.string(),
  count: finiteNumberSchema,
});
const studioCollaborationTotalsEntrySchema = z.looseObject({
  a: z.string(),
  b: z.string(),
  count: finiteNumberSchema,
});
const userAggregatesSchema = z.looseObject({
  animeSourceMaterialDistributionTotals: z
    .array(sourceMaterialDistributionTotalsEntrySchema)
    .optional(),
  animeSeasonalPreferenceTotals: z
    .array(seasonalPreferenceTotalsEntrySchema)
    .optional(),
  animeGenreSynergyTotals: z
    .array(animeGenreSynergyTotalsEntrySchema)
    .optional(),
  studioCollaborationTotals: z
    .array(studioCollaborationTotalsEntrySchema)
    .optional(),
});
const persistedRequestMetadataSchema = z.looseObject({
  lastSeenIpBucket: z.string().min(1).max(64).optional(),
});
const normalizedUsernameSchema = z.preprocess(
  sanitizeUsernameInput,
  z.string().min(1).max(100).regex(USERNAME_PATTERN).optional(),
);
const isoDateStringSchema = z.string().trim().min(1);
const ifMatchUpdatedAtSchema = z
  .string()
  .trim()
  .min(1)
  .datetime({ offset: true })
  .transform((value) => new Date(value).toISOString())
  .optional();

export const persistedUserRecordSchema: z.ZodType<PersistedUserRecord> =
  z.strictObject({
    userId: z.string().regex(/^[1-9]\d*$/),
    username: normalizedUsernameSchema,
    stats: userStatsDataSchema,
    aggregates: userAggregatesSchema.optional(),
    requestMetadata: persistedRequestMetadataSchema.optional(),
    createdAt: isoDateStringSchema,
    updatedAt: isoDateStringSchema,
  });

export const storeUserRequestSchema = z.strictObject({
  userId: z.coerce.number().int().positive(),
  username: normalizedUsernameSchema,
  stats: z.custom<Record<string, unknown>>(isPlainObject, {
    message: "Stats must be a non-array object",
  }),
  ifMatchUpdatedAt: ifMatchUpdatedAtSchema,
});

const colorValueSchema = z.custom((value) => validateColorValue(value), {
  message: "Invalid color value",
});

const storedCardConfigInputSchema = z.strictObject({
  cardName: z.string(),
  variation: z.string().optional(),
  colorPreset: z.string().optional(),
  titleColor: colorValueSchema.optional(),
  backgroundColor: colorValueSchema.optional(),
  textColor: colorValueSchema.optional(),
  circleColor: colorValueSchema.optional(),
  borderColor: colorValueSchema.optional(),
  borderRadius: finiteNumberSchema.optional(),
  showFavorites: z.boolean().optional(),
  useStatusColors: z.boolean().optional(),
  showPiePercentages: z.boolean().optional(),
  gridCols: finiteNumberSchema.optional(),
  gridRows: finiteNumberSchema.optional(),
  useCustomSettings: z.boolean().optional(),
  disabled: z.boolean().optional(),
});

const globalCardSettingsInputSchema: z.ZodType<Partial<GlobalCardSettings>> =
  z.strictObject({
    colorPreset: z.string().optional(),
    titleColor: z.any().optional(),
    backgroundColor: z.any().optional(),
    textColor: z.any().optional(),
    circleColor: z.any().optional(),
    borderEnabled: z.boolean().optional(),
    borderColor: z.any().optional(),
    borderRadius: finiteNumberSchema.optional(),
    useStatusColors: z.boolean().optional(),
    showPiePercentages: z.boolean().optional(),
    showFavorites: z.boolean().optional(),
    gridCols: finiteNumberSchema.optional(),
    gridRows: finiteNumberSchema.optional(),
  });

export const storeCardsRequestSchema = z.strictObject({
  userId: z.coerce.number().int().positive(),
  statsData: z.unknown().optional(),
  cards: z.array(z.unknown()),
  globalSettings: globalCardSettingsInputSchema.optional(),
  ifMatchUpdatedAt: ifMatchUpdatedAtSchema,
  cardOrder: z.array(z.string().trim().min(1)).optional(),
});

const errorReportSourceSchema = z.enum([
  "user_action",
  "client_hook",
  "analytics_instrumentation",
  "react_error_boundary",
  "app_router_error_boundary",
  "api_route",
]);
const errorCategorySchema = z.enum([
  "user_not_found",
  "rate_limited",
  "network_error",
  "invalid_data",
  "server_error",
  "timeout",
  "authentication",
  "unknown",
]);
const recoverySuggestionSchema = z
  .object({
    title: sanitizeRequiredErrorReportText(120),
    description: sanitizeRequiredErrorReportText(240),
    actionLabel: sanitizeOptionalErrorReportText(80),
    actionUrl: z.preprocess(
      sanitizeErrorReportActionUrlInput,
      z
        .string()
        .min(1)
        .max(MAX_RECOVERY_SUGGESTION_ACTION_URL_LENGTH)
        .optional(),
    ),
  })
  .strip();

export const errorReportPayloadSchema = z
  .object({
    id: z
      .preprocess((value) => {
        if (typeof value !== "string") {
          return undefined;
        }

        const trimmed = value.trim();
        return REQUEST_ID_PATTERN.test(trimmed) ? trimmed : undefined;
      }, z.string().regex(REQUEST_ID_PATTERN).optional())
      .optional(),
    timestamp: z
      .preprocess((value) => {
        if (typeof value !== "number" || !Number.isSafeInteger(value)) {
          return undefined;
        }

        return value > 0 ? value : undefined;
      }, z.number().int().positive().optional())
      .optional(),
    source: errorReportSourceSchema.optional(),
    userAction: sanitizeRequiredErrorReportText(120),
    message: sanitizeRequiredErrorReportText(2_000),
    category: errorCategorySchema.optional(),
    retryable: z.boolean().optional(),
    recoverySuggestions: z.array(recoverySuggestionSchema).max(6).optional(),
    requestId: z
      .preprocess((value) => {
        if (typeof value !== "string") {
          return undefined;
        }

        const trimmed = value.trim();
        return trimmed.length > 0 ? trimmed : undefined;
      }, z.string().regex(REQUEST_ID_PATTERN).optional())
      .optional(),
    errorName: sanitizeOptionalErrorReportText(120),
    route: z.preprocess(
      sanitizeErrorReportRouteInput,
      z.string().min(1).max(512).optional(),
    ),
    statusCode: z
      .preprocess((value) => {
        if (typeof value !== "number" || !Number.isInteger(value)) {
          return undefined;
        }

        return value >= 400 && value <= 599 ? value : undefined;
      }, z.number().int().min(400).max(599).optional())
      .optional(),
    digest: sanitizeOptionalTrimmedString(120),
    stack: sanitizeOptionalTrimmedString(8_000),
    componentStack: sanitizeOptionalTrimmedString(8_000),
    metadata: z.preprocess(
      sanitizeErrorReportMetadataInput,
      z
        .record(
          z.string(),
          z.union([z.string(), z.number(), z.boolean(), z.null()]),
        )
        .optional(),
    ),
  })
  .strip();

function getSchemaIssueField(error: z.ZodError): string | undefined {
  return error.issues[0]?.path[0]
    ? String(error.issues[0]?.path[0])
    : undefined;
}

function hasUnrecognizedUserRequestKeys(error: z.ZodError): boolean {
  return error.issues.some((issue) => issue.code === "unrecognized_keys");
}

function buildProvidedKeysSummary(data: Record<string, unknown>): string {
  return Object.keys(data)
    .sort((left, right) => left.localeCompare(right))
    .join(",");
}

function invalidStoreUserData(
  endpoint: string,
  request: Request | undefined,
  reason: string,
  context?: Record<string, unknown>,
): { success: false; error: NextResponse<ApiError> } {
  logPrivacySafe("warn", endpoint, reason, context, request);
  return {
    success: false,
    error: apiErrorResponse(request, 400, "Invalid data", {
      category: "invalid_data",
      retryable: false,
    }),
  };
}

export type ValidateUserDataResult =
  | {
      success: true;
      data: {
        userId: number;
        username?: string;
        stats: Record<string, unknown>;
        ifMatchUpdatedAt?: string;
      };
    }
  | { success: false; error: NextResponse<ApiError> };

export function isValidUsername(value: unknown): boolean {
  return normalizedUsernameSchema.safeParse(value).success;
}

function getValidateUserDataFailure(
  data: Record<string, unknown>,
  endpoint: string,
  request: Request | undefined,
  error: z.ZodError,
): { success: false; error: NextResponse<ApiError> } {
  if (hasUnrecognizedUserRequestKeys(error)) {
    return invalidStoreUserData(
      endpoint,
      request,
      "Request contains unsupported top-level fields",
      {
        providedKeys: buildProvidedKeysSummary(data),
      },
    );
  }

  switch (getSchemaIssueField(error)) {
    case "userId":
      return data.userId === undefined || data.userId === null
        ? invalidStoreUserData(endpoint, request, "Missing userId")
        : invalidStoreUserData(endpoint, request, "Invalid userId format", {
            userId: data.userId,
          });
    case "username":
      return invalidStoreUserData(endpoint, request, "Username invalid", {
        username: data.username,
      });
    case "ifMatchUpdatedAt":
      return invalidStoreUserData(
        endpoint,
        request,
        "Invalid ifMatchUpdatedAt concurrency token",
        {
          ifMatchUpdatedAt: data.ifMatchUpdatedAt,
        },
      );
    case "stats":
      return invalidStoreUserData(
        endpoint,
        request,
        "Stats must be a non-array object",
        {
          statsType: Array.isArray(data.stats) ? "array" : typeof data.stats,
        },
      );
    default:
      return invalidStoreUserData(endpoint, request, "Invalid user payload", {
        issueField: getSchemaIssueField(error),
      });
  }
}

export function validateUserData(
  data: Record<string, unknown>,
  endpoint: string,
  request?: Request,
): ValidateUserDataResult {
  const parsed = storeUserRequestSchema.safeParse(data);
  if (!parsed.success) {
    return getValidateUserDataFailure(data, endpoint, request, parsed.error);
  }

  return {
    success: true,
    data: {
      userId: parsed.data.userId,
      ...(parsed.data.username ? { username: parsed.data.username } : {}),
      stats: parsed.data.stats,
      ...(parsed.data.ifMatchUpdatedAt
        ? { ifMatchUpdatedAt: parsed.data.ifMatchUpdatedAt }
        : {}),
    },
  };
}

function invalidCardDataResponse(
  request?: Request,
  message = "Invalid data",
): NextResponse<ApiError> {
  return apiErrorResponse(request, 400, message, {
    category: "invalid_data",
    retryable: false,
  });
}

function getRequiredCardStringFields(
  card: Record<string, unknown>,
): readonly string[] {
  return card.disabled === true ? ["cardName"] : ["cardName", "variation"];
}

function validateRequiredCardStringFields(
  card: Record<string, unknown>,
  cardIndex: number,
  endpoint: string,
  request?: Request,
): NextResponse<ApiError> | null {
  for (const field of getRequiredCardStringFields(card)) {
    const value = card[field];
    if (typeof value !== "string") {
      logValidationWarning(
        endpoint,
        "Card missing or invalid required string field",
        request,
        {
          cardIndex,
          field,
          valueType: describeValueType(value),
        },
      );
      return invalidCardDataResponse(request);
    }

    if (value.length === 0 || value.length > 100) {
      logValidationWarning(
        endpoint,
        "Card required string field exceeded length constraints",
        request,
        {
          cardIndex,
          field,
        },
      );
      return invalidCardDataResponse(request);
    }
  }

  return null;
}

function validateCardTypeField(
  card: Record<string, unknown>,
  cardIndex: number,
  endpoint: string,
  request?: Request,
): NextResponse<ApiError> | null {
  const cardNameRaw = card.cardName;
  if (typeof cardNameRaw === "string" && isValidCardType(cardNameRaw)) {
    return null;
  }

  logValidationWarning(endpoint, "Card has invalid cardName", request, {
    cardIndex,
    valueType: describeValueType(cardNameRaw),
  });
  return invalidCardDataResponse(request, "Invalid data: Invalid card type");
}

function shouldValidateRequiredCardColors(
  card: Record<string, unknown>,
  requiredColorFields: readonly string[],
): boolean {
  const rawPreset = card.colorPreset;
  const preset =
    typeof rawPreset === "string" && rawPreset.trim().length > 0
      ? rawPreset
      : undefined;
  if (preset !== undefined && preset !== "custom") {
    return false;
  }

  return requiredColorFields.some(
    (field) => card[field] !== undefined && card[field] !== null,
  );
}

function validateRequiredCardColorFields(
  card: Record<string, unknown>,
  cardIndex: number,
  endpoint: string,
  requiredColorFields: readonly string[],
  request?: Request,
): NextResponse<ApiError> | null {
  for (const field of requiredColorFields) {
    const value = card[field];
    if (value === undefined || value === null) {
      logValidationWarning(
        endpoint,
        "Card missing required color field",
        request,
        {
          cardIndex,
          field,
        },
      );
      return invalidCardDataResponse(request);
    }

    if (validateColorValue(value)) {
      continue;
    }

    const reason = getColorInvalidReason(value);
    logValidationWarning(
      endpoint,
      "Card has invalid required color field",
      request,
      {
        cardIndex,
        field,
        ...(reason ? { reason } : {}),
      },
    );
    return invalidCardDataResponse(request);
  }

  return null;
}

function validateCardRequiredFields(
  card: Record<string, unknown>,
  cardIndex: number,
  endpoint: string,
  request?: Request,
): NextResponse<ApiError> | null {
  const requiredColorFields = [
    "titleColor",
    "backgroundColor",
    "textColor",
    "circleColor",
  ] as const;

  const requiredFieldError = validateRequiredCardStringFields(
    card,
    cardIndex,
    endpoint,
    request,
  );
  if (requiredFieldError) {
    return requiredFieldError;
  }

  const cardTypeError = validateCardTypeField(
    card,
    cardIndex,
    endpoint,
    request,
  );
  if (cardTypeError) {
    return cardTypeError;
  }

  if (card.disabled === true) {
    return null;
  }

  if (!shouldValidateRequiredCardColors(card, requiredColorFields)) {
    return null;
  }

  return validateRequiredCardColorFields(
    card,
    cardIndex,
    endpoint,
    requiredColorFields,
    request,
  );
}

function validateOptionalBooleanFields(
  card: Record<string, unknown>,
  cardIndex: number,
  endpoint: string,
  request?: Request,
): NextResponse<ApiError> | null {
  const optionalBooleanFields = [
    "disabled",
    "showFavorites",
    "useStatusColors",
    "showPiePercentages",
    "useCustomSettings",
  ];

  for (const field of optionalBooleanFields) {
    const value = card[field];
    if (value !== undefined && typeof value !== "boolean") {
      logValidationWarning(
        endpoint,
        "Card boolean field must be boolean when provided",
        request,
        {
          cardIndex,
          field,
          valueType: describeValueType(value),
        },
      );
      return apiErrorResponse(request, 400, "Invalid data", {
        category: "invalid_data",
        retryable: false,
      });
    }
  }

  return null;
}

function validateOptionalBorderColorField(
  card: Record<string, unknown>,
  cardIndex: number,
  endpoint: string,
  request?: Request,
): NextResponse<ApiError> | null {
  const borderColorValue = card.borderColor;
  const hasBorder = borderColorValue !== undefined && borderColorValue !== null;
  if (!hasBorder) {
    return null;
  }

  if (!validateColorValue(borderColorValue)) {
    const reason = getColorInvalidReason(borderColorValue);
    logValidationWarning(endpoint, "Card borderColor format invalid", request, {
      cardIndex,
      ...(reason ? { reason } : {}),
    });
    return apiErrorResponse(request, 400, "Invalid data", {
      category: "invalid_data",
      retryable: false,
    });
  }

  return null;
}

function validateGridNumericField(
  value: unknown,
  cardIndex: number,
  fieldName: string,
  endpoint: string,
  request?: Request,
): NextResponse<ApiError> | null {
  if (value === undefined) {
    return null;
  }

  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 1 || parsed > 5) {
    logValidationWarning(
      endpoint,
      "Card grid dimension must be an integer between 1 and 5",
      request,
      {
        cardIndex,
        fieldName,
      },
    );
    return apiErrorResponse(request, 400, "Invalid data", {
      category: "invalid_data",
      retryable: false,
    });
  }

  return null;
}

function validateBorderRadiusField(
  borderRadiusValue: unknown,
  cardIndex: number,
  endpoint: string,
  options?: { requireValue?: boolean },
  request?: Request,
): NextResponse<ApiError> | null {
  const requireValue = options?.requireValue ?? false;
  if (borderRadiusValue === undefined || borderRadiusValue === null) {
    if (!requireValue) {
      return null;
    }

    logValidationWarning(
      endpoint,
      "Card borderRadius required when border is enabled",
      request,
      {
        cardIndex,
      },
    );
    return apiErrorResponse(request, 400, "Invalid data", {
      category: "invalid_data",
      retryable: false,
    });
  }

  if (typeof borderRadiusValue !== "number") {
    logValidationWarning(
      endpoint,
      "Card borderRadius must be numeric",
      request,
      {
        cardIndex,
        valueType: describeValueType(borderRadiusValue),
      },
    );
    return apiErrorResponse(request, 400, "Invalid data", {
      category: "invalid_data",
      retryable: false,
    });
  }

  if (!validateBorderRadius(borderRadiusValue)) {
    logValidationWarning(endpoint, "Card borderRadius out of range", request, {
      cardIndex,
    });
    return apiErrorResponse(request, 400, "Invalid data", {
      category: "invalid_data",
      retryable: false,
    });
  }

  return null;
}

function validateCardOptionalFields(
  card: Record<string, unknown>,
  cardIndex: number,
  endpoint: string,
  request?: Request,
): NextResponse<ApiError> | null {
  const boolError = validateOptionalBooleanFields(
    card,
    cardIndex,
    endpoint,
    request,
  );
  if (boolError) {
    return boolError;
  }

  const borderColorError = validateOptionalBorderColorField(
    card,
    cardIndex,
    endpoint,
    request,
  );
  if (borderColorError) {
    return borderColorError;
  }

  const hasBorder = card.borderColor !== undefined && card.borderColor !== null;
  const borderRadiusError = validateBorderRadiusField(
    card.borderRadius,
    cardIndex,
    endpoint,
    { requireValue: hasBorder },
    request,
  );
  if (borderRadiusError) {
    return borderRadiusError;
  }

  const gridColsError = validateGridNumericField(
    card.gridCols,
    cardIndex,
    "gridCols",
    endpoint,
    request,
  );
  if (gridColsError) {
    return gridColsError;
  }

  const gridRowsError = validateGridNumericField(
    card.gridRows,
    cardIndex,
    "gridRows",
    endpoint,
    request,
  );
  if (gridRowsError) {
    return gridRowsError;
  }

  return null;
}

function validateUserIdField(
  userId: unknown,
  endpoint: string,
  request?: Request,
): NextResponse<ApiError> | null {
  const parsed = z.coerce.number().int().positive().safeParse(userId);
  if (parsed.success) {
    return null;
  }

  if (userId === undefined || userId === null) {
    logValidationWarning(endpoint, "Missing userId", request);
  } else {
    logValidationWarning(endpoint, "Invalid userId format", request, {
      valueType: describeValueType(userId),
    });
  }

  return apiErrorResponse(request, 400, "Invalid data", {
    category: "invalid_data",
    retryable: false,
  });
}

function validateCardsArrayField(
  cards: unknown,
  endpoint: string,
  request?: Request,
): NextResponse<ApiError> | null {
  if (Array.isArray(cards)) {
    return null;
  }

  logValidationWarning(endpoint, "Cards must be an array", request, {
    valueType: describeValueType(cards),
  });
  return apiErrorResponse(request, 400, "Invalid data", {
    category: "invalid_data",
    retryable: false,
  });
}

function collectUniqueAndUnknownCardNames(
  cards: unknown[],
  supportedNames: Set<string>,
): { uniqueSupportedNames: Set<string>; unknownNames: Set<string> } {
  const uniqueSupportedNames = new Set<string>();
  const unknownNames = new Set<string>();

  for (const card of cards) {
    if (typeof card !== "object" || card === null) {
      continue;
    }

    const name = (card as Record<string, unknown>).cardName;
    if (typeof name !== "string" || name.length === 0) {
      continue;
    }

    if (supportedNames.has(name)) {
      uniqueSupportedNames.add(name);
    } else {
      unknownNames.add(name);
    }
  }

  return { uniqueSupportedNames, unknownNames };
}

function levenshteinDistance(a: string, b: string): number {
  const matrix = Array.from({ length: a.length + 1 }, () =>
    new Array<number>(b.length + 1).fill(0),
  );

  for (let index = 0; index <= a.length; index += 1) {
    matrix[index][0] = index;
  }
  for (let index = 0; index <= b.length; index += 1) {
    matrix[0][index] = index;
  }

  for (let i = 1; i <= a.length; i += 1) {
    for (let j = 1; j <= b.length; j += 1) {
      const substitutionCost = a[i - 1] === b[j - 1] ? 0 : 1;
      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1,
        matrix[i][j - 1] + 1,
        matrix[i - 1][j - 1] + substitutionCost,
      );
    }
  }

  return matrix[a.length][b.length];
}

function buildLevenshteinSuggestions(
  unknownNames: Set<string>,
  supportedNames: string[],
  maxDistance = 3,
  topN = 3,
): Record<string, string[]> {
  const suggestions: Record<string, string[]> = {};

  for (const unknown of unknownNames) {
    const candidates = supportedNames
      .map((candidate) => ({
        candidate,
        distance: levenshteinDistance(unknown, candidate),
      }))
      .sort((left, right) => left.distance - right.distance)
      .slice(0, topN)
      .filter((entry) => entry.distance <= maxDistance)
      .map((entry) => entry.candidate);

    if (candidates.length > 0) {
      suggestions[unknown] = candidates;
    }
  }

  return suggestions;
}

function validateUniqueCardTypes(
  cards: unknown[],
  endpoint: string,
  request?: Request,
): NextResponse<ApiError & Record<string, unknown>> | null {
  const supportedNames = new Set<string>(Object.keys(displayNames));
  const { uniqueSupportedNames, unknownNames } =
    collectUniqueAndUnknownCardNames(cards, supportedNames);
  const maxAllowedCards = Math.max(33, supportedNames.size || 33);

  if (unknownNames.size > 0) {
    logValidationWarning(endpoint, "Invalid card types provided", request, {
      invalidCount: unknownNames.size,
    });

    return apiErrorResponse(request, 400, "Invalid data: Invalid card type", {
      category: "invalid_data",
      retryable: false,
      additionalFields: {
        invalidCardNames: [...unknownNames],
        suggestions: buildLevenshteinSuggestions(unknownNames, [
          ...supportedNames,
        ]),
      },
    });
  }

  if (uniqueSupportedNames.size > maxAllowedCards) {
    logValidationWarning(
      endpoint,
      "Too many unique card types provided",
      request,
      {
        count: uniqueSupportedNames.size,
        maxAllowedCards,
      },
    );
    return apiErrorResponse(
      request,
      400,
      `Too many cards provided: ${uniqueSupportedNames.size} (max ${maxAllowedCards})`,
      {
        category: "invalid_data",
        retryable: false,
      },
    );
  }

  return null;
}

function validateCardsItems(
  cards: unknown[],
  endpoint: string,
  request?: Request,
): NextResponse<ApiError> | null {
  for (let index = 0; index < cards.length; index += 1) {
    const card = cards[index];
    if (typeof card !== "object" || card === null) {
      logValidationWarning(
        endpoint,
        "Card item is not a valid object",
        request,
        {
          cardIndex: index,
          valueType: describeValueType(card),
        },
      );
      return apiErrorResponse(request, 400, "Invalid data", {
        category: "invalid_data",
        retryable: false,
      });
    }

    const cardRecord = card as Record<string, unknown>;
    const requiredFieldError = validateCardRequiredFields(
      cardRecord,
      index,
      endpoint,
      request,
    );
    if (requiredFieldError) {
      return requiredFieldError;
    }

    const optionalFieldError = validateCardOptionalFields(
      cardRecord,
      index,
      endpoint,
      request,
    );
    if (optionalFieldError) {
      return optionalFieldError;
    }
  }

  return null;
}

export type ValidateCardDataResult =
  | { success: true; cards: StoredCardConfig[] }
  | {
      success: false;
      error: NextResponse<ApiError | (ApiError & Record<string, unknown>)>;
    };

export function validateCardData(
  cards: unknown,
  userId: unknown,
  endpoint: string,
  request?: Request,
): ValidateCardDataResult {
  const userIdError = validateUserIdField(userId, endpoint, request);
  if (userIdError) {
    return { success: false, error: userIdError };
  }

  const cardsArrayError = validateCardsArrayField(cards, endpoint, request);
  if (cardsArrayError) {
    return { success: false, error: cardsArrayError };
  }

  const schemaResult = z.array(storedCardConfigInputSchema).safeParse(cards);
  if (!schemaResult.success) {
    return {
      success: false,
      error: apiErrorResponse(request, 400, "Invalid data", {
        category: "invalid_data",
        retryable: false,
      }),
    };
  }

  const cardsArray = schemaResult.data as unknown[];
  const uniqueError = validateUniqueCardTypes(cardsArray, endpoint, request);
  if (uniqueError) {
    return { success: false, error: uniqueError };
  }

  const itemsError = validateCardsItems(cardsArray, endpoint, request);
  if (itemsError) {
    return { success: false, error: itemsError };
  }

  const typedCards: StoredCardConfig[] = cardsArray.map((card) => {
    const record = card as Record<string, unknown>;
    const coerceNumber = (value: unknown): number | undefined => {
      if (value === undefined || value === null) {
        return undefined;
      }

      const parsed = Number(value);
      return Number.isFinite(parsed) ? parsed : undefined;
    };

    return {
      cardName: coerceToString(record.cardName),
      variation:
        typeof record.variation === "string" && record.variation.length > 0
          ? record.variation
          : undefined,
      colorPreset:
        typeof record.colorPreset === "string" && record.colorPreset.length > 0
          ? record.colorPreset
          : undefined,
      titleColor: record.titleColor as StoredCardConfig["titleColor"],
      backgroundColor:
        record.backgroundColor as StoredCardConfig["backgroundColor"],
      textColor: record.textColor as StoredCardConfig["textColor"],
      circleColor: record.circleColor as StoredCardConfig["circleColor"],
      borderColor:
        record.borderColor !== undefined && record.borderColor !== null
          ? (record.borderColor as StoredCardConfig["borderColor"])
          : undefined,
      borderRadius: coerceNumber(record.borderRadius),
      showFavorites:
        typeof record.showFavorites === "boolean"
          ? record.showFavorites
          : undefined,
      useStatusColors:
        typeof record.useStatusColors === "boolean"
          ? record.useStatusColors
          : undefined,
      showPiePercentages:
        typeof record.showPiePercentages === "boolean"
          ? record.showPiePercentages
          : undefined,
      gridCols: coerceNumber(record.gridCols),
      gridRows: coerceNumber(record.gridRows),
      useCustomSettings:
        typeof record.useCustomSettings === "boolean"
          ? record.useCustomSettings
          : undefined,
      disabled:
        typeof record.disabled === "boolean" ? record.disabled : undefined,
    };
  });

  return { success: true, cards: typedCards };
}

export function validateStoreCardsStatsData(
  statsData: unknown,
):
  | { success: true; data: UserStatsData | Record<string, never> | undefined }
  | { success: false; errorMessage: string; issue?: string } {
  if (statsData === undefined) {
    return { success: true, data: undefined };
  }

  if (isPlainObject(statsData)) {
    const statsError = statsData.error;
    if (statsError !== undefined) {
      return {
        success: false,
        errorMessage: safeStringifyValue(statsError),
      };
    }

    if (Object.keys(statsData).length === 0) {
      return { success: true, data: {} };
    }

    const parsed = userStatsDataSchema.safeParse(statsData);
    if (!parsed.success) {
      return {
        success: false,
        errorMessage: "Invalid stats payload",
        issue: getSchemaValidationIssueSummary(parsed.error),
      };
    }

    return {
      success: true,
      data: parsed.data,
    };
  }

  return {
    success: false,
    errorMessage: "Invalid stats payload",
    issue: "statsData must be an object when provided",
  };
}

export function validatePersistedUserRecord(record: PersistedUserRecord) {
  return persistedUserRecordSchema.safeParse(record);
}

export function getSchemaValidationIssueSummary(error: z.ZodError): string {
  const issue = error.issues[0];
  if (!issue) {
    return "Unknown schema validation error";
  }

  const path = issue.path.length > 0 ? issue.path.join(".") : "root";
  return `${path}: ${issue.message}`;
}
