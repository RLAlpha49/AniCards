/**
 * Info tooltip content for cards that need additional explanation.
 * Used to provide context about non-obvious metrics or calculations.
 * Supports LaTeX math formulas using $...$ for inline and $$...$$ for display math.
 * @source
 */
export const CARD_INFO_TOOLTIPS: Record<string, string> = {
  countryDiversity: String.raw`Normalized Shannon entropy (0–100): $$H' = \frac{-\sum_{i=1}^{k} p_i \ln p_i}{\ln k}$$ where $p_i$ is the share of titles in country $i$ and $k$ is the number of countries. Higher = more even country mix.`,

  genreDiversity: String.raw`Normalized Shannon entropy (0–100): $$H' = \frac{-\sum_{i=1}^{k} p_i \ln p_i}{\ln k}$$ where $p_i$ is the share of titles in genre $i$ and $k$ is the number of genres. Higher = more even genre spread.`,

  tagDiversity: String.raw`Normalized Shannon entropy (0–100): $$H' = \frac{-\sum_{i=1}^{k} p_i \ln p_i}{\ln k}$$ where $p_i$ is the share of titles with tag $i$ and $k$ is the number of tags. Higher = more even tag spread.`,

  animeScoreDistribution:
    "Shows how you rate your anime across score buckets. The cumulative view shows the percentage of titles at or below each score bucket.",

  mangaScoreDistribution:
    "Shows how you rate your manga across score buckets. The cumulative view shows the percentage of titles at or below each score bucket.",

  activityStreaks:
    "Consecutive days with AniList activity. Current = ongoing streak; Longest = your best record.",

  animeGenreSynergy:
    "Counts how often genre pairs co-occur in your COMPLETED anime. Each title contributes 1 to each unique pair. Shows the top pairs.",

  studioCollaboration:
    "Counts how often studio pairs appear together on your COMPLETED anime. Each title contributes 1 to each unique studio pair. Shows the top pairs.",

  releaseEraPreference:
    "From AniList release-year counts. 'Avg year' is count-weighted by titles, and 'Top decade' is the decade with the largest share.",

  startYearMomentum:
    "From AniList start-year counts. 'Peak' is the year you started the most titles, and 'Recent 5y' is the share started in the last 5 calendar years.",

  lengthPreference:
    "Analyzes your preference for short vs. long series based on episode counts for anime or chapter counts for manga.",

  seasonalViewingPatterns:
    "Groups your AniList activity history by UTC season (by month). Bars show each season's share of total activity amount.",

  animeSeasonalPreference:
    "Counts unique anime in CURRENT + COMPLETED by AniList's media season (WINTER/SPRING/SUMMER/FALL). Not your activity season.",

  tagCategoryDistribution:
    "Groups AniList tags into their categories and sums the tag counts per category. Shows the top categories for Anime vs Manga.",

  formatPreferenceOverview:
    "Compares your consumption across different media formats (TV, Movie, OVA, etc. for anime; Manga, Light Novel, etc. for manga).",

  animeSourceMaterialDistribution:
    "Counts unique anime from CURRENT + COMPLETED by source (manga, light novel, original, game, etc.) using AniList metadata.",
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
  if (!cardId) {
    return undefined;
  }
  return Object.hasOwn(CARD_INFO_TOOLTIPS, cardId)
    ? CARD_INFO_TOOLTIPS[cardId]
    : undefined;
}
