/**
 * Card previews shown on the home page, grouped by the filter tabs.
 *
 * Every entry maps to a card type the generator can build, so the collection
 * stays honest when the catalogue changes.
 *
 * @source
 */
export type ShowcaseCategory = "stats" | "analysis" | "social" | "deep-dive";

export type ShowcaseCard = {
  cardType: string;
  variation: string;
  title: string;
  note: string;
  category: ShowcaseCategory;
};

/** Filter tabs for the home card gallery. @source */
export const SHOWCASE_FILTERS: ReadonlyArray<{
  id: "all" | ShowcaseCategory;
  label: string;
}> = [
  { id: "all", label: "All cards" },
  { id: "stats", label: "Statistics" },
  { id: "analysis", label: "Analysis" },
  { id: "social", label: "Social" },
  { id: "deep-dive", label: "Deep dive" },
];

/** Eight cards covering the main families. @source */
export const SHOWCASE_CARDS: readonly ShowcaseCard[] = [
  {
    cardType: "animeStats",
    variation: "default",
    title: "Anime statistics",
    note: "Count, episodes, minutes watched, mean score",
    category: "stats",
  },
  {
    cardType: "mangaStats",
    variation: "default",
    title: "Manga statistics",
    note: "Chapters read, volumes read, mean score",
    category: "stats",
  },
  {
    cardType: "animeGenres",
    variation: "pie",
    title: "Genre distribution",
    note: "Your top genres as a pie chart",
    category: "analysis",
  },
  {
    cardType: "animeScoreDistribution",
    variation: "horizontal",
    title: "Score distribution",
    note: "Your ratings, grouped by score",
    category: "analysis",
  },
  {
    cardType: "animeStudios",
    variation: "donut",
    title: "Animation studios",
    note: "Which studios made what you watched",
    category: "deep-dive",
  },
  {
    cardType: "animeVoiceActors",
    variation: "default",
    title: "Voice actors",
    note: "The actors who appear most in your list",
    category: "deep-dive",
  },
  {
    cardType: "socialStats",
    variation: "default",
    title: "Social statistics",
    note: "Followers, following, threads, reviews",
    category: "social",
  },
  {
    cardType: "animeTags",
    variation: "bar",
    title: "Tag analysis",
    note: "Your most common anime tags",
    category: "analysis",
  },
];

/** Cards shown per page in the gallery. @source */
export const CARDS_PER_PAGE = 6;
