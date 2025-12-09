import { calculateMilestones } from "@/lib/utils/milestones";
import { extractStyles } from "@/lib/utils";
import { extraAnimeMangaStatsTemplate } from "@/lib/svg-templates/extra-anime-manga-stats";
import { mediaStatsTemplate } from "@/lib/svg-templates/media-stats";
import { socialStatsTemplate } from "@/lib/svg-templates/social-stats";
import { distributionTemplate } from "@/lib/svg-templates/distribution";
import { TrustedSVG } from "@/lib/types/svg";
import {
  StoredCardConfig,
  UserRecord,
  UserStatsData,
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

/**
 * Supported visual variants for generated cards.
 * These correspond to layout choices used by the SVG templates.
 * @source
 */
type CardGenVariant =
  | "default"
  | "vertical"
  | "pie"
  | "compact"
  | "minimal"
  | "bar"
  | "horizontal";

/** @source */
type StatsVariant = "default" | "vertical" | "compact" | "minimal";
/** @source */
type SocialVariant = "default" | "compact" | "minimal";
/** @source */
type PieBarVariant = "default" | "pie" | "bar";
/** @source */
type DistributionVariant = "default" | "horizontal";

/**
 * Parameters provided to the card generation functions.
 * @source
 */
interface CardGenerationParams {
  cardConfig: StoredCardConfig;
  userRecord: UserRecord;
  variant: string;
  favorites?: string[];
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
    "compact",
    "minimal",
    "bar",
    "horizontal",
  ]);
  // Default early for invalid variant types
  if (!variant || typeof variant !== "string") return "default";
  if (!globalVariants.has(variant as CardGenVariant)) return "default";

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
  ]);
  const pieBarVariants = new Set<CardGenVariant>(["default", "pie", "bar"]);
  const distributionVariants = new Set<CardGenVariant>([
    "default",
    "horizontal",
  ]);

  switch (baseCardType) {
    case "animeStats":
    case "mangaStats":
      return statsVariants.has(variant as CardGenVariant)
        ? (variant as CardGenVariant)
        : "default";
    case "socialStats":
      return socialVariants.has(variant as CardGenVariant)
        ? (variant as CardGenVariant)
        : "default";
    case "animeGenres":
    case "animeTags":
    case "animeVoiceActors":
    case "animeStudios":
    case "animeStaff":
    case "mangaGenres":
    case "mangaTags":
    case "mangaStaff":
    case "animeStatusDistribution":
    case "mangaStatusDistribution":
    case "animeFormatDistribution":
    case "mangaFormatDistribution":
    case "animeCountry":
    case "mangaCountry":
      return pieBarVariants.has(variant as CardGenVariant)
        ? (variant as CardGenVariant)
        : "default";
    case "animeScoreDistribution":
    case "mangaScoreDistribution":
    case "animeYearDistribution":
    case "mangaYearDistribution":
      return distributionVariants.has(variant as CardGenVariant)
        ? (variant as CardGenVariant)
        : "default";
    default:
      return globalVariants.has(variant as CardGenVariant)
        ? (variant as CardGenVariant)
        : "default";
  }
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
function generateSocialStatsCard(params: CardGenerationParams) {
  const { cardConfig, userRecord, variant } = params;
  return socialStatsTemplate({
    username: userRecord.username ?? userRecord.userId,
    variant: variant as SocialVariant,
    styles: extractStyles(cardConfig),
    stats: toTemplateSocialStats(userRecord),
    activityHistory: userRecord.stats.User.stats.activityHistory ?? [],
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
export function generateCardSvg(
  cardConfig: StoredCardConfig,
  userRecord: UserRecord,
  variant: string,
  favorites?: string[],
): TrustedSVG {
  if (!cardConfig || !userRecord?.stats) {
    throw new CardDataError(
      "Not Found: Missing card configuration or stats data",
      404,
    );
  }

  if (
    !userRecord.stats?.User?.statistics?.anime &&
    !userRecord.stats?.User?.statistics?.manga
  ) {
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
  };

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
      throw new CardDataError("Unsupported card type", 400);
  }
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
    { fixedStatusColors: !!params.cardConfig.useStatusColors },
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
  const mappedVariant = (
    ["default", "horizontal"].includes(variant) ? variant : "default"
  ) as DistributionVariant;
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

export default generateCardSvg;
