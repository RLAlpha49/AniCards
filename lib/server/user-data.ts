import { redisClient } from "@/lib/api-utils";
import { safeParse } from "@/lib/utils";
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
  MediaListCollection,
  ReconstructedUserRecord,
  SourceMaterialDistributionTotalsEntry,
  SeasonalPreferenceTotalsEntry,
  AnimeGenreSynergyTotalsEntry,
} from "@/lib/types/records";

export type UserDataPart =
  | "meta"
  | "stats"
  | "favourites"
  | "statistics"
  | "pages"
  | "planning"
  | "current"
  | "rewatched"
  | "completed";

export const getUserDataKey = (userId: string | number, part: UserDataPart) =>
  `user:${userId}:${part}`;

interface UserMeta {
  userId: string;
  username?: string;
  ip: string;
  createdAt: string;
  updatedAt: string;
  name?: string;
  avatar?: UserAvatar;
  userCreatedAt?: number;
  animeSourceMaterialDistributionTotals?: SourceMaterialDistributionTotalsEntry[];
  animeSeasonalPreferenceTotals?: SeasonalPreferenceTotalsEntry[];
  animeGenreSynergyTotals?: AnimeGenreSynergyTotalsEntry[];
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

/** Extract pages and list-like containers safely */
function extractPages(statsObj: unknown) {
  const followersPage =
    isObject(statsObj) &&
    "followersPage" in statsObj &&
    isObject(statsObj["followersPage"])
      ? (statsObj["followersPage"] as unknown as FollowersPage)
      : DEFAULT_FOLLOWERS_PAGE;
  const followingPage =
    isObject(statsObj) &&
    "followingPage" in statsObj &&
    isObject(statsObj["followingPage"])
      ? (statsObj["followingPage"] as unknown as FollowingPage)
      : DEFAULT_FOLLOWING_PAGE;
  const threadsPage =
    isObject(statsObj) &&
    "threadsPage" in statsObj &&
    isObject(statsObj["threadsPage"])
      ? (statsObj["threadsPage"] as unknown as ThreadsPage)
      : DEFAULT_THREADS_PAGE;
  const threadCommentsPage =
    isObject(statsObj) &&
    "threadCommentsPage" in statsObj &&
    isObject(statsObj["threadCommentsPage"])
      ? (statsObj["threadCommentsPage"] as unknown as ThreadCommentsPage)
      : DEFAULT_THREAD_COMMENTS_PAGE;
  const reviewsPage =
    isObject(statsObj) &&
    "reviewsPage" in statsObj &&
    isObject(statsObj["reviewsPage"])
      ? (statsObj["reviewsPage"] as unknown as ReviewsPage)
      : DEFAULT_REVIEWS_PAGE;
  return {
    followersPage,
    followingPage,
    threadsPage,
    threadCommentsPage,
    reviewsPage,
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
 * expected shape (e.g., `stats` should never accidentally contain the full
 * user record).
 */
export function splitUserRecord(record: UserRecord) {
  const { stats: rawStats, ...metaBase } = record;

  const statsObj = (rawStats || {}) as unknown;
  const userObj = isObject((statsObj as Record<string, unknown>)["User"])
    ? ((statsObj as Record<string, unknown>)["User"] as Record<string, unknown>)
    : undefined;

  const statistics = extractStatistics(statsObj, userObj);
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
  };

  const userMeta = userObj || {};

  const meta: UserMeta = {
    ...metaBase,
    userId: String(metaBase.userId || ""),
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
    stats: activityStats,
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
  const stats = parts.stats as UserSection["stats"] | undefined;
  const favourites = parts.favourites as UserSection["favourites"] | undefined;
  const statistics = parts.statistics as UserSection["statistics"] | undefined;

  const pagesInput = parts.pages as
    | {
        followersPage?: FollowersPage;
        followingPage?: FollowingPage;
        threadsPage?: ThreadsPage;
        threadCommentsPage?: ThreadCommentsPage;
        reviewsPage?: ReviewsPage;
      }
    | undefined;

  const followersPage = pagesInput?.followersPage ?? DEFAULT_FOLLOWERS_PAGE;
  const followingPage = pagesInput?.followingPage ?? DEFAULT_FOLLOWING_PAGE;
  const threadsPage = pagesInput?.threadsPage ?? DEFAULT_THREADS_PAGE;
  const threadCommentsPage =
    pagesInput?.threadCommentsPage ?? DEFAULT_THREAD_COMMENTS_PAGE;
  const reviewsPage = pagesInput?.reviewsPage ?? DEFAULT_REVIEWS_PAGE;

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
      }
    | undefined;

  const userSection: UserSection = {
    stats: stats || { activityHistory: [] },
    favourites: favourites || {
      anime: { nodes: [] },
      manga: { nodes: [] },
      characters: { nodes: [] },
      staff: { nodes: [] },
      studios: { nodes: [] },
    },
    statistics: statistics || {
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
    },
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
    animePlanning: planningInput?.animePlanning,
    mangaPlanning: planningInput?.mangaPlanning,
    animeCurrent: currentInput?.animeCurrent,
    mangaCurrent: currentInput?.mangaCurrent,
    animeRewatched: rewatchedInput?.animeRewatched,
    mangaReread: rewatchedInput?.mangaReread,
    animeCompleted: completedInput?.animeCompleted,
    mangaCompleted: completedInput?.mangaCompleted,
  };

  const {
    userId: _u,
    username: _un,
    updatedAt: _ua,
    ip: _i,
    createdAt: _c,
    name: _n,
    avatar: _a,
    userCreatedAt: _uc,
    ...rest
  } = meta || {};

  return {
    userId: meta?.userId || "",
    username: meta?.username,
    ip: meta?.ip || "",
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
  };
}

/**
 * Saves a full UserRecord in the split format.
 */
export async function saveUserRecord(record: UserRecord): Promise<void> {
  const split = splitUserRecord(record);
  const pipeline = redisClient.pipeline();

  (Object.keys(split) as UserDataPart[]).forEach((part) => {
    pipeline.set(
      getUserDataKey(record.userId, part),
      JSON.stringify(split[part]),
    );
  });

  // Ensure legacy key is removed if it exists
  pipeline.del(`user:${record.userId}`);

  await pipeline.exec();
}

/**
 * Deletes all parts of a user record.
 */
export async function deleteUserRecord(userId: string | number): Promise<void> {
  const parts: UserDataPart[] = [
    "meta",
    "stats",
    "favourites",
    "statistics",
    "pages",
    "planning",
    "current",
    "rewatched",
    "completed",
  ];
  const keys = parts.map((part) => getUserDataKey(userId, part));
  keys.push(`user:${userId}`);
  await redisClient.del(...keys);
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

  const record = safeParse<UserRecord>(legacyDataRaw as string);
  if (!record) return null;

  await saveUserRecord(record);

  return record;
}

/**
 * Fetches specific parts of user data, migrating if necessary.
 */
export async function fetchUserDataParts(
  userId: string | number,
  parts: UserDataPart[],
): Promise<Partial<Record<UserDataPart, unknown>>> {
  const keys = parts.map((part) => getUserDataKey(userId, part));
  const results = await redisClient.mget(...keys);

  const data: Partial<Record<UserDataPart, unknown>> = {};
  let missingAny = false;

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
        missingAny = true;
      }
    } else {
      missingAny = true;
    }
  });

  if (missingAny) {
    const fullRecord = await migrateUserRecord(userId);
    if (!fullRecord) return data;

    const split = splitUserRecord(fullRecord);
    parts.forEach((part) => {
      data[part] = split[part];
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
  socialStats: ["meta", "stats", "pages"],
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
  animeSourceMaterialDistribution: ["meta", "current", "completed"],
  animeSeasonalPreference: ["meta", "current", "completed"],
  animeGenreSynergy: ["meta"],
  profileOverview: ["meta", "statistics"],
  favoritesSummary: ["meta", "favourites"],
  favoritesGrid: ["meta", "favourites"],
  activityHeatmap: ["meta", "stats"],
  recentActivitySummary: ["meta", "stats"],
  recentActivityFeed: ["meta", "stats"],
  activityStreaks: ["meta", "stats"],
  activityPatterns: ["meta", "stats"],
  topActivityDays: ["meta", "stats"],
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
};

/**
 * Gets the required user data parts for a given card name.
 */
export function getPartsForCard(cardName: string): UserDataPart[] {
  const [baseCardType] = cardName.split("-");
  return (
    CARD_TYPE_TO_PARTS[baseCardType] || [
      "meta",
      "stats",
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
