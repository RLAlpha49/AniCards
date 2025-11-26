// Centralized data management for user preferences
import { colorPresets, statCardTypes } from "@/components/stat-card-generator";
import type { ColorValue } from "@/lib/types/card";

/** Default border color used for cards when a user-selected value is not present. @source */
export const DEFAULT_BORDER_COLOR = "#e4e2e2";

/** Shape representing persisted user preferences stored in localStorage.
 * @source
 */
type UserPreferences = {
  colorPreset: string;
  defaultCards: string[];
  borderEnabled: boolean;
  borderColor: string;
};

/**
 * Shape representing saved color configuration (custom or from preset).
 * @source
 */
type SavedColorConfig = {
  colors: ColorValue[];
  presetName: string; // "custom" if manually modified
};

/** Prefix used for all persisted keys in localStorage for this app. @source */
const APP_PREFIX = "anicards-";
/**
 * A curated list of site-specific keys that are managed by `clearSiteCache`.
 * These keys are combined with the `APP_PREFIX` to form complete localStorage keys.
 * @source
 */
const VALID_CACHE_KEYS = [
  "statCardConfig",
  "statCardColors",
  "statCardTypes",
  "sidebarDefaultOpen",
  "defaultColorPreset",
  "defaultCardTypes",
  "defaultBorderEnabled",
  "defaultBorderColor",
  "savedColorConfig",
].map((key) => `${APP_PREFIX}${key}`);

/**
 * Loads default site settings from localStorage and returns a normalized
 * UserPreferences object with sensible defaults when values are missing.
 * @returns The user's saved preferences or default values.
 * @source
 */
export function loadDefaultSettings(): UserPreferences {
  const loadValue = (key: string) => {
    const stored = localStorage.getItem(`${APP_PREFIX}${key}`);
    if (!stored) return null;

    try {
      const parsed = JSON.parse(stored);
      return parsed.value ?? parsed; // Handle both new and old formats
    } catch {
      return stored; // Fallback to raw string
    }
  };

  return {
    colorPreset: loadValue("defaultColorPreset") ?? "default",
    defaultCards: loadValue("defaultCardTypes") ?? [],
    borderEnabled: loadValue("defaultBorderEnabled") ?? false,
    borderColor: loadValue("defaultBorderColor") ?? DEFAULT_BORDER_COLOR,
  };
}

/**
 * Persist the default color preset into localStorage with a last modified timestamp.
 * @param preset - The chosen preset name to save.
 * @source
 */
export function saveDefaultPreset(preset: string) {
  const data = {
    value: preset,
    lastModified: new Date().toISOString(),
  };
  localStorage.setItem(`${APP_PREFIX}defaultColorPreset`, JSON.stringify(data));
}

/**
 * Persist an array of default card types into localStorage.
 * @param cardTypes - The card type ids to persist as the default selection.
 * @source
 */
export function saveDefaultCardTypes(cardTypes: string[]) {
  const data = {
    value: cardTypes,
    lastModified: new Date().toISOString(),
  };
  localStorage.setItem(`${APP_PREFIX}defaultCardTypes`, JSON.stringify(data));
}

/**
 * Save a boolean indicating whether card borders are enabled by default.
 * @param enabled - Boolean flag to persist.
 * @source
 */
export function saveDefaultBorderEnabled(enabled: boolean) {
  const data = {
    value: enabled,
    lastModified: new Date().toISOString(),
  };
  localStorage.setItem(
    `${APP_PREFIX}defaultBorderEnabled`,
    JSON.stringify(data),
  );
}

/**
 * Persist a default border color string into localStorage with a timestamp.
 * @param color - Hex color string to save.
 * @source
 */
export function saveDefaultBorderColor(color: string) {
  const data = {
    value: color,
    lastModified: new Date().toISOString(),
  };
  localStorage.setItem(`${APP_PREFIX}defaultBorderColor`, JSON.stringify(data));
}

/**
 * Save the current color configuration (colors + preset name) to localStorage.
 * This is called whenever colors change, allowing restoration on next visit.
 * @param colors - Array of ColorValue (4 items: title, background, text, circle)
 * @param presetName - Name of the preset or "custom" if manually modified
 * @source
 */
export function saveColorConfig(colors: ColorValue[], presetName: string) {
  const data = {
    value: { colors, presetName },
    lastModified: new Date().toISOString(),
  };
  localStorage.setItem(`${APP_PREFIX}savedColorConfig`, JSON.stringify(data));
}

/**
 * Load the saved color configuration from localStorage.
 * @returns The saved color config or null if not found
 * @source
 */
export function loadColorConfig(): SavedColorConfig | null {
  const stored = localStorage.getItem(`${APP_PREFIX}savedColorConfig`);
  if (!stored) return null;

  try {
    const parsed = JSON.parse(stored);
    const value = parsed.value ?? parsed;
    if (value && Array.isArray(value.colors) && value.colors.length === 4) {
      return value as SavedColorConfig;
    }
  } catch {}

  return null;
}

// Helper to get actual color values from preset name
/**
 * Returns the color palette for a given preset name; falls back to default
 * preset colors if the requested preset is missing.
 * @param presetName - Name of the preset to look up.
 * @returns Color definitions for the preset.
 * @source
 */
export function getPresetColors(presetName: string) {
  const preset = colorPresets[presetName];
  return preset?.colors || colorPresets.default.colors;
}

// Helper to get card type labels for display
/**
 * Returns a display label for the provided card type id; falls back to the
 * id itself when a label cannot be found.
 * @param cardId - Card type identifier.
 * @returns A human readable label.
 * @source
 */
export function getCardTypeLabel(cardId: string) {
  return statCardTypes.find((t) => t.id === cardId)?.label || cardId;
}

/**
 * Reads site-prefixed items from localStorage and returns a list of cached
 * entries with key, byte size, and last modified timestamp.
 * @returns List of cache metadata for the current site.
 * @source
 */
export function getSiteSpecificCache() {
  return Object.keys(localStorage)
    .filter((key) => key.startsWith(APP_PREFIX))
    .map((key) => {
      const item = localStorage.getItem(key)!;
      let size = new Blob([item]).size;
      let lastModified = new Date().toISOString();

      try {
        const parsed = JSON.parse(item);
        if (parsed.lastModified) {
          lastModified = parsed.lastModified;
          size = new Blob([JSON.stringify(parsed)]).size;
        }
      } catch {}

      return {
        key: key.replace(APP_PREFIX, ""),
        size,
        lastModified,
      };
    });
}

/**
 * Clears a defined set of known keys from localStorage to reset site cache
 * or user default settings.
 * @source
 */
export function clearSiteCache() {
  for (const key of VALID_CACHE_KEYS) {
    localStorage.removeItem(key);
  }
}
