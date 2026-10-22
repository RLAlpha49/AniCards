import { mgetInBatches, redisClient, scanAllKeys } from "@/lib/api-utils";
import {
  queryCardKeys,
  queryUserMetaKeys,
  USERS_SEARCH_INDEX,
} from "@/lib/server/search-indexes";
import {
  resolveLatestTimestamp,
  isValidTimestamp,
} from "@/lib/server/card-version";
import type { Redis as UpstashRedis } from "@upstash/redis";
import {
  UserRecord,
  UserStatsData,
  UserSection,
  UserAvatar,
  FollowersPage,
  FollowingPage,
  ThreadsPage,
  ThreadCommentsPage,
  ReviewsPage,
  UserReviewsPage,
  UserRecommendationsPage,
  MediaListCollection,
  ReconstructedUserRecord,
  SourceMaterialDistributionTotalsEntry,
  SeasonalPreferenceTotalsEntry,
  AnimeGenreSynergyTotalsEntry,
  StudioCollaborationTotalsEntry,
} from "@/lib/types/records";

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

/** Builds the Redis key holding a user's stored card configurations. */
const getUserCardsKey = (userId: string | number): string => `cards:${userId}`;

/** The ten parts a user record is split into. */
export const USER_DATA_PARTS: UserDataPart[] = [
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

/**
 * Sorted set of user IDs scored by their last update time. The refresh cron
 * reads the lowest scores with one ZRANGE to pick the stalest users instead of
 * scanning the key space and reading every meta part on each run.
 */
export const USER_REFRESH_INDEX_KEY = "users:refresh-index";

/**
 * Score given to a user whose `updatedAt` is missing or unreadable. It sorts
 * above every real timestamp, so an unusable record waits until the readable
 * records have been refreshed instead of occupying the head of the queue. The
 * cron's batch window is small, so a broken record parked at the head would
 * keep real work out of every run.
 * @source
 */
export const USER_REFRESH_INDEX_UNREADABLE_SCORE = Number.MAX_SAFE_INTEGER;

/**
 * Converts a stored updatedAt value into the refresh index score. Values that
 * do not parse take {@link USER_REFRESH_INDEX_UNREADABLE_SCORE}, which sorts
 * them after every record with a readable timestamp.
 * @param updatedAt - Timestamp stored on the user record.
 * @returns Millisecond timestamp, or the unreadable-score sentinel.
 * @source
 */
export function getUpdatedAtScore(
  updatedAt: string | number | undefined,
): number {
  const timestamp = new Date(updatedAt || 0).getTime();
  if (!Number.isFinite(timestamp) || timestamp <= 0) {
    return USER_REFRESH_INDEX_UNREADABLE_SCORE;
  }
  return timestamp;
}

/**
 * Maximum number of meta keys read and scored in one rebuild round trip. The
 * scan pages keys at the same size, so each round trip carries one page.
 * @source
 */
const REFRESH_INDEX_REBUILD_CHUNK_SIZE = 1000;

/**
 * Most meta keys the search index may return for one rebuild.
 *
 * The index query caps paging at an offset of 10,000, so this is the largest
 * key set it can return completely. A database past that size falls back to
 * the scan, which has no such ceiling. A partial listing is never used: the
 * rebuild would drop live users from the refresh index.
 * @source
 */
const SEARCH_REBUILD_KEY_LIMIT = 10_000;

/**
 * Lists `user:<id>:meta` keys.
 *
 * The search index answers this in a bounded number of round trips, which is
 * what the scan was standing in for. A missing index, an unsupported command,
 * or a result set past {@link SEARCH_REBUILD_KEY_LIMIT} all fall back to the
 * scan, so the repair behaves the same on a database without the index.
 *
 * The listing is expected to be identical to the scan. A document with no
 * schema field is not searchable, so a meta whose `updatedAt` is missing still
 * appears as long as it carries `userId`, and one carrying no schema field at
 * all is not a record `saveUserRecord` can produce.
 *
 * @param onScanPage - Callback invoked after each scan page, used only on the
 *   fallback path.
 * @returns The meta keys.
 * @source
 */
async function listUserMetaKeys(onScanPage?: () => void): Promise<string[]> {
  const indexed = await queryUserMetaKeys(
    redisClient,
    SEARCH_REBUILD_KEY_LIMIT,
  );
  if (indexed && !indexed.truncated) return indexed.keys;

  if (indexed?.truncated) {
    console.warn(
      `[Redis Search] ${USERS_SEARCH_INDEX} returned more than ${SEARCH_REBUILD_KEY_LIMIT} metas; falling back to the scan.`,
    );
  }

  return scanAllKeys(
    "user:*:meta",
    REFRESH_INDEX_REBUILD_CHUNK_SIZE,
    onScanPage,
  );
}

/**
 * Reads the `updatedAt` field out of a stored meta value.
 *
 * A field that is present but does not parse as a date counts as unreadable
 * too, so the rebuild's counter reports the same condition that gives the
 * entry its sentinel score.
 *
 * @param meta - Raw meta value returned by Redis.
 * @returns The stored timestamp, or undefined when it is absent or unreadable.
 * @source
 */
function readStoredUpdatedAt(
  meta: Record<string, unknown> | string,
): string | number | undefined {
  try {
    const parsed: unknown = typeof meta === "string" ? JSON.parse(meta) : meta;
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      const value = (parsed as Record<string, unknown>).updatedAt;
      if (typeof value === "string" || typeof value === "number") {
        return getUpdatedAtScore(value) === USER_REFRESH_INDEX_UNREADABLE_SCORE
          ? undefined
          : value;
      }
    }
  } catch {
    // Fall through to undefined; the caller counts it as unreadable.
  }
  return undefined;
}

const REMOVE_USERNAME_INDEX_IF_OWNED_SCRIPT = `
  if redis.call("GET", KEYS[1]) == ARGV[1] then
    return redis.call("DEL", KEYS[1])
  end
  return 0
`;

export function buildUsernameIndexKey(
  username: string | undefined,
): string | null {
  const normalizedUsername = username?.trim().toLowerCase();
  return normalizedUsername ? `username:${normalizedUsername}` : null;
}

export async function syncUsernameIndex(
  redisClient: UpstashRedis,
  previousUsernameIndexKey: string | null,
  currentUsernameIndexKey: string | null,
  userId: string | number,
): Promise<boolean> {
  const userIdValue = String(userId);
  if (currentUsernameIndexKey) {
    await redisClient.set(currentUsernameIndexKey, userIdValue);
  }

  if (
    !previousUsernameIndexKey ||
    previousUsernameIndexKey === currentUsernameIndexKey
  ) {
    return false;
  }

  const removed = await redisClient.eval<[string], number>(
    REMOVE_USERNAME_INDEX_IF_OWNED_SCRIPT,
    [previousUsernameIndexKey],
    [userIdValue],
  );

  return removed === 1;
}

interface UserMeta {
  userId: string;
  username?: string;
  createdAt: string;
  updatedAt: string;
  dataUpdatedAt?: string;
  name?: string;
  avatar?: UserAvatar;
  userCreatedAt?: number;
}

/**
 * Meta fields that advance on a write without changing what a card renders.
 *
 * Every refresh writes `updatedAt` so the user rotates to the back of the
 * refresh queue, which means the meta part cannot be compared as-is when the
 * question is whether rendered content changed.
 *
 * @source
 */
const VOLATILE_META_FIELDS = ["updatedAt", "dataUpdatedAt"] as const;

/**
 * Serializes a meta part with the volatile timestamps removed.
 *
 * Stored values arrive parsed from the Upstash client and values being written
 * are plain objects, so both sides are normalized the same way before they are
 * compared.
 *
 * @param value - A meta part, parsed or as raw JSON.
 * @returns The meta fields a card can render, as JSON.
 * @source
 */
function serializeStableMeta(value: unknown): string {
  let parsed: unknown = value;
  if (typeof value === "string") {
    try {
      parsed = JSON.parse(value);
    } catch {
      return value;
    }
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    return JSON.stringify(parsed);
  }

  const stable = { ...(parsed as Record<string, unknown>) };
  for (const field of VOLATILE_META_FIELDS) delete stable[field];
  return JSON.stringify(stable);
}

interface UserAggregates {
  animeSourceMaterialDistributionTotals?: SourceMaterialDistributionTotalsEntry[];
  animeSeasonalPreferenceTotals?: SeasonalPreferenceTotalsEntry[];
  animeGenreSynergyTotals?: AnimeGenreSynergyTotalsEntry[];
  studioCollaborationTotals?: StudioCollaborationTotalsEntry[];
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

  const metaBaseRest = { ...(metaBase as Record<string, unknown>) };
  delete metaBaseRest.ip;

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
  const activity = parts.activity as UserSection["stats"] | undefined;
  const favourites = parts.favourites as UserSection["favourites"] | undefined;
  const statisticsPart = parts.statistics as
    UserSection["statistics"] | null | undefined;

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
  const {
    userId: _u,
    username: _un,
    updatedAt: _ua,
    dataUpdatedAt: _da,
    ip: _legacyIp,
    createdAt: _c,
    name: _n,
    avatar: _a,
    userCreatedAt: _uc,
    ...rest
  } = tmpMeta || {};
  const aggregates = parts.aggregates as UserAggregates | undefined;

  return {
    userId: meta?.userId || "",
    username: meta?.username,
    createdAt: meta?.createdAt || "",
    updatedAt: meta?.updatedAt || "",
    dataUpdatedAt:
      typeof meta?.dataUpdatedAt === "string" &&
      isValidTimestamp(meta.dataUpdatedAt)
        ? meta.dataUpdatedAt
        : undefined,
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
 * Collects the parts whose serialized value differs from what is stored.
 *
 * The comparison is on the stored bytes, so a caller can ask whether a write
 * would change anything a card renders before it commits to new timestamps.
 *
 * @param record - The record as it would be stored.
 * @param storedParts - Parts already read for this user.
 * @returns Each changed part with the value to write, in storage order.
 * @source
 */
function collectChangedParts(
  record: UserRecord,
  storedParts: Partial<Record<UserDataPart, unknown>>,
): [UserDataPart, string][] {
  const split = splitUserRecord(record) as unknown as Record<
    UserDataPart,
    unknown
  >;
  const changed: [UserDataPart, string][] = [];
  for (const part of Object.keys(split) as UserDataPart[]) {
    const serialized = JSON.stringify(split[part]);
    const stored = storedParts[part];
    if (stored === undefined || JSON.stringify(stored) !== serialized) {
      changed.push([part, serialized]);
    }
  }
  return changed;
}

/**
 * Reports whether a save would change anything a card renders.
 *
 * Timestamps are excluded, so a scheduled refresh that rewrote the same stats
 * reports no change even though it advances `updatedAt`. Username and avatar
 * live in meta and are compared, because a card draws them.
 *
 * @param record - The record as it would be stored.
 * @param storedParts - Parts already read for this user.
 * @returns True when some rendered part differs from what is stored.
 * @source
 */
export function userRecordContentChanged(
  record: UserRecord,
  storedParts: Partial<Record<UserDataPart, unknown>>,
): boolean {
  const split = splitUserRecord(record) as unknown as Record<
    UserDataPart,
    unknown
  >;

  for (const part of Object.keys(split) as UserDataPart[]) {
    const stored = storedParts[part];
    if (stored === undefined) return true;

    const same =
      part === "meta"
        ? serializeStableMeta(split[part]) === serializeStableMeta(stored)
        : JSON.stringify(split[part]) === JSON.stringify(stored);
    if (!same) return true;
  }

  return false;
}

/**
 * Saves a full UserRecord in the split format. A save that writes any part
 * also rescores the user in the refresh index.
 *
 * Writes only the parts whose serialized value differs from what is already
 * stored, so a refresh that changes one section leaves the other parts alone.
 * The comparison needs the parts as they are stored, so every caller reads
 * them for the user first; passing them in also keeps that read to one MGET in
 * the caller's own flow instead of a second one here.
 *
 * @param record - The record to persist.
 * @param storedParts - Parts already read for this user, used as the
 *   write baseline.
 * @source
 */
export async function saveUserRecord(
  record: UserRecord,
  storedParts: Partial<Record<UserDataPart, unknown>>,
): Promise<void> {
  const changed = collectChangedParts(record, storedParts);

  if (changed.length === 0) return;

  // The stored version wins whenever it is the later of the two. Two writers
  // can hold different versions for the same user at the same time, and the
  // one that writes last is not necessarily the one holding the newer
  // version. Letting the older one win would move the card URL backwards and
  // hide a change that actually happened.
  const storedMeta = storedParts.meta as Record<string, unknown> | undefined;
  const storedVersion =
    typeof storedMeta?.dataUpdatedAt === "string"
      ? storedMeta.dataUpdatedAt
      : undefined;
  const latestVersion = resolveLatestTimestamp(
    record.dataUpdatedAt,
    storedVersion,
  );

  const pipeline = redisClient.pipeline();
  for (const [part, value] of changed) {
    if (part === "meta" && latestVersion !== record.dataUpdatedAt) {
      // The meta part carries the version, so it has to carry the version
      // that is actually being stored.
      const meta = JSON.parse(value) as Record<string, unknown>;
      if (latestVersion === undefined) {
        delete meta.dataUpdatedAt;
      } else {
        meta.dataUpdatedAt = latestVersion;
      }
      pipeline.set(getUserDataKey(record.userId, part), JSON.stringify(meta));
      continue;
    }
    pipeline.set(getUserDataKey(record.userId, part), value);
  }
  // Rewriting meta always changes updatedAt, so a save that writes any part
  // also moves the user to the back of the refresh queue.
  pipeline.zadd(USER_REFRESH_INDEX_KEY, {
    score: getUpdatedAtScore(record.updatedAt),
    member: String(record.userId),
  });

  await pipeline.exec();
}

/**
 * Reads the username stored in a user's meta part.
 * @param meta - Raw meta value returned by Redis.
 * @returns The stored username, or null when it is absent or unreadable.
 */
function readStoredUsername(meta: unknown): string | null {
  if (meta === null || meta === undefined) return null;
  let parsed: unknown = meta;
  if (typeof parsed === "string") {
    try {
      parsed = JSON.parse(parsed);
    } catch {
      return null;
    }
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    return null;
  }
  const username = (parsed as Record<string, unknown>).username;
  return typeof username === "string" && username.trim() ? username : null;
}

/**
 * Reads the username held by a user's meta part for a deletion.
 *
 * A read failure is treated as a missing username, because the deletion then
 * falls back to searching the index. Throwing here would leave every key of
 * the user in place over a single failed read.
 *
 * @param metaKey - Key of the user's meta part.
 * @returns The stored username, or null when it cannot be read.
 */
async function readStoredUsernameForDeletion(
  metaKey: string,
): Promise<string | null> {
  try {
    return readStoredUsername(await redisClient.get(metaKey));
  } catch (error) {
    console.warn(
      `⚠️ [User Data] Failed to read ${metaKey} during deletion; falling back to the username index: ${
        error instanceof Error ? error.message : String(error)
      }`,
    );
    return null;
  }
}

/**
 * Removes every Redis key that belongs to one user.
 *
 * One function owns the deletion contract, so a caller cannot remove part of
 * a user and leave the rest behind. The keys a user owns are the ten record
 * parts, the refresh index entry, `cards:<id>`, and `username:<name>`. The
 * username key is removed with the compare-and-delete script, so a name that
 * has since been taken by another user is kept.
 *
 * @param userId - Numeric AniList user ID.
 * @returns Whether any username key was removed.
 */
export async function deleteUserStorage(
  userId: string | number,
): Promise<{ usernameKeyRemoved: boolean }> {
  const userIdValue = String(userId);
  const metaKey = getUserDataKey(userIdValue, "meta");
  // A failed meta read must not abort the deletion: the index search below
  // still finds the username key, so the rest of the record is removed too.
  const username = await readStoredUsernameForDeletion(metaKey);

  const pipeline = redisClient.pipeline();
  pipeline.del(
    ...USER_DATA_PARTS.map((part) => getUserDataKey(userIdValue, part)),
  );
  pipeline.del(getUserCardsKey(userIdValue));
  pipeline.zrem(USER_REFRESH_INDEX_KEY, userIdValue);
  await pipeline.exec();

  // The meta part is the only place that names the username key. When it is
  // already gone, the index is searched instead, which is what left the
  // sampled stale key behind when the cron removed an unreadable record.
  const usernameKeys = username
    ? [buildUsernameIndexKey(username)].filter((key): key is string => !!key)
    : await findUsernameIndexKeysOwnedBy(userIdValue);

  let usernameKeyRemoved = false;
  for (const key of usernameKeys) {
    const removed = await redisClient.eval<[string], number>(
      REMOVE_USERNAME_INDEX_IF_OWNED_SCRIPT,
      [key],
      [userIdValue],
    );
    if (removed === 1) usernameKeyRemoved = true;
  }

  return { usernameKeyRemoved };
}

/**
 * Finds username index entries that point at one user.
 *
 * Used when the user's meta part is gone, so the username cannot be read from
 * the record. Only an entry whose value equals the user ID is returned, which
 * makes the removal safe even though the name is unknown.
 *
 * @param userId - User ID to match against entry values.
 * @returns Matching `username:` keys, or an empty list when the scan fails.
 */
async function findUsernameIndexKeysOwnedBy(userId: string): Promise<string[]> {
  try {
    const keys = await scanAllKeys("username:*");
    if (keys.length === 0) return [];
    const owners = await redisClient.mget<(string | number | null)[]>(...keys);
    return keys.filter((_, index) => {
      const owner = owners[index];
      return owner !== null && owner !== undefined && String(owner) === userId;
    });
  } catch (error) {
    console.warn(
      `⚠️ [User Data] Failed to search the username index for user ${userId}: ${
        error instanceof Error ? error.message : String(error)
      }`,
    );
    return [];
  }
}

/**
 * Counts of orphaned keys found or removed by {@link reconcileUserKeyOrphans}.
 */
export interface UserKeyReconciliationResult {
  /** `cards:` keys scanned. */
  cardsKeysScanned: number;
  /** `cards:` keys whose owner has no record. */
  orphanedCardsKeys: number;
  /** `cards:` keys deleted. */
  deletedCardsKeys: number;
  /** `username:` keys scanned. */
  usernameKeysScanned: number;
  /** `username:` keys pointing at a user with no record. */
  orphanedUsernameKeys: number;
  /** `username:` keys deleted. */
  deletedUsernameKeys: number;
}

/** Default cap on keys read per prefix in one reconciliation run. */
const RECONCILIATION_KEY_LIMIT = 5_000;

/** Age an ownerless `cards:` key must reach before reconciliation deletes it. */
const ORPHAN_KEY_GRACE_MS = 60 * 60 * 1000;

/**
 * Reads the `updatedAt` field from a stored `cards:` value.
 * @param raw - Value returned by Redis.
 * @returns The timestamp in milliseconds, or null when it is absent or unreadable.
 */
function readStoredCardsUpdatedAt(raw: unknown): number | null {
  if (raw === null || raw === undefined) return null;
  let parsed: unknown = raw;
  if (typeof parsed === "string") {
    try {
      parsed = JSON.parse(parsed);
    } catch {
      return null;
    }
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    return null;
  }
  const updatedAt = (parsed as Record<string, unknown>).updatedAt;
  const timestamp =
    typeof updatedAt === "string" ? Date.parse(updatedAt) : Number(updatedAt);
  return Number.isFinite(timestamp) && timestamp > 0 ? timestamp : null;
}

/**
 * Deletes `cards:` and `username:` keys whose user record no longer exists.
 *
 * Both key families have no TTL, and neither is removed by every deletion
 * path, so they can outlive the user they describe. The `cards:` listing comes
 * from the search index when it is available and from a scan otherwise; the
 * `username:` listing is always a scan, because its values are bare IDs with
 * no addressable field. Each listing is bounded by
 * {@link RECONCILIATION_KEY_LIMIT}, and a key is deleted only after one `MGET`
 * confirms its `user:<id>:meta` is absent, so a user saved while the audit
 * runs keeps their keys.
 *
 * @param keyLimit - Maximum keys read per prefix.
 * @returns Per-prefix scan and deletion counts.
 */
export async function reconcileUserKeyOrphans(
  keyLimit: number = RECONCILIATION_KEY_LIMIT,
): Promise<UserKeyReconciliationResult> {
  const result: UserKeyReconciliationResult = {
    cardsKeysScanned: 0,
    orphanedCardsKeys: 0,
    deletedCardsKeys: 0,
    usernameKeysScanned: 0,
    orphanedUsernameKeys: 0,
    deletedUsernameKeys: 0,
  };

  const indexedCards = await queryCardKeys(redisClient, keyLimit);
  const cardsKeys =
    indexedCards?.keys ??
    (await scanAllKeys("cards:*", undefined, undefined, keyLimit));
  result.cardsKeysScanned = cardsKeys.length;
  const orphanedCards = await filterKeysWithMissingOwner(cardsKeys);
  result.orphanedCardsKeys = orphanedCards.length;
  if (orphanedCards.length > 0) {
    // `store-cards` accepts a save before the user record exists, and the
    // generator sends both saves in parallel. A card record written in that
    // window is orphaned only until the slower request lands, so deletion
    // waits for the record to age past the grace period first.
    const values = await mgetInBatches<unknown>(orphanedCards);
    const cutoff = Date.now() - ORPHAN_KEY_GRACE_MS;
    const expiredCards = orphanedCards.filter((_, index) => {
      // An unreadable record cannot be reconciled later either, so it is
      // deleted with the aged ones.
      const updatedAt = readStoredCardsUpdatedAt(values[index]);
      return updatedAt === null || updatedAt < cutoff;
    });
    if (expiredCards.length > 0) {
      const pipeline = redisClient.pipeline();
      for (const key of expiredCards) pipeline.del(key);
      await pipeline.exec();
      result.deletedCardsKeys = expiredCards.length;
    }
  }

  // The username key's owner is the value itself, not part of the key name.
  const usernameKeys = await scanAllKeys(
    "username:*",
    undefined,
    undefined,
    keyLimit,
  );
  result.usernameKeysScanned = usernameKeys.length;
  if (usernameKeys.length > 0) {
    const owners = await mgetInBatches<string | number>(usernameKeys);
    const ownerByKey = new Map<string, string>();
    usernameKeys.forEach((key, index) => {
      const owner = owners[index];
      if (owner === null || owner === undefined) return;
      const id = String(owner);
      if (/^\d+$/.test(id)) ownerByKey.set(key, id);
    });

    const candidateIds = Array.from(new Set(ownerByKey.values()));
    const metaValues = candidateIds.length
      ? await mgetInBatches<unknown>(
          candidateIds.map((id) => getUserDataKey(id, "meta")),
        )
      : [];
    const liveIds = new Set(
      candidateIds.filter((_, index) => metaValues[index] != null),
    );

    const orphanedUsernames = Array.from(ownerByKey.entries())
      .filter(([, owner]) => !liveIds.has(owner))
      .map(([key]) => key);
    result.orphanedUsernameKeys = orphanedUsernames.length;
    if (orphanedUsernames.length > 0) {
      const pipeline = redisClient.pipeline();
      for (const key of orphanedUsernames) pipeline.del(key);
      await pipeline.exec();
      result.deletedUsernameKeys = orphanedUsernames.length;
    }
  }

  return result;
}

/**
 * Returns the keys whose `user:<id>:meta` is absent.
 *
 * @param keys - Keys in the form `<prefix>:<numericUserId>`.
 * @returns The subset with no stored record.
 */
async function filterKeysWithMissingOwner(keys: string[]): Promise<string[]> {
  if (keys.length === 0) return [];

  const userIds: string[] = [];
  const ownerByKey = new Map<string, string>();
  for (const key of keys) {
    const id = key.slice(key.indexOf(":") + 1);
    if (!/^\d+$/.test(id)) continue;
    userIds.push(id);
    ownerByKey.set(key, id);
  }

  const uniqueIds = Array.from(new Set(userIds));
  const metas = await mgetInBatches<unknown>(
    uniqueIds.map((id) => getUserDataKey(id, "meta")),
  );
  const liveIds = new Set(uniqueIds.filter((_, index) => metas[index] != null));

  return keys.filter((key) => {
    const owner = ownerByKey.get(key);
    return owner !== undefined && !liveIds.has(owner);
  });
}

/**
 * Result of a refresh index rebuild.
 * @source
 */
export interface UserRefreshIndexRebuildResult {
  /** Users whose meta was found and scored. */
  indexedUsers: number;
  /** Users in the index whose meta key is gone. */
  missingMetaCount: number;
  /** Users whose meta exists but carries no readable updatedAt. */
  malformedMetaCount: number;
  /** Index entries dropped because their record no longer exists. */
  droppedStaleMembers: number;
}

/**
 * Rebuilds the refresh index from the stored meta parts. Used when the index
 * is empty, which covers the first run after it is introduced, and as a
 * periodic repair for an index that drifted from storage.
 *
 * Each stored user is re-scored, so the repair also corrects any entry whose
 * score no longer matches its record. Nothing is deleted first: the writes go
 * straight to the live key, which keeps a concurrent `saveUserRecord` from
 * having its entry erased, leaves the index usable if a chunk fails, and makes
 * a repeated run harmless.
 *
 * The rebuild also reconciles the index against storage, because the refresh
 * job only sees members that reach its selection window and the window is a
 * small slice of the queue. An entry whose record is gone therefore cannot be
 * left to the job: it would hold a slot and a cooldown read on every run until
 * the queue front reached it. Reconciliation reads the meta of the members the
 * listing did not cover and drops only the ones it confirms are absent, so a
 * user saved during the rebuild keeps their entry.
 *
 * @param onScanPage - Optional callback invoked after each SCAN command on the
 *   fallback path.
 * @returns Counts of indexed, missing, malformed, and dropped records.
 * @source
 */
export async function rebuildUserRefreshIndex(
  onScanPage?: () => void,
): Promise<UserRefreshIndexRebuildResult> {
  const metaKeys = await listUserMetaKeys(onScanPage);
  const userIds = Array.from(
    new Set(
      metaKeys
        .map((key) => key.split(":")[1])
        .filter((id) => Boolean(id) && /^\d+$/.test(id)),
    ),
  );

  let missingMetaCount = 0;
  let malformedMetaCount = 0;

  for (
    let offset = 0;
    offset < userIds.length;
    offset += REFRESH_INDEX_REBUILD_CHUNK_SIZE
  ) {
    const chunk = userIds.slice(
      offset,
      offset + REFRESH_INDEX_REBUILD_CHUNK_SIZE,
    );
    const metas = await redisClient.mget<
      (Record<string, unknown> | string | null)[]
    >(...chunk.map((id) => getUserDataKey(id, "meta")));

    const pipeline = redisClient.pipeline();
    metas.forEach((meta, index) => {
      let score = USER_REFRESH_INDEX_UNREADABLE_SCORE;
      if (meta === null || meta === undefined) {
        missingMetaCount++;
      } else {
        const updatedAt = readStoredUpdatedAt(meta);
        if (updatedAt === undefined) malformedMetaCount++;
        score = getUpdatedAtScore(updatedAt);
      }
      pipeline.zadd(USER_REFRESH_INDEX_KEY, {
        score,
        member: chunk[index],
      });
    });
    await pipeline.exec();
  }

  const droppedStaleMembers = await dropStaleIndexMembers(userIds);

  return {
    indexedUsers: userIds.length,
    missingMetaCount,
    malformedMetaCount,
    droppedStaleMembers,
  };
}

/**
 * Drops refresh index members that have no stored record.
 *
 * The listing in {@link rebuildUserRefreshIndex} covers every live
 * `user:<id>:meta` key, so any index member missing from that set is either a
 * leftover from a deleted record or a user saved while the rebuild ran. Each
 * uncovered member is confirmed with one MGET before anything is removed,
 * which keeps a concurrent save from having its entry erased.
 *
 * @param scannedUserIds - User IDs proven to have a meta key by the listing.
 * @returns How many index members were dropped.
 * @source
 */
async function dropStaleIndexMembers(
  scannedUserIds: string[],
): Promise<number> {
  const scanned = new Set(scannedUserIds);
  const indexMembers = await redisClient.zrange<(string | number)[]>(
    USER_REFRESH_INDEX_KEY,
    0,
    -1,
  );
  const uncovered = indexMembers
    .map(String)
    .filter((id) => /^\d+$/.test(id) && !scanned.has(id));

  let dropped = 0;
  for (
    let offset = 0;
    offset < uncovered.length;
    offset += REFRESH_INDEX_REBUILD_CHUNK_SIZE
  ) {
    const chunk = uncovered.slice(
      offset,
      offset + REFRESH_INDEX_REBUILD_CHUNK_SIZE,
    );
    const metas = await redisClient.mget<(unknown[] | null)[]>(
      ...chunk.map((id) => getUserDataKey(id, "meta")),
    );
    const absent = chunk.filter((_, index) => metas[index] == null);
    if (absent.length === 0) continue;

    const pipeline = redisClient.pipeline();
    for (const id of absent) {
      pipeline.zrem(USER_REFRESH_INDEX_KEY, id);
    }
    await pipeline.exec();
    dropped += absent.length;
  }

  return dropped;
}

/**
 * Fetches specific parts of a user record from Redis.
 */
export async function fetchUserDataParts(
  userId: string | number,
  parts: UserDataPart[],
): Promise<Partial<Record<UserDataPart, unknown>>> {
  const keys = parts.map((part) => getUserDataKey(userId, part));
  const results = await redisClient.mget(...keys);

  const data: Partial<Record<UserDataPart, unknown>> = {};

  results.forEach((val, i) => {
    if (val) {
      try {
        data[parts[i]] = typeof val === "string" ? JSON.parse(val) : val;
      } catch (e) {
        console.error(
          "Failed to parse user data part %s for user %s:",
          parts[i],
          userId,
          e,
        );
      }
    }
  });

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
  activityHeatmap: ["meta", "activity"],
  recentActivitySummary: ["meta", "activity"],
  recentActivityFeed: ["meta", "activity"],
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
