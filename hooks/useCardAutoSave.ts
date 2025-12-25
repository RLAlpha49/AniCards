"use client";

import { useEffect, useCallback, useRef } from "react";
import {
  useUserPageEditor,
  type ServerCardData,
} from "@/lib/stores/user-page-editor";
import { getResponseErrorMessage, parseResponsePayload } from "@/lib/utils";
import type { ColorValue } from "@/lib/types/card";

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
): Promise<{ success: boolean } | { error: string }> {
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
 * @returns Object with userId, cards array, and global settings.
 * @source
 */
function buildCardsFromState(): {
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
  const globalSettings: GlobalSettingsPayload = {
    colorPreset: globalColorPreset,
    titleColor: shouldSendGlobalColors ? globalColors[0] : undefined,
    backgroundColor: shouldSendGlobalColors ? globalColors[1] : undefined,
    textColor: shouldSendGlobalColors ? globalColors[2] : undefined,
    circleColor: shouldSendGlobalColors ? globalColors[3] : undefined,
    borderEnabled: globalBorderEnabled,
    borderColor: globalBorderColor,
    borderRadius: globalBorderEnabled ? globalBorderRadius : undefined,
    useStatusColors: globalAdvancedSettings.useStatusColors,
    showPiePercentages: globalAdvancedSettings.showPiePercentages,
    showFavorites: globalAdvancedSettings.showFavorites,
    gridCols: globalAdvancedSettings.gridCols,
    gridRows: globalAdvancedSettings.gridRows,
  };

  const configsArray = Object.values(cardConfigs);

  // Build enabled cards with full configuration
  const enabledCards: ServerCardData[] = configsArray
    .filter((c) => c.enabled)
    .map((config) => {
      const useCustomSettings = config.colorOverride.useCustomSettings;

      const effectivePreset = useCustomSettings
        ? config.colorOverride.colorPreset || "custom"
        : globalColorPreset;

      const shouldSendColors = !effectivePreset || effectivePreset === "custom";

      const effectiveColors: ColorValue[] =
        useCustomSettings &&
        Array.isArray(config.colorOverride.colors) &&
        config.colorOverride.colors.length >= 4
          ? config.colorOverride.colors
          : globalColors;

      return {
        cardName: config.cardId,
        variation: config.variant,
        colorPreset: effectivePreset,
        titleColor: shouldSendColors ? effectiveColors[0] : undefined,
        backgroundColor: shouldSendColors ? effectiveColors[1] : undefined,
        textColor: shouldSendColors ? effectiveColors[2] : undefined,
        circleColor: shouldSendColors ? effectiveColors[3] : undefined,
        borderColor: config.borderColor,
        borderRadius: config.borderRadius,
        useStatusColors: config.advancedSettings.useStatusColors,
        showPiePercentages: config.advancedSettings.showPiePercentages,
        showFavorites: config.advancedSettings.showFavorites,
        gridCols: config.advancedSettings.gridCols,
        gridRows: config.advancedSettings.gridRows,
        useCustomSettings,
      };
    });

  // Build disabled cards with minimal data (just cardName and disabled flag)
  const disabledCards: ServerCardData[] = configsArray
    .filter((c) => !c.enabled)
    .map((config) => ({
      cardName: config.cardId,
      disabled: true,
    }));

  const cards = [...enabledCards, ...disabledCards];

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
      }
    };
  }, []);

  // Perform the actual save operation
  const performSave = useCallback(async () => {
    const {
      userId: currentUserId,
      cards,
      globalSettings,
    } = buildCardsFromState();

    if (!currentUserId || !isMountedRef.current) return;

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
    if (!enabled || !userId || !isDirty || isSaving) {
      return;
    }

    // Clear any existing timeout
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    // Set new timeout for debounced save
    timeoutRef.current = setTimeout(() => {
      void performSave();
    }, debounceMs);

    // Cleanup on effect re-run
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
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
