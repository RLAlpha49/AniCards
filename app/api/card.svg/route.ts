import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";
import {
  CardConfig,
  SocialStats,
  AnimeStats as TemplateAnimeStats,
  MangaStats as TemplateMangaStats,
} from "@/lib/types/card";
import { calculateMilestones } from "@/lib/utils/milestones";
import { socialStatsTemplate } from "@/lib/svg-templates/social-stats";
import { extraAnimeMangaStatsTemplate } from "@/lib/svg-templates/extra-anime-manga-stats";
import { distributionTemplate } from "@/lib/svg-templates/distribution";
import { safeParse } from "@/lib/utils";
import { UserRecord, CardsRecord, UserStatsData } from "@/lib/types/records";

import { mediaStatsTemplate } from "@/lib/svg-templates/media-stats";

// Rate limiter setup using Upstash Redis
const redisClient = Redis.fromEnv();
const ratelimit = new Ratelimit({
  redis: redisClient,
  limiter: Ratelimit.slidingWindow(100, "10 s"),
});

// Set of allowed card types for validation
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

// Display names for card types, used in templates
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

// Type definitions for category keys and item types
type GenreItem = { genre: string; count: number };
type TagItem = { tag: { name: string }; count: number };
type VoiceActorItem = { voiceActor: { name: { full: string } }; count: number };
type StudioItem = { studio: { name: string }; count: number };
type StaffItem = { staff: { name: { full: string } }; count: number };

type PieBarVariant = "default" | "pie" | "bar";

// Function to generate SVG error response
function svgError(message: string) {
  return `<?xml version="1.0" encoding="UTF-8"?>
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
      ${message}
    </text>
  </svg>`;
}

// Headers for successful SVG responses (with caching)
function svgHeaders() {
  return {
    "Content-Type": "image/svg+xml",
    "Cache-Control": "public, max-age=86400, stale-while-revalidate=86400", // 24 hour cache, revalidate in background
    "Access-Control-Allow-Origin": "https://anilist.co", // For cross-origin requests from AniList
    "Access-Control-Allow-Methods": "GET",
    Vary: "Origin", // Cache varies based on Origin header
  };
}

// Headers for error SVG responses (no caching)
function errorHeaders() {
  return {
    "Content-Type": "image/svg+xml",
    "Cache-Control": "no-store, max-age=0, must-revalidate", // No cache, force revalidation
    "Access-Control-Allow-Origin": "https://anilist.co", // For cross-origin requests from AniList
    "Access-Control-Allow-Methods": "GET",
    Vary: "Origin", // Header varies based on Origin
  };
}

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

// Adapter helpers: convert stored UserRecord.stats (UserStatsData) into template-friendly shapes
type MilestoneFields = {
  previousMilestone: number;
  currentMilestone: number;
  percentage: number;
  dasharray: string;
  dashoffset: string;
};

function toTemplateAnimeStats(
  stats: UserStatsData["User"]["statistics"]["anime"],
  milestoneData: ReturnType<typeof calculateMilestones>,
): TemplateAnimeStats & MilestoneFields {
  return {
    count: stats.count,
    episodesWatched: stats.episodesWatched,
    minutesWatched: stats.minutesWatched,
    meanScore: stats.meanScore,
    standardDeviation: stats.standardDeviation,
    genres: stats.genres ?? [],
    tags: stats.tags ?? [],
    // Map voiceActors.voiceActor to voice_actors.voice_actor to match template shape
    voice_actors: (stats.voiceActors ?? []).map((va) => ({
      voice_actor: va.voiceActor,
      count: va.count,
    })),
    studios: stats.studios ?? [],
    staff: (stats.staff ?? []).map((s) => ({ staff: s.staff, count: s.count })),
    statuses:
      stats.statuses?.map((s) => ({ status: s.status, amount: s.count })) ??
      undefined,
    formats: stats.formats ?? undefined,
    scores: stats.scores ?? undefined,
    // releaseYears and countries are used for other templates
    releaseYears: stats.releaseYears ?? undefined,
    countries: stats.countries ?? undefined,
    previousMilestone: milestoneData.previousMilestone,
    currentMilestone: milestoneData.currentMilestone,
    percentage: milestoneData.percentage,
    dasharray: milestoneData.dasharray,
    dashoffset: milestoneData.dashoffset,
  } as TemplateAnimeStats & MilestoneFields;
}

function toTemplateMangaStats(
  stats: UserStatsData["User"]["statistics"]["manga"],
  milestoneData: ReturnType<typeof calculateMilestones>,
): TemplateMangaStats & MilestoneFields {
  return {
    count: stats.count,
    chaptersRead: stats.chaptersRead,
    volumesRead: stats.volumesRead,
    meanScore: stats.meanScore,
    standardDeviation: stats.standardDeviation,
    genres: stats.genres ?? [],
    tags: stats.tags ?? [],
    staff: (stats.staff ?? []).map((s) => ({ staff: s.staff, count: s.count })),
    statuses:
      stats.statuses?.map((s) => ({ status: s.status, amount: s.count })) ??
      undefined,
    formats: stats.formats ?? undefined,
    scores: stats.scores ?? undefined,
    releaseYears: stats.releaseYears ?? undefined,
    countries: stats.countries ?? undefined,
    previousMilestone: milestoneData.previousMilestone,
    currentMilestone: milestoneData.currentMilestone,
    percentage: milestoneData.percentage,
    dasharray: milestoneData.dasharray,
    dashoffset: milestoneData.dashoffset,
  } as TemplateMangaStats & MilestoneFields;
}

function toTemplateSocialStats(userRecord: UserRecord): SocialStats {
  return {
    followersPage: userRecord.stats.followersPage,
    followingPage: userRecord.stats.followingPage,
    threadsPage: userRecord.stats.threadsPage,
    threadCommentsPage: userRecord.stats.threadCommentsPage,
    reviewsPage: userRecord.stats.reviewsPage,
    activityHistory: userRecord.stats?.stats?.activityHistory ?? [],
  } as SocialStats;
}

// Common interface for card generation parameters
interface CardGenerationParams {
  cardConfig: CardConfig;
  userRecord: UserRecord;
  variant: string;
  favorites?: string[];
}

// Extract common styles from card config
function extractStyles(cardConfig: CardConfig) {
  return {
    titleColor: cardConfig.titleColor,
    backgroundColor: cardConfig.backgroundColor,
    textColor: cardConfig.textColor,
    circleColor: cardConfig.circleColor,
    borderColor: cardConfig.borderColor,
  };
}

// Handle anime/manga stats cards
function generateStatsCard(
  params: CardGenerationParams,
  mediaType: "anime" | "manga",
): string | Response {
  const { cardConfig, userRecord, variant } = params;
  const recordsStats = userRecord.stats?.User?.statistics?.[mediaType];
  if (!recordsStats) {
    return new Response(svgError("Missing stats data for user"), {
      headers: errorHeaders(),
      status: 200,
    });
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

// Handle social stats card
function generateSocialStatsCard(params: CardGenerationParams): string {
  const { cardConfig, userRecord, variant } = params;

  return socialStatsTemplate({
    username: userRecord.username ?? userRecord.userId,
    variant: variant as "default" | "compact" | "minimal",
    styles: extractStyles(cardConfig),
    stats: toTemplateSocialStats(userRecord),
    activityHistory: userRecord.stats?.stats?.activityHistory as {
      date: number;
      amount: number;
    }[],
  });
}

// Map category items to consistent format
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

// Handle category-based cards (genres, tags, voice actors, studios, staff)
function generateCategoryCard(
  params: CardGenerationParams,
  baseCardType: string,
): string | Response {
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
    return new Response(svgError("No category data available for this user"), {
      headers: errorHeaders(),
      status: 200,
    });
  }

  return extraAnimeMangaStatsTemplate({
    username: userRecord.username ?? userRecord.userId,
    variant: variant as "default" | "pie" | "bar",
    styles: extractStyles(cardConfig),
    format: displayNames[baseCardType],
    stats: items,
    showPieChart: variant === "pie",
    favorites,
    showPiePercentages: (
      cardConfig as CardConfig & { showPiePercentages?: boolean }
    ).showPiePercentages,
  });
}

// Handle status distribution cards
function generateStatusDistributionCard(
  params: CardGenerationParams,
  baseCardType: string,
): string | Response {
  const { cardConfig, userRecord, variant } = params;
  const isAnime = baseCardType.startsWith("anime");
  const statusStats = isAnime
    ? userRecord.stats?.User?.statistics?.anime
    : userRecord.stats?.User?.statistics?.manga;

  const statusesData = (statusStats?.statuses ?? []) as {
    status: string;
    count: number;
  }[];
  const statsList = Array.isArray(statusesData)
    ? statusesData.map((s) => ({ name: s.status, count: s.count ?? 0 }))
    : [];

  if (!statsList.length) {
    return new Response(svgError("No status distribution data for this user"), {
      headers: errorHeaders(),
      status: 200,
    });
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
    fixedStatusColors: !!(
      cardConfig as CardConfig & { useStatusColors?: boolean }
    ).useStatusColors,
    showPiePercentages: (
      cardConfig as CardConfig & { showPiePercentages?: boolean }
    ).showPiePercentages,
  });
}

// Handle format distribution cards
function generateFormatDistributionCard(
  params: CardGenerationParams,
  baseCardType: string,
): string | Response {
  const { cardConfig, userRecord, variant } = params;
  const isAnime = baseCardType.startsWith("anime");
  const fmtStats = isAnime
    ? userRecord.stats?.User?.statistics?.anime
    : userRecord.stats?.User?.statistics?.manga;

  const formatsData = (fmtStats?.formats ?? []) as {
    format: string;
    count: number;
  }[];
  const statsList = Array.isArray(formatsData)
    ? formatsData.map((f) => ({ name: f.format, count: f.count ?? 0 }))
    : [];

  if (!statsList.length) {
    return new Response(svgError("No format distribution data for this user"), {
      headers: errorHeaders(),
      status: 200,
    });
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
    showPiePercentages: (
      cardConfig as CardConfig & { showPiePercentages?: boolean }
    ).showPiePercentages,
  });
}

// Handle score/year distribution cards
function generateDistributionCard(
  params: CardGenerationParams,
  baseCardType: string,
  kind: "score" | "year",
): string | Response {
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
    return new Response(svgError("No distribution data for this user"), {
      headers: errorHeaders(),
      status: 200,
    });
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

// Handle country distribution cards
function generateCountryCard(
  params: CardGenerationParams,
  baseCardType: string,
): string | Response {
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
    return new Response(svgError("No country data for this user"), {
      headers: errorHeaders(),
      status: 200,
    });
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
    showPiePercentages: (
      cardConfig as CardConfig & { showPiePercentages?: boolean }
    ).showPiePercentages,
  });
}

// Function to generate SVG content based on card configuration and user stats
function generateCardSVG(
  cardConfig: CardConfig,
  userRecord: UserRecord,
  variant: "default" | "vertical" | "pie" | "compact" | "minimal" | "bar",
  favorites?: string[],
): string | Response {
  // Basic validation: card config and user stats must be present
  if (!cardConfig || !userRecord?.stats) {
    return new Response(svgError("Missing card configuration or stats data"), {
      headers: errorHeaders(),
      status: 200,
    });
  }

  // Validate that the stored stats contain user statistics
  if (
    !userRecord.stats?.User?.statistics?.anime &&
    !userRecord.stats?.User?.statistics?.manga
  ) {
    return new Response(svgError("Missing card configuration or stats data"), {
      headers: errorHeaders(),
      status: 200,
    });
  }

  const [baseCardType] = cardConfig.cardName.split("-");
  const params: CardGenerationParams = {
    cardConfig,
    userRecord,
    variant,
    favorites,
  };

  // Handle different card types using dedicated functions
  switch (baseCardType) {
    case "animeStats":
      return generateStatsCard(params, "anime");

    case "mangaStats":
      return generateStatsCard(params, "manga");

    case "socialStats":
      return generateSocialStatsCard(params);

    case "animeGenres":
    case "animeTags":
    case "animeVoiceActors":
    case "animeStudios":
    case "animeStaff":
    case "mangaGenres":
    case "mangaTags":
    case "mangaStaff":
      return generateCategoryCard(params, baseCardType);

    case "animeStatusDistribution":
    case "mangaStatusDistribution":
      return generateStatusDistributionCard(params, baseCardType);

    case "animeFormatDistribution":
    case "mangaFormatDistribution":
      return generateFormatDistributionCard(params, baseCardType);

    case "animeScoreDistribution":
    case "mangaScoreDistribution":
      return generateDistributionCard(params, baseCardType, "score");

    case "animeYearDistribution":
    case "mangaYearDistribution":
      return generateDistributionCard(params, baseCardType, "year");

    case "animeCountry":
    case "mangaCountry":
      return generateCountryCard(params, baseCardType);

    default:
      throw new Error("Unsupported card type");
  }
}

// Interface for validated request parameters
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

// Extract and validate request parameters
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
    return new Response(svgError("Missing parameters"), {
      headers: errorHeaders(),
      status: 200,
    });
  }

  // Validate userId format (must be a number)
  const numericUserId = Number.parseInt(userId);
  if (Number.isNaN(numericUserId)) {
    console.warn(`⚠️ [Card SVG] Invalid user ID format: ${userId}`);
    return new Response(svgError("Invalid user ID"), {
      headers: errorHeaders(),
      status: 200,
    });
  }

  // Validate cardType against allowed types
  const [baseCardType] = cardType.split("-");
  if (!ALLOWED_CARD_TYPES.has(baseCardType)) {
    console.warn(`⚠️ [Card SVG] Invalid card type: ${cardType}`);
    return new Response(svgError("Invalid card type"), {
      headers: errorHeaders(),
      status: 200,
    });
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

// Handle analytics tracking for failed requests
async function trackFailedRequest(baseCardType?: string): Promise<void> {
  const analyticsClient = Redis.fromEnv();
  analyticsClient.incr("analytics:card_svg:failed_requests").catch(() => {});
  if (baseCardType) {
    analyticsClient
      .incr(`analytics:card_svg:failed_requests:${baseCardType}`)
      .catch(() => {});
  }
}

// Handle analytics tracking for successful requests
async function trackSuccessfulRequest(baseCardType: string): Promise<void> {
  const analyticsClient = Redis.fromEnv();
  analyticsClient
    .incr("analytics:card_svg:successful_requests")
    .catch(() => {});
  analyticsClient
    .incr(`analytics:card_svg:successful_requests:${baseCardType}`)
    .catch(() => {});
}

// Fetch and validate user data from Redis
async function fetchUserData(
  numericUserId: number,
  baseCardType: string,
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
    await trackFailedRequest(baseCardType);
    return new Response(svgError("User data not found"), {
      headers: errorHeaders(),
      status: 200,
    });
  }

  const cardDoc: CardsRecord = safeParse<CardsRecord>(cardsDataStr);
  const userDoc: UserRecord = safeParse<UserRecord>(userDataStr);

  return { cardDoc, userDoc };
}

// Process card configuration and apply query parameters
function processCardConfig(
  cardDoc: CardsRecord,
  params: ValidatedParams,
  userDoc: UserRecord,
):
  | { cardConfig: CardConfig; effectiveVariation: string; favorites: string[] }
  | Response {
  const { cardType, numericUserId, baseCardType } = params;

  // Find the specific card configuration
  const cardConfig = cardDoc.cards.find(
    (c: CardConfig) => c.cardName === cardType,
  );

  if (!cardConfig) {
    console.warn(
      `⚠️ [Card SVG] Card config for ${cardType} not found for user ${numericUserId}`,
    );
    return new Response(
      svgError("Card config not found. Try to regenerate the card."),
      {
        headers: errorHeaders(),
        status: 200,
      },
    );
  }

  // Determine effective variation
  const effectiveVariation =
    params.variationParam || cardConfig.variation || "default";

  // Process favorites
  let favorites: string[] = [];
  const useFavorites =
    params.showFavoritesParam === null
      ? !!cardConfig.showFavorites
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
    (cardConfig as CardConfig & { useStatusColors?: boolean }).useStatusColors =
      true;
  }

  if (params.piePercentagesParam === "true") {
    (
      cardConfig as CardConfig & { showPiePercentages?: boolean }
    ).showPiePercentages = true;
  }

  return { cardConfig, effectiveVariation, favorites };
}

// Main GET handler for card SVG generation
export async function GET(request: Request) {
  const startTime = Date.now();
  const ip = request.headers.get("x-forwarded-for") || "127.0.0.1";

  // Rate limiter check
  const { success } = await ratelimit.limit(ip);
  if (!success) {
    console.warn(`🚨 [Card SVG] Rate limit exceeded for IP: ${ip}`);
    await trackFailedRequest();
    return new Response(svgError("Too many requests - try again later"), {
      headers: errorHeaders(),
      status: 200,
    });
  }

  console.log(`🚀 [Card SVG] New request from IP: ${ip} - URL: ${request.url}`);

  // Extract and validate parameters
  const paramsResult = extractAndValidateParams(request);
  if (paramsResult instanceof Response) {
    await trackFailedRequest();
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
    );
    if (dataResult instanceof Response) {
      return dataResult;
    }

    const { cardDoc, userDoc } = dataResult;

    // Process card configuration and apply parameters
    const configResult = processCardConfig(cardDoc, params, userDoc);
    if (configResult instanceof Response) {
      await trackFailedRequest(params.baseCardType);
      return configResult;
    }

    const { cardConfig, effectiveVariation, favorites } = configResult;

    console.log(
      `🎨 [Card SVG] Generating ${params.cardType} (${effectiveVariation}) SVG for user ${params.numericUserId}`,
    );

    // Generate SVG content
    const svgContent = generateCardSVG(
      cardConfig,
      userDoc,
      effectiveVariation as "default" | "vertical" | "pie" | "bar",
      favorites,
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

    return new Response(svgContent, {
      headers: svgHeaders(),
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

    await trackFailedRequest(params.baseCardType);

    return new Response(svgError("Server Error"), {
      headers: errorHeaders(),
      status: 200,
    });
  }
}
