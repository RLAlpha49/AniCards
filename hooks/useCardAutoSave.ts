"use client";

import { useEffect, useCallback, useRef } from "react";
import { useUserPageEditor } from "@/lib/stores/user-page-editor";
import { getResponseErrorMessage, parseResponsePayload } from "@/lib/utils";
import {
  colorPresets,
  statCardTypes,
} from "@/components/stat-card-generator/constants";
import type { ColorValue } from "@/lib/types/card";
import { ServerCardData } from "@/lib/api/cards";

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
  globalSettings: GlobalSettingsPayload,
): Promise<{ success: true } | { error: string }> {
  try {
    const res = await fetch("/api/store-cards", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId, cards, globalSettings }),
    });

    if (!res.ok) {
      const payload = await parseResponsePayload(res);
      const msg = getResponseErrorMessage(res, payload);
      return { error: msg };
    }

    return { success: true };
  } catch (err) {
    console.error("Error saving cards:", err);
    return { error: "Failed to save cards" };
  }
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
    globalColorPreset,
    globalColors,
    globalBorderEnabled,
    globalBorderColor,
    globalBorderRadius,
    globalAdvancedSettings,
  } = state;

  // Build global settings payload
  const shouldSendGlobalColors =
    !globalColorPreset || globalColorPreset === "custom";
  const normalizedGlobalColors = ensureFourColors(globalColors);
  const globalSettings: GlobalSettingsPayload = {
    colorPreset: globalColorPreset,
    titleColor: shouldSendGlobalColors ? normalizedGlobalColors[0] : undefined,
    backgroundColor: shouldSendGlobalColors
      ? normalizedGlobalColors[1]
      : undefined,
    textColor: shouldSendGlobalColors ? normalizedGlobalColors[2] : undefined,
    circleColor: shouldSendGlobalColors ? normalizedGlobalColors[3] : undefined,
    borderEnabled: globalBorderEnabled,
    borderColor: globalBorderColor,
    borderRadius: globalBorderEnabled ? globalBorderRadius : undefined,
    useStatusColors: globalAdvancedSettings.useStatusColors,
    showPiePercentages: globalAdvancedSettings.showPiePercentages,
    showFavorites: globalAdvancedSettings.showFavorites,
    gridCols: globalAdvancedSettings.gridCols,
    gridRows: globalAdvancedSettings.gridRows,
  };

  const allowedIds = new Set(statCardTypes.map((t) => t.id));
  const configsArray = Object.values(cardConfigs).filter((c) =>
    allowedIds.has(c.cardId),
  );

  // Build cards for all configs, preserving full per-card configuration even when disabled.
  const cards: ServerCardData[] = configsArray.map((config) => {
    const useCustomSettings = config.colorOverride.useCustomSettings;

    const baseCardId = (config.cardId || "").split("-")[0] || "";
    const isFavoritesGrid = baseCardId === "favoritesGrid";

    const effectivePreset = useCustomSettings
      ? config.colorOverride.colorPreset || "custom"
      : globalColorPreset;

    const shouldSendColors = !effectivePreset || effectivePreset === "custom";

    const overrideColors =
      useCustomSettings && Array.isArray(config.colorOverride.colors)
        ? ensureFourColors(config.colorOverride.colors)
        : undefined;
    const effectiveColors: ColorValue[] =
      overrideColors ?? normalizedGlobalColors;

    const cardData: ServerCardData = {
      cardName: config.cardId,
      variation: config.variant,
      colorPreset: effectivePreset,
      titleColor: shouldSendColors ? effectiveColors[0] : undefined,
      backgroundColor: shouldSendColors ? effectiveColors[1] : undefined,
      textColor: shouldSendColors ? effectiveColors[2] : undefined,
      circleColor: shouldSendColors ? effectiveColors[3] : undefined,
      useCustomSettings,
    };

    if (useCustomSettings) {
      cardData.borderColor = config.borderColor;
      cardData.borderRadius = config.borderRadius;
      cardData.useStatusColors = config.advancedSettings.useStatusColors;
      cardData.showPiePercentages = config.advancedSettings.showPiePercentages;
      cardData.showFavorites = config.advancedSettings.showFavorites;

      if (isFavoritesGrid) {
        cardData.gridCols = config.advancedSettings.gridCols;
        cardData.gridRows = config.advancedSettings.gridRows;
      }
    }

    return config.enabled ? cardData : { ...cardData, disabled: true };
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
  const performSave = useCallback(async () => {
    const { isSaving: alreadySaving } = useUserPageEditor.getState();
    if (alreadySaving) return;

    const {
      userId: currentUserId,
      cards,
      globalSettings,
    } = buildCardsFromState();

    if (currentUserId == null || !isMountedRef.current) return;

    setSaving(true);

    const result = await saveCardsToApi(currentUserId, cards, globalSettings);

    if (!isMountedRef.current) return;

    if ("error" in result) {
      setSaveError(result.error);
    } else {
      markSaved();
    }
  }, [setSaving, setSaveError, markSaved]);

  // Manual save function
  const saveNow = useCallback(async () => {
    // Clear any pending debounced save
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }

    await performSave();
  }, [performSave]);

  // Auto-save effect - watches isDirty and triggers debounced save
  useEffect(() => {
    if (!enabled || userId == null || !isDirty || isSaving) {
      return;
    }

    // Clear any existing timeout
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }

    // Set new timeout for debounced save
    timeoutRef.current = setTimeout(() => {
      performSave();
    }, debounceMs);

    // Cleanup on effect re-run
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
    };
  }, [enabled, userId, isDirty, isSaving, debounceMs, performSave]);

  return {
    /** Trigger an immediate save, bypassing debounce */
    saveNow,
    /** Whether a save operation is currently in progress */
    isSaving,
    /** Whether there are unsaved changes */
    isDirty,
  };
}
