/**
 * Redis persistence helpers for split user-record storage.
 *
 * User data is stored in coarse-grained parts instead of one large blob so card
 * rendering can fetch only the sections each card needs, while still supporting
 * reconstruction and legacy-record migration when older keys are encountered.
 */
import { randomUUID } from "node:crypto";

import { redisClient } from "@/lib/api/clients";
import {
  buildPersistedRequestMetadata,
  logPrivacySafe,
} from "@/lib/api/logging";
import { parseStrictPositiveInteger } from "@/lib/api/primitives";
import { scheduleTelemetryTask } from "@/lib/api/telemetry";
import {
  AnimeGenreSynergyTotalsEntry,
  FollowersPage,
  FollowingPage,
  MediaListCollection,
  PersistedRequestMetadata,
  PersistedUserRecord,
  PublicUserRecord,
  PublicUserRecordMetadata,
  ReconstructedUserRecord,
  ReviewsPage,
  SeasonalPreferenceTotalsEntry,
  SourceMaterialDistributionTotalsEntry,
  StudioCollaborationTotalsEntry,
  ThreadCommentsPage,
  ThreadsPage,
  USER_AGGREGATE_KEYS,
  UserAggregateKey,
  UserAvatar,
  UserBootstrapRecord,
  UserPayloadCompleteness,
  UserRecommendationsPage,
  UserRecord,
  UserReviewsPage,
  UserSection,
  UserSnapshotRef,
  UserStatsData,
} from "@/lib/types/records";
import { safeParse } from "@/lib/utils";

export type UserDataPart =
  | "meta"
  | "activity"
  | "favourites"
  | "statistics"
  | "pages"
  | "planning"
  | "current"
  | "rewatched"
  | "completed"
  | "aggregates";

export const getUserDataKey = (userId: string | number, part: UserDataPart) =>
  `user:${userId}:${part}`;

export const ALL_USER_DATA_PARTS: readonly UserDataPart[] = [
  "meta",
  "activity",
  "favourites",
  "statistics",
  "pages",
  "planning",
  "current",
  "rewatched",
  "completed",
  "aggregates",
];

export const USER_BOOTSTRAP_DATA_PARTS: readonly UserDataPart[] = ["meta"];

const OPTIONAL_USER_DATA_PARTS = new Set<UserDataPart>(["aggregates"]);
const USER_STORAGE_FORMAT = "split-user-v2";
export const USER_RECORD_SCHEMA_VERSION = 2;
const USER_COMMITTED_READ_SHAPE = "committed-user-snapshot-v1";
const USER_REFRESH_INDEX_KEY = "users:stale-by-updated-at";
const USER_REFRESH_REGISTRY_KEY = "users:known-ids";
const USER_LIFECYCLE_AUDIT_KEY = "telemetry:user-lifecycle-audit:v1";
const MAX_USER_LIFECYCLE_AUDIT_EVENTS = 250;
const USER_LIFECYCLE_AUDIT_RETENTION_SECONDS = 14 * 24 * 60 * 60;
const USER_LIFECYCLE_AUDIT_RETENTION_MS =
  USER_LIFECYCLE_AUDIT_RETENTION_SECONDS * 1000;
const USER_REFRESH_INDEX_REPAIR_BATCH_SIZE = 25;
const LEGACY_USER_MIGRATION_LOCK_TTL_SECONDS = 30;
const USER_BOUNDED_SECTIONS = [
  "activity",
  "favourites",
  "pages",
  "planning",
  "current",
  "rewatched",
  "completed",
] as const;

const getUserCommitKey = (userId: string | number) => `user:${userId}:commit`;
const getLegacyUserMigrationLockKey = (userId: string | number) =>
  `user:${userId}:migrating`;
const getCardsRecordKey = (userId: string | number) => `cards:${userId}`;
const getCardsRecordMetaKey = (userId: string | number) =>
  `cards:${userId}:meta`;
const getUserUsernameAliasSetKey = (userId: string | number) =>
  `user:${userId}:username-aliases`;
const getUsernameIndexKey = (normalizedUsername: string) =>
  `username:${normalizedUsername}`;
const getUserSnapshotKeyPrefix = (
  userId: string | number,
  snapshotToken: string,
) => `user:${userId}:snapshot:${snapshotToken}`;
const getUserSnapshotPartKey = (
  snapshotKeyPrefix: string,
  part: UserDataPart,
) => `${snapshotKeyPrefix}:${part}`;

interface UserCommitPointer {
  userId: string;
  storageFormat: typeof USER_STORAGE_FORMAT;
  readShape?: string;
  schemaVersion: number;
  revision: number;
  createdAt: string;
  updatedAt: string;
  username?: string;
  usernameNormalized?: string;
  committedAt: string;
  snapshotToken?: string;
  snapshotKeyPrefix?: string;
  retainedSnapshotToken?: string;
  retainedSnapshotKeyPrefix?: string;
  retainedRevision?: number;
  retainedUpdatedAt?: string;
  retainedCommittedAt?: string;
  previousSnapshotToken?: string;
  previousSnapshotKeyPrefix?: string;
  previousRevision?: number;
  previousUpdatedAt?: string;
  previousCommittedAt?: string;
  completeness?: UserPayloadCompleteness;
  retainedCompleteness?: UserPayloadCompleteness;
  previousCompleteness?: UserPayloadCompleteness;
}

export interface PersistedUserState {
  userId: string;
  storageFormat: "split" | "legacy";
  schemaVersion: number;
  revision: number;
  createdAt?: string;
  updatedAt?: string;
  username?: string;
  normalizedUsername?: string;
  committedAt?: string;
  snapshot?: UserSnapshotRef;
  completeness?: UserPayloadCompleteness;
}

export interface UserDataReadResult {
  parts: Partial<Record<UserDataPart, unknown>>;
  state: PersistedUserState | null;
  snapshotMatched: boolean;
}

export type UserLifecycleAuditAction = "access" | "delete" | "save";

export type UserLifecycleAuditTriggerSource =
  | "cron_cleanup_404"
  | "cron_refresh"
  | "legacy_migration"
  | "legacy_split_rewrite"
  | "user_data_delete"
  | "user_data_fetch"
  | "user_data_save";

interface UserLifecycleAuditEntry {
  action: UserLifecycleAuditAction;
  expiresAt?: string;
  timestamp: string;
  triggerSource: UserLifecycleAuditTriggerSource;
  userId: string;
}

export class UserDataIntegrityError extends Error {
  readonly kind = "corrupt" as const;
  readonly userId: string;
  readonly statusCode = 500 as const;
  readonly category = "server_error" as const;
  readonly retryable = false;
  readonly publicMessage = "Stored user record is incomplete or corrupted";

  constructor(userId: string | number, message: string) {
    super(message);
    this.name = "UserDataIntegrityError";
    this.userId = String(userId);
  }
}

export class UserRecordConflictError extends Error {
  readonly kind = "conflict" as const;
  readonly userId: string;
  readonly statusCode = 409 as const;
  readonly category = "invalid_data" as const;
  readonly retryable = false;
  readonly publicMessage =
    "Conflict: data was updated elsewhere. Please reload and try again.";
  readonly currentUpdatedAt?: string;
  readonly currentRevision?: number;
  readonly currentSnapshotToken?: string;

  constructor(
    userId: string | number,
    message = "Conflict: data was updated elsewhere. Please reload and try again.",
    options?: {
      currentRevision?: number;
      currentSnapshotToken?: string;
      currentUpdatedAt?: string;
    },
  ) {
    super(message);
    this.name = "UserRecordConflictError";
    this.userId = String(userId);
    this.currentUpdatedAt = options?.currentUpdatedAt;
    this.currentRevision = options?.currentRevision;
    this.currentSnapshotToken = options?.currentSnapshotToken;
  }
}

export class UserRecordUsernameConflictError extends Error {
  readonly kind = "username_conflict" as const;
  readonly userId: string;
  readonly statusCode = 409 as const;
  readonly category = "invalid_data" as const;
  readonly retryable = false;
  readonly publicMessage =
    "Conflict: username is already bound to another stored user.";
  readonly conflictingUserId?: string;

  constructor(
    userId: string | number,
    message = "Conflict: username is already bound to another stored user.",
    options?: { conflictingUserId?: string },
  ) {
    super(message);
    this.name = "UserRecordUsernameConflictError";
    this.userId = String(userId);
    this.conflictingUserId = options?.conflictingUserId;
  }
}

type RedisSortedSetEntry = {
  score: number;
  member: string;
};

type RedisSortedSetClient = {
  zadd: (key: string, ...entries: RedisSortedSetEntry[]) => Promise<unknown>;
  zrange: (key: string, start: number, stop: number) => Promise<string[]>;
  zcard: (key: string) => Promise<number>;
  zrem: (key: string, ...members: string[]) => Promise<unknown>;
};

type RedisSetClient = {
  sadd: (key: string, ...members: string[]) => Promise<unknown>;
  smembers: (key: string) => Promise<string[]>;
  srem: (key: string, ...members: string[]) => Promise<unknown>;
};

type RedisPipeline = {
  set: (key: string, value: string) => RedisPipeline;
  del: (...keys: string[]) => RedisPipeline;
  sadd: (key: string, ...members: string[]) => RedisPipeline;
  zadd: (key: string, ...entries: RedisSortedSetEntry[]) => RedisPipeline;
  exec: () => Promise<unknown>;
};

const redisSortedSetClient = redisClient as unknown as RedisSortedSetClient;
const redisSetClient = redisClient as unknown as RedisSetClient;

interface UserMeta {
  userId: string;
  username?: string;
  createdAt: string;
  updatedAt: string;
  schemaVersion?: number;
  revision?: number;
  storageFormat?: string;
  usernameNormalized?: string;
  requestMetadata?: PersistedRequestMetadata;
  name?: string;
  avatar?: UserAvatar;
  userCreatedAt?: number;
}

interface UserAggregates {
  animeSourceMaterialDistributionTotals?: SourceMaterialDistributionTotalsEntry[];
  animeSeasonalPreferenceTotals?: SeasonalPreferenceTotalsEntry[];
  animeGenreSynergyTotals?: AnimeGenreSynergyTotalsEntry[];
  studioCollaborationTotals?: StudioCollaborationTotalsEntry[];
}

export interface DeleteUserRecordResult {
  deletedKeys: string[];
  usernameIndexKeys: string[];
}

interface UserRefreshIndexRepairResult {
  indexedUserCount: number;
  prunedRegistryUserIds: string[];
  removedIndexedUserIds: string[];
  repairedUserIds: string[];
}

/* Helpers and defaults for extracting data from loosely-typed legacy shapes. */

/** Returns true if value is a non-null object */
function isObject(v: unknown): v is Record<string, unknown> {
  return v !== null && typeof v === "object";
}

/** Safely read a property from a record */
function getProp(obj: unknown, key: string): unknown {
  if (!isObject(obj)) return undefined;
  // `isObject` narrows `obj` to a Record<string, unknown> so we can index directly
  return obj[key];
}

function getStringProp(obj: unknown, key: string): string | undefined {
  const v = getProp(obj, key);
  return typeof v === "string" ? v : undefined;
}

function getNumberProp(obj: unknown, key: string): number | undefined {
  const v = getProp(obj, key);
  return typeof v === "number" ? v : undefined;
}

const DEFAULT_FOLLOWERS_PAGE: FollowersPage = {
  pageInfo: { total: 0 },
  followers: [],
};
const DEFAULT_FOLLOWING_PAGE: FollowingPage = {
  pageInfo: { total: 0 },
  following: [],
};
const DEFAULT_THREADS_PAGE: ThreadsPage = {
  pageInfo: { total: 0 },
  threads: [],
};
const DEFAULT_THREAD_COMMENTS_PAGE: ThreadCommentsPage = {
  pageInfo: { total: 0 },
  threadComments: [],
};
const DEFAULT_REVIEWS_PAGE: ReviewsPage = {
  pageInfo: { total: 0 },
  reviews: [],
};

function normalizeStoredUserIdForPublicDto(
  userId: string | number | undefined,
): number {
  if (typeof userId === "number") {
    if (Number.isSafeInteger(userId) && userId > 0) {
      return userId;
    }
  }

  const parsedUserId =
    typeof userId === "string" ? parseStrictPositiveInteger(userId) : null;
  if (parsedUserId) {
    return parsedUserId;
  }

  throw new UserDataIntegrityError(
    typeof userId === "string" || typeof userId === "number"
      ? userId
      : "unknown",
    "Stored user record has invalid userId",
  );
}

/** Extract statistics block from raw shapes */
function extractStatistics(
  statsObj: unknown,
  userObj?: Record<string, unknown>,
): Record<string, unknown> {
  if (isObject(userObj) && isObject(getProp(userObj, "statistics"))) {
    return getProp(userObj, "statistics") as Record<string, unknown>;
  }

  if (
    isObject(statsObj) &&
    "anime" in statsObj &&
    "manga" in statsObj &&
    isObject(statsObj["anime"]) &&
    isObject(statsObj["manga"])
  ) {
    return {
      anime: statsObj["anime"] as unknown as Record<string, unknown>,
      manga: statsObj["manga"] as unknown as Record<string, unknown>,
    };
  }

  if (isObject(statsObj) && isObject(getProp(statsObj, "statistics"))) {
    return getProp(statsObj, "statistics") as Record<string, unknown>;
  }

  if (
    isObject(statsObj) &&
    Object.keys(statsObj).length > 0 &&
    !("activityHistory" in statsObj)
  ) {
    return statsObj;
  }

  return {};
}

/** Extract activity/stats part */
function extractActivityStats(
  statsObj: unknown,
  userObj?: Record<string, unknown>,
): Record<string, unknown> {
  if (isObject(userObj) && isObject(getProp(userObj, "stats"))) {
    return getProp(userObj, "stats") as Record<string, unknown>;
  }

  const activityHistory =
    isObject(statsObj) &&
    ("activityHistory" in statsObj ? statsObj["activityHistory"] : undefined);
  if (Array.isArray(activityHistory)) {
    return { activityHistory: activityHistory as unknown[] };
  }

  const userActivityHistory =
    isObject(userObj) &&
    ("activityHistory" in userObj ? userObj["activityHistory"] : undefined);
  if (Array.isArray(userActivityHistory)) {
    return { activityHistory: userActivityHistory as unknown[] };
  }

  if (isObject(statsObj) && Object.keys(statsObj).length > 0) {
    return statsObj;
  }

  return {};
}

/** Extract favourites blob from several potential locations */
function extractFavourites(
  record: UserRecord,
  statsObj: unknown,
  userObj?: Record<string, unknown>,
): Record<string, unknown> {
  if (isObject(userObj) && isObject(getProp(userObj, "favourites"))) {
    return getProp(userObj, "favourites") as Record<string, unknown>;
  }

  if (isObject(getProp(record as unknown, "favourites"))) {
    return getProp(record as unknown, "favourites") as Record<string, unknown>;
  }

  if (isObject(getProp(record as unknown, "favorites"))) {
    return getProp(record as unknown, "favorites") as Record<string, unknown>;
  }

  if (isObject(statsObj) && isObject(getProp(statsObj, "favourites"))) {
    return getProp(statsObj, "favourites") as Record<string, unknown>;
  }

  if (isObject(statsObj) && isObject(getProp(statsObj, "favorites"))) {
    return getProp(statsObj, "favorites") as Record<string, unknown>;
  }

  return {};
}

function extractPageOrDefault<T>(
  statsObj: unknown,
  key: string,
  fallback: T,
): T {
  const value = isObject(statsObj) ? statsObj[key] : undefined;
  return isObject(value) ? (value as unknown as T) : fallback;
}

function extractOptionalArrayContainer<T>(
  statsObj: unknown,
  key: string,
  itemsKey: string,
): T | undefined {
  const value = isObject(statsObj) ? statsObj[key] : undefined;
  if (!isObject(value)) return undefined;
  const items = value[itemsKey];
  return Array.isArray(items) ? (value as unknown as T) : undefined;
}

/** Extract pages and list-like containers safely */
function extractPages(statsObj: unknown) {
  const followersPage = extractPageOrDefault<FollowersPage>(
    statsObj,
    "followersPage",
    DEFAULT_FOLLOWERS_PAGE,
  );
  const followingPage = extractPageOrDefault<FollowingPage>(
    statsObj,
    "followingPage",
    DEFAULT_FOLLOWING_PAGE,
  );
  const threadsPage = extractPageOrDefault<ThreadsPage>(
    statsObj,
    "threadsPage",
    DEFAULT_THREADS_PAGE,
  );
  const threadCommentsPage = extractPageOrDefault<ThreadCommentsPage>(
    statsObj,
    "threadCommentsPage",
    DEFAULT_THREAD_COMMENTS_PAGE,
  );
  const reviewsPage = extractPageOrDefault<ReviewsPage>(
    statsObj,
    "reviewsPage",
    DEFAULT_REVIEWS_PAGE,
  );

  const userReviews = extractOptionalArrayContainer<UserReviewsPage>(
    statsObj,
    "userReviews",
    "reviews",
  );
  const userRecommendations =
    extractOptionalArrayContainer<UserRecommendationsPage>(
      statsObj,
      "userRecommendations",
      "recommendations",
    );

  return {
    followersPage,
    followingPage,
    threadsPage,
    threadCommentsPage,
    reviewsPage,
    ...(userReviews ? { userReviews } : {}),
    ...(userRecommendations ? { userRecommendations } : {}),
  };
}

/** Extract a MediaListCollection-like object from a stats container. */
function extractMediaListCollection(
  statsObj: unknown,
  key: string,
): MediaListCollection | undefined {
  if (!isObject(statsObj)) return undefined;
  const value = statsObj[key];
  return isObject(value)
    ? (value as unknown as MediaListCollection)
    : undefined;
}

function normalizePersistedRequestMetadata(
  value: unknown,
): PersistedRequestMetadata | undefined {
  if (!isObject(value)) {
    return undefined;
  }

  const lastSeenIpBucket = getStringProp(value, "lastSeenIpBucket")?.trim();
  if (!lastSeenIpBucket) {
    return undefined;
  }

  return { lastSeenIpBucket };
}

export function normalizeUsernameIndexValue(
  value: unknown,
): string | undefined {
  if (typeof value !== "string") {
    return undefined;
  }

  const normalized = value.trim().toLowerCase();
  return normalized.length > 0 ? normalized : undefined;
}

function normalizeUserAggregateKeyArray(value: unknown): UserAggregateKey[] {
  if (!Array.isArray(value)) {
    return [];
  }

  const normalized = new Set<UserAggregateKey>();

  value.forEach((candidate) => {
    if (
      typeof candidate === "string" &&
      USER_AGGREGATE_KEYS.includes(candidate as UserAggregateKey)
    ) {
      normalized.add(candidate as UserAggregateKey);
    }
  });

  return [...normalized];
}

function getAvailableUserAggregateKeysFromValue(
  value: unknown,
): UserAggregateKey[] {
  if (!isObject(value)) {
    return [];
  }

  return USER_AGGREGATE_KEYS.filter((key) => {
    const aggregateValue = value[key];
    return Array.isArray(aggregateValue) && aggregateValue.length > 0;
  });
}

function buildDefaultUserPayloadCompleteness(): UserPayloadCompleteness {
  return {
    sampled: true,
    fullHistory: false,
    boundedSections: [...USER_BOUNDED_SECTIONS],
    availableAggregates: [],
    missingAggregates: [...USER_AGGREGATE_KEYS],
  };
}

function buildUserPayloadCompletenessFromParts(
  parts: Partial<Record<UserDataPart, unknown>>,
): UserPayloadCompleteness {
  const availableAggregates = getAvailableUserAggregateKeysFromValue(
    parts.aggregates,
  );
  const availableAggregateSet = new Set<UserAggregateKey>(availableAggregates);

  return {
    sampled: true,
    fullHistory: false,
    boundedSections: [...USER_BOUNDED_SECTIONS],
    availableAggregates,
    missingAggregates: USER_AGGREGATE_KEYS.filter(
      (key) => !availableAggregateSet.has(key),
    ),
  };
}

function normalizeUserPayloadCompleteness(
  value: unknown,
): UserPayloadCompleteness | undefined {
  if (!isObject(value)) {
    return undefined;
  }

  const availableAggregates = normalizeUserAggregateKeyArray(
    value.availableAggregates,
  );
  const availableAggregateSet = new Set<UserAggregateKey>(availableAggregates);
  const explicitMissingAggregates = normalizeUserAggregateKeyArray(
    value.missingAggregates,
  );
  const boundedSections = Array.isArray(value.boundedSections)
    ? Array.from(
        new Set(
          value.boundedSections.flatMap((section) => {
            if (typeof section !== "string") {
              return [];
            }

            const trimmed = section.trim();
            return trimmed.length > 0 ? [trimmed] : [];
          }),
        ),
      )
    : [];

  return {
    sampled: value.sampled !== false,
    fullHistory: false,
    boundedSections:
      boundedSections.length > 0 ? boundedSections : [...USER_BOUNDED_SECTIONS],
    availableAggregates,
    missingAggregates:
      explicitMissingAggregates.length > 0
        ? explicitMissingAggregates
        : USER_AGGREGATE_KEYS.filter((key) => !availableAggregateSet.has(key)),
  };
}

function buildPublicUserRecordMetadata(
  state: PersistedUserState | null | undefined,
): PublicUserRecordMetadata | undefined {
  if (!state) {
    return undefined;
  }

  let storageFormat: PublicUserRecordMetadata["storageFormat"];
  if (state.storageFormat === "legacy") {
    storageFormat = "legacy";
  } else if (state.snapshot) {
    storageFormat = "committed-split";
  } else {
    storageFormat = "legacy-split";
  }

  return {
    storageFormat,
    schemaVersion: state.schemaVersion,
    ...(state.snapshot ? { snapshot: state.snapshot } : {}),
    completeness: state.completeness ?? buildDefaultUserPayloadCompleteness(),
  };
}

async function readTrackedUserIds(): Promise<string[]> {
  const storedUserIds = await redisSetClient.smembers(
    USER_REFRESH_REGISTRY_KEY,
  );

  return Array.from(
    new Set(
      (Array.isArray(storedUserIds) ? storedUserIds : [])
        .map(String)
        .filter((candidate) => /^\d+$/.test(candidate)),
    ),
  );
}

function isOptionalUserDataPart(part: UserDataPart): boolean {
  return OPTIONAL_USER_DATA_PARTS.has(part);
}

function getUpdatedAtScore(updatedAt: string | undefined): number {
  if (!updatedAt) {
    return 0;
  }

  const parsed = Date.parse(updatedAt);
  return Number.isNaN(parsed) ? 0 : parsed;
}

function parseLifecycleAuditTimestamp(
  value: string | undefined,
): number | null {
  if (!value) {
    return null;
  }

  const parsed = Date.parse(value);
  return Number.isNaN(parsed) ? null : parsed;
}

function parseUserLifecycleAuditEntry(
  value: unknown,
): UserLifecycleAuditEntry | undefined {
  let parsedValue = value;

  if (typeof parsedValue === "string") {
    try {
      parsedValue = JSON.parse(parsedValue) as unknown;
    } catch {
      return undefined;
    }
  }

  if (!isObject(parsedValue)) {
    return undefined;
  }

  if (
    typeof parsedValue.action !== "string" ||
    typeof parsedValue.timestamp !== "string" ||
    typeof parsedValue.triggerSource !== "string" ||
    typeof parsedValue.userId !== "string" ||
    (parsedValue.expiresAt !== undefined &&
      typeof parsedValue.expiresAt !== "string")
  ) {
    return undefined;
  }

  return {
    action: parsedValue.action as UserLifecycleAuditAction,
    expiresAt:
      typeof parsedValue.expiresAt === "string"
        ? parsedValue.expiresAt
        : undefined,
    timestamp: parsedValue.timestamp,
    triggerSource: parsedValue.triggerSource as UserLifecycleAuditTriggerSource,
    userId: parsedValue.userId,
  };
}

function isUserLifecycleAuditEntryWithinRetentionWindow(
  entry: UserLifecycleAuditEntry,
  now = Date.now(),
): boolean {
  const expiresAtMs = parseLifecycleAuditTimestamp(entry.expiresAt);
  return expiresAtMs === null ? true : expiresAtMs > now;
}

type StoredUserLifecycleAuditEntry = {
  entry: UserLifecycleAuditEntry;
  serialized: string;
};

function toStoredUserLifecycleAuditEntry(
  value: unknown,
): StoredUserLifecycleAuditEntry | undefined {
  const entry = parseUserLifecycleAuditEntry(value);
  if (!entry) {
    return undefined;
  }

  return {
    entry,
    serialized: typeof value === "string" ? value : JSON.stringify(entry),
  };
}

function shouldRewriteUserLifecycleAuditEntries(
  currentEntries: unknown[],
  nextEntries: StoredUserLifecycleAuditEntry[],
): boolean {
  const serializedCurrentEntries = currentEntries.map((entry) =>
    typeof entry === "string" ? entry : JSON.stringify(entry),
  );

  return (
    serializedCurrentEntries.length !== nextEntries.length ||
    serializedCurrentEntries.some(
      (entry, index) => entry !== nextEntries[index]?.serialized,
    )
  );
}

async function rewriteUserLifecycleAuditEntries(
  entries: StoredUserLifecycleAuditEntry[],
): Promise<void> {
  await redisClient.del(USER_LIFECYCLE_AUDIT_KEY);

  for (const entry of entries) {
    await redisClient.rpush(USER_LIFECYCLE_AUDIT_KEY, entry.serialized);
  }

  if (entries.length > 0) {
    await redisClient.expire(
      USER_LIFECYCLE_AUDIT_KEY,
      USER_LIFECYCLE_AUDIT_RETENTION_SECONDS,
    );
  }
}

async function pruneUserLifecycleAuditEntries(): Promise<void> {
  const rawEntries = await redisClient.lrange(USER_LIFECYCLE_AUDIT_KEY, 0, -1);
  const currentEntries = Array.isArray(rawEntries) ? rawEntries : [];
  const now = Date.now();
  const nextEntries = currentEntries
    .flatMap((value) => {
      const parsedEntry = toStoredUserLifecycleAuditEntry(value);
      if (!parsedEntry) {
        return [];
      }

      return isUserLifecycleAuditEntryWithinRetentionWindow(
        parsedEntry.entry,
        now,
      )
        ? [parsedEntry]
        : [];
    })
    .slice(-MAX_USER_LIFECYCLE_AUDIT_EVENTS);

  if (shouldRewriteUserLifecycleAuditEntries(currentEntries, nextEntries)) {
    await rewriteUserLifecycleAuditEntries(nextEntries);
  } else if (nextEntries.length > 0) {
    await redisClient.expire(
      USER_LIFECYCLE_AUDIT_KEY,
      USER_LIFECYCLE_AUDIT_RETENTION_SECONDS,
    );
  }
}

async function appendUserLifecycleAuditEntry(entry: UserLifecycleAuditEntry) {
  try {
    await pruneUserLifecycleAuditEntries();
    await redisClient.rpush(USER_LIFECYCLE_AUDIT_KEY, JSON.stringify(entry));
    await redisClient.ltrim(
      USER_LIFECYCLE_AUDIT_KEY,
      -MAX_USER_LIFECYCLE_AUDIT_EVENTS,
      -1,
    );
    await redisClient.expire(
      USER_LIFECYCLE_AUDIT_KEY,
      USER_LIFECYCLE_AUDIT_RETENTION_SECONDS,
    );
  } catch (error) {
    logPrivacySafe(
      "warn",
      "User Data",
      "Failed to persist user lifecycle audit event",
      {
        action: entry.action,
        error: error instanceof Error ? error.message : String(error),
        triggerSource: entry.triggerSource,
        userId: entry.userId,
      },
    );
  }
}

async function auditUserLifecycleEvent(options: {
  action: UserLifecycleAuditAction;
  triggerSource: UserLifecycleAuditTriggerSource;
  userId: string | number;
}) {
  await appendUserLifecycleAuditEntry({
    action: options.action,
    expiresAt: new Date(
      Date.now() + USER_LIFECYCLE_AUDIT_RETENTION_MS,
    ).toISOString(),
    timestamp: new Date().toISOString(),
    triggerSource: options.triggerSource,
    userId: String(options.userId),
  });
}

function scheduleUserLifecycleAuditEvent(options: {
  action: UserLifecycleAuditAction;
  triggerSource: UserLifecycleAuditTriggerSource;
  userId: string | number;
}): void {
  scheduleTelemetryTask(() => auditUserLifecycleEvent(options), {
    endpoint: "User Data",
    taskName: `user-lifecycle-audit:${options.action}:${options.triggerSource}`,
  });
}

function logIntegrityFailure(
  userId: string | number,
  message: string,
  context?: Record<string, unknown>,
): UserDataIntegrityError {
  logPrivacySafe("error", "User Data", message, {
    userId,
    ...context,
  });

  return new UserDataIntegrityError(userId, message);
}

function safeParseStoredJson<T>(
  raw: unknown,
  userId: string | number,
  context: string,
): T {
  try {
    return safeParse<T>(raw, context);
  } catch {
    throw logIntegrityFailure(userId, "Stored user payload is not valid JSON", {
      context,
    });
  }
}

function isValidUserDataPartPayload(
  part: UserDataPart,
  value: unknown,
): boolean {
  if (part === "statistics") {
    return value === null || isObject(value);
  }

  return isObject(value);
}

function parseUserDataPartPayload(
  userId: string | number,
  part: UserDataPart,
  raw: unknown,
  storageLabel: string,
): unknown {
  const parsed = safeParseStoredJson<unknown>(
    raw,
    userId,
    `${storageLabel}:${part}`,
  );

  if (!isValidUserDataPartPayload(part, parsed)) {
    throw logIntegrityFailure(userId, "Stored user part has an invalid shape", {
      part,
      storageLabel,
    });
  }

  return parsed;
}

type LoadedUserDataPartsResult = {
  data: Partial<Record<UserDataPart, unknown>>;
  foundAnyRequestedPart: boolean;
  missingRequiredParts: UserDataPart[];
};

async function loadStoredUserDataParts(
  userId: string | number,
  parts: UserDataPart[],
  getKey: (part: UserDataPart) => string,
  storageLabel: string,
): Promise<LoadedUserDataPartsResult> {
  const results = await redisClient.mget(...parts.map((part) => getKey(part)));

  const data: Partial<Record<UserDataPart, unknown>> = {};
  let foundAnyRequestedPart = false;
  const missingRequiredParts: UserDataPart[] = [];

  results.forEach((rawValue, index) => {
    const part = parts[index];

    if (rawValue === null || rawValue === undefined) {
      if (!isOptionalUserDataPart(part)) {
        missingRequiredParts.push(part);
      }
      return;
    }

    foundAnyRequestedPart = true;
    data[part] = parseUserDataPartPayload(userId, part, rawValue, storageLabel);
  });

  return {
    data,
    foundAnyRequestedPart,
    missingRequiredParts,
  };
}

function throwMissingUserDataParts(
  userId: string | number,
  message: string,
  missingRequiredParts: UserDataPart[],
  context?: Record<string, unknown>,
): never {
  throw logIntegrityFailure(userId, message, {
    ...context,
    missingParts: missingRequiredParts.join(","),
  });
}

function buildPersistedUserState(options: {
  userId: string | number;
  storageFormat: PersistedUserState["storageFormat"];
  schemaVersion?: number;
  revision?: number;
  createdAt?: unknown;
  updatedAt?: unknown;
  username?: unknown;
  normalizedUsername?: unknown;
  committedAt?: unknown;
  snapshot?: UserSnapshotRef;
  completeness?: UserPayloadCompleteness;
}): PersistedUserState {
  const username =
    typeof options.username === "string" ? options.username : undefined;
  const normalizedUsername =
    normalizeUsernameIndexValue(options.normalizedUsername) ??
    normalizeUsernameIndexValue(username);

  return {
    userId: String(options.userId),
    storageFormat: options.storageFormat,
    schemaVersion:
      typeof options.schemaVersion === "number" && options.schemaVersion > 0
        ? options.schemaVersion
        : 1,
    revision:
      typeof options.revision === "number" && options.revision > 0
        ? options.revision
        : 0,
    createdAt:
      typeof options.createdAt === "string" && options.createdAt.length > 0
        ? options.createdAt
        : undefined,
    updatedAt:
      typeof options.updatedAt === "string" && options.updatedAt.length > 0
        ? options.updatedAt
        : undefined,
    ...(username ? { username } : {}),
    ...(normalizedUsername ? { normalizedUsername } : {}),
    ...(typeof options.committedAt === "string" &&
    options.committedAt.length > 0
      ? { committedAt: options.committedAt }
      : {}),
    ...(options.snapshot ? { snapshot: options.snapshot } : {}),
    ...(options.completeness ? { completeness: options.completeness } : {}),
  };
}

function buildUserSnapshotRef(options: {
  token?: unknown;
  revision?: unknown;
  updatedAt?: unknown;
  committedAt?: unknown;
}): UserSnapshotRef | undefined {
  const token =
    typeof options.token === "string" && options.token.length > 0
      ? options.token
      : undefined;
  const revision =
    typeof options.revision === "number" && options.revision > 0
      ? options.revision
      : undefined;
  const updatedAt =
    typeof options.updatedAt === "string" && options.updatedAt.length > 0
      ? options.updatedAt
      : undefined;
  const committedAt =
    typeof options.committedAt === "string" && options.committedAt.length > 0
      ? options.committedAt
      : undefined;

  if (!token || !revision || !updatedAt || !committedAt) {
    return undefined;
  }

  return {
    token,
    revision,
    updatedAt,
    committedAt,
  };
}

function getRetainedCommitPointerSnapshot(commitPointer: UserCommitPointer): {
  completeness?: UserPayloadCompleteness;
  committedAt?: string;
  keyPrefix?: string;
  revision?: number;
  snapshotKind: "retained" | "previous" | null;
  token?: string;
  updatedAt?: string;
} {
  const hasRetainedSnapshot = Boolean(
    commitPointer.retainedSnapshotToken ||
    commitPointer.retainedSnapshotKeyPrefix,
  );

  if (hasRetainedSnapshot) {
    return {
      completeness: normalizeUserPayloadCompleteness(
        commitPointer.retainedCompleteness,
      ),
      committedAt: commitPointer.retainedCommittedAt,
      keyPrefix: commitPointer.retainedSnapshotKeyPrefix,
      revision: commitPointer.retainedRevision,
      snapshotKind: "retained",
      token: commitPointer.retainedSnapshotToken,
      updatedAt: commitPointer.retainedUpdatedAt,
    };
  }

  const hasPreviousSnapshot = Boolean(
    commitPointer.previousSnapshotToken ||
    commitPointer.previousSnapshotKeyPrefix,
  );

  if (hasPreviousSnapshot) {
    return {
      completeness: normalizeUserPayloadCompleteness(
        commitPointer.previousCompleteness,
      ),
      committedAt: commitPointer.previousCommittedAt,
      keyPrefix: commitPointer.previousSnapshotKeyPrefix,
      revision: commitPointer.previousRevision,
      snapshotKind: "previous",
      token: commitPointer.previousSnapshotToken,
      updatedAt: commitPointer.previousUpdatedAt,
    };
  }

  return {
    snapshotKind: null,
  };
}

function buildPersistedStateFromCommitPointerSnapshot(
  commitPointer: UserCommitPointer,
  snapshotKind: "current" | "retained" | "previous" = "current",
): PersistedUserState {
  const isCurrentSnapshot = snapshotKind === "current";
  const retainedSnapshot = getRetainedCommitPointerSnapshot(commitPointer);
  const revision = isCurrentSnapshot
    ? commitPointer.revision
    : retainedSnapshot.revision;
  const updatedAt = isCurrentSnapshot
    ? commitPointer.updatedAt
    : retainedSnapshot.updatedAt;
  const committedAt = isCurrentSnapshot
    ? commitPointer.committedAt
    : retainedSnapshot.committedAt;
  const snapshot = buildUserSnapshotRef({
    token: isCurrentSnapshot
      ? commitPointer.snapshotToken
      : retainedSnapshot.token,
    revision,
    updatedAt,
    committedAt,
  });
  const completeness = normalizeUserPayloadCompleteness(
    isCurrentSnapshot
      ? commitPointer.completeness
      : retainedSnapshot.completeness,
  );

  return buildPersistedUserState({
    userId: commitPointer.userId,
    storageFormat: "split",
    schemaVersion: commitPointer.schemaVersion,
    revision,
    createdAt: commitPointer.createdAt,
    updatedAt,
    username: commitPointer.username,
    normalizedUsername: commitPointer.usernameNormalized,
    committedAt,
    snapshot,
    completeness,
  });
}

function readOptionalCommitPointerString(
  value: Record<string, unknown>,
  key: string,
): string | undefined {
  return typeof value[key] === "string" ? value[key] : undefined;
}

function readOptionalCommitPointerPositiveNumber(
  value: Record<string, unknown>,
  key: string,
): number | undefined {
  const candidate = value[key];
  return typeof candidate === "number" && candidate > 0 ? candidate : undefined;
}

function parseUserCommitPointerRecord(
  userId: string | number,
  raw: unknown,
): Record<string, unknown> {
  const parsed = safeParseStoredJson<Record<string, unknown>>(
    raw,
    userId,
    `user-commit:${userId}`,
  );

  if (!isObject(parsed)) {
    throw logIntegrityFailure(userId, "Stored user commit pointer is invalid", {
      key: getUserCommitKey(userId),
    });
  }

  return parsed;
}

function parseUserCommitPointer(
  userId: string | number,
  raw: unknown,
): UserCommitPointer {
  const parsed = parseUserCommitPointerRecord(userId, raw);
  const revision = Number(parsed.revision);
  if (
    parsed.storageFormat !== USER_STORAGE_FORMAT ||
    !Number.isInteger(revision) ||
    revision <= 0
  ) {
    throw logIntegrityFailure(userId, "Stored user commit pointer is invalid", {
      key: getUserCommitKey(userId),
    });
  }

  const parsedUserId =
    typeof parsed.userId === "string" || typeof parsed.userId === "number"
      ? String(parsed.userId)
      : String(userId);

  return {
    userId: parsedUserId,
    storageFormat: USER_STORAGE_FORMAT,
    readShape: readOptionalCommitPointerString(parsed, "readShape"),
    schemaVersion:
      readOptionalCommitPointerPositiveNumber(parsed, "schemaVersion") ??
      USER_RECORD_SCHEMA_VERSION,
    revision,
    createdAt: readOptionalCommitPointerString(parsed, "createdAt") ?? "",
    updatedAt: readOptionalCommitPointerString(parsed, "updatedAt") ?? "",
    username: readOptionalCommitPointerString(parsed, "username"),
    usernameNormalized: normalizeUsernameIndexValue(parsed.usernameNormalized),
    committedAt:
      readOptionalCommitPointerString(parsed, "committedAt") ??
      new Date().toISOString(),
    snapshotToken: readOptionalCommitPointerString(parsed, "snapshotToken"),
    snapshotKeyPrefix: readOptionalCommitPointerString(
      parsed,
      "snapshotKeyPrefix",
    ),
    previousSnapshotToken: readOptionalCommitPointerString(
      parsed,
      "previousSnapshotToken",
    ),
    previousSnapshotKeyPrefix: readOptionalCommitPointerString(
      parsed,
      "previousSnapshotKeyPrefix",
    ),
    previousRevision: readOptionalCommitPointerPositiveNumber(
      parsed,
      "previousRevision",
    ),
    previousUpdatedAt: readOptionalCommitPointerString(
      parsed,
      "previousUpdatedAt",
    ),
    previousCommittedAt: readOptionalCommitPointerString(
      parsed,
      "previousCommittedAt",
    ),
    completeness: normalizeUserPayloadCompleteness(parsed.completeness),
    previousCompleteness: normalizeUserPayloadCompleteness(
      parsed.previousCompleteness,
    ),
  };
}

async function readUserCommitPointer(
  userId: string | number,
): Promise<UserCommitPointer | null> {
  const raw = await redisClient.get(getUserCommitKey(userId));
  if (!raw) {
    return null;
  }

  return parseUserCommitPointer(userId, raw);
}

function buildPersistedStateFromMeta(
  userId: string | number,
  meta: UserMeta & Record<string, unknown>,
  storageFormat: PersistedUserState["storageFormat"],
): PersistedUserState {
  return buildPersistedUserState({
    userId: meta.userId || String(userId),
    storageFormat,
    schemaVersion: meta.schemaVersion,
    revision: meta.revision,
    createdAt: meta.createdAt,
    updatedAt: meta.updatedAt,
    username: meta.username,
    normalizedUsername: meta.usernameNormalized,
  });
}

function buildPersistedStateFromLegacyRecord(
  userId: string | number,
  record: UserRecord,
): PersistedUserState {
  return buildPersistedUserState({
    userId: record.userId || String(userId),
    storageFormat: "legacy",
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
    username: record.username,
  });
}

export async function getPersistedUserState(
  userId: string | number,
): Promise<PersistedUserState | null> {
  const commitPointer = await readUserCommitPointer(userId);
  if (commitPointer) {
    return buildPersistedStateFromCommitPointerSnapshot(commitPointer);
  }

  const splitMetaRaw = await redisClient.get(getUserDataKey(userId, "meta"));
  if (splitMetaRaw) {
    const meta = safeParseStoredJson<UserMeta & Record<string, unknown>>(
      splitMetaRaw,
      userId,
      `legacy-split-meta:${userId}`,
    );

    if (!isObject(meta)) {
      throw logIntegrityFailure(
        userId,
        "Stored split-user metadata is invalid",
        {
          key: getUserDataKey(userId, "meta"),
        },
      );
    }

    return buildPersistedStateFromMeta(userId, meta, "split");
  }

  const legacyRaw = await redisClient.get(`user:${userId}`);
  if (!legacyRaw) {
    return null;
  }

  const legacyRecord = safeParseStoredJson<UserRecord>(
    legacyRaw,
    userId,
    `legacy-user:${userId}`,
  );

  return buildPersistedStateFromLegacyRecord(userId, legacyRecord);
}

async function loadSnapshotUserDataParts(
  userId: string | number,
  parts: UserDataPart[],
  snapshotKeyPrefix: string,
  storageLabel: string,
): Promise<Partial<Record<UserDataPart, unknown>>> {
  const splitLoaded = await loadStoredUserDataParts(
    userId,
    parts,
    (part) => getUserSnapshotPartKey(snapshotKeyPrefix, part),
    storageLabel,
  );

  if (
    splitLoaded.foundAnyRequestedPart &&
    splitLoaded.missingRequiredParts.length === 0
  ) {
    return splitLoaded.data;
  }

  throwMissingUserDataParts(
    userId,
    "Stored split user record is incomplete",
    splitLoaded.missingRequiredParts,
    { storageLabel },
  );
}

function selectCommittedSnapshotState(
  commitPointer: UserCommitPointer,
  options?: {
    expectedSnapshotToken?: string;
    expectedUpdatedAt?: string;
  },
): {
  snapshotKind: "current" | "retained" | "previous";
  snapshotKeyPrefix?: string;
  snapshotMatched: boolean;
  state: PersistedUserState;
} {
  const expectedSnapshotToken = options?.expectedSnapshotToken;
  const expectedUpdatedAt = options?.expectedUpdatedAt;
  const retainedSnapshot = getRetainedCommitPointerSnapshot(commitPointer);

  const matchesCurrentSnapshot = Boolean(
    (expectedSnapshotToken &&
      commitPointer.snapshotToken === expectedSnapshotToken) ||
    (expectedUpdatedAt && commitPointer.updatedAt === expectedUpdatedAt),
  );
  const matchesRetainedSnapshot = Boolean(
    (expectedSnapshotToken &&
      retainedSnapshot.token === expectedSnapshotToken) ||
    (expectedUpdatedAt && retainedSnapshot.updatedAt === expectedUpdatedAt),
  );

  if (matchesRetainedSnapshot && retainedSnapshot.revision) {
    return {
      snapshotKind: retainedSnapshot.snapshotKind ?? "retained",
      snapshotKeyPrefix: retainedSnapshot.keyPrefix,
      snapshotMatched: true,
      state: buildPersistedStateFromCommitPointerSnapshot(
        commitPointer,
        retainedSnapshot.snapshotKind ?? "retained",
      ),
    };
  }

  const currentState =
    buildPersistedStateFromCommitPointerSnapshot(commitPointer);

  return {
    snapshotKind: "current",
    snapshotKeyPrefix: commitPointer.snapshotKeyPrefix,
    snapshotMatched:
      !expectedSnapshotToken && !expectedUpdatedAt
        ? true
        : matchesCurrentSnapshot,
    state: currentState,
  };
}

export async function resolveCommittedUserSnapshotState(
  userId: string | number,
  options: {
    expectedSnapshotToken?: string;
    expectedUpdatedAt?: string;
  },
): Promise<{
  snapshotKeyPrefix?: string;
  snapshotMatched: boolean;
  state: PersistedUserState | null;
}> {
  const commitPointer = await readUserCommitPointer(userId);
  if (!commitPointer) {
    return {
      snapshotMatched: false,
      state: null,
    };
  }

  const selection = selectCommittedSnapshotState(commitPointer, options);

  return {
    snapshotKeyPrefix: selection.snapshotKeyPrefix,
    snapshotMatched:
      selection.snapshotMatched && Boolean(selection.snapshotKeyPrefix),
    state: selection.state,
  };
}

function canReconstructFullUserRecord(
  parts: Partial<Record<UserDataPart, unknown>>,
): boolean {
  return ALL_USER_DATA_PARTS.every(
    (part) => isOptionalUserDataPart(part) || parts[part] !== undefined,
  );
}

function selectRequestedUserDataParts(
  parts: UserDataPart[],
  split: Partial<Record<UserDataPart, unknown>>,
): Partial<Record<UserDataPart, unknown>> {
  const data: Partial<Record<UserDataPart, unknown>> = {};

  parts.forEach((part) => {
    if (split[part] !== undefined) {
      data[part] = split[part];
    }
  });

  return data;
}

async function loadRequestedPartsFromLegacyRecord(
  userId: string | number,
  parts: UserDataPart[],
): Promise<UserDataReadResult> {
  const legacyRaw = await redisClient.get(`user:${userId}`);
  if (!legacyRaw) {
    return {
      parts: {},
      state: null,
      snapshotMatched: true,
    };
  }

  const legacyRecord = safeParseStoredJson<UserRecord>(
    legacyRaw,
    userId,
    `legacy-user:${userId}`,
  );
  const split = splitUserRecord(legacyRecord) as Partial<
    Record<UserDataPart, unknown>
  >;

  return {
    parts: selectRequestedUserDataParts(parts, split),
    state: buildPersistedUserState({
      userId: legacyRecord.userId || String(userId),
      storageFormat: "legacy",
      createdAt: legacyRecord.createdAt,
      updatedAt: legacyRecord.updatedAt,
      username: legacyRecord.username,
      completeness: buildUserPayloadCompletenessFromParts(split),
    }),
    snapshotMatched: true,
  };
}

async function tryAcquireLegacyUserMigrationLock(
  userId: string | number,
): Promise<string | null> {
  const lockKey = getLegacyUserMigrationLockKey(userId);
  const token = randomUUID();
  const result = await redisClient.set(lockKey, token, {
    nx: true,
    ex: LEGACY_USER_MIGRATION_LOCK_TTL_SECONDS,
  });

  return result ? token : null;
}

async function releaseLegacyUserMigrationLock(
  userId: string | number,
  token: string,
): Promise<void> {
  const lockKey = getLegacyUserMigrationLockKey(userId);

  try {
    const currentToken = await redisClient.get(lockKey);
    if (currentToken === token) {
      await redisClient.del(lockKey);
    }
  } catch (error) {
    logPrivacySafe(
      "warn",
      "User Data",
      "Failed to release legacy migration lock",
      {
        error: error instanceof Error ? error.message : String(error),
        userId,
      },
    );
  }
}

async function loadLegacyCompatibleUserDataPartsWithoutSaving(
  userId: string | number,
  parts: UserDataPart[],
  options?: {
    expectedSnapshotToken?: string;
    expectedUpdatedAt?: string;
  },
): Promise<UserDataReadResult> {
  const commitPointer = await readUserCommitPointer(userId);
  if (commitPointer) {
    const selection = selectCommittedSnapshotState(commitPointer, options);

    if (selection.snapshotKeyPrefix) {
      return {
        parts: await loadSnapshotUserDataParts(
          userId,
          parts,
          selection.snapshotKeyPrefix,
          `${selection.snapshotKind}-snapshot:${selection.state.revision}`,
        ),
        state: selection.state,
        snapshotMatched: selection.snapshotMatched,
      };
    }

    const loaded = await loadStoredUserDataParts(
      userId,
      parts,
      (part) => getUserDataKey(userId, part),
      `legacy-committed-split:${commitPointer.revision}`,
    );

    if (loaded.foundAnyRequestedPart) {
      if (loaded.missingRequiredParts.length > 0) {
        throwMissingUserDataParts(
          userId,
          "Stored split user record is incomplete",
          loaded.missingRequiredParts,
          { revision: commitPointer.revision },
        );
      }

      return {
        parts: loaded.data,
        state: buildPersistedUserState({
          ...selection.state,
          completeness:
            selection.state.completeness ??
            buildUserPayloadCompletenessFromParts(loaded.data),
        }),
        snapshotMatched: selection.snapshotMatched,
      };
    }
  }

  const loaded = await loadStoredUserDataParts(
    userId,
    parts,
    (part) => getUserDataKey(userId, part),
    "legacy-split-user",
  );

  if (loaded.foundAnyRequestedPart) {
    if (loaded.missingRequiredParts.length > 0) {
      throwMissingUserDataParts(
        userId,
        "Stored split user record is incomplete",
        loaded.missingRequiredParts,
      );
    }

    const meta = loaded.data.meta as
      | (UserMeta & Record<string, unknown>)
      | undefined;

    return {
      parts: loaded.data,
      state: meta
        ? buildPersistedUserState({
            ...buildPersistedStateFromMeta(userId, meta, "split"),
            completeness: buildUserPayloadCompletenessFromParts(loaded.data),
          })
        : null,
      snapshotMatched: true,
    };
  }

  return loadRequestedPartsFromLegacyRecord(userId, parts);
}

async function migrateLegacyUserDataPartsWithLock(
  userId: string | number,
  parts: UserDataPart[],
  options?: {
    expectedSnapshotToken?: string;
    expectedUpdatedAt?: string;
  },
): Promise<UserDataReadResult> {
  const migrationLockToken = await tryAcquireLegacyUserMigrationLock(userId);
  if (!migrationLockToken) {
    return loadLegacyCompatibleUserDataPartsWithoutSaving(
      userId,
      parts,
      options,
    );
  }

  try {
    const commitPointer = await readUserCommitPointer(userId);
    if (commitPointer) {
      return loadLegacyCompatibleUserDataPartsWithoutSaving(
        userId,
        parts,
        options,
      );
    }

    const migratedRecord = await migrateUserRecord(userId);
    if (!migratedRecord) {
      return loadLegacyCompatibleUserDataPartsWithoutSaving(
        userId,
        parts,
        options,
      );
    }

    const split = splitUserRecord(migratedRecord) as Partial<
      Record<UserDataPart, unknown>
    >;

    return {
      parts: selectRequestedUserDataParts(parts, split),
      state: buildPersistedUserState({
        userId: migratedRecord.userId || String(userId),
        storageFormat: "split",
        createdAt: migratedRecord.createdAt,
        updatedAt: migratedRecord.updatedAt,
        username: migratedRecord.username,
        completeness: buildUserPayloadCompletenessFromParts(split),
      }),
      snapshotMatched: true,
    };
  } finally {
    await releaseLegacyUserMigrationLock(userId, migrationLockToken);
  }
}

async function rewriteLegacyCommittedUserDataWithLock(
  userId: string | number,
  data: Partial<Record<UserDataPart, unknown>>,
  commitPointer: UserCommitPointer,
): Promise<void> {
  const migrationLockToken = await tryAcquireLegacyUserMigrationLock(userId);

  if (!migrationLockToken) {
    return;
  }

  try {
    const latestCommitPointer = await readUserCommitPointer(userId);
    if (latestCommitPointer?.snapshotKeyPrefix) {
      return;
    }

    const reconstructed = reconstructUserRecord(data);

    await saveUserRecord(reconstructed, {
      existingState: buildPersistedStateFromCommitPointerSnapshot(
        latestCommitPointer ?? commitPointer,
      ),
      triggerSource: "legacy_split_rewrite",
    });
  } finally {
    await releaseLegacyUserMigrationLock(userId, migrationLockToken);
  }
}

async function rewriteLegacySplitUserDataWithLock(
  userId: string | number,
  data: Partial<Record<UserDataPart, unknown>>,
): Promise<void> {
  const migrationLockToken = await tryAcquireLegacyUserMigrationLock(userId);

  if (!migrationLockToken) {
    return;
  }

  try {
    const commitPointer = await readUserCommitPointer(userId);
    if (commitPointer) {
      return;
    }

    const reconstructed = reconstructUserRecord(data);
    const meta = data.meta as (UserMeta & Record<string, unknown>) | undefined;

    await saveUserRecord(reconstructed, {
      existingState: meta
        ? buildPersistedStateFromMeta(userId, meta, "split")
        : undefined,
      triggerSource: "legacy_split_rewrite",
    });
  } finally {
    await releaseLegacyUserMigrationLock(userId, migrationLockToken);
  }
}

async function loadLegacyCompatibleUserDataParts(
  userId: string | number,
  parts: UserDataPart[],
  options?: {
    expectedSnapshotToken?: string;
    expectedUpdatedAt?: string;
  },
): Promise<UserDataReadResult> {
  const commitPointer = await readUserCommitPointer(userId);
  if (commitPointer) {
    const result = await loadLegacyCompatibleUserDataPartsWithoutSaving(
      userId,
      parts,
      options,
    );

    if (
      !commitPointer.snapshotKeyPrefix &&
      canReconstructFullUserRecord(result.parts)
    ) {
      await rewriteLegacyCommittedUserDataWithLock(
        userId,
        result.parts,
        commitPointer,
      );
    }

    return result;
  }

  const loaded = await loadStoredUserDataParts(
    userId,
    parts,
    (part) => getUserDataKey(userId, part),
    "legacy-split-user",
  );

  if (!loaded.foundAnyRequestedPart) {
    return migrateLegacyUserDataPartsWithLock(userId, parts, options);
  }

  if (loaded.missingRequiredParts.length > 0) {
    throwMissingUserDataParts(
      userId,
      "Stored split user record is incomplete",
      loaded.missingRequiredParts,
    );
  }

  if (canReconstructFullUserRecord(loaded.data)) {
    await rewriteLegacySplitUserDataWithLock(userId, loaded.data);
  }

  const meta = loaded.data.meta as
    | (UserMeta & Record<string, unknown>)
    | undefined;

  return {
    parts: loaded.data,
    state: meta
      ? buildPersistedUserState({
          ...buildPersistedStateFromMeta(userId, meta, "split"),
          completeness: buildUserPayloadCompletenessFromParts(loaded.data),
        })
      : null,
    snapshotMatched: true,
  };
}

async function rebuildUserRefreshIndex(): Promise<number> {
  const userIds = await readTrackedUserIds();

  if (userIds.length === 0) {
    return 0;
  }

  const states = await Promise.all(
    userIds.map(async (candidateUserId) => {
      try {
        return await getPersistedUserState(candidateUserId);
      } catch (error) {
        if (error instanceof UserDataIntegrityError) {
          logPrivacySafe(
            "warn",
            "User Data",
            "Skipping corrupt user while rebuilding stale-user index",
            {
              userId: candidateUserId,
              error: error.message,
            },
          );
          return null;
        }

        throw error;
      }
    }),
  );

  const validStates = states.filter(
    (state): state is PersistedUserState => state !== null,
  );

  if (validStates.length === 0) {
    return 0;
  }

  const pipeline = redisClient.pipeline() as unknown as RedisPipeline;
  validStates.forEach((state) => {
    pipeline.zadd(USER_REFRESH_INDEX_KEY, {
      score: getUpdatedAtScore(state.updatedAt),
      member: state.userId,
    });
  });
  await pipeline.exec();

  return validStates.length;
}

async function repairMissingUserRefreshIndexEntries(
  userIds: string[],
): Promise<
  Pick<
    UserRefreshIndexRepairResult,
    "prunedRegistryUserIds" | "repairedUserIds"
  >
> {
  const prunedRegistryUserIds: string[] = [];
  const repairedUserIds: string[] = [];

  if (userIds.length === 0) {
    return {
      prunedRegistryUserIds,
      repairedUserIds,
    };
  }

  const states = await Promise.all(
    userIds.map(async (candidateUserId) => {
      try {
        return {
          state: await getPersistedUserState(candidateUserId),
          userId: candidateUserId,
        };
      } catch (error) {
        if (error instanceof UserDataIntegrityError) {
          logPrivacySafe(
            "warn",
            "User Data",
            "Skipping corrupt user while repairing stale-user index drift",
            {
              userId: candidateUserId,
              error: error.message,
            },
          );
          return {
            state: undefined,
            userId: candidateUserId,
          };
        }

        throw error;
      }
    }),
  );

  const validStates: PersistedUserState[] = [];
  states.forEach(({ state, userId }) => {
    if (state === null) {
      prunedRegistryUserIds.push(userId);
      return;
    }

    if (!state) {
      return;
    }

    validStates.push(state);
    repairedUserIds.push(state.userId);
  });

  if (validStates.length > 0) {
    const pipeline = redisClient.pipeline() as unknown as RedisPipeline;
    validStates.forEach((state) => {
      pipeline.zadd(USER_REFRESH_INDEX_KEY, {
        score: getUpdatedAtScore(state.updatedAt),
        member: state.userId,
      });
    });
    await pipeline.exec();
  }

  if (prunedRegistryUserIds.length > 0) {
    await redisSetClient.srem(
      USER_REFRESH_REGISTRY_KEY,
      ...prunedRegistryUserIds,
    );
  }

  return {
    prunedRegistryUserIds,
    repairedUserIds,
  };
}

async function repairUserRefreshIndexDrift(
  trackedUserIds: string[],
  indexedUserCount: number,
): Promise<UserRefreshIndexRepairResult> {
  const indexedUserIds =
    indexedUserCount > 0
      ? (
          await redisSortedSetClient.zrange(
            USER_REFRESH_INDEX_KEY,
            0,
            Math.max(0, indexedUserCount - 1),
          )
        ).map(String)
      : [];
  const trackedUserIdSet = new Set(trackedUserIds);
  const indexedUserIdSet = new Set(indexedUserIds);
  const missingUserIds = trackedUserIds.filter(
    (userId) => !indexedUserIdSet.has(userId),
  );
  const removedIndexedUserIds = indexedUserIds.filter(
    (userId) => !trackedUserIdSet.has(userId),
  );
  const prunedRegistryUserIds: string[] = [];
  const repairedUserIds: string[] = [];

  // Drain drift in bounded slices so a single repair pass can catch up large
  // backlogs without turning one Redis repair into an unbounded fan-out.
  for (
    let startIndex = 0;
    startIndex < missingUserIds.length;
    startIndex += USER_REFRESH_INDEX_REPAIR_BATCH_SIZE
  ) {
    const batchUserIds = missingUserIds.slice(
      startIndex,
      startIndex + USER_REFRESH_INDEX_REPAIR_BATCH_SIZE,
    );
    const batchRepairResult =
      await repairMissingUserRefreshIndexEntries(batchUserIds);

    prunedRegistryUserIds.push(...batchRepairResult.prunedRegistryUserIds);
    repairedUserIds.push(...batchRepairResult.repairedUserIds);
  }

  if (removedIndexedUserIds.length > 0) {
    await redisSortedSetClient.zrem(
      USER_REFRESH_INDEX_KEY,
      ...removedIndexedUserIds,
    );
  }

  const indexedUserCountAfterRepair = Number(
    await redisSortedSetClient.zcard(USER_REFRESH_INDEX_KEY),
  );
  const remainingMissingUserCount = Math.max(
    0,
    missingUserIds.length -
      repairedUserIds.length -
      prunedRegistryUserIds.length,
  );

  if (
    repairedUserIds.length > 0 ||
    prunedRegistryUserIds.length > 0 ||
    removedIndexedUserIds.length > 0
  ) {
    logPrivacySafe(
      "warn",
      "User Data",
      "Incrementally repaired stale-user index drift",
      {
        indexedCountAfterRepair: indexedUserCountAfterRepair,
        indexedCountBeforeRepair: indexedUserCount,
        missingUserCount: missingUserIds.length,
        prunedRegistryUserCount: prunedRegistryUserIds.length,
        remainingMissingUserCount,
        registryCount: trackedUserIds.length,
        removedIndexedUserCount: removedIndexedUserIds.length,
        repairedUserCount: repairedUserIds.length,
        repairBatchSize: USER_REFRESH_INDEX_REPAIR_BATCH_SIZE,
        repairFullyDrained: remainingMissingUserCount === 0,
        repairPassCount:
          missingUserIds.length === 0
            ? 0
            : Math.ceil(
                missingUserIds.length / USER_REFRESH_INDEX_REPAIR_BATCH_SIZE,
              ),
      },
    );
  }

  return {
    indexedUserCount: indexedUserCountAfterRepair,
    prunedRegistryUserIds,
    removedIndexedUserIds,
    repairedUserIds,
  };
}

export async function listStalestUserIds(
  limit: number,
): Promise<{ userIds: string[]; totalUsers: number }> {
  let totalUsers = Number(
    await redisSortedSetClient.zcard(USER_REFRESH_INDEX_KEY),
  );

  if (totalUsers === 0) {
    totalUsers = await rebuildUserRefreshIndex();
  } else {
    const trackedUserIds = await readTrackedUserIds();

    if (trackedUserIds.length !== totalUsers) {
      const repairResult = await repairUserRefreshIndexDrift(
        trackedUserIds,
        totalUsers,
      );
      totalUsers = repairResult.indexedUserCount;
    }
  }

  if (totalUsers === 0 || limit <= 0) {
    return { userIds: [], totalUsers: 0 };
  }

  const userIds = await redisSortedSetClient.zrange(
    USER_REFRESH_INDEX_KEY,
    0,
    Math.max(0, limit - 1),
  );

  return {
    userIds: userIds.map(String),
    totalUsers,
  };
}

const PROFILE_SITEMAP_STATE_READ_BATCH_SIZE = 100;

export interface PublicUserProfileSitemapEntry {
  username: string;
  lastmod?: string;
}

function normalizeSitemapLastmod(
  value: string | undefined,
): string | undefined {
  if (!value) {
    return undefined;
  }

  const parsed = Date.parse(value);
  return Number.isNaN(parsed) ? undefined : new Date(parsed).toISOString();
}

function chooseNewerSitemapLastmod(
  current: string | undefined,
  candidate: string | undefined,
): string | undefined {
  if (!current) {
    return candidate;
  }

  if (!candidate) {
    return current;
  }

  return Date.parse(candidate) > Date.parse(current) ? candidate : current;
}

export async function listPublicUserProfileSitemapEntries(): Promise<
  PublicUserProfileSitemapEntry[]
> {
  const trackedUserIds = await readTrackedUserIds();

  if (trackedUserIds.length === 0) {
    return [];
  }

  const entriesByNormalizedUsername = new Map<
    string,
    PublicUserProfileSitemapEntry
  >();

  for (
    let startIndex = 0;
    startIndex < trackedUserIds.length;
    startIndex += PROFILE_SITEMAP_STATE_READ_BATCH_SIZE
  ) {
    const userIdsBatch = trackedUserIds.slice(
      startIndex,
      startIndex + PROFILE_SITEMAP_STATE_READ_BATCH_SIZE,
    );
    const states = await Promise.all(
      userIdsBatch.map(async (candidateUserId) => {
        try {
          return await getPersistedUserState(candidateUserId);
        } catch (error) {
          if (error instanceof UserDataIntegrityError) {
            logPrivacySafe(
              "warn",
              "User Data",
              "Skipping corrupt user while listing public profile sitemap entries",
              {
                userId: candidateUserId,
                error: error.message,
              },
            );

            return null;
          }

          throw error;
        }
      }),
    );

    states.forEach((state) => {
      const username =
        typeof state?.username === "string" ? state.username.trim() : "";
      const normalizedUsername = normalizeUsernameIndexValue(username);

      if (!normalizedUsername) {
        return;
      }

      const candidateLastmod = normalizeSitemapLastmod(
        state?.snapshot?.updatedAt ?? state?.updatedAt,
      );
      const previousEntry = entriesByNormalizedUsername.get(normalizedUsername);

      if (!previousEntry) {
        entriesByNormalizedUsername.set(
          normalizedUsername,
          candidateLastmod
            ? { username, lastmod: candidateLastmod }
            : { username },
        );
        return;
      }

      const nextLastmod = chooseNewerSitemapLastmod(
        previousEntry.lastmod,
        candidateLastmod,
      );
      const shouldUseCandidateUsername =
        !previousEntry.lastmod ||
        (candidateLastmod !== undefined && nextLastmod === candidateLastmod);

      entriesByNormalizedUsername.set(normalizedUsername, {
        username: shouldUseCandidateUsername
          ? username
          : previousEntry.username,
        ...(nextLastmod ? { lastmod: nextLastmod } : {}),
      });
    });
  }

  return Array.from(entriesByNormalizedUsername.values()).toSorted((a, b) =>
    a.username.localeCompare(b.username, undefined, {
      sensitivity: "base",
    }),
  );
}

/**
 * Splits a full UserRecord into its constituent parts for granular storage.
 *
 * This function is defensive and supports multiple legacy shapes that were
 * observed in production (flat activityHistory, flat statistics, or the
 * newer `User`-wrapped shape). The goal is to ensure each part contains the
 * expected shape (e.g., `activity` should never accidentally contain the full
 * user record).
 */
export function splitUserRecord(record: UserRecord) {
  const { stats: rawStats, ...metaBase } = record;

  const aggregates = isObject(
    (record as unknown as Record<string, unknown>).aggregates,
  )
    ? ((record as unknown as Record<string, unknown>)
        .aggregates as UserAggregates)
    : undefined;

  const metaBaseRecord = metaBase as Record<string, unknown>;
  const {
    ip: legacyIp,
    requestMetadata: rawRequestMetadata,
    ...metaBaseRest
  } = metaBaseRecord;

  const requestMetadata =
    normalizePersistedRequestMetadata(rawRequestMetadata) ??
    (typeof legacyIp === "string"
      ? buildPersistedRequestMetadata(legacyIp)
      : undefined);

  const statsObj = (rawStats || {}) as unknown;
  const userObj = isObject((statsObj as Record<string, unknown>)["User"])
    ? ((statsObj as Record<string, unknown>)["User"] as Record<string, unknown>)
    : undefined;

  const statistics =
    rawStats === null ? null : extractStatistics(statsObj, userObj);
  const activityStats = extractActivityStats(statsObj, userObj);
  const favourites = extractFavourites(record, statsObj, userObj);
  const pages = extractPages(statsObj);

  const planning = {
    animePlanning: extractMediaListCollection(statsObj, "animePlanning"),
    mangaPlanning: extractMediaListCollection(statsObj, "mangaPlanning"),
  };

  const current = {
    animeCurrent: extractMediaListCollection(statsObj, "animeCurrent"),
    mangaCurrent: extractMediaListCollection(statsObj, "mangaCurrent"),
  };

  const rewatched = {
    animeRewatched: extractMediaListCollection(statsObj, "animeRewatched"),
    mangaReread: extractMediaListCollection(statsObj, "mangaReread"),
  };

  const completed = {
    animeCompleted: extractMediaListCollection(statsObj, "animeCompleted"),
    mangaCompleted: extractMediaListCollection(statsObj, "mangaCompleted"),
    animeDropped: extractMediaListCollection(statsObj, "animeDropped"),
    mangaDropped: extractMediaListCollection(statsObj, "mangaDropped"),
  };

  const userMeta = userObj || {};

  const meta: UserMeta & Record<string, unknown> = {
    ...metaBaseRest,
    userId: String(metaBaseRest.userId || ""),
    username:
      typeof metaBaseRest.username === "string"
        ? metaBaseRest.username
        : undefined,
    createdAt: String(metaBaseRest.createdAt || new Date().toISOString()),
    updatedAt: String(metaBaseRest.updatedAt || new Date().toISOString()),
    ...(requestMetadata ? { requestMetadata } : {}),
    name:
      getStringProp(userMeta, "name") ||
      getStringProp(record as unknown, "name"),
    avatar:
      (getProp(userMeta, "avatar") as UserAvatar) ||
      (getProp(record as unknown, "avatar") as UserAvatar),
    userCreatedAt:
      getNumberProp(userMeta, "createdAt") ||
      getNumberProp(record as unknown, "userCreatedAt"),
  };

  return {
    meta,
    ...(aggregates ? { aggregates } : {}),
    activity: activityStats,
    favourites,
    statistics,
    pages,
    planning,
    current,
    rewatched,
    completed,
  };
}

/**
 * Reconstructs a full UserRecord from its split parts.
 */
export function reconstructUserRecord(
  parts: Partial<Record<UserDataPart, unknown>>,
): ReconstructedUserRecord {
  const meta = parts.meta as UserMeta | undefined;
  const requestMetadata = normalizePersistedRequestMetadata(
    meta?.requestMetadata,
  );
  const legacyIp = getStringProp(meta, "ip");
  const effectiveRequestMetadata =
    requestMetadata ??
    (legacyIp ? buildPersistedRequestMetadata(legacyIp) : undefined);
  const activity = parts.activity as UserSection["stats"] | undefined;
  const favourites = parts.favourites as UserSection["favourites"] | undefined;
  const statisticsPart = parts.statistics as
    | UserSection["statistics"]
    | null
    | undefined;

  const pagesInput = parts.pages as
    | {
        followersPage?: FollowersPage;
        followingPage?: FollowingPage;
        threadsPage?: ThreadsPage;
        threadCommentsPage?: ThreadCommentsPage;
        reviewsPage?: ReviewsPage;
        userReviews?: UserReviewsPage;
        userRecommendations?: UserRecommendationsPage;
      }
    | undefined;

  const followersPage = pagesInput?.followersPage ?? DEFAULT_FOLLOWERS_PAGE;
  const followingPage = pagesInput?.followingPage ?? DEFAULT_FOLLOWING_PAGE;
  const threadsPage = pagesInput?.threadsPage ?? DEFAULT_THREADS_PAGE;
  const threadCommentsPage =
    pagesInput?.threadCommentsPage ?? DEFAULT_THREAD_COMMENTS_PAGE;
  const reviewsPage = pagesInput?.reviewsPage ?? DEFAULT_REVIEWS_PAGE;
  const userReviews = pagesInput?.userReviews;
  const userRecommendations = pagesInput?.userRecommendations;

  const planningInput = parts.planning as
    | {
        animePlanning?: MediaListCollection;
        mangaPlanning?: MediaListCollection;
      }
    | undefined;
  const currentInput = parts.current as
    | {
        animeCurrent?: MediaListCollection;
        mangaCurrent?: MediaListCollection;
      }
    | undefined;
  const rewatchedInput = parts.rewatched as
    | {
        animeRewatched?: MediaListCollection;
        mangaReread?: MediaListCollection;
      }
    | undefined;
  const completedInput = parts.completed as
    | {
        animeCompleted?: MediaListCollection;
        mangaCompleted?: MediaListCollection;
        animeDropped?: MediaListCollection;
        mangaDropped?: MediaListCollection;
      }
    | undefined;

  const defaultStatistics: UserSection["statistics"] = {
    anime: {
      count: 0,
      episodesWatched: 0,
      minutesWatched: 0,
      meanScore: 0,
      standardDeviation: 0,
      genres: [],
      tags: [],
      voiceActors: [],
      studios: [],
      staff: [],
    },
    manga: {
      count: 0,
      chaptersRead: 0,
      volumesRead: 0,
      meanScore: 0,
      standardDeviation: 0,
      genres: [],
      tags: [],
      staff: [],
    },
  };

  const userSection: UserSection = {
    stats: activity || { activityHistory: [] },
    favourites: favourites || {
      anime: { nodes: [] },
      manga: { nodes: [] },
      characters: { nodes: [] },
      staff: { nodes: [] },
      studios: { nodes: [] },
    },
    statistics:
      statisticsPart === null
        ? (null as unknown as UserSection["statistics"])
        : statisticsPart || defaultStatistics,
    name: meta?.name,
    avatar: meta?.avatar,
    createdAt: meta?.userCreatedAt,
  };

  const userStatsData: UserStatsData = {
    User: userSection,
    followersPage,
    followingPage,
    threadsPage,
    threadCommentsPage,
    reviewsPage,
    userReviews,
    userRecommendations,
    animePlanning: planningInput?.animePlanning,
    mangaPlanning: planningInput?.mangaPlanning,
    animeCurrent: currentInput?.animeCurrent,
    mangaCurrent: currentInput?.mangaCurrent,
    animeRewatched: rewatchedInput?.animeRewatched,
    mangaReread: rewatchedInput?.mangaReread,
    animeCompleted: completedInput?.animeCompleted,
    mangaCompleted: completedInput?.mangaCompleted,
    animeDropped: completedInput?.animeDropped,
    mangaDropped: completedInput?.mangaDropped,
  };

  const tmpMeta = meta as unknown as Record<string, unknown> | undefined;
  const rest: Record<string, unknown> = tmpMeta ? { ...tmpMeta } : {};
  delete rest.userId;
  delete rest.username;
  delete rest.updatedAt;
  delete rest.createdAt;
  delete rest.requestMetadata;
  delete rest.name;
  delete rest.avatar;
  delete rest.userCreatedAt;
  delete rest.schemaVersion;
  delete rest.revision;
  delete rest.storageFormat;
  delete rest.usernameNormalized;
  delete rest.ip;
  const aggregates = parts.aggregates as UserAggregates | undefined;

  return {
    userId: meta?.userId || "",
    username: meta?.username,
    createdAt: meta?.createdAt || "",
    updatedAt: meta?.updatedAt || "",
    ...(effectiveRequestMetadata
      ? { requestMetadata: effectiveRequestMetadata }
      : {}),
    stats: userStatsData,
    statistics: userSection.statistics,
    favourites: userSection.favourites,
    pages: {
      followersPage,
      followingPage,
      threadsPage,
      threadCommentsPage,
      reviewsPage,
    },
    ...rest,
    ...(aggregates ? { aggregates } : {}),
  };
}

/**
 * Reconstructs the bounded public DTO returned by `/api/get-user`, normalizing
 * persisted string user IDs to numeric AniList IDs.
 */
export function reconstructPublicUserRecord(
  parts: Partial<Record<UserDataPart, unknown>>,
  options?: { state?: PersistedUserState | null },
): PublicUserRecord {
  const record = reconstructUserRecord(parts);
  const publicUserId = normalizeStoredUserIdForPublicDto(record.userId);
  const recordMeta = buildPublicUserRecordMetadata(options?.state);

  return {
    userId: publicUserId,
    username: record.username,
    stats: record.stats,
    statistics: record.statistics,
    favourites: record.favourites,
    pages: record.pages,
    ...(record.aggregates ? { aggregates: record.aggregates } : {}),
    ...(recordMeta ? { recordMeta } : {}),
  };
}

/**
 * Reconstructs the lightweight bootstrap DTO returned by `/api/get-user?view=bootstrap`,
 * normalizing the persisted string user ID to a numeric AniList ID.
 */
export function reconstructUserBootstrapRecord(
  parts: Partial<Record<UserDataPart, unknown>>,
  options?: { state?: PersistedUserState | null },
): UserBootstrapRecord {
  const meta = parts.meta as UserMeta | undefined;
  const publicUserId = normalizeStoredUserIdForPublicDto(meta?.userId);
  const recordMeta = buildPublicUserRecordMetadata(options?.state);

  return {
    userId: publicUserId,
    username: meta?.username,
    avatarUrl: meta?.avatar?.medium || meta?.avatar?.large || null,
    ...(recordMeta ? { recordMeta } : {}),
  };
}

const SAVE_USER_RECORD_LUA = `
local payload = cjson.decode(ARGV[1])

local function parse_json_object(raw)
  if type(raw) ~= "string" or string.len(raw) == 0 then
    return nil
  end

  local ok, decoded = pcall(cjson.decode, raw)
  if not ok or type(decoded) ~= "table" then
    return nil
  end

  return decoded
end

local function normalize_username(value)
  if type(value) ~= "string" then
    return nil
  end

  local normalized = string.lower(value)
  normalized = string.gsub(normalized, "^%s+", "")
  normalized = string.gsub(normalized, "%s+$", "")
  if string.len(normalized) == 0 then
    return nil
  end

  return normalized
end

local function normalize_durable_snapshot(options)
  if type(options) ~= "table" then
    return nil
  end

  local token = type(options["token"]) == "string" and options["token"] or nil
  local keyPrefix = type(options["keyPrefix"]) == "string" and options["keyPrefix"] or nil
  local revision = tonumber(options["revision"])
  local updatedAt = type(options["updatedAt"]) == "string" and options["updatedAt"] or nil
  local committedAt = type(options["committedAt"]) == "string" and options["committedAt"] or nil

  if not token or not keyPrefix or not revision or revision <= 0 or not updatedAt or not committedAt then
    return nil
  end

  return {
    committedAt = committedAt,
    completeness = type(options["completeness"]) == "table" and options["completeness"] or nil,
    keyPrefix = keyPrefix,
    revision = revision,
    token = token,
    updatedAt = updatedAt,
  }
end

local function snapshot_matches(candidate, expected)
  if type(candidate) ~= "table" or type(expected) ~= "table" then
    return false
  end

  local candidateToken = type(candidate["token"]) == "string" and candidate["token"] or nil
  local expectedToken = type(expected["token"]) == "string" and expected["token"] or nil
  if candidateToken and expectedToken and candidateToken == expectedToken then
    return true
  end

  local candidateUpdatedAt = type(candidate["updatedAt"]) == "string" and candidate["updatedAt"] or nil
  local expectedUpdatedAt = type(expected["updatedAt"]) == "string" and expected["updatedAt"] or nil
  return candidateUpdatedAt and expectedUpdatedAt and candidateUpdatedAt == expectedUpdatedAt
end

local function read_pinned_cards_snapshot()
  local cardsMeta = parse_json_object(redis.call("GET", KEYS[7]))
  if cardsMeta then
    local cardsMetaSnapshot = type(cardsMeta["userSnapshot"]) == "table" and cardsMeta["userSnapshot"] or cardsMeta
    local normalizedCardsMetaSnapshot = normalize_durable_snapshot({
      token = cardsMetaSnapshot["token"],
      keyPrefix = type(cardsMetaSnapshot["token"]) == "string" and ("user:" .. payload["userId"] .. ":snapshot:" .. cardsMetaSnapshot["token"]) or nil,
      revision = cardsMetaSnapshot["revision"],
      updatedAt = cardsMetaSnapshot["updatedAt"],
      committedAt = cardsMetaSnapshot["committedAt"],
    })
    if normalizedCardsMetaSnapshot then
      return normalizedCardsMetaSnapshot
    end
  end

  local cardsRecord = parse_json_object(redis.call("GET", KEYS[8]))
  if cardsRecord and type(cardsRecord["userSnapshot"]) == "table" then
    local cardsRecordSnapshot = cardsRecord["userSnapshot"]
    return normalize_durable_snapshot({
      token = cardsRecordSnapshot["token"],
      keyPrefix = type(cardsRecordSnapshot["token"]) == "string" and ("user:" .. payload["userId"] .. ":snapshot:" .. cardsRecordSnapshot["token"]) or nil,
      revision = cardsRecordSnapshot["revision"],
      updatedAt = cardsRecordSnapshot["updatedAt"],
      committedAt = cardsRecordSnapshot["committedAt"],
    })
  end

  return nil
end

local function resolve_current_state()
  local pointer = parse_json_object(redis.call("GET", KEYS[1]))
  if pointer then
    local currentSnapshot = normalize_durable_snapshot({
      token = pointer["snapshotToken"],
      keyPrefix = pointer["snapshotKeyPrefix"],
      revision = pointer["revision"],
      updatedAt = pointer["updatedAt"],
      committedAt = pointer["committedAt"],
      completeness = pointer["completeness"],
    })
    local retainedSnapshot = normalize_durable_snapshot({
      token = pointer["retainedSnapshotToken"] or pointer["previousSnapshotToken"],
      keyPrefix = pointer["retainedSnapshotKeyPrefix"] or pointer["previousSnapshotKeyPrefix"],
      revision = pointer["retainedRevision"] or pointer["previousRevision"],
      updatedAt = pointer["retainedUpdatedAt"] or pointer["previousUpdatedAt"],
      committedAt = pointer["retainedCommittedAt"] or pointer["previousCommittedAt"],
      completeness = pointer["retainedCompleteness"] or pointer["previousCompleteness"],
    })
    return {
      currentSnapshot = currentSnapshot,
      revision = tonumber(pointer["revision"]) or 0,
      updatedAt = type(pointer["updatedAt"]) == "string" and pointer["updatedAt"] or nil,
      usernameNormalized = normalize_username(pointer["usernameNormalized"]),
      snapshotToken = type(pointer["snapshotToken"]) == "string" and pointer["snapshotToken"] or nil,
      snapshotKeyPrefix = type(pointer["snapshotKeyPrefix"]) == "string" and pointer["snapshotKeyPrefix"] or nil,
      committedAt = type(pointer["committedAt"]) == "string" and pointer["committedAt"] or nil,
      retainedSnapshot = retainedSnapshot,
      retainedSnapshotToken = type(pointer["retainedSnapshotToken"]) == "string" and pointer["retainedSnapshotToken"] or nil,
      retainedSnapshotKeyPrefix = type(pointer["retainedSnapshotKeyPrefix"]) == "string" and pointer["retainedSnapshotKeyPrefix"] or nil,
      retainedRevision = tonumber(pointer["retainedRevision"]) or nil,
      retainedUpdatedAt = type(pointer["retainedUpdatedAt"]) == "string" and pointer["retainedUpdatedAt"] or nil,
      retainedCommittedAt = type(pointer["retainedCommittedAt"]) == "string" and pointer["retainedCommittedAt"] or nil,
      previousSnapshotToken = type(pointer["previousSnapshotToken"]) == "string" and pointer["previousSnapshotToken"] or nil,
      previousSnapshotKeyPrefix = type(pointer["previousSnapshotKeyPrefix"]) == "string" and pointer["previousSnapshotKeyPrefix"] or nil,
      previousRevision = tonumber(pointer["previousRevision"]) or nil,
      previousUpdatedAt = type(pointer["previousUpdatedAt"]) == "string" and pointer["previousUpdatedAt"] or nil,
      previousCommittedAt = type(pointer["previousCommittedAt"]) == "string" and pointer["previousCommittedAt"] or nil,
      completeness = type(pointer["completeness"]) == "table" and pointer["completeness"] or nil,
      retainedCompleteness = type(pointer["retainedCompleteness"]) == "table" and pointer["retainedCompleteness"] or nil,
    }
  end

  local legacyMeta = parse_json_object(redis.call("GET", KEYS[5]))
  if legacyMeta then
    return {
      revision = tonumber(legacyMeta["revision"]) or 0,
      updatedAt = type(legacyMeta["updatedAt"]) == "string" and legacyMeta["updatedAt"] or nil,
      usernameNormalized = normalize_username(legacyMeta["usernameNormalized"] or legacyMeta["username"]),
    }
  end

  local legacyRecord = parse_json_object(redis.call("GET", KEYS[6]))
  if legacyRecord then
    return {
      revision = 0,
      updatedAt = type(legacyRecord["updatedAt"]) == "string" and legacyRecord["updatedAt"] or nil,
      usernameNormalized = normalize_username(legacyRecord["username"]),
    }
  end

  return {
    revision = 0,
  }
end

local expectedUpdatedAt = type(payload["expectedUpdatedAt"]) == "string" and payload["expectedUpdatedAt"] or nil
local expectedRevision = tonumber(payload["expectedRevision"])
local expectedSnapshotToken = type(payload["expectedSnapshotToken"]) == "string" and payload["expectedSnapshotToken"] or nil
local normalizedUsername = normalize_username(payload["normalizedUsername"])
local currentState = resolve_current_state()
local pinnedCardsSnapshot = read_pinned_cards_snapshot()

local function build_conflict_result()
  local currentUpdatedAt = type(currentState["updatedAt"]) == "string" and currentState["updatedAt"] or ""
  local currentRevision = tonumber(currentState["revision"]) or 0
  local currentSnapshotToken = type(currentState["snapshotToken"]) == "string" and currentState["snapshotToken"] or ""

  return {0, currentUpdatedAt, tostring(currentRevision), currentSnapshotToken}
end

if expectedSnapshotToken and currentState["snapshotToken"] ~= expectedSnapshotToken then
  return build_conflict_result()
end

if expectedRevision and expectedRevision > 0 then
  local currentRevision = tonumber(currentState["revision"]) or 0
  if currentRevision ~= expectedRevision then
    return build_conflict_result()
  end
end

if expectedUpdatedAt then
  local currentUpdatedAt = currentState["updatedAt"]
  if type(currentUpdatedAt) ~= "string" or string.len(currentUpdatedAt) == 0 or currentUpdatedAt ~= expectedUpdatedAt then
    return build_conflict_result()
  end
end

if normalizedUsername then
  local canonicalAliasKey = "username:" .. normalizedUsername
  local canonicalAliasOwner = redis.call("GET", canonicalAliasKey)
  if canonicalAliasOwner and canonicalAliasOwner ~= payload["userId"] then
    return {2, canonicalAliasOwner}
  end
end

local nextRevision = (tonumber(currentState["revision"]) or 0) + 1
local meta = payload["parts"]["meta"]
if type(meta) ~= "table" then
  meta = {}
end

meta["userId"] = payload["userId"]
meta["createdAt"] = payload["createdAt"]
meta["updatedAt"] = payload["updatedAt"]
meta["schemaVersion"] = payload["schemaVersion"]
meta["revision"] = nextRevision
meta["storageFormat"] = payload["storageFormat"]
meta["snapshotToken"] = payload["snapshotToken"]
if payload["username"] then
  meta["username"] = payload["username"]
else
  meta["username"] = nil
end
if normalizedUsername then
  meta["usernameNormalized"] = normalizedUsername
else
  meta["usernameNormalized"] = nil
end
payload["parts"]["meta"] = meta

for _, partName in ipairs(payload["presentParts"]) do
  redis.call(
    "SET",
    payload["snapshotKeyPrefix"] .. ":" .. partName,
    cjson.encode(payload["parts"][partName])
  )
end

local commitPointer = {
  userId = payload["userId"],
  storageFormat = payload["storageFormat"],
  readShape = payload["readShape"],
  schemaVersion = payload["schemaVersion"],
  revision = nextRevision,
  createdAt = payload["createdAt"],
  updatedAt = payload["updatedAt"],
  committedAt = payload["committedAt"],
  snapshotToken = payload["snapshotToken"],
  snapshotKeyPrefix = payload["snapshotKeyPrefix"],
  completeness = payload["completeness"],
}

if payload["username"] then
  commitPointer["username"] = payload["username"]
end
if normalizedUsername then
  commitPointer["usernameNormalized"] = normalizedUsername
end

local retainedSnapshot = nil
if snapshot_matches(currentState["currentSnapshot"], pinnedCardsSnapshot) then
  retainedSnapshot = currentState["currentSnapshot"]
elseif snapshot_matches(currentState["retainedSnapshot"], pinnedCardsSnapshot) then
  retainedSnapshot = currentState["retainedSnapshot"]
end

if retainedSnapshot then
  commitPointer["retainedSnapshotToken"] = retainedSnapshot["token"]
  commitPointer["retainedSnapshotKeyPrefix"] = retainedSnapshot["keyPrefix"]
  commitPointer["retainedRevision"] = retainedSnapshot["revision"]
  commitPointer["retainedUpdatedAt"] = retainedSnapshot["updatedAt"]
  commitPointer["retainedCommittedAt"] = retainedSnapshot["committedAt"]
  if retainedSnapshot["completeness"] then
    commitPointer["retainedCompleteness"] = retainedSnapshot["completeness"]
  end
end

redis.call("SET", KEYS[1], cjson.encode(commitPointer))

local aliasMap = {}
for _, alias in ipairs(redis.call("SMEMBERS", KEYS[2])) do
  if type(alias) == "string" and string.len(alias) > 0 then
    aliasMap[alias] = true
  end
end
if currentState["usernameNormalized"] then
  aliasMap[currentState["usernameNormalized"]] = true
end
if normalizedUsername then
  aliasMap[normalizedUsername] = true
end

local aliasList = {}
for alias, _ in pairs(aliasMap) do
  table.insert(aliasList, alias)
end

redis.call("DEL", KEYS[2])
if #aliasList > 0 then
  redis.call("SADD", KEYS[2], unpack(aliasList))
end

for _, alias in ipairs(aliasList) do
  local aliasKey = "username:" .. alias
  if normalizedUsername and alias == normalizedUsername then
    redis.call("SET", aliasKey, payload["userId"])
  else
    local aliasOwner = redis.call("GET", aliasKey)
    if aliasOwner == payload["userId"] then
      redis.call("DEL", aliasKey)
    end
  end
end

redis.call("SADD", KEYS[3], payload["userId"])
redis.call("ZADD", KEYS[4], payload["updatedAtScore"], payload["userId"])

for _, partName in ipairs(payload["allParts"]) do
  redis.call("DEL", "user:" .. payload["userId"] .. ":" .. partName)
end

redis.call("DEL", KEYS[6])

local preservedSnapshotPrefixes = {}
preservedSnapshotPrefixes[payload["snapshotKeyPrefix"]] = true
if retainedSnapshot and type(retainedSnapshot["keyPrefix"]) == "string" and string.len(retainedSnapshot["keyPrefix"]) > 0 then
  preservedSnapshotPrefixes[retainedSnapshot["keyPrefix"]] = true
end

local staleSnapshotPrefixes = {}
local function mark_stale_snapshot_prefix(candidate)
  local keyPrefix = type(candidate) == "table" and candidate["keyPrefix"] or nil
  if type(keyPrefix) ~= "string" or string.len(keyPrefix) == 0 then
    return
  end

  if preservedSnapshotPrefixes[keyPrefix] then
    return
  end

  staleSnapshotPrefixes[keyPrefix] = true
end

mark_stale_snapshot_prefix(currentState["currentSnapshot"])
mark_stale_snapshot_prefix(currentState["retainedSnapshot"])

for staleSnapshotKeyPrefix, _ in pairs(staleSnapshotPrefixes) do
  for _, partName in ipairs(payload["allParts"]) do
    redis.call("DEL", staleSnapshotKeyPrefix .. ":" .. partName)
  end
end

return {1, payload["updatedAt"], tostring(nextRevision), payload["snapshotToken"]}
`;

const REPAIR_STALE_USERNAME_ALIAS_LUA = `
local attemptedOwner = redis.call("GET", KEYS[1])
if attemptedOwner == ARGV[1] and ARGV[2] ~= ARGV[3] then
  redis.call("DEL", KEYS[1])
end

if string.len(ARGV[3]) > 0 then
  local canonicalOwner = redis.call("GET", KEYS[2])
  if not canonicalOwner or canonicalOwner == ARGV[1] then
    redis.call("SET", KEYS[2], ARGV[1])
  end
end

if string.len(ARGV[2]) > 0 then
  redis.call("SADD", KEYS[3], ARGV[2])
end
if string.len(ARGV[3]) > 0 then
  redis.call("SADD", KEYS[3], ARGV[3])
end

return {1}
`;

const DELETE_USER_RECORD_LUA = `
local function parse_json_object(raw)
  if type(raw) ~= "string" or string.len(raw) == 0 then
    return nil
  end

  local ok, decoded = pcall(cjson.decode, raw)
  if not ok or type(decoded) ~= "table" then
    return nil
  end

  return decoded
end

local function normalize_username(value)
  if type(value) ~= "string" then
    return nil
  end

  local normalized = string.lower(value)
  normalized = string.gsub(normalized, "^%s+", "")
  normalized = string.gsub(normalized, "%s+$", "")
  if string.len(normalized) == 0 then
    return nil
  end

  return normalized
end

local function delete_key(key, deletedKeys)
  if type(key) ~= "string" or string.len(key) == 0 then
    return
  end

  if tonumber(redis.call("DEL", key)) > 0 then
    table.insert(deletedKeys, key)
  end
end

local ok, decodedParts = pcall(cjson.decode, ARGV[2])
local allParts = ok and type(decodedParts) == "table" and decodedParts or {}
local commitPointer = parse_json_object(redis.call("GET", KEYS[1]))
local splitMeta = parse_json_object(redis.call("GET", KEYS[2]))
local legacyRecord = parse_json_object(redis.call("GET", KEYS[4]))
local aliasMap = {}
local aliasList = {}
local deletedKeys = {}
local removedAliasKeys = {}
local userId = ARGV[1]

local function record_alias(value)
  local normalized = normalize_username(value)
  if normalized and not aliasMap[normalized] then
    aliasMap[normalized] = true
    table.insert(aliasList, normalized)
  end
end

for _, alias in ipairs(redis.call("SMEMBERS", KEYS[3])) do
  record_alias(alias)
end

if commitPointer then
  record_alias(commitPointer["usernameNormalized"])
  record_alias(commitPointer["username"])
end

if splitMeta then
  record_alias(splitMeta["usernameNormalized"])
  record_alias(splitMeta["username"])
end

if legacyRecord then
  record_alias(legacyRecord["usernameNormalized"])
  record_alias(legacyRecord["username"])
end

for _, partName in ipairs(allParts) do
  delete_key("user:" .. userId .. ":" .. partName, deletedKeys)
end

if commitPointer then
  local snapshotKeyPrefix =
    type(commitPointer["snapshotKeyPrefix"]) == "string"
      and commitPointer["snapshotKeyPrefix"]
      or nil
  if snapshotKeyPrefix then
    for _, partName in ipairs(allParts) do
      delete_key(snapshotKeyPrefix .. ":" .. partName, deletedKeys)
    end
  end

  local previousSnapshotKeyPrefix =
    type(commitPointer["retainedSnapshotKeyPrefix"]) == "string"
      and commitPointer["retainedSnapshotKeyPrefix"]
      or type(commitPointer["previousSnapshotKeyPrefix"]) == "string"
      and commitPointer["previousSnapshotKeyPrefix"]
      or nil
  if previousSnapshotKeyPrefix then
    for _, partName in ipairs(allParts) do
      delete_key(previousSnapshotKeyPrefix .. ":" .. partName, deletedKeys)
    end
  end
end

delete_key(KEYS[1], deletedKeys)
delete_key(KEYS[3], deletedKeys)
delete_key(KEYS[4], deletedKeys)
delete_key(KEYS[5], deletedKeys)
delete_key(KEYS[6], deletedKeys)
delete_key(KEYS[7], deletedKeys)

for _, alias in ipairs(aliasList) do
  local aliasKey = "username:" .. alias
  local aliasOwner = redis.call("GET", aliasKey)
  if aliasOwner == userId then
    if tonumber(redis.call("DEL", aliasKey)) > 0 then
      table.insert(removedAliasKeys, aliasKey)
      table.insert(deletedKeys, aliasKey)
    end
  end
end

redis.call("SREM", KEYS[8], userId)
redis.call("ZREM", KEYS[9], userId)

return {1, cjson.encode(deletedKeys), cjson.encode(removedAliasKeys)}
`;

const PRUNE_UNPINNED_RETAINED_SNAPSHOT_LUA = `
local function parse_json_object(raw)
  if type(raw) ~= "string" or string.len(raw) == 0 then
    return nil
  end

  local ok, decoded = pcall(cjson.decode, raw)
  if not ok or type(decoded) ~= "table" then
    return nil
  end

  return decoded
end

local ok, decodedParts = pcall(cjson.decode, ARGV[1])
local allParts = ok and type(decodedParts) == "table" and decodedParts or {}
local commitPointer = parse_json_object(redis.call("GET", KEYS[1]))
if not commitPointer then
  return {0}
end

local retainedSnapshotToken =
  type(commitPointer["retainedSnapshotToken"]) == "string"
    and commitPointer["retainedSnapshotToken"]
    or type(commitPointer["previousSnapshotToken"]) == "string"
    and commitPointer["previousSnapshotToken"]
    or nil
local retainedSnapshotKeyPrefix =
  type(commitPointer["retainedSnapshotKeyPrefix"]) == "string"
    and commitPointer["retainedSnapshotKeyPrefix"]
    or type(commitPointer["previousSnapshotKeyPrefix"]) == "string"
    and commitPointer["previousSnapshotKeyPrefix"]
    or nil

if not retainedSnapshotToken or not retainedSnapshotKeyPrefix then
  return {0}
end

local function read_pinned_cards_snapshot_token()
  local cardsMeta = parse_json_object(redis.call("GET", KEYS[2]))
  if cardsMeta then
    local cardsMetaSnapshot = type(cardsMeta["userSnapshot"]) == "table" and cardsMeta["userSnapshot"] or cardsMeta
    local cardsMetaToken = type(cardsMetaSnapshot["token"]) == "string" and cardsMetaSnapshot["token"] or nil
    if cardsMetaToken and string.len(cardsMetaToken) > 0 then
      return cardsMetaToken
    end
  end

  local cardsRecord = parse_json_object(redis.call("GET", KEYS[3]))
  if cardsRecord and type(cardsRecord["userSnapshot"]) == "table" then
    local cardsRecordToken = type(cardsRecord["userSnapshot"]["token"]) == "string" and cardsRecord["userSnapshot"]["token"] or nil
    if cardsRecordToken and string.len(cardsRecordToken) > 0 then
      return cardsRecordToken
    end
  end

  return nil
end

local pinnedCardsSnapshotToken = read_pinned_cards_snapshot_token()
if pinnedCardsSnapshotToken and pinnedCardsSnapshotToken == retainedSnapshotToken then
  return {0, retainedSnapshotToken}
end

for _, partName in ipairs(allParts) do
  redis.call("DEL", retainedSnapshotKeyPrefix .. ":" .. partName)
end

commitPointer["retainedSnapshotToken"] = nil
commitPointer["retainedSnapshotKeyPrefix"] = nil
commitPointer["retainedRevision"] = nil
commitPointer["retainedUpdatedAt"] = nil
commitPointer["retainedCommittedAt"] = nil
commitPointer["retainedCompleteness"] = nil
commitPointer["previousSnapshotToken"] = nil
commitPointer["previousSnapshotKeyPrefix"] = nil
commitPointer["previousRevision"] = nil
commitPointer["previousUpdatedAt"] = nil
commitPointer["previousCommittedAt"] = nil
commitPointer["previousCompleteness"] = nil

redis.call("SET", KEYS[1], cjson.encode(commitPointer))

return {1, retainedSnapshotToken}
`;

type SaveUserRecordScriptResult =
  | {
      didWrite: true;
      updatedAt: string;
      revision: number;
      snapshotToken: string;
    }
  | {
      didWrite: false;
      reason: "updated_at_conflict";
      currentRevision?: number;
      currentSnapshotToken?: string;
      currentUpdatedAt?: string;
    }
  | {
      conflictingUserId?: string;
      didWrite: false;
      reason: "username_conflict";
    };

function normalizeScriptStatus(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string") {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }

  return undefined;
}

function parseSaveUserRecordScriptResult(
  userId: string,
  result: unknown,
): SaveUserRecordScriptResult {
  if (!Array.isArray(result)) {
    throw new UserDataIntegrityError(
      userId,
      "Unexpected result from saveUserRecord atomic write",
    );
  }

  const status = normalizeScriptStatus(result[0]);
  if (status === 1) {
    const updatedAt =
      typeof result[1] === "string" && result[1].length > 0 ? result[1] : "";
    const revision = normalizeScriptStatus(result[2]);
    const snapshotToken =
      typeof result[3] === "string" && result[3].length > 0 ? result[3] : "";

    if (!updatedAt || !revision || !snapshotToken) {
      throw new UserDataIntegrityError(
        userId,
        "Unexpected result from saveUserRecord atomic write",
      );
    }

    return {
      didWrite: true,
      updatedAt,
      revision,
      snapshotToken,
    };
  }

  if (status === 0) {
    const currentRevision = normalizeScriptStatus(result[2]);
    const currentSnapshotToken =
      typeof result[3] === "string" && result[3].length > 0
        ? result[3]
        : undefined;

    return {
      didWrite: false,
      reason: "updated_at_conflict",
      currentRevision:
        typeof currentRevision === "number" && currentRevision > 0
          ? currentRevision
          : undefined,
      currentSnapshotToken,
      currentUpdatedAt:
        typeof result[1] === "string" && result[1].length > 0
          ? result[1]
          : undefined,
    };
  }

  if (status === 2) {
    return {
      didWrite: false,
      reason: "username_conflict",
      conflictingUserId:
        typeof result[1] === "string" && result[1].length > 0
          ? result[1]
          : undefined,
    };
  }

  throw new UserDataIntegrityError(
    userId,
    "Unexpected result from saveUserRecord atomic write",
  );
}

function parseScriptStringArray(
  userId: string,
  value: unknown,
  context: string,
): string[] {
  if (typeof value !== "string") {
    throw new UserDataIntegrityError(userId, context);
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(value) as unknown;
  } catch {
    throw new UserDataIntegrityError(userId, context);
  }

  if (!Array.isArray(parsed)) {
    throw new UserDataIntegrityError(userId, context);
  }

  return parsed.filter(
    (candidate): candidate is string =>
      typeof candidate === "string" && candidate.length > 0,
  );
}

function parseDeleteUserRecordScriptResult(
  userId: string,
  result: unknown,
): DeleteUserRecordResult {
  if (!Array.isArray(result)) {
    throw new UserDataIntegrityError(
      userId,
      "Unexpected result from deleteUserRecord atomic delete",
    );
  }

  const status = normalizeScriptStatus(result[0]);
  if (status !== 1) {
    throw new UserDataIntegrityError(
      userId,
      "Unexpected result from deleteUserRecord atomic delete",
    );
  }

  return {
    deletedKeys: parseScriptStringArray(
      userId,
      result[1],
      "Unexpected result from deleteUserRecord atomic delete",
    ),
    usernameIndexKeys: parseScriptStringArray(
      userId,
      result[2],
      "Unexpected result from deleteUserRecord atomic delete",
    ),
  };
}

/**
 * Saves a full UserRecord in the split format.
 */
export async function saveUserRecord(
  record: PersistedUserRecord,
  options?: {
    existingState?: PersistedUserState;
    expectedRevision?: number;
    expectedSnapshotToken?: string;
    expectedUpdatedAt?: string;
    triggerSource?: UserLifecycleAuditTriggerSource;
  },
): Promise<{ updatedAt: string; revision: number; snapshotToken: string }> {
  const split = splitUserRecord(record) as unknown as Record<
    UserDataPart,
    unknown
  >;
  const userId = String(record.userId);
  const normalizedUsername = normalizeUsernameIndexValue(record.username);
  const presentParts = Object.keys(split) as UserDataPart[];
  const completeness = buildUserPayloadCompletenessFromParts(split);
  const snapshotToken = randomUUID();
  const snapshotKeyPrefix = getUserSnapshotKeyPrefix(userId, snapshotToken);
  const expectedRevision =
    options?.expectedRevision ??
    (options?.expectedUpdatedAt &&
    options.existingState?.revision &&
    options.existingState.revision > 0
      ? options.existingState.revision
      : undefined);
  const expectedSnapshotToken =
    options?.expectedSnapshotToken ??
    (options?.expectedUpdatedAt
      ? options?.existingState?.snapshot?.token
      : undefined);
  const savePayload = {
    userId,
    username: record.username,
    normalizedUsername,
    expectedRevision,
    expectedSnapshotToken,
    expectedUpdatedAt: options?.expectedUpdatedAt,
    existingState: options?.existingState
      ? {
          revision: options.existingState.revision,
          updatedAt: options.existingState.updatedAt,
          normalizedUsername: options.existingState.normalizedUsername,
          committedAt: options.existingState.committedAt,
          snapshot: options.existingState.snapshot,
          completeness: options.existingState.completeness,
        }
      : undefined,
    storageFormat: USER_STORAGE_FORMAT,
    readShape: USER_COMMITTED_READ_SHAPE,
    schemaVersion: USER_RECORD_SCHEMA_VERSION,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
    committedAt: new Date().toISOString(),
    snapshotToken,
    snapshotKeyPrefix,
    updatedAtScore: getUpdatedAtScore(record.updatedAt),
    presentParts,
    allParts: [...ALL_USER_DATA_PARTS],
    parts: split,
    completeness,
  };

  const saveResult = parseSaveUserRecordScriptResult(
    userId,
    await redisClient.eval(
      SAVE_USER_RECORD_LUA,
      [
        getUserCommitKey(userId),
        getUserUsernameAliasSetKey(userId),
        USER_REFRESH_REGISTRY_KEY,
        USER_REFRESH_INDEX_KEY,
        getUserDataKey(userId, "meta"),
        `user:${userId}`,
        getCardsRecordMetaKey(userId),
        getCardsRecordKey(userId),
      ],
      [JSON.stringify(savePayload)],
    ),
  );

  if (!saveResult.didWrite) {
    if (saveResult.reason === "username_conflict") {
      throw new UserRecordUsernameConflictError(userId, undefined, {
        conflictingUserId: saveResult.conflictingUserId,
      });
    }

    throw new UserRecordConflictError(userId, undefined, {
      currentRevision: saveResult.currentRevision,
      currentSnapshotToken: saveResult.currentSnapshotToken,
      currentUpdatedAt: saveResult.currentUpdatedAt,
    });
  }

  await auditUserLifecycleEvent({
    action: "save",
    triggerSource: options?.triggerSource ?? "user_data_save",
    userId,
  });

  return {
    updatedAt: saveResult.updatedAt,
    revision: saveResult.revision,
    snapshotToken: saveResult.snapshotToken,
  };
}

export async function repairStaleUsernameAlias(options: {
  userId: string | number;
  attemptedUsername: string;
  canonicalUsername?: string;
  state?: PersistedUserState | null;
}): Promise<void> {
  if (!options.state?.snapshot) {
    return;
  }

  const attemptedNormalizedUsername = normalizeUsernameIndexValue(
    options.attemptedUsername,
  );
  if (!attemptedNormalizedUsername) {
    return;
  }

  const canonicalNormalizedUsername = normalizeUsernameIndexValue(
    options.canonicalUsername,
  );

  await redisClient.eval(
    REPAIR_STALE_USERNAME_ALIAS_LUA,
    [
      getUsernameIndexKey(attemptedNormalizedUsername),
      getUsernameIndexKey(
        canonicalNormalizedUsername ?? attemptedNormalizedUsername,
      ),
      getUserUsernameAliasSetKey(options.userId),
    ],
    [
      String(options.userId),
      attemptedNormalizedUsername,
      canonicalNormalizedUsername ?? "",
    ],
  );
}

/**
 * Resolves the targeted username index keys that belong to a user.
 *
 * The primary source is a per-user alias set that save paths maintain without
 * scanning the global username namespace. For older records that predate this
 * tracking key, we fall back to the currently persisted normalized username.
 */
/**
 * Deletes all persisted keys owned by a user record.
 *
 * Besides the split user payload, this also removes saved cards, 404 failure
 * tracking, and every username index that currently resolves to the same user.
 */
export async function deleteUserRecord(
  userId: string | number,
  options?: {
    triggerSource?: UserLifecycleAuditTriggerSource;
  },
): Promise<DeleteUserRecordResult> {
  const normalizedUserId = String(userId);
  const deleteResult = parseDeleteUserRecordScriptResult(
    normalizedUserId,
    await redisClient.eval(
      DELETE_USER_RECORD_LUA,
      [
        getUserCommitKey(normalizedUserId),
        getUserDataKey(normalizedUserId, "meta"),
        getUserUsernameAliasSetKey(normalizedUserId),
        `user:${normalizedUserId}`,
        `cards:${normalizedUserId}`,
        getCardsRecordMetaKey(normalizedUserId),
        `failed_updates:${normalizedUserId}`,
        USER_REFRESH_REGISTRY_KEY,
        USER_REFRESH_INDEX_KEY,
      ],
      [normalizedUserId, JSON.stringify([...ALL_USER_DATA_PARTS])],
    ),
  );
  await auditUserLifecycleEvent({
    action: "delete",
    triggerSource: options?.triggerSource ?? "user_data_delete",
    userId,
  });

  return deleteResult;
}

export async function releaseUnpinnedRetainedUserSnapshot(
  userId: string | number,
): Promise<void> {
  await redisClient.eval(
    PRUNE_UNPINNED_RETAINED_SNAPSHOT_LUA,
    [
      getUserCommitKey(userId),
      getCardsRecordMetaKey(userId),
      getCardsRecordKey(userId),
    ],
    [JSON.stringify([...ALL_USER_DATA_PARTS])],
  );
}

/**
 * Migrates a legacy user record to the new split format.
 */
export async function migrateUserRecord(
  userId: string | number,
): Promise<UserRecord | null> {
  const legacyKey = `user:${userId}`;
  const legacyDataRaw = await redisClient.get(legacyKey);

  if (!legacyDataRaw) return null;

  const record = safeParseStoredJson<UserRecord>(
    legacyDataRaw,
    userId,
    `legacy-user:${userId}`,
  );

  await saveUserRecord(record, {
    existingState: buildPersistedStateFromLegacyRecord(userId, record),
    triggerSource: "legacy_migration",
  });

  return record;
}

/**
 * Fetches specific parts of user data, migrating if necessary.
 */
export async function fetchUserDataParts(
  userId: string | number,
  parts: UserDataPart[],
  options?: {
    audit?: boolean;
    awaitAudit?: boolean;
    triggerSource?: UserLifecycleAuditTriggerSource;
  },
): Promise<Partial<Record<UserDataPart, unknown>>> {
  const result = await fetchUserDataSnapshot(userId, parts, options);

  return result.parts;
}

export async function fetchUserDataSnapshot(
  userId: string | number,
  parts: UserDataPart[],
  options?: {
    audit?: boolean;
    awaitAudit?: boolean;
    expectedSnapshotToken?: string;
    expectedUpdatedAt?: string;
    triggerSource?: UserLifecycleAuditTriggerSource;
  },
): Promise<UserDataReadResult> {
  const shouldAudit = options?.audit !== false;
  const result = await loadLegacyCompatibleUserDataParts(userId, parts, {
    expectedSnapshotToken: options?.expectedSnapshotToken,
    expectedUpdatedAt: options?.expectedUpdatedAt,
  });
  if (shouldAudit && Object.keys(result.parts).length > 0) {
    const auditOptions = {
      action: "access" as const,
      triggerSource: options?.triggerSource ?? "user_data_fetch",
      userId,
    };

    if (options?.awaitAudit) {
      await auditUserLifecycleEvent(auditOptions);
    } else {
      scheduleUserLifecycleAuditEvent(auditOptions);
    }
  }

  return result;
}

/**
 * Mapping of card types to the user data parts they require.
 */
export const CARD_TYPE_TO_PARTS: Record<string, UserDataPart[]> = {
  animeStats: ["meta", "statistics"],
  mangaStats: ["meta", "statistics"],
  socialStats: ["meta", "activity", "pages"],
  socialMilestones: ["meta", "pages"],
  animeGenres: ["meta", "statistics"],
  animeTags: ["meta", "statistics"],
  animeVoiceActors: ["meta", "statistics", "favourites"],
  animeStudios: ["meta", "statistics", "favourites"],
  animeStaff: ["meta", "statistics", "favourites"],
  mangaGenres: ["meta", "statistics"],
  mangaTags: ["meta", "statistics"],
  mangaStaff: ["meta", "statistics", "favourites"],
  animeStatusDistribution: ["meta", "statistics"],
  mangaStatusDistribution: ["meta", "statistics"],
  animeFormatDistribution: ["meta", "statistics"],
  mangaFormatDistribution: ["meta", "statistics"],
  animeScoreDistribution: ["meta", "statistics"],
  mangaScoreDistribution: ["meta", "statistics"],
  animeYearDistribution: ["meta", "statistics"],
  mangaYearDistribution: ["meta", "statistics"],
  animeCountry: ["meta", "statistics"],
  mangaCountry: ["meta", "statistics"],
  animeSourceMaterialDistribution: ["meta", "aggregates"],
  animeSeasonalPreference: ["meta", "aggregates"],
  animeGenreSynergy: ["meta", "aggregates"],
  studioCollaboration: ["meta", "aggregates"],
  profileOverview: ["meta", "statistics"],
  favoritesSummary: ["meta", "favourites"],
  favoritesGrid: ["meta", "favourites"],
  recentActivitySummary: ["meta", "activity"],
  activityStreaks: ["meta", "activity"],
  topActivityDays: ["meta", "activity"],
  statusCompletionOverview: ["meta", "statistics"],
  milestones: ["meta", "statistics"],
  personalRecords: ["meta", "completed", "rewatched"],
  planningBacklog: ["meta", "planning"],
  mostRewatched: ["meta", "rewatched"],
  currentlyWatchingReading: ["meta", "current"],
  animeMangaOverview: ["meta", "statistics"],
  scoreCompareAnimeManga: ["meta", "statistics"],
  countryDiversity: ["meta", "statistics"],
  genreDiversity: ["meta", "statistics"],
  formatPreferenceOverview: ["meta", "statistics"],
  releaseEraPreference: ["meta", "statistics"],
  startYearMomentum: ["meta", "statistics"],
  lengthPreference: ["meta", "statistics"],
  animeEpisodeLengthPreferences: ["meta", "statistics"],
  tagCategoryDistribution: ["meta", "statistics"],
  tagDiversity: ["meta", "statistics"],
  seasonalViewingPatterns: ["meta", "activity"],
  droppedMedia: ["meta", "completed"],
  reviewStats: ["meta", "pages"],
};

/**
 * Gets the required user data parts for a given card name.
 */
export function getPartsForCard(cardName: string): UserDataPart[] {
  const [baseCardType] = cardName.split("-");
  return (
    CARD_TYPE_TO_PARTS[baseCardType] || [
      "meta",
      "activity",
      "favourites",
      "statistics",
      "pages",
      "planning",
      "current",
      "rewatched",
      "completed",
    ]
  );
}
