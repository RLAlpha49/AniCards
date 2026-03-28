/**
 * Redis persistence helpers for split user-record storage.
 *
 * User data is stored in coarse-grained parts instead of one large blob so card
 * rendering can fetch only the sections each card needs, while still supporting
 * reconstruction and legacy-record migration when older keys are encountered.
 */
import {
  buildPersistedRequestMetadata,
  logPrivacySafe,
  redisClient,
} from "@/lib/api-utils";
import {
  AnimeGenreSynergyTotalsEntry,
  FollowersPage,
  FollowingPage,
  MediaListCollection,
  PersistedRequestMetadata,
  PersistedUserRecord,
  PublicUserRecord,
  ReconstructedUserRecord,
  ReviewsPage,
  SeasonalPreferenceTotalsEntry,
  SourceMaterialDistributionTotalsEntry,
  StudioCollaborationTotalsEntry,
  ThreadCommentsPage,
  ThreadsPage,
  UserAvatar,
  UserBootstrapRecord,
  UserRecommendationsPage,
  UserRecord,
  UserReviewsPage,
  UserSection,
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
const USER_REFRESH_INDEX_KEY = "users:stale-by-updated-at";
const USER_REFRESH_REGISTRY_KEY = "users:known-ids";
const USER_LIFECYCLE_AUDIT_KEY = "telemetry:user-lifecycle-audit:v1";
const MAX_USER_LIFECYCLE_AUDIT_EVENTS = 250;
const LEGACY_USER_MIGRATION_LOCK_TTL_SECONDS = 30;

const getUserCommitKey = (userId: string | number) => `user:${userId}:commit`;
const getLegacyUserMigrationLockKey = (userId: string | number) =>
  `user:${userId}:migrating`;
const getUserUsernameAliasSetKey = (userId: string | number) =>
  `user:${userId}:username-aliases`;
const getUsernameIndexKey = (normalizedUsername: string) =>
  `username:${normalizedUsername}`;

interface UserCommitPointer {
  userId: string;
  storageFormat: typeof USER_STORAGE_FORMAT;
  schemaVersion: number;
  revision: number;
  createdAt: string;
  updatedAt: string;
  username?: string;
  usernameNormalized?: string;
  committedAt: string;
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

function normalizeTrackedUsernameAliases(values: Iterable<unknown>): string[] {
  const aliases = new Set<string>();

  for (const value of values) {
    const normalized = normalizeUsernameIndexValue(value);
    if (normalized) {
      aliases.add(normalized);
    }
  }

  return [...aliases];
}

function buildUsernameIndexKeys(aliases: Iterable<string>): string[] {
  return [...aliases].map((alias) => getUsernameIndexKey(alias));
}

async function readTrackedUsernameAliases(
  userId: string | number,
  currentState?: PersistedUserState | null,
): Promise<string[]> {
  const storedAliases = await redisSetClient.smembers(
    getUserUsernameAliasSetKey(userId),
  );

  return normalizeTrackedUsernameAliases([
    ...(Array.isArray(storedAliases) ? storedAliases : []),
    currentState?.normalizedUsername,
  ]);
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

async function appendUserLifecycleAuditEntry(entry: UserLifecycleAuditEntry) {
  try {
    await redisClient.rpush(USER_LIFECYCLE_AUDIT_KEY, JSON.stringify(entry));
    await redisClient.ltrim(
      USER_LIFECYCLE_AUDIT_KEY,
      -MAX_USER_LIFECYCLE_AUDIT_EVENTS,
      -1,
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
    timestamp: new Date().toISOString(),
    triggerSource: options.triggerSource,
    userId: String(options.userId),
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
  };
}

function parseUserCommitPointer(
  userId: string | number,
  raw: unknown,
): UserCommitPointer {
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

  return {
    userId: String(parsed.userId ?? userId),
    storageFormat: USER_STORAGE_FORMAT,
    schemaVersion:
      typeof parsed.schemaVersion === "number" && parsed.schemaVersion > 0
        ? parsed.schemaVersion
        : USER_RECORD_SCHEMA_VERSION,
    revision,
    createdAt: typeof parsed.createdAt === "string" ? parsed.createdAt : "",
    updatedAt: typeof parsed.updatedAt === "string" ? parsed.updatedAt : "",
    username: typeof parsed.username === "string" ? parsed.username : undefined,
    usernameNormalized: normalizeUsernameIndexValue(parsed.usernameNormalized),
    committedAt:
      typeof parsed.committedAt === "string"
        ? parsed.committedAt
        : new Date().toISOString(),
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
    return buildPersistedUserState({
      userId: commitPointer.userId,
      storageFormat: "split",
      schemaVersion: commitPointer.schemaVersion,
      revision: commitPointer.revision,
      createdAt: commitPointer.createdAt,
      updatedAt: commitPointer.updatedAt,
      username: commitPointer.username,
      normalizedUsername: commitPointer.usernameNormalized,
    });
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

async function loadCommittedUserDataParts(
  userId: string | number,
  parts: UserDataPart[],
  commitPointer: UserCommitPointer,
): Promise<Partial<Record<UserDataPart, unknown>>> {
  const splitLoaded = await loadStoredUserDataParts(
    userId,
    parts,
    (part) => getUserDataKey(userId, part),
    `split-user:${commitPointer.revision}`,
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
    { revision: commitPointer.revision },
  );
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
): Promise<Partial<Record<UserDataPart, unknown>>> {
  const legacyRaw = await redisClient.get(`user:${userId}`);
  if (!legacyRaw) {
    return {};
  }

  const legacyRecord = safeParseStoredJson<UserRecord>(
    legacyRaw,
    userId,
    `legacy-user:${userId}`,
  );

  return selectRequestedUserDataParts(
    parts,
    splitUserRecord(legacyRecord) as Partial<Record<UserDataPart, unknown>>,
  );
}

async function tryAcquireLegacyUserMigrationLock(
  userId: string | number,
): Promise<string | null> {
  const lockKey = getLegacyUserMigrationLockKey(userId);
  const token = `${Date.now()}:${Math.random().toString(36).slice(2)}`;
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
): Promise<Partial<Record<UserDataPart, unknown>>> {
  const commitPointer = await readUserCommitPointer(userId);
  if (commitPointer) {
    return loadCommittedUserDataParts(userId, parts, commitPointer);
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

    return loaded.data;
  }

  return loadRequestedPartsFromLegacyRecord(userId, parts);
}

async function migrateLegacyUserDataPartsWithLock(
  userId: string | number,
  parts: UserDataPart[],
): Promise<Partial<Record<UserDataPart, unknown>>> {
  const migrationLockToken = await tryAcquireLegacyUserMigrationLock(userId);
  if (!migrationLockToken) {
    return loadLegacyCompatibleUserDataPartsWithoutSaving(userId, parts);
  }

  try {
    const commitPointer = await readUserCommitPointer(userId);
    if (commitPointer) {
      return loadCommittedUserDataParts(userId, parts, commitPointer);
    }

    const migratedRecord = await migrateUserRecord(userId);
    if (!migratedRecord) {
      return loadLegacyCompatibleUserDataPartsWithoutSaving(userId, parts);
    }

    return selectRequestedUserDataParts(
      parts,
      splitUserRecord(migratedRecord) as Partial<Record<UserDataPart, unknown>>,
    );
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
): Promise<Partial<Record<UserDataPart, unknown>>> {
  const loaded = await loadStoredUserDataParts(
    userId,
    parts,
    (part) => getUserDataKey(userId, part),
    "legacy-split-user",
  );

  if (!loaded.foundAnyRequestedPart) {
    return migrateLegacyUserDataPartsWithLock(userId, parts);
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

  return loaded.data;
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

export async function listStalestUserIds(
  limit: number,
): Promise<{ userIds: string[]; totalUsers: number }> {
  let totalUsers = Number(
    await redisSortedSetClient.zcard(USER_REFRESH_INDEX_KEY),
  );

  if (totalUsers === 0) {
    totalUsers = await rebuildUserRefreshIndex();
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
 * Reconstructs the bounded public DTO returned by `/api/get-user`.
 */
export function reconstructPublicUserRecord(
  parts: Partial<Record<UserDataPart, unknown>>,
): PublicUserRecord {
  const record = reconstructUserRecord(parts);

  return {
    userId: record.userId,
    username: record.username,
    stats: record.stats,
    statistics: record.statistics,
    favourites: record.favourites,
    pages: record.pages,
    ...(record.aggregates ? { aggregates: record.aggregates } : {}),
  };
}

/**
 * Reconstructs the lightweight bootstrap DTO returned by `/api/get-user?view=bootstrap`.
 */
export function reconstructUserBootstrapRecord(
  parts: Partial<Record<UserDataPart, unknown>>,
): UserBootstrapRecord {
  const meta = parts.meta as UserMeta | undefined;

  return {
    userId: meta?.userId || "",
    username: meta?.username,
    avatarUrl: meta?.avatar?.medium || meta?.avatar?.large || null,
  };
}

/**
 * Saves a full UserRecord in the split format.
 */
export async function saveUserRecord(
  record: PersistedUserRecord,
  options?: {
    existingState?: PersistedUserState;
    triggerSource?: UserLifecycleAuditTriggerSource;
  },
): Promise<{ updatedAt: string; revision: number }> {
  const currentState =
    options && Object.hasOwn(options, "existingState")
      ? options.existingState
      : await getPersistedUserState(record.userId);
  const split = splitUserRecord(record) as unknown as Record<
    UserDataPart,
    unknown
  >;
  const userId = String(record.userId);
  const nextRevision = Math.max(0, currentState?.revision ?? 0) + 1;
  const normalizedUsername = normalizeUsernameIndexValue(record.username);
  const previousNormalizedUsername = currentState?.normalizedUsername;
  const trackedUsernameAliases = await readTrackedUsernameAliases(
    userId,
    currentState,
  );
  const knownUsernameAliases = normalizeTrackedUsernameAliases([
    ...trackedUsernameAliases,
    previousNormalizedUsername,
    normalizedUsername,
  ]);
  const pipeline = redisClient.pipeline() as unknown as RedisPipeline;
  const presentParts = Object.keys(split) as UserDataPart[];
  const missingParts = ALL_USER_DATA_PARTS.filter(
    (part) => !Object.hasOwn(split, part),
  );

  const meta = split.meta as UserMeta & Record<string, unknown>;
  meta.schemaVersion = USER_RECORD_SCHEMA_VERSION;
  meta.revision = nextRevision;
  meta.storageFormat = USER_STORAGE_FORMAT;
  if (normalizedUsername) {
    meta.usernameNormalized = normalizedUsername;
  } else {
    delete meta.usernameNormalized;
  }

  const commitPointer: UserCommitPointer = {
    userId,
    storageFormat: USER_STORAGE_FORMAT,
    schemaVersion: USER_RECORD_SCHEMA_VERSION,
    revision: nextRevision,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
    ...(record.username ? { username: record.username } : {}),
    ...(normalizedUsername ? { usernameNormalized: normalizedUsername } : {}),
    committedAt: new Date().toISOString(),
  };

  presentParts.forEach((part) => {
    pipeline.set(getUserDataKey(userId, part), JSON.stringify(split[part]));
  });

  pipeline.sadd(USER_REFRESH_REGISTRY_KEY, userId);

  if (knownUsernameAliases.length > 0) {
    pipeline.sadd(getUserUsernameAliasSetKey(userId), ...knownUsernameAliases);
  }

  if (normalizedUsername) {
    pipeline.set(getUsernameIndexKey(normalizedUsername), userId);
  }

  pipeline.zadd(USER_REFRESH_INDEX_KEY, {
    score: getUpdatedAtScore(record.updatedAt),
    member: userId,
  });

  pipeline.set(getUserCommitKey(userId), JSON.stringify(commitPointer));

  const staleAliasKeys = buildUsernameIndexKeys(
    knownUsernameAliases.filter((alias) => alias !== normalizedUsername),
  );
  if (staleAliasKeys.length > 0) {
    pipeline.del(...staleAliasKeys);
  }

  const staleSplitKeys = missingParts.map((part) =>
    getUserDataKey(userId, part),
  );

  pipeline.del(`user:${userId}`, ...staleSplitKeys);

  await pipeline.exec();
  await auditUserLifecycleEvent({
    action: "save",
    triggerSource: options?.triggerSource ?? "user_data_save",
    userId,
  });

  return {
    updatedAt: record.updatedAt,
    revision: nextRevision,
  };
}

/**
 * Resolves the targeted username index keys that belong to a user.
 *
 * The primary source is a per-user alias set that save paths maintain without
 * scanning the global username namespace. For older records that predate this
 * tracking key, we fall back to the currently persisted normalized username.
 */
async function findUsernameIndexKeysForUser(
  userId: string | number,
): Promise<string[]> {
  let currentState: PersistedUserState | null = null;

  try {
    currentState = await getPersistedUserState(userId);
  } catch (error) {
    if (error instanceof UserDataIntegrityError) {
      logPrivacySafe(
        "warn",
        "User Data",
        "Continuing delete with username-alias fallback after persisted state read failed",
        {
          userId,
          error: error.message,
        },
      );
    } else {
      throw error;
    }
  }

  const usernameAliases = await readTrackedUsernameAliases(
    userId,
    currentState,
  );
  return buildUsernameIndexKeys(usernameAliases);
}

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
  const usernameIndexKeys = await findUsernameIndexKeysForUser(userId);
  const normalizedUserId = String(userId);
  const keys = ALL_USER_DATA_PARTS.map((part) => getUserDataKey(userId, part));
  keys.push(
    getUserCommitKey(userId),
    getUserUsernameAliasSetKey(userId),
    `user:${userId}`,
    `cards:${userId}`,
    `failed_updates:${userId}`,
    ...usernameIndexKeys,
  );
  await Promise.all([
    redisClient.del(...keys),
    redisSortedSetClient.zrem(USER_REFRESH_INDEX_KEY, normalizedUserId),
    redisSetClient.srem(USER_REFRESH_REGISTRY_KEY, normalizedUserId),
  ]);
  await auditUserLifecycleEvent({
    action: "delete",
    triggerSource: options?.triggerSource ?? "user_data_delete",
    userId,
  });

  return {
    deletedKeys: keys,
    usernameIndexKeys,
  };
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
    triggerSource?: UserLifecycleAuditTriggerSource;
  },
): Promise<Partial<Record<UserDataPart, unknown>>> {
  const commitPointer = await readUserCommitPointer(userId);
  if (commitPointer) {
    const data = await loadCommittedUserDataParts(userId, parts, commitPointer);
    if (Object.keys(data).length > 0) {
      await auditUserLifecycleEvent({
        action: "access",
        triggerSource: options?.triggerSource ?? "user_data_fetch",
        userId,
      });
    }
    return data;
  }

  const data = await loadLegacyCompatibleUserDataParts(userId, parts);
  if (Object.keys(data).length > 0) {
    await auditUserLifecycleEvent({
      action: "access",
      triggerSource: options?.triggerSource ?? "user_data_fetch",
      userId,
    });
  }
  return data;
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
  animeSourceMaterialDistribution: [
    "meta",
    "current",
    "completed",
    "aggregates",
  ],
  animeSeasonalPreference: ["meta", "current", "completed", "aggregates"],
  animeGenreSynergy: ["meta", "aggregates"],
  studioCollaboration: ["meta", "completed", "aggregates"],
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
