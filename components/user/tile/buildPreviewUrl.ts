import type {
  CardEditorConfig,
  CardAdvancedSettings,
} from "@/lib/stores/user-page-editor";
import type { ColorValue } from "@/lib/types/card";
import {
  mapStoredConfigToCardUrlParams,
  buildCardUrlWithParams,
} from "@/lib/card-groups";

interface BuildPreviewUrlArgs {
  userId: string | null | undefined;
  cardId: string;
  config: CardEditorConfig;
  urlColorPreset?: string;
  effectiveColors: ColorValue[];
  effectiveBorderColor?: string;
  effectiveBorderRadius?: number;
  globalAdvancedSettings: CardAdvancedSettings;
}

export function buildPreviewUrl({
  userId,
  cardId,
  config,
  urlColorPreset,
  effectiveColors,
  effectiveBorderColor,
  effectiveBorderRadius,
  globalAdvancedSettings,
}: Readonly<BuildPreviewUrlArgs>): string | null {
  if (!userId) return null;

  // Advanced settings should only be read from per-card overrides when the
  // card is explicitly using custom settings. Otherwise, cards inherit the
  // global advanced settings.
  const useCardAdvancedOverrides = config.colorOverride.useCustomSettings;

  const resolveAdvancedSetting = <K extends keyof CardAdvancedSettings>(
    key: K,
  ): CardAdvancedSettings[K] =>
    useCardAdvancedOverrides
      ? (config.advancedSettings[key] ?? globalAdvancedSettings[key])
      : globalAdvancedSettings[key];

  // effectiveColors order: [titleColor, backgroundColor, textColor, circleColor]
  const urlParams = mapStoredConfigToCardUrlParams(
    {
      cardName: cardId,
      variation: config.variant,
      colorPreset: urlColorPreset,
      titleColor: effectiveColors[0],
      backgroundColor: effectiveColors[1],
      textColor: effectiveColors[2],
      circleColor: effectiveColors[3],
      borderColor: effectiveBorderColor,
      borderRadius: effectiveBorderRadius,
      useStatusColors: resolveAdvancedSetting("useStatusColors"),
      showPiePercentages: resolveAdvancedSetting("showPiePercentages"),
      showFavorites: resolveAdvancedSetting("showFavorites"),
      gridCols: resolveAdvancedSetting("gridCols"),
      gridRows: resolveAdvancedSetting("gridRows"),
    },
    {
      userId,
      includeColors: true,
      defaultToCustomPreset: false,
      allowPresetColorOverrides: false,
    },
  );

  return buildCardUrlWithParams(urlParams);
}
