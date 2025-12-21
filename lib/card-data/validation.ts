import {
  UserRecord,
  UserStatsData,
  AnimeStats,
  MangaStats,
  AnimeStatVoiceActor,
  AnimeStatStudio,
  AnimeStatStaff,
  MangaStatStaff,
  MediaListCollection,
  MediaListEntry,
  SourceMaterialDistributionTotalsEntry,
  SeasonalPreferenceTotalsEntry,
  AnimeGenreSynergyTotalsEntry,
  UserAvatar,
} from "@/lib/types/records";
import type { ErrorCategory, RecoverySuggestion } from "@/lib/error-messages";
import { getErrorDetails } from "@/lib/error-messages";

/**
 * Error wrapper including an HTTP status code, error category, and recovery suggestions.
 * Useful for returning standardized errors from card-related handlers with user guidance.
 *
 * The `category`, `suggestions`, and `retryable` properties are automatically derived from
 * the error message and status code, enabling consistent error handling across the application.
 *
 * These properties are primarily used for:
 * - Error tracking and telemetry (logged via trackUserActionError in API routes)
 * - Client-side error display logic (determining retry behavior)
 * - Future expansion to include structured suggestion data in API responses
 *
 * @source
 */
export class CardDataError extends Error {
  status: number;
  category: ErrorCategory;
  suggestions: RecoverySuggestion[];
  retryable: boolean;

  constructor(message: string, status = 500) {
    super(message);
    this.status = status;

    // Categorize and get details from error message system
    const errorDetails = getErrorDetails(message, status);
    this.category = errorDetails.category;
    this.suggestions = errorDetails.suggestions;
    this.retryable = errorDetails.retryable;
  }
}

/** Representation of a genre and its count for a user's media statistics. @source */
export type GenreItem = { genre: string; count: number };
/** Tag item (name + count) used in tag distribution lists. @source */
export type TagItem = {
  tag: { name: string; category?: string };
  count: number;
};
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
  socialMilestones: "Social Milestones",
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
  animeSourceMaterialDistribution: "Anime Source Materials",
  animeSeasonalPreference: "Anime Seasons",
  animeGenreSynergy: "Genre Synergy",
  animeScoreDistribution: "Anime Scores",
  mangaScoreDistribution: "Manga Scores",
  animeYearDistribution: "Anime Years",
  mangaYearDistribution: "Manga Years",
  animeCountry: "Anime Countries",
  mangaCountry: "Manga Countries",
  profileOverview: "Profile Overview",
  favoritesSummary: "Favourites Summary",
  favoritesGrid: "Favourites Grid",
  activityHeatmap: "Activity Heatmap",
  recentActivitySummary: "Recent Activity Summary",
  recentActivityFeed: "Recent Activity Feed",
  activityStreaks: "Activity Streaks",
  activityPatterns: "Activity Patterns",
  topActivityDays: "Top Activity Days",
  statusCompletionOverview: "Status Completion Overview",
  milestones: "Consumption Milestones",
  personalRecords: "Personal Records",
  planningBacklog: "Planning Backlog",
  mostRewatched: "Most Rewatched/Reread",
  currentlyWatchingReading: "Currently Watching / Reading",
  animeMangaOverview: "Anime vs Manga Overview",
  scoreCompareAnimeManga: "Anime vs Manga Score Comparison",
  countryDiversity: "Country Diversity",
  genreDiversity: "Genre Diversity",
  formatPreferenceOverview: "Format Preference Overview",
  releaseEraPreference: "Release Era Preference",
  startYearMomentum: "Start-Year Momentum",
  lengthPreference: "Length Preference",
  animeEpisodeLengthPreferences: "Episode Length Preferences",
};

/**
 * Returns whether the provided card type string corresponds to a supported
 * base card type. Accepts values with optional suffix variants (e.g.
 * "animeStats-vertical") and validates against the server-known
 * `displayNames` mapping.
 * @param candidate - Card type string to validate.
 * @returns true when the base card type is supported, false otherwise.
 */
export function isValidCardType(candidate: unknown): boolean {
  if (typeof candidate !== "string" || candidate.trim().length === 0) {
    return false;
  }
  const [base] = candidate.split("-");
  return Object.hasOwn(displayNames, base);
}

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
    ? rawActivityHistory
        .map((a: unknown) => {
          const item = a as { date?: unknown; amount?: unknown };
          const date = Number(item?.date ?? Number.NaN);
          const amount = Number(item?.amount ?? Number.NaN);
          return {
            date: Number.isFinite(date) ? date : 0,
            amount: Number.isFinite(amount) ? amount : 0,
          };
        })
        .filter((entry) => {
          const oneYearAgo = Math.floor(Date.now() / 1000) - 31536000;
          return entry.date >= oneYearAgo;
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
          .slice(0, 25)
      : [];
    const rawTags = block["tags"];
    const tags = Array.isArray(rawTags)
      ? (rawTags as unknown[])
          .map((t) => {
            if (!t || typeof t !== "object") return null;
            const rec = t as Record<string, unknown>;
            const tagName = getNestedString(rec, ["tag", "name"]);
            const tagCategory = getNestedString(rec, ["tag", "category"]);
            return {
              tag: {
                name: tagName,
                ...(tagCategory ? { category: tagCategory } : {}),
              },
              count: coerceNumber(rec.count, 0) ?? 0,
            };
          })
          .filter(
            (
              t,
            ): t is {
              tag: { name: string; category?: string };
              count: number;
            } => !!t && !!t.tag && !!t.tag.name,
          )
          .slice(0, 25)
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
          .slice(0, 25)
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
          .slice(0, 25)
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
          .slice(0, 25)
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

    const rawStartYears = block["startYears"];
    const startYears = Array.isArray(rawStartYears)
      ? (rawStartYears as unknown[])
          .map((s) => {
            if (!s || typeof s !== "object") return null;
            const rec = s as Record<string, unknown>;
            return {
              startYear: coerceNumber(rec.startYear, Number.NaN),
              count: coerceNumber(rec.count, 0),
            };
          })
          .filter(
            (s): s is { startYear: number; count: number } =>
              s !== null &&
              Number.isFinite(s.startYear) &&
              typeof s.count === "number" &&
              Number.isFinite(s.count),
          )
      : undefined;

    const rawLengths = block["lengths"];
    const lengths = Array.isArray(rawLengths)
      ? (rawLengths as unknown[])
          .map((l) => {
            if (!l || typeof l !== "object") return null;
            const rec = l as Record<string, unknown>;
            const length = String(rec.length ?? "").trim();
            return {
              length,
              count: coerceNumber(rec.count, 0),
            };
          })
          .filter(
            (l): l is { length: string; count: number } =>
              l !== null &&
              l.length !== "" &&
              typeof l.count === "number" &&
              Number.isFinite(l.count),
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
      startYears,
      lengths,
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

  /**
   * Normalizes AniList MediaListCollection structures (planning, completed, rewatched, etc.).
   * Ensures `lists` is an array and sanitizes entries to match `MediaListEntry` shape.
   * @param raw - Raw MediaListCollection-like object from the AniList response.
   * @returns MediaListCollection or undefined when input is invalid.
   */
  const mapMediaListEntry = (e: unknown): MediaListEntry | null => {
    if (!e || typeof e !== "object") return null;
    const r = e as Record<string, unknown>;
    const media = (r.media as Record<string, unknown> | undefined) ?? {};
    const _coverLarge = getNestedString(media, ["coverImage", "large"]);
    const _coverMedium = getNestedString(media, ["coverImage", "medium"]);
    const _coverColor = getNestedString(media, ["coverImage", "color"]);
    const coverImage =
      _coverLarge || _coverMedium || _coverColor
        ? {
            large: _coverLarge || undefined,
            medium: _coverMedium || undefined,
            color: _coverColor || undefined,
          }
        : undefined;

    const rawGenres = media["genres"];
    const genres = Array.isArray(rawGenres)
      ? rawGenres
          .filter((g): g is string => typeof g === "string")
          .map((g) => g.trim())
          .filter((g) => g.length > 0)
      : undefined;

    return {
      id: coerceNumber(r.id, 0) ?? 0,
      score: coerceNumber(r.score),
      progress: coerceNumber(r.progress),
      repeat: coerceNumber(r.repeat),
      media: {
        id: coerceNumber(media?.id, 0) ?? 0,
        title: {
          english: getNestedString(media, ["title", "english"]),
          romaji: getNestedString(media, ["title", "romaji"]),
          native: getNestedString(media, ["title", "native"]),
        },
        ...(coverImage ? { coverImage } : {}),
        episodes: coerceNumber(media?.episodes),
        chapters: coerceNumber(media?.chapters),
        volumes: coerceNumber(media?.volumes),
        averageScore: coerceNumber(media?.averageScore),
        format: getNestedString(media, ["format"]) || undefined,
        source: getNestedString(media, ["source"]) || undefined,
        season: getNestedString(media, ["season"]) || undefined,
        seasonYear: coerceNumber(media?.seasonYear),
        ...(genres && genres.length ? { genres } : {}),
      },
    } as MediaListEntry;
  };

  const normalizeMediaListCollection = (
    raw: unknown,
  ): MediaListCollection | undefined => {
    if (!raw || typeof raw !== "object") return undefined;
    const v = raw as Record<string, unknown>;
    if (!Array.isArray(v.lists)) return undefined;

    const allEntriesRaw: MediaListEntry[] = (v.lists as unknown[])
      .flatMap((list) => {
        const rec =
          list && typeof list === "object"
            ? (list as Record<string, unknown>)
            : {};
        return Array.isArray(rec.entries) ? rec.entries : [];
      })
      .map(mapMediaListEntry)
      .filter((x): x is MediaListEntry => x !== null);

    const rank = (e: MediaListEntry): readonly [number, number, number] => [
      e.repeat ?? 0,
      e.score ?? 0,
      e.progress ?? 0,
    ];
    const isBetter = (
      current: MediaListEntry,
      next: MediaListEntry,
    ): boolean => {
      const a = rank(current);
      const b = rank(next);
      for (let i = 0; i < a.length; i++) {
        if (a[i] !== b[i]) return b[i] > a[i];
      }
      return false;
    };

    const byMediaId = new Map<number, MediaListEntry>();
    for (const entry of allEntriesRaw) {
      const mediaId = entry.media?.id;
      if (!mediaId) continue;
      const existing = byMediaId.get(mediaId);
      if (!existing || isBetter(existing, entry)) byMediaId.set(mediaId, entry);
    }

    const allEntries = [...byMediaId.values()];

    const rawCount = coerceNumber(v.count);
    const totalCount = rawCount ?? allEntries.length;

    const rawTotalRepeat = coerceNumber(v.totalRepeat);
    const computedTotalRepeat = allEntries.reduce(
      (sum, e) => sum + (e.repeat ?? 0),
      0,
    );
    const totalRepeat = rawTotalRepeat ?? computedTotalRepeat;

    return {
      lists: [{ name: "All", entries: allEntries }],
      count: totalCount,
      totalRepeat,
    };
  };

  const isPrunedAllList = (raw: unknown): boolean =>
    !!raw &&
    typeof raw === "object" &&
    Array.isArray((raw as { lists?: unknown }).lists) &&
    (raw as { lists: { name?: string }[] }).lists.length === 1 &&
    (raw as { lists: { name?: string }[] }).lists[0].name === "All";

  const pruneIfNeeded = (
    raw: unknown,
    coll: MediaListCollection | undefined,
    pruner: (entries: MediaListEntry[]) => MediaListEntry[],
  ): MediaListCollection | undefined => {
    if (!coll) return undefined;
    if (isPrunedAllList(raw)) return coll;
    const entries = coll.lists.flatMap((l) => l.entries);
    const pruned = pruner(entries);
    return { ...coll, lists: [{ name: "All", entries: pruned }] };
  };

  /**
   * If the record already contains stored totals (computed at write time), keep them.
   * Otherwise, we can derive totals from the available list data.
   */
  const normalizeStoredSourceTotals = (
    value: unknown,
  ): SourceMaterialDistributionTotalsEntry[] | undefined => {
    if (!Array.isArray(value)) return undefined;

    const normalized = value
      .map((item) => {
        if (!item || typeof item !== "object") return null;
        const rec = item as Record<string, unknown>;
        const source = typeof rec.source === "string" ? rec.source : "";
        const count =
          typeof rec.count === "number" && Number.isFinite(rec.count)
            ? rec.count
            : Number.NaN;
        if (!source.trim() || !Number.isFinite(count) || count <= 0)
          return null;
        return { source: source.trim(), count };
      })
      .filter((x): x is SourceMaterialDistributionTotalsEntry => x !== null);

    return normalized.length ? normalized : undefined;
  };

  const normalizeStoredSeasonTotals = (
    value: unknown,
  ): SeasonalPreferenceTotalsEntry[] | undefined => {
    if (!Array.isArray(value)) return undefined;

    const normalized = value
      .map((item) => {
        if (!item || typeof item !== "object") return null;
        const rec = item as Record<string, unknown>;
        const season = typeof rec.season === "string" ? rec.season : "";
        const count =
          typeof rec.count === "number" && Number.isFinite(rec.count)
            ? rec.count
            : Number.NaN;
        if (!season.trim() || !Number.isFinite(count) || count <= 0)
          return null;
        return { season: season.trim(), count };
      })
      .filter((x): x is SeasonalPreferenceTotalsEntry => x !== null);

    return normalized.length ? normalized : undefined;
  };

  const normalizeStoredGenreSynergyTotals = (
    value: unknown,
  ): AnimeGenreSynergyTotalsEntry[] | undefined => {
    if (!Array.isArray(value)) return undefined;

    const normalized = value
      .map((item) => {
        if (!item || typeof item !== "object") return null;
        const rec = item as Record<string, unknown>;
        const a = typeof rec.a === "string" ? rec.a.trim() : "";
        const b = typeof rec.b === "string" ? rec.b.trim() : "";
        const count =
          typeof rec.count === "number" && Number.isFinite(rec.count)
            ? rec.count
            : Number.NaN;

        if (!a || !b || a === b || !Number.isFinite(count) || count <= 0) {
          return null;
        }

        // Canonicalize ordering so stored data stays consistent.
        const [left, right] = a.localeCompare(b) <= 0 ? [a, b] : [b, a];
        return { a: left, b: right, count } satisfies AnimeGenreSynergyTotalsEntry;
      })
      .filter((x): x is AnimeGenreSynergyTotalsEntry => x !== null);

    if (!normalized.length) return undefined;

    // Deduplicate by pair, keeping the max count just in case.
    const byKey = new Map<string, AnimeGenreSynergyTotalsEntry>();
    for (const item of normalized) {
      const key = `${item.a}|||${item.b}`;
      const existing = byKey.get(key);
      if (!existing || item.count > existing.count) byKey.set(key, item);
    }
    return [...byKey.values()];
  };

  /**
   * Compute pre-aggregated totals for Source Material Distribution.
   *
   * IMPORTANT: This uses the *full* CURRENT + COMPLETED lists as returned by AniList
   * (after normalization), before we prune what gets persisted to Redis.
   */
  const computeAnimeSourceMaterialDistributionTotals = ():
    | SourceMaterialDistributionTotalsEntry[]
    | undefined => {
    const completedFull = normalizeMediaListCollection(
      statsData.animeCompleted,
    );
    const currentFull = normalizeMediaListCollection(statsData.animeCurrent);

    const completedEntries =
      completedFull?.lists.flatMap((l) => l.entries) ?? [];
    const currentEntries = currentFull?.lists.flatMap((l) => l.entries) ?? [];
    const all = [...completedEntries, ...currentEntries];
    if (!all.length) return undefined;

    const uniqueByMediaId = new Map<number, MediaListEntry>();
    for (const entry of all) {
      const mediaId = entry.media?.id;
      if (!mediaId) continue;
      if (!uniqueByMediaId.has(mediaId)) uniqueByMediaId.set(mediaId, entry);
    }

    const counts = new Map<string, number>();
    for (const entry of uniqueByMediaId.values()) {
      const source = (entry.media.source ?? "UNKNOWN").trim() || "UNKNOWN";
      counts.set(source, (counts.get(source) ?? 0) + 1);
    }

    return [...counts.entries()]
      .map(([source, count]) => ({ source, count }))
      .filter((x) => x.count > 0)
      .sort((a, b) => b.count - a.count);
  };

  /**
   * Compute pre-aggregated totals for the Anime Seasonal Preference card.
   *
   * IMPORTANT: This uses the *full* CURRENT + COMPLETED lists as returned by AniList
   * (after normalization), before we prune what gets persisted to Redis.
   */
  const computeAnimeSeasonalPreferenceTotals = ():
    | SeasonalPreferenceTotalsEntry[]
    | undefined => {
    const completedFull = normalizeMediaListCollection(statsData.animeCompleted);
    const currentFull = normalizeMediaListCollection(statsData.animeCurrent);

    const completedEntries =
      completedFull?.lists.flatMap((l) => l.entries) ?? [];
    const currentEntries = currentFull?.lists.flatMap((l) => l.entries) ?? [];
    const all = [...completedEntries, ...currentEntries];
    if (!all.length) return undefined;

    const uniqueByMediaId = new Map<number, MediaListEntry>();
    for (const entry of all) {
      const mediaId = entry.media?.id;
      if (!mediaId) continue;
      if (!uniqueByMediaId.has(mediaId)) uniqueByMediaId.set(mediaId, entry);
    }

    const normalizeSeason = (v: string | undefined): string => {
      const raw = (v ?? "").trim().toUpperCase();
      if (raw === "WINTER" || raw === "SPRING" || raw === "SUMMER" || raw === "FALL") {
        return raw;
      }
      return "UNKNOWN";
    };

    const counts = new Map<string, number>();
    for (const entry of uniqueByMediaId.values()) {
      const season = normalizeSeason(entry.media.season);
      counts.set(season, (counts.get(season) ?? 0) + 1);
    }

    const order = ["WINTER", "SPRING", "SUMMER", "FALL", "UNKNOWN"];
    const items = order
      .map((season) => ({ season, count: counts.get(season) ?? 0 }))
      .filter((x) => x.count > 0);

    return items.length ? items : undefined;
  };

  /**
   * Compute pre-aggregated co-occurrence totals for Genre Synergy.
   *
   * IMPORTANT: This uses the *full* COMPLETED list as returned by AniList
   * (after normalization), before we prune what gets persisted to Redis.
   */
  const computeAnimeGenreSynergyTotals = ():
    | AnimeGenreSynergyTotalsEntry[]
    | undefined => {
    const completedFull = normalizeMediaListCollection(statsData.animeCompleted);
    const entries = completedFull?.lists.flatMap((l) => l.entries) ?? [];
    if (!entries.length) return undefined;

    const TOP_N = 10;
    const MAX_GENRES_PER_TITLE = 12;

    const counts = new Map<string, number>();
    for (const entry of entries) {
      const raw = entry.media?.genres ?? [];
      if (!Array.isArray(raw) || raw.length < 2) continue;

      const uniqueGenres = [...new Set(raw.map((g) => g.trim()).filter(Boolean))]
        .slice(0, MAX_GENRES_PER_TITLE)
        .sort((a, b) => a.localeCompare(b));

      if (uniqueGenres.length < 2) continue;

      for (let i = 0; i < uniqueGenres.length; i++) {
        for (let j = i + 1; j < uniqueGenres.length; j++) {
          const a = uniqueGenres[i]!;
          const b = uniqueGenres[j]!;
          const key = `${a}|||${b}`;
          counts.set(key, (counts.get(key) ?? 0) + 1);
        }
      }
    }

    const items: AnimeGenreSynergyTotalsEntry[] = [...counts.entries()]
      .map(([key, count]) => {
        const [a, b] = key.split("|||");
        if (!a || !b) return null;
        return { a, b, count } satisfies AnimeGenreSynergyTotalsEntry;
      })
      .filter((x): x is AnimeGenreSynergyTotalsEntry => x !== null)
      .filter((x) => x.count > 0)
      .sort(
        (x, y) =>
          y.count - x.count || x.a.localeCompare(y.a) || x.b.localeCompare(y.b),
      )
      .slice(0, TOP_N);

    return items.length ? items : undefined;
  };

  const storedAnimeSourceTotals = normalizeStoredSourceTotals(
    (user as Record<string, unknown>).animeSourceMaterialDistributionTotals,
  );

  const storedAnimeSeasonTotals = normalizeStoredSeasonTotals(
    (user as Record<string, unknown>).animeSeasonalPreferenceTotals,
  );

  const storedAnimeGenreSynergyTotals = normalizeStoredGenreSynergyTotals(
    (user as Record<string, unknown>).animeGenreSynergyTotals,
  );

  const combineUnique = (
    a: MediaListEntry[],
    b: MediaListEntry[],
  ): MediaListEntry[] => {
    const combined = [...a];
    for (const e of b) {
      if (!combined.some((c) => c.id === e.id)) combined.push(e);
    }
    return combined;
  };

  const mapFavouriteMediaNode = (n: unknown) => {
    const rec = n as Record<string, unknown>;
    return {
      id: coerceNumber(rec.id),
      title: {
        english: getNestedString(rec, ["title", "english"]),
        romaji: getNestedString(rec, ["title", "romaji"]),
        native: getNestedString(rec, ["title", "native"]),
      },
      coverImage: {
        large: getNestedString(rec, ["coverImage", "large"]),
        medium: getNestedString(rec, ["coverImage", "medium"]),
        color: getNestedString(rec, ["coverImage", "color"]),
      },
    };
  };

  const mapFavouritePersonNode = (n: unknown) => {
    const rec = n as Record<string, unknown>;
    return {
      id: coerceNumber(rec.id),
      name: {
        full: getNestedString(rec, ["name", "full"]),
        native: getNestedString(rec, ["name", "native"]),
      },
      image: {
        large: getNestedString(rec, ["image", "large"]),
        medium: getNestedString(rec, ["image", "medium"]),
      },
    };
  };

  const mapFavouriteStudioNode = (n: unknown) => {
    const rec = n as Record<string, unknown>;
    return {
      id: coerceNumber(rec.id),
      name: getNestedString(rec, ["name"]),
    };
  };

  let favoriteAnimeNodes: unknown[] = [];
  let favoriteMangaNodes: unknown[] = [];
  let favoriteStaffNodes: unknown[] = [];
  let favoriteStudiosNodes: unknown[] = [];
  let favoriteCharactersNodes: unknown[] = [];
  if (Array.isArray(statsData.User?.favourites?.anime?.nodes)) {
    favoriteAnimeNodes = statsData.User.favourites.anime.nodes;
  }
  if (Array.isArray(statsData.User?.favourites?.manga?.nodes)) {
    favoriteMangaNodes = statsData.User.favourites.manga.nodes;
  }
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
    animeSourceMaterialDistributionTotals:
      storedAnimeSourceTotals ?? computeAnimeSourceMaterialDistributionTotals(),
    animeSeasonalPreferenceTotals:
      storedAnimeSeasonTotals ?? computeAnimeSeasonalPreferenceTotals(),
    animeGenreSynergyTotals:
      storedAnimeGenreSynergyTotals ?? computeAnimeGenreSynergyTotals(),
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
      // We limit the entries saved to the database to only what's needed for the cards
      animePlanning: (() => {
        const raw = statsData.animePlanning;
        const coll = normalizeMediaListCollection(raw);
        return pruneIfNeeded(raw, coll, (entries) =>
          [...entries]
            .sort(
              (a, b) =>
                (b.media.averageScore ?? 0) - (a.media.averageScore ?? 0),
            )
            .slice(0, 5),
        );
      })(),
      mangaPlanning: (() => {
        const raw = statsData.mangaPlanning;
        const coll = normalizeMediaListCollection(raw);
        return pruneIfNeeded(raw, coll, (entries) =>
          [...entries]
            .sort(
              (a, b) =>
                (b.media.averageScore ?? 0) - (a.media.averageScore ?? 0),
            )
            .slice(0, 5),
        );
      })(),
      animeCurrent: (() => {
        const raw = statsData.animeCurrent;
        const coll = normalizeMediaListCollection(raw);
        return pruneIfNeeded(raw, coll, (entries) =>
          // Keep most recent items as returned by the AniList sort (UPDATED_TIME_DESC)
          entries.slice(0, 6),
        );
      })(),
      mangaCurrent: (() => {
        const raw = statsData.mangaCurrent;
        const coll = normalizeMediaListCollection(raw);
        return pruneIfNeeded(raw, coll, (entries) => entries.slice(0, 6));
      })(),
      animeRewatched: (() => {
        const raw = statsData.animeRewatched;
        const coll = normalizeMediaListCollection(raw);
        return pruneIfNeeded(raw, coll, (entries) =>
          [...entries]
            .sort((a, b) => (b.repeat ?? 0) - (a.repeat ?? 0))
            .slice(0, 10),
        );
      })(),
      mangaReread: (() => {
        const raw = statsData.mangaReread;
        const coll = normalizeMediaListCollection(raw);
        return pruneIfNeeded(raw, coll, (entries) =>
          [...entries]
            .sort((a, b) => (b.repeat ?? 0) - (a.repeat ?? 0))
            .slice(0, 10),
        );
      })(),
      animeCompleted: (() => {
        const raw = statsData.animeCompleted;
        const coll = normalizeMediaListCollection(raw);
        return pruneIfNeeded(raw, coll, (entries) => {
          const topByScore = [...entries]
            .sort((a, b) => (b.score ?? 0) - (a.score ?? 0))
            .slice(0, 5);
          const topByLength = [...entries]
            .sort((a, b) => (b.media.episodes ?? 0) - (a.media.episodes ?? 0))
            .slice(0, 5);
          return combineUnique(topByScore, topByLength);
        });
      })(),
      mangaCompleted: (() => {
        const raw = statsData.mangaCompleted;
        const coll = normalizeMediaListCollection(raw);
        return pruneIfNeeded(raw, coll, (entries) => {
          const topByScore = [...entries]
            .sort((a, b) => (b.score ?? 0) - (a.score ?? 0))
            .slice(0, 5);
          const topByLength = [...entries]
            .sort((a, b) => (b.media.chapters ?? 0) - (a.media.chapters ?? 0))
            .slice(0, 5);
          return combineUnique(topByScore, topByLength);
        });
      })(),
      User: {
        stats: {
          activityHistory: normalizedActivityHistory,
        },
        favourites: {
          anime: { nodes: favoriteAnimeNodes.map(mapFavouriteMediaNode) },
          manga: { nodes: favoriteMangaNodes.map(mapFavouriteMediaNode) },
          staff: { nodes: favoriteStaffNodes.map(mapFavouritePersonNode) },
          studios: { nodes: favoriteStudiosNodes.map(mapFavouriteStudioNode) },
          characters: {
            nodes: favoriteCharactersNodes.map(mapFavouritePersonNode),
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
        avatar: (() => {
          const rawAvatar = statsData.User?.avatar;
          if (
            rawAvatar &&
            typeof rawAvatar === "object" &&
            (typeof (rawAvatar as Record<string, unknown>).large === "string" ||
              typeof (rawAvatar as Record<string, unknown>).medium === "string")
          ) {
            const av = rawAvatar as Record<string, unknown>;
            return {
              large: typeof av.large === "string" ? av.large : undefined,
              medium: typeof av.medium === "string" ? av.medium : undefined,
            } as UserAvatar;
          }
          return undefined;
        })(),
        createdAt: (() => {
          const rawCreatedAt = statsData.User?.createdAt;
          if (typeof rawCreatedAt === "number") return rawCreatedAt;
          if (typeof rawCreatedAt === "string") {
            const parsed = Number.parseInt(rawCreatedAt, 10);
            return Number.isFinite(parsed) ? parsed : undefined;
          }
          return undefined;
        })(),
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
