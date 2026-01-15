"use client";

import { useEffect, useCallback, useRef, useState } from "react";
import { toast } from "sonner";
import {
  useUserPageEditor,
  buildLocalEditsPatch,
  type CardEditorConfig,
} from "@/lib/stores/user-page-editor";
import { getResponseErrorMessage, parseResponsePayload } from "@/lib/utils";
import {
  colorPresets,
  statCardTypes,
} from "@/components/stat-card-generator/constants";
import type { ColorValue } from "@/lib/types/card";
import type { ServerCardData } from "@/lib/api/cards";

/**
 * Default debounce delay for auto-save in milliseconds.
 * @source
 */
const DEFAULT_DEBOUNCE_MS = 1500;

/**
 * Global settings structure for API payload.
 * @source
 */
interface GlobalSettingsPayload {
  colorPreset: string;
  titleColor?: ColorValue;
  backgroundColor?: ColorValue;
  textColor?: ColorValue;
  circleColor?: ColorValue;
  borderEnabled: boolean;
  borderColor: string;
  borderRadius?: number;
  useStatusColors?: boolean;
  showPiePercentages?: boolean;
  showFavorites?: boolean;
  gridCols?: number;
  gridRows?: number;
}

type SaveCardsResponse =
  | { success: true; updatedAt: string }
  | { error: string }
  | { conflict: true; error: string; currentUpdatedAt?: string };

type SaveConflictInfo = {
  currentUpdatedAt?: string;
};

/**
 * Normalize a colors array to ensure it contains at least four values.
 * Pads with the default preset colors where necessary.
 */
function ensureFourColors(colors?: ColorValue[]): ColorValue[] {
  const defaultColors = colorPresets.default.colors;
  if (!Array.isArray(colors) || colors.length === 0) return [...defaultColors];
  if (colors.length >= 4) return colors.slice(0, 4);
  const out = colors.slice();
  for (let i = out.length; i < 4; i++) {
    out.push(defaultColors[i]);
  }
  return out;
}

function buildGlobalPayloadAndColorsFromState(state: {
  globalColorPreset: string;
  globalColors?: ColorValue[];
  globalBorderEnabled: boolean;
  globalBorderColor: string;
  globalBorderRadius?: number;
  globalAdvancedSettings: {
    useStatusColors?: boolean;
    showPiePercentages?: boolean;
    showFavorites?: boolean;
    gridCols?: number;
    gridRows?: number;
  };
}): {
  globalSettings: GlobalSettingsPayload;
  normalizedGlobalColors: ColorValue[];
} {
  const shouldSendGlobalColors =
    !state.globalColorPreset || state.globalColorPreset === "custom";
  const normalizedGlobalColors = ensureFourColors(state.globalColors);

  const globalSettings: GlobalSettingsPayload = {
    colorPreset: state.globalColorPreset,
    titleColor: shouldSendGlobalColors ? normalizedGlobalColors[0] : undefined,
    backgroundColor: shouldSendGlobalColors
      ? normalizedGlobalColors[1]
      : undefined,
    textColor: shouldSendGlobalColors ? normalizedGlobalColors[2] : undefined,
    circleColor: shouldSendGlobalColors ? normalizedGlobalColors[3] : undefined,
    borderEnabled: state.globalBorderEnabled,
    borderColor: state.globalBorderColor,
    borderRadius: state.globalBorderEnabled
      ? state.globalBorderRadius
      : undefined,
    useStatusColors: state.globalAdvancedSettings.useStatusColors,
    showPiePercentages: state.globalAdvancedSettings.showPiePercentages,
    showFavorites: state.globalAdvancedSettings.showFavorites,
    gridCols: state.globalAdvancedSettings.gridCols,
    gridRows: state.globalAdvancedSettings.gridRows,
  };

  return { globalSettings, normalizedGlobalColors };
}

function getCardConfigsInSaveOrder(opts: {
  cardConfigs: Record<string, CardEditorConfig>;
  cardOrder?: readonly string[];
  allowedIds: ReadonlySet<string>;
  fallbackOrder: readonly string[];
}): CardEditorConfig[] {
  const orderedIds =
    Array.isArray(opts.cardOrder) && opts.cardOrder.length > 0
      ? opts.cardOrder
      : opts.fallbackOrder;

  const configs: CardEditorConfig[] = [];
  const seen = new Set<string>();

  for (const id of orderedIds) {
    const cfg = opts.cardConfigs[id];
    if (!cfg) continue;
    if (!opts.allowedIds.has(cfg.cardId)) continue;
    configs.push(cfg);
    seen.add(cfg.cardId);
  }

  // Include any remaining allowed configs not present in cardOrder.
  for (const cfg of Object.values(opts.cardConfigs)) {
    if (!opts.allowedIds.has(cfg.cardId)) continue;
    if (seen.has(cfg.cardId)) continue;
    configs.push(cfg);
  }

  return configs;
}

function buildCardPayloadsFromConfigs(opts: {
  configs: readonly CardEditorConfig[];
  globalColorPreset: string;
  normalizedGlobalColors: ColorValue[];
}): ServerCardData[] {
  const buildOne = (config: CardEditorConfig): ServerCardData => {
    const useCustomSettings = config.colorOverride.useCustomSettings;
    const baseCardId = (config.cardId || "").split("-")[0] || "";
    const isFavoritesGrid = baseCardId === "favoritesGrid";

    const base: ServerCardData = {
      cardName: config.cardId,
      variation: config.variant,
      useCustomSettings,
      ...(config.enabled ? {} : { disabled: true }),
    };

    if (!useCustomSettings) {
      return base;
    }

    const preset = config.colorOverride.colorPreset || "custom";
    base.colorPreset = preset;

    const shouldSendColors = !preset || preset === "custom";
    if (shouldSendColors) {
      const colors = Array.isArray(config.colorOverride.colors)
        ? ensureFourColors(config.colorOverride.colors)
        : opts.normalizedGlobalColors;
      base.titleColor = colors[0];
      base.backgroundColor = colors[1];
      base.textColor = colors[2];
      base.circleColor = colors[3];
    }

    base.borderColor = config.borderColor;
    base.borderRadius = config.borderRadius;
    base.useStatusColors = config.advancedSettings.useStatusColors;
    base.showPiePercentages = config.advancedSettings.showPiePercentages;
    base.showFavorites = config.advancedSettings.showFavorites;

    if (isFavoritesGrid) {
      base.gridCols = config.advancedSettings.gridCols;
      base.gridRows = config.advancedSettings.gridRows;
    }

    return base;
  };

  return opts.configs.map(buildOne);
}

function buildGlobalPayloadFromSnapshot(snapshot: {
  colorPreset: string;
  colors: readonly ColorValue[];
  borderEnabled: boolean;
  borderColor: string;
  borderRadius: number;
  advancedSettings?: {
    useStatusColors?: boolean;
    showPiePercentages?: boolean;
    showFavorites?: boolean;
    gridCols?: number;
    gridRows?: number;
  };
}): GlobalSettingsPayload {
  const shouldSendGlobalColors =
    !snapshot.colorPreset || snapshot.colorPreset === "custom";
  const normalizedGlobalColors = ensureFourColors(
    snapshot.colors as ColorValue[],
  );

  return {
    colorPreset: snapshot.colorPreset,
    titleColor: shouldSendGlobalColors ? normalizedGlobalColors[0] : undefined,
    backgroundColor: shouldSendGlobalColors
      ? normalizedGlobalColors[1]
      : undefined,
    textColor: shouldSendGlobalColors ? normalizedGlobalColors[2] : undefined,
    circleColor: shouldSendGlobalColors ? normalizedGlobalColors[3] : undefined,
    borderEnabled: snapshot.borderEnabled,
    borderColor: snapshot.borderColor,
    borderRadius: snapshot.borderEnabled ? snapshot.borderRadius : undefined,
    useStatusColors: snapshot.advancedSettings?.useStatusColors,
    showPiePercentages: snapshot.advancedSettings?.showPiePercentages,
    showFavorites: snapshot.advancedSettings?.showFavorites,
    gridCols: snapshot.advancedSettings?.gridCols,
    gridRows: snapshot.advancedSettings?.gridRows,
  };
}

function diffGlobalSettingsPayload(
  baseline: GlobalSettingsPayload | undefined,
  current: GlobalSettingsPayload,
): Partial<GlobalSettingsPayload> {
  if (!baseline) return current;

  const normalizeColor = (value: unknown): string | undefined => {
    if (value === undefined) return undefined;
    if (typeof value === "string") return value;
    try {
      return JSON.stringify(value);
    } catch {
      // Stable fallback when values cannot be serialized (e.g., cyclic objects).
      return "[unserializable]";
    }
  };

  const colorKeys = new Set([
    "titleColor",
    "backgroundColor",
    "textColor",
    "circleColor",
  ] as const);

  const diff: Partial<GlobalSettingsPayload> = {};
  const keys: Array<keyof GlobalSettingsPayload> = [
    "colorPreset",
    "titleColor",
    "backgroundColor",
    "textColor",
    "circleColor",
    "borderEnabled",
    "borderColor",
    "borderRadius",
    "useStatusColors",
    "showPiePercentages",
    "showFavorites",
    "gridCols",
    "gridRows",
  ];

  for (const key of keys) {
    const a = baseline[key];
    const b = current[key];
    if (
      colorKeys.has(key as typeof colorKeys extends Set<infer T> ? T : never)
    ) {
      const an = normalizeColor(a);
      const bn = normalizeColor(b);
      if (an !== bn) (diff as Record<string, unknown>)[key] = b as unknown;
      continue;
    }

    if (a !== b) {
      (diff as Record<string, unknown>)[key] = b as unknown;
    }
  }

  return diff;
}

/**
 * Saves cards to the API.
 * @param userId - The user ID.
 * @param cards - Array of card configurations to save.
 * @param globalSettings - Global settings to save.
 * @returns Promise resolving to success or error object.
 * @source
 */
async function saveCardsToApi(
  userId: string,
  cards: ServerCardData[],
  opts: {
    globalSettings?: Partial<GlobalSettingsPayload>;
    cardOrder?: string[];
    ifMatchUpdatedAt?: string;
  },
): Promise<SaveCardsResponse> {
  try {
    const body: Record<string, unknown> = {
      userId,
      cards,
      ...(opts.globalSettings ? { globalSettings: opts.globalSettings } : {}),
      ...(Array.isArray(opts.cardOrder) ? { cardOrder: opts.cardOrder } : {}),
      ...(typeof opts.ifMatchUpdatedAt === "string" &&
      opts.ifMatchUpdatedAt.length > 0
        ? { ifMatchUpdatedAt: opts.ifMatchUpdatedAt }
        : {}),
    };

    const res = await fetch("/api/store-cards", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    const payload = await parseResponsePayload(res);

    if (res.status === 409) {
      const msg = getResponseErrorMessage(res, payload);
      const currentUpdatedAt =
        payload && typeof payload === "object"
          ? ((payload as Record<string, unknown>).currentUpdatedAt as
              | string
              | undefined)
          : undefined;
      return { conflict: true, error: msg, currentUpdatedAt };
    }

    if (!res.ok) {
      const msg = getResponseErrorMessage(res, payload);
      return { error: msg };
    }

    const updatedAt =
      payload && typeof payload === "object"
        ? ((payload as Record<string, unknown>).updatedAt as string | undefined)
        : undefined;
    if (!updatedAt) {
      return { error: "Save succeeded but no updatedAt was returned" };
    }

    return { success: true, updatedAt };
  } catch (err) {
    console.error("Error saving cards:", err);
    return { error: "Failed to save cards" };
  }
}

function buildSavePayloadFromStoreState(
  state: ReturnType<typeof useUserPageEditor.getState>,
): {
  userId: string;
  patch: NonNullable<ReturnType<typeof buildLocalEditsPatch>>;
  cards: ServerCardData[];
  globalSettings?: Partial<GlobalSettingsPayload>;
  cardOrder?: string[];
  ifMatchUpdatedAt?: string;
} | null {
  if (!state.userId) return null;
  const patch = buildLocalEditsPatch(state);
  if (!patch) return null;

  const allowedIds = new Set(statCardTypes.map((t) => t.id));
  const fallbackOrder = statCardTypes.map((t) => t.id);
  const normalizedGlobalColors = ensureFourColors(state.globalColors);

  const cardsConfigs = patch.cardConfigs ?? {};
  const configsArray = getCardConfigsInSaveOrder({
    cardConfigs: cardsConfigs,
    cardOrder: state.cardOrder,
    allowedIds,
    fallbackOrder,
  });

  const cards = buildCardPayloadsFromConfigs({
    configs: configsArray,
    globalColorPreset: state.globalColorPreset,
    normalizedGlobalColors,
  });

  let globalSettings: Partial<GlobalSettingsPayload> | undefined;
  if (patch.globalSnapshot) {
    const currentGlobal = buildGlobalPayloadFromSnapshot({
      colorPreset: patch.globalSnapshot.colorPreset,
      colors: patch.globalSnapshot.colors,
      borderEnabled: Boolean(patch.globalSnapshot.borderEnabled),
      borderColor: patch.globalSnapshot.borderColor,
      borderRadius: patch.globalSnapshot.borderRadius,
      advancedSettings: patch.globalSnapshot.advancedSettings,
    });
    const baselineGlobal = state.baselineGlobalSnapshot
      ? buildGlobalPayloadFromSnapshot({
          colorPreset: state.baselineGlobalSnapshot.colorPreset,
          colors: state.baselineGlobalSnapshot.colors,
          borderEnabled: Boolean(state.baselineGlobalSnapshot.borderEnabled),
          borderColor: state.baselineGlobalSnapshot.borderColor,
          borderRadius: state.baselineGlobalSnapshot.borderRadius,
          advancedSettings: state.baselineGlobalSnapshot.advancedSettings,
        })
      : undefined;

    globalSettings = diffGlobalSettingsPayload(baselineGlobal, currentGlobal);
    if (Object.keys(globalSettings).length === 0) {
      globalSettings = undefined;
    }
  }

  return {
    userId: state.userId,
    patch,
    cards,
    globalSettings,
    cardOrder: patch.cardOrder,
    ifMatchUpdatedAt: state.serverUpdatedAt ?? undefined,
  };
}

/**
 * Builds the cards array and global settings from the current store state.
 * Note: This reads from the store synchronously via getState(), capturing
 * a snapshot at the moment of invocation. It does not subscribe to changes.
 * @returns Object with userId, cards array, and global settings.
 * @source
 */
export function buildCardsFromState(): {
  userId: string | null;
  cards: ServerCardData[];
  globalSettings: GlobalSettingsPayload;
} {
  const state = useUserPageEditor.getState();

  const {
    userId,
    cardConfigs,
    cardOrder,
    globalColorPreset,
    globalBorderEnabled,
    globalBorderColor,
    globalBorderRadius,
    globalAdvancedSettings,
  } = state;

  const { globalSettings, normalizedGlobalColors } =
    buildGlobalPayloadAndColorsFromState({
      globalColorPreset,
      globalColors: state.globalColors,
      globalBorderEnabled,
      globalBorderColor,
      globalBorderRadius,
      globalAdvancedSettings,
    });

  const allowedIds = new Set(statCardTypes.map((t) => t.id));
  const fallbackOrder = statCardTypes.map((t) => t.id);
  const configsArray = getCardConfigsInSaveOrder({
    cardConfigs,
    cardOrder,
    allowedIds,
    fallbackOrder,
  });

  const cards = buildCardPayloadsFromConfigs({
    configs: configsArray,
    globalColorPreset,
    normalizedGlobalColors,
  });

  return { userId, cards, globalSettings };
}

/**
 * Options for the auto-save hook.
 * @source
 */
interface UseCardAutoSaveOptions {
  /** Debounce delay in milliseconds. Default: 1500ms */
  debounceMs?: number;
  /** Whether auto-save is enabled. Default: true */
  enabled?: boolean;
}

/**
 * Hook that provides debounced auto-save functionality for the user page editor.
 * Watches the store's isDirty flag and triggers save after debounce period.
 *
 * @param options - Configuration options for auto-save behavior.
 * @returns Object with manual save trigger and save state.
 * @source
 */
export function useCardAutoSave(options: UseCardAutoSaveOptions = {}) {
  const { debounceMs = DEFAULT_DEBOUNCE_MS, enabled = true } = options;

  const { userId, isDirty, isSaving, setSaving, setSaveError, markSaved } =
    useUserPageEditor();

  const [saveConflict, setSaveConflict] = useState<SaveConflictInfo | null>(
    null,
  );

  // Tracks whether an auto-save is queued (debounced) and when it is expected
  // to fire. This is used for UI indicators (e.g., "Auto-save pending").
  const [autoSaveDueAt, setAutoSaveDueAt] = useState<number | null>(null);

  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isMountedRef = useRef(true);

  // Cleanup on unmount
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
    };
  }, []);

  // Perform the actual save operation
  const performSave = useCallback(
    async (opts?: { reason?: "auto" | "manual" }) => {
      if (saveConflict) {
        toast.error("Resolve save conflict", {
          description:
            "Reload the latest settings first, then re-apply your edits.",
        });
        return;
      }

      const { isSaving: alreadySaving } = useUserPageEditor.getState();
      if (alreadySaving) return;

      const snapshot = useUserPageEditor.getState();
      const payload = buildSavePayloadFromStoreState(snapshot);
      if (!payload || !isMountedRef.current) return;

      // A save is about to run, so any queued debounce is no longer relevant.
      setAutoSaveDueAt(null);
      setSaving(true);

      const toastId = "user-page-autosave";
      toast.loading(opts?.reason === "manual" ? "Saving…" : "Auto-saving…", {
        id: toastId,
      });

      const result = await saveCardsToApi(payload.userId, payload.cards, {
        globalSettings: payload.globalSettings,
        cardOrder: payload.cardOrder,
        ifMatchUpdatedAt: payload.ifMatchUpdatedAt,
      });

      const shouldNotify = isMountedRef.current;

      if ("conflict" in result) {
        setSaveError(result.error);
        if (shouldNotify) {
          setSaveConflict({ currentUpdatedAt: result.currentUpdatedAt });
          toast.error("Save conflict", {
            id: toastId,
            description:
              "Changes were saved in another tab. Reload to sync, then re-apply your edits.",
          });
        }
      } else if ("error" in result) {
        setSaveError(result.error);
        if (shouldNotify) {
          toast.error("Save failed", {
            id: toastId,
            description: result.error,
          });
        }
      } else {
        markSaved({
          serverUpdatedAt: result.updatedAt,
          appliedPatch: payload.patch,
        });
        if (shouldNotify) {
          setSaveConflict(null);
          toast.success("Saved", { id: toastId });
        }
      }
    },
    [markSaved, saveConflict, setSaveError, setSaving],
  );

  const clearSaveConflict = useCallback(() => {
    setSaveConflict(null);
    setSaveError(null);
  }, [setSaveError]);

  useEffect(() => {
    if (!isDirty && saveConflict) {
      setSaveConflict(null);
    }
  }, [isDirty, saveConflict]);

  // Manual save function
  const saveNow = useCallback(async () => {
    // Clear any pending debounced save
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }

    setAutoSaveDueAt(null);

    await performSave({ reason: "manual" });
  }, [performSave]);

  // Auto-save effect - watches isDirty and triggers debounced save
  const shouldQueueAutoSave =
    enabled && userId != null && isDirty && !isSaving && !saveConflict;

  useEffect(() => {
    if (!shouldQueueAutoSave) {
      setAutoSaveDueAt(null);
    }
  }, [shouldQueueAutoSave]);

  useEffect(() => {
    if (!shouldQueueAutoSave) {
      return;
    }

    // Clear any existing timeout
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }

    const dueAt = Date.now() + debounceMs;
    setAutoSaveDueAt(dueAt);

    // Set new timeout for debounced save
    timeoutRef.current = setTimeout(() => {
      performSave({ reason: "auto" });
    }, debounceMs);

    // Cleanup on effect re-run
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
    };
  }, [shouldQueueAutoSave, debounceMs, performSave]);

  return {
    /** Trigger an immediate save, bypassing debounce */
    saveNow,
    /** Clear a save-conflict state after reloading latest server data */
    clearSaveConflict,
    /** Whether a save operation is currently in progress */
    isSaving,
    /** Whether there are unsaved changes */
    isDirty,
    /** Whether an auto-save is queued (debounced) */
    isAutoSaveQueued: autoSaveDueAt !== null,
    /** When the current queued auto-save is expected to run */
    autoSaveDueAt,
    /** Present when a 409 conflict was detected and needs resolution */
    saveConflict,
  };
}
