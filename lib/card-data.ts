import {
  redisClient,
  incrementAnalytics,
  buildAnalyticsMetricKey,
} from "@/lib/api-utils";
import { clampBorderRadius, safeParse } from "@/lib/utils";
import { calculateMilestones } from "@/lib/utils/milestones";
import {
  UserRecord,
  CardsRecord,
  UserStatsData,
  StoredCardConfig,
  AnimeStats,
  MangaStats,
  AnimeStatVoiceActor,
  AnimeStatStudio,
  AnimeStatStaff,
  MangaStatStaff,
} from "@/lib/types/records";
import { colorPresets } from "@/components/stat-card-generator/constants";
import {
  SocialStats,
  AnimeStats as TemplateAnimeStats,
  MangaStats as TemplateMangaStats,
  ColorValue,
} from "@/lib/types/card";

/**
 * Error wrapper including an HTTP status code for API responses.
 * Useful for returning standardized errors from card-related handlers.
 * @source
 */
export class CardDataError extends Error {
  status: number;
  constructor(message: string, status = 500) {
    super(message);
    this.status = status;
  }
}

/**
 * Resolves a username to a numeric user ID via the Redis username index.
 * Returns null if the username is not found or the lookup fails.
 *
 * @param username - The username to resolve (case-insensitive).
 * @returns The resolved user ID or null when the lookup fails.
 * @source
 */
export async function resolveUserIdFromUsername(
  username: string,
): Promise<number | null> {
  const normalizedUsername = username.trim().toLowerCase();
  const usernameIndexKey = `username:${normalizedUsername}`;
  console.log(
    `🔍 [Card Data] Searching user index for username: ${normalizedUsername}`,
  );
  const userIdFromIndex = await redisClient.get(usernameIndexKey);
  if (!userIdFromIndex) return null;
  const candidate = Number.parseInt(userIdFromIndex as string, 10);
  if (Number.isNaN(candidate)) return null;
  console.log(
    `✅ [Card Data] Resolved username ${normalizedUsername} to userId: ${candidate}`,
  );
  return candidate;
}

/** Representation of a genre and its count for a user's media statistics. @source */
export type GenreItem = { genre: string; count: number };
/** Tag item (name + count) used in tag distribution lists. @source */
export type TagItem = { tag: { name: string }; count: number };
/** Voice actor item with full name and count (for anime voice actor stats). @source */
export type VoiceActorItem = {
  voiceActor: { name: { full: string } };
  count: number;
};
/** Studio item (name + count) used for studio distribution lists. @source */
export type StudioItem = { studio: { name: string }; count: number };
/** Staff item with full name and count (for anime or manga staff stats). @source */
export type StaffItem = { staff: { name: { full: string } }; count: number };

/**
 * Mapping of internal card type keys to human-readable display names.
 * Used when rendering card labels or titles in the UI and templates.
 * @source
 */
export const displayNames: { [key: string]: string } = {
  animeStats: "Anime Stats",
  socialStats: "Social Stats",
  mangaStats: "Manga Stats",
  animeGenres: "Anime Genres",
  animeTags: "Anime Tags",
  animeVoiceActors: "Anime Voice Actors",
  animeStudios: "Anime Studios",
  animeStaff: "Anime Staff",
  mangaGenres: "Manga Genres",
  mangaTags: "Manga Tags",
  mangaStaff: "Manga Staff",
  animeStatusDistribution: "Anime Statuses",
  mangaStatusDistribution: "Manga Statuses",
  animeFormatDistribution: "Anime Formats",
  mangaFormatDistribution: "Manga Formats",
  animeScoreDistribution: "Anime Scores",
  mangaScoreDistribution: "Manga Scores",
  animeYearDistribution: "Anime Years",
  mangaYearDistribution: "Manga Years",
  animeCountry: "Anime Countries",
  mangaCountry: "Manga Countries",
};

/**
 * Extracts favourite names from a user's favourites block for a card base type.
 * Supports staff, studios, and character favorites for voice actor cards.
 * @param favoritesData - The raw favourites object from an Anilist user record.
 * @param baseCardType - The base card identifier (e.g. "animeVoiceActors").
 * @returns Array of favourite names relevant to the card type.
 * @source
 */
export function getFavoritesForCardType(
  favoritesData: unknown,
  baseCardType: string,
): string[] {
  if (!favoritesData || typeof favoritesData !== "object") return [];
  const fav = favoritesData as {
    staff?: { nodes: { name: { full: string } }[] };
    studios?: { nodes: { name: string }[] };
    characters?: { nodes: { name: { full: string } }[] };
  };
  switch (baseCardType) {
    case "animeVoiceActors":
      return fav.characters?.nodes?.map((c) => c.name.full) ?? [];
    case "animeStudios":
      return fav.studios?.nodes?.map((s) => s.name) ?? [];
    case "animeStaff":
    case "mangaStaff":
      return fav.staff?.nodes?.map((s) => s.name.full) ?? [];
    default:
      return [];
  }
}

/**
 * Validates and normalizes a raw user record for card generation.
 * Returns either a normalized UserRecord or an error object with an optional HTTP status.
 * This prepares nested pages, statistics blocks, and favourites into consistent shapes.
 * @param raw - Raw object pulled from the data store (redis), often JSON-parsed.
 * @returns Normalized object on success or an { error, status } object on failure.
 * @source
 */
export function validateAndNormalizeUserRecord(
  raw: unknown,
): { normalized: UserRecord } | { error: string; status?: number } {
  if (!raw || typeof raw !== "object") {
    return { error: "Invalid user record: not an object" };
  }

  const user = raw as Partial<UserRecord>;

  if (!user.stats || typeof user.stats !== "object") {
    return { error: "Invalid user record: missing statistics" };
  }

  const statsData = user.stats as Partial<UserStatsData>;

  const rawActivityHistory = statsData?.User?.stats?.activityHistory;
  const normalizedActivityHistory = Array.isArray(rawActivityHistory)
    ? rawActivityHistory.map((a: unknown) => {
        const item = a as { date?: unknown; amount?: unknown };
        const date = Number(item?.date ?? Number.NaN);
        const amount = Number(item?.amount ?? Number.NaN);
        return {
          date: Number.isFinite(date) ? date : 0,
          amount: Number.isFinite(amount) ? amount : 0,
        };
      })
    : [];

  /**
   * Type guard that verifies a value is a non-null object.
   * Prevents unsafe property access when traversing nested data.
   * @source
   */
  const isObject = (v: unknown): v is Record<string, unknown> =>
    !!v && typeof v === "object";

  /**
   * Safely resolves a nested string or number property by path.
   * Returns an empty string if any portion of the path is missing or not a string/number.
   * @param root - The root object to traverse.
   * @param path - Array of keys to navigate into nested objects.
   * @returns Resolved string value or empty string.
   * @source
   */
  const getNestedString = (root: unknown, path: string[]): string => {
    let node: unknown = root;
    for (const seg of path) {
      if (!isObject(node)) return "";
      const recNode = node;
      node = recNode[seg];
    }
    if (typeof node === "string") return node;
    if (typeof node === "number") return String(node);
    return "";
  };

  /**
   * Internal representation of paginated data from the API.
   * Ensures a stable pageInfo.total and provides a typed items array.
   * @source
   */
  interface NormalizedPage {
    pageInfo: { total: number };
    [k: string]: unknown;
  }

  /**
   * Normalizes paginated responses into a consistent structure with pageInfo and items.
   * This function accepts potentially malformed values and ensures defaults: total=0 and empty items array.
   * @param value - The raw paginated object.
   * @param keyNames - Key name that contains the items array (e.g., { itemsKey: 'followers' }).
   * @returns Normalized page structure.
   * @source
   */
  const normalizePage = (
    value: unknown,
    keyNames: { itemsKey: string },
  ): NormalizedPage => {
    if (!value || typeof value !== "object") {
      return {
        pageInfo: { total: 0 },
        [keyNames.itemsKey]: [],
      } as NormalizedPage;
    }
    const v = value as Record<string, unknown>;
    const pageInfoCandidate = v.pageInfo as Record<string, unknown> | undefined;
    const pageInfo =
      pageInfoCandidate && typeof pageInfoCandidate.total === "number"
        ? { total: pageInfoCandidate.total }
        : { total: 0 };
    const items = Array.isArray(v[keyNames.itemsKey])
      ? (v[keyNames.itemsKey] as unknown[])
      : [];
    return { pageInfo, [keyNames.itemsKey]: items } as NormalizedPage;
  };

  /**
   * Attempts to coerce a value to a finite number.
   * Accepts numbers and numeric strings, returns a fallback or undefined if conversion fails.
   * @param value - Value to coerce to a number.
   * @param fallback - Optional fallback value used when coercion fails.
   * @returns A finite number or fallback/undefined.
   * @source
   */
  const coerceNumber = (
    value: unknown,
    fallback?: number,
  ): number | undefined => {
    if (typeof value === "number" && Number.isFinite(value)) return value;
    if (
      typeof value === "string" &&
      value.trim() !== "" &&
      !Number.isNaN(Number(value))
    )
      return Number(value);
    return fallback;
  };

  /**
   * Normalizes an anime or manga stats block.
   * It coerces numeric values, maps nested arrays (genres, tags, staff, etc.), and filters invalid entries.
   * Returns a structured partial AnimeStats|MangaStats or undefined for invalid blocks.
   * @param rawStatBlock - Raw statistics block from the user record.
   * @param type - Either 'anime' or 'manga' to include type-specific fields.
   * @returns A normalized stats block or undefined.
   * @source
   */
  const normalizeStatBlock = (
    rawStatBlock: unknown,
    type: "anime" | "manga",
  ) => {
    if (!rawStatBlock || typeof rawStatBlock !== "object") return undefined;
    const block = rawStatBlock as Record<string, unknown>;

    const rawGenres = block["genres"];
    const genres = Array.isArray(rawGenres)
      ? (rawGenres as unknown[])
          .map((g) => {
            if (!g || typeof g !== "object") return null;
            const rec = g as Record<string, unknown>;
            return {
              genre:
                typeof rec.genre === "string"
                  ? rec.genre
                  : String(rec.genre ?? ""),
              count: coerceNumber(rec.count, 0) ?? 0,
            };
          })
          .filter(
            (g): g is { genre: string; count: number } => !!g && g.genre !== "",
          )
      : [];
    const rawTags = block["tags"];
    const tags = Array.isArray(rawTags)
      ? (rawTags as unknown[])
          .map((t) => {
            if (!t || typeof t !== "object") return null;
            const rec = t as Record<string, unknown>;
            const tagName = getNestedString(rec, ["tag", "name"]);
            return {
              tag: { name: tagName },
              count: coerceNumber(rec.count, 0) ?? 0,
            };
          })
          .filter(
            (t): t is { tag: { name: string }; count: number } =>
              !!t && !!t.tag && !!t.tag.name,
          )
      : [];
    const rawVoiceActors = block["voiceActors"];
    const voiceActors: AnimeStatVoiceActor[] = Array.isArray(rawVoiceActors)
      ? (rawVoiceActors as unknown[])
          .map((v) => {
            if (!v || typeof v !== "object") return null;
            const rec = v as Record<string, unknown>;
            const fullName = getNestedString(rec, [
              "voiceActor",
              "name",
              "full",
            ]);
            return {
              voiceActor: { name: { full: fullName } },
              count: coerceNumber(rec.count, 0) ?? 0,
            };
          })
          .filter(
            (v): v is AnimeStatVoiceActor =>
              getNestedString(v, ["voiceActor", "name", "full"]) !== "",
          )
      : [];
    const rawStudios = block["studios"];
    const studios: AnimeStatStudio[] = Array.isArray(rawStudios)
      ? (rawStudios as unknown[])
          .map((s) => {
            if (!s || typeof s !== "object") return null;
            const rec = s as Record<string, unknown>;
            const studioName = getNestedString(rec, ["studio", "name"]);
            return {
              studio: { name: studioName },
              count: coerceNumber(rec.count, 0) ?? 0,
            };
          })
          .filter(
            (s): s is AnimeStatStudio =>
              getNestedString(s, ["studio", "name"]) !== "",
          )
      : [];
    const rawStaff = block["staff"];
    const staff: AnimeStatStaff[] | MangaStatStaff[] = Array.isArray(rawStaff)
      ? (rawStaff as unknown[])
          .map((s) => {
            if (!s || typeof s !== "object") return null;
            const rec = s as Record<string, unknown>;
            const staffName = getNestedString(rec, ["staff", "name", "full"]);
            return {
              staff: { name: { full: staffName } },
              count: coerceNumber(rec.count, 0) ?? 0,
            };
          })
          .filter(
            (s): s is AnimeStatStaff | MangaStatStaff =>
              getNestedString(s, ["staff", "name", "full"]) !== "",
          )
      : [];
    const rawStatuses = block["statuses"];
    const statuses = Array.isArray(rawStatuses)
      ? (rawStatuses as unknown[])
          .map((s) => {
            if (!s || typeof s !== "object") return null;
            const rec = s as Record<string, unknown>;
            return {
              status: String(rec.status ?? ""),
              count: coerceNumber(rec.count, 0) ?? 0,
            };
          })
          .filter(
            (s): s is { status: string; count: number } => !!s && !!s.status,
          )
      : undefined;
    const rawFormats = block["formats"];
    const formats = Array.isArray(rawFormats)
      ? (rawFormats as unknown[])
          .map((f) => {
            if (!f || typeof f !== "object") return null;
            const rec = f as Record<string, unknown>;
            return {
              format: String(rec.format ?? ""),
              count: coerceNumber(rec.count, 0) ?? 0,
            };
          })
          .filter(
            (f): f is { format: string; count: number } => !!f && !!f.format,
          )
      : undefined;
    const rawScores = block["scores"];
    const scores = Array.isArray(rawScores)
      ? (rawScores as unknown[])
          .map((s) => {
            if (!s || typeof s !== "object") return null;
            const rec = s as Record<string, unknown>;
            return {
              score: coerceNumber(rec.score, Number.NaN),
              count: coerceNumber(rec.count, 0),
            };
          })
          .filter(
            (s): s is { score: number; count: number } =>
              s !== null && Number.isFinite(s.score),
          )
      : undefined;
    const rawReleaseYears = block["releaseYears"];
    const releaseYears = Array.isArray(rawReleaseYears)
      ? (rawReleaseYears as unknown[])
          .map((r) => {
            if (!r || typeof r !== "object") return null;
            const rec = r as Record<string, unknown>;
            return {
              releaseYear: coerceNumber(rec.releaseYear, Number.NaN),
              count: coerceNumber(rec.count, 0),
            };
          })
          .filter(
            (r): r is { releaseYear: number; count: number } =>
              r !== null && Number.isFinite(r.releaseYear),
          )
      : undefined;
    const rawCountries = block["countries"];
    const countries = Array.isArray(rawCountries)
      ? (rawCountries as unknown[])
          .map((c) => {
            if (!c || typeof c !== "object") return null;
            const rec = c as Record<string, unknown>;
            return {
              country: String(rec.country ?? ""),
              count: coerceNumber(rec.count, 0) ?? 0,
            };
          })
          .filter(
            (c): c is { country: string; count: number } => !!c && !!c.country,
          )
      : undefined;

    const count = coerceNumber(block.count);
    const meanScore = coerceNumber(block.meanScore);
    const standardDeviation = coerceNumber(block.standardDeviation);

    const normalizedBlock: Partial<AnimeStats & MangaStats> = {
      count,
      meanScore,
      standardDeviation,
      genres,
      tags,
      voiceActors,
      studios,
      staff,
      statuses,
      formats,
      scores,
      releaseYears,
      countries,
    };

    if (type === "anime") {
      normalizedBlock.episodesWatched = coerceNumber(block.episodesWatched);
      normalizedBlock.minutesWatched = coerceNumber(block.minutesWatched);
    }
    if (type === "manga") {
      normalizedBlock.chaptersRead = coerceNumber(block.chaptersRead);
      normalizedBlock.volumesRead = coerceNumber(block.volumesRead);
    }

    return normalizedBlock;
  };

  let favoriteStaffNodes: unknown[] = [];
  let favoriteStudiosNodes: unknown[] = [];
  let favoriteCharactersNodes: unknown[] = [];
  if (Array.isArray(statsData.User?.favourites?.staff?.nodes)) {
    favoriteStaffNodes = statsData.User.favourites.staff.nodes;
  }
  if (Array.isArray(statsData.User?.favourites?.studios?.nodes)) {
    favoriteStudiosNodes = statsData.User.favourites.studios.nodes;
  }
  if (Array.isArray(statsData.User?.favourites?.characters?.nodes)) {
    favoriteCharactersNodes = statsData.User.favourites.characters.nodes;
  }

  const normalizedUser: UserRecord = {
    userId: String(user.userId ?? ""),
    username: user.username ?? undefined,
    ip: String(user.ip ?? ""),
    createdAt: String(user.createdAt ?? new Date().toISOString()),
    updatedAt: String(user.updatedAt ?? new Date().toISOString()),
    stats: {
      followersPage: normalizePage(statsData.followersPage, {
        itemsKey: "followers",
      }),
      followingPage: normalizePage(statsData.followingPage, {
        itemsKey: "following",
      }),
      threadsPage: normalizePage(statsData.threadsPage, {
        itemsKey: "threads",
      }),
      threadCommentsPage: normalizePage(statsData.threadCommentsPage, {
        itemsKey: "threadComments",
      }),
      reviewsPage: normalizePage(statsData.reviewsPage, {
        itemsKey: "reviews",
      }),
      User: {
        stats: {
          activityHistory: normalizedActivityHistory,
        },
        favourites: {
          staff: {
            nodes: favoriteStaffNodes.map((s: unknown) => {
              const rec = s as Record<string, unknown>;
              return {
                id: coerceNumber(rec.id),
                name: { full: getNestedString(rec, ["name", "full"]) },
              };
            }),
          },
          studios: {
            nodes: favoriteStudiosNodes.map((s: unknown) => {
              const rec = s as Record<string, unknown>;
              return {
                id: coerceNumber(rec.id),
                name: getNestedString(rec, ["name"]),
              };
            }),
          },
          characters: {
            nodes: favoriteCharactersNodes.map((s: unknown) => {
              const rec = s as Record<string, unknown>;
              return {
                id: coerceNumber(rec.id),
                name: { full: getNestedString(rec, ["name", "full"]) },
              };
            }),
          },
        },
        statistics: {
          anime: normalizeStatBlock(
            statsData.User?.statistics?.anime,
            "anime",
          ) as AnimeStats | undefined,
          manga: normalizeStatBlock(
            statsData.User?.statistics?.manga,
            "manga",
          ) as MangaStats | undefined,
        },
      },
    } as unknown as UserStatsData,
  };

  if (
    !normalizedUser.stats.User.statistics.anime &&
    !normalizedUser.stats.User.statistics.manga
  ) {
    return {
      error: "Missing statistics: no anime or manga stats present",
      status: 404,
    };
  }

  return { normalized: normalizedUser };
}

/**
 * Builds SocialStats used by templates from a normalized UserRecord.
 * Copies follower/following/thread/review pages and activity history into template format.
 * @param userRecord - A validated and normalized UserRecord from the datastore.
 * @returns SocialStats shaped for template rendering.
 * @source
 */
export function toTemplateSocialStats(userRecord: UserRecord): SocialStats {
  return {
    followersPage: userRecord.stats.followersPage,
    followingPage: userRecord.stats.followingPage,
    threadsPage: userRecord.stats.threadsPage,
    threadCommentsPage: userRecord.stats.threadCommentsPage,
    reviewsPage: userRecord.stats.reviewsPage,
    activityHistory: userRecord.stats.User.stats.activityHistory ?? [],
  } as SocialStats;
}

/**
 * Fields representing milestone progress used by card templates.
 * Includes previous/current milestone values and SVG dash settings.
 * @source
 */
export type MilestoneFields = {
  previousMilestone: number;
  currentMilestone: number;
  percentage: number;
  dasharray: string;
  dashoffset: string;
};

/**
 * Composes fields that are common between anime and manga templates, merging basic stats and milestone data.
 * This function selects and maps shared fields (counts, genres, tags, staff, distributions, etc.).
 * @param stats - The anime or manga statistics block from a normalized user.
 * @param milestoneData - Pre-computed milestone data (previous/current/percentage/dash values).
 * @returns A merged object containing shared stats and milestone fields.
 * @source
 */
export function buildCommonTemplateFields(
  stats:
    | UserStatsData["User"]["statistics"]["anime"]
    | UserStatsData["User"]["statistics"]["manga"],
  milestoneData: ReturnType<typeof calculateMilestones>,
): Partial<TemplateAnimeStats & TemplateMangaStats> & MilestoneFields {
  return {
    count: stats.count ?? undefined,
    meanScore: stats.meanScore ?? undefined,
    standardDeviation: stats.standardDeviation ?? undefined,
    genres: (stats.genres as { genre: string; count: number }[]) ?? [],
    tags: (stats.tags as { tag: { name: string }; count: number }[]) ?? [],
    staff: (
      (stats.staff as
        | { staff: { name: { full: string } }; count: number }[]
        | undefined) ?? []
    ).map((s) => ({
      staff: s.staff,
      count: s.count,
    })),
    statuses:
      (stats.statuses as { status: string; count: number }[])?.map((s) => ({
        status: s.status,
        amount: s.count,
      })) ?? undefined,
    formats:
      (stats.formats as { format: string; count: number }[]) ?? undefined,
    scores: (stats.scores as { score: number; count: number }[]) ?? undefined,
    releaseYears:
      (stats.releaseYears as { releaseYear: number; count: number }[]) ??
      undefined,
    countries:
      (stats.countries as { country: string; count: number }[]) ?? undefined,
    previousMilestone: milestoneData.previousMilestone,
    currentMilestone: milestoneData.currentMilestone,
    percentage: milestoneData.percentage,
    dasharray: milestoneData.dasharray,
    dashoffset: milestoneData.dashoffset,
  } as Partial<TemplateAnimeStats & TemplateMangaStats> & MilestoneFields;
}

/**
 * Converts normalized anime statistics and milestone data into the template format used by SVG generators.
 * Adds anime-specific fields like episodes/minutes and maps voice actor objects to the template shape.
 * @param stats - Normalized anime statistics block.
 * @param milestoneData - Milestone calculations included for the progress indicator.
 * @returns Filled TemplateAnimeStats with milestone fields.
 * @source
 */
export function toTemplateAnimeStats(
  stats: UserStatsData["User"]["statistics"]["anime"],
  milestoneData: ReturnType<typeof calculateMilestones>,
): TemplateAnimeStats & MilestoneFields {
  const common = buildCommonTemplateFields(stats, milestoneData);
  return {
    ...common,
    episodesWatched: stats.episodesWatched,
    minutesWatched: stats.minutesWatched,
    voice_actors: (stats.voiceActors ?? []).map((va) => ({
      voice_actor: va.voiceActor,
      count: va.count,
    })),
    studios: stats.studios ?? [],
  } as TemplateAnimeStats & MilestoneFields;
}

/**
 * Converts normalized manga statistics and milestone data into the template format used by SVG generators.
 * Adds manga-specific fields such as chapters and volumes read.
 * @param stats - Normalized manga statistics block.
 * @param milestoneData - Milestone calculations included for the progress indicator.
 * @returns Filled TemplateMangaStats with milestone fields.
 * @source
 */
export function toTemplateMangaStats(
  stats: UserStatsData["User"]["statistics"]["manga"],
  milestoneData: ReturnType<typeof calculateMilestones>,
): TemplateMangaStats & MilestoneFields {
  const common = buildCommonTemplateFields(stats, milestoneData);
  return {
    ...common,
    chaptersRead: stats.chaptersRead,
    volumesRead: stats.volumesRead,
  } as TemplateMangaStats & MilestoneFields;
}

/**
 * Maps various category item shapes into a common { name, count } shape used by UI and templates.
 * Accepts genre/tag/voice actor/studio/staff union types and extracts the displayable name.
 * @param item - The category item to map.
 * @param categoryKey - Key indicating the item type used for mapping.
 * @returns Generic { name, count } object or an empty fallback on unsupported key.
 * @source
 */
export function mapCategoryItem(
  item: GenreItem | TagItem | VoiceActorItem | StudioItem | StaffItem,
  categoryKey: string,
): { name: string; count: number } {
  switch (categoryKey) {
    case "genres":
      return { name: (item as GenreItem).genre, count: item.count };
    case "tags":
      return { name: (item as TagItem).tag.name, count: item.count };
    case "voiceActors":
      return {
        name: (item as VoiceActorItem).voiceActor.name.full,
        count: item.count,
      };
    case "studios":
      return { name: (item as StudioItem).studio.name, count: item.count };
    case "staff":
      return { name: (item as StaffItem).staff.name.full, count: item.count };
    default:
      return { name: "", count: 0 };
  }
}

/**
 * Loads and parses cached cards and user records from Redis for a numeric user ID.
 * Validates presence and JSON structure; records corrupted or missing values will increment analytics and throw CardDataError.
 * @param numericUserId - Numeric user id stored in Redis keys 'cards:{id}' and 'user:{id}'.
 * @returns Object containing parsed card (CardsRecord) and user (UserRecord) documents.
 * @throws {CardDataError} If no data exists (404) or parsed data is corrupted (500).
 * @source
 */
/**
 * Loads only the user record from Redis for a numeric user ID.
 * This is used when card configuration can be built entirely from URL params.
 * @param numericUserId - Numeric user id stored in Redis key 'user:{id}'.
 * @returns Parsed UserRecord.
 * @throws {CardDataError} If no data exists (404) or parsed data is corrupted (500).
 * @source
 */
export async function fetchUserDataOnly(
  numericUserId: number,
): Promise<UserRecord> {
  const userDataStr = await redisClient.get(`user:${numericUserId}`);

  if (!userDataStr || userDataStr === "null") {
    throw new CardDataError("Not Found: User data not found", 404);
  }

  try {
    return safeParse<UserRecord>(
      userDataStr,
      `Card SVG: user:${numericUserId}`,
    );
  } catch {
    incrementAnalytics(
      buildAnalyticsMetricKey("card_svg", "corrupted_user_records"),
    ).catch(() => {});
    throw new CardDataError("Server Error: Corrupted user record", 500);
  }
}

/**
 * Loads and parses cached cards and user records from Redis for a numeric user ID.
 * Validates presence and JSON structure; records corrupted or missing values will increment analytics and throw CardDataError.
 * @param numericUserId - Numeric user id stored in Redis keys 'cards:{id}' and 'user:{id}'.
 * @returns Object containing parsed card (CardsRecord) and user (UserRecord) documents.
 * @throws {CardDataError} If no data exists (404) or parsed data is corrupted (500).
 * @source
 */
export async function fetchUserData(
  numericUserId: number,
): Promise<{ cardDoc: CardsRecord; userDoc: UserRecord }> {
  const [cardsDataStr, userDataStr] = await Promise.all([
    redisClient.get(`cards:${numericUserId}`),
    redisClient.get(`user:${numericUserId}`),
  ]);

  if (
    !cardsDataStr ||
    cardsDataStr === "null" ||
    !userDataStr ||
    userDataStr === "null"
  ) {
    throw new CardDataError("Not Found: User data not found", 404);
  }

  let cardDoc: CardsRecord;
  let userDoc: UserRecord;
  try {
    cardDoc = safeParse<CardsRecord>(
      cardsDataStr,
      `Card SVG: cards:${numericUserId}`,
    );
  } catch {
    incrementAnalytics(
      buildAnalyticsMetricKey("card_svg", "corrupted_card_records"),
    ).catch(() => {});
    throw new CardDataError("Server Error: Corrupted card configuration", 500);
  }
  try {
    userDoc = safeParse<UserRecord>(
      userDataStr,
      `Card SVG: user:${numericUserId}`,
    );
  } catch {
    incrementAnalytics(
      buildAnalyticsMetricKey("card_svg", "corrupted_user_records"),
    ).catch(() => {});
    throw new CardDataError("Server Error: Corrupted user record", 500);
  }

  return { cardDoc, userDoc };
}

/**
 * Determines if we need to fetch card config from DB or can build from URL params.
 * Returns true if colorPreset is "custom" (needs DB for gradient colors) or missing
 * @source
 */
export function needsCardConfigFromDb(params: {
  colorPresetParam: string | null;
  titleColorParam?: string | null;
  backgroundColorParam?: string | null;
  textColorParam?: string | null;
  circleColorParam?: string | null;
  borderColorParam?: string | null;
  borderRadiusParam?: string | null;
  showFavoritesParam?: string | null;
  statusColorsParam?: string | null;
  piePercentagesParam?: string | null;
  baseCardType?: string;
  variationParam?: string | null;
}): boolean {
  if (params.colorPresetParam === "custom") {
    return true;
  }
  // Determine whether the URL provides enough information to build
  // a complete card config without consulting the DB.
  // Color resolution is satisfied when either:
  //  - a named preset (non-custom) is present in the URL, or
  //  - every individual color param is provided in the URL.
  const hasNamedPreset = !!params.colorPresetParam;
  const hasIndividualColors =
    !!params.titleColorParam &&
    !!params.backgroundColorParam &&
    !!params.textColorParam &&
    !!params.circleColorParam;

  const colorsResolved = hasNamedPreset || hasIndividualColors;
  if (!colorsResolved) return true;

  // For booleans and other presentation flags that are stored in the DB,
  // we only skip the DB fetch when the URL explicitly specifies the override.
  // Note: The API accepts "true"/"false" in the query string to make the
  // explicit override possible; absence of a param means we should consult DB.
  // Only check flags relevant to the base card type / variation.
  const baseType = params.baseCardType ?? "";
  const variation = params.variationParam ?? undefined;

  // Favorites flag is relevant only for certain card types
  const favoritesRelevant = [
    "animeVoiceActors",
    "animeStudios",
    "animeStaff",
    "mangaStaff",
  ].includes(baseType);
  if (favoritesRelevant && params.showFavoritesParam == null) return true;

  // Status color preference is only meaningful for status distribution cards
  const statusRelevant = [
    "animeStatusDistribution",
    "mangaStatusDistribution",
  ].includes(baseType);
  if (statusRelevant && params.statusColorsParam == null) return true;

  // Pie chart percentages only matter in pie variations
  const pieRelevant = variation === "pie";
  if (pieRelevant && params.piePercentagesParam == null) return true;

  // If we reached here, the URL includes enough params to build a complete
  // card configuration without needing the database.
  return false;
}

/**
 * Builds a card config directly from URL params without needing DB lookup.
 * Used when all required params are in the URL.
 * @source
 */
export function buildCardConfigFromParams(params: {
  cardType: string;
  baseCardType: string;
  variationParam: string | null;
  showFavoritesParam: string | null;
  statusColorsParam: string | null;
  piePercentagesParam: string | null;
  colorPresetParam?: string | null;
  titleColorParam?: string | null;
  backgroundColorParam?: string | null;
  textColorParam?: string | null;
  circleColorParam?: string | null;
  borderColorParam?: string | null;
  borderRadiusParam?: string | null;
}): StoredCardConfig {
  const config: StoredCardConfig = {
    cardName: params.cardType,
    variation: params.variationParam || "default",
    colorPreset: params.colorPresetParam || undefined,
  };

  // Apply preset colors if a named preset is provided
  if (params.colorPresetParam && params.colorPresetParam !== "custom") {
    const presetColors = getPresetColors(params.colorPresetParam);
    if (presetColors) {
      applyPresetColorsToConfig(config, presetColors);
    }
  }

  // Apply individual color params (these override preset colors)
  applyUrlColorParams(config, params);

  // Apply border params
  applyBorderOverrides(config, params);

  if (
    params.borderRadiusParam !== null &&
    params.borderRadiusParam !== undefined
  ) {
    const parsedRadius = Number.parseInt(params.borderRadiusParam, 10);
    if (!Number.isNaN(parsedRadius)) {
      config.borderRadius = clampBorderRadius(parsedRadius);
    }
  }

  // Apply boolean flags
  if (params.showFavoritesParam === "true") {
    config.showFavorites = true;
  }
  if (
    params.statusColorsParam === "true" &&
    ["animeStatusDistribution", "mangaStatusDistribution"].includes(
      params.baseCardType,
    )
  ) {
    config.useStatusColors = true;
  }
  if (params.piePercentagesParam === "true" && config.variation === "pie") {
    config.showPiePercentages = true;
  }

  // Explicitly set false when URL contains explicit 'false' to make
  // overrides unambiguous for downstream logic that inspects StoredCardConfig
  if (params.showFavoritesParam === "false") {
    config.showFavorites = false;
  }
  if (
    params.statusColorsParam === "false" &&
    ["animeStatusDistribution", "mangaStatusDistribution"].includes(
      params.baseCardType,
    )
  ) {
    config.useStatusColors = false;
  }
  if (params.piePercentagesParam === "false" && config.variation === "pie") {
    config.showPiePercentages = false;
  }

  return config;
}

/**
 * Processes favorites for a card when needed.
 * @source
 */
export function processFavorites(
  baseCardType: string,
  showFavoritesParam: string | null,
  showFavoritesStored: boolean | undefined,
  userDoc: UserRecord,
): string[] {
  const useFavorites =
    showFavoritesParam === null
      ? !!showFavoritesStored
      : showFavoritesParam === "true";

  if (
    useFavorites &&
    ["animeVoiceActors", "animeStudios", "animeStaff", "mangaStaff"].includes(
      baseCardType,
    )
  ) {
    const favourites = userDoc?.stats?.User?.favourites ?? {};
    return getFavoritesForCardType(favourites, baseCardType);
  }
  return [];
}

/**
 * Converts a color value to string format for config storage.
 * @source
 */
function colorToString(color: ColorValue): string {
  return typeof color === "string" ? color : JSON.stringify(color);
}

/**
 * Applies preset colors to a card config.
 * @source
 */
function applyPresetColorsToConfig(
  config: StoredCardConfig,
  presetColors: ColorValue[],
): void {
  config.titleColor = colorToString(presetColors[0]);
  config.backgroundColor = colorToString(presetColors[1]);
  config.textColor = colorToString(presetColors[2]);
  config.circleColor = colorToString(presetColors[3]);
}

/**
 * Applies individual URL color params to config.
 * @source
 */
function applyUrlColorParams(
  config: StoredCardConfig,
  params: {
    titleColorParam?: string | null;
    backgroundColorParam?: string | null;
    textColorParam?: string | null;
    circleColorParam?: string | null;
  },
): void {
  if (params.titleColorParam) config.titleColor = params.titleColorParam;
  if (params.backgroundColorParam)
    config.backgroundColor = params.backgroundColorParam;
  if (params.textColorParam) config.textColor = params.textColorParam;
  if (params.circleColorParam) config.circleColor = params.circleColorParam;
}

/**
 * Type used by applyColorOverrides to represent URL color overrides.
 * Exported so other modules can adopt the same contract when building
 * card URLs or interpreting query parameters.
 */
export type ColorOverrideParams = {
  colorPresetParam?: string | null;
  titleColorParam?: string | null;
  backgroundColorParam?: string | null;
  textColorParam?: string | null;
  circleColorParam?: string | null;
};

/**
 * Compute the effective preset name given an optional URL param and a stored
 * config. URL param has precedence over stored preset.
 */
export function resolveEffectiveColorPreset(
  colorPresetParam?: string | null,
  storedColorPreset?: string | undefined,
): string | undefined {
  return colorPresetParam ?? storedColorPreset ?? undefined;
}

/**
 * Returns true when an effective preset indicates that the server should not
 * apply any URL color overrides - this is used for "custom" preset behavior.
 */
export function isCustomPreset(effectivePreset?: string | undefined): boolean {
  return effectivePreset === "custom";
}

/**
 * Applies color parameters from URL to the card config.
 *
 * Color resolution priority (server-side):
 *  1. If the URL `colorPreset` equals "custom", the server uses database
 *     stored colors (this supports gradients and explicitly ignores any
 *     individual URL color params).
 *  2. Otherwise, if a named `colorPreset` is present in the URL, apply the
 *     named preset colors.
 *  3. If there's no URL preset but the stored config includes a `colorPreset`,
 *     apply that stored preset.
 *  4. After applying a preset (URL or DB), any individual URL color params
 *     (titleColor, backgroundColor, textColor, circleColor) override the
 *     corresponding preset colors.
 *  5. If none of the above apply, colors persist from the stored DB values.
 *
 * @source
 */
function applyColorOverrides(
  config: StoredCardConfig,
  params: ColorOverrideParams,
): void {
  // Determine which preset to use (URL takes precedence over stored)
  const effectivePreset = resolveEffectiveColorPreset(
    params.colorPresetParam,
    config.colorPreset,
  );

  // If colorPreset is "custom", keep database colors (supports gradients)
  if (isCustomPreset(effectivePreset)) {
    return;
  }

  // If a named preset is provided (from URL or database), look up and apply preset colors
  if (effectivePreset) {
    const presetColors = getPresetColors(effectivePreset);
    if (presetColors) {
      applyPresetColorsToConfig(config, presetColors);
      // After applying preset, check if any individual color params override
      applyUrlColorParams(config, params);
      return;
    }
    console.warn(`[Card Data] Unknown color preset: ${effectivePreset}`);
  }

  // Apply URL color params if provided (these override database values)
  applyUrlColorParams(config, params);
}

/**
 * Look up preset colors by name.
 * @returns Array of [titleColor, backgroundColor, textColor, circleColor] or null if not found.
 * @source
 */
function getPresetColors(presetName: string): ColorValue[] | null {
  const preset = colorPresets[presetName];
  if (!preset || !Array.isArray(preset.colors) || preset.colors.length < 4) {
    return null;
  }
  // Return all 4 colors (may include gradient objects)
  return preset.colors.slice(0, 4);
}

/**
 * Applies border parameters from URL to the card config.
 * @source
 */
function applyBorderOverrides(
  config: StoredCardConfig,
  params: {
    borderColorParam?: string | null;
    borderRadiusParam?: string | null;
  },
): void {
  if (
    params.borderColorParam !== null &&
    params.borderColorParam !== undefined
  ) {
    config.borderColor = params.borderColorParam || undefined;
  }
  if (
    params.borderRadiusParam !== null &&
    params.borderRadiusParam !== undefined
  ) {
    const parsedRadius = Number.parseInt(params.borderRadiusParam);
    if (!Number.isNaN(parsedRadius)) {
      config.borderRadius = clampBorderRadius(parsedRadius);
    }
  }
}

/**
 * Resolves and applies runtime overrides to a stored card configuration for rendering.
 * Purpose: select the correct card configuration, apply variation param, and optionally include favourites and status/pie display options.
 *
 * Color handling priority:
 * 1. If colorPreset is "custom", always load colors from database
 * 2. If individual color params are provided in URL, use those
 * 3. Otherwise, fall back to stored card configuration in database
 *
 * @param cardDoc - The CardsRecord containing saved card configurations for the user.
 * @param params - Request parameters controlling cardType, variation and boolean-like UI overrides.
 * @param userDoc - The normalized user record used to resolve favourites when requested.
 * @returns The processed StoredCardConfig, the effective variation name, and the favourites list used by the template.
 * @throws {CardDataError} When no configuration for the requested cardType exists.
 * @source
 */
export function processCardConfig(
  cardDoc: CardsRecord,
  params: {
    cardType: string;
    numericUserId: number;
    baseCardType: string;
    variationParam: string | null;
    showFavoritesParam: string | null;
    statusColorsParam: string | null;
    piePercentagesParam: string | null;
    colorPresetParam?: string | null;
    titleColorParam?: string | null;
    backgroundColorParam?: string | null;
    textColorParam?: string | null;
    circleColorParam?: string | null;
    borderColorParam?: string | null;
    borderRadiusParam?: string | null;
  },
  userDoc: UserRecord,
): {
  cardConfig: StoredCardConfig;
  effectiveVariation: string;
  favorites: string[];
} {
  const { cardType, baseCardType } = params;

  const cardConfig = cardDoc.cards.find(
    (c: StoredCardConfig) => c.cardName === cardType,
  );
  if (!cardConfig) {
    throw new CardDataError(
      "Not Found: Card config not found. Try to regenerate the card.",
      404,
    );
  }

  const effectiveCardConfig: StoredCardConfig = {
    ...cardConfig,
  } as StoredCardConfig;
  const effectiveVariation =
    params.variationParam || effectiveCardConfig.variation || "default";

  applyColorOverrides(effectiveCardConfig, params);
  applyBorderOverrides(effectiveCardConfig, params);

  if (params.showFavoritesParam === "false") {
    effectiveCardConfig.showFavorites = false;
  }

  let favorites: string[] = [];
  const useFavorites =
    params.showFavoritesParam === null
      ? !!effectiveCardConfig.showFavorites
      : params.showFavoritesParam === "true";

  if (
    useFavorites &&
    ["animeVoiceActors", "animeStudios", "animeStaff", "mangaStaff"].includes(
      baseCardType,
    )
  ) {
    const favourites = userDoc?.stats?.User?.favourites ?? {};
    favorites = getFavoritesForCardType(favourites, baseCardType);
  }

  if (
    params.statusColorsParam === "true" &&
    ["animeStatusDistribution", "mangaStatusDistribution"].includes(
      baseCardType,
    )
  ) {
    effectiveCardConfig.useStatusColors = true;
  }
  if (
    params.statusColorsParam === "false" &&
    ["animeStatusDistribution", "mangaStatusDistribution"].includes(
      baseCardType,
    )
  ) {
    effectiveCardConfig.useStatusColors = false;
  }

  if (
    ["animeStatusDistribution", "mangaStatusDistribution"].includes(
      baseCardType,
    ) &&
    effectiveCardConfig.useStatusColors == null
  ) {
    effectiveCardConfig.useStatusColors = false;
  }

  if (params.piePercentagesParam === "true" && effectiveVariation === "pie") {
    effectiveCardConfig.showPiePercentages = true;
  }
  if (params.piePercentagesParam === "false" && effectiveVariation === "pie") {
    effectiveCardConfig.showPiePercentages = false;
  }

  if (
    effectiveVariation === "pie" &&
    effectiveCardConfig.showPiePercentages == null
  ) {
    effectiveCardConfig.showPiePercentages = false;
  }

  if (
    ["animeVoiceActors", "animeStudios", "animeStaff", "mangaStaff"].includes(
      baseCardType,
    ) &&
    effectiveCardConfig.showFavorites == null
  ) {
    effectiveCardConfig.showFavorites = false;
  }

  return { cardConfig: effectiveCardConfig, effectiveVariation, favorites };
}
