import { calculateMilestones } from "@/lib/utils/milestones";
import {
  UserRecord,
  UserStatsData,
  ActivityHistoryItem,
} from "@/lib/types/records";
import {
  SocialStats,
  AnimeStats as TemplateAnimeStats,
  MangaStats as TemplateMangaStats,
} from "@/lib/types/card";
import {
  GenreItem,
  TagItem,
  VoiceActorItem,
  StudioItem,
  StaffItem,
  getFavoritesForCardType,
  MilestoneFields,
} from "./validation";

/**
 * Builds SocialStats used by templates from a normalized UserRecord.
 * Copies follower/following/thread/review pages and activity history into template format.
 * @param userRecord - A validated and normalized UserRecord from the datastore.
 * @returns SocialStats shaped for template rendering.
 * @source
 */
function extractActivityHistory(statsRoot: unknown): ActivityHistoryItem[] {
  if (!statsRoot || typeof statsRoot !== "object") return [];
  const v = (statsRoot as Record<string, unknown>)["activityHistory"];
  return Array.isArray(v) ? (v as ActivityHistoryItem[]) : [];
}

export function toTemplateSocialStats(userRecord: UserRecord): SocialStats {
  return {
    followersPage: userRecord.stats.followersPage,
    followingPage: userRecord.stats.followingPage,
    threadsPage: userRecord.stats.threadsPage,
    threadCommentsPage: userRecord.stats.threadCommentsPage,
    reviewsPage: userRecord.stats.reviewsPage,
    activityHistory: extractActivityHistory(userRecord.stats.User.stats),
  } as SocialStats;
}

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
