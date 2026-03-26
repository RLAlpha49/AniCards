import { colorPresets } from "@/components/stat-card-generator/constants";
import {
  buildCardUrlWithParams,
  DEFAULT_EXAMPLE_USER_ID,
  mapStoredConfigToCardUrlParams,
} from "@/lib/card-groups";
import {
  CARD_DIMENSIONS,
  type CardDimensions,
  getCardDimensions,
} from "@/lib/svg-templates/common/dimensions";
import type { StoredCardConfig } from "@/lib/types/records";
import type { SettingsSnapshot } from "@/lib/user-page-settings-io";
import { buildApiUrl } from "@/lib/utils";

import {
  DARK_PREVIEW_COLOR_PRESET,
  LIGHT_PREVIEW_COLOR_PRESET,
  type PreviewColorPreset,
  type ThemePreviewUrls,
} from "./preview-theme";

const DEFAULT_BORDER_COLOR = "#e4e2e2";
const DEFAULT_BORDER_RADIUS = 8;
const DEFAULT_ADVANCED_SETTINGS = {
  useStatusColors: true,
  showPiePercentages: true,
  showFavorites: true,
  gridCols: 3,
  gridRows: 3,
} as const;

const BASE_PREVIEW_URL = buildApiUrl("/card.svg");

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

export type PreviewVariationExtras = Record<string, string>;

export interface ThemeSettingsSnapshots {
  light: SettingsSnapshot;
  dark: SettingsSnapshot;
}

function clampGridDimension(value: unknown): number | undefined {
  if (typeof value !== "number" || !Number.isFinite(value)) return undefined;
  const normalized = Math.trunc(value);
  if (normalized < 1) return 1;
  if (normalized > 5) return 5;
  return normalized;
}

function applyPreviewExtras(
  candidate: Partial<StoredCardConfig>,
  extras?: PreviewVariationExtras,
) {
  if (!extras) {
    return candidate;
  }

  for (const [key, value] of Object.entries(extras)) {
    switch (key) {
      case "statusColors":
        candidate.useStatusColors = value === "true";
        break;
      case "colorPreset":
        candidate.colorPreset = value;
        break;
      case "titleColor":
        candidate.titleColor = value;
        break;
      case "backgroundColor":
        candidate.backgroundColor = value;
        break;
      case "textColor":
        candidate.textColor = value;
        break;
      case "circleColor":
        candidate.circleColor = value;
        break;
      case "borderColor":
        candidate.borderColor = value;
        break;
      case "borderRadius": {
        const parsed = Number.parseFloat(value);
        if (!Number.isNaN(parsed)) {
          candidate.borderRadius = parsed;
        }
        break;
      }
      case "showFavorites":
        candidate.showFavorites = value === "true";
        break;
      case "piePercentages":
        candidate.showPiePercentages = value === "true";
        break;
      case "gridCols": {
        const parsed = Number.parseInt(value, 10);
        if (!Number.isNaN(parsed)) {
          candidate.gridCols = parsed;
        }
        break;
      }
      case "gridRows": {
        const parsed = Number.parseInt(value, 10);
        if (!Number.isNaN(parsed)) {
          candidate.gridRows = parsed;
        }
        break;
      }
      default:
        break;
    }
  }

  return candidate;
}

export function buildCardPreviewUrl(params: {
  cardType: string;
  variation: string;
  colorPreset: PreviewColorPreset;
  extras?: PreviewVariationExtras;
}): string {
  const candidate = applyPreviewExtras(
    {
      cardName: params.cardType,
      variation: params.variation,
      colorPreset: params.colorPreset,
    },
    params.extras,
  );

  return buildCardUrlWithParams(
    mapStoredConfigToCardUrlParams(candidate, {
      userId: DEFAULT_EXAMPLE_USER_ID,
      includeColors: false,
    }),
    BASE_PREVIEW_URL,
  );
}

export function buildThemePreviewUrls(params: {
  cardType: string;
  variation: string;
  extras?: PreviewVariationExtras;
}): ThemePreviewUrls {
  return {
    light: buildCardPreviewUrl({
      ...params,
      colorPreset: LIGHT_PREVIEW_COLOR_PRESET,
    }),
    dark: buildCardPreviewUrl({
      ...params,
      colorPreset: DARK_PREVIEW_COLOR_PRESET,
    }),
  };
}

function buildPreviewSettingsSnapshot(params: {
  colorPreset: PreviewColorPreset;
  extras?: PreviewVariationExtras;
}): SettingsSnapshot {
  const candidate = applyPreviewExtras(
    { colorPreset: params.colorPreset },
    params.extras,
  );

  const resolvedColorPreset =
    typeof candidate.colorPreset === "string" &&
    candidate.colorPreset.length > 0
      ? candidate.colorPreset
      : "default";
  const presetColors =
    colorPresets[resolvedColorPreset]?.colors ?? colorPresets.default.colors;

  const hasExplicitColorOverrides =
    candidate.titleColor !== undefined ||
    candidate.backgroundColor !== undefined ||
    candidate.textColor !== undefined ||
    candidate.circleColor !== undefined;

  return {
    colorPreset: hasExplicitColorOverrides ? "custom" : resolvedColorPreset,
    colors: [
      candidate.titleColor ?? presetColors[0],
      candidate.backgroundColor ?? presetColors[1],
      candidate.textColor ?? presetColors[2],
      candidate.circleColor ?? presetColors[3],
    ],
    borderEnabled:
      typeof candidate.borderColor === "string" &&
      candidate.borderColor.trim().length > 0,
    borderColor: candidate.borderColor ?? DEFAULT_BORDER_COLOR,
    borderRadius:
      typeof candidate.borderRadius === "number"
        ? candidate.borderRadius
        : DEFAULT_BORDER_RADIUS,
    advancedSettings: {
      useStatusColors:
        candidate.useStatusColors ?? DEFAULT_ADVANCED_SETTINGS.useStatusColors,
      showPiePercentages:
        candidate.showPiePercentages ??
        DEFAULT_ADVANCED_SETTINGS.showPiePercentages,
      showFavorites:
        candidate.showFavorites ?? DEFAULT_ADVANCED_SETTINGS.showFavorites,
      gridCols:
        clampGridDimension(candidate.gridCols) ??
        DEFAULT_ADVANCED_SETTINGS.gridCols,
      gridRows:
        clampGridDimension(candidate.gridRows) ??
        DEFAULT_ADVANCED_SETTINGS.gridRows,
    },
  };
}

export function buildThemeSettingsSnapshots(params: {
  extras?: PreviewVariationExtras;
}): ThemeSettingsSnapshots {
  return {
    light: buildPreviewSettingsSnapshot({
      colorPreset: LIGHT_PREVIEW_COLOR_PRESET,
      extras: params.extras,
    }),
    dark: buildPreviewSettingsSnapshot({
      colorPreset: DARK_PREVIEW_COLOR_PRESET,
      extras: params.extras,
    }),
  };
}

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
