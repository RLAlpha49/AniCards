import type { CardType } from "@/lib/card-data/validation";
import type { UserDataPart } from "@/lib/server/user-data";

export const CARD_TYPE_TO_PARTS: Record<CardType, UserDataPart[]> = {
  animeStats: ["meta", "statistics"],
  mangaStats: ["meta", "statistics"],
  socialStats: ["meta", "activity", "pages"],
  socialMilestones: ["meta", "pages"],
  animeGenres: ["meta", "statistics"],
  animeTags: ["meta", "statistics"],
  animeVoiceActors: ["meta", "statistics", "favourites"],
  animeStudios: ["meta", "statistics", "favourites"],
  animeStaff: ["meta", "statistics", "favourites"],
  mangaGenres: ["meta", "statistics"],
  mangaTags: ["meta", "statistics"],
  mangaStaff: ["meta", "statistics", "favourites"],
  animeStatusDistribution: ["meta", "statistics"],
  mangaStatusDistribution: ["meta", "statistics"],
  animeFormatDistribution: ["meta", "statistics"],
  mangaFormatDistribution: ["meta", "statistics"],
  animeScoreDistribution: ["meta", "statistics"],
  mangaScoreDistribution: ["meta", "statistics"],
  animeYearDistribution: ["meta", "statistics"],
  mangaYearDistribution: ["meta", "statistics"],
  animeCountry: ["meta", "statistics"],
  mangaCountry: ["meta", "statistics"],
  animeSourceMaterialDistribution: ["meta", "current", "completed", "aggregates"],
  animeSeasonalPreference: ["meta", "current", "completed", "aggregates"],
  animeGenreSynergy: ["meta", "aggregates"],
  studioCollaboration: ["meta", "completed", "aggregates"],
  profileOverview: ["meta", "statistics"],
  favoritesSummary: ["meta", "favourites"],
  favoritesGrid: ["meta", "favourites"],
  activityHeatmap: ["meta", "activity"],
  recentActivitySummary: ["meta", "activity"],
  recentActivityFeed: ["meta", "activity"],
  activityStreaks: ["meta", "activity"],
  topActivityDays: ["meta", "activity"],
  statusCompletionOverview: ["meta", "statistics"],
  milestones: ["meta", "statistics"],
  personalRecords: ["meta", "completed", "rewatched"],
  planningBacklog: ["meta", "planning"],
  mostRewatched: ["meta", "rewatched"],
  currentlyWatchingReading: ["meta", "current"],
  animeMangaOverview: ["meta", "statistics"],
  scoreCompareAnimeManga: ["meta", "statistics"],
  countryDiversity: ["meta", "statistics"],
  genreDiversity: ["meta", "statistics"],
  formatPreferenceOverview: ["meta", "statistics"],
  releaseEraPreference: ["meta", "statistics"],
  startYearMomentum: ["meta", "statistics"],
  lengthPreference: ["meta", "statistics"],
  animeEpisodeLengthPreferences: ["meta", "statistics"],
  tagCategoryDistribution: ["meta", "statistics"],
  tagDiversity: ["meta", "statistics"],
  seasonalViewingPatterns: ["meta", "activity"],
  droppedMedia: ["meta", "completed"],
  reviewStats: ["meta", "pages"],
};

export function getPartsForCard(cardName: string): UserDataPart[] {
  const [baseCardType] = cardName.split("-");
  return (
    CARD_TYPE_TO_PARTS[baseCardType as CardType] || [
      "meta", "activity", "favourites", "statistics", "pages", "planning",
      "current", "rewatched", "completed",
    ]
  );
}