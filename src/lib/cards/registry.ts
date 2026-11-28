import type { UserDataPart } from "@/lib/types/records";

/**
 * One variation of a card. A bare string is the variation id; the object form
 * adds query parameters that variation needs (for example status colours).
 * @source
 */
export type VariationDef =
  string | Readonly<{ variation: string; extras?: Record<string, string> }>;

/** The six groups the examples page and generator sort cards into. @source */
export const CARD_GROUP_NAMES = [
  "Core Stats",
  "Anime Deep Dive",
  "Manga Deep Dive",
  "Activity & Engagement",
  "Library & Progress",
  "Advanced Analytics",
] as const;

/** A group name from {@link CARD_GROUP_NAMES}. @source */
export type CardGroupName = (typeof CARD_GROUP_NAMES)[number];

/**
 * Every fact the product knows about a card type, in one place.
 *
 * `label` is the short name printed in the rendered card header and used by
 * templates. `title` is the longer catalogue name shown on the examples page
 * and in the generator. The two intentionally differ for some cards.
 *
 * Icons stay out of this module because server modules read the registry; they
 * live in the catalogue at `lib/cards/catalogue.ts`, which only UI code imports.
 * @source
 */
export type CardEntry = Readonly<{
  id: string;
  label: string;
  title: string;
  description: string;
  group: CardGroupName;
  variations: readonly VariationDef[];
  dataParts: readonly UserDataPart[];
}>;

/**
 * The single source of truth for supported card types.
 *
 * Adding a card means adding one entry here, then giving it a renderer in
 * `lib/cards/render-svg.ts`. Every other table in the repo derives from this
 * list, so titles, groups, variations and data parts cannot drift apart.
 * @source
 */
export const CARD_REGISTRY = [
  {
    id: "animeStats",
    label: "Anime Stats",
    title: "Anime Statistics",
    description:
      "Totals for your anime list: count, episodes, minutes, and mean score",
    group: "Core Stats",
    variations: ["vertical", "default", "compact", "minimal"],
    dataParts: ["meta", "statistics"],
  },
  {
    id: "mangaStats",
    label: "Manga Stats",
    title: "Manga Statistics",
    description:
      "Totals for your manga list: count, chapters, volumes, and mean score",
    group: "Core Stats",
    variations: ["vertical", "default", "compact", "minimal"],
    dataParts: ["meta", "statistics"],
  },
  {
    id: "socialStats",
    label: "Social Stats",
    title: "Social Statistics",
    description: "Followers, following, threads, and reviews",
    group: "Core Stats",
    variations: ["default", "compact", "minimal", "badges"],
    dataParts: ["meta", "activity", "pages"],
  },
  {
    id: "profileOverview",
    label: "Profile Overview",
    title: "Profile Overview",
    description: "Your avatar, banner, and list totals",
    group: "Core Stats",
    variations: ["default", "compact", "minimal"],
    dataParts: ["meta", "statistics"],
  },
  {
    id: "animeMangaOverview",
    label: "Anime vs Manga Overview",
    title: "Anime vs Manga Overview",
    description: "Anime and manga totals side by side",
    group: "Core Stats",
    variations: ["default"],
    dataParts: ["meta", "statistics"],
  },
  {
    id: "animeGenres",
    label: "Anime Genres",
    title: "Anime Genres",
    description: "Time spent in each genre",
    group: "Anime Deep Dive",
    variations: ["default", "pie", "donut", "bar", "radar"],
    dataParts: ["meta", "statistics"],
  },
  {
    id: "animeTags",
    label: "Anime Tags",
    title: "Anime Tags",
    description: "Tags that appear most across your anime",
    group: "Anime Deep Dive",
    variations: ["default", "pie", "donut", "bar", "radar"],
    dataParts: ["meta", "statistics"],
  },
  {
    id: "animeVoiceActors",
    label: "Anime Voice Actors",
    title: "Voice Actors",
    description: "Voice actors with the most roles in your list",
    group: "Anime Deep Dive",
    variations: ["default", "pie", "donut", "bar"],
    dataParts: ["meta", "statistics", "favourites"],
  },
  {
    id: "animeStudios",
    label: "Anime Studios",
    title: "Animation Studios",
    description: "Studios behind the anime you watched",
    group: "Anime Deep Dive",
    variations: ["default", "pie", "donut", "bar"],
    dataParts: ["meta", "statistics", "favourites"],
  },
  {
    id: "animeStaff",
    label: "Anime Staff",
    title: "Anime Staff",
    description: "Staff credited on the anime you watched",
    group: "Anime Deep Dive",
    variations: ["default", "pie", "donut", "bar"],
    dataParts: ["meta", "statistics", "favourites"],
  },
  {
    id: "animeStatusDistribution",
    label: "Anime Statuses",
    title: "Anime Status Distribution",
    description: "How your anime splits across watching statuses",
    group: "Anime Deep Dive",
    variations: [
      "default",
      { variation: "pie", extras: { statusColors: "true" } },
      { variation: "bar", extras: { statusColors: "true" } },
      { variation: "donut", extras: { statusColors: "true" } },
    ],
    dataParts: ["meta", "statistics"],
  },
  {
    id: "animeFormatDistribution",
    label: "Anime Formats",
    title: "Anime Format Distribution",
    description: "How your anime splits across TV, movie, OVA, and the rest",
    group: "Anime Deep Dive",
    variations: ["default", "pie", "donut", "bar"],
    dataParts: ["meta", "statistics"],
  },
  {
    id: "animeSourceMaterialDistribution",
    label: "Anime Source Materials",
    title: "Anime Source Material Distribution",
    description:
      "Where your anime came from: manga, original, light novel, and the rest",
    group: "Anime Deep Dive",
    variations: ["default", "pie", "donut", "bar"],
    dataParts: ["meta", "current", "completed", "aggregates"],
  },
  {
    id: "animeSeasonalPreference",
    label: "Anime Seasons",
    title: "Anime Seasonal Preference",
    description: "Which seasons your anime aired in",
    group: "Anime Deep Dive",
    variations: ["default", "pie", "donut", "bar", "radar"],
    dataParts: ["meta", "current", "completed", "aggregates"],
  },
  {
    id: "animeCountry",
    label: "Anime Countries",
    title: "Anime Country Distribution",
    description: "Countries of origin across your anime",
    group: "Anime Deep Dive",
    variations: ["default", "pie", "donut", "bar"],
    dataParts: ["meta", "statistics"],
  },
  {
    id: "animeScoreDistribution",
    label: "Anime Scores",
    title: "Anime Score Distribution",
    description: "How many titles sit at each score",
    group: "Anime Deep Dive",
    variations: ["default", "horizontal", "cumulative"],
    dataParts: ["meta", "statistics"],
  },
  {
    id: "animeYearDistribution",
    label: "Anime Years",
    title: "Anime Year Distribution",
    description: "Release years across your anime",
    group: "Anime Deep Dive",
    variations: ["default", "horizontal"],
    dataParts: ["meta", "statistics"],
  },
  {
    id: "animeEpisodeLengthPreferences",
    label: "Episode Length Preferences",
    title: "Episode Length Preferences",
    description: "Episode lengths you watch most",
    group: "Anime Deep Dive",
    variations: ["default", "pie", "donut", "bar"],
    dataParts: ["meta", "statistics"],
  },
  {
    id: "animeGenreSynergy",
    label: "Genre Synergy",
    title: "Genre Synergy",
    description: "Genres that show up together in your list",
    group: "Anime Deep Dive",
    variations: ["default"],
    dataParts: ["meta", "aggregates"],
  },
  {
    id: "mangaGenres",
    label: "Manga Genres",
    title: "Manga Genres",
    description: "Time spent in each genre",
    group: "Manga Deep Dive",
    variations: ["default", "pie", "donut", "bar", "radar"],
    dataParts: ["meta", "statistics"],
  },
  {
    id: "mangaTags",
    label: "Manga Tags",
    title: "Manga Tags",
    description: "Tags that appear most across your manga",
    group: "Manga Deep Dive",
    variations: ["default", "pie", "donut", "bar", "radar"],
    dataParts: ["meta", "statistics"],
  },
  {
    id: "mangaStaff",
    label: "Manga Staff",
    title: "Manga Staff",
    description: "Staff credited on the manga you read",
    group: "Manga Deep Dive",
    variations: ["default", "pie", "donut", "bar"],
    dataParts: ["meta", "statistics", "favourites"],
  },
  {
    id: "mangaStatusDistribution",
    label: "Manga Statuses",
    title: "Manga Status Distribution",
    description: "How your manga splits across reading statuses",
    group: "Manga Deep Dive",
    variations: [
      "default",
      { variation: "pie", extras: { statusColors: "true" } },
      { variation: "bar", extras: { statusColors: "true" } },
      { variation: "donut", extras: { statusColors: "true" } },
    ],
    dataParts: ["meta", "statistics"],
  },
  {
    id: "mangaFormatDistribution",
    label: "Manga Formats",
    title: "Manga Format Distribution",
    description: "How your manga splits across manga, novel, and the rest",
    group: "Manga Deep Dive",
    variations: ["default", "pie", "donut", "bar"],
    dataParts: ["meta", "statistics"],
  },
  {
    id: "mangaCountry",
    label: "Manga Countries",
    title: "Manga Country Distribution",
    description: "Countries of origin across your manga",
    group: "Manga Deep Dive",
    variations: ["default", "pie", "donut", "bar"],
    dataParts: ["meta", "statistics"],
  },
  {
    id: "mangaScoreDistribution",
    label: "Manga Scores",
    title: "Manga Score Distribution",
    description: "How many titles sit at each score",
    group: "Manga Deep Dive",
    variations: ["default", "horizontal", "cumulative"],
    dataParts: ["meta", "statistics"],
  },
  {
    id: "mangaYearDistribution",
    label: "Manga Years",
    title: "Manga Year Distribution",
    description: "Release years across your manga",
    group: "Manga Deep Dive",
    variations: ["default", "horizontal"],
    dataParts: ["meta", "statistics"],
  },
  {
    id: "activityHeatmap",
    label: "Activity Heatmap",
    title: "Activity Heatmap",
    description: "A calendar of your daily activity",
    group: "Activity & Engagement",
    variations: ["default", "github", "fire"],
    dataParts: ["meta", "activity"],
  },
  {
    id: "recentActivitySummary",
    label: "Recent Activity Summary",
    title: "Recent Activity Summary",
    description: "A sparkline of activity over recent weeks",
    group: "Activity & Engagement",
    variations: ["default"],
    dataParts: ["meta", "activity"],
  },
  {
    id: "recentActivityFeed",
    label: "Recent Activity Feed",
    title: "Recent Activity Feed",
    description: "Your latest activity, newest first",
    group: "Activity & Engagement",
    variations: ["default"],
    dataParts: ["meta", "activity"],
  },
  {
    id: "activityStreaks",
    label: "Activity Streaks",
    title: "Activity Streaks",
    description: "Your current and longest streaks",
    group: "Activity & Engagement",
    variations: ["default"],
    dataParts: ["meta", "activity"],
  },
  {
    id: "topActivityDays",
    label: "Top Activity Days",
    title: "Top Activity Days",
    description: "The days you were most active",
    group: "Activity & Engagement",
    variations: ["default"],
    dataParts: ["meta", "activity"],
  },
  {
    id: "socialMilestones",
    label: "Social Milestones",
    title: "Social Milestones",
    description: "Milestones from your social activity",
    group: "Activity & Engagement",
    variations: ["default"],
    dataParts: ["meta", "pages"],
  },
  {
    id: "reviewStats",
    label: "Review Statistics",
    title: "Review Statistics",
    description: "Your reviews and the scores you gave them",
    group: "Activity & Engagement",
    variations: ["default"],
    dataParts: ["meta", "pages"],
  },
  {
    id: "seasonalViewingPatterns",
    label: "Seasonal Viewing Patterns",
    title: "Seasonal Viewing Patterns",
    description: "When you watch, by day of the week and month",
    group: "Activity & Engagement",
    variations: ["default"],
    dataParts: ["meta", "activity"],
  },
  {
    id: "favoritesSummary",
    label: "Favourites Summary",
    title: "Favourites Summary",
    description: "Counts of your favourite anime, manga, and characters",
    group: "Library & Progress",
    variations: ["default", "compact", "minimal"],
    dataParts: ["meta", "favourites"],
  },
  {
    id: "favoritesGrid",
    label: "Favourites Grid",
    title: "Favourites Grid",
    description: "A grid of your favourites, in the mix you choose",
    group: "Library & Progress",
    variations: ["anime", "manga", "characters", "staff", "studios", "mixed"],
    dataParts: ["meta", "favourites"],
  },
  {
    id: "statusCompletionOverview",
    label: "Status Completion Overview",
    title: "Status Completion Overview",
    description: "Anime and manga completion totals, together or split",
    group: "Library & Progress",
    variations: ["combined", "split"],
    dataParts: ["meta", "statistics"],
  },
  {
    id: "milestones",
    label: "Consumption Milestones",
    title: "Consumption Milestones",
    description: "Your biggest anime and manga milestones",
    group: "Library & Progress",
    variations: ["default"],
    dataParts: ["meta", "statistics"],
  },
  {
    id: "personalRecords",
    label: "Personal Records",
    title: "Personal Records",
    description: "Your highest and longest completed titles",
    group: "Library & Progress",
    variations: ["default"],
    dataParts: ["meta", "completed", "rewatched"],
  },
  {
    id: "planningBacklog",
    label: "Planning Backlog",
    title: "Planning Backlog",
    description: "What is sitting in your planning list",
    group: "Library & Progress",
    variations: ["default"],
    dataParts: ["meta", "planning"],
  },
  {
    id: "mostRewatched",
    label: "Most Rewatched/Reread",
    title: "Most Rewatched/Reread",
    description: "Titles you have revisited most",
    group: "Library & Progress",
    variations: ["default", "anime", "manga"],
    dataParts: ["meta", "rewatched"],
  },
  {
    id: "currentlyWatchingReading",
    label: "Currently Watching / Reading",
    title: "Currently Watching / Reading",
    description: "What you have in progress right now",
    group: "Library & Progress",
    variations: ["default", "anime", "manga"],
    dataParts: ["meta", "current"],
  },
  {
    id: "droppedMedia",
    label: "Dropped Media",
    title: "Dropped Media",
    description: "Titles you dropped, and where you stopped",
    group: "Library & Progress",
    variations: ["default"],
    dataParts: ["meta", "completed"],
  },
  {
    id: "scoreCompareAnimeManga",
    label: "Anime vs Manga Score Comparison",
    title: "Anime vs Manga Score Comparison",
    description: "Your scores in anime against your scores in manga",
    group: "Advanced Analytics",
    variations: ["default"],
    dataParts: ["meta", "statistics"],
  },
  {
    id: "countryDiversity",
    label: "Country Diversity",
    title: "Country Diversity",
    description: "How varied the countries are in each list",
    group: "Advanced Analytics",
    variations: ["default"],
    dataParts: ["meta", "statistics"],
  },
  {
    id: "genreDiversity",
    label: "Genre Diversity",
    title: "Genre Diversity",
    description: "How varied the genres are in each list",
    group: "Advanced Analytics",
    variations: ["default"],
    dataParts: ["meta", "statistics"],
  },
  {
    id: "formatPreferenceOverview",
    label: "Format Preference Overview",
    title: "Format Preference Overview",
    description: "Formats you pick in anime against manga",
    group: "Advanced Analytics",
    variations: ["default"],
    dataParts: ["meta", "statistics"],
  },
  {
    id: "releaseEraPreference",
    label: "Release Era Preference",
    title: "Release Era Preference",
    description: "Which release eras you consume most",
    group: "Advanced Analytics",
    variations: ["default"],
    dataParts: ["meta", "statistics"],
  },
  {
    id: "startYearMomentum",
    label: "Start-Year Momentum",
    title: "Start-Year Momentum",
    description: "How your start years differ between anime and manga",
    group: "Advanced Analytics",
    variations: ["default"],
    dataParts: ["meta", "statistics"],
  },
  {
    id: "lengthPreference",
    label: "Length Preference",
    title: "Length Preference",
    description: "Short series against long ones in each list",
    group: "Advanced Analytics",
    variations: ["default"],
    dataParts: ["meta", "statistics"],
  },
  {
    id: "tagCategoryDistribution",
    label: "Tag Category Distribution",
    title: "Tag Category Distribution",
    description: "Tag categories in anime against manga",
    group: "Advanced Analytics",
    variations: ["default"],
    dataParts: ["meta", "statistics"],
  },
  {
    id: "tagDiversity",
    label: "Tag Diversity",
    title: "Tag Diversity",
    description: "How varied the tags are in each list",
    group: "Advanced Analytics",
    variations: ["default"],
    dataParts: ["meta", "statistics"],
  },
  {
    id: "studioCollaboration",
    label: "Studio Collaboration",
    title: "Studio Collaboration",
    description: "Studios that keep working together in your list",
    group: "Advanced Analytics",
    variations: ["default"],
    dataParts: ["meta", "completed", "aggregates"],
  },
] as const satisfies readonly CardEntry[];

/** Identifier of any registered card. @source */
export type CardId = (typeof CARD_REGISTRY)[number]["id"];

/** Registry lookup by card id. @source */
export const CARD_BY_ID: ReadonlyMap<CardId, CardEntry> = new Map(
  CARD_REGISTRY.map((entry) => [entry.id, entry]),
);

/**
 * Returns whether a value names a registered card.
 * @param candidate - Value to test, for example an untrusted query parameter.
 * @source
 */
export function hasCardId(candidate: unknown): candidate is CardId {
  return typeof candidate === "string" && CARD_BY_ID.has(candidate as CardId);
}
