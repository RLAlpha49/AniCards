import type {
  CardEditorConfig,
  CardAdvancedSettings,
} from "@/lib/stores/user-page-editor";
import type { ColorValue } from "@/lib/types/card";
import {
  mapStoredConfigToCardUrlParams,
  buildCardUrlWithParams,
} from "@/lib/card-groups";
import { colorPresets } from "@/components/stat-card-generator/constants";

interface BuildPreviewUrlArgs {
  userId: string | null | undefined;
  cardId: string;
  config: CardEditorConfig;
  urlColorPreset?: string;
  effectiveColors: ColorValue[];  effectiveBorderColor?: string;
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
  const defaultColors = colorPresets.default.colors as [
    ColorValue,
    ColorValue,
    ColorValue,
    ColorValue,
  ];
  const [titleColor, backgroundColor, textColor, circleColor] = (() => {
    if (!Array.isArray(effectiveColors)) {
      console.warn(
        "[buildPreviewUrl] expected effectiveColors to be an array; using default colors",
      );
      return defaultColors;
    }

    if (effectiveColors.length < 4) {
      console.warn(
        `[buildPreviewUrl] effectiveColors has ${effectiveColors.length} entries; expected >=4. Filling missing values with defaults.`,
      );
    }

    return [
      effectiveColors[0] ?? defaultColors[0],
      effectiveColors[1] ?? defaultColors[1],
      effectiveColors[2] ?? defaultColors[2],
      effectiveColors[3] ?? defaultColors[3],
    ] as [ColorValue, ColorValue, ColorValue, ColorValue];
  })();

  const urlParams = mapStoredConfigToCardUrlParams(
    {
      cardName: cardId,
      variation: config.variant,
      colorPreset: urlColorPreset,
      titleColor,
      backgroundColor,
      textColor,
      circleColor,
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
