/**
 * Variant tooltip content to explain differences between variants.
 *
 * Keep these short and practical; they show in tight UI tooltips.
 * @source
 */

const GENERIC_VARIANT_TOOLTIPS: Record<string, string> = {
  default: "Standard layout.",
  vertical: "Stacks content vertically; best when space is narrow.",
  compact: "More dense layout with reduced padding.",
  minimal: "Simplified layout with fewer decorative elements.",

  badges: "Shows social stats as compact badges.",

  pie: "Pie chart: part-to-whole at a glance.",
  donut: "Donut chart: pie variant with a center cutout.",
  bar: "Bar chart: easier to compare values precisely.",
  radar: "Radar chart: compares multiple categories on one shape.",

  horizontal: "Horizontal layout; useful for wide containers.",
  cumulative:
    "Cumulative view: shows running totals / percent-at-or-below buckets.",

  anime: "Anime-only view.",
  manga: "Manga-only view.",
  characters: "Characters-only view.",
  staff: "Staff-only view.",
  studios: "Studios-only view.",
  mixed: "Mixed view across categories.",

  combined: "Combined view: merges Anime and Manga into one summary.",
  split: "Split view: shows Anime and Manga separately.",

  github: "GitHub-style social stats variant.",
  fire: "Highlights streak-style metrics.",
};

// Optional per-card overrides when a variant meaning differs.
const CARD_VARIANT_TOOLTIPS: Record<string, Record<string, string>> = {
  favoritesGrid: {
    anime: "Grid of your favourite anime.",
    manga: "Grid of your favourite manga.",
    characters: "Grid of your favourite characters.",
    staff: "Grid of your favourite staff.",
    studios: "Grid of your favourite studios.",
    mixed: "Grid mixing favourites across categories.",
  },
  animeScoreDistribution: {
    cumulative:
      "Cumulative: percentage of titles at or below each score bucket.",
  },
  mangaScoreDistribution: {
    cumulative:
      "Cumulative: percentage of titles at or below each score bucket.",
  },
};

/**
 * Returns a tooltip explaining the given variant.
 *
 * @param cardId - Card type identifier (used for overrides)
 * @param variantId - Variant identifier
 */
export function getCardVariantTooltip(
  cardId: string,
  variantId: string,
): string | null {
  if (!variantId) return null;
  const byCard = CARD_VARIANT_TOOLTIPS[cardId];
  if (byCard && Object.hasOwn(byCard, variantId)) {
    return byCard[variantId] ?? null;
  }

  return Object.hasOwn(GENERIC_VARIANT_TOOLTIPS, variantId)
    ? GENERIC_VARIANT_TOOLTIPS[variantId]
    : null;
}
