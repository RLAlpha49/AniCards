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
      useStatusColors:
        config.advancedSettings.useStatusColors ??
        globalAdvancedSettings.useStatusColors,
      showPiePercentages:
        config.advancedSettings.showPiePercentages ??
        globalAdvancedSettings.showPiePercentages,
      showFavorites:
        config.advancedSettings.showFavorites ??
        globalAdvancedSettings.showFavorites,
      gridCols:
        config.advancedSettings.gridCols ?? globalAdvancedSettings.gridCols,
      gridRows:
        config.advancedSettings.gridRows ?? globalAdvancedSettings.gridRows,
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
