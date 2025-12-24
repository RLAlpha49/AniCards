/**
 * Info tooltip content for cards that need additional explanation.
 * Used to provide context about non-obvious metrics or calculations.
 * Supports LaTeX math formulas using $...$ for inline and $$...$$ for display math.
 * @source
 */
export const CARD_INFO_TOOLTIPS: Record<string, string> = {
  // Diversity cards - explain the Shannon diversity calculation with formulas
  countryDiversity: String.raw`Diversity is calculated using normalized Shannon entropy: $$H' = \frac{-\sum_{i=1}^{k} p_i \ln p_i}{\ln k}$$ where $p_i = c_i / T$ is the proportion of titles from country $i$, $c_i$ is the count for that country, $T$ is the total count, and $k$ is the number of countries. 100% means perfectly even distribution.`,

  genreDiversity: String.raw`Diversity is calculated using normalized Shannon entropy: $$H' = \frac{-\sum_{i=1}^{k} p_i \ln p_i}{\ln k}$$ where $p_i$ is the proportion of watch/read time in genre $i$, and $k$ is the number of genres. 100% means perfectly even distribution across all genres.`,

  tagDiversity: String.raw`Diversity is calculated using normalized Shannon entropy: $$H' = \frac{-\sum_{i=1}^{k} p_i \ln p_i}{\ln k}$$ where $p_i$ is the proportion of media with tag $i$, and $k$ is the number of tags. 100% means perfectly even distribution across all tags.`,

  // Score distribution cards
  animeScoreDistribution:
    "Shows how you rate your anime across the 1-10 scale. The cumulative view shows the percentage of titles at or below each score.",

  mangaScoreDistribution:
    "Shows how you rate your manga across the 1-10 scale. The cumulative view shows the percentage of titles at or below each score.",

  // Activity cards
  activityHeatmap:
    "Visualizes your daily activity over the past year. Darker colors indicate more activity on that day.",

  activityStreaks:
    "Tracks consecutive days of activity on AniList. Current streak shows ongoing activity, while longest streak is your all-time record.",

  // Social cards
  socialMilestones:
    "Displays follower milestones and social achievements on AniList.",

  // Status distribution cards
  animeStatusDistribution:
    "Shows how your anime list is distributed across watching, completed, paused, dropped, and planning statuses.",

  mangaStatusDistribution:
    "Shows how your manga list is distributed across reading, completed, paused, dropped, and planning statuses.",

  // Synergy and preference cards
  animeGenreSynergy:
    "Identifies genre combinations that frequently appear together in your watched anime, revealing your preferred genre pairings.",

  releaseEraPreference:
    "Analyzes which decades or time periods your anime/manga come from, showing whether you prefer classic or modern titles.",

  startYearMomentum:
    "Shows when you started watching/reading titles compared to their release dates, indicating whether you watch new releases or explore older catalogs.",

  lengthPreference:
    "Analyzes your preference for short vs. long series based on episode counts for anime or chapter counts for manga.",

  seasonalViewingPatterns:
    "Shows which seasons (Winter, Spring, Summer, Fall) you tend to start watching new anime, based on your list history.",

  // Format and source cards
  formatPreferenceOverview:
    "Compares your consumption across different media formats (TV, Movie, OVA, etc. for anime; Manga, Light Novel, etc. for manga).",

  animeSourceMaterialDistribution:
    "Shows the original source material types (manga, light novel, original, game, etc.) of anime in your list.",
};

/**
 * Info tooltip explaining what disabling a card does.
 * @source
 */
export const DISABLED_CARD_INFO =
  "Disabling a card hides it from your dashboard. The card URL remains accessible, making this useful for filtering out cards you don't plan to use.";

/**
 * Get the info tooltip content for a specific card type.
 * @param cardId - The card type identifier
 * @returns The tooltip content if available, undefined otherwise
 * @source
 */
export function getCardInfoTooltip(cardId: string): string | undefined {
  return CARD_INFO_TOOLTIPS[cardId];
}

/**
 * Check if a card type has info tooltip content.
 * @param cardId - The card type identifier
 * @returns True if the card has tooltip content
 * @source
 */
export function hasCardInfoTooltip(cardId: string): boolean {
  return cardId in CARD_INFO_TOOLTIPS;
}
