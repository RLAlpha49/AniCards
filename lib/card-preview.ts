import { colorPresets } from "@/components/stat-card-generator/constants";
import {
  buildCardUrlWithParams,
  DEFAULT_EXAMPLE_USER_ID,
  mapStoredConfigToCardUrlParams,
} from "@/lib/card-groups";
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

export { getPreviewCardDimensions } from "./card-preview-dimensions";
