export const LIGHT_PREVIEW_COLOR_PRESET = "anicardsLightGradient" as const;
export const DARK_PREVIEW_COLOR_PRESET = "anicardsDarkGradient" as const;

export type PreviewColorPreset =
  | typeof LIGHT_PREVIEW_COLOR_PRESET
  | typeof DARK_PREVIEW_COLOR_PRESET;

export interface ThemePreviewUrls {
  light: string;
  dark: string;
}

export function resolvePreviewColorPreset(
  theme: string | null | undefined,
): PreviewColorPreset | null {
  if (theme === "dark") return DARK_PREVIEW_COLOR_PRESET;
  if (theme === "light") return LIGHT_PREVIEW_COLOR_PRESET;
  return null;
}

export function selectThemePreviewUrl(
  previewUrls: Readonly<ThemePreviewUrls>,
  colorPreset: PreviewColorPreset | null | undefined,
): string | undefined {
  if (colorPreset === DARK_PREVIEW_COLOR_PRESET) {
    return previewUrls.dark;
  }

  if (colorPreset === LIGHT_PREVIEW_COLOR_PRESET) {
    return previewUrls.light;
  }

  return undefined;
}
