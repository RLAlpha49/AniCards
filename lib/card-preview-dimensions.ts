import {
  CARD_DIMENSIONS,
  type CardDimensions,
  getCardDimensions,
} from "@/lib/svg-templates/common/dimensions";

const PREVIEW_DIMENSION_OVERRIDES: Partial<
  Record<string, Partial<Record<string, CardDimensions>>>
> = {
  animeCountry: {
    donut: { w: 280, h: 195 },
  },
  animeFormatDistribution: {
    default: { w: 280, h: 230 },
    pie: { w: 340, h: 230 },
    donut: { w: 340, h: 230 },
    bar: { w: 360, h: 236 },
  },
  animeGenres: {
    default: { w: 280, h: 205 },
    pie: { w: 340, h: 205 },
    donut: { w: 340, h: 205 },
    bar: { w: 360, h: 210 },
    radar: { w: 450, h: 220 },
  },
  animeGenreSynergy: {
    default: { w: 280, h: 330 },
  },
  animeScoreDistribution: {
    default: { w: 350, h: 271 },
    cumulative: { w: 350, h: 271 },
  },
  animeSeasonalPreference: {
    default: { w: 280, h: 205 },
    pie: { w: 340, h: 205 },
    donut: { w: 340, h: 205 },
    bar: { w: 360, h: 210 },
    radar: { w: 450, h: 220 },
  },
  animeSourceMaterialDistribution: {
    default: { w: 280, h: 255 },
    pie: { w: 340, h: 255 },
    donut: { w: 340, h: 255 },
    bar: { w: 360, h: 262 },
  },
  animeStaff: {
    default: { w: 280, h: 205 },
    pie: { w: 340, h: 205 },
    donut: { w: 340, h: 205 },
    bar: { w: 360, h: 210 },
  },
  animeStatusDistribution: {
    default: { w: 280, h: 205 },
    pie: { w: 340, h: 205 },
    donut: { w: 340, h: 205 },
    bar: { w: 360, h: 210 },
  },
  animeStudios: {
    default: { w: 280, h: 205 },
    pie: { w: 340, h: 205 },
    donut: { w: 340, h: 205 },
    bar: { w: 360, h: 210 },
  },
  animeTags: {
    default: { w: 280, h: 205 },
    pie: { w: 340, h: 205 },
    donut: { w: 340, h: 205 },
    bar: { w: 360, h: 210 },
    radar: { w: 450, h: 220 },
  },
  animeVoiceActors: {
    default: { w: 280, h: 205 },
    pie: { w: 340, h: 205 },
    donut: { w: 340, h: 205 },
    bar: { w: 360, h: 210 },
  },
  animeYearDistribution: {
    default: { w: 350, h: 523 },
    horizontal: { w: 458, h: 150 },
  },
  countryDiversity: {
    default: { w: 450, h: 230 },
  },
  currentlyWatchingReading: {
    default: { w: 420, h: 352 },
    manga: { w: 420, h: 352 },
  },
  droppedMedia: {
    default: { w: 450, h: 244 },
  },
  formatPreferenceOverview: {
    default: { w: 450, h: 262 },
  },
  genreDiversity: {
    default: { w: 450, h: 320 },
  },
  lengthPreference: {
    default: { w: 450, h: 280 },
  },
  mangaCountry: {
    donut: { w: 280, h: 195 },
  },
  mangaGenres: {
    default: { w: 280, h: 205 },
    pie: { w: 340, h: 205 },
    donut: { w: 340, h: 205 },
    bar: { w: 360, h: 210 },
    radar: { w: 450, h: 220 },
  },
  mangaScoreDistribution: {
    default: { w: 350, h: 271 },
    cumulative: { w: 350, h: 271 },
  },
  mangaStaff: {
    default: { w: 280, h: 205 },
    pie: { w: 340, h: 205 },
    donut: { w: 340, h: 205 },
    bar: { w: 360, h: 210 },
  },
  mangaStatusDistribution: {
    default: { w: 280, h: 205 },
    pie: { w: 340, h: 205 },
    donut: { w: 340, h: 205 },
    bar: { w: 360, h: 210 },
  },
  mangaTags: {
    default: { w: 280, h: 205 },
    pie: { w: 340, h: 205 },
    donut: { w: 340, h: 205 },
    bar: { w: 360, h: 210 },
    radar: { w: 450, h: 220 },
  },
  mangaYearDistribution: {
    default: { w: 350, h: 433 },
    horizontal: { w: 458, h: 150 },
  },
  milestones: {
    default: { w: 350, h: 274 },
  },
  mostRewatched: {
    anime: { w: 330, h: 220 },
    manga: { w: 330, h: 220 },
  },
  personalRecords: {
    default: { w: 280, h: 280 },
  },
  releaseEraPreference: {
    default: { w: 450, h: 230 },
  },
  scoreCompareAnimeManga: {
    default: { w: 450, h: 298 },
  },
  startYearMomentum: {
    default: { w: 450, h: 302 },
  },
  studioCollaboration: {
    default: { w: 280, h: 330 },
  },
  tagCategoryDistribution: {
    default: { w: 450, h: 298 },
  },
  tagDiversity: {
    default: { w: 450, h: 244 },
  },
};

const MEDIA_STATS_CARD_TYPES = new Set(["animeStats", "mangaStats"]);
const DISTRIBUTION_CARD_TYPES = new Set([
  "animeScoreDistribution",
  "mangaScoreDistribution",
  "animeYearDistribution",
  "mangaYearDistribution",
]);
const EXTRA_STATS_CARD_TYPES = new Set([
  "animeGenres",
  "animeTags",
  "animeVoiceActors",
  "animeStudios",
  "animeStaff",
  "animeStatusDistribution",
  "animeFormatDistribution",
  "animeCountry",
  "animeSourceMaterialDistribution",
  "animeSeasonalPreference",
  "animeEpisodeLengthPreferences",
  "animeGenreSynergy",
  "mangaGenres",
  "mangaTags",
  "mangaStaff",
  "mangaStatusDistribution",
  "mangaFormatDistribution",
  "mangaCountry",
  "studioCollaboration",
]);

export function getPreviewCardDimensions(
  cardType: string,
  variation: string,
): CardDimensions {
  const override = PREVIEW_DIMENSION_OVERRIDES[cardType]?.[variation];
  if (override) {
    return override;
  }

  if (cardType in CARD_DIMENSIONS) {
    return getCardDimensions(
      cardType as keyof typeof CARD_DIMENSIONS,
      variation,
    );
  }

  if (MEDIA_STATS_CARD_TYPES.has(cardType)) {
    return getCardDimensions("mediaStats", variation);
  }

  if (DISTRIBUTION_CARD_TYPES.has(cardType)) {
    return getCardDimensions("distribution", variation);
  }

  if (EXTRA_STATS_CARD_TYPES.has(cardType)) {
    return getCardDimensions("extraStats", variation);
  }

  return { w: 400, h: 200 };
}
