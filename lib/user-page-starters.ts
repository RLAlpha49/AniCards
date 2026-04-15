import { colorPresets } from "@/components/stat-card-generator/constants";
import { getDefaultCardVariation, statCardTypes } from "@/lib/card-types";
import type { GlobalCardSettings, StoredCardConfig } from "@/lib/types/records";
import type { SettingsSnapshot } from "@/lib/user-page-settings-io";
import { DEFAULT_CARD_BORDER_RADIUS } from "@/lib/utils";

const DEFAULT_STARTER_ADVANCED_SETTINGS = {
  useStatusColors: true,
  showPiePercentages: true,
  showFavorites: true,
  gridCols: 3,
  gridRows: 3,
} as const;

const DEFAULT_BORDER_COLOR = "#e4e2e2";

const NEW_USER_STARTER_CARD_IDS = new Set([
  "animeStats",
  "mangaStats",
  "socialStats",
  "profileOverview",
  "favoritesSummary",
  "favoritesGrid",
  "recentActivitySummary",
  "statusCompletionOverview",
]);

const NEW_USER_STARTER_VARIANTS: Partial<Record<string, string>> = {
  favoritesGrid: "mixed",
};

function buildPresetSnapshot(colorPreset: string): SettingsSnapshot {
  const colors =
    colorPresets[colorPreset]?.colors ?? colorPresets.default.colors;

  return {
    colorPreset,
    colors: [colors[0], colors[1], colors[2], colors[3]],
    borderEnabled: false,
    borderColor: DEFAULT_BORDER_COLOR,
    borderRadius: DEFAULT_CARD_BORDER_RADIUS,
    advancedSettings: { ...DEFAULT_STARTER_ADVANCED_SETTINGS },
  };
}

export interface EditorStarterStyle {
  id: string;
  name: string;
  intentLabel: string;
  description: string;
  snapshot: SettingsSnapshot;
}

export const EDITOR_STARTER_STYLES: readonly EditorStarterStyle[] = [
  {
    id: "starter:anicards-dark",
    name: "AniCards Dark",
    intentLabel: "Gallery match",
    description: "Matches the dark gallery previews.",
    snapshot: buildPresetSnapshot("anicardsDarkGradient"),
  },
  {
    id: "starter:anicards-light",
    name: "AniCards Light",
    intentLabel: "Bright + clean",
    description: "A bright, clean version of the house style.",
    snapshot: buildPresetSnapshot("anicardsLightGradient"),
  },
  {
    id: "starter:aurora-night",
    name: "Aurora Night",
    intentLabel: "High contrast",
    description: "A vivid alternative for users who want more contrast.",
    snapshot: buildPresetSnapshot("arcticAurora"),
  },
] as const;

export const NEW_USER_STARTER_GLOBAL_SETTINGS: GlobalCardSettings = {
  colorPreset: "default",
  borderEnabled: false,
  useStatusColors: DEFAULT_STARTER_ADVANCED_SETTINGS.useStatusColors,
  showPiePercentages: DEFAULT_STARTER_ADVANCED_SETTINGS.showPiePercentages,
  showFavorites: DEFAULT_STARTER_ADVANCED_SETTINGS.showFavorites,
  gridCols: DEFAULT_STARTER_ADVANCED_SETTINGS.gridCols,
  gridRows: DEFAULT_STARTER_ADVANCED_SETTINGS.gridRows,
};

export function buildNewUserStarterCardsSnapshot(): StoredCardConfig[] {
  return statCardTypes.map((cardType) => ({
    cardName: cardType.id,
    disabled: NEW_USER_STARTER_CARD_IDS.has(cardType.id) ? undefined : true,
    variation:
      NEW_USER_STARTER_VARIANTS[cardType.id] ??
      getDefaultCardVariation(cardType.id),
    colorPreset: "default",
  }));
}
