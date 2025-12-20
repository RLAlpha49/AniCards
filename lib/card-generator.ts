import { calculateMilestones } from "@/lib/utils/milestones";
import { extractStyles } from "@/lib/utils";
import { extraAnimeMangaStatsTemplate } from "@/lib/svg-templates/extra-anime-manga-stats/shared";
import { mediaStatsTemplate } from "@/lib/svg-templates/media-stats/shared";
import { socialStatsTemplate } from "@/lib/svg-templates/social-stats";
import { socialMilestonesTemplate } from "@/lib/svg-templates/social-community/social-milestones-template";
import { distributionTemplate } from "@/lib/svg-templates/distribution/shared";
import { favoritesGridTemplate } from "@/lib/svg-templates/profile-favorite-stats/favorites-grid-template";
import { favoritesSummaryTemplate } from "@/lib/svg-templates/profile-favorite-stats/favorites-summary-template";
import { profileOverviewTemplate } from "@/lib/svg-templates/profile-favorite-stats/profile-overview-template";
import { activityHeatmapTemplate } from "@/lib/svg-templates/activity-stats/activity-heatmap-template";
import { activityPatternsTemplate } from "@/lib/svg-templates/activity-stats/activity-patterns-template";
import { activityStreaksTemplate } from "@/lib/svg-templates/activity-stats/activity-streaks-template";
import { recentActivityFeedTemplate } from "@/lib/svg-templates/activity-stats/recent-activity-feed-template";
import { recentActivitySummaryTemplate } from "@/lib/svg-templates/activity-stats/recent-activity-summary-template";
import { topActivityDaysTemplate } from "@/lib/svg-templates/activity-stats/top-activity-days-template";
import { milestonesTemplate } from "@/lib/svg-templates/completion-progress-stats/milestones-template";
import { mostRewatchedTemplate } from "@/lib/svg-templates/completion-progress-stats/most-rewatched-template";
import { personalRecordsTemplate } from "@/lib/svg-templates/completion-progress-stats/personal-records-template";
import { planningBacklogTemplate } from "@/lib/svg-templates/completion-progress-stats/planning-backlog-template";
import { currentlyWatchingReadingTemplate } from "@/lib/svg-templates/completion-progress-stats/currently-watching-reading-template";
import { statusCompletionOverviewTemplate } from "@/lib/svg-templates/completion-progress-stats/status-completion-overview-template";
import { animeMangaOverviewTemplate } from "@/lib/svg-templates/comparative-distribution-stats/anime-manga-overview-template";
import { scoreCompareAnimeMangaTemplate } from "@/lib/svg-templates/comparative-distribution-stats/score-compare-anime-manga-template";
import { countryDiversityTemplate } from "@/lib/svg-templates/comparative-distribution-stats/country-diversity-template";
import { genreDiversityTemplate } from "@/lib/svg-templates/comparative-distribution-stats/genre-diversity-template";
import { formatPreferenceOverviewTemplate } from "@/lib/svg-templates/comparative-distribution-stats/format-preference-overview-template";
import { releaseEraPreferenceTemplate } from "@/lib/svg-templates/comparative-distribution-stats/release-era-preference-template";
import { startYearMomentumTemplate } from "@/lib/svg-templates/comparative-distribution-stats/start-year-momentum-template";
import { lengthPreferenceTemplate } from "@/lib/svg-templates/comparative-distribution-stats/length-preference-template";
import { TrustedSVG } from "@/lib/types/svg";
import {
  ActivityHistoryItem,
  StoredCardConfig,
  UserRecord,
  UserStatsData,
  MediaListEntry,
} from "@/lib/types/records";
import {
  toTemplateAnimeStats,
  toTemplateMangaStats,
  toTemplateSocialStats,
  mapCategoryItem,
  displayNames,
  CardDataError,
  GenreItem,
  TagItem,
  VoiceActorItem,
  StudioItem,
  StaffItem,
} from "@/lib/card-data";
import {
  AnimeStats as TemplateAnimeStats,
  MangaStats as TemplateMangaStats,
} from "@/lib/types/card";
import {
  fetchImageAsDataUrl,
  embedFavoritesGridImages,
} from "@/lib/image-utils";

/**
 * Supported visual variants for generated cards.
 * These correspond to layout choices used by the SVG templates.
 * @source
 */
type CardGenVariant =
  | "default"
  | "vertical"
  | "pie"
  | "donut"
  | "compact"
  | "minimal"
  | "communityFootprint"
  | "bar"
  | "horizontal"
  | "cumulative"
  | "anime"
  | "manga"
  | "characters"
  | "mixed"
  | "github"
  | "fire"
  | "combined"
  | "split";

/** @source */
type StatsVariant = "default" | "vertical" | "minimal";
/** @source */
type SocialVariant = "default" | "compact" | "minimal" | "communityFootprint";
/** @source */
type PieBarVariant = "default" | "pie" | "bar" | "donut";
/** @source */
type DistributionVariant = "default" | "horizontal" | "cumulative";
/** @source */
type ProfileVariant = "default";
/** @source */
type StatusCompletionVariant = "combined" | "split";
/** @source */
type MilestonesVariant = "default";
/** @source */
type PersonalRecordsVariant = "default";
/** @source */
type PlanningBacklogVariant = "default";
/** @source */
type MostRewatchedVariant = "default" | "anime" | "manga";
/** @source */
type FavoritesGridVariant = "anime" | "manga" | "characters" | "mixed";
/** @source */
type ComparativeVariant = "default";
/** @source */
type SocialCommunityVariant = "default";
/** @source */
type CurrentlyWatchingReadingVariant = "default" | "anime" | "manga";

/**
 * Parameters provided to the card generation functions.
 * @source
 */
interface CardGenerationParams {
  cardConfig: StoredCardConfig;
  userRecord: UserRecord;
  variant: string;
  favorites?: string[];
  favoritesGridCols?: number;
  favoritesGridRows?: number;
}

/**
 * Normalize a user-supplied variant string into an allowed CardGenVariant for
 * the specified base card type.
 * @param variant - Variant requested by the caller.
 * @param baseCardType - Base card type to narrow allowed variants (e.g., "animeStats").
 * @returns A valid CardGenVariant; falls back to "default" for invalid input.
 * @source
 */
function normalizeVariant(
  variant: string | undefined | null,
  baseCardType?: string,
): CardGenVariant {
  const globalVariants = new Set<CardGenVariant>([
    "default",
    "vertical",
    "pie",
    "donut",
    "compact",
    "minimal",
    "bar",
    "horizontal",
  ]);
  // Default early for invalid variant types
  if (!variant || typeof variant !== "string") return "default";

  // Handle favoritesGrid specially
  if (baseCardType === "favoritesGrid") {
    if (["anime", "manga", "characters", "mixed"].includes(variant)) {
      return variant as CardGenVariant;
    }
    return "mixed" as CardGenVariant;
  }

  // Allowed variant sets for groups of card types
  const statsVariants = new Set<CardGenVariant>([
    "default",
    "vertical",
    "compact",
    "minimal",
  ]);
  const socialVariants = new Set<CardGenVariant>([
    "default",
    "compact",
    "minimal",
    "communityFootprint",
  ]);
  const pieBarVariants = new Set<CardGenVariant>([
    "default",
    "pie",
    "donut",
    "bar",
  ]);
  const statusPieBarVariants = pieBarVariants;
  const scoreDistributionVariants = new Set<CardGenVariant>([
    "default",
    "horizontal",
    "cumulative",
  ]);
  const distributionVariants = new Set<CardGenVariant>([
    "default",
    "horizontal",
  ]);

  const variantMap: Record<string, Set<CardGenVariant>> = {
    animeStats: statsVariants,
    mangaStats: statsVariants,
    socialStats: socialVariants,
    socialMilestones: new Set<CardGenVariant>(["default"]),
    animeGenres: pieBarVariants,
    animeTags: pieBarVariants,
    animeVoiceActors: pieBarVariants,
    animeStudios: pieBarVariants,
    animeStaff: pieBarVariants,
    mangaGenres: pieBarVariants,
    mangaTags: pieBarVariants,
    mangaStaff: pieBarVariants,
    animeStatusDistribution: statusPieBarVariants,
    mangaStatusDistribution: statusPieBarVariants,
    animeFormatDistribution: pieBarVariants,
    mangaFormatDistribution: pieBarVariants,
    animeCountry: pieBarVariants,
    mangaCountry: pieBarVariants,
    animeScoreDistribution: scoreDistributionVariants,
    mangaScoreDistribution: scoreDistributionVariants,
    animeYearDistribution: distributionVariants,
    mangaYearDistribution: distributionVariants,
    profileOverview: socialVariants,
    favoritesSummary: socialVariants,
    activityHeatmap: new Set<CardGenVariant>(["default", "github", "fire"]),
    recentActivitySummary: new Set<CardGenVariant>(["default"]),
    recentActivityFeed: new Set<CardGenVariant>(["default"]),
    activityStreaks: new Set<CardGenVariant>(["default"]),
    activityPatterns: new Set<CardGenVariant>(["default"]),
    topActivityDays: new Set<CardGenVariant>(["default"]),
    statusCompletionOverview: new Set<CardGenVariant>(["combined", "split"]),
    milestones: new Set<CardGenVariant>(["default"]),
    personalRecords: new Set<CardGenVariant>(["default"]),
    planningBacklog: new Set<CardGenVariant>(["default"]),
    mostRewatched: new Set<CardGenVariant>(["default", "anime", "manga"]),
    currentlyWatchingReading: new Set<CardGenVariant>([
      "default",
      "anime",
      "manga",
    ]),
    animeMangaOverview: new Set<CardGenVariant>(["default"]),
    scoreCompareAnimeManga: new Set<CardGenVariant>(["default"]),
    countryDiversity: new Set<CardGenVariant>(["default"]),
    genreDiversity: new Set<CardGenVariant>(["default"]),
    formatPreferenceOverview: new Set<CardGenVariant>(["default"]),
    releaseEraPreference: new Set<CardGenVariant>(["default"]),
    startYearMomentum: new Set<CardGenVariant>(["default"]),
    lengthPreference: new Set<CardGenVariant>(["default"]),
  };

  const allowedVariants = variantMap[baseCardType!];
  if (allowedVariants) {
    return allowedVariants.has(variant as CardGenVariant)
      ? (variant as CardGenVariant)
      : "default";
  }

  if (!globalVariants.has(variant as CardGenVariant)) {
    return "default";
  }

  return globalVariants.has(variant as CardGenVariant)
    ? (variant as CardGenVariant)
    : "default";
}

/**
 * Generate a stats card (anime or manga) for a user.
 * Resolves and formats user statistics, calculates milestones, and renders
 * a media statistics template for the given media type.
 * @param params - Card generation parameters and options.
 * @param mediaType - Either "anime" or "manga" to select the stats root.
 * @returns A TrustedSVG with the rendered stats card.
 * @throws {CardDataError} If the user has no stats for the requested media type.
 * @source
 */
function generateStatsCard(
  params: CardGenerationParams,
  mediaType: "anime" | "manga",
) {
  const { cardConfig, userRecord, variant } = params;
  const recordsStats = userRecord.stats?.User?.statistics?.[mediaType] as
    | UserStatsData["User"]["statistics"]["anime"]
    | UserStatsData["User"]["statistics"]["manga"]
    | undefined;
  if (!recordsStats) {
    throw new CardDataError("Not Found: Missing stats data for user", 404);
  }
  let milestoneCount = 0;
  if (mediaType === "anime") {
    // anime milestones are measured in episodes watched
    milestoneCount = (recordsStats as TemplateAnimeStats).episodesWatched || 0;
  } else {
    // manga milestones are measured in chapters read
    milestoneCount = (recordsStats as TemplateMangaStats).chaptersRead || 0;
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
    variant: variant as StatsVariant,
    styles: extractStyles(cardConfig),
    stats: templateStats,
  });
}

/**
 * Generate a social stats card (followers, activity, etc.) for a user.
 * @param params - Card generation parameters and options.
 * @returns A TrustedSVG with the rendered social stats card.
 * @source
 */
function isRecord(x: unknown): x is Record<string, unknown> {
  return x !== null && typeof x === "object";
}

function extractActivityHistory(statsRoot: unknown): ActivityHistoryItem[] {
  if (!isRecord(statsRoot)) return [];
  const v = statsRoot["activityHistory"];
  return Array.isArray(v) ? (v as ActivityHistoryItem[]) : [];
}

function generateSocialStatsCard(params: CardGenerationParams) {
  const { cardConfig, userRecord, variant } = params;
  return socialStatsTemplate({
    username: userRecord.username ?? userRecord.userId,
    variant: variant as SocialVariant,
    styles: extractStyles(cardConfig),
    stats: toTemplateSocialStats(userRecord),
    activityHistory: extractActivityHistory(userRecord.stats?.User?.stats),
  });
}

/**
 * Generate a social milestones card showing progress towards fixed community tiers.
 * @source
 */
function generateSocialMilestonesCard(
  params: CardGenerationParams,
): TrustedSVG {
  const { cardConfig, userRecord, variant } = params;

  const followers = userRecord.stats?.followersPage?.pageInfo?.total ?? 0;
  const following = userRecord.stats?.followingPage?.pageInfo?.total ?? 0;
  const threads = userRecord.stats?.threadsPage?.pageInfo?.total ?? 0;
  const threadComments =
    userRecord.stats?.threadCommentsPage?.pageInfo?.total ?? 0;
  const reviews = userRecord.stats?.reviewsPage?.pageInfo?.total ?? 0;

  return socialMilestonesTemplate({
    username: userRecord.username ?? userRecord.userId,
    variant: variant as SocialCommunityVariant,
    styles: extractStyles(cardConfig),
    stats: {
      followers,
      following,
      threads,
      threadComments,
      reviews,
    },
  });
}

/**
 * Main entry point for generating any supported card SVG.
 * Determines the base card type, normalizes the variant, and dispatches to
 * the appropriate generator function.
 * @param cardConfig - Stored card configuration used to style card output.
 * @param userRecord - User record object containing profile and stats.
 * @param variant - Requested visual variant string; will be normalized.
 * @param favorites - Optional array of favorite media IDs used in templates.
 * @returns A TrustedSVG containing the generated card.
 * @throws {CardDataError} When required configuration or stats data are missing or the card type is unsupported.
 * @source
 */
export async function generateCardSvg(
  cardConfig: StoredCardConfig,
  userRecord: UserRecord,
  variant: string,
  favorites?: string[],
): Promise<TrustedSVG> {
  if (!cardConfig || !userRecord?.stats) {
    throw new CardDataError(
      "Not Found: Missing card configuration or stats data",
      404,
    );
  }

  const [baseCardType] = cardConfig.cardName.split("-");
  const normalizedVariant = normalizeVariant(String(variant), baseCardType);
  const params: CardGenerationParams = {
    cardConfig,
    userRecord,
    variant: normalizedVariant,
    favorites,
    favoritesGridCols:
      typeof cardConfig.gridCols === "number" ? cardConfig.gridCols : undefined,
    favoritesGridRows:
      typeof cardConfig.gridRows === "number" ? cardConfig.gridRows : undefined,
  };

  const comparativeDispatch: Record<
    string,
    (p: CardGenerationParams) => TrustedSVG
  > = {
    animeMangaOverview: generateAnimeMangaOverviewCard,
    scoreCompareAnimeManga: generateScoreCompareAnimeMangaCard,
    countryDiversity: generateCountryDiversityCard,
    genreDiversity: generateGenreDiversityCard,
    formatPreferenceOverview: generateFormatPreferenceOverviewCard,
    releaseEraPreference: generateReleaseEraPreferenceCard,
    startYearMomentum: generateStartYearMomentumCard,
    lengthPreference: generateLengthPreferenceCard,
  };

  const comparativeGenerator = comparativeDispatch[baseCardType];
  if (comparativeGenerator) {
    return comparativeGenerator(params);
  }

  switch (baseCardType) {
    case "animeStats":
      return generateStatsCard(params, "anime");
    case "mangaStats":
      return generateStatsCard(params, "manga");
    case "socialStats":
      return generateSocialStatsCard(params);
    case "socialMilestones":
      return generateSocialMilestonesCard(params);
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
    case "profileOverview":
      return await generateProfileOverviewCard(params);
    case "favoritesSummary":
      return generateFavoritesSummaryCard(params);
    case "favoritesGrid":
      return generateFavoritesGridCard(params);
    case "activityHeatmap":
      return generateActivityHeatmapCard(params);
    case "recentActivitySummary":
      return generateRecentActivitySummaryCard(params);
    case "recentActivityFeed":
      return generateRecentActivityFeedCard(params);
    case "activityStreaks":
      return generateActivityStreaksCard(params);
    case "activityPatterns":
      return generateActivityPatternsCard(params);
    case "topActivityDays":
      return generateTopActivityDaysCard(params);
    case "statusCompletionOverview":
      return generateStatusCompletionOverviewCard(params);
    case "milestones":
      return generateMilestonesCard(params);
    case "personalRecords":
      return generatePersonalRecordsCard(params);
    case "planningBacklog":
      return generatePlanningBacklogCard(params);
    case "mostRewatched":
      return generateMostRewatchedCard(params);
    case "currentlyWatchingReading":
      return await generateCurrentlyWatchingReadingCard(params);

    default:
      throw new CardDataError("Unsupported card type", 400);
  }
}

/**
 * Generate an Anime vs Manga Overview card.
 * @source
 */
function generateAnimeMangaOverviewCard(
  params: CardGenerationParams,
): TrustedSVG {
  const { cardConfig, userRecord, variant } = params;
  const animeStats = userRecord.stats?.User?.statistics?.anime;
  const mangaStats = userRecord.stats?.User?.statistics?.manga;

  return animeMangaOverviewTemplate({
    username: userRecord.username ?? userRecord.userId,
    variant: variant as ComparativeVariant,
    styles: extractStyles(cardConfig),
    animeStats,
    mangaStats,
  });
}

/**
 * Generate an Anime vs Manga Score Comparison card.
 * @source
 */
function generateScoreCompareAnimeMangaCard(
  params: CardGenerationParams,
): TrustedSVG {
  const { cardConfig, userRecord, variant } = params;
  const animeStats = userRecord.stats?.User?.statistics?.anime;
  const mangaStats = userRecord.stats?.User?.statistics?.manga;

  return scoreCompareAnimeMangaTemplate({
    username: userRecord.username ?? userRecord.userId,
    variant: variant as ComparativeVariant,
    styles: extractStyles(cardConfig),
    animeStats,
    mangaStats,
  });
}

/**
 * Generate a Country Diversity card.
 * @source
 */
function generateCountryDiversityCard(
  params: CardGenerationParams,
): TrustedSVG {
  const { cardConfig, userRecord, variant } = params;
  return countryDiversityTemplate({
    username: userRecord.username ?? userRecord.userId,
    variant: variant as ComparativeVariant,
    styles: extractStyles(cardConfig),
    animeStats: userRecord.stats?.User?.statistics?.anime,
    mangaStats: userRecord.stats?.User?.statistics?.manga,
  });
}

/**
 * Generate a Genre Diversity card.
 * @source
 */
function generateGenreDiversityCard(params: CardGenerationParams): TrustedSVG {
  const { cardConfig, userRecord, variant } = params;
  return genreDiversityTemplate({
    username: userRecord.username ?? userRecord.userId,
    variant: variant as ComparativeVariant,
    styles: extractStyles(cardConfig),
    animeStats: userRecord.stats?.User?.statistics?.anime,
    mangaStats: userRecord.stats?.User?.statistics?.manga,
  });
}

/**
 * Generate a Format Preference Overview card.
 * @source
 */
function generateFormatPreferenceOverviewCard(
  params: CardGenerationParams,
): TrustedSVG {
  const { cardConfig, userRecord, variant } = params;
  return formatPreferenceOverviewTemplate({
    username: userRecord.username ?? userRecord.userId,
    variant: variant as ComparativeVariant,
    styles: extractStyles(cardConfig),
    animeStats: userRecord.stats?.User?.statistics?.anime,
    mangaStats: userRecord.stats?.User?.statistics?.manga,
  });
}

/**
 * Generate a Release Era Preference card.
 * @source
 */
function generateReleaseEraPreferenceCard(
  params: CardGenerationParams,
): TrustedSVG {
  const { cardConfig, userRecord, variant } = params;
  return releaseEraPreferenceTemplate({
    username: userRecord.username ?? userRecord.userId,
    variant: variant as ComparativeVariant,
    styles: extractStyles(cardConfig),
    animeStats: userRecord.stats?.User?.statistics?.anime,
    mangaStats: userRecord.stats?.User?.statistics?.manga,
  });
}

/**
 * Generate a Start-Year Momentum card.
 * @source
 */
function generateStartYearMomentumCard(
  params: CardGenerationParams,
): TrustedSVG {
  const { cardConfig, userRecord, variant } = params;
  return startYearMomentumTemplate({
    username: userRecord.username ?? userRecord.userId,
    variant: variant as ComparativeVariant,
    styles: extractStyles(cardConfig),
    animeStats: userRecord.stats?.User?.statistics?.anime,
    mangaStats: userRecord.stats?.User?.statistics?.manga,
  });
}

/**
 * Generate a Length Preference card.
 * @source
 */
function generateLengthPreferenceCard(
  params: CardGenerationParams,
): TrustedSVG {
  const { cardConfig, userRecord, variant } = params;
  return lengthPreferenceTemplate({
    username: userRecord.username ?? userRecord.userId,
    variant: variant as ComparativeVariant,
    styles: extractStyles(cardConfig),
    animeStats: userRecord.stats?.User?.statistics?.anime,
    mangaStats: userRecord.stats?.User?.statistics?.manga,
  });
}

/**
 * Generate a category card (genres, tags, voice actors, studios, staff).
 * Selects the top items from the user's stats and converts them to the template format.
 * @param params - Card generation parameters and options.
 * @param baseCardType - One of the category base types like 'animeGenres'.
 * @returns A TrustedSVG with the rendered category card.
 * @throws {CardDataError} If no category data is available for the user.
 * @source
 */
function generateCategoryCard(
  params: CardGenerationParams,
  baseCardType: string,
) {
  const { cardConfig, userRecord, variant, favorites } = params;
  const isAnime = baseCardType.startsWith("anime");
  // Map normalized suffix to the stats property name used in the records
  const categoryMap: Record<string, string> = {
    genres: "genres",
    tags: "tags",
    voiceactors: "voiceActors",
    studios: "studios",
    staff: "staff",
  };
  // Normalize baseCardType by removing 'anime'/'manga' prefix and lookup the correct key
  const categoryKey =
    categoryMap[
      baseCardType.replace(isAnime ? "anime" : "manga", "").toLowerCase()
    ];
  const stats = isAnime
    ? userRecord.stats?.User?.statistics?.anime
    : userRecord.stats?.User?.statistics?.manga;
  const categoryData = (
    stats as unknown as Record<string, unknown> | undefined
  )?.[categoryKey] as unknown[] | undefined;
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
    throw new CardDataError(
      "Not Found: No category data available for this user",
      404,
    );
  }

  return extraAnimeMangaStatsTemplate({
    username: userRecord.username ?? userRecord.userId,
    variant: ("pie" === variant || "bar" === variant || "donut" === variant
      ? variant
      : "default") as PieBarVariant,
    styles: extractStyles(cardConfig),
    format: displayNames[baseCardType],
    stats: items,
    showPieChart: variant === "pie",
    favorites,
    showPiePercentages: !!cardConfig.showPiePercentages,
  });
}

/**
 * Generate a status distribution card (e.g., watching, completed counts).
 * This delegates to generateSimpleListCard to produce the chart/template.
 * @param params - Card generation parameters and options.
 * @param baseCardType - Base card type string to select anime/manga root.
 * @returns A TrustedSVG with the rendered distribution card.
 * @source
 */
function generateStatusDistributionCard(
  params: CardGenerationParams,
  baseCardType: string,
) {
  return generateSimpleListCard(
    params,
    baseCardType,
    "statuses",
    "status",
    "No status distribution data for this user",
    {
      // Respect statusColors/useStatusColors for all variations (pie/donut/bar/default).
      fixedStatusColors: !!params.cardConfig.useStatusColors,
    },
  );
}

/**
 * Generate a format distribution card (e.g., TV, Movie, OVA counts).
 * Delegates to generateSimpleListCard for rendering.
 * @param params - Card generation parameters and options.
 * @param baseCardType - Base card type string to select anime/manga root.
 * @returns A TrustedSVG with the rendered distribution card.
 * @source
 */
function generateFormatDistributionCard(
  params: CardGenerationParams,
  baseCardType: string,
) {
  return generateSimpleListCard(
    params,
    baseCardType,
    "formats",
    "format",
    "No format distribution data for this user",
  );
}

/**
 * Generic helper to generate a list-style distribution card for a given list
 * key on the user's stats root (statuses, formats, etc.).
 * @param params - Card generation parameters and options.
 * @param baseCardType - Base card type string to select anime/manga root.
 * @param listKey - Key on the stats root representing the list (e.g., "statuses").
 * @param nameKey - Name property for list entries (e.g., "status").
 * @param notFoundMessage - Error message used if no data is found.
 * @param extraTemplateProps - Additional properties forwarded to the template.
 * @returns A TrustedSVG with the rendered list-style card.
 * @throws {CardDataError} If the list is empty.
 * @source
 */
function generateSimpleListCard(
  params: CardGenerationParams,
  baseCardType: string,
  listKey: string,
  nameKey: string,
  notFoundMessage: string,
  extraTemplateProps?: Record<string, unknown>,
): TrustedSVG {
  const { cardConfig, userRecord, variant } = params;
  const isAnime = baseCardType.startsWith("anime");
  const statsRoot = isAnime
    ? userRecord.stats?.User?.statistics?.anime
    : userRecord.stats?.User?.statistics?.manga;
  const data = (statsRoot as unknown as Record<string, unknown> | undefined)?.[
    listKey
  ] as unknown[] | undefined;
  const statsList = Array.isArray(data)
    ? (data as { [k: string]: unknown }[]).map((entry) => ({
        name: String(entry[nameKey] ?? ""),
        count: (entry.count as number) ?? 0,
      }))
    : [];
  // Ensure the list has data; throw an informative error if not
  if (!statsList.length) {
    throw new CardDataError(`Not Found: ${notFoundMessage}`, 404);
  }
  const mappedVariant = (
    ["pie", "bar", "donut"].includes(variant) ? variant : "default"
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
 * Generate distribution cards (score or year) using the distribution template.
 * @param params - Card generation parameters and options.
 * @param baseCardType - Base card type string used to pick anime/manga root.
 * @param kind - 'score' for score distributions, 'year' for release year distributions.
 * @returns A TrustedSVG containing the distribution chart.
 * @throws {CardDataError} If distribution data is not present for the user.
 * @source
 */
function generateDistributionCard(
  params: CardGenerationParams,
  baseCardType: string,
  kind: "score" | "year",
) {
  const { cardConfig, userRecord, variant } = params;
  const isAnime = baseCardType.startsWith("anime");
  const stats = isAnime
    ? userRecord.stats?.User?.statistics?.anime
    : userRecord.stats?.User?.statistics?.manga;
  // Choose the property on the stats object for score vs release year distributions
  const dataProperty = kind === "score" ? "scores" : "releaseYears";
  const valueProperty = kind === "score" ? "score" : "releaseYear";
  const distributionData = (
    stats as unknown as Record<string, unknown> | undefined
  )?.[dataProperty] as unknown[] | undefined;
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
    throw new CardDataError(
      "Not Found: No distribution data for this user",
      404,
    );
  }
  const isScoreDistributionVariant = (
    v: string,
  ): v is "default" | "horizontal" | "cumulative" =>
    v === "default" || v === "horizontal" || v === "cumulative";
  const isYearDistributionVariant = (
    v: string,
  ): v is "default" | "horizontal" => v === "default" || v === "horizontal";

  let mappedVariant: DistributionVariant = "default";
  if (kind === "score" && isScoreDistributionVariant(variant)) {
    mappedVariant = variant;
  }
  if (kind === "year" && isYearDistributionVariant(variant)) {
    mappedVariant = variant;
  }
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
 * Generate a country distribution card showing counts by country.
 * @param params - Card generation parameters and options.
 * @param baseCardType - Base card type string used to pick anime/manga root.
 * @returns A TrustedSVG with the rendered country distribution.
 * @throws {CardDataError} If no country data is present for the user.
 * @source
 */
function generateCountryCard(
  params: CardGenerationParams,
  baseCardType: string,
) {
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
    throw new CardDataError("Not Found: No country data for this user", 404);
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
 * Generate a Profile Overview card showing user avatar, name, and key stats.
 * @param params - Card generation parameters and options.
 * @returns A TrustedSVG with the rendered profile overview card.
 * @source
 */
async function generateProfileOverviewCard(
  params: CardGenerationParams,
): Promise<TrustedSVG> {
  const { cardConfig, userRecord, variant } = params;
  const user = userRecord.stats?.User;

  if (!user?.statistics) {
    throw new CardDataError("Not Found: Missing user statistics", 404);
  }

  const avatarUrl = user.avatar?.large || user.avatar?.medium;
  const avatarDataUrl = avatarUrl ? await fetchImageAsDataUrl(avatarUrl) : null;

  return profileOverviewTemplate({
    username: userRecord.username ?? userRecord.userId,
    variant: variant as ProfileVariant,
    styles: extractStyles(cardConfig),
    statistics: user.statistics,
    avatar: user.avatar,
    avatarDataUrl: avatarDataUrl ?? undefined,
    createdAt: user.createdAt,
  });
}

/**
 * Generate a Favourites Summary card showing counts of favorites in each category.
 * @param params - Card generation parameters and options.
 * @returns A TrustedSVG with the rendered favourites summary card.
 * @source
 */
function generateFavoritesSummaryCard(
  params: CardGenerationParams,
): TrustedSVG {
  const { cardConfig, userRecord, variant } = params;
  const user = userRecord.stats?.User;

  if (!user?.favourites) {
    throw new CardDataError("Not Found: Missing user favourites data", 404);
  }

  return favoritesSummaryTemplate({
    username: userRecord.username ?? userRecord.userId,
    variant: variant as ProfileVariant,
    styles: extractStyles(cardConfig),
    favourites: user.favourites,
  });
}

/**
 * Generate a Favourites Grid card showing favourite anime/manga/characters as a grid.
 * @param params - Card generation parameters and options.
 * @returns A TrustedSVG with the rendered favourites grid card.
 * @source
 */
async function generateFavoritesGridCard(
  params: CardGenerationParams,
): Promise<TrustedSVG> {
  const { cardConfig, userRecord, variant } = params;
  const user = userRecord.stats?.User;

  if (!user?.favourites) {
    throw new CardDataError("Not Found: Missing user favourites data", 404);
  }

  const embeddedFavourites = await embedFavoritesGridImages(
    user.favourites,
    variant as FavoritesGridVariant,
    params.favoritesGridRows,
    params.favoritesGridCols,
  );

  return favoritesGridTemplate({
    username: userRecord.username ?? userRecord.userId,
    variant: variant as FavoritesGridVariant,
    styles: extractStyles(cardConfig),
    favourites: embeddedFavourites,
    gridCols: params.favoritesGridCols,
    gridRows: params.favoritesGridRows,
  });
}

/** Variant type for activity heatmap cards. @source */
type ActivityHeatmapVariant = "default" | "github" | "fire";

/** Variant type for activity summary/streaks cards. @source */
type ActivityVariant = "default";

/** Variant type for activity feed/patterns cards. @source */
type ActivityCompactVariant = "default";

/**
 * Generate an Activity Heatmap card showing a GitHub-style calendar.
 * @param params - Card generation parameters and options.
 * @returns A TrustedSVG with the rendered activity heatmap card.
 * @source
 */
function generateActivityHeatmapCard(params: CardGenerationParams): TrustedSVG {
  const { cardConfig, userRecord, variant } = params;
  const activityHistory = extractActivityHistory(userRecord.stats?.User?.stats);

  return activityHeatmapTemplate({
    username: userRecord.username ?? userRecord.userId,
    variant: variant as ActivityHeatmapVariant,
    styles: extractStyles(cardConfig),
    activityHistory,
  });
}

/**
 * Generate a Recent Activity Summary card with sparkline.
 * @param params - Card generation parameters and options.
 * @returns A TrustedSVG with the rendered activity summary card.
 * @source
 */
function generateRecentActivitySummaryCard(
  params: CardGenerationParams,
): TrustedSVG {
  const { cardConfig, userRecord, variant } = params;
  const activityHistory = extractActivityHistory(userRecord.stats?.User?.stats);

  return recentActivitySummaryTemplate({
    username: userRecord.username ?? userRecord.userId,
    variant: variant as ActivityVariant,
    styles: extractStyles(cardConfig),
    activityHistory,
  });
}

/**
 * Generate a Recent Activity Feed card showing recent activity entries.
 * @param params - Card generation parameters and options.
 * @returns A TrustedSVG with the rendered activity feed card.
 * @source
 */
function generateRecentActivityFeedCard(
  params: CardGenerationParams,
): TrustedSVG {
  const { cardConfig, userRecord, variant } = params;
  const activityHistory = extractActivityHistory(userRecord.stats?.User?.stats);

  return recentActivityFeedTemplate({
    username: userRecord.username ?? userRecord.userId,
    variant: variant as ActivityCompactVariant,
    styles: extractStyles(cardConfig),
    activityHistory,
  });
}

/**
 * Generate an Activity Streaks card showing current and longest streaks.
 * @param params - Card generation parameters and options.
 * @returns A TrustedSVG with the rendered activity streaks card.
 * @source
 */
function generateActivityStreaksCard(params: CardGenerationParams): TrustedSVG {
  const { cardConfig, userRecord, variant } = params;
  const activityHistory = extractActivityHistory(userRecord.stats?.User?.stats);

  return activityStreaksTemplate({
    username: userRecord.username ?? userRecord.userId,
    variant: variant as ActivityVariant,
    styles: extractStyles(cardConfig),
    activityHistory,
  });
}

/**
 * Generate an Activity Patterns card showing day-of-week distribution.
 * @param params - Card generation parameters and options.
 * @returns A TrustedSVG with the rendered activity patterns card.
 * @source
 */
function generateActivityPatternsCard(
  params: CardGenerationParams,
): TrustedSVG {
  const { cardConfig, userRecord, variant } = params;
  const activityHistory = extractActivityHistory(userRecord.stats?.User?.stats);

  return activityPatternsTemplate({
    username: userRecord.username ?? userRecord.userId,
    variant: variant as ActivityCompactVariant,
    styles: extractStyles(cardConfig),
    activityHistory,
  });
}

/**
 * Generate a Top Activity Days card showing days with the highest activity.
 * @param params - Card generation parameters and options.
 * @returns A TrustedSVG with the rendered top activity days card.
 * @source
 */
function generateTopActivityDaysCard(params: CardGenerationParams): TrustedSVG {
  const { cardConfig, userRecord, variant } = params;
  const activityHistory = extractActivityHistory(userRecord.stats?.User?.stats);

  return topActivityDaysTemplate({
    username: userRecord.username ?? userRecord.userId,
    variant: variant as ActivityCompactVariant,
    styles: extractStyles(cardConfig),
    activityHistory,
  });
}

/**
 * Helper to extract all entries from a MediaListCollection.
 * @param collection - The MediaListCollection object.
 * @returns Flattened array of MediaListEntry items.
 * @source
 */
function extractMediaListEntries(
  collection: { lists: { entries: MediaListEntry[] }[] } | undefined,
): MediaListEntry[] {
  if (!collection?.lists) return [];
  return collection.lists.flatMap((list) => list.entries ?? []);
}

/**
 * Generate a Status Completion Overview card showing cross-media completion.
 * @param params - Card generation parameters and options.
 * @returns A TrustedSVG with the rendered status completion overview card.
 * @source
 */
function generateStatusCompletionOverviewCard(
  params: CardGenerationParams,
): TrustedSVG {
  const { cardConfig, userRecord, variant } = params;
  const animeStats = userRecord.stats?.User?.statistics?.anime;
  const mangaStats = userRecord.stats?.User?.statistics?.manga;

  const animeStatuses = (animeStats?.statuses ?? []).map((s) => ({
    status: s.status,
    count: s.count,
  }));
  const mangaStatuses = (mangaStats?.statuses ?? []).map((s) => ({
    status: s.status,
    count: s.count,
  }));

  return statusCompletionOverviewTemplate({
    username: userRecord.username ?? userRecord.userId,
    variant: variant as StatusCompletionVariant,
    styles: extractStyles(cardConfig),
    animeStatuses,
    mangaStatuses,
  });
}

/**
 * Generate a Milestones card celebrating consumption achievements.
 * @param params - Card generation parameters and options.
 * @returns A TrustedSVG with the rendered milestones card.
 * @source
 */
function generateMilestonesCard(params: CardGenerationParams): TrustedSVG {
  const { cardConfig, userRecord, variant } = params;
  const animeStats = userRecord.stats?.User?.statistics?.anime;
  const mangaStats = userRecord.stats?.User?.statistics?.manga;

  return milestonesTemplate({
    username: userRecord.username ?? userRecord.userId,
    variant: variant as MilestonesVariant,
    styles: extractStyles(cardConfig),
    stats: {
      animeCount: animeStats?.count,
      episodesWatched: animeStats?.episodesWatched,
      minutesWatched: animeStats?.minutesWatched,
      mangaCount: mangaStats?.count,
      chaptersRead: mangaStats?.chaptersRead,
      volumesRead: mangaStats?.volumesRead,
    },
  });
}

/**
 * Generate a Personal Records card showing user's personal bests.
 * @param params - Card generation parameters and options.
 * @returns A TrustedSVG with the rendered personal records card.
 * @source
 */
function generatePersonalRecordsCard(params: CardGenerationParams): TrustedSVG {
  const { cardConfig, userRecord, variant } = params;

  const animeCompleted = extractMediaListEntries(
    userRecord.stats?.animeCompleted,
  );
  const mangaCompleted = extractMediaListEntries(
    userRecord.stats?.mangaCompleted,
  );
  const animeRewatched = extractMediaListEntries(
    userRecord.stats?.animeRewatched,
  );
  const mangaReread = extractMediaListEntries(userRecord.stats?.mangaReread);

  return personalRecordsTemplate({
    username: userRecord.username ?? userRecord.userId,
    variant: variant as PersonalRecordsVariant,
    styles: extractStyles(cardConfig),
    animeCompleted,
    mangaCompleted,
    animeRewatched,
    mangaReread,
  });
}

/**
 * Generate a Planning Backlog card showing planned titles.
 * @param params - Card generation parameters and options.
 * @returns A TrustedSVG with the rendered planning backlog card.
 * @source
 */
function generatePlanningBacklogCard(params: CardGenerationParams): TrustedSVG {
  const { cardConfig, userRecord, variant } = params;

  const animePlanning = extractMediaListEntries(
    userRecord.stats?.animePlanning,
  );
  const mangaPlanning = extractMediaListEntries(
    userRecord.stats?.mangaPlanning,
  );

  return planningBacklogTemplate({
    username: userRecord.username ?? userRecord.userId,
    variant: variant as PlanningBacklogVariant,
    styles: extractStyles(cardConfig),
    animePlanning,
    mangaPlanning,
    animeCount: userRecord.stats?.animePlanning?.count,
    mangaCount: userRecord.stats?.mangaPlanning?.count,
  });
}

/**
 * Generate a Most Rewatched/Reread card showing revisited titles.
 * @param params - Card generation parameters and options.
 * @returns A TrustedSVG with the rendered most rewatched card.
 * @source
 */
function generateMostRewatchedCard(params: CardGenerationParams): TrustedSVG {
  const { cardConfig, userRecord, variant } = params;

  const animeRewatched = extractMediaListEntries(
    userRecord.stats?.animeRewatched,
  );
  const mangaReread = extractMediaListEntries(userRecord.stats?.mangaReread);

  return mostRewatchedTemplate({
    username: userRecord.username ?? userRecord.userId,
    variant: variant as MostRewatchedVariant,
    styles: extractStyles(cardConfig),
    animeRewatched,
    mangaReread,
    totalRewatches: userRecord.stats?.animeRewatched?.totalRepeat,
    totalRereads: userRecord.stats?.mangaReread?.totalRepeat,
  });
}

/**
 * Generate a Currently Watching / Reading card showing current anime and manga.
 * Embeds cover images as data URLs for reliable SVG rendering.
 * @source
 */
async function generateCurrentlyWatchingReadingCard(
  params: CardGenerationParams,
): Promise<TrustedSVG> {
  const { cardConfig, userRecord, variant } = params;

  const typedVariant = variant as CurrentlyWatchingReadingVariant;

  const allAnimeCurrent = extractMediaListEntries(
    userRecord.stats?.animeCurrent,
  );
  const allMangaCurrent = extractMediaListEntries(
    userRecord.stats?.mangaCurrent,
  );

  const animeCurrent = typedVariant === "manga" ? [] : allAnimeCurrent;
  const mangaCurrent = typedVariant === "anime" ? [] : allMangaCurrent;

  const MAX_ROWS = 6;
  const animeLimit = Math.min(3, animeCurrent.length);
  const mangaLimit = Math.min(3, mangaCurrent.length);
  let remaining = MAX_ROWS - (animeLimit + mangaLimit);
  const animeExtra =
    remaining > 0
      ? Math.min(remaining, Math.max(0, animeCurrent.length - animeLimit))
      : 0;
  remaining -= animeExtra;
  const mangaExtra =
    remaining > 0
      ? Math.min(remaining, Math.max(0, mangaCurrent.length - mangaLimit))
      : 0;

  const animeDisplay = animeCurrent.slice(0, animeLimit + animeExtra);
  const mangaDisplay = mangaCurrent.slice(0, mangaLimit + mangaExtra);

  const embedCovers = async (
    entries: MediaListEntry[],
  ): Promise<MediaListEntry[]> => {
    return Promise.all(
      entries.map(async (entry) => {
        const cover = entry.media.coverImage;
        const url = cover?.large || cover?.medium;
        if (!url) return entry;

        const dataUrl = await fetchImageAsDataUrl(url);
        if (!dataUrl) return entry;

        return {
          ...entry,
          media: {
            ...entry.media,
            coverImage: {
              ...cover,
              large: dataUrl,
              medium: dataUrl,
            },
          },
        };
      }),
    );
  };

  const [embeddedAnime, embeddedManga] = await Promise.all([
    embedCovers(animeDisplay),
    embedCovers(mangaDisplay),
  ]);

  return currentlyWatchingReadingTemplate({
    username: userRecord.username ?? userRecord.userId,
    variant: typedVariant,
    styles: extractStyles(cardConfig),
    animeCurrent: embeddedAnime,
    mangaCurrent: embeddedManga,
    animeCount: userRecord.stats?.animeCurrent?.count,
    mangaCount: userRecord.stats?.mangaCurrent?.count,
  });
}

export default generateCardSvg;
