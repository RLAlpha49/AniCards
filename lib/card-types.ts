/**
 * Authoritative catalog of supported card ids, groupings, and UI variants.
 *
 * The editor and server-side generation both depend on these identifiers staying
 * aligned, so the metadata lives in one registry instead of being duplicated
 * across forms, menus, and card dispatch code.
 */
const pieBarVariations = [
  { id: "default", label: "Default" },
  { id: "pie", label: "Pie Chart" },
  { id: "donut", label: "Donut Chart" },
  { id: "bar", label: "Bar Chart" },
];

const genreTagDistributionVariations = [
  ...pieBarVariations,
  { id: "radar", label: "Radar Chart" },
];

const statusDistributionVariations = pieBarVariations;

const defaultOnlyVariations = [{ id: "default", label: "Default" }];

const scoreDistributionVariations = [
  { id: "default", label: "Default" },
  { id: "horizontal", label: "Horizontal" },
  { id: "cumulative", label: "Cumulative" },
];

const yearDistributionVariations = [
  { id: "default", label: "Default" },
  { id: "horizontal", label: "Horizontal" },
];

const mainStatsVariations = [
  { id: "default", label: "Default" },
  { id: "vertical", label: "Vertical" },
  { id: "compact", label: "Compact" },
  { id: "minimal", label: "Minimal" },
];

const socialStatsVariations = [
  { id: "default", label: "Default" },
  { id: "compact", label: "Compact" },
  { id: "minimal", label: "Minimal" },
  { id: "badges", label: "Badges" },
];

const socialCommunityVariations = [{ id: "default", label: "Default" }];

const profileMainVariations = [
  { id: "default", label: "Default" },
  { id: "compact", label: "Compact" },
  { id: "minimal", label: "Minimal" },
];

const favoritesGridVariations = [
  { id: "anime", label: "Anime Grid" },
  { id: "manga", label: "Manga Grid" },
  { id: "characters", label: "Character Grid" },
  { id: "staff", label: "Staff Grid" },
  { id: "studios", label: "Studios Grid" },
  { id: "mixed", label: "Mixed Favourites" },
];

const activityCompactVariations = [{ id: "default", label: "Default" }];

const activityFullVariations = [{ id: "default", label: "Default" }];

const createCardType = (
  id: string,
  group: string,
  label: string,
  variations: typeof pieBarVariations,
) => ({
  id,
  group,
  label,
  variations,
});

const getAnimeBreakdownVariations = (cardId: string) => {
  if (cardId.endsWith("StatusDistribution"))
    return statusDistributionVariations;
  if (cardId === "animeGenreSynergy") return defaultOnlyVariations;
  if (
    cardId === "animeGenres" ||
    cardId === "animeTags" ||
    cardId === "animeSeasonalPreference"
  ) {
    return genreTagDistributionVariations;
  }
  return pieBarVariations;
};

const getMangaBreakdownVariations = (cardId: string) => {
  if (cardId.endsWith("StatusDistribution"))
    return statusDistributionVariations;
  if (cardId === "mangaGenres" || cardId === "mangaTags") {
    return genreTagDistributionVariations;
  }
  return pieBarVariations;
};

const animeBreakdownCards = [
  { id: "animeGenres", label: "Anime Genres" },
  { id: "animeTags", label: "Anime Tags" },
  { id: "animeVoiceActors", label: "Anime Voice Actors" },
  { id: "animeStudios", label: "Anime Studios" },
  { id: "animeStaff", label: "Anime Staff" },
  {
    id: "animeStatusDistribution",
    label: "Anime Status Distribution",
  },
  { id: "animeFormatDistribution", label: "Anime Format Distribution" },
  {
    id: "animeSourceMaterialDistribution",
    label: "Anime Source Material Distribution",
  },
  {
    id: "animeSeasonalPreference",
    label: "Anime Seasonal Preference",
  },
  {
    id: "animeEpisodeLengthPreferences",
    label: "Episode Length Preferences",
  },
  {
    id: "animeGenreSynergy",
    label: "Genre Synergy",
  },
  { id: "animeCountry", label: "Anime Country" },
];

const mangaBreakdownCards = [
  { id: "mangaGenres", label: "Manga Genres" },
  { id: "mangaTags", label: "Manga Tags" },
  { id: "mangaStaff", label: "Manga Staff" },
  {
    id: "mangaStatusDistribution",
    label: "Manga Status Distribution",
  },
  { id: "mangaFormatDistribution", label: "Manga Format Distribution" },
  { id: "mangaCountry", label: "Manga Country" },
];

const activityCards = [
  {
    id: "recentActivitySummary",
    label: "Recent Activity Summary",
    variations: activityFullVariations,
  },
  {
    id: "activityStreaks",
    label: "Activity Streaks & Peaks",
    variations: activityFullVariations,
  },
  {
    id: "topActivityDays",
    label: "Top Activity Days",
    variations: activityCompactVariations,
  },
];

const statusCompletionVariations = [
  { id: "combined", label: "Combined" },
  { id: "split", label: "Split (Anime/Manga)" },
];

const milestonesVariations = [{ id: "default", label: "Default" }];

const personalRecordsVariations = [{ id: "default", label: "Default" }];

const planningBacklogVariations = [{ id: "default", label: "Default" }];

const mostRewatchedVariations = [
  { id: "default", label: "Default (All)" },
  { id: "anime", label: "Anime Only" },
  { id: "manga", label: "Manga Only" },
];

const currentlyWatchingReadingVariations = [
  { id: "default", label: "Default (Anime + Manga)" },
  { id: "anime", label: "Anime Only" },
  { id: "manga", label: "Manga Only" },
];

const completionProgressCards = [
  {
    id: "statusCompletionOverview",
    label: "Status Completion Overview",
    variations: statusCompletionVariations,
  },
  {
    id: "milestones",
    label: "Consumption Milestones",
    variations: milestonesVariations,
  },
  {
    id: "personalRecords",
    label: "Personal Records",
    variations: personalRecordsVariations,
  },
  {
    id: "planningBacklog",
    label: "Planning Backlog",
    variations: planningBacklogVariations,
  },
  {
    id: "mostRewatched",
    label: "Most Rewatched/Reread Titles",
    variations: mostRewatchedVariations,
  },
  {
    id: "currentlyWatchingReading",
    label: "Currently Watching / Reading",
    variations: currentlyWatchingReadingVariations,
  },
];

const comparativeDefaultVariations = [{ id: "default", label: "Default" }];

const userAnalyticsDefaultVariations = [{ id: "default", label: "Default" }];

const studioDefaultVariations = [{ id: "default", label: "Default" }];

export const statCardTypes = [
  createCardType(
    "animeStats",
    "Core Stats",
    "Anime Stats",
    mainStatsVariations,
  ),
  createCardType(
    "mangaStats",
    "Core Stats",
    "Manga Stats",
    mainStatsVariations,
  ),
  createCardType(
    "socialStats",
    "Core Stats",
    "Social Stats",
    socialStatsVariations,
  ),
  createCardType(
    "profileOverview",
    "Core Stats",
    "Profile Overview",
    defaultOnlyVariations,
  ),
  createCardType(
    "animeMangaOverview",
    "Core Stats",
    "Anime vs Manga Overview",
    comparativeDefaultVariations,
  ),

  ...animeBreakdownCards.map((card) =>
    createCardType(
      card.id,
      "Anime Deep Dive",
      card.label,
      getAnimeBreakdownVariations(card.id),
    ),
  ),
  createCardType(
    "studioCollaboration",
    "Anime Deep Dive",
    "Studio Collaboration",
    studioDefaultVariations,
  ),
  createCardType(
    "animeScoreDistribution",
    "Anime Deep Dive",
    "Anime Score Distribution",
    scoreDistributionVariations,
  ),
  createCardType(
    "animeYearDistribution",
    "Anime Deep Dive",
    "Anime Year Distribution",
    yearDistributionVariations,
  ),

  ...mangaBreakdownCards.map((card) =>
    createCardType(
      card.id,
      "Manga Deep Dive",
      card.label,
      getMangaBreakdownVariations(card.id),
    ),
  ),
  createCardType(
    "mangaScoreDistribution",
    "Manga Deep Dive",
    "Manga Score Distribution",
    scoreDistributionVariations,
  ),
  createCardType(
    "mangaYearDistribution",
    "Manga Deep Dive",
    "Manga Year Distribution",
    yearDistributionVariations,
  ),

  ...activityCards.map((card) =>
    createCardType(
      card.id,
      "Activity & Engagement",
      card.label,
      card.variations,
    ),
  ),
  createCardType(
    "socialMilestones",
    "Activity & Engagement",
    "Social Milestones",
    socialCommunityVariations,
  ),
  createCardType(
    "reviewStats",
    "Activity & Engagement",
    "Review Statistics",
    userAnalyticsDefaultVariations,
  ),
  createCardType(
    "seasonalViewingPatterns",
    "Activity & Engagement",
    "Seasonal Viewing Patterns",
    userAnalyticsDefaultVariations,
  ),

  createCardType(
    "favoritesSummary",
    "Library & Progress",
    "Favourites Summary",
    profileMainVariations,
  ),
  createCardType(
    "favoritesGrid",
    "Library & Progress",
    "Favourites Grid",
    favoritesGridVariations,
  ),
  ...completionProgressCards.map((card) =>
    createCardType(card.id, "Library & Progress", card.label, card.variations),
  ),
  createCardType(
    "droppedMedia",
    "Library & Progress",
    "Dropped Media",
    userAnalyticsDefaultVariations,
  ),

  createCardType(
    "scoreCompareAnimeManga",
    "Advanced Analytics",
    "Anime vs Manga Score Comparison",
    comparativeDefaultVariations,
  ),
  createCardType(
    "countryDiversity",
    "Advanced Analytics",
    "Country Diversity",
    comparativeDefaultVariations,
  ),
  createCardType(
    "genreDiversity",
    "Advanced Analytics",
    "Genre Diversity",
    comparativeDefaultVariations,
  ),
  createCardType(
    "formatPreferenceOverview",
    "Advanced Analytics",
    "Format Preference Overview",
    comparativeDefaultVariations,
  ),
  createCardType(
    "releaseEraPreference",
    "Advanced Analytics",
    "Release Era Preference",
    comparativeDefaultVariations,
  ),
  createCardType(
    "startYearMomentum",
    "Advanced Analytics",
    "Start-Year Momentum",
    comparativeDefaultVariations,
  ),
  createCardType(
    "lengthPreference",
    "Advanced Analytics",
    "Length Preference",
    comparativeDefaultVariations,
  ),
  createCardType(
    "tagCategoryDistribution",
    "Advanced Analytics",
    "Tag Category Distribution",
    userAnalyticsDefaultVariations,
  ),
  createCardType(
    "tagDiversity",
    "Advanced Analytics",
    "Tag Diversity",
    userAnalyticsDefaultVariations,
  ),
];
