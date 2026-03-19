export interface CardDimensions {
  w: number;
  h: number;
}

export const CARD_DIMENSIONS = {
  socialStats: {
    default: { w: 280, h: 195 },
    compact: { w: 280, h: 160 },
    minimal: { w: 280, h: 130 },
    badges: { w: 280, h: 220 },
  },

  socialMilestones: {
    default: { w: 350, h: 270 },
  },

  mediaStats: {
    default: { w: 450, h: 195 },
    vertical: { w: 260, h: 350 },
    compact: { w: 300, h: 130 },
    minimal: { w: 220, h: 140 },
  },

  activityStreaks: {
    default: { w: 280, h: 160 },
  },
  recentActivitySummary: {
    default: { w: 280, h: 160 },
  },
  topActivityDays: {
    default: { w: 320, h: 180 },
  },

  distribution: {
    default: { w: 350, h: 260 },
    horizontal: { w: 320, h: 150 },
  },

  statusCompletionOverview: {
    combined: { w: 400, h: 150 },
    split: { w: 450, h: 220 },
  },
  milestones: {
    default: { w: 350, h: 180 },
  },
  personalRecords: {
    default: { w: 280, h: 260 },
  },
  planningBacklog: {
    default: { w: 350, h: 260 },
  },
  mostRewatched: {
    default: { w: 320, h: 220 },
    anime: { w: 330, h: 190 },
    manga: { w: 330, h: 190 },
  },
  currentlyWatchingReading: {
    default: { w: 420, h: 260 },
  },

  profileOverview: {
    default: { w: 300, h: 170 },
  },
  favoritesSummary: {
    default: { w: 350, h: 180 },
  },

  animeMangaOverview: {
    default: { w: 450, h: 220 },
  },
  scoreCompareAnimeManga: {
    default: { w: 450, h: 220 },
  },
  countryDiversity: {
    default: { w: 450, h: 220 },
  },
  genreDiversity: {
    default: { w: 450, h: 220 },
  },
  formatPreferenceOverview: {
    default: { w: 450, h: 220 },
  },
  releaseEraPreference: {
    default: { w: 450, h: 220 },
  },
  startYearMomentum: {
    default: { w: 450, h: 220 },
  },
  lengthPreference: {
    default: { w: 450, h: 220 },
  },

  extraStats: {
    default: { w: 280, h: 195 },
    pie: { w: 340, h: 195 },
    donut: { w: 340, h: 195 },
    bar: { w: 360, h: 195 },
    radar: { w: 450, h: 195 },
  },

  tagCategoryDistribution: {
    default: { w: 450, h: 220 },
  },
  tagDiversity: {
    default: { w: 450, h: 220 },
  },
  seasonalViewingPatterns: {
    default: { w: 350, h: 200 },
  },
  droppedMedia: {
    default: { w: 450, h: 220 },
  },
  reviewStats: {
    default: { w: 450, h: 220 },
  },
} as const satisfies Record<string, Record<string, CardDimensions>>;

/**
 * Get dimensions for a specific card type and variant.
 * Provides type-safe access to card dimensions with fallback.
 */
export function getCardDimensions(
  cardType: keyof typeof CARD_DIMENSIONS,
  variant: string = "default",
): CardDimensions {
  const cardDims = CARD_DIMENSIONS[cardType];
  if (!cardDims) {
    return { w: 400, h: 200 }; // Fallback
  }

  const variantDims = cardDims[variant as keyof typeof cardDims];
  if (!variantDims) {
    if ("default" in cardDims) {
      return cardDims.default;
    }

    // Non-default-only cards (e.g. combined/split) fall back to first variant.
    const first = Object.values(cardDims)[0];
    return first ?? { w: 400, h: 200 };
  }

  return variantDims;
}
