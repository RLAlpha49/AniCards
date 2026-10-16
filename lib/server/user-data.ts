import { redisClient, scanAllKeys } from "@/lib/api-utils";
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
  const split = splitUserRecord(record) as unknown as Record<
    UserDataPart,
    unknown
  >;
  const parts = Object.keys(split) as UserDataPart[];
  const existing = storedParts;

  const changed: [UserDataPart, string][] = [];
  for (const part of parts) {
    const serialized = JSON.stringify(split[part]);
    const stored = existing[part];
    if (stored === undefined || JSON.stringify(stored) !== serialized) {
      changed.push([part, serialized]);
    }
  }

  if (changed.length === 0) return;

  const pipeline = redisClient.pipeline();
  for (const [part, value] of changed) {
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
 * Deletes all parts of a user record and removes it from the refresh index.
 */
export async function deleteUserRecord(userId: string | number): Promise<void> {
  const keys = USER_DATA_PARTS.map((part) => getUserDataKey(userId, part));
  const pipeline = redisClient.pipeline();
  pipeline.del(...keys);
  pipeline.zrem(USER_REFRESH_INDEX_KEY, String(userId));
  await pipeline.exec();
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
 * scan did not cover and drops only the ones it confirms are absent, so a user
 * saved during the rebuild keeps their entry.
 *
 * @param onScanPage - Optional callback invoked after each SCAN command.
 * @returns Counts of indexed, missing, malformed, and dropped records.
 * @source
 */
export async function rebuildUserRefreshIndex(
  onScanPage?: () => void,
): Promise<UserRefreshIndexRebuildResult> {
  const metaKeys = await scanAllKeys(
    "user:*:meta",
    REFRESH_INDEX_REBUILD_CHUNK_SIZE,
    onScanPage,
  );
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
 * The scan in {@link rebuildUserRefreshIndex} covers every live `user:<id>:meta`
 * key, so any index member missing from that set is either a leftover from a
 * deleted record or a user saved while the rebuild ran. Each uncovered member
 * is confirmed with one MGET before anything is removed, which keeps a
 * concurrent save from having its entry erased.
 *
 * @param scannedUserIds - User IDs proven to have a meta key by the scan.
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
    .map((member) => String(member))
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
