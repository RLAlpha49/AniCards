/**
 * Main SVG card dispatcher for AniCards.
 *
 * This file bridges normalized user records and the many template modules by
 * mapping card ids plus variants to the right data adapter and SVG renderer.
 * Keeping that orchestration here lets route handlers stay unaware of
 * template-specific requirements.
 */
import {
  CardDataError,
  displayNames,
  GenreItem,
  mapCategoryItem,
  StaffItem,
  StudioItem,
  TagItem,
  toTemplateAnimeEpisodeLengthPreferences,
  toTemplateAnimeGenreSynergy,
  toTemplateAnimeSeasonalPreference,
  toTemplateAnimeSourceMaterialDistribution,
  toTemplateAnimeStats,
  toTemplateMangaStats,
  toTemplateSocialStats,
  toTemplateStudioCollaboration,
  VoiceActorItem,
} from "@/lib/card-data";
import { getCardVariations, getDefaultCardVariation } from "@/lib/card-types";
import {
  embedFavoritesGridImages,
  embedMediaListCoverImages,
  fetchImageAsDataUrl,
} from "@/lib/image-utils";
import { initializeServerPretext } from "@/lib/pretext/server";
import { generateStaticRenderStyles } from "@/lib/svg-templates/common/style-generators";
import {
  AnimeStats as TemplateAnimeStats,
  MangaStats as TemplateMangaStats,
} from "@/lib/types/card";
import {
  ActivityHistoryItem,
  MediaListEntry,
  StoredCardConfig,
  UserRecord,
  UserStatsData,
} from "@/lib/types/records";
import { toCleanSvgResponse, TrustedSVG } from "@/lib/types/svg";
import { extractStyles, markTrustedSvg } from "@/lib/utils";
import { calculateMilestones } from "@/lib/utils/milestones";

const STATIC_RENDER_MODE_MARKER = 'data-anicards-render-mode="static"';

interface CardRenderOptions {
  animationsEnabled?: boolean;
}

function applyRenderModeStyles(
  svg: TrustedSVG,
  options?: CardRenderOptions,
): TrustedSVG {
  if (options?.animationsEnabled !== false) {
    return svg;
  }

  const cleanSvg = toCleanSvgResponse(svg);
  if (cleanSvg.includes(STATIC_RENDER_MODE_MARKER)) {
    return svg;
  }

  const staticStyleBlock = `<style ${STATIC_RENDER_MODE_MARKER}>${generateStaticRenderStyles()}</style>`;
  const injectedSvg = cleanSvg.replace(
    /<svg\b([^>]*)>/i,
    (match) => `${match}${staticStyleBlock}`,
  );

  return markTrustedSvg(injectedSvg);
}

function createLazyLoader<T>(loader: () => Promise<T>): () => Promise<T> {
  let modulePromise: Promise<T> | undefined;

  return () => {
    modulePromise ??= loader();
    return modulePromise;
  };
}

const loadActivityStatsTemplates = createLazyLoader(async () => {
  const [
    activityStreaksModule,
    recentActivitySummaryModule,
    topActivityDaysModule,
  ] = await Promise.all([
    import("@/lib/svg-templates/activity-stats/activity-streaks-template"),
    import("@/lib/svg-templates/activity-stats/recent-activity-summary-template"),
    import("@/lib/svg-templates/activity-stats/top-activity-days-template"),
  ]);

  return {
    activityStreaksTemplate: activityStreaksModule.activityStreaksTemplate,
    recentActivitySummaryTemplate:
      recentActivitySummaryModule.recentActivitySummaryTemplate,
    topActivityDaysTemplate: topActivityDaysModule.topActivityDaysTemplate,
  };
});

const loadAnimeMangaOverviewTemplateModule = createLazyLoader(async () => {
  const { animeMangaOverviewTemplate } =
    await import("@/lib/svg-templates/comparative-distribution-stats/anime-manga-overview-template");

  return { animeMangaOverviewTemplate };
});

const loadCountryDiversityTemplateModule = createLazyLoader(async () => {
  const { countryDiversityTemplate } =
    await import("@/lib/svg-templates/comparative-distribution-stats/country-diversity-template");

  return { countryDiversityTemplate };
});

const loadFormatPreferenceOverviewTemplateModule = createLazyLoader(
  async () => {
    const { formatPreferenceOverviewTemplate } =
      await import("@/lib/svg-templates/comparative-distribution-stats/format-preference-overview-template");

    return { formatPreferenceOverviewTemplate };
  },
);

const loadGenreDiversityTemplateModule = createLazyLoader(async () => {
  const { genreDiversityTemplate } =
    await import("@/lib/svg-templates/comparative-distribution-stats/genre-diversity-template");

  return { genreDiversityTemplate };
});

const loadLengthPreferenceTemplateModule = createLazyLoader(async () => {
  const { lengthPreferenceTemplate } =
    await import("@/lib/svg-templates/comparative-distribution-stats/length-preference-template");

  return { lengthPreferenceTemplate };
});

const loadReleaseEraPreferenceTemplateModule = createLazyLoader(async () => {
  const { releaseEraPreferenceTemplate } =
    await import("@/lib/svg-templates/comparative-distribution-stats/release-era-preference-template");

  return { releaseEraPreferenceTemplate };
});

const loadScoreCompareAnimeMangaTemplateModule = createLazyLoader(async () => {
  const { scoreCompareAnimeMangaTemplate } =
    await import("@/lib/svg-templates/comparative-distribution-stats/score-compare-anime-manga-template");

  return { scoreCompareAnimeMangaTemplate };
});

const loadStartYearMomentumTemplateModule = createLazyLoader(async () => {
  const { startYearMomentumTemplate } =
    await import("@/lib/svg-templates/comparative-distribution-stats/start-year-momentum-template");

  return { startYearMomentumTemplate };
});

const loadCurrentlyWatchingReadingTemplateModule = createLazyLoader(
  async () => {
    const { currentlyWatchingReadingTemplate } =
      await import("@/lib/svg-templates/completion-progress-stats/currently-watching-reading-template");

    return { currentlyWatchingReadingTemplate };
  },
);

const loadMilestonesTemplateModule = createLazyLoader(async () => {
  const { milestonesTemplate } =
    await import("@/lib/svg-templates/completion-progress-stats/milestones-template");

  return { milestonesTemplate };
});

const loadMostRewatchedTemplateModule = createLazyLoader(async () => {
  const { mostRewatchedTemplate } =
    await import("@/lib/svg-templates/completion-progress-stats/most-rewatched-template");

  return { mostRewatchedTemplate };
});

const loadPersonalRecordsTemplateModule = createLazyLoader(async () => {
  const { personalRecordsTemplate } =
    await import("@/lib/svg-templates/completion-progress-stats/personal-records-template");

  return { personalRecordsTemplate };
});

const loadPlanningBacklogTemplateModule = createLazyLoader(async () => {
  const { planningBacklogTemplate } =
    await import("@/lib/svg-templates/completion-progress-stats/planning-backlog-template");

  return { planningBacklogTemplate };
});

const loadStatusCompletionOverviewTemplateModule = createLazyLoader(
  async () => {
    const { statusCompletionOverviewTemplate } =
      await import("@/lib/svg-templates/completion-progress-stats/status-completion-overview-template");

    return { statusCompletionOverviewTemplate };
  },
);

const loadDistributionTemplates = createLazyLoader(async () => {
  const { distributionTemplate } =
    await import("@/lib/svg-templates/distribution/shared");

  return { distributionTemplate };
});

const loadExtraAnimeMangaTemplates = createLazyLoader(async () => {
  const [
    animeEpisodeLengthPreferencesModule,
    animeGenreSynergyModule,
    animeSeasonalPreferenceModule,
    animeSourceMaterialDistributionModule,
    sharedModule,
  ] = await Promise.all([
    import("@/lib/svg-templates/extra-anime-manga-stats/anime-episode-length-preferences-template"),
    import("@/lib/svg-templates/extra-anime-manga-stats/anime-genre-synergy-template"),
    import("@/lib/svg-templates/extra-anime-manga-stats/anime-seasonal-preference-template"),
    import("@/lib/svg-templates/extra-anime-manga-stats/anime-source-material-distribution-template"),
    import("@/lib/svg-templates/extra-anime-manga-stats/shared"),
  ]);

  return {
    animeEpisodeLengthPreferencesTemplate:
      animeEpisodeLengthPreferencesModule.animeEpisodeLengthPreferencesTemplate,
    animeGenreSynergyTemplate:
      animeGenreSynergyModule.animeGenreSynergyTemplate,
    animeSeasonalPreferenceTemplate:
      animeSeasonalPreferenceModule.animeSeasonalPreferenceTemplate,
    animeSourceMaterialDistributionTemplate:
      animeSourceMaterialDistributionModule.animeSourceMaterialDistributionTemplate,
    extraAnimeMangaStatsTemplate: sharedModule.extraAnimeMangaStatsTemplate,
  };
});

const loadMediaStatsTemplateModule = createLazyLoader(async () => {
  const { mediaStatsTemplate } =
    await import("@/lib/svg-templates/media-stats/shared");

  return { mediaStatsTemplate };
});

const loadFavoritesGridTemplateModule = createLazyLoader(async () => {
  const { favoritesGridTemplate } =
    await import("@/lib/svg-templates/profile-favorite-stats/favorites-grid-template");

  return { favoritesGridTemplate };
});

const loadFavoritesSummaryTemplateModule = createLazyLoader(async () => {
  const { favoritesSummaryTemplate } =
    await import("@/lib/svg-templates/profile-favorite-stats/favorites-summary-template");

  return { favoritesSummaryTemplate };
});

const loadProfileOverviewTemplateModule = createLazyLoader(async () => {
  const { profileOverviewTemplate } =
    await import("@/lib/svg-templates/profile-favorite-stats/profile-overview-template");

  return { profileOverviewTemplate };
});

const loadSocialMilestonesTemplateModule = createLazyLoader(async () => {
  const { socialMilestonesTemplate } =
    await import("@/lib/svg-templates/social-community/social-milestones-template");

  return { socialMilestonesTemplate };
});

const loadSocialStatsTemplateModule = createLazyLoader(async () => {
  const { socialStatsTemplate } =
    await import("@/lib/svg-templates/social-stats");

  return { socialStatsTemplate };
});

const loadStudioCollaborationTemplateModule = createLazyLoader(async () => {
  const { studioCollaborationTemplate } =
    await import("@/lib/svg-templates/studio-stats");

  return { studioCollaborationTemplate };
});

const loadUserAnalyticsTemplates = createLazyLoader(async () => {
  const {
    droppedMediaTemplate,
    reviewStatsTemplate,
    seasonalViewingPatternsTemplate,
    tagCategoryDistributionTemplate,
    tagDiversityTemplate,
  } = await import("@/lib/svg-templates/user-analytics");

  return {
    droppedMediaTemplate,
    reviewStatsTemplate,
    seasonalViewingPatternsTemplate,
    tagCategoryDistributionTemplate,
    tagDiversityTemplate,
  };
});

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
  | "radar"
  | "compact"
  | "minimal"
  | "badges"
  | "bar"
  | "horizontal"
  | "cumulative"
  | "anime"
  | "manga"
  | "characters"
  | "staff"
  | "studios"
  | "mixed"
  | "github"
  | "fire"
  | "combined"
  | "split";

/** @source */
type StatsVariant = "default" | "vertical" | "minimal";
/** @source */
type SocialVariant = "default" | "compact" | "minimal" | "badges";
/** @source */
type PieBarVariant = "default" | "pie" | "bar" | "donut";
/** @source */
type ExtraStatsVariant = PieBarVariant | "radar";
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
type FavoritesGridVariant =
  | "anime"
  | "manga"
  | "characters"
  | "staff"
  | "studios"
  | "mixed";
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
    "radar",
    "compact",
    "minimal",
    "badges",
    "bar",
    "horizontal",
    "cumulative",
    "anime",
    "manga",
    "characters",
    "staff",
    "studios",
    "mixed",
    "combined",
    "split",
  ]);
  const fallback = baseCardType
    ? getDefaultCardVariation(baseCardType)
    : "default";

  if (!variant || typeof variant !== "string") {
    return fallback as CardGenVariant;
  }

  // Accept legacy 'communityFootprint' variant as alias for 'badges'
  if (variant === "communityFootprint") variant = "badges";

  if (baseCardType) {
    const allowedVariants = getCardVariations(baseCardType).map(
      (entry) => entry.id,
    );
    if (allowedVariants.includes(variant)) {
      return variant as CardGenVariant;
    }

    return fallback as CardGenVariant;
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
async function generateStatsCard(
  params: CardGenerationParams,
  mediaType: "anime" | "manga",
): Promise<TrustedSVG> {
  const { cardConfig, userRecord, variant } = params;
  const { mediaStatsTemplate } = await loadMediaStatsTemplateModule();
  const recordsStats = userRecord.stats?.User?.statistics?.[mediaType] as
    | UserStatsData["User"]["statistics"]["anime"]
    | UserStatsData["User"]["statistics"]["manga"]
    | undefined;
  if (!recordsStats) {
    throw new CardDataError("Not Found: Missing stats data for user", 404);
  }
  let milestoneCount = 0;
  if (mediaType === "anime") {
    milestoneCount = (recordsStats as TemplateAnimeStats).episodesWatched || 0;
  } else {
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

async function generateSocialStatsCard(
  params: CardGenerationParams,
): Promise<TrustedSVG> {
  const { cardConfig, userRecord, variant } = params;
  const { socialStatsTemplate } = await loadSocialStatsTemplateModule();
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
async function generateSocialMilestonesCard(
  params: CardGenerationParams,
): Promise<TrustedSVG> {
  const { cardConfig, userRecord, variant } = params;
  const { socialMilestonesTemplate } =
    await loadSocialMilestonesTemplateModule();

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
async function generateCardSvg(
  cardConfig: StoredCardConfig,
  userRecord: UserRecord,
  variant: string,
  favorites?: string[],
  renderOptions?: CardRenderOptions,
): Promise<TrustedSVG> {
  if (!cardConfig || !userRecord?.stats) {
    throw new CardDataError(
      "Not Found: Missing card configuration or stats data",
      404,
    );
  }

  await initializeServerPretext();

  const [baseCardType] = cardConfig.cardName.split("-");
  const normalizedVariant = normalizeVariant(String(variant), baseCardType);
  const renderableCardConfig = {
    ...cardConfig,
    animate: renderOptions?.animationsEnabled !== false,
  } as StoredCardConfig;
  const params: CardGenerationParams = {
    cardConfig: renderableCardConfig,
    userRecord,
    variant: normalizedVariant,
    favorites,
    favoritesGridCols:
      typeof renderableCardConfig.gridCols === "number"
        ? renderableCardConfig.gridCols
        : undefined,
    favoritesGridRows:
      typeof renderableCardConfig.gridRows === "number"
        ? renderableCardConfig.gridRows
        : undefined,
  };

  const comparativeDispatch: Record<
    string,
    (p: CardGenerationParams) => Promise<TrustedSVG>
  > = {
    animeMangaOverview: generateAnimeMangaOverviewCard,
    scoreCompareAnimeManga: generateScoreCompareAnimeMangaCard,
    countryDiversity: generateCountryDiversityCard,
    genreDiversity: generateGenreDiversityCard,
    formatPreferenceOverview: generateFormatPreferenceOverviewCard,
    releaseEraPreference: generateReleaseEraPreferenceCard,
    startYearMomentum: generateStartYearMomentumCard,
    lengthPreference: generateLengthPreferenceCard,
    tagCategoryDistribution: generateTagCategoryDistributionCard,
    tagDiversity: generateTagDiversityCard,
    seasonalViewingPatterns: generateSeasonalViewingPatternsCard,
    droppedMedia: generateDroppedMediaCard,
    reviewStats: generateReviewStatsCard,
    studioCollaboration: generateStudioCollaborationCard,
  };

  const comparativeGenerator = comparativeDispatch[baseCardType];
  if (comparativeGenerator) {
    return applyRenderModeStyles(
      await comparativeGenerator(params),
      renderOptions,
    );
  }

  const generatedSvg = await (async () => {
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
      case "animeSourceMaterialDistribution":
        return generateSourceMaterialDistributionCard(params);
      case "animeSeasonalPreference":
        return generateSeasonalPreferenceCard(params);
      case "animeEpisodeLengthPreferences":
        return generateEpisodeLengthPreferencesCard(params);
      case "animeGenreSynergy":
        return generateGenreSynergyCard(params);
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
        return generateProfileOverviewCard(params);
      case "favoritesSummary":
        return generateFavoritesSummaryCard(params);
      case "favoritesGrid":
        return generateFavoritesGridCard(params);
      case "recentActivitySummary":
        return generateRecentActivitySummaryCard(params);
      case "activityStreaks":
        return generateActivityStreaksCard(params);
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
        return generateCurrentlyWatchingReadingCard(params);

      default:
        throw new CardDataError("Unsupported card type", 400);
    }
  })();

  return applyRenderModeStyles(generatedSvg, renderOptions);
}

/**
 * Generate an Anime vs Manga Overview card.
 * @source
 */
async function generateAnimeMangaOverviewCard(
  params: CardGenerationParams,
): Promise<TrustedSVG> {
  const { cardConfig, userRecord, variant } = params;
  const { animeMangaOverviewTemplate } =
    await loadAnimeMangaOverviewTemplateModule();
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
async function generateScoreCompareAnimeMangaCard(
  params: CardGenerationParams,
): Promise<TrustedSVG> {
  const { cardConfig, userRecord, variant } = params;
  const { scoreCompareAnimeMangaTemplate } =
    await loadScoreCompareAnimeMangaTemplateModule();
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
async function generateCountryDiversityCard(
  params: CardGenerationParams,
): Promise<TrustedSVG> {
  const { cardConfig, userRecord, variant } = params;
  const { countryDiversityTemplate } =
    await loadCountryDiversityTemplateModule();
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
async function generateGenreDiversityCard(
  params: CardGenerationParams,
): Promise<TrustedSVG> {
  const { cardConfig, userRecord, variant } = params;
  const { genreDiversityTemplate } = await loadGenreDiversityTemplateModule();
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
async function generateFormatPreferenceOverviewCard(
  params: CardGenerationParams,
): Promise<TrustedSVG> {
  const { cardConfig, userRecord, variant } = params;
  const { formatPreferenceOverviewTemplate } =
    await loadFormatPreferenceOverviewTemplateModule();
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
async function generateReleaseEraPreferenceCard(
  params: CardGenerationParams,
): Promise<TrustedSVG> {
  const { cardConfig, userRecord, variant } = params;
  const { releaseEraPreferenceTemplate } =
    await loadReleaseEraPreferenceTemplateModule();
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
async function generateStartYearMomentumCard(
  params: CardGenerationParams,
): Promise<TrustedSVG> {
  const { cardConfig, userRecord, variant } = params;
  const { startYearMomentumTemplate } =
    await loadStartYearMomentumTemplateModule();
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
async function generateLengthPreferenceCard(
  params: CardGenerationParams,
): Promise<TrustedSVG> {
  const { cardConfig, userRecord, variant } = params;
  const { lengthPreferenceTemplate } =
    await loadLengthPreferenceTemplateModule();
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
async function generateCategoryCard(
  params: CardGenerationParams,
  baseCardType: string,
): Promise<TrustedSVG> {
  const { cardConfig, userRecord, variant, favorites } = params;
  const { extraAnimeMangaStatsTemplate } = await loadExtraAnimeMangaTemplates();
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
    variant: (["pie", "bar", "donut", "radar"].includes(variant)
      ? variant
      : "default") as ExtraStatsVariant,
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
 * Generate a Source Material Distribution card showing counts by adaptation source.
 * Uses the render-safe aggregate totals stored on the user record.
 * @source
 */
async function generateSourceMaterialDistributionCard(
  params: CardGenerationParams,
): Promise<TrustedSVG> {
  const { cardConfig, userRecord, variant } = params;
  const { animeSourceMaterialDistributionTemplate } =
    await loadExtraAnimeMangaTemplates();

  const statsList = toTemplateAnimeSourceMaterialDistribution(userRecord);
  if (!statsList.length) {
    throw new CardDataError(
      "Not Found: No source material distribution data for this user",
      404,
    );
  }

  const mappedVariant = (
    ["pie", "bar", "donut"].includes(variant) ? variant : "default"
  ) as PieBarVariant;

  return animeSourceMaterialDistributionTemplate({
    username: userRecord.username ?? userRecord.userId,
    variant: mappedVariant,
    styles: extractStyles(cardConfig),
    stats: statsList,
    showPieChart: mappedVariant === "pie",
    showPiePercentages: !!cardConfig.showPiePercentages,
  });
}

/**
 * Generate an Anime Seasonal Preference card showing counts by release season.
 * Uses the render-safe aggregate totals stored on the user record.
 * @source
 */
async function generateSeasonalPreferenceCard(
  params: CardGenerationParams,
): Promise<TrustedSVG> {
  const { cardConfig, userRecord, variant } = params;
  const { animeSeasonalPreferenceTemplate } =
    await loadExtraAnimeMangaTemplates();

  const statsList = toTemplateAnimeSeasonalPreference(userRecord);
  if (!statsList.length) {
    throw new CardDataError(
      "Not Found: No seasonal preference data for this user",
      404,
    );
  }

  const mappedVariant = (
    ["pie", "bar", "donut", "radar"].includes(variant) ? variant : "default"
  ) as ExtraStatsVariant;

  return animeSeasonalPreferenceTemplate({
    username: userRecord.username ?? userRecord.userId,
    variant: mappedVariant,
    styles: extractStyles(cardConfig),
    stats: statsList,
    showPieChart: mappedVariant === "pie",
    showPiePercentages: !!cardConfig.showPiePercentages,
  });
}

/**
 * Generate an Episode Length Preferences card.
 *
 * Uses the user's anime statistics `lengths` and buckets into Short/Standard/Long.
 * @source
 */
async function generateEpisodeLengthPreferencesCard(
  params: CardGenerationParams,
): Promise<TrustedSVG> {
  const { cardConfig, userRecord, variant } = params;
  const { animeEpisodeLengthPreferencesTemplate } =
    await loadExtraAnimeMangaTemplates();

  const statsList = toTemplateAnimeEpisodeLengthPreferences(userRecord);
  if (!statsList.length) {
    throw new CardDataError(
      "Not Found: No episode length preference data for this user",
      404,
    );
  }

  const mappedVariant = (
    ["pie", "bar", "donut"].includes(variant) ? variant : "default"
  ) as PieBarVariant;

  return animeEpisodeLengthPreferencesTemplate({
    username: userRecord.username ?? userRecord.userId,
    variant: mappedVariant,
    styles: extractStyles(cardConfig),
    stats: statsList,
    showPieChart: mappedVariant === "pie",
    showPiePercentages: !!cardConfig.showPiePercentages,
  });
}

/**
 * Generate an Anime Genre Synergy card showing top genre pairs.
 *
 * Uses pre-aggregated totals stored on the user record at write time.
 * @source
 */
async function generateGenreSynergyCard(
  params: CardGenerationParams,
): Promise<TrustedSVG> {
  const { cardConfig, userRecord } = params;
  const { animeGenreSynergyTemplate } = await loadExtraAnimeMangaTemplates();

  const statsList = toTemplateAnimeGenreSynergy(userRecord);
  if (!statsList.length) {
    throw new CardDataError(
      "Not Found: No genre synergy data for this user",
      404,
    );
  }

  return animeGenreSynergyTemplate({
    username: userRecord.username ?? userRecord.userId,
    variant: "default",
    styles: extractStyles(cardConfig),
    stats: statsList,
  });
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
async function generateSimpleListCard(
  params: CardGenerationParams,
  baseCardType: string,
  listKey: string,
  nameKey: string,
  notFoundMessage: string,
  extraTemplateProps?: Record<string, unknown>,
): Promise<TrustedSVG> {
  const { cardConfig, userRecord, variant } = params;
  const { extraAnimeMangaStatsTemplate } = await loadExtraAnimeMangaTemplates();
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
async function generateDistributionCard(
  params: CardGenerationParams,
  baseCardType: string,
  kind: "score" | "year",
): Promise<TrustedSVG> {
  const { cardConfig, userRecord, variant } = params;
  const { distributionTemplate } = await loadDistributionTemplates();
  const isAnime = baseCardType.startsWith("anime");
  const stats = isAnime
    ? userRecord.stats?.User?.statistics?.anime
    : userRecord.stats?.User?.statistics?.manga;
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
async function generateCountryCard(
  params: CardGenerationParams,
  baseCardType: string,
): Promise<TrustedSVG> {
  const { cardConfig, userRecord, variant } = params;
  const { extraAnimeMangaStatsTemplate } = await loadExtraAnimeMangaTemplates();
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
 * Embeds the avatar image as a data URL during render so SVG and PNG embeds do
 * not depend on browser access to nested remote image requests.
 * @param params - Card generation parameters and options.
 * @returns A TrustedSVG with the rendered profile overview card.
 * @source
 */
async function generateProfileOverviewCard(
  params: CardGenerationParams,
): Promise<TrustedSVG> {
  const { cardConfig, userRecord, variant } = params;
  const { profileOverviewTemplate } = await loadProfileOverviewTemplateModule();
  const user = userRecord.stats?.User;

  if (!user?.statistics) {
    throw new CardDataError("Not Found: Missing user statistics", 404);
  }

  const avatarUrl = user.avatar?.large || user.avatar?.medium;
  // fetchImageAsDataUrl already enforces the AniList/CDN allowlist, timeout, and cache-first fallback, so a null result simply degrades to the template's non-image avatar path.
  const avatarDataUrl = avatarUrl ? await fetchImageAsDataUrl(avatarUrl) : null;

  return profileOverviewTemplate({
    username: userRecord.username ?? userRecord.userId,
    variant: variant as ProfileVariant,
    styles: extractStyles(cardConfig),
    statistics: user.statistics,
    avatar: user.avatar,
    avatarDataUrl: avatarDataUrl ?? undefined,
    createdAt: user.createdAt,
    uniqueId: userRecord.userId,
  });
}

/**
 * Generate a Favourites Summary card showing counts of favorites in each category.
 * @param params - Card generation parameters and options.
 * @returns A TrustedSVG with the rendered favourites summary card.
 * @source
 */
async function generateFavoritesSummaryCard(
  params: CardGenerationParams,
): Promise<TrustedSVG> {
  const { cardConfig, userRecord, variant } = params;
  const { favoritesSummaryTemplate } =
    await loadFavoritesSummaryTemplateModule();
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
 * Embeds cover and character images as data URLs so embedded SVGs and raster
 * exports do not depend on nested remote image fetches.
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

  const [{ favoritesGridTemplate }, embeddedFavourites] = await Promise.all([
    loadFavoritesGridTemplateModule(),
    embedFavoritesGridImages(
      user.favourites,
      variant as FavoritesGridVariant,
      params.favoritesGridRows,
      params.favoritesGridCols,
    ),
  ]);

  return favoritesGridTemplate({
    username: userRecord.username ?? userRecord.userId,
    variant: variant as FavoritesGridVariant,
    styles: extractStyles(cardConfig),
    favourites: embeddedFavourites,
    gridCols: params.favoritesGridCols,
    gridRows: params.favoritesGridRows,
  });
}

/** Variant type for activity summary/streaks cards. @source */
type ActivityVariant = "default";

/** Variant type for activity feed/patterns cards. @source */
type ActivityCompactVariant = "default";

/**
 * Generate a Recent Activity Summary card with sparkline.
 * @param params - Card generation parameters and options.
 * @returns A TrustedSVG with the rendered activity summary card.
 * @source
 */
async function generateRecentActivitySummaryCard(
  params: CardGenerationParams,
): Promise<TrustedSVG> {
  const { cardConfig, userRecord, variant } = params;
  const { recentActivitySummaryTemplate } = await loadActivityStatsTemplates();
  const activityHistory = extractActivityHistory(userRecord.stats?.User?.stats);

  return recentActivitySummaryTemplate({
    username: userRecord.username ?? userRecord.userId,
    variant: variant as ActivityVariant,
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
async function generateActivityStreaksCard(
  params: CardGenerationParams,
): Promise<TrustedSVG> {
  const { cardConfig, userRecord, variant } = params;
  const { activityStreaksTemplate } = await loadActivityStatsTemplates();
  const activityHistory = extractActivityHistory(userRecord.stats?.User?.stats);

  return activityStreaksTemplate({
    username: userRecord.username ?? userRecord.userId,
    variant: variant as ActivityVariant,
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
async function generateTopActivityDaysCard(
  params: CardGenerationParams,
): Promise<TrustedSVG> {
  const { cardConfig, userRecord, variant } = params;
  const { topActivityDaysTemplate } = await loadActivityStatsTemplates();
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
async function generateStatusCompletionOverviewCard(
  params: CardGenerationParams,
): Promise<TrustedSVG> {
  const { cardConfig, userRecord, variant } = params;
  const { statusCompletionOverviewTemplate } =
    await loadStatusCompletionOverviewTemplateModule();
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
async function generateMilestonesCard(
  params: CardGenerationParams,
): Promise<TrustedSVG> {
  const { cardConfig, userRecord, variant } = params;
  const { milestonesTemplate } = await loadMilestonesTemplateModule();
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
async function generatePersonalRecordsCard(
  params: CardGenerationParams,
): Promise<TrustedSVG> {
  const { cardConfig, userRecord, variant } = params;
  const { personalRecordsTemplate } = await loadPersonalRecordsTemplateModule();

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
async function generatePlanningBacklogCard(
  params: CardGenerationParams,
): Promise<TrustedSVG> {
  const { cardConfig, userRecord, variant } = params;
  const { planningBacklogTemplate } = await loadPlanningBacklogTemplateModule();

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
async function generateMostRewatchedCard(
  params: CardGenerationParams,
): Promise<TrustedSVG> {
  const { cardConfig, userRecord, variant } = params;
  const { mostRewatchedTemplate } = await loadMostRewatchedTemplateModule();

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
 * Embeds visible cover images as data URLs so SVG and PNG exports do not depend
 * on nested remote image fetches at display time.
 * @source
 */
async function generateCurrentlyWatchingReadingCard(
  params: CardGenerationParams,
): Promise<TrustedSVG> {
  const { cardConfig, userRecord, variant } = params;
  const { currentlyWatchingReadingTemplate } =
    await loadCurrentlyWatchingReadingTemplateModule();

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

  // These cover-image embedders are already bounded and fail open to placeholders, so run both media groups in parallel and keep rendering even if one side is slow or partially unavailable.
  const [embeddedAnime, embeddedManga] = await Promise.all([
    embedMediaListCoverImages(animeDisplay),
    embedMediaListCoverImages(mangaDisplay),
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

/** Variant type for user analytics cards. @source */
type UserAnalyticsVariant = "default";

/**
 * Generate a Tag Category Distribution card.
 * @source
 */
async function generateTagCategoryDistributionCard(
  params: CardGenerationParams,
): Promise<TrustedSVG> {
  const { cardConfig, userRecord, variant } = params;
  const { tagCategoryDistributionTemplate } =
    await loadUserAnalyticsTemplates();

  return tagCategoryDistributionTemplate({
    username: userRecord.username ?? userRecord.userId,
    variant: variant as UserAnalyticsVariant,
    styles: extractStyles(cardConfig),
    animeStats: userRecord.stats?.User?.statistics?.anime,
    mangaStats: userRecord.stats?.User?.statistics?.manga,
  });
}

/**
 * Generate a Tag Diversity card.
 * @source
 */
async function generateTagDiversityCard(
  params: CardGenerationParams,
): Promise<TrustedSVG> {
  const { cardConfig, userRecord, variant } = params;
  const { tagDiversityTemplate } = await loadUserAnalyticsTemplates();

  return tagDiversityTemplate({
    username: userRecord.username ?? userRecord.userId,
    variant: variant as UserAnalyticsVariant,
    styles: extractStyles(cardConfig),
    animeStats: userRecord.stats?.User?.statistics?.anime,
    mangaStats: userRecord.stats?.User?.statistics?.manga,
  });
}

/**
 * Generate a Seasonal Viewing Patterns card.
 * @source
 */
async function generateSeasonalViewingPatternsCard(
  params: CardGenerationParams,
): Promise<TrustedSVG> {
  const { cardConfig, userRecord, variant } = params;
  const { seasonalViewingPatternsTemplate } =
    await loadUserAnalyticsTemplates();
  const activityHistory = extractActivityHistory(userRecord.stats?.User?.stats);

  return seasonalViewingPatternsTemplate({
    username: userRecord.username ?? userRecord.userId,
    variant: variant as UserAnalyticsVariant,
    styles: extractStyles(cardConfig),
    activityHistory,
  });
}

/**
 * Generate a Dropped Media card.
 * @source
 */
async function generateDroppedMediaCard(
  params: CardGenerationParams,
): Promise<TrustedSVG> {
  const { cardConfig, userRecord } = params;
  const { droppedMediaTemplate } = await loadUserAnalyticsTemplates();

  const animeDropped = extractMediaListEntries(userRecord.stats?.animeDropped);
  const mangaDropped = extractMediaListEntries(userRecord.stats?.mangaDropped);

  return droppedMediaTemplate({
    username: userRecord.username ?? userRecord.userId,
    variant: "default",
    styles: extractStyles(cardConfig),
    animeDropped,
    mangaDropped,
  });
}

/**
 * Generate a Review Stats card.
 * @source
 */
async function generateReviewStatsCard(
  params: CardGenerationParams,
): Promise<TrustedSVG> {
  const { cardConfig, userRecord } = params;
  const { reviewStatsTemplate } = await loadUserAnalyticsTemplates();

  const reviews = userRecord.stats?.userReviews?.reviews;

  return reviewStatsTemplate({
    username: userRecord.username ?? userRecord.userId,
    variant: "default",
    styles: extractStyles(cardConfig),
    reviews,
  });
}

/**
 * Generate a Studio Collaboration card showing top studio co-occurrence pairs.
 * Uses the render-safe aggregate totals stored on the user record.
 * @source
 */
async function generateStudioCollaborationCard(
  params: CardGenerationParams,
): Promise<TrustedSVG> {
  const { cardConfig, userRecord } = params;
  const { studioCollaborationTemplate } =
    await loadStudioCollaborationTemplateModule();

  const statsList = toTemplateStudioCollaboration(userRecord);
  if (!statsList.length) {
    throw new CardDataError(
      "Not Found: No studio collaboration data for this user",
      404,
    );
  }

  return studioCollaborationTemplate({
    username: userRecord.username ?? userRecord.userId,
    variant: "default",
    styles: extractStyles(cardConfig),
    stats: statsList,
  });
}

export default generateCardSvg;
