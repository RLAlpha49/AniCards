/**
 * Zustand store backing the user-page card editor.
 *
 * The store owns global and per-card settings, dirty-state calculation,
 * baseline snapshots, bulk history, and template persistence so the React UI
 * can stay mostly declarative while save/restore logic stays consistent.
 */
import { create } from "zustand";
import { devtools } from "zustand/middleware";

import { colorPresets } from "@/components/stat-card-generator/constants";
import { statCardTypes } from "@/lib/card-types";
import { normalizeForCompare } from "@/lib/colorUtils";
import type { ColorValue } from "@/lib/types/card";
import {
  clampBorderRadius,
  DEFAULT_CARD_BORDER_RADIUS,
  generateSecureId,
} from "@/lib/utils";

import type { ServerCardData, ServerGlobalSettings } from "../api/cards";
import type {
  SettingsExportV1,
  SettingsSnapshot,
  SettingsTemplateV1,
} from "../user-page-settings-io";
import {
  readSettingsTemplatesFromStorage,
  writeSettingsTemplatesToStorage,
} from "../user-page-settings-templates";

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
 * Minimal representation of unsaved local edits.
 *
 * Used for local draft backup/restore and conflict recovery. Values are
 * snapshots of the current state (not deltas).
 */
export type LocalEditsPatch = {
  globalSnapshot?: SettingsSnapshot;
  cardConfigs?: Record<string, CardEditorConfig>;
  cardOrder?: string[];
};

export type SettingsTemplateMutationResult =
  | { ok: true }
  | { ok: false; error: string };

type InitializeFromServerDataArgs = [
  userId: string,
  username: string | null,
  avatarUrl: string | null,
  cards: ServerCardData[],
  globalSettings?: ServerGlobalSettings,
  allCardIds?: readonly string[],
  serverUpdatedAt?: string | null,
  cardOrder?: readonly string[],
];

type DirtyCardIdMap = Record<string, true>;

type DirtyTrackerState = {
  isGlobalDirty: boolean;
  isCardOrderDirty: boolean;
  dirtyCardIds: DirtyCardIdMap;
};

function hasDirtyCardIds(dirtyCardIds: DirtyCardIdMap): boolean {
  return Object.keys(dirtyCardIds).length > 0;
}

function hasDirtyTrackerState(
  state: UserPageEditorState,
): state is UserPageEditorState & DirtyTrackerState {
  return (
    typeof (state as Partial<DirtyTrackerState>).isGlobalDirty === "boolean" &&
    typeof (state as Partial<DirtyTrackerState>).isCardOrderDirty ===
      "boolean" &&
    typeof (state as Partial<DirtyTrackerState>).dirtyCardIds === "object" &&
    (state as Partial<DirtyTrackerState>).dirtyCardIds !== null
  );
}

function hasCardOrderChanged(
  currentOrder: readonly string[],
  baselineOrder: readonly string[],
): boolean {
  return (
    baselineOrder.length !== currentOrder.length ||
    baselineOrder.some((id, idx) => id !== currentOrder[idx])
  );
}

function computeCardDirtyFlag(
  state: UserPageEditorState,
  cardId: string,
): boolean {
  const current = state.cardConfigs[cardId];
  const baseline = state.baselineCardConfigs[cardId];

  if (!current) return baseline !== undefined;
  if (!baseline) return true;

  return !areCardConfigsEqual(current, baseline);
}

function computeGlobalDirtyFlag(state: UserPageEditorState): boolean {
  const baselineGlobal = state.baselineGlobalSnapshot;
  if (!baselineGlobal) return true;

  const currentGlobal = buildGlobalSettingsSnapshot(state);
  return !areSettingsSnapshotsEqual(currentGlobal, baselineGlobal);
}

function computeCardOrderDirtyFlag(state: UserPageEditorState): boolean {
  return hasCardOrderChanged(state.cardOrder, state.baselineCardOrder);
}

function buildDirtyCardIdMapByFullDiff(
  state: UserPageEditorState,
): DirtyCardIdMap {
  const dirtyCardIds: DirtyCardIdMap = {};

  for (const cardId of Object.keys(state.cardConfigs)) {
    if (computeCardDirtyFlag(state, cardId)) {
      dirtyCardIds[cardId] = true;
    }
  }

  return dirtyCardIds;
}

function buildLocalEditsPatchByFullDiff(
  state: UserPageEditorState,
): LocalEditsPatch | null {
  const patch: LocalEditsPatch = {};

  const currentGlobal = buildGlobalSettingsSnapshot(state);
  const baselineGlobal = state.baselineGlobalSnapshot;
  if (
    !baselineGlobal ||
    !areSettingsSnapshotsEqual(currentGlobal, baselineGlobal)
  ) {
    patch.globalSnapshot = currentGlobal;
  }

  const changedCards: Record<string, CardEditorConfig> = {};
  for (const [cardId, cfg] of Object.entries(state.cardConfigs)) {
    const baseline = state.baselineCardConfigs[cardId];
    if (!baseline || !areCardConfigsEqual(cfg, baseline)) {
      changedCards[cardId] = cloneCardEditorConfig(cfg);
    }
  }
  if (Object.keys(changedCards).length > 0) {
    patch.cardConfigs = changedCards;
  }

  if (hasCardOrderChanged(state.cardOrder, state.baselineCardOrder)) {
    patch.cardOrder = [...state.cardOrder];
  }

  return Object.keys(patch).length > 0 ? patch : null;
}

function buildLocalEditsPatchFromDirtyTrackers(
  state: UserPageEditorState & DirtyTrackerState,
): LocalEditsPatch | null {
  const patch: LocalEditsPatch = {};

  if (state.isGlobalDirty) {
    patch.globalSnapshot = buildGlobalSettingsSnapshot(state);
  }

  if (hasDirtyCardIds(state.dirtyCardIds)) {
    const changedCards: Record<string, CardEditorConfig> = {};

    for (const cardId of Object.keys(state.dirtyCardIds)) {
      const config = state.cardConfigs[cardId];
      if (!config) continue;
      changedCards[cardId] = cloneCardEditorConfig(config);
    }

    if (Object.keys(changedCards).length > 0) {
      patch.cardConfigs = changedCards;
    }
  }

  if (state.isCardOrderDirty) {
    patch.cardOrder = [...state.cardOrder];
  }

  return Object.keys(patch).length > 0 ? patch : null;
}

/**
 * Build a patch representing all local edits since the last baseline.
 * Returns null when no diffs are detected.
 */
export function buildLocalEditsPatch(
  state: UserPageEditorState,
): LocalEditsPatch | null {
  // Always compute a patch from the provided state. Earlier versions
  // short-circuited when `state.isDirty` was false which prevented
  // callers (e.g., actions that need to detect a revert-to-baseline)
  // from determining whether there are any outstanding edits.

  if (hasDirtyTrackerState(state)) {
    const trackedPatch = buildLocalEditsPatchFromDirtyTrackers(state);

    if (trackedPatch || !state.isDirty) {
      return trackedPatch;
    }
  }

  return buildLocalEditsPatchByFullDiff(state);
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

  /**
   * Canonical card ordering for the editor UI.
   *
   * This is persisted implicitly by saving cards to the server in this order.
   * It includes all known card IDs (enabled and disabled).
   */
  cardOrder: string[];

  /**
   * Baseline snapshots captured at last successful load/save.
   * Used to compute per-card "modified/unsaved" indicators.
   */
  baselineGlobalSnapshot: SettingsSnapshot | null;
  baselineCardConfigs: Record<string, CardEditorConfig>;

  /**
   * Baseline card ordering captured at last successful load/save.
   * Used for "Discard changes" and to detect reorder-only edits.
   */
  baselineCardOrder: string[];

  /**
   * Last known server-side version identifier for the user's stored cards.
   * Derived from `CardsRecord.updatedAt` returned by `/api/get-cards`.
   *
   * Used for optimistic concurrency (detecting concurrent edits across tabs).
   */
  serverUpdatedAt: string | null;

  /**
   * Internal dirty trackers so common mutations can update `isDirty`
   * incrementally instead of diffing the full editor snapshot every time.
   */
  isGlobalDirty: boolean;
  isCardOrderDirty: boolean;
  dirtyCardIds: DirtyCardIdMap;

  // Local-only user templates (not persisted to the server)
  settingsTemplates: SettingsTemplateV1[];

  // UI state
  expandedCardId: string | null;

  // Multi-select state
  selectedCardIds: Set<string>;

  // Bulk undo/redo history (bulk operations only)
  bulkPast: BulkHistoryEntry[];
  bulkFuture: BulkHistoryEntry[];
  bulkLastMessage: string | null;

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

  // Reset/restore global settings (colors, border, advanced) to defaults.
  // Accepts optional overrides for testing or targeted resets.
  resetGlobalSettings: (opts?: {
    colorPreset?: string;
    colors?: ColorValue[];
    borderEnabled?: boolean;
    borderColor?: string;
    borderRadius?: number;
    advancedSettings?: Partial<CardAdvancedSettings>;
  }) => void;

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

  // Card ordering actions
  setCardOrder: (order: string[]) => void;
  reorderCardsInScope: (opts: {
    activeId: string;
    overId: string;
    /**
     * Restrict reorder to this set of card IDs (e.g., the cards in a category).
     * When provided, only relative ordering within this set changes.
     */
    scopeIds?: readonly string[];
  }) => void;

  // UI actions
  setExpandedCard: (cardId: string | null) => void;
  toggleExpandedCard: (cardId: string) => void;

  // Multi-select actions
  toggleCardSelection: (cardId: string) => void;
  selectCard: (cardId: string) => void;
  deselectCard: (cardId: string) => void;
  clearSelection: () => void;
  selectAllEnabled: () => void;
  selectCardsByGroup: (groupName: string) => void;

  // Bulk operations
  enableAllCards: () => void;
  disableAllCards: () => void;
  resetCardToGlobal: (cardId: string) => void;
  resetSelectedCardsToGlobal: (cardIds: string[]) => void;
  resetAllCardsToGlobal: () => void;

  // Bulk edit operations
  bulkSetVariant: (
    cardIds: string[],
    variant: string,
    opts?: { skipUnsupported?: boolean },
  ) => { applied: string[]; skipped: string[] };
  bulkApplyColorPreset: (
    cardIds: string[],
    presetName: string,
  ) => { applied: string[] };

  // Bulk undo/redo
  undoBulk: () => void;
  redoBulk: () => void;

  // Save actions
  markDirty: () => void;
  setSaving: (saving: boolean) => void;
  setSaveError: (error: string | null) => void;
  markSaved: (opts?: {
    serverUpdatedAt?: string | null;
    appliedPatch?: LocalEditsPatch | null;
  }) => void;

  /**
   * Discard all unsaved changes and restore the baseline state captured at the
   * last successful load/save.
   */
  discardChanges: () => void;

  /**
   * Apply a patch (typically from local draft restore or conflict merge).
   * The patch values win over the current state.
   */
  applyLocalEditsPatch: (patch: LocalEditsPatch) => void;

  initializeFromServerData: (...args: InitializeFromServerDataArgs) => void;

  // Reset store
  reset: () => void;

  // Settings snapshots and templates
  getGlobalSettingsSnapshot: () => SettingsSnapshot;
  getCardSettingsSnapshot: (cardId: string) => SettingsSnapshot;
  applySettingsSnapshotToGlobal: (snapshot: SettingsSnapshot) => void;
  applySettingsSnapshotToCard: (
    cardId: string,
    snapshot: SettingsSnapshot,
  ) => void;
  copySettingsFromCard: (sourceCardId: string, targetCardId: string) => void;

  createSettingsTemplate: (
    name: string,
    snapshot: SettingsSnapshot,
  ) => SettingsTemplateMutationResult;
  renameSettingsTemplate: (
    templateId: string,
    name: string,
  ) => SettingsTemplateMutationResult;
  deleteSettingsTemplate: (
    templateId: string,
  ) => SettingsTemplateMutationResult;
  applySettingsTemplateToGlobal: (templateId: string) => void;
  applySettingsTemplateToCard: (cardId: string, templateId: string) => void;
  importSettingsTemplates: (
    templates: SettingsTemplateV1[],
  ) => SettingsTemplateMutationResult;
  exportSettingsTemplates: () => SettingsExportV1;

  getEffectiveColors: (cardId: string) => ColorValue[];
  getEffectiveBorderColor: (cardId: string) => string | undefined;
  getEffectiveBorderRadius: (cardId: string) => number;
}

/** Combined store type */
export type UserPageEditorStore = UserPageEditorState & UserPageEditorActions;

export const DEFAULT_BORDER_COLOR = "#e4e2e2";

export function isCardCustomized(config: CardEditorConfig): boolean {
  return (
    config.colorOverride.useCustomSettings ||
    config.borderColor !== undefined ||
    config.borderRadius !== undefined ||
    Object.keys(config.advancedSettings).length > 0
  );
}

type CardTypeMeta = {
  id: string;
  group: string;
  label: string;
  variations: ReadonlyArray<{ id: string; label: string }>;
};

const cardTypeMetaById: ReadonlyMap<string, CardTypeMeta> = new Map(
  statCardTypes.map((t) => [
    t.id,
    {
      id: t.id,
      group: t.group,
      label: t.label,
      variations: t.variations,
    },
  ]),
);

const DEFAULT_CARD_ORDER = statCardTypes.map((t) => t.id);

const BULK_HISTORY_LIMIT = 40;

function generateTemplateId(): string {
  const cryptoObj = globalThis.crypto as Crypto | undefined;
  if (cryptoObj?.randomUUID) return cryptoObj.randomUUID();
  return generateSecureId("tpl");
}

function resolveAdvancedSettings(
  card: CardAdvancedSettings | undefined,
  global: CardAdvancedSettings,
): Required<CardAdvancedSettings> {
  return {
    useStatusColors: card?.useStatusColors ?? global.useStatusColors ?? true,
    showPiePercentages:
      card?.showPiePercentages ?? global.showPiePercentages ?? true,
    showFavorites: card?.showFavorites ?? global.showFavorites ?? true,
    gridCols: card?.gridCols ?? global.gridCols ?? 3,
    gridRows: card?.gridRows ?? global.gridRows ?? 3,
  };
}

function buildGlobalSettingsSnapshot(
  state: UserPageEditorState,
): SettingsSnapshot {
  return {
    colorPreset: state.globalColorPreset,
    colors: (state.globalColors.length === 4
      ? state.globalColors
      : [
          ...state.globalColors,
          ...getPresetColors("default").slice(state.globalColors.length, 4),
        ]) as [ColorValue, ColorValue, ColorValue, ColorValue],
    borderEnabled: state.globalBorderEnabled,
    borderColor: state.globalBorderColor,
    borderRadius: state.globalBorderRadius,
    advancedSettings: { ...state.globalAdvancedSettings },
  };
}

function buildCardSettingsSnapshot(
  state: UserPageEditorState,
  cardId: string,
): SettingsSnapshot {
  const cfg = ensureCardConfig(state, cardId);
  const colors =
    cfg.colorOverride.useCustomSettings && cfg.colorOverride.colors
      ? cfg.colorOverride.colors
      : state.globalColors;

  const preset =
    cfg.colorOverride.useCustomSettings && cfg.colorOverride.colorPreset
      ? cfg.colorOverride.colorPreset
      : state.globalColorPreset;

  const effectiveBorderColor =
    cfg.borderColor ??
    (state.globalBorderEnabled ? state.globalBorderColor : undefined);
  const borderEnabled = Boolean(effectiveBorderColor);
  const borderColor = effectiveBorderColor ?? state.globalBorderColor;

  return {
    colorPreset: preset,
    colors: (colors.length === 4
      ? colors
      : [...colors, ...getPresetColors("default").slice(colors.length, 4)]) as [
      ColorValue,
      ColorValue,
      ColorValue,
      ColorValue,
    ],
    borderEnabled,
    borderColor,
    borderRadius: cfg.borderRadius ?? state.globalBorderRadius,
    advancedSettings: resolveAdvancedSettings(
      cfg.advancedSettings,
      state.globalAdvancedSettings,
    ),
  };
}

export interface BulkHistoryEntry {
  /** Human-friendly summary of the bulk operation, for UI and a11y announcements. */
  label: string;
  /** Card IDs affected by the bulk operation. */
  affectedCardIds: string[];
  /** Snapshot of affected card configs before the bulk operation. */
  before: Record<string, CardEditorConfig>;
  /** Snapshot of affected card configs after the bulk operation. */
  after: Record<string, CardEditorConfig>;
  /** Timestamp (ms) when the operation was applied. */
  at: number;
}

function cloneCardEditorConfig(config: CardEditorConfig): CardEditorConfig {
  return {
    ...config,
    colorOverride: {
      ...config.colorOverride,
      colors: config.colorOverride.colors
        ? [...config.colorOverride.colors]
        : undefined,
    },
    advancedSettings: { ...config.advancedSettings },
  };
}

function normalizeCardOrder(
  order: readonly string[] | undefined,
  allowedIds: readonly string[],
): string[] {
  const allowed = new Set(allowedIds);
  const seen = new Set<string>();
  const next: string[] = [];

  if (order) {
    for (const id of order) {
      if (!allowed.has(id)) continue;
      if (seen.has(id)) continue;
      seen.add(id);
      next.push(id);
    }
  }

  for (const id of allowedIds) {
    if (seen.has(id)) continue;
    seen.add(id);
    next.push(id);
  }

  return next;
}

function areOptionalArraysEqual<T>(
  a: readonly T[] | undefined,
  b: readonly T[] | undefined,
): boolean {
  if (a === b) return true;
  if (!a && !b) return true;
  if (!a || !b) return false;
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) return false;
  }
  return true;
}

function areShallowRecordsEqual(
  a: Record<string, unknown>,
  b: Record<string, unknown>,
): boolean {
  if (a === b) return true;
  const aKeys = Object.keys(a);
  const bKeys = Object.keys(b);
  if (aKeys.length !== bKeys.length) return false;
  for (const k of aKeys) {
    if (a[k] !== b[k]) return false;
  }
  return true;
}

function areCardConfigsEqual(
  a: CardEditorConfig,
  b: CardEditorConfig,
): boolean {
  if (a.enabled !== b.enabled) return false;
  if (a.variant !== b.variant) return false;

  if (a.borderColor !== b.borderColor) return false;
  if (a.borderRadius !== b.borderRadius) return false;

  if (a.colorOverride.useCustomSettings !== b.colorOverride.useCustomSettings)
    return false;
  if (a.colorOverride.colorPreset !== b.colorOverride.colorPreset) return false;
  if (!areOptionalArraysEqual(a.colorOverride.colors, b.colorOverride.colors)) {
    return false;
  }

  // Advanced settings
  if (
    !areShallowRecordsEqual(
      a.advancedSettings as Record<string, unknown>,
      b.advancedSettings as Record<string, unknown>,
    )
  ) {
    return false;
  }

  return true;
}

function areSettingsSnapshotsEqual(
  a: SettingsSnapshot,
  b: SettingsSnapshot,
): boolean {
  if (a.colorPreset !== b.colorPreset) return false;
  if (a.borderEnabled !== b.borderEnabled) return false;
  if (a.borderColor !== b.borderColor) return false;
  if (a.borderRadius !== b.borderRadius) return false;

  // Colors
  for (let i = 0; i < 4; i++) {
    if (a.colors[i] !== b.colors[i]) return false;
  }

  // Advanced
  const aAdv = a.advancedSettings ?? {};
  const bAdv = b.advancedSettings ?? {};
  if (
    !areShallowRecordsEqual(
      aAdv as Record<string, unknown>,
      bAdv as Record<string, unknown>,
    )
  ) {
    return false;
  }

  return true;
}

function doesCardInheritGlobalSettings(config: CardEditorConfig): boolean {
  return (
    !config.colorOverride.useCustomSettings &&
    config.borderColor === undefined &&
    config.borderRadius === undefined &&
    Object.keys(config.advancedSettings).length === 0
  );
}

function isVariantSupportedForCard(cardId: string, variantId: string): boolean {
  const meta = cardTypeMetaById.get(cardId);
  if (!meta) return true;
  return meta.variations.some((v) => v.id === variantId);
}

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
 * This is critical for new users, minimal explicit-config records, or missing
 * Redis records, so bulk actions like "Enable All" can operate on a complete
 * set.
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
 * Removes unknown card IDs from the editor state when an allowlist is provided.
 *
 * This helps handle legacy/removed card types that may still exist in persisted
 * storage without letting them affect bulk operations or selection state.
 * @source
 */
function pruneUnknownCardConfigs(
  cardConfigs: Record<string, CardEditorConfig>,
  allCardIds?: readonly string[],
): Record<string, CardEditorConfig> {
  if (!allCardIds || allCardIds.length === 0) return cardConfigs;

  const allowed = new Set(allCardIds);

  let hasUnknown = false;
  for (const cardId of Object.keys(cardConfigs)) {
    if (!allowed.has(cardId)) {
      hasUnknown = true;
      break;
    }
  }
  if (!hasUnknown) return cardConfigs;

  const next: Record<string, CardEditorConfig> = {};
  for (const cardId of allCardIds) {
    const config = cardConfigs[cardId];
    if (config) next[cardId] = config;
  }

  return next;
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

  const borderEnabled =
    typeof firstCard.borderColor === "string" &&
    firstCard.borderColor.length > 0;
  const borderColor = firstCard.borderColor || DEFAULT_BORDER_COLOR;
  const borderRadius =
    typeof firstCard.borderRadius === "number"
      ? clampBorderRadius(firstCard.borderRadius)
      : DEFAULT_CARD_BORDER_RADIUS;

  return { preset, colors, borderEnabled, borderColor, borderRadius };
}

/**
 * Converts a server card to an editor config.
 * @source
 */
function serverCardToEditorConfig(options: {
  card: ServerCardData;
  globalPreset: string;
  globalColors: ColorValue[];
  globalBorderColor: string;
  globalBorderRadius: number;
}): CardEditorConfig {
  const {
    card,
    globalPreset,
    globalColors,
    globalBorderColor,
    globalBorderRadius,
  } = options;

  // If useCustomSettings is explicitly set from server, use that value
  // Otherwise, fall back to heuristic detection for backwards compatibility
  let hasCustomColors: boolean;

  if (typeof card.useCustomSettings === "boolean") {
    // Trust the explicit flag from the server
    hasCustomColors = card.useCustomSettings;
  } else {
    // Legacy heuristic: detect custom colors based on color differences

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

  // Normalize incoming per-card radius and omit it when it matches global radius
  const cardBorderRadiusValue =
    typeof card.borderRadius === "number"
      ? clampBorderRadius(card.borderRadius)
      : undefined;

  return {
    cardId: card.cardName,
    enabled,
    variant: card.variation || "default",
    colorOverride,
    // Only hydrate per-card advanced settings when the card explicitly uses
    // custom settings. Otherwise, these should inherit from the global
    // advanced settings and not "lock in" stale values.
    advancedSettings: colorOverride.useCustomSettings
      ? {
          useStatusColors: card.useStatusColors,
          showPiePercentages: card.showPiePercentages,
          showFavorites: card.showFavorites,
          gridCols: card.gridCols,
          gridRows: card.gridRows,
        }
      : {},
    borderColor:
      card.borderColor === globalBorderColor ? undefined : card.borderColor,
    borderRadius:
      cardBorderRadiusValue === globalBorderRadius
        ? undefined
        : cardBorderRadiusValue,
  };
}

/** Default global advanced settings. */
const DEFAULT_GLOBAL_ADVANCED_SETTINGS: CardAdvancedSettings = {
  useStatusColors: true,
  showPiePercentages: true,
  showFavorites: true,
  gridCols: 3,
  gridRows: 3,
};

/** Default combined global settings. */
export const DEFAULT_GLOBAL_SETTINGS = {
  colorPreset: "default",
  borderEnabled: false,
  borderColor: DEFAULT_BORDER_COLOR,
  borderRadius: DEFAULT_CARD_BORDER_RADIUS,
  advancedSettings: DEFAULT_GLOBAL_ADVANCED_SETTINGS,
} as const;

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
        ? clampBorderRadius(serverGlobalSettings.borderRadius)
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
    cardConfigs[card.cardName] = serverCardToEditorConfig({
      card,
      globalPreset,
      globalColors,
      globalBorderColor,
      globalBorderRadius,
    });
  }

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
  cardOrder: [...DEFAULT_CARD_ORDER],
  baselineGlobalSnapshot: null,
  baselineCardConfigs: {},
  baselineCardOrder: [...DEFAULT_CARD_ORDER],
  serverUpdatedAt: null,
  isGlobalDirty: false,
  isCardOrderDirty: false,
  dirtyCardIds: {},
  settingsTemplates: readSettingsTemplatesFromStorage(),
  expandedCardId: null,
  selectedCardIds: new Set(),
  bulkPast: [],
  bulkFuture: [],
  bulkLastMessage: null,
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
    (set, get) => {
      const applyBulkCardConfigTransaction = (opts: {
        actionName: string;
        cardIds: readonly string[];
        update: (
          existing: CardEditorConfig,
          cardId: string,
        ) => CardEditorConfig | null;
        shouldSkip?: (existing: CardEditorConfig, cardId: string) => boolean;
        buildLabel: (ctx: {
          totalRequested: number;
          changedCount: number;
          skippedCount: number;
        }) => string;
      }): { changedIds: string[]; skippedIds: string[] } => {
        const snapshot = get();
        const uniqueCardIds = Array.from(new Set(opts.cardIds));
        const before: Record<string, CardEditorConfig> = {};
        const after: Record<string, CardEditorConfig> = {};
        const changedIds: string[] = [];
        const skippedIds: string[] = [];

        let nextCardConfigs: Record<string, CardEditorConfig> | null = null;

        for (const cardId of uniqueCardIds) {
          const existing = ensureCardConfig(snapshot, cardId);

          if (opts.shouldSkip?.(existing, cardId)) {
            skippedIds.push(cardId);
            continue;
          }

          const updated = opts.update(existing, cardId);
          if (!updated) continue;

          nextCardConfigs ??= { ...snapshot.cardConfigs };
          before[cardId] = cloneCardEditorConfig(existing);
          after[cardId] = cloneCardEditorConfig(updated);
          nextCardConfigs[cardId] = updated;
          changedIds.push(cardId);
        }

        if (!nextCardConfigs || changedIds.length === 0) {
          return { changedIds: [], skippedIds };
        }

        const label = opts.buildLabel({
          totalRequested: uniqueCardIds.length,
          changedCount: changedIds.length,
          skippedCount: skippedIds.length,
        });

        const entry: BulkHistoryEntry = {
          label,
          affectedCardIds: changedIds,
          before,
          after,
          at: Date.now(),
        };

        const nextPast = [...snapshot.bulkPast, entry].slice(
          -BULK_HISTORY_LIMIT,
        );

        setWithDirty(
          {
            cardConfigs: nextCardConfigs,
            bulkPast: nextPast,
            bulkFuture: [],
            bulkLastMessage: `Applied: ${label}`,
          },
          opts.actionName,
          { cardIds: changedIds },
        );

        return { changedIds, skippedIds };
      };

      type DirtyChangeScope = {
        global?: boolean;
        cardOrder?: boolean;
        cardIds?: readonly string[];
      };

      const updateDirtyCardIds = (
        currentDirtyCardIds: DirtyCardIdMap,
        candidate: UserPageEditorState,
        cardIds: readonly string[],
      ): DirtyCardIdMap => {
        let nextDirtyCardIds = currentDirtyCardIds;

        for (const cardId of cardIds) {
          const isDirtyCard = computeCardDirtyFlag(candidate, cardId);
          const wasDirty = currentDirtyCardIds[cardId] === true;

          if (isDirtyCard === wasDirty) continue;

          if (nextDirtyCardIds === currentDirtyCardIds) {
            nextDirtyCardIds = { ...currentDirtyCardIds };
          }

          if (isDirtyCard) {
            nextDirtyCardIds[cardId] = true;
          } else {
            delete nextDirtyCardIds[cardId];
          }
        }

        return nextDirtyCardIds;
      };

      const recomputeDirtyState = (candidate: UserPageEditorState) => {
        const nextGlobalDirty = computeGlobalDirtyFlag(candidate);
        const nextCardOrderDirty = computeCardOrderDirtyFlag(candidate);
        const nextDirtyCardIds = buildDirtyCardIdMapByFullDiff(candidate);

        return {
          nextGlobalDirty,
          nextCardOrderDirty,
          nextDirtyCardIds,
          isDirty:
            nextGlobalDirty ||
            nextCardOrderDirty ||
            hasDirtyCardIds(nextDirtyCardIds),
        };
      };

      // Helper: update `isDirty` by touching only the fields that changed.
      // Callers can omit `scope` to fall back to a full recompute.
      const setWithDirty = (
        next: Partial<UserPageEditorState>,
        actionName?: string,
        scope?: DirtyChangeScope,
      ) => {
        const snapshot = get();
        const candidate = { ...snapshot, ...next } as UserPageEditorState;

        if (!scope) {
          const recomputed = recomputeDirtyState(candidate);
          set(
            {
              ...next,
              isDirty: recomputed.isDirty,
              isGlobalDirty: recomputed.nextGlobalDirty,
              isCardOrderDirty: recomputed.nextCardOrderDirty,
              dirtyCardIds: recomputed.nextDirtyCardIds,
            },
            false,
            actionName ?? "setWithDirty",
          );
          return;
        }

        const nextGlobalDirty =
          scope.global === true
            ? computeGlobalDirtyFlag(candidate)
            : snapshot.isGlobalDirty;
        const nextCardOrderDirty =
          scope.cardOrder === true
            ? computeCardOrderDirtyFlag(candidate)
            : snapshot.isCardOrderDirty;
        const nextDirtyCardIds =
          scope.cardIds && scope.cardIds.length > 0
            ? updateDirtyCardIds(
                snapshot.dirtyCardIds,
                candidate,
                scope.cardIds,
              )
            : snapshot.dirtyCardIds;
        const dirty =
          nextGlobalDirty ||
          nextCardOrderDirty ||
          hasDirtyCardIds(nextDirtyCardIds);

        set(
          {
            ...next,
            isDirty: dirty,
            isGlobalDirty: nextGlobalDirty,
            isCardOrderDirty: nextCardOrderDirty,
            dirtyCardIds: nextDirtyCardIds,
          },
          false,
          actionName ?? "setWithDirty",
        );
      };

      const persistSettingsTemplates = (
        templates: SettingsTemplateV1[],
      ): SettingsTemplateMutationResult => {
        const persistenceResult = writeSettingsTemplatesToStorage(templates);
        if (!persistenceResult.ok) {
          return persistenceResult;
        }

        return { ok: true };
      };

      return {
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
          setWithDirty(
            {
              globalColorPreset: presetName,
              globalColors: colors,
            },
            "setGlobalColorPreset",
            { global: true },
          );
        },

        setGlobalColors: (colors) => {
          setWithDirty(
            {
              globalColors: colors,
              globalColorPreset: "custom",
            },
            "setGlobalColors",
            { global: true },
          );
        },

        setGlobalColor: (index, color) => {
          const { globalColors } = get();
          const newColors = [...globalColors];
          newColors[index] = color;
          setWithDirty(
            {
              globalColors: newColors,
              globalColorPreset: "custom",
            },
            "setGlobalColor",
            { global: true },
          );
        },

        // Global border actions
        setGlobalBorderEnabled: (enabled) => {
          setWithDirty(
            { globalBorderEnabled: enabled },
            "setGlobalBorderEnabled",
            { global: true },
          );
        },

        setGlobalBorderColor: (color) => {
          setWithDirty({ globalBorderColor: color }, "setGlobalBorderColor", {
            global: true,
          });
        },

        setGlobalBorderRadius: (radius) => {
          const clamped = clampBorderRadius(radius);
          setWithDirty(
            { globalBorderRadius: clamped },
            "setGlobalBorderRadius",
            { global: true },
          );
        },

        // Global advanced settings actions
        setGlobalAdvancedSetting: (key, value) => {
          const { globalAdvancedSettings } = get();
          setWithDirty(
            {
              globalAdvancedSettings: {
                ...globalAdvancedSettings,
                [key]: value,
              },
            },
            "setGlobalAdvancedSetting",
            { global: true },
          );
        },

        // Reset/restore global settings to defaults (shallow merge).
        resetGlobalSettings: (opts?: {
          colorPreset?: string;
          colors?: ColorValue[];
          borderEnabled?: boolean;
          borderColor?: string;
          borderRadius?: number;
          advancedSettings?: Partial<CardAdvancedSettings>;
        }) => {
          const preset =
            opts?.colorPreset ?? DEFAULT_GLOBAL_SETTINGS.colorPreset;
          const colors = opts?.colors ?? getPresetColors(preset);
          setWithDirty(
            {
              globalColorPreset: preset,
              globalColors: colors,
              globalBorderEnabled:
                opts?.borderEnabled ?? DEFAULT_GLOBAL_SETTINGS.borderEnabled,
              globalBorderColor:
                opts?.borderColor ?? DEFAULT_GLOBAL_SETTINGS.borderColor,
              globalBorderRadius:
                opts?.borderRadius ?? DEFAULT_GLOBAL_SETTINGS.borderRadius,
              globalAdvancedSettings: {
                ...DEFAULT_GLOBAL_SETTINGS.advancedSettings,
                ...opts?.advancedSettings,
              },
            },
            "resetGlobalSettings",
            { global: true },
          );
        },

        // Card configuration actions
        setCardEnabled: (cardId, enabled) => {
          const { cardConfigs } = get();
          const existing = ensureCardConfig(get(), cardId);
          const nextCardConfigs = {
            ...cardConfigs,
            [cardId]: { ...existing, enabled },
          };
          setWithDirty({ cardConfigs: nextCardConfigs }, "setCardEnabled", {
            cardIds: [cardId],
          });
        },

        setCardVariant: (cardId, variant) => {
          const { cardConfigs } = get();
          const existing = ensureCardConfig(get(), cardId);
          const nextCardConfigs = {
            ...cardConfigs,
            [cardId]: { ...existing, variant },
          };
          setWithDirty({ cardConfigs: nextCardConfigs }, "setCardVariant", {
            cardIds: [cardId],
          });
        },

        toggleCardCustomColors: (cardId, useCustom) => {
          const { cardConfigs, globalColors, globalColorPreset } = get();
          const existing = ensureCardConfig(get(), cardId);
          const nextCardConfigs = {
            ...cardConfigs,
            [cardId]: {
              ...existing,
              colorOverride: {
                ...existing.colorOverride,
                useCustomSettings: useCustom,
                colors: useCustom
                  ? existing.colorOverride.colors || [...globalColors]
                  : existing.colorOverride.colors,
                colorPreset: useCustom
                  ? existing.colorOverride.colorPreset || globalColorPreset
                  : existing.colorOverride.colorPreset,
              },
            },
          };
          setWithDirty(
            { cardConfigs: nextCardConfigs },
            "toggleCardCustomColors",
            { cardIds: [cardId] },
          );
        },

        setCardColorPreset: (cardId, presetName) => {
          const { cardConfigs } = get();
          const existing = ensureCardConfig(get(), cardId);
          const colors = getPresetColors(presetName);
          const nextCardConfigs = {
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
          };
          setWithDirty({ cardConfigs: nextCardConfigs }, "setCardColorPreset", {
            cardIds: [cardId],
          });
        },

        setCardColors: (cardId, colors) => {
          const { cardConfigs } = get();
          const existing = ensureCardConfig(get(), cardId);
          const nextCardConfigs = {
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
          };
          setWithDirty({ cardConfigs: nextCardConfigs }, "setCardColors", {
            cardIds: [cardId],
          });
        },

        setCardColor: (cardId, index, color) => {
          const { cardConfigs, globalColors } = get();
          const existing = ensureCardConfig(get(), cardId);
          const currentColors = existing.colorOverride.colors || [
            ...globalColors,
          ];
          const newColors = [...currentColors];
          newColors[index] = color;
          const nextCardConfigs = {
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
          };
          setWithDirty({ cardConfigs: nextCardConfigs }, "setCardColor", {
            cardIds: [cardId],
          });
        },

        setCardAdvancedSetting: (cardId, key, value) => {
          const { cardConfigs } = get();
          const existing = ensureCardConfig(get(), cardId);
          const nextCardConfigs = {
            ...cardConfigs,
            [cardId]: {
              ...existing,
              advancedSettings: {
                ...existing.advancedSettings,
                [key]: value,
              },
            },
          };
          setWithDirty(
            { cardConfigs: nextCardConfigs },
            "setCardAdvancedSetting",
            { cardIds: [cardId] },
          );
        },

        setCardBorderColor: (cardId, color) => {
          const { cardConfigs } = get();
          const existing = ensureCardConfig(get(), cardId);
          const nextCardConfigs = {
            ...cardConfigs,
            [cardId]: { ...existing, borderColor: color },
          };
          setWithDirty({ cardConfigs: nextCardConfigs }, "setCardBorderColor", {
            cardIds: [cardId],
          });
        },

        setCardBorderRadius: (cardId, radius) => {
          const { cardConfigs } = get();
          const existing = ensureCardConfig(get(), cardId);
          const newRadius =
            typeof radius === "number" ? clampBorderRadius(radius) : undefined;
          const nextCardConfigs = {
            ...cardConfigs,
            [cardId]: { ...existing, borderRadius: newRadius },
          };
          setWithDirty(
            { cardConfigs: nextCardConfigs },
            "setCardBorderRadius",
            { cardIds: [cardId] },
          );
        },

        setCardOrder: (order) => {
          const snapshot = get();
          const allowedIds =
            Object.keys(snapshot.cardConfigs).length > 0
              ? Object.keys(snapshot.cardConfigs)
              : DEFAULT_CARD_ORDER;
          const nextOrder = normalizeCardOrder(order, allowedIds);
          setWithDirty({ cardOrder: nextOrder }, "setCardOrder", {
            cardOrder: true,
          });
        },

        reorderCardsInScope: ({ activeId, overId, scopeIds }) => {
          if (!activeId || !overId || activeId === overId) return;

          const snapshot = get();
          const allowedIds =
            Object.keys(snapshot.cardConfigs).length > 0
              ? Object.keys(snapshot.cardConfigs)
              : DEFAULT_CARD_ORDER;

          const currentOrder = normalizeCardOrder(
            snapshot.cardOrder,
            allowedIds,
          );

          const scopeSet = scopeIds ? new Set(scopeIds) : null;
          const scope = scopeSet
            ? currentOrder.filter((id) => scopeSet.has(id))
            : currentOrder;

          const fromIndex = scope.indexOf(activeId);
          const toIndex = scope.indexOf(overId);
          if (fromIndex < 0 || toIndex < 0) return;

          const nextScope = scope.slice();
          const [moved] = nextScope.splice(fromIndex, 1);
          nextScope.splice(toIndex, 0, moved);

          const nextOrder: string[] = [];
          if (scopeSet) {
            let i = 0;
            for (const id of currentOrder) {
              if (scopeSet.has(id)) {
                nextOrder.push(nextScope[i] ?? id);
                i += 1;
              } else {
                nextOrder.push(id);
              }
            }
          } else {
            nextOrder.push(...nextScope);
          }

          setWithDirty({ cardOrder: nextOrder }, "reorderCardsInScope", {
            cardOrder: true,
          });
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

        selectCardsByGroup: (groupName) => {
          const { cardConfigs } = get();
          const ids: string[] = [];

          if (groupName === "All") {
            for (const config of Object.values(cardConfigs)) {
              ids.push(config.cardId);
            }
          } else {
            for (const config of Object.values(cardConfigs)) {
              const group = cardTypeMetaById.get(config.cardId)?.group ?? "All";
              if (group === groupName) ids.push(config.cardId);
            }
          }

          set({ selectedCardIds: new Set(ids) }, false, "selectCardsByGroup");
        },

        // Bulk operations
        enableAllCards: () => {
          const { cardConfigs } = get();
          applyBulkCardConfigTransaction({
            actionName: "enableAllCards",
            cardIds: Object.keys(cardConfigs),
            update: (existing) =>
              existing.enabled ? null : { ...existing, enabled: true },
            buildLabel: ({ changedCount }) =>
              changedCount === 0
                ? "Enable all cards"
                : `Enabled ${changedCount} cards`,
          });
        },

        disableAllCards: () => {
          const { cardConfigs } = get();
          applyBulkCardConfigTransaction({
            actionName: "disableAllCards",
            cardIds: Object.keys(cardConfigs),
            update: (existing) =>
              existing.enabled ? { ...existing, enabled: false } : null,
            buildLabel: ({ changedCount }) =>
              changedCount === 0
                ? "Disable all cards"
                : `Disabled ${changedCount} cards`,
          });
        },

        resetCardToGlobal: (cardId) => {
          const { cardConfigs } = get();
          const existing = ensureCardConfig(get(), cardId);
          const nextCardConfigs = {
            ...cardConfigs,
            [cardId]: {
              ...existing,
              colorOverride: { useCustomSettings: false },
              borderColor: undefined,
              borderRadius: undefined,
              advancedSettings: {},
            },
          };
          setWithDirty({ cardConfigs: nextCardConfigs }, "resetCardToGlobal", {
            cardIds: [cardId],
          });
        },

        resetSelectedCardsToGlobal: (cardIds) => {
          applyBulkCardConfigTransaction({
            actionName: "resetSelectedCardsToGlobal",
            cardIds,
            update: (existing) => {
              const alreadyGlobal =
                !existing.colorOverride.useCustomSettings &&
                existing.borderColor === undefined &&
                existing.borderRadius === undefined &&
                Object.keys(existing.advancedSettings).length === 0;
              if (alreadyGlobal) return null;

              return {
                ...existing,
                colorOverride: { useCustomSettings: false },
                borderColor: undefined,
                borderRadius: undefined,
                advancedSettings: {},
              };
            },
            buildLabel: ({ changedCount }) =>
              changedCount === 0
                ? "Reset selected cards to global"
                : `Reset ${changedCount} cards to global`,
          });
        },

        resetAllCardsToGlobal: () => {
          const { cardConfigs } = get();
          applyBulkCardConfigTransaction({
            actionName: "resetAllCardsToGlobal",
            cardIds: Object.keys(cardConfigs),
            update: (existing) => {
              const alreadyGlobal =
                !existing.colorOverride.useCustomSettings &&
                existing.borderColor === undefined &&
                existing.borderRadius === undefined &&
                Object.keys(existing.advancedSettings).length === 0;
              if (alreadyGlobal) return null;

              return {
                ...existing,
                colorOverride: { useCustomSettings: false },
                borderColor: undefined,
                borderRadius: undefined,
                advancedSettings: {},
              };
            },
            buildLabel: ({ changedCount }) =>
              changedCount === 0
                ? "Reset all cards to global"
                : `Reset ${changedCount} cards to global`,
          });
        },

        bulkSetVariant: (cardIds, variant, opts) => {
          const skipUnsupported = opts?.skipUnsupported ?? true;
          const { changedIds, skippedIds } = applyBulkCardConfigTransaction({
            actionName: "bulkSetVariant",
            cardIds,
            shouldSkip: (_existing, cardId) =>
              skipUnsupported && !isVariantSupportedForCard(cardId, variant),
            update: (existing) =>
              existing.variant === variant ? null : { ...existing, variant },
            buildLabel: ({ changedCount, skippedCount }) => {
              if (changedCount === 0 && skippedCount > 0) {
                return `Set variant to "${variant}" (0 changed, ${skippedCount} unsupported)`;
              }
              if (skippedCount > 0) {
                return `Set variant to "${variant}" (${changedCount} changed, ${skippedCount} unsupported)`;
              }
              return `Set variant to "${variant}" (${changedCount} cards)`;
            },
          });

          return { applied: changedIds, skipped: skippedIds };
        },

        bulkApplyColorPreset: (cardIds, presetName) => {
          const presetColors = getPresetColors(presetName);

          const { changedIds } = applyBulkCardConfigTransaction({
            actionName: "bulkApplyColorPreset",
            cardIds,
            update: (existing) => {
              const current = existing.colorOverride;
              const already =
                current.useCustomSettings &&
                current.colorPreset === presetName &&
                Array.isArray(current.colors) &&
                current.colors.length === presetColors.length &&
                current.colors.every((c, i) => c === presetColors[i]);
              if (already) return null;

              return {
                ...existing,
                colorOverride: {
                  ...existing.colorOverride,
                  useCustomSettings: true,
                  colorPreset: presetName,
                  colors: [...presetColors],
                },
              };
            },
            buildLabel: ({ changedCount }) =>
              changedCount === 0
                ? `Apply preset "${presetName}"`
                : `Applied preset "${presetName}" to ${changedCount} cards`,
          });

          return { applied: changedIds };
        },

        undoBulk: () => {
          const snapshot = get();
          const entry = snapshot.bulkPast.at(-1);
          if (!entry) return;

          const nextPast = snapshot.bulkPast.slice(0, -1);
          const nextFuture = [entry, ...snapshot.bulkFuture].slice(
            0,
            BULK_HISTORY_LIMIT,
          );

          const nextCardConfigs: Record<string, CardEditorConfig> = {
            ...snapshot.cardConfigs,
          };
          for (const [cardId, cfg] of Object.entries(entry.before)) {
            nextCardConfigs[cardId] = cloneCardEditorConfig(cfg);
          }

          setWithDirty(
            {
              cardConfigs: nextCardConfigs,
              bulkPast: nextPast,
              bulkFuture: nextFuture,
              bulkLastMessage: `Undid: ${entry.label}`,
            },
            "undoBulk",
            { cardIds: entry.affectedCardIds },
          );
        },

        redoBulk: () => {
          const snapshot = get();
          const entry = snapshot.bulkFuture[0];
          if (!entry) return;

          const nextFuture = snapshot.bulkFuture.slice(1);
          const nextPast = [...snapshot.bulkPast, entry].slice(
            -BULK_HISTORY_LIMIT,
          );

          const nextCardConfigs: Record<string, CardEditorConfig> = {
            ...snapshot.cardConfigs,
          };
          for (const [cardId, cfg] of Object.entries(entry.after)) {
            nextCardConfigs[cardId] = cloneCardEditorConfig(cfg);
          }

          setWithDirty(
            {
              cardConfigs: nextCardConfigs,
              bulkPast: nextPast,
              bulkFuture: nextFuture,
              bulkLastMessage: `Redid: ${entry.label}`,
            },
            "redoBulk",
            { cardIds: entry.affectedCardIds },
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

        markSaved: (opts) => {
          const snapshot = get();

          // The patch that was actually applied as part of this save operation.
          // When provided, update baselines *only* for the fields that were
          // persisted to the server. This ensures that changes made while a
          // save was in-flight are not accidentally cleared as "saved".
          const applied: LocalEditsPatch | null = opts?.appliedPatch ?? null;

          let nextBaselineGlobal = snapshot.baselineGlobalSnapshot;
          const nextBaselineCardConfigs = { ...snapshot.baselineCardConfigs };
          let nextBaselineCardOrder = [...snapshot.baselineCardOrder];

          if (applied?.globalSnapshot) {
            nextBaselineGlobal = applied.globalSnapshot;
          }

          if (applied?.cardConfigs) {
            for (const [id, cfg] of Object.entries(applied.cardConfigs)) {
              nextBaselineCardConfigs[id] = cloneCardEditorConfig(cfg);
            }
          }

          if (applied?.cardOrder) {
            nextBaselineCardOrder = [...applied.cardOrder];
          }

          const touchedCardIds = applied?.cardConfigs
            ? Object.keys(applied.cardConfigs)
            : [];
          const nextState = {
            baselineGlobalSnapshot: nextBaselineGlobal,
            baselineCardConfigs: nextBaselineCardConfigs,
            baselineCardOrder: nextBaselineCardOrder,
            isSaving: false,
            saveError: null,
            lastSavedAt: Date.now(),
            serverUpdatedAt: opts?.serverUpdatedAt ?? snapshot.serverUpdatedAt,
          } satisfies Partial<UserPageEditorState>;
          const candidate = {
            ...snapshot,
            ...nextState,
          } as UserPageEditorState;
          const nextGlobalDirty = applied?.globalSnapshot
            ? computeGlobalDirtyFlag(candidate)
            : snapshot.isGlobalDirty;
          const nextCardOrderDirty = applied?.cardOrder
            ? computeCardOrderDirtyFlag(candidate)
            : snapshot.isCardOrderDirty;
          const nextDirtyCardIds =
            touchedCardIds.length > 0
              ? updateDirtyCardIds(
                  snapshot.dirtyCardIds,
                  candidate,
                  touchedCardIds,
                )
              : snapshot.dirtyCardIds;
          const dirty =
            nextGlobalDirty ||
            nextCardOrderDirty ||
            hasDirtyCardIds(nextDirtyCardIds);

          set(
            {
              ...nextState,
              isDirty: dirty,
              isGlobalDirty: nextGlobalDirty,
              isCardOrderDirty: nextCardOrderDirty,
              dirtyCardIds: nextDirtyCardIds,
            },
            false,
            "markSaved",
          );
        },

        discardChanges: () => {
          const snapshot = get();
          const baselineGlobal = snapshot.baselineGlobalSnapshot;

          if (!baselineGlobal) return;

          const preset = baselineGlobal.colorPreset || "custom";
          const nextColors =
            preset === "custom"
              ? [...baselineGlobal.colors]
              : getPresetColors(preset);

          const nextAdvanced: CardAdvancedSettings = {
            ...DEFAULT_GLOBAL_ADVANCED_SETTINGS,
            ...baselineGlobal.advancedSettings,
          };
          if (typeof nextAdvanced.gridCols === "number") {
            nextAdvanced.gridCols = Math.max(
              1,
              Math.min(5, nextAdvanced.gridCols),
            );
          }
          if (typeof nextAdvanced.gridRows === "number") {
            nextAdvanced.gridRows = Math.max(
              1,
              Math.min(5, nextAdvanced.gridRows),
            );
          }

          const nextCardConfigs: Record<string, CardEditorConfig> =
            Object.fromEntries(
              Object.entries(snapshot.baselineCardConfigs).map(([id, cfg]) => [
                id,
                cloneCardEditorConfig(cfg),
              ]),
            );

          set(
            {
              globalColorPreset: preset,
              globalColors: nextColors,
              globalBorderEnabled: Boolean(baselineGlobal.borderEnabled),
              globalBorderColor:
                baselineGlobal.borderColor || DEFAULT_BORDER_COLOR,
              globalBorderRadius: clampBorderRadius(
                baselineGlobal.borderRadius,
              ),
              globalAdvancedSettings: nextAdvanced,
              cardConfigs: nextCardConfigs,
              cardOrder: [...snapshot.baselineCardOrder],
              isDirty: false,
              isGlobalDirty: false,
              isCardOrderDirty: false,
              dirtyCardIds: {},
              isSaving: false,
              saveError: null,
              selectedCardIds: new Set(),
              bulkPast: [],
              bulkFuture: [],
              bulkLastMessage: "Discarded changes",
            },
            false,
            "discardChanges",
          );
        },

        applyLocalEditsPatch: (patch) => {
          const snapshot = get();
          const next: Partial<UserPageEditorState> = {
            saveError: null,
          };

          if (patch.globalSnapshot) {
            const gs = patch.globalSnapshot;
            const preset = gs.colorPreset || "custom";
            next.globalColorPreset = preset;
            next.globalColors =
              preset === "custom" ? [...gs.colors] : getPresetColors(preset);
            next.globalBorderEnabled = Boolean(gs.borderEnabled);
            next.globalBorderColor = gs.borderColor || DEFAULT_BORDER_COLOR;
            next.globalBorderRadius = clampBorderRadius(gs.borderRadius);

            const adv: CardAdvancedSettings = {
              ...DEFAULT_GLOBAL_ADVANCED_SETTINGS,
              ...gs.advancedSettings,
            };
            if (typeof adv.gridCols === "number") {
              adv.gridCols = Math.max(1, Math.min(5, adv.gridCols));
            }
            if (typeof adv.gridRows === "number") {
              adv.gridRows = Math.max(1, Math.min(5, adv.gridRows));
            }
            next.globalAdvancedSettings = adv;
          }

          if (patch.cardConfigs) {
            const merged: Record<string, CardEditorConfig> = {
              ...snapshot.cardConfigs,
            };
            for (const [cardId, cfg] of Object.entries(patch.cardConfigs)) {
              merged[cardId] = cloneCardEditorConfig(cfg);
            }
            next.cardConfigs = merged;
          }

          if (patch.cardOrder && Array.isArray(patch.cardOrder)) {
            const mergedConfigs = next.cardConfigs ?? snapshot.cardConfigs;
            const allowedIds =
              Object.keys(mergedConfigs).length > 0
                ? Object.keys(mergedConfigs)
                : DEFAULT_CARD_ORDER;
            next.cardOrder = normalizeCardOrder(patch.cardOrder, allowedIds);
          }
          setWithDirty(next, "applyLocalEditsPatch", {
            global: patch.globalSnapshot !== undefined,
            cardIds: patch.cardConfigs
              ? Object.keys(patch.cardConfigs)
              : undefined,
            cardOrder: patch.cardOrder !== undefined,
          });
        },

        initializeFromServerData: (...args: InitializeFromServerDataArgs) => {
          const [
            userId,
            username,
            avatarUrl,
            cards,
            globalSettings,
            allCardIds,
            serverUpdatedAt,
            cardOrder,
          ] = args;

          const result = processServerCards(cards, globalSettings);
          const seededCardConfigs = seedMissingCardConfigs(
            result.cardConfigs,
            allCardIds,
          );
          const prunedCardConfigs = pruneUnknownCardConfigs(
            seededCardConfigs,
            allCardIds,
          );

          const allowedIds =
            allCardIds && allCardIds.length > 0
              ? allCardIds
              : DEFAULT_CARD_ORDER;

          const serverOrder =
            cardOrder && cardOrder.length > 0
              ? cardOrder
              : cards.map((c) => c.cardName);
          const nextCardOrder = normalizeCardOrder(serverOrder, allowedIds);

          const nextBaselineGlobal = buildGlobalSettingsSnapshot({
            ...initialState,
            globalColorPreset: result.globalPreset,
            globalColors: result.globalColors,
            globalBorderEnabled: result.globalBorderEnabled,
            globalBorderColor: result.globalBorderColor,
            globalBorderRadius: result.globalBorderRadius,
            globalAdvancedSettings: result.globalAdvancedSettings,
          });

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
              cardConfigs: prunedCardConfigs,
              cardOrder: nextCardOrder,
              baselineGlobalSnapshot: nextBaselineGlobal,
              baselineCardConfigs: Object.fromEntries(
                Object.entries(prunedCardConfigs).map(([id, cfg]) => [
                  id,
                  cloneCardEditorConfig(cfg),
                ]),
              ),
              baselineCardOrder: [...nextCardOrder],
              serverUpdatedAt: serverUpdatedAt ?? null,
              isLoading: false,
              loadError: null,
              isDirty: false,
              isGlobalDirty: false,
              isCardOrderDirty: false,
              dirtyCardIds: {},
              bulkPast: [],
              bulkFuture: [],
              bulkLastMessage: null,
            },
            false,
            "initializeFromServerData",
          );
        },

        // Reset store
        reset: () => {
          set(initialState, false, "reset");
        },

        getGlobalSettingsSnapshot: () => {
          return buildGlobalSettingsSnapshot(get());
        },

        getCardSettingsSnapshot: (cardId) => {
          return buildCardSettingsSnapshot(get(), cardId);
        },

        applySettingsSnapshotToGlobal: (snapshot) => {
          const preset = snapshot.colorPreset || "custom";
          const nextColors =
            preset === "custom"
              ? [...snapshot.colors]
              : getPresetColors(preset);

          const nextAdvanced: CardAdvancedSettings = {
            ...DEFAULT_GLOBAL_ADVANCED_SETTINGS,
            ...snapshot.advancedSettings,
          };
          if (typeof nextAdvanced.gridCols === "number") {
            nextAdvanced.gridCols = Math.max(
              1,
              Math.min(5, nextAdvanced.gridCols),
            );
          }
          if (typeof nextAdvanced.gridRows === "number") {
            nextAdvanced.gridRows = Math.max(
              1,
              Math.min(5, nextAdvanced.gridRows),
            );
          }

          setWithDirty(
            {
              globalColorPreset: preset,
              globalColors: nextColors,
              globalBorderEnabled: Boolean(snapshot.borderEnabled),
              globalBorderColor: snapshot.borderColor || DEFAULT_BORDER_COLOR,
              globalBorderRadius: clampBorderRadius(snapshot.borderRadius),
              globalAdvancedSettings: nextAdvanced,
            },
            "applySettingsSnapshotToGlobal",
            { global: true },
          );
        },

        applySettingsSnapshotToCard: (cardId, snapshot) => {
          const state = get();
          const { cardConfigs } = state;
          const existing = ensureCardConfig(state, cardId);

          const preset = snapshot.colorPreset || "custom";
          const nextColors =
            preset === "custom"
              ? [...snapshot.colors]
              : getPresetColors(preset);

          const nextConfig: CardEditorConfig = {
            ...existing,
            colorOverride: {
              useCustomSettings: true,
              colorPreset: preset,
              colors: nextColors,
            },
            borderColor: snapshot.borderEnabled
              ? snapshot.borderColor || DEFAULT_BORDER_COLOR
              : undefined,
            borderRadius: clampBorderRadius(snapshot.borderRadius),
            advancedSettings: { ...snapshot.advancedSettings },
          };

          setWithDirty(
            { cardConfigs: { ...cardConfigs, [cardId]: nextConfig } },
            "applySettingsSnapshotToCard",
            { cardIds: [cardId] },
          );
        },

        copySettingsFromCard: (sourceCardId, targetCardId) => {
          const state = get();
          const { cardConfigs } = state;
          const source = ensureCardConfig(state, sourceCardId);
          const target = ensureCardConfig(state, targetCardId);

          const nextTarget: CardEditorConfig = {
            ...target,
            colorOverride: {
              ...source.colorOverride,
              colors: source.colorOverride.colors
                ? [...source.colorOverride.colors]
                : undefined,
            },
            borderColor: source.borderColor,
            borderRadius: source.borderRadius,
            advancedSettings: { ...source.advancedSettings },
          };

          setWithDirty(
            { cardConfigs: { ...cardConfigs, [targetCardId]: nextTarget } },
            "copySettingsFromCard",
            { cardIds: [targetCardId] },
          );
        },

        createSettingsTemplate: (name, snapshot) => {
          const trimmed = name.trim();
          if (!trimmed) {
            return { ok: false, error: "Template name is required." };
          }

          const now = Date.now();
          const template: SettingsTemplateV1 = {
            id: generateTemplateId(),
            name: trimmed.slice(0, 80),
            snapshot,
            createdAt: now,
            updatedAt: now,
          };

          const next = [...get().settingsTemplates, template];
          const persistenceResult = persistSettingsTemplates(next);
          if (!persistenceResult.ok) {
            return persistenceResult;
          }

          set({ settingsTemplates: next }, false, "createSettingsTemplate");
          return { ok: true };
        },

        renameSettingsTemplate: (templateId, name) => {
          const trimmed = name.trim();
          if (!trimmed) {
            return { ok: false, error: "Template name is required." };
          }

          const existing = get().settingsTemplates;
          if (!existing.some((template) => template.id === templateId)) {
            return { ok: false, error: "Template not found." };
          }

          const next = existing.map((t) =>
            t.id === templateId
              ? { ...t, name: trimmed.slice(0, 80), updatedAt: Date.now() }
              : t,
          );

          const persistenceResult = persistSettingsTemplates(next);
          if (!persistenceResult.ok) {
            return persistenceResult;
          }

          set({ settingsTemplates: next }, false, "renameSettingsTemplate");
          return { ok: true };
        },

        deleteSettingsTemplate: (templateId) => {
          const existing = get().settingsTemplates;
          if (!existing.some((template) => template.id === templateId)) {
            return { ok: false, error: "Template not found." };
          }

          const next = existing.filter((t) => t.id !== templateId);

          const persistenceResult = persistSettingsTemplates(next);
          if (!persistenceResult.ok) {
            return persistenceResult;
          }

          set({ settingsTemplates: next }, false, "deleteSettingsTemplate");
          return { ok: true };
        },

        applySettingsTemplateToGlobal: (templateId) => {
          const tpl = get().settingsTemplates.find((t) => t.id === templateId);
          if (!tpl) return;
          get().applySettingsSnapshotToGlobal(tpl.snapshot);
        },

        applySettingsTemplateToCard: (cardId, templateId) => {
          const tpl = get().settingsTemplates.find((t) => t.id === templateId);
          if (!tpl) return;
          get().applySettingsSnapshotToCard(cardId, tpl.snapshot);
        },

        importSettingsTemplates: (templates) => {
          if (templates.length === 0) {
            return { ok: true };
          }

          const existing = get().settingsTemplates;
          const usedIds = new Set(existing.map((t) => t.id));

          const merged: SettingsTemplateV1[] = [...existing];
          for (const t of templates) {
            const id = usedIds.has(t.id) ? generateTemplateId() : t.id;
            usedIds.add(id);
            merged.push({ ...t, id, updatedAt: Date.now() });
          }

          const persistenceResult = persistSettingsTemplates(merged);
          if (!persistenceResult.ok) {
            return persistenceResult;
          }

          set({ settingsTemplates: merged }, false, "importSettingsTemplates");
          return { ok: true };
        },

        exportSettingsTemplates: () => {
          return {
            schemaVersion: 1,
            scope: "templates",
            exportedAt: new Date().toISOString(),
            templates: get().settingsTemplates,
          };
        },

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
      };
    },
    { name: "UserPageEditor" },
  ),
);

/**
 * Selector that returns whether a specific card has unsaved modifications.
 *
 * Includes:
 * - per-card config changes relative to the baseline
 * - global setting changes for cards that fully inherit global settings
 *
 * @source
 */
export const selectIsCardModified = (
  state: UserPageEditorStore,
  cardId: string,
): boolean => {
  const current = state.cardConfigs[cardId];
  const baseline = state.baselineCardConfigs[cardId];
  if (!current || !baseline) return false;

  if (state.dirtyCardIds?.[cardId]) return true;

  if (
    typeof state.dirtyCardIds !== "object" ||
    state.dirtyCardIds === null ||
    !("isGlobalDirty" in state)
  ) {
    if (!areCardConfigsEqual(current, baseline)) return true;
  }

  const baselineGlobal = state.baselineGlobalSnapshot;
  if (!baselineGlobal) return false;
  if (!doesCardInheritGlobalSettings(current)) return false;

  if (typeof state.isGlobalDirty === "boolean") {
    return state.isGlobalDirty;
  }

  const currentGlobal = buildGlobalSettingsSnapshot(state);
  return !areSettingsSnapshotsEqual(currentGlobal, baselineGlobal);
};
