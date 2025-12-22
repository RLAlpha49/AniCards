import { calculateMilestones } from "@/lib/utils/milestones";
import {
  UserRecord,
  UserStatsData,
  ActivityHistoryItem,
  MediaListEntry,
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

/**
 * Extract all entries from a MediaListCollection-like object.
 * @source
 */
function extractMediaListEntries(
  collection: { lists: { entries: MediaListEntry[] }[] } | undefined,
): MediaListEntry[] {
  if (!collection?.lists) return [];
  return collection.lists.flatMap((list) => list.entries ?? []);
}

const SOURCE_LABEL_OVERRIDES: Record<string, string> = {
  ORIGINAL: "Original",
  MANGA: "Manga",
  LIGHT_NOVEL: "Light Novel",
  VISUAL_NOVEL: "Visual Novel",
  VIDEO_GAME: "Video Game",
  OTHER: "Other",
  NOVEL: "Novel",
  DOUJINSHI: "Doujinshi",
  ANIME: "Anime",
  WEB_NOVEL: "Web Novel",
  LIVE_ACTION: "Live Action",
  GAME: "Game",
  COMIC: "Comic",
  MULTIMEDIA_PROJECT: "Multimedia Project",
  PICTURE_BOOK: "Picture Book",
  UNKNOWN: "Unknown",
};

function toTitleCaseFromEnum(value: string): string {
  return value
    .trim()
    .replaceAll(/_+/g, " ")
    .toLowerCase()
    .replaceAll(/\b\w/g, (c) => c.toUpperCase());
}

function toSourceLabel(source: string | undefined): string {
  const key = (source ?? "").trim();
  if (!key) return SOURCE_LABEL_OVERRIDES.UNKNOWN;
  return SOURCE_LABEL_OVERRIDES[key] ?? toTitleCaseFromEnum(key);
}

/**
 * Computes a distribution of anime titles by adaptation source.
 *
 * Uses the user's anime CURRENT + COMPLETED lists and counts unique titles
 * (deduped by media id). The resulting list is sorted by count desc and
 * optionally collapses long tails into an "Other" bucket.
 * @source
 */
function finalizeDistribution(
  rawItems: { name: string; count: number }[],
  maxBuckets = 10,
): { name: string; count: number }[] {
  const items = rawItems
    .map(({ name, count }) => ({ name, count: Number.isFinite(count) ? Math.max(0, count) : 0 }))
    .filter((x) => x.count > 0)
    .sort((a, b) => b.count - a.count);

  if (items.length <= maxBuckets) return items;

  const head = items.slice(0, maxBuckets - 1);
  const otherCount = items.slice(maxBuckets - 1).reduce((sum, item) => sum + item.count, 0);

  return [...head, { name: "Other", count: otherCount }];
}

export function toTemplateAnimeSourceMaterialDistribution(
  userRecord: UserRecord,
): {
  name: string;
  count: number;
}[] {
  const storedTotals = userRecord.animeSourceMaterialDistributionTotals;
  if (Array.isArray(storedTotals) && storedTotals.length > 0) {
    const raw = storedTotals.map(({ source, count }) => ({
      name: toSourceLabel(source),
      count: Number.isFinite(count) ? count : 0,
    }));

    return finalizeDistribution(raw);
  }

  const completed = extractMediaListEntries(userRecord.stats?.animeCompleted);
  const current = extractMediaListEntries(userRecord.stats?.animeCurrent);

  const uniqueByMediaId = new Map<number, MediaListEntry>();
  for (const entry of [...completed, ...current]) {
    const mediaId = entry.media?.id;
    if (!mediaId) continue;
    if (!uniqueByMediaId.has(mediaId)) uniqueByMediaId.set(mediaId, entry);
  }

  const bySource = new Map<string, number>();
  for (const entry of uniqueByMediaId.values()) {
    const key = (entry.media.source ?? "UNKNOWN").trim() || "UNKNOWN";
    bySource.set(key, (bySource.get(key) ?? 0) + 1);
  }

  const raw = [...bySource.entries()].map(([source, count]) => ({
    name: toSourceLabel(source),
    count,
  }));

  return finalizeDistribution(raw);
}

const SEASON_LABEL_OVERRIDES: Record<string, string> = {
  WINTER: "Winter",
  SPRING: "Spring",
  SUMMER: "Summer",
  FALL: "Fall",
  UNKNOWN: "Unknown",
};

function normalizeSeason(value: string | undefined): string {
  const raw = (value ?? "").trim().toUpperCase();
  if (
    raw === "WINTER" ||
    raw === "SPRING" ||
    raw === "SUMMER" ||
    raw === "FALL"
  ) {
    return raw;
  }
  return "UNKNOWN";
}

function toSeasonLabel(season: string): string {
  const key = normalizeSeason(season);
  return SEASON_LABEL_OVERRIDES[key] ?? "Unknown";
}

function addSeasonCount(
  map: Map<string, number>,
  season: string | undefined,
  count: number,
): void {
  const key = normalizeSeason(season);
  const safeCount = Number.isFinite(count) ? count : 0;
  if (safeCount <= 0) return;
  map.set(key, (map.get(key) ?? 0) + safeCount);
}

function seasonCountsFromStoredTotals(
  totals: UserRecord["animeSeasonalPreferenceTotals"],
): Map<string, number> | null {
  if (!Array.isArray(totals) || totals.length === 0) return null;
  const map = new Map<string, number>();
  for (const item of totals) {
    addSeasonCount(map, item.season, item.count);
  }
  return map.size > 0 ? map : null;
}

function seasonCountsFromLists(userRecord: UserRecord): Map<string, number> {
  const completed = extractMediaListEntries(userRecord.stats?.animeCompleted);
  const current = extractMediaListEntries(userRecord.stats?.animeCurrent);

  const uniqueByMediaId = new Map<number, MediaListEntry>();
  for (const entry of [...completed, ...current]) {
    const mediaId = entry.media?.id;
    if (!mediaId) continue;
    if (!uniqueByMediaId.has(mediaId)) uniqueByMediaId.set(mediaId, entry);
  }

  const map = new Map<string, number>();
  for (const entry of uniqueByMediaId.values()) {
    addSeasonCount(map, entry.media.season, 1);
  }
  return map;
}

/**
 * Computes a distribution of anime titles by release season.
 *
 * Uses the user's anime CURRENT + COMPLETED lists and counts unique titles
 * (deduped by media id). Prefers stored totals computed at write time.
 * @source
 */
export function toTemplateAnimeSeasonalPreference(userRecord: UserRecord): {
  name: string;
  count: number;
}[] {
  const seasonToCount =
    seasonCountsFromStoredTotals(userRecord.animeSeasonalPreferenceTotals) ??
    seasonCountsFromLists(userRecord);

  const order = ["WINTER", "SPRING", "SUMMER", "FALL"];
  const items = order.map((season) => ({
    name: toSeasonLabel(season),
    count: seasonToCount.get(season) ?? 0,
  }));

  const unknownCount = seasonToCount.get("UNKNOWN") ?? 0;
  const withUnknown =
    unknownCount > 0
      ? [...items, { name: toSeasonLabel("UNKNOWN"), count: unknownCount }]
      : items;

  const total = withUnknown.reduce(
    (sum, item) => sum + Math.max(0, item.count),
    0,
  );
  if (total <= 0) return [];

  return withUnknown;
}

type LengthStat = { length: string; count: number };

const EPISODE_LENGTH_BUCKET_LABELS = {
  short: "Short (<15 min)",
  standard: "Standard (~25 min)",
  long: "Long (>30 min)",
} as const;

type EpisodeLengthBucketLabel =
  (typeof EPISODE_LENGTH_BUCKET_LABELS)[keyof typeof EPISODE_LENGTH_BUCKET_LABELS];

function getEpisodeLengthBucketLabel(length: number): EpisodeLengthBucketLabel {
  if (length < 15) return EPISODE_LENGTH_BUCKET_LABELS.short;
  if (length <= 30) return EPISODE_LENGTH_BUCKET_LABELS.standard;
  return EPISODE_LENGTH_BUCKET_LABELS.long;
}

/**
 * Buckets AniList anime `statistics.anime.lengths` into three coarse categories.
 *
 * Note: AniList exposes `UserStatistics.lengths` as `UserLengthStatistic.length: String`.
 * This helper treats the `length` as a numeric value and buckets it.
 *
 * @source
 */
export function toTemplateAnimeEpisodeLengthPreferences(
  userRecord: UserRecord,
): {
  name: string;
  count: number;
}[] {
  const lengths = userRecord.stats?.User?.statistics?.anime?.lengths as
    | LengthStat[]
    | undefined;
  if (!Array.isArray(lengths) || lengths.length === 0) return [];

  const buckets: Record<EpisodeLengthBucketLabel, number> = {
    [EPISODE_LENGTH_BUCKET_LABELS.short]: 0,
    [EPISODE_LENGTH_BUCKET_LABELS.standard]: 0,
    [EPISODE_LENGTH_BUCKET_LABELS.long]: 0,
  };

  for (const entry of lengths) {
    const lengthValue =
      typeof entry?.length === "string" ? entry.length.trim() : "";
    const count =
      typeof entry?.count === "number" && Number.isFinite(entry.count)
        ? Math.max(0, entry.count)
        : 0;
    const parsed = Number.parseInt(lengthValue, 10);
    if (!lengthValue || count <= 0 || !Number.isFinite(parsed)) continue;

    buckets[getEpisodeLengthBucketLabel(parsed)] += count;
  }

  const stats = Object.entries(buckets).map(([name, count]) => ({
    name,
    count,
  }));

  const total = stats.reduce((sum, item) => sum + Math.max(0, item.count), 0);
  if (total <= 0) return [];

  return stats;
}

/**
 * Convert an array of pair totals into template-friendly {name,count} entries.
 *
 * Filters invalid entries, maps to display names using the provided labelizer,
 * sorts by count (desc) then name, and limits the result to `maxItems`.
 * @internal
 */
function buildTopPairsFromTotals(
  totals: Array<{ a?: string; b?: string; count?: number }> | undefined,
  labelizer: (a: string, b: string) => string = (a, b) => `${a} + ${b}`,
  maxItems = 10,
): { name: string; count: number }[] {
  if (!Array.isArray(totals) || totals.length === 0) return [];

  return [...totals]
    .filter(
      (t) =>
        !!t &&
        typeof t.a === "string" &&
        typeof t.b === "string" &&
        typeof t.count === "number" &&
        Number.isFinite(t.count) &&
        t.count > 0,
    )
    .map((t) => ({
      name: labelizer(t.a as string, t.b as string),
      count: Math.max(0, t.count as number),
    }))
    .sort((x, y) => y.count - x.count || x.name.localeCompare(y.name))
    .slice(0, maxItems);
}

/**
 * Builds a list of top genre pairs (co-occurrences) for the Genre Synergy card.
 *
 * Uses pre-aggregated `userRecord.animeGenreSynergyTotals` which is computed
 * at write time from the full completed list (before pruning).
 *
 * @source
 */
export function toTemplateAnimeGenreSynergy(
  userRecord: UserRecord,
): { name: string; count: number }[] {
  return buildTopPairsFromTotals(
    userRecord.animeGenreSynergyTotals,
    (a, b) => `${a} + ${b}`,
    10,
  );
}

/**
 * Builds a list of top studio co-occurrence pairs for the Studio Collaboration card.
 *
 * Uses pre-aggregated `userRecord.studioCollaborationTotals` which is computed
 * at write time from the full completed list.
 *
 * @source
 */
export function toTemplateStudioCollaboration(
  userRecord: UserRecord,
): { name: string; count: number }[] {
  return buildTopPairsFromTotals(
    userRecord.studioCollaborationTotals,
    (a, b) => `${a} + ${b}`,
    10,
  );
}

/**
 * Computes the Shannon entropy (normalized to 0-1) for a set of counts.
 * Used for diversity calculations.
 * @source
 */
function normalizedShannon(counts: number[]): number {
  const safeCounts = counts.filter((c) => c > 0);
  if (safeCounts.length === 0) return 0;

  const total = safeCounts.reduce((a, b) => a + b, 0);
  if (total === 0) return 0;

  const entropy = -safeCounts.reduce((sum, c) => {
    const p = c / total;
    return sum + (p > 0 ? p * Math.log(p) : 0);
  }, 0);

  const maxEntropy = Math.log(safeCounts.length);
  return maxEntropy > 0 ? entropy / maxEntropy : 0;
}

/**
 * Builds tag category distribution for anime/manga.
 * Groups tags by their category field and counts occurrences.
 * @source
 */
export function toTemplateTagCategoryDistribution(
  userRecord: UserRecord,
  mediaType: "anime" | "manga",
): { name: string; count: number }[] {
  const stats =
    mediaType === "anime"
      ? userRecord.stats?.User?.statistics?.anime
      : userRecord.stats?.User?.statistics?.manga;

  const tags = stats?.tags as
    | { tag: { name: string; category?: string }; count: number }[]
    | undefined;

  if (!Array.isArray(tags) || tags.length === 0) return [];

  const categoryGroups = tags.reduce(
    (acc, { tag, count }) => {
      const category = tag.category || "Uncategorized";
      acc[category] = (acc[category] || 0) + (count || 0);
      return acc;
    },
    {} as Record<string, number>,
  );

  return Object.entries(categoryGroups)
    .map(([name, count]) => ({ name, count }))
    .filter((x) => x.count > 0)
    .sort((a, b) => b.count - a.count);
}

/**
 * Computes tag diversity index using Shannon entropy.
 * Returns a score from 0-100 and top contributing categories.
 * @source
 */
export function toTemplateTagDiversity(
  userRecord: UserRecord,
  mediaType: "anime" | "manga",
): {
  diversityScore: number;
  distinctTags: number;
  topCategories: { name: string; count: number }[];
} {
  const stats =
    mediaType === "anime"
      ? userRecord.stats?.User?.statistics?.anime
      : userRecord.stats?.User?.statistics?.manga;

  const tags = stats?.tags as
    | { tag: { name: string; category?: string }; count: number }[]
    | undefined;

  if (!Array.isArray(tags) || tags.length === 0) {
    return { diversityScore: 0, distinctTags: 0, topCategories: [] };
  }

  const counts = tags.map((t) => Math.max(0, t.count));
  const diversityScore = Math.round(normalizedShannon(counts) * 100);
  const distinctTags = tags.filter((t) => t.count > 0).length;

  // Group by category for top contributors
  const categoryGroups = tags.reduce(
    (acc, { tag, count }) => {
      const category = tag.category || "Uncategorized";
      acc[category] = (acc[category] || 0) + (count || 0);
      return acc;
    },
    {} as Record<string, number>,
  );

  const topCategories = Object.entries(categoryGroups)
    .map(([name, count]) => ({ name, count }))
    .filter((x) => x.count > 0)
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);

  return { diversityScore, distinctTags, topCategories };
}

/**
 * Groups activity history by calendar season (Winter/Spring/Summer/Fall).
 * Returns activity counts per season based on when the user was active.
 * @source
 */
export function toTemplateSeasonalViewingPatterns(
  userRecord: UserRecord,
): { name: string; count: number }[] {
  const activityHistory = userRecord.stats?.User?.stats?.activityHistory as
    | ActivityHistoryItem[]
    | undefined;

  if (!Array.isArray(activityHistory) || activityHistory.length === 0) {
    return [];
  }

  const seasonGroups = { Winter: 0, Spring: 0, Summer: 0, Fall: 0 };

  for (const activity of activityHistory) {
    if (!activity.date || !activity.amount) continue;

    const date = new Date(activity.date * 1000);
    const month = date.getUTCMonth(); // 0-11

    if (month === 11 || month === 0 || month === 1) {
      seasonGroups.Winter += activity.amount;
    } else if (month >= 2 && month <= 4) {
      seasonGroups.Spring += activity.amount;
    } else if (month >= 5 && month <= 7) {
      seasonGroups.Summer += activity.amount;
    } else {
      seasonGroups.Fall += activity.amount;
    }
  }

  const order: (keyof typeof seasonGroups)[] = [
    "Winter",
    "Spring",
    "Summer",
    "Fall",
  ];
  return order.map((name) => ({ name, count: seasonGroups[name] }));
}
