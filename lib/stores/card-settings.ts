import { create } from "zustand";
import { devtools, persist, createJSONStorage } from "zustand/middleware";
import { createBackwardCompatibleStorage } from "@/lib/stores/storage-adapter";
import { DEFAULT_CARD_BORDER_RADIUS } from "@/lib/utils";
import type { ColorValue } from "@/lib/types/card";

/**
 * Saved color configuration shape (custom or from preset).
 * @source
 */
export interface SavedColorConfig {
  /** Array of 4 colors: title, background, text, circle */
  colors: ColorValue[];
  /** Name of the preset or "custom" if manually modified */
  presetName: string;
}

/**
 * State shape for card settings.
 * @source
 */
export interface CardSettingsState {
  /** Saved color configuration (4 colors + preset name) */
  savedColorConfig: SavedColorConfig | null;
  /** Array of card type IDs enabled by default */
  defaultCardTypes: string[];
  /** Mapping of card type ID to variant ID */
  defaultVariants: Record<string, string>;
  /** Show favorites flag per card ID */
  defaultShowFavoritesByCard: Record<string, boolean>;
  /** Whether borders are enabled by default */
  defaultBorderEnabled: boolean;
  /** Default border color (hex string) */
  defaultBorderColor: string;
  /** Default border radius in pixels */
  defaultBorderRadius: number;
  /** Use status-specific colors for anime distribution */
  useAnimeStatusColors: boolean;
  /** Use status-specific colors for manga distribution */
  useMangaStatusColors: boolean;
  /** Show percentages on pie charts */
  showPiePercentages: boolean;
}

/**
 * Actions for updating card settings.
 * @source
 */
export interface CardSettingsActions {
  /** Save color configuration */
  setSavedColorConfig: (config: SavedColorConfig) => void;
  /** Update default card types */
  setDefaultCardTypes: (types: string[]) => void;
  /** Toggle single card type on/off */
  toggleCardType: (cardId: string) => void;
  /** Set variant for a card type */
  setDefaultVariant: (cardId: string, variant: string) => void;
  /** Toggle show favorites for a card */
  toggleShowFavorites: (cardId: string) => void;
  /** Update border enabled state */
  setDefaultBorderEnabled: (enabled: boolean) => void;
  /** Update border color */
  setDefaultBorderColor: (color: string) => void;
  /** Update border radius */
  setDefaultBorderRadius: (radius: number) => void;
  /** Toggle anime status colors */
  setUseAnimeStatusColors: (enabled: boolean) => void;
  /** Toggle manga status colors */
  setUseMangaStatusColors: (enabled: boolean) => void;
  /** Toggle pie percentages */
  setShowPiePercentages: (enabled: boolean) => void;
  /** Reset all settings to defaults */
  resetCardSettings: () => void;
}

/** Combined store type for card settings */
export type CardSettingsStore = CardSettingsState & CardSettingsActions;

const APP_PREFIX = "anicards-";

/**
 * Default values for card settings
 */
const defaultState: CardSettingsState = {
  savedColorConfig: null,
  defaultCardTypes: [],
  defaultVariants: {},
  defaultShowFavoritesByCard: {},
  defaultBorderEnabled: false,
  defaultBorderColor: "#e4e2e2",
  defaultBorderRadius: DEFAULT_CARD_BORDER_RADIUS,
  useAnimeStatusColors: false,
  useMangaStatusColors: false,
  showPiePercentages: false,
};

const customStorage = createJSONStorage<CardSettingsStore>(() =>
  createBackwardCompatibleStorage(),
);

/**
 * Legacy key mappings for migration
 */
const legacyKeyMappings: Array<{
  key: string;
  stateKey: keyof CardSettingsState;
  transform?: (value: unknown) => unknown;
}> = [
  { key: "savedColorConfig", stateKey: "savedColorConfig" },
  { key: "defaultCardTypes", stateKey: "defaultCardTypes" },
  { key: "defaultVariants", stateKey: "defaultVariants" },
  { key: "defaultShowFavoritesByCard", stateKey: "defaultShowFavoritesByCard" },
  { key: "defaultBorderEnabled", stateKey: "defaultBorderEnabled" },
  { key: "defaultBorderColor", stateKey: "defaultBorderColor" },
  { key: "defaultBorderRadius", stateKey: "defaultBorderRadius" },
  { key: "useAnimeStatusColors", stateKey: "useAnimeStatusColors" },
  { key: "useMangaStatusColors", stateKey: "useMangaStatusColors" },
  { key: "showPiePercentages", stateKey: "showPiePercentages" },
];

/**
 * Try to parse and extract a value from a legacy localStorage entry.
 * Returns the value if successful, undefined otherwise.
 */
function tryParseLegacyValue(
  fullKey: string,
  transform?: (value: unknown) => unknown,
): unknown {
  const maybeWindow = globalThis.window;
  if (!maybeWindow) return undefined;
  const storage = maybeWindow.localStorage;
  const stored = storage.getItem(fullKey);
  if (!stored) return undefined;

  try {
    const parsed = JSON.parse(stored);
    let value = parsed.value ?? parsed;
    if (transform) {
      value = transform(value);
    }
    // Remove legacy key after migration
    storage.removeItem(fullKey);
    return value ?? undefined;
  } catch {
    return undefined;
  }
}

/**
 * Migrate legacy localStorage keys to the new store format.
 * Called after initial hydration.
 */
function migrateLegacyKeys(set: (state: Partial<CardSettingsState>) => void) {
  const maybeWindow = globalThis.window;
  if (!maybeWindow) {
    return;
  }

  const migratedState: Partial<CardSettingsState> = {};
  let hasMigrated = false;

  for (const { key, stateKey, transform } of legacyKeyMappings) {
    const value = tryParseLegacyValue(`${APP_PREFIX}${key}`, transform);
    if (value !== undefined) {
      (migratedState as Record<string, unknown>)[stateKey] = value;
      hasMigrated = true;
    }
  }

  // Also migrate the legacy defaultColorPreset (just remove it, colors handled elsewhere)
  if (!migratedState.savedColorConfig) {
    tryParseLegacyValue(`${APP_PREFIX}defaultColorPreset`);
  }

  if (hasMigrated) {
    set(migratedState);
  }
}

/**
 * Zustand store for card settings with persistence and devtools.
 * Handles color configurations, card type selections, variants, and display options.
 * @source
 */
export const useCardSettings = create<CardSettingsStore>()(
  devtools(
    persist(
      (set, get) => ({
        ...defaultState,

        setSavedColorConfig: (config: SavedColorConfig) => {
          set({ savedColorConfig: config }, false, "setSavedColorConfig");
        },

        setDefaultCardTypes: (types: string[]) => {
          set({ defaultCardTypes: types }, false, "setDefaultCardTypes");
        },

        toggleCardType: (cardId: string) => {
          const { defaultCardTypes } = get();
          const newTypes = defaultCardTypes.includes(cardId)
            ? defaultCardTypes.filter((t) => t !== cardId)
            : [...defaultCardTypes, cardId];
          set({ defaultCardTypes: newTypes }, false, "toggleCardType");
        },

        setDefaultVariant: (cardId: string, variant: string) => {
          const { defaultVariants } = get();
          set(
            { defaultVariants: { ...defaultVariants, [cardId]: variant } },
            false,
            "setDefaultVariant",
          );
        },

        toggleShowFavorites: (cardId: string) => {
          const { defaultShowFavoritesByCard } = get();
          set(
            {
              defaultShowFavoritesByCard: {
                ...defaultShowFavoritesByCard,
                [cardId]: !defaultShowFavoritesByCard[cardId],
              },
            },
            false,
            "toggleShowFavorites",
          );
        },

        setDefaultBorderEnabled: (enabled: boolean) => {
          set(
            { defaultBorderEnabled: enabled },
            false,
            "setDefaultBorderEnabled",
          );
        },

        setDefaultBorderColor: (color: string) => {
          set({ defaultBorderColor: color }, false, "setDefaultBorderColor");
        },

        setDefaultBorderRadius: (radius: number) => {
          set({ defaultBorderRadius: radius }, false, "setDefaultBorderRadius");
        },

        setUseAnimeStatusColors: (enabled: boolean) => {
          set(
            { useAnimeStatusColors: enabled },
            false,
            "setUseAnimeStatusColors",
          );
        },

        setUseMangaStatusColors: (enabled: boolean) => {
          set(
            { useMangaStatusColors: enabled },
            false,
            "setUseMangaStatusColors",
          );
        },

        setShowPiePercentages: (enabled: boolean) => {
          set({ showPiePercentages: enabled }, false, "setShowPiePercentages");
        },

        resetCardSettings: () => {
          set(defaultState, false, "resetCardSettings");
        },
      }),
      {
        name: `${APP_PREFIX}card-settings`,
        version: 1,
        storage: customStorage,
        onRehydrateStorage: () => (state, error) => {
          if (error) {
            console.error("Error rehydrating card settings:", error);
            return;
          }
          migrateLegacyKeys((partial) => {
            useCardSettings.setState(partial);
          });
        },
        migrate: (persistedState, version) => {
          // Handle future migrations here
          if (version === 0) {
            // Migration from v0 to v1 (if needed in future)
          }
          return persistedState as CardSettingsStore;
        },
      },
    ),
    { name: "CardSettings" },
  ),
);
