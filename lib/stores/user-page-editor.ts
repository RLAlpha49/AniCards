import { create } from "zustand";
import { devtools } from "zustand/middleware";
import type { ColorValue } from "@/lib/types/card";
import { colorPresets } from "@/components/stat-card-generator/constants";
import { DEFAULT_CARD_BORDER_RADIUS } from "@/lib/utils";

/**
 * Per-card color override configuration.
 * When `useCustomSettings` is true, this card uses its own colors instead of global.
 * @source
 */
export interface CardColorOverride {
  /** Whether this card uses custom settings */
  useCustomSettings: boolean;
  /** Custom color preset name (or "custom" for manual colors) */
  colorPreset?: string;
  /** Custom colors: [titleColor, backgroundColor, textColor, circleColor] */
  colors?: ColorValue[];
}

/**
 * Advanced settings that can be configured per-card.
 * @source
 */
export interface CardAdvancedSettings {
  /** Use fixed status colors for status distribution cards */
  useStatusColors?: boolean;
  /** Show percentage labels on pie/donut charts */
  showPiePercentages?: boolean;
  /** Show favorites indicator for applicable cards */
  showFavorites?: boolean;
  /** Grid columns for favorites grid card (1-5) */
  gridCols?: number;
  /** Grid rows for favorites grid card (1-5) */
  gridRows?: number;
}

/**
 * Complete configuration for a single card in the editor.
 * @source
 */
export interface CardEditorConfig {
  /** Card type ID (e.g., "animeStats", "mangaGenres") */
  cardId: string;
  /** Whether this card is enabled/visible */
  enabled: boolean;
  /** Selected variant for this card */
  variant: string;
  /** Color override settings */
  colorOverride: CardColorOverride;
  /** Advanced settings */
  advancedSettings: CardAdvancedSettings;
  /** Custom border color for this card (optional override) */
  borderColor?: string;
  /** Custom border radius for this card (optional override) */
  borderRadius?: number;
}

/**
 * User page editor state.
 * @source
 */
export interface UserPageEditorState {
  // User data
  userId: string | null;
  username: string | null;
  avatarUrl: string | null;
  isLoading: boolean;
  loadError: string | null;

  // Global color settings
  globalColorPreset: string;
  globalColors: ColorValue[];

  // Global border settings
  globalBorderEnabled: boolean;
  globalBorderColor: string;
  globalBorderRadius: number;

  // Global advanced settings (defaults for cards that support these features)
  globalAdvancedSettings: CardAdvancedSettings;

  // Per-card configurations
  cardConfigs: Record<string, CardEditorConfig>;

  // UI state
  expandedCardId: string | null;

  // Multi-select state
  selectedCardIds: Set<string>;

  // Save state
  isDirty: boolean;
  isSaving: boolean;
  saveError: string | null;
  lastSavedAt: number | null;
}

/**
 * Actions for the user page editor store.
 * @source
 */
export interface UserPageEditorActions {
  // User data actions
  setUserData: (
    userId: string,
    username: string | null,
    avatarUrl: string | null,
  ) => void;
  setLoading: (loading: boolean) => void;
  setLoadError: (error: string | null) => void;

  // Global color actions
  setGlobalColorPreset: (presetName: string) => void;
  setGlobalColors: (colors: ColorValue[]) => void;
  setGlobalColor: (index: number, color: ColorValue) => void;

  // Global border actions
  setGlobalBorderEnabled: (enabled: boolean) => void;
  setGlobalBorderColor: (color: string) => void;
  setGlobalBorderRadius: (radius: number) => void;

  // Global advanced settings actions
  setGlobalAdvancedSetting: <K extends keyof CardAdvancedSettings>(
    key: K,
    value: CardAdvancedSettings[K],
  ) => void;

  // Card configuration actions
  setCardEnabled: (cardId: string, enabled: boolean) => void;
  setCardVariant: (cardId: string, variant: string) => void;
  toggleCardCustomColors: (cardId: string, useCustom: boolean) => void;
  setCardColorPreset: (cardId: string, presetName: string) => void;
  setCardColors: (cardId: string, colors: ColorValue[]) => void;
  setCardColor: (cardId: string, index: number, color: ColorValue) => void;
  setCardAdvancedSetting: <K extends keyof CardAdvancedSettings>(
    cardId: string,
    key: K,
    value: CardAdvancedSettings[K],
  ) => void;
  setCardBorderColor: (cardId: string, color: string | undefined) => void;
  setCardBorderRadius: (cardId: string, radius: number | undefined) => void;

  // UI actions
  setExpandedCard: (cardId: string | null) => void;
  toggleExpandedCard: (cardId: string) => void;

  // Multi-select actions
  toggleCardSelection: (cardId: string) => void;
  selectCard: (cardId: string) => void;
  deselectCard: (cardId: string) => void;
  clearSelection: () => void;
  selectAllEnabled: () => void;

  // Bulk operations
  enableAllCards: () => void;
  disableAllCards: () => void;
  resetCardToGlobal: (cardId: string) => void;
  resetAllCardsToGlobal: () => void;

  // Save actions
  markDirty: () => void;
  setSaving: (saving: boolean) => void;
  setSaveError: (error: string | null) => void;
  markSaved: () => void;

  // Initialize from server data
  initializeFromServerData: (
    userId: string,
    username: string | null,
    avatarUrl: string | null,
    cards: ServerCardData[],
    globalSettings?: ServerGlobalSettings,
    allCardIds?: readonly string[],
  ) => void;

  // Reset store
  reset: () => void;

  // Get effective colors for a card (considering overrides)
  getEffectiveColors: (cardId: string) => ColorValue[];
  getEffectiveBorderColor: (cardId: string) => string | undefined;
  getEffectiveBorderRadius: (cardId: string) => number;
}

/**
 * Shape of card data received from the server.
 * @source
 */
export interface ServerCardData {
  cardName: string;
  variation?: string;
  colorPreset?: string;
  titleColor?: ColorValue;
  backgroundColor?: ColorValue;
  textColor?: ColorValue;
  circleColor?: ColorValue;
  borderColor?: string;
  borderRadius?: number;
  useStatusColors?: boolean;
  showPiePercentages?: boolean;
  showFavorites?: boolean;
  gridCols?: number;
  gridRows?: number;
  useCustomSettings?: boolean;
  disabled?: boolean;
}

/**
 * Shape of global settings received from the server.
 * @source
 */
export interface ServerGlobalSettings {
  colorPreset?: string;
  titleColor?: ColorValue;
  backgroundColor?: ColorValue;
  textColor?: ColorValue;
  circleColor?: ColorValue;
  borderEnabled?: boolean;
  borderColor?: string;
  borderRadius?: number;
  useStatusColors?: boolean;
  showPiePercentages?: boolean;
  showFavorites?: boolean;
  gridCols?: number;
  gridRows?: number;
}

/** Combined store type */
export type UserPageEditorStore = UserPageEditorState & UserPageEditorActions;

const DEFAULT_BORDER_COLOR = "#e4e2e2";

/**
 * Get colors from a preset name.
 * @source
 */
function getPresetColors(presetName: string): ColorValue[] {
  const preset = colorPresets[presetName];
  return preset?.colors || colorPresets.default.colors;
}

/**
 * Helper to ensure a card config exists in the store.
 * @source
 */
function ensureCardConfig(
  state: UserPageEditorState,
  cardId: string,
): CardEditorConfig {
  if (state.cardConfigs[cardId]) {
    return state.cardConfigs[cardId];
  }
  return {
    cardId,
    enabled: false,
    variant: "default",
    colorOverride: {
      useCustomSettings: false,
    },
    advancedSettings: {},
  };
}

/**
 * Ensures the cardConfigs record contains an entry for every known card ID.
 * Missing cards default to disabled and inherit global settings.
 *
 * This is critical for new users (or missing Redis records), so bulk actions
 * like "Enable All" can operate on a complete set.
 * @source
 */
function seedMissingCardConfigs(
  cardConfigs: Record<string, CardEditorConfig>,
  allCardIds?: readonly string[],
): Record<string, CardEditorConfig> {
  if (!allCardIds || allCardIds.length === 0) return cardConfigs;

  let didChange = false;
  const next: Record<string, CardEditorConfig> = { ...cardConfigs };

  for (const cardId of allCardIds) {
    if (next[cardId]) continue;
    didChange = true;
    next[cardId] = {
      cardId,
      enabled: false,
      variant: "default",
      colorOverride: { useCustomSettings: false },
      advancedSettings: {},
    };
  }

  return didChange ? next : cardConfigs;
}

/**
 * Result of processing server cards.
 * @source
 */
interface ProcessedServerCards {
  globalPreset: string;
  globalColors: ColorValue[];
  globalBorderEnabled: boolean;
  globalBorderColor: string;
  globalBorderRadius: number;
  globalAdvancedSettings: CardAdvancedSettings;
  cardConfigs: Record<string, CardEditorConfig>;
}

/**
 * Extracts global settings from the first card.
 * @source
 */
function extractGlobalSettings(firstCard: ServerCardData): {
  preset: string;
  colors: ColorValue[];
  borderEnabled: boolean;
  borderColor: string;
  borderRadius: number;
} {
  const defaultColors = getPresetColors("default");
  let preset = "default";
  let colors = defaultColors;

  if (firstCard.colorPreset && firstCard.colorPreset !== "custom") {
    preset = firstCard.colorPreset;
    colors = getPresetColors(firstCard.colorPreset);
  } else if (
    firstCard.titleColor ||
    firstCard.backgroundColor ||
    firstCard.textColor ||
    firstCard.circleColor
  ) {
    preset = "custom";
    colors = [
      firstCard.titleColor || defaultColors[0],
      firstCard.backgroundColor || defaultColors[1],
      firstCard.textColor || defaultColors[2],
      firstCard.circleColor || defaultColors[3],
    ];
  }

  const borderEnabled = Boolean(firstCard.borderColor);
  const borderColor = firstCard.borderColor || DEFAULT_BORDER_COLOR;
  const borderRadius =
    typeof firstCard.borderRadius === "number"
      ? firstCard.borderRadius
      : DEFAULT_CARD_BORDER_RADIUS;

  return { preset, colors, borderEnabled, borderColor, borderRadius };
}

/**
 * Converts a server card to an editor config.
 * @source
 */
function serverCardToEditorConfig(
  card: ServerCardData,
  globalPreset: string,
  globalColors: ColorValue[],
  globalBorderColor: string,
  globalBorderRadius: number,
): CardEditorConfig {
  // If useCustomSettings is explicitly set from server, use that value
  // Otherwise, fall back to heuristic detection for backwards compatibility
  let hasCustomColors: boolean;

  if (typeof card.useCustomSettings === "boolean") {
    // Trust the explicit flag from the server
    hasCustomColors = card.useCustomSettings;
  } else {
    // Legacy heuristic: detect custom colors based on color differences
    const normalizeForCompare = (
      value: ColorValue | string | undefined,
    ): string | undefined => {
      if (value === undefined) return undefined;
      return typeof value === "string" ? value : JSON.stringify(value);
    };

    const globalTitle = normalizeForCompare(globalColors[0]);
    const globalBackground = normalizeForCompare(globalColors[1]);
    const globalText = normalizeForCompare(globalColors[2]);
    const globalCircle = normalizeForCompare(globalColors[3]);

    const hasExplicitColorOverride =
      (card.titleColor !== undefined &&
        normalizeForCompare(card.titleColor) !== globalTitle) ||
      (card.backgroundColor !== undefined &&
        normalizeForCompare(card.backgroundColor) !== globalBackground) ||
      (card.textColor !== undefined &&
        normalizeForCompare(card.textColor) !== globalText) ||
      (card.circleColor !== undefined &&
        normalizeForCompare(card.circleColor) !== globalCircle);

    const hasPresetOverride =
      typeof card.colorPreset === "string" && card.colorPreset !== globalPreset;

    hasCustomColors = hasPresetOverride || hasExplicitColorOverride;
  }

  const colorOverride: CardColorOverride = (() => {
    if (!hasCustomColors) return { useCustomSettings: false };

    if (card.colorPreset && card.colorPreset !== "custom") {
      return {
        useCustomSettings: true,
        colorPreset: card.colorPreset,
        colors: getPresetColors(card.colorPreset),
      };
    }

    return {
      useCustomSettings: true,
      colorPreset: card.colorPreset || "custom",
      colors: [
        card.titleColor ?? globalColors[0],
        card.backgroundColor ?? globalColors[1],
        card.textColor ?? globalColors[2],
        card.circleColor ?? globalColors[3],
      ],
    };
  })();

  // If card is explicitly disabled, mark as not enabled
  const enabled = card.disabled !== true;

  return {
    cardId: card.cardName,
    enabled,
    variant: card.variation || "default",
    colorOverride,
    advancedSettings: {
      useStatusColors: card.useStatusColors,
      showPiePercentages: card.showPiePercentages,
      showFavorites: card.showFavorites,
      gridCols: card.gridCols,
      gridRows: card.gridRows,
    },
    borderColor:
      card.borderColor === globalBorderColor ? undefined : card.borderColor,
    borderRadius:
      card.borderRadius === globalBorderRadius ? undefined : card.borderRadius,
  };
}

/**
 * Processes server cards into editor state.
 * If globalSettings is provided from the server, it takes precedence over
 * the legacy heuristic that extracts settings from the first card.
 * @source
 */
function processServerCards(
  cards: ServerCardData[],
  serverGlobalSettings?: ServerGlobalSettings,
): ProcessedServerCards {
  const defaultColors = getPresetColors("default");

  if (cards.length === 0 && !serverGlobalSettings) {
    return {
      globalPreset: "default",
      globalColors: defaultColors,
      globalBorderEnabled: false,
      globalBorderColor: DEFAULT_BORDER_COLOR,
      globalBorderRadius: DEFAULT_CARD_BORDER_RADIUS,
      globalAdvancedSettings: DEFAULT_GLOBAL_ADVANCED_SETTINGS,
      cardConfigs: {},
    };
  }

  // Use server-provided global settings if available, otherwise fall back to legacy extraction
  let globalPreset: string;
  let globalColors: ColorValue[];
  let globalBorderEnabled: boolean;
  let globalBorderColor: string;
  let globalBorderRadius: number;

  if (serverGlobalSettings) {
    // Use explicit server global settings
    globalPreset = serverGlobalSettings.colorPreset || "default";

    if (globalPreset === "custom") {
      globalColors = [
        serverGlobalSettings.titleColor || defaultColors[0],
        serverGlobalSettings.backgroundColor || defaultColors[1],
        serverGlobalSettings.textColor || defaultColors[2],
        serverGlobalSettings.circleColor || defaultColors[3],
      ];
    } else if (globalPreset === "default") {
      globalColors = defaultColors;
    } else {
      globalColors = getPresetColors(globalPreset);
    }

    globalBorderEnabled = serverGlobalSettings.borderEnabled ?? false;
    globalBorderColor =
      serverGlobalSettings.borderColor || DEFAULT_BORDER_COLOR;
    globalBorderRadius =
      typeof serverGlobalSettings.borderRadius === "number"
        ? serverGlobalSettings.borderRadius
        : DEFAULT_CARD_BORDER_RADIUS;
  } else if (cards.length > 0) {
    // Legacy: extract from first card
    const legacy = extractGlobalSettings(cards[0]);
    globalPreset = legacy.preset;
    globalColors = legacy.colors;
    globalBorderEnabled = legacy.borderEnabled;
    globalBorderColor = legacy.borderColor;
    globalBorderRadius = legacy.borderRadius;
  } else {
    globalPreset = "default";
    globalColors = defaultColors;
    globalBorderEnabled = false;
    globalBorderColor = DEFAULT_BORDER_COLOR;
    globalBorderRadius = DEFAULT_CARD_BORDER_RADIUS;
  }

  const cardConfigs: Record<string, CardEditorConfig> = {};

  for (const card of cards) {
    cardConfigs[card.cardName] = serverCardToEditorConfig(
      card,
      globalPreset,
      globalColors,
      globalBorderColor,
      globalBorderRadius,
    );
  }

  // Build global advanced settings from server settings or defaults
  const globalAdvancedSettings: CardAdvancedSettings = {
    useStatusColors:
      serverGlobalSettings?.useStatusColors ??
      DEFAULT_GLOBAL_ADVANCED_SETTINGS.useStatusColors,
    showPiePercentages:
      serverGlobalSettings?.showPiePercentages ??
      DEFAULT_GLOBAL_ADVANCED_SETTINGS.showPiePercentages,
    showFavorites:
      serverGlobalSettings?.showFavorites ??
      DEFAULT_GLOBAL_ADVANCED_SETTINGS.showFavorites,
    gridCols:
      serverGlobalSettings?.gridCols ??
      DEFAULT_GLOBAL_ADVANCED_SETTINGS.gridCols,
    gridRows:
      serverGlobalSettings?.gridRows ??
      DEFAULT_GLOBAL_ADVANCED_SETTINGS.gridRows,
  };

  return {
    globalPreset,
    globalColors,
    globalBorderEnabled,
    globalBorderColor,
    globalBorderRadius,
    globalAdvancedSettings,
    cardConfigs,
  };
}

/**
 * Default initial state for the editor.
 * @source
 */
/** Default global advanced settings. */
const DEFAULT_GLOBAL_ADVANCED_SETTINGS: CardAdvancedSettings = {
  useStatusColors: true,
  showPiePercentages: true,
  showFavorites: true,
  gridCols: 3,
  gridRows: 3,
};

const initialState: UserPageEditorState = {
  userId: null,
  username: null,
  avatarUrl: null,
  isLoading: false,
  loadError: null,
  globalColorPreset: "default",
  globalColors: getPresetColors("default"),
  globalBorderEnabled: false,
  globalBorderColor: DEFAULT_BORDER_COLOR,
  globalBorderRadius: DEFAULT_CARD_BORDER_RADIUS,
  globalAdvancedSettings: DEFAULT_GLOBAL_ADVANCED_SETTINGS,
  cardConfigs: {},
  expandedCardId: null,
  selectedCardIds: new Set(),
  isDirty: false,
  isSaving: false,
  saveError: null,
  lastSavedAt: null,
};

/**
 * Zustand store for the user page editor.
 * Manages all state related to card customization on the user page.
 * @source
 */
export const useUserPageEditor = create<UserPageEditorStore>()(
  devtools(
    (set, get) => ({
      ...initialState,

      // User data actions
      setUserData: (userId, username, avatarUrl) => {
        set({ userId, username, avatarUrl }, false, "setUserData");
      },

      setLoading: (loading) => {
        set({ isLoading: loading }, false, "setLoading");
      },

      setLoadError: (error) => {
        set({ loadError: error, isLoading: false }, false, "setLoadError");
      },

      // Global color actions
      setGlobalColorPreset: (presetName) => {
        const colors = getPresetColors(presetName);
        set(
          {
            globalColorPreset: presetName,
            globalColors: colors,
            isDirty: true,
          },
          false,
          "setGlobalColorPreset",
        );
      },

      setGlobalColors: (colors) => {
        set(
          {
            globalColors: colors,
            globalColorPreset: "custom",
            isDirty: true,
          },
          false,
          "setGlobalColors",
        );
      },

      setGlobalColor: (index, color) => {
        const { globalColors } = get();
        const newColors = [...globalColors];
        newColors[index] = color;
        set(
          {
            globalColors: newColors,
            globalColorPreset: "custom",
            isDirty: true,
          },
          false,
          "setGlobalColor",
        );
      },

      // Global border actions
      setGlobalBorderEnabled: (enabled) => {
        set(
          { globalBorderEnabled: enabled, isDirty: true },
          false,
          "setGlobalBorderEnabled",
        );
      },

      setGlobalBorderColor: (color) => {
        set(
          { globalBorderColor: color, isDirty: true },
          false,
          "setGlobalBorderColor",
        );
      },

      setGlobalBorderRadius: (radius) => {
        const clamped = Math.max(0, Math.min(20, radius));
        set(
          { globalBorderRadius: clamped, isDirty: true },
          false,
          "setGlobalBorderRadius",
        );
      },

      // Global advanced settings actions
      setGlobalAdvancedSetting: (key, value) => {
        const { globalAdvancedSettings } = get();
        set(
          {
            globalAdvancedSettings: {
              ...globalAdvancedSettings,
              [key]: value,
            },
            isDirty: true,
          },
          false,
          "setGlobalAdvancedSetting",
        );
      },

      // Card configuration actions
      setCardEnabled: (cardId, enabled) => {
        const { cardConfigs } = get();
        const existing = ensureCardConfig(get(), cardId);
        set(
          {
            cardConfigs: {
              ...cardConfigs,
              [cardId]: { ...existing, enabled },
            },
            isDirty: true,
          },
          false,
          "setCardEnabled",
        );
      },

      setCardVariant: (cardId, variant) => {
        const { cardConfigs } = get();
        const existing = ensureCardConfig(get(), cardId);
        set(
          {
            cardConfigs: {
              ...cardConfigs,
              [cardId]: { ...existing, variant },
            },
            isDirty: true,
          },
          false,
          "setCardVariant",
        );
      },

      toggleCardCustomColors: (cardId, useCustom) => {
        const { cardConfigs, globalColors, globalColorPreset } = get();
        const existing = ensureCardConfig(get(), cardId);
        set(
          {
            cardConfigs: {
              ...cardConfigs,
              [cardId]: {
                ...existing,
                colorOverride: {
                  ...existing.colorOverride,
                  useCustomSettings: useCustom,
                  // Initialize with global colors when enabling custom
                  colors: useCustom
                    ? existing.colorOverride.colors || [...globalColors]
                    : existing.colorOverride.colors,
                  colorPreset: useCustom
                    ? existing.colorOverride.colorPreset || globalColorPreset
                    : existing.colorOverride.colorPreset,
                },
              },
            },
            isDirty: true,
          },
          false,
          "toggleCardCustomColors",
        );
      },

      setCardColorPreset: (cardId, presetName) => {
        const { cardConfigs } = get();
        const existing = ensureCardConfig(get(), cardId);
        const colors = getPresetColors(presetName);
        set(
          {
            cardConfigs: {
              ...cardConfigs,
              [cardId]: {
                ...existing,
                colorOverride: {
                  ...existing.colorOverride,
                  useCustomSettings: true,
                  colorPreset: presetName,
                  colors,
                },
              },
            },
            isDirty: true,
          },
          false,
          "setCardColorPreset",
        );
      },

      setCardColors: (cardId, colors) => {
        const { cardConfigs } = get();
        const existing = ensureCardConfig(get(), cardId);
        set(
          {
            cardConfigs: {
              ...cardConfigs,
              [cardId]: {
                ...existing,
                colorOverride: {
                  ...existing.colorOverride,
                  useCustomSettings: true,
                  colorPreset: "custom",
                  colors,
                },
              },
            },
            isDirty: true,
          },
          false,
          "setCardColors",
        );
      },

      setCardColor: (cardId, index, color) => {
        const { cardConfigs, globalColors } = get();
        const existing = ensureCardConfig(get(), cardId);
        const currentColors = existing.colorOverride.colors || [
          ...globalColors,
        ];
        const newColors = [...currentColors];
        newColors[index] = color;
        set(
          {
            cardConfigs: {
              ...cardConfigs,
              [cardId]: {
                ...existing,
                colorOverride: {
                  ...existing.colorOverride,
                  useCustomSettings: true,
                  colorPreset: "custom",
                  colors: newColors,
                },
              },
            },
            isDirty: true,
          },
          false,
          "setCardColor",
        );
      },

      setCardAdvancedSetting: (cardId, key, value) => {
        const { cardConfigs } = get();
        const existing = ensureCardConfig(get(), cardId);
        set(
          {
            cardConfigs: {
              ...cardConfigs,
              [cardId]: {
                ...existing,
                advancedSettings: {
                  ...existing.advancedSettings,
                  [key]: value,
                },
              },
            },
            isDirty: true,
          },
          false,
          "setCardAdvancedSetting",
        );
      },

      setCardBorderColor: (cardId, color) => {
        const { cardConfigs } = get();
        const existing = ensureCardConfig(get(), cardId);
        set(
          {
            cardConfigs: {
              ...cardConfigs,
              [cardId]: { ...existing, borderColor: color },
            },
            isDirty: true,
          },
          false,
          "setCardBorderColor",
        );
      },

      setCardBorderRadius: (cardId, radius) => {
        const { cardConfigs } = get();
        const existing = ensureCardConfig(get(), cardId);
        set(
          {
            cardConfigs: {
              ...cardConfigs,
              [cardId]: { ...existing, borderRadius: radius },
            },
            isDirty: true,
          },
          false,
          "setCardBorderRadius",
        );
      },

      // UI actions
      setExpandedCard: (cardId) => {
        set({ expandedCardId: cardId }, false, "setExpandedCard");
      },

      toggleExpandedCard: (cardId) => {
        const { expandedCardId } = get();
        set(
          { expandedCardId: expandedCardId === cardId ? null : cardId },
          false,
          "toggleExpandedCard",
        );
      },

      // Multi-select actions
      toggleCardSelection: (cardId) => {
        const { selectedCardIds } = get();
        const newSet = new Set(selectedCardIds);
        if (newSet.has(cardId)) {
          newSet.delete(cardId);
        } else {
          newSet.add(cardId);
        }
        set({ selectedCardIds: newSet }, false, "toggleCardSelection");
      },

      selectCard: (cardId) => {
        const { selectedCardIds } = get();
        if (selectedCardIds.has(cardId)) return;
        const newSet = new Set(selectedCardIds);
        newSet.add(cardId);
        set({ selectedCardIds: newSet }, false, "selectCard");
      },

      deselectCard: (cardId) => {
        const { selectedCardIds } = get();
        if (!selectedCardIds.has(cardId)) return;
        const newSet = new Set(selectedCardIds);
        newSet.delete(cardId);
        set({ selectedCardIds: newSet }, false, "deselectCard");
      },

      clearSelection: () => {
        set({ selectedCardIds: new Set() }, false, "clearSelection");
      },

      selectAllEnabled: () => {
        const { cardConfigs } = get();
        const enabledIds = Object.values(cardConfigs)
          .filter((c) => c.enabled)
          .map((c) => c.cardId);
        set(
          { selectedCardIds: new Set(enabledIds) },
          false,
          "selectAllEnabled",
        );
      },

      // Bulk operations
      enableAllCards: () => {
        const { cardConfigs } = get();
        const updated: Record<string, CardEditorConfig> = {};
        for (const [cardId, config] of Object.entries(cardConfigs)) {
          updated[cardId] = { ...config, enabled: true };
        }
        set({ cardConfigs: updated, isDirty: true }, false, "enableAllCards");
      },

      disableAllCards: () => {
        const { cardConfigs } = get();
        const updated: Record<string, CardEditorConfig> = {};
        for (const [cardId, config] of Object.entries(cardConfigs)) {
          updated[cardId] = { ...config, enabled: false };
        }
        set({ cardConfigs: updated, isDirty: true }, false, "disableAllCards");
      },

      resetCardToGlobal: (cardId) => {
        const { cardConfigs } = get();
        const existing = ensureCardConfig(get(), cardId);
        set(
          {
            cardConfigs: {
              ...cardConfigs,
              [cardId]: {
                ...existing,
                colorOverride: { useCustomSettings: false },
                borderColor: undefined,
                borderRadius: undefined,
                advancedSettings: {},
              },
            },
            isDirty: true,
          },
          false,
          "resetCardToGlobal",
        );
      },

      resetAllCardsToGlobal: () => {
        const { cardConfigs } = get();
        const updated: Record<string, CardEditorConfig> = {};
        for (const [cardId, config] of Object.entries(cardConfigs)) {
          updated[cardId] = {
            ...config,
            colorOverride: { useCustomSettings: false },
            borderColor: undefined,
            borderRadius: undefined,
            advancedSettings: {},
          };
        }
        set(
          { cardConfigs: updated, isDirty: true },
          false,
          "resetAllCardsToGlobal",
        );
      },
      // Save actions
      markDirty: () => {
        set({ isDirty: true }, false, "markDirty");
      },

      setSaving: (saving) => {
        set({ isSaving: saving }, false, "setSaving");
      },

      setSaveError: (error) => {
        set({ saveError: error, isSaving: false }, false, "setSaveError");
      },

      markSaved: () => {
        set(
          {
            isDirty: false,
            isSaving: false,
            saveError: null,
            lastSavedAt: Date.now(),
          },
          false,
          "markSaved",
        );
      },

      // Initialize from server data
      initializeFromServerData: (
        userId,
        username,
        avatarUrl,
        cards,
        globalSettings,
        allCardIds,
      ) => {
        const result = processServerCards(cards, globalSettings);
        const seededCardConfigs = seedMissingCardConfigs(
          result.cardConfigs,
          allCardIds,
        );
        set(
          {
            userId,
            username,
            avatarUrl,
            globalColorPreset: result.globalPreset,
            globalColors: result.globalColors,
            globalBorderEnabled: result.globalBorderEnabled,
            globalBorderColor: result.globalBorderColor,
            globalBorderRadius: result.globalBorderRadius,
            globalAdvancedSettings: result.globalAdvancedSettings,
            cardConfigs: seededCardConfigs,
            isLoading: false,
            loadError: null,
            isDirty: false,
          },
          false,
          "initializeFromServerData",
        );
      },

      // Reset store
      reset: () => {
        set(initialState, false, "reset");
      },

      // Get effective colors for a card
      getEffectiveColors: (cardId) => {
        const { cardConfigs, globalColors } = get();
        const config = cardConfigs[cardId];
        if (
          config?.colorOverride.useCustomSettings &&
          config.colorOverride.colors
        ) {
          return config.colorOverride.colors;
        }
        return globalColors;
      },

      getEffectiveBorderColor: (cardId) => {
        const { cardConfigs, globalBorderEnabled, globalBorderColor } = get();
        const config = cardConfigs[cardId];
        if (config?.borderColor !== undefined) {
          return config.borderColor;
        }
        return globalBorderEnabled ? globalBorderColor : undefined;
      },

      getEffectiveBorderRadius: (cardId) => {
        const { cardConfigs, globalBorderRadius } = get();
        const config = cardConfigs[cardId];
        if (config?.borderRadius !== undefined) {
          return config.borderRadius;
        }
        return globalBorderRadius;
      },
    }),
    { name: "UserPageEditor" },
  ),
);

/**
 * Selector to get all enabled card IDs.
 * @source
 */
export const selectEnabledCardIds = (state: UserPageEditorStore): string[] =>
  Object.values(state.cardConfigs)
    .filter((c) => c.enabled)
    .map((c) => c.cardId);

/**
 * Selector to check if any cards are enabled.
 * @source
 */
export const selectHasEnabledCards = (state: UserPageEditorStore): boolean =>
  Object.values(state.cardConfigs).some((c) => c.enabled);

/**
 * Selector to get the count of selected cards.
 * @source
 */
export const selectSelectedCount = (state: UserPageEditorStore): number =>
  state.selectedCardIds.size;

/**
 * Selector to check if a card is selected.
 * @source
 */
export const selectIsCardSelected = (
  state: UserPageEditorStore,
  cardId: string,
): boolean => state.selectedCardIds.has(cardId);

/**
 * Selector to get card configs grouped by their group from constants.
 * @source
 */
export const selectCardConfigsByGroup = (
  state: UserPageEditorStore,
): Record<string, CardEditorConfig[]> => {
  // This will be populated by the component using statCardTypes from constants
  const result: Record<string, CardEditorConfig[]> = {};
  for (const config of Object.values(state.cardConfigs)) {
    // Group info comes from statCardTypes, not stored here
    // Component will handle grouping
    const group = "All";
    if (!result[group]) result[group] = [];
    result[group].push(config);
  }
  return result;
};
