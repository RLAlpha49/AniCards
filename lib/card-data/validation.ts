import {
  UserRecord,
  UserStatsData,
  AnimeStats,
  MangaStats,
  AnimeStatVoiceActor,
  AnimeStatStudio,
  AnimeStatStaff,
  MangaStatStaff,
} from "@/lib/types/records";

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

/** Fields representing milestone progress used by card templates. @source */
export type MilestoneFields = {
  previousMilestone: number;
  currentMilestone: number;
  percentage: number;
  dasharray: string;
  dashoffset: string;
};
