import {
  redisClient,
  incrementAnalytics,
  getAllowedCardSvgOrigin,
  createRateLimiter,
  checkRateLimit,
} from "@/lib/api-utils";
import {
  SocialStats,
  AnimeStats as TemplateAnimeStats,
  MangaStats as TemplateMangaStats,
} from "@/lib/types/card";
import { calculateMilestones } from "@/lib/utils/milestones";
import { socialStatsTemplate } from "@/lib/svg-templates/social-stats";
import { extraAnimeMangaStatsTemplate } from "@/lib/svg-templates/extra-anime-manga-stats";
import { distributionTemplate } from "@/lib/svg-templates/distribution";
import {
  safeParse,
  extractStyles,
  escapeForXml,
  getCardBorderRadius,
  markTrustedSvg,
} from "@/lib/utils";
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

import { mediaStatsTemplate } from "@/lib/svg-templates/media-stats";
import { toCleanSvgResponse, type TrustedSVG } from "@/lib/types/svg";

/**
 * Limits card SVG generation to 150 requests per 10 seconds per IP.
 * @source
 */
const ratelimit = createRateLimiter({ limit: 150, window: "10 s" });

/**
 * Allowed base card types that can be requested via the SVG API.
 * @source
 */
const ALLOWED_CARD_TYPES = new Set([
  "animeStats",
  "socialStats",
  "mangaStats",
  "animeGenres",
  "animeTags",
  "animeVoiceActors",
  "animeStudios",
  "animeStaff",
  "mangaGenres",
  "mangaTags",
  "mangaStaff",
  "animeStatusDistribution",
  "mangaStatusDistribution",
  "animeFormatDistribution",
  "mangaFormatDistribution",
  "animeScoreDistribution",
  "mangaScoreDistribution",
  "animeYearDistribution",
  "mangaYearDistribution",
  "animeCountry",
  "mangaCountry",
]);

/**
 * Human-friendly labels used by each card template.
 * @source
 */
const displayNames: { [key: string]: string } = {
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
 * Genre entry as stored in AniCards stats data.
 * @source
 */
type GenreItem = { genre: string; count: number };

/**
 * Tag entry as stored in AniCards stats data.
 * @source
 */
type TagItem = { tag: { name: string }; count: number };

/**
 * Voice actor entry as stored in AniCards stats data.
 * @source
 */
type VoiceActorItem = { voiceActor: { name: { full: string } }; count: number };

/**
 * Studio entry as stored in AniCards stats data.
 * @source
 */
type StudioItem = { studio: { name: string }; count: number };

/**
 * Staff entry as stored in AniCards stats data.
 * @source
 */
type StaffItem = { staff: { name: { full: string } }; count: number };

/**
 * Rendering variants used by pie or bar templates.
 * @source
 */
type PieBarVariant = "default" | "pie" | "bar";

/**
 * Builds an error SVG carrying the provided message.
 * @param message - Text shown inside the error graphic.
 * @returns SVG markup alerting the caller of a failure.
 * @source
 */
function svgError(message: string): TrustedSVG {
  const escaped = escapeForXml(message);
  const svg = `<?xml version="1.0" encoding="UTF-8"?>
  <!DOCTYPE svg PUBLIC "-//W3C//DTD SVG 1.1//EN" "http://www.w3.org/Graphics/SVG/1.1/DTD/svg11.dtd">
  <svg width="800" height="400" viewBox="0 0 800 400" xmlns="http://www.w3.org/2000/svg">
    <style>
      .error-text {
        font-family: monospace;
        font-size: 20px;
        fill: #ff5555;
      }
    </style>
    <rect width="100%" height="100%" fill="#1a1a1a"/>
    <text x="50%" y="50%" class="error-text"
          text-anchor="middle" dominant-baseline="middle">
      ${escaped}
    </text>
  </svg>`;
  return markTrustedSvg(svg);
}

/**
 * Provides headers for cached, successful SVG responses.
 * @returns Response headers used on success.
 * @source
 */
function svgHeaders(request?: Request) {
  const allowedOrigin = getAllowedCardSvgOrigin(request);
  return {
    "Content-Type": "image/svg+xml",
    "Cache-Control": "public, max-age=86400, stale-while-revalidate=86400", // 24 hour cache, revalidate in background
    "Access-Control-Allow-Origin": allowedOrigin,
    "Access-Control-Allow-Methods": "GET",
    Vary: "Origin", // Cache varies based on Origin header
  };
}

/**
 * Supplies headers for error SVG responses to prevent caching.
 * @returns Response headers used on failure.
 * @source
 */
function errorHeaders(request?: Request) {
  const allowedOrigin = getAllowedCardSvgOrigin(request);
  return {
    "Content-Type": "image/svg+xml",
    "Cache-Control": "no-store, max-age=0, must-revalidate", // No cache, force revalidation
    "Access-Control-Allow-Origin": allowedOrigin,
    "Access-Control-Allow-Methods": "GET",
    Vary: "Origin", // Header varies based on Origin
  };
}

/**
 * Extracts favorite names for the supported card types.
 * @param favoritesData - Raw favorites payload from AniList.
 * @param baseCardType - Base card type indicating the favorite category.
 * @returns Array of favorite names or an empty list.
 * @source
 */
function getFavoritesForCardType(
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
 * Metadata used by the SVG templates to describe milestone progress.
 * @source
 */
type MilestoneFields = {
  previousMilestone: number;
  currentMilestone: number;
  percentage: number;
  dasharray: string;
  dashoffset: string;
};

/**
 * Converts AniList stats into template-friendly fields shared by anime and manga cards.
 * @param stats - Raw anime or manga statistics from AniList.
 * @param milestoneData - Calculated milestone progress data.
 * @returns Shared template fields augmented with milestone metadata.
 * @source
 */
function buildCommonTemplateFields(
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
 * Adapts anime metrics into the template shape required by SVGs.
 * @param stats - Raw anime statistics from AniList.
 * @param milestoneData - Milestone metadata for progress visuals.
 * @returns Anime template stats enriched with milestone fields.
 * @source
 */
function toTemplateAnimeStats(
  stats: UserStatsData["User"]["statistics"]["anime"],
  milestoneData: ReturnType<typeof calculateMilestones>,
): TemplateAnimeStats & MilestoneFields {
  const common = buildCommonTemplateFields(stats, milestoneData);
  return {
    ...common,
    episodesWatched: stats.episodesWatched,
    minutesWatched: stats.minutesWatched,
    // Map voiceActors.voiceActor to voice_actors.voice_actor to match template shape
    voice_actors: (stats.voiceActors ?? []).map((va) => ({
      voice_actor: va.voiceActor,
      count: va.count,
    })),
    studios: stats.studios ?? [],
  } as TemplateAnimeStats & MilestoneFields;
}

/**
 * Adapts manga metrics into the template shape required by SVGs.
 * @param stats - Raw manga statistics from AniList.
 * @param milestoneData - Milestone metadata for progress visuals.
 * @returns Manga template stats enriched with milestone fields.
 * @source
 */
function toTemplateMangaStats(
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
 * Converts AniList user records into social stats for the card.
 * @param userRecord - AniList user data containing social attachments.
 * @returns Template-ready social stats for the rendered card.
 * @source
 */
function toTemplateSocialStats(userRecord: UserRecord): SocialStats {
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
 * Parameters shared across every card generation helper.
 * @source
 */
interface CardGenerationParams {
  cardConfig: StoredCardConfig;
  userRecord: UserRecord;
  variant: string;
  favorites?: string[];
}

/**
 * Builds anime or manga stats cards from user data and templates.
 * @param params - Common card configuration and user data.
 * @param mediaType - Indicates whether the stats are anime or manga.
 * @returns Serialized SVG string or cached error response.
 * @source
 */
function generateStatsCard(
  params: CardGenerationParams,
  mediaType: "anime" | "manga",
  request?: Request,
): TrustedSVG | Response {
  const { cardConfig, userRecord, variant } = params;
  const recordsStats = userRecord.stats?.User?.statistics?.[mediaType];
  if (!recordsStats) {
    // Metrics: missing stats data for this card type -> Not Found
    void trackFailedRequest(cardConfig.cardName.split("-")[0], 404);
    return new Response(
      toCleanSvgResponse(svgError("Not Found: Missing stats data for user")),
      {
        headers: errorHeaders(request),
        status: 404,
      },
    );
  }
  let milestoneCount = 0;
  if (mediaType === "anime") {
    milestoneCount =
      (recordsStats as UserStatsData["User"]["statistics"]["anime"])
        .episodesWatched || 0;
  } else {
    milestoneCount =
      (recordsStats as UserStatsData["User"]["statistics"]["manga"])
        .chaptersRead || 0;
  }
  const milestoneData = calculateMilestones(Number(milestoneCount));
  const templateStats =
    mediaType === "anime"
      ? toTemplateAnimeStats(
          recordsStats as UserStatsData["User"]["statistics"]["anime"],
          milestoneData,
        )
      : toTemplateMangaStats(
          recordsStats as UserStatsData["User"]["statistics"]["manga"],
          milestoneData,
        );

  return mediaStatsTemplate({
    mediaType,
    username: userRecord.username ?? userRecord.userId,
    variant: variant as "default" | "vertical" | "compact" | "minimal",
    styles: extractStyles(cardConfig),
    stats: templateStats,
  });
}

/**
 * Renders the social stats card from the provided configuration.
 * @param params - Shared card configuration and AniList user data.
 * @returns Serialized SVG string for the social stats card.
 * @source
 */
function generateSocialStatsCard(
  params: CardGenerationParams,
  request?: Request,
): TrustedSVG {
  const { cardConfig, userRecord, variant } = params;

  return socialStatsTemplate({
    username: userRecord.username ?? userRecord.userId,
    variant: variant as "default" | "compact" | "minimal",
    styles: extractStyles(cardConfig),
    stats: toTemplateSocialStats(userRecord),
    activityHistory: userRecord.stats.User.stats.activityHistory ?? [],
  });
}

/**
 * Normalizes AniList category entries for generic templates.
 * @param item - Raw category data (genre, tag, voice actor, etc.).
 * @param categoryKey - Normalized category identifier used by templates.
 * @returns Object containing name and count for the template.
 * @source
 */
function mapCategoryItem(
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
 * Validates and normalizes complex `UserRecord` structures that are parsed from Redis.
 * The normalization ensures nested arrays and fields used by templates are present
 * in a consistent shape and typed values are coerced safely. This avoids runtime
 * errors in templates when the stored data is partially missing or malformed.
 *
 * Returns a tuple of [normalizedUserRecord, undefined] on success, or [undefined, errorMessage]
 * on validation failure. The caller is expected to convert the error message into an
 * SVG error response using `svgError`.
 */
function validateAndNormalizeUserRecord(
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

  // Normalize Activity History
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

  // Page normalizer helper
  interface NormalizedPage {
    pageInfo: { total: number };
    [k: string]: unknown;
  }
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

  // Helper to normalize a numeric field
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

  const isObject = (v: unknown): v is Record<string, unknown> =>
    !!v && typeof v === "object";

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

  // Normalize a single stat block (anime or manga)
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

    // Numeric fields common to both anime and manga stats
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

  // Normalize top-level pages and statistics blocks
  // Prepare favorites node lists for mapping
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

  // Ensure the normalized statistics are objects if they were originally missing so the rest of the flow
  // can access them and produce Not Found responses later if expected content is absent.
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
 * Renders category-based cards such as genres or staff using template data.
 * @param params - Shared card configuration and user data.
 * @param baseCardType - Specific card type determining the dataset.
 * @returns Generated SVG string or a Response signaling missing data.
 * @source
 */
function generateCategoryCard(
  params: CardGenerationParams,
  baseCardType: string,
  request?: Request,
): TrustedSVG | Response {
  const { cardConfig, userRecord, variant, favorites } = params;
  const isAnime = baseCardType.startsWith("anime");

  const categoryMap: Record<string, string> = {
    genres: "genres",
    tags: "tags",
    voiceactors: "voiceActors",
    studios: "studios",
    staff: "staff",
  };

  const categoryKey =
    categoryMap[
      baseCardType.replace(isAnime ? "anime" : "manga", "").toLowerCase()
    ];
  const stats = isAnime
    ? userRecord.stats?.User?.statistics?.anime
    : userRecord.stats?.User?.statistics?.manga;

  const categoryData = ((stats ?? {}) as unknown as Record<string, unknown>)[
    categoryKey
  ] as unknown[] | undefined;
  const items = Array.isArray(categoryData)
    ? categoryData
        .slice(0, 5)
        .map((item: unknown) =>
          mapCategoryItem(
            item as
              | GenreItem
              | TagItem
              | VoiceActorItem
              | StudioItem
              | StaffItem,
            categoryKey,
          ),
        )
    : [];

  if (!items || items.length === 0) {
    // Metrics: no category items found for this user -> Not Found
    void trackFailedRequest(baseCardType, 404);
    return new Response(
      toCleanSvgResponse(
        svgError("Not Found: No category data available for this user"),
      ),
      {
        headers: errorHeaders(request),
        status: 404,
      },
    );
  }

  return extraAnimeMangaStatsTemplate({
    username: userRecord.username ?? userRecord.userId,
    variant: variant as "default" | "pie" | "bar",
    styles: extractStyles(cardConfig),
    format: displayNames[baseCardType],
    stats: items,
    showPieChart: variant === "pie",
    favorites,
    showPiePercentages: !!cardConfig.showPiePercentages,
  });
}

/**
 * Delegates status distribution card creation to the simple list helper.
 * @param params - Shared card configuration and user data.
 * @param baseCardType - Base card type for the distribution.
 * @returns SVG string or Response when no status data exists.
 * @source
 */
function generateStatusDistributionCard(
  params: CardGenerationParams,
  baseCardType: string,
  request?: Request,
): string | Response {
  return generateSimpleListCard(
    params,
    baseCardType,
    "statuses",
    "status",
    "No status distribution data for this user",
    { fixedStatusColors: !!params.cardConfig.useStatusColors },
    request,
  );
}

/**
 * Delegates format distribution card creation to the simple list helper.
 * @param params - Shared card configuration and user data.
 * @param baseCardType - Base card type for the distribution.
 * @returns SVG string or Response when no format data exists.
 * @source
 */
function generateFormatDistributionCard(
  params: CardGenerationParams,
  baseCardType: string,
  request?: Request,
): string | Response {
  return generateSimpleListCard(
    params,
    baseCardType,
    "formats",
    "format",
    "No format distribution data for this user",
    undefined,
    request,
  );
}

/**
 * Builds generic list cards backed by pie/bar templates.
 * @param params - Shared configuration including user stats and styles.
 * @param baseCardType - Base card type used for formatting and analytics.
 * @param listKey - Stats property name (formats or statuses) to read.
 * @param nameKey - Property name that holds the item label.
 * @param notFoundMessage - Error message when no data exists.
 * @param extraTemplateProps - Optional template overrides for rendering.
 * @returns SVG string or Response when the list is empty.
 * @source
 */
function generateSimpleListCard(
  params: CardGenerationParams,
  baseCardType: string,
  listKey: string,
  nameKey: string,
  notFoundMessage: string,
  extraTemplateProps?: Record<string, unknown>,
  request?: Request,
): TrustedSVG | Response {
  const { cardConfig, userRecord, variant } = params;
  const isAnime = baseCardType.startsWith("anime");
  const statsRoot = isAnime
    ? userRecord.stats?.User?.statistics?.anime
    : userRecord.stats?.User?.statistics?.manga;

  const data = ((statsRoot ?? {}) as unknown as Record<string, unknown>)[
    listKey
  ] as unknown[] | undefined;
  const statsList = Array.isArray(data)
    ? (data as { [k: string]: unknown }[]).map((entry) => ({
        name: String(entry[nameKey] ?? ""),
        count: (entry.count as number) ?? 0,
      }))
    : [];

  if (!statsList.length) {
    void trackFailedRequest(baseCardType, 404);
    return new Response(
      toCleanSvgResponse(svgError(`Not Found: ${notFoundMessage}`)),
      {
        headers: errorHeaders(request),
        status: 404,
      },
    );
  }

  const mappedVariant = (
    ["pie", "bar"].includes(variant) ? variant : "default"
  ) as PieBarVariant;

  return extraAnimeMangaStatsTemplate({
    username: userRecord.username ?? userRecord.userId,
    variant: mappedVariant,
    styles: extractStyles(cardConfig),
    format: displayNames[baseCardType],
    stats: statsList,
    showPieChart: mappedVariant === "pie",
    showPiePercentages: !!cardConfig.showPiePercentages,
    ...extraTemplateProps,
  });
}

/**
 * Builds score or year distribution cards using the distribution template.
 * @param params - Shared configuration including stats and styles.
 * @param baseCardType - Base card type to determine anime vs manga data.
 * @param kind - Indicates whether the distribution is by score or year.
 * @returns SVG string or Response when no distribution data exists.
 * @source
 */
function generateDistributionCard(
  params: CardGenerationParams,
  baseCardType: string,
  kind: "score" | "year",
  request?: Request,
): TrustedSVG | Response {
  const { cardConfig, userRecord, variant } = params;
  const isAnime = baseCardType.startsWith("anime");
  const stats = isAnime
    ? userRecord.stats?.User?.statistics?.anime
    : userRecord.stats?.User?.statistics?.manga;

  const dataProperty = kind === "score" ? "scores" : "releaseYears";
  const valueProperty = kind === "score" ? "score" : "releaseYear";

  const distributionData = (
    (stats ?? {}) as unknown as Record<string, unknown>
  )[dataProperty] as unknown[] | undefined;
  const statsList = Array.isArray(distributionData)
    ? distributionData.map((s: unknown) => {
        const item = s as { [k: string]: unknown };
        return {
          name: String(item[valueProperty] ?? ""),
          count: (item.count as number) ?? 0,
        };
      })
    : [];

  if (!statsList.length) {
    // Metrics: no distribution data -> Not Found
    void trackFailedRequest(baseCardType, 404);
    return new Response(
      toCleanSvgResponse(
        svgError("Not Found: No distribution data for this user"),
      ),
      {
        headers: errorHeaders(request),
        status: 404,
      },
    );
  }

  const mappedVariant = (
    ["default", "horizontal"].includes(variant) ? variant : "default"
  ) as "default" | "horizontal";

  return distributionTemplate({
    username: userRecord.username ?? userRecord.userId,
    mediaType: isAnime ? "anime" : "manga",
    variant: mappedVariant,
    kind,
    styles: extractStyles(cardConfig),
    data: statsList.map((s: { name: string; count: number }) => ({
      value: Number(s.name),
      count: s.count,
    })),
  });
}

/**
 * Renders country distribution cards for anime or manga stats.
 * @param params - Shared configuration including stats and styles.
 * @param baseCardType - Base card type to determine anime vs manga sets.
 * @returns SVG string or Response when no country data exists.
 * @source
 */
function generateCountryCard(
  params: CardGenerationParams,
  baseCardType: string,
  request?: Request,
): TrustedSVG | Response {
  const { cardConfig, userRecord, variant } = params;
  const isAnime = baseCardType.startsWith("anime");
  const statsRoot = isAnime
    ? userRecord.stats?.User?.statistics?.anime
    : userRecord.stats?.User?.statistics?.manga;

  const countriesData = (statsRoot?.countries ?? []) as {
    country: string;
    count: number;
  }[];
  const list = Array.isArray(countriesData)
    ? countriesData.map((c) => ({
        name: c.country || "Unknown",
        count: c.count ?? 0,
      }))
    : [];

  if (!list.length) {
    // Metrics: no country data -> Not Found
    void trackFailedRequest(baseCardType, 404);
    return new Response(
      toCleanSvgResponse(svgError("Not Found: No country data for this user")),
      {
        headers: errorHeaders(request),
        status: 404,
      },
    );
  }

  const mappedVariant = (
    ["pie", "bar"].includes(variant) ? variant : "default"
  ) as PieBarVariant;

  return extraAnimeMangaStatsTemplate({
    username: userRecord.username ?? userRecord.userId,
    variant: mappedVariant,
    styles: extractStyles(cardConfig),
    format: displayNames[baseCardType],
    stats: list,
    showPieChart: mappedVariant === "pie",
    showPiePercentages: !!cardConfig.showPiePercentages,
  });
}

/**
 * Routes card configuration and stats to the correct SVG template.
 * @param cardConfig - Stored card configuration document.
 * @param userRecord - AniList user record containing statistics.
 * @param variant - Rendering variant overriding the stored configuration.
 * @param favorites - Optional favorites list used by category cards.
 * @returns Serialized SVG markup or a Response on validation failures.
 * @source
 */
function generateCardSVG(
  cardConfig: StoredCardConfig,
  userRecord: UserRecord,
  variant: "default" | "vertical" | "pie" | "compact" | "minimal" | "bar",
  favorites?: string[],
  request?: Request,
): TrustedSVG | Response {
  // Basic validation: card config and user stats must be present
  if (!cardConfig || !userRecord?.stats) {
    const baseCardType = cardConfig
      ? cardConfig.cardName.split("-")[0]
      : undefined;
    void trackFailedRequest(baseCardType, 404);
    return new Response(
      toCleanSvgResponse(
        svgError("Not Found: Missing card configuration or stats data"),
      ),
      {
        headers: errorHeaders(request),
        status: 404,
      },
    );
  }

  // Validate that the stored stats contain user statistics
  if (
    !userRecord.stats?.User?.statistics?.anime &&
    !userRecord.stats?.User?.statistics?.manga
  ) {
    // Base card type is available because cardConfig is present
    void trackFailedRequest(cardConfig.cardName.split("-")[0], 404);
    return new Response(
      toCleanSvgResponse(
        svgError("Not Found: Missing card configuration or stats data"),
      ),
      {
        headers: errorHeaders(request),
        status: 404,
      },
    );
  }

  const [baseCardType] = cardConfig.cardName.split("-");
  const params: CardGenerationParams = {
    cardConfig,
    userRecord,
    variant,
    favorites,
  };

  const validationResult = validateAndNormalizeUserRecord(userRecord);
  if ("error" in validationResult) {
    void trackFailedRequest(baseCardType, validationResult.status ?? 500);
    return new Response(
      toCleanSvgResponse(svgError(`Server Error: ${validationResult.error}`)),
      {
        headers: errorHeaders(request),
        status: validationResult.status ?? 500,
      },
    );
  }
  userRecord = validationResult.normalized;
  params.userRecord = userRecord;

  // Handle different card types using dedicated functions
  switch (baseCardType) {
    case "animeStats":
      return generateStatsCard(params, "anime", request);

    case "mangaStats":
      return generateStatsCard(params, "manga", request);

    case "socialStats":
      return generateSocialStatsCard(params, request);

    case "animeGenres":
    case "animeTags":
    case "animeVoiceActors":
    case "animeStudios":
    case "animeStaff":
    case "mangaGenres":
    case "mangaTags":
    case "mangaStaff":
      return generateCategoryCard(params, baseCardType, request);

    case "animeStatusDistribution":
    case "mangaStatusDistribution":
      return generateStatusDistributionCard(params, baseCardType, request);

    case "animeFormatDistribution":
    case "mangaFormatDistribution":
      return generateFormatDistributionCard(params, baseCardType, request);

    case "animeScoreDistribution":
    case "mangaScoreDistribution":
      return generateDistributionCard(params, baseCardType, "score", request);

    case "animeYearDistribution":
    case "mangaYearDistribution":
      return generateDistributionCard(params, baseCardType, "year", request);

    case "animeCountry":
    case "mangaCountry":
      return generateCountryCard(params, baseCardType, request);

    default:
      throw new Error("Unsupported card type");
  }
}

/**
 * Parameters extracted and validated from the incoming request.
 * @source
 */
interface ValidatedParams {
  userId: string;
  cardType: string;
  numericUserId: number;
  baseCardType: string;
  variationParam: string | null;
  showFavoritesParam: string | null;
  statusColorsParam: string | null;
  piePercentagesParam: string | null;
}

/**
 * Parses query parameters, validates them, and returns typed data.
 * @param request - Incoming HTTP request to the card SVG route.
 * @returns Validated parameters or an error Response for invalid inputs.
 * @source
 */
function extractAndValidateParams(
  request: Request,
): ValidatedParams | Response {
  const { searchParams } = new URL(request.url);
  const userId = searchParams.get("userId");
  const cardType = searchParams.get("cardType");

  // Parameter validation: userId and cardType are required
  if (!userId || !cardType) {
    const missingParam = userId ? "cardType" : "userId";
    console.warn(`⚠️ [Card SVG] Missing parameter: ${missingParam}`);
    return new Response(
      toCleanSvgResponse(
        svgError(`Client Error: Missing parameter: ${missingParam}`),
      ),
      {
        headers: errorHeaders(request),
        status: 400,
      },
    );
  }

  // Validate userId format (must be a number)
  const numericUserId = Number.parseInt(userId);
  if (Number.isNaN(numericUserId)) {
    console.warn(`⚠️ [Card SVG] Invalid user ID format: ${userId}`);
    return new Response(
      toCleanSvgResponse(svgError("Client Error: Invalid user ID")),
      {
        headers: errorHeaders(request),
        status: 400,
      },
    );
  }

  // Validate cardType against allowed types
  const [baseCardType] = cardType.split("-");
  if (!ALLOWED_CARD_TYPES.has(baseCardType)) {
    console.warn(`⚠️ [Card SVG] Invalid card type: ${cardType}`);
    return new Response(
      toCleanSvgResponse(svgError("Client Error: Invalid card type")),
      {
        headers: errorHeaders(request),
        status: 400,
      },
    );
  }

  return {
    userId,
    cardType,
    numericUserId,
    baseCardType,
    variationParam: searchParams.get("variation"),
    showFavoritesParam: searchParams.get("showFavorites"),
    statusColorsParam: searchParams.get("statusColors"),
    piePercentagesParam: searchParams.get("piePercentages"),
  };
}

/**
 * Sends analytics events for failed SVG requests.
 * @param baseCardType - Optional base card type for scoped metrics.
 * @param status - Optional HTTP status code associated with the failure.
 * @returns Promise that resolves once analytics increments are attempted.
 * @source
 */
async function trackFailedRequest(
  baseCardType?: string,
  status?: number,
): Promise<void> {
  incrementAnalytics("analytics:card_svg:failed_requests").catch(() => {});
  if (baseCardType) {
    incrementAnalytics(
      `analytics:card_svg:failed_requests:${baseCardType}`,
    ).catch(() => {});
  }
  if (typeof status === "number") {
    incrementAnalytics(
      `analytics:card_svg:failed_requests:status:${status}`,
    ).catch(() => {});
    if (baseCardType) {
      incrementAnalytics(
        `analytics:card_svg:failed_requests:${baseCardType}:status:${status}`,
      ).catch(() => {});
    }
  }
}

/**
 * Sends analytics events for successful SVG requests.
 * @param baseCardType - Base card type tied to the successful request.
 * @returns Promise that resolves once analytics increments are attempted.
 * @source
 */
async function trackSuccessfulRequest(baseCardType: string): Promise<void> {
  incrementAnalytics("analytics:card_svg:successful_requests").catch(() => {});
  incrementAnalytics(
    `analytics:card_svg:successful_requests:${baseCardType}`,
  ).catch(() => {});
}

/**
 * Loads card and user documents from Redis for the given user.
 * @param numericUserId - Numeric AniList user ID used as the Redis key suffix.
 * @param baseCardType - Base card type used for analytics on failures.
 * @returns Stored card and user documents or an error Response.
 * @source
 */
async function fetchUserData(
  numericUserId: number,
  baseCardType: string,
  request?: Request,
): Promise<{ cardDoc: CardsRecord; userDoc: UserRecord } | Response> {
  console.log(`🔍 [Card SVG] Fetching data for user ${numericUserId}`);

  const [cardsDataStr, userDataStr] = await Promise.all([
    redisClient.get(`cards:${numericUserId}`),
    redisClient.get(`user:${numericUserId}`),
  ]);

  // Check if Redis returned valid data
  if (
    !cardsDataStr ||
    cardsDataStr === "null" ||
    !userDataStr ||
    userDataStr === "null"
  ) {
    console.warn(`⚠️ [Card SVG] User ${numericUserId} data not found in Redis`);
    await trackFailedRequest(baseCardType, 404);
    return new Response(
      toCleanSvgResponse(svgError("Not Found: User data not found")),
      {
        headers: errorHeaders(request),
        status: 404,
      },
    );
  }

  let cardDoc: CardsRecord;
  let userDoc: UserRecord;
  try {
    cardDoc = safeParse<CardsRecord>(
      cardsDataStr,
      `Card SVG: cards:${numericUserId}`,
    );
  } catch (error) {
    console.warn(
      `⚠️ [Card SVG] Failed to parse stored card record for user ${numericUserId}: ${
        error instanceof Error ? error.message : String(error)
      }`,
    );
    // Distinct metric for corrupt card records
    incrementAnalytics("analytics:card_svg:corrupted_card_records").catch(
      () => {},
    );
    await trackFailedRequest(baseCardType, 500);
    return new Response(
      toCleanSvgResponse(
        svgError("Server Error: Corrupted card configuration"),
      ),
      { headers: errorHeaders(request), status: 500 },
    );
  }

  try {
    userDoc = safeParse<UserRecord>(
      userDataStr,
      `Card SVG: user:${numericUserId}`,
    );
  } catch (error) {
    console.warn(
      `⚠️ [Card SVG] Failed to parse user record for user ${numericUserId}: ${
        error instanceof Error ? error.message : String(error)
      }`,
    );
    // Distinct metric for corrupt user records
    incrementAnalytics("analytics:card_svg:corrupted_user_records").catch(
      () => {},
    );
    await trackFailedRequest(baseCardType, 500);
    return new Response(
      toCleanSvgResponse(svgError("Server Error: Corrupted user record")),
      { headers: errorHeaders(request), status: 500 },
    );
  }

  return { cardDoc, userDoc };
}

/**
 * Applies query parameters and favorites info to the stored card configuration.
 * @param cardDoc - Stored cards document retrieved from Redis.
 * @param params - Validated request parameters.
 * @param userDoc - AniList user document containing favorites/stats.
 * @returns Modified card config with resolved variation/favorites or a Response.
 * @source
 */
function processCardConfig(
  cardDoc: CardsRecord,
  params: ValidatedParams,
  userDoc: UserRecord,
  request?: Request,
):
  | {
      cardConfig: StoredCardConfig;
      effectiveVariation: string;
      favorites: string[];
    }
  | Response {
  const { cardType, numericUserId, baseCardType } = params;

  // Find the specific card configuration
  const cardConfig = cardDoc.cards.find(
    (c: StoredCardConfig) => c.cardName === cardType,
  );

  if (!cardConfig) {
    console.warn(
      `⚠️ [Card SVG] Card config for ${cardType} not found for user ${numericUserId}`,
    );
    return new Response(
      toCleanSvgResponse(
        svgError(
          "Not Found: Card config not found. Try to regenerate the card.",
        ),
      ),
      {
        headers: errorHeaders(request),
        status: 404,
      },
    );
  }

  // Determine effective variation
  // Use a shallow clone to avoid mutating the original object returned from Redis
  const effectiveCardConfig: StoredCardConfig = {
    ...cardConfig,
  } as StoredCardConfig;
  const effectiveVariation =
    params.variationParam || effectiveCardConfig.variation || "default";

  // Process favorites
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
    const favoritesData = userDoc?.stats?.User?.favourites ?? {};
    favorites = getFavoritesForCardType(favoritesData, baseCardType);
  }

  // Apply query parameter modifications to card config
  if (
    params.statusColorsParam === "true" &&
    ["animeStatusDistribution", "mangaStatusDistribution"].includes(
      baseCardType,
    )
  ) {
    effectiveCardConfig.useStatusColors = true;
  }

  if (params.piePercentagesParam === "true") {
    effectiveCardConfig.showPiePercentages = true;
  }

  return { cardConfig: effectiveCardConfig, effectiveVariation, favorites };
}

/**
 * GET handler that orchestrates parameter validation, data loading, and SVG rendering.
 * @param request - Incoming HTTP request for the card SVG endpoint.
 * @returns SVG response or error Response when validation or rendering fails.
 * @source
 */
export async function GET(request: Request) {
  /**
   * GET /api/card.svg handler
   *
   * Message contract and HTTP status codes:
   *  - 400: Client Error (invalid request parameters)
   *    - Message prefix: "Client Error: "
   *    - Examples: missing or invalid query parameters
   *  - 404: Not Found (requested user/card data not present)
   *    - Message prefix: "Not Found: "
   *    - Examples: missing Redis records, missing card configuration, or absent user statistics
   *  - 429: Client Error (rate-limited)
   *    - Message prefix: "Client Error: "
   *    - Example: too many requests
   *  - 500: Server Error (internal failure)
   *    - Message prefix: "Server Error"
   *    - Example: Redis connectivity or unhandled exceptions
   *
   * The API always responds with an SVG body; error responses are non-cacheable and include
   * a human-readable message embedded in the SVG so consumers can surface it.
   */
  const startTime = Date.now();
  const ip = request.headers.get("x-forwarded-for") || "127.0.0.1";

  // Rate limiter check
  const rateLimitResponse = await checkRateLimit(ip, "Card SVG", ratelimit);
  if (rateLimitResponse) {
    return new Response(
      toCleanSvgResponse(
        svgError("Client Error: Too many requests - try again later"),
      ),
      {
        headers: errorHeaders(request),
        status: 429,
      },
    );
  }

  console.log(`🚀 [Card SVG] New request from IP: ${ip} - URL: ${request.url}`);

  // Extract and validate parameters
  const paramsResult = extractAndValidateParams(request);
  if (paramsResult instanceof Response) {
    // Track failed request with the returned status code from parameter validation
    await trackFailedRequest(undefined, paramsResult.status);
    return paramsResult;
  }

  const params = paramsResult;
  console.log(
    `🖼️ [Card SVG] Request for ${params.cardType} card - User ID: ${params.userId}`,
  );

  try {
    // Fetch user data from Redis
    const dataResult = await fetchUserData(
      params.numericUserId,
      params.baseCardType,
      request,
    );
    if (dataResult instanceof Response) {
      return dataResult;
    }

    const { cardDoc, userDoc } = dataResult;

    // Process card configuration and apply parameters
    const configResult = processCardConfig(cardDoc, params, userDoc, request);
    if (configResult instanceof Response) {
      await trackFailedRequest(params.baseCardType, configResult.status);
      return configResult;
    }

    const { cardConfig, effectiveVariation, favorites } = configResult;

    console.log(
      `🎨 [Card SVG] Generating ${params.cardType} (${effectiveVariation}) SVG for user ${params.numericUserId}`,
    );

    // Generate SVG content (TrustedSVG or a Response on error)
    const svgContent: TrustedSVG | Response = generateCardSVG(
      cardConfig,
      userDoc,
      effectiveVariation as "default" | "vertical" | "pie" | "bar",
      favorites,
      request,
    );

    const duration = Date.now() - startTime;
    if (duration > 1500) {
      console.warn(
        `⏳ [Card SVG] Slow rendering detected: ${duration}ms for user ${params.numericUserId}`,
      );
    }

    console.log(
      `✅ [Card SVG] Rendered ${params.cardType} card for ${params.numericUserId} in ${duration}ms`,
    );

    await trackSuccessfulRequest(params.baseCardType);

    if (svgContent instanceof Response) {
      return svgContent;
    }

    const cleaned = toCleanSvgResponse(svgContent);

    // Include header for border radius so clients can read via HEAD requests
    const headerRadius = getCardBorderRadius(cardConfig.borderRadius);
    const responseHeaders = {
      ...svgHeaders(request),
      "X-Card-Border-Radius": String(headerRadius),
    } as Record<string, string>;

    return new Response(cleaned, {
      headers: responseHeaders,
    });
  } catch (error: unknown) {
    const duration = Date.now() - startTime;

    console.error(
      `🔥 [Card SVG] Error generating card for user ${params.numericUserId} after ${duration}ms:`,
      error,
    );

    if (error instanceof Error && error.stack) {
      console.error(`💥 [Card SVG] Stack Trace: ${error.stack}`);
    }

    await trackFailedRequest(params.baseCardType, 500);

    return new Response(
      toCleanSvgResponse(svgError("Server Error: An internal error occurred")),
      {
        headers: errorHeaders(request),
        status: 500,
      },
    );
  }
}
