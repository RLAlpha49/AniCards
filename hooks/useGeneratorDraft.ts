"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useCardSettings, useUserPreferences } from "@/lib/stores";
import { colorPresets } from "@/lib/card-catalogue";
import {
  FAVOURITE_CARD_TYPES,
  GRID_CARD_TYPE,
  CARD_TYPES,
  findCardType,
  type CardSelection,
} from "@/components/generator/card-options";
import {
  clampBorderRadius,
  isValidHexColor,
  validateColorValue,
} from "@/lib/utils";
import type { ColorValue } from "@/lib/types/card";

/** Border colour used when the generator first turns a frame on. @source */
const DEFAULT_FRAME_COLOR = "#e4e2e2";

/** Everything the generator collects before it submits. @source */
export type GeneratorDraft = Readonly<{
  username: string;
  presetName: string;
  colors: ColorValue[];
  selections: Record<string, CardSelection>;
  cardPreferences: Record<string, CardSelection>;
  animeStatusColors: boolean;
  mangaStatusColors: boolean;
  piePercentages: boolean;
  frameEnabled: boolean;
  frameColor: string;
  cornerRadius: number;
  gridColumns: number;
  gridRows: number;
}>;

/**
 * Resolves the stored preset name to a key the palette list knows.
 *
 * A saved palette that no longer exists, or a hand-edited one, reads as
 * `default`.
 * @param presetName - Preset name from the persisted settings.
 * @source
 */
function resolvePresetName(presetName: string | undefined): string {
  if (!presetName) return "default";
  if (presetName === "custom") return "custom";
  return presetName in colorPresets ? presetName : "default";
}

/**
 * The draft a visitor with no saved settings starts from.
 *
 * Deterministic on purpose: the server and the first client render both use
 * this value, so hydration matches. Saved settings are adopted in an effect
 * once the page is interactive.
 * @source
 */
function buildEmptyDraft(): GeneratorDraft {
  return {
    username: "",
    presetName: "default",
    colors: [...colorPresets.default.colors],
    selections: {},
    cardPreferences: {},
    animeStatusColors: false,
    mangaStatusColors: false,
    piePercentages: false,
    frameEnabled: false,
    frameColor: DEFAULT_FRAME_COLOR,
    cornerRadius: 8,
    gridColumns: 3,
    gridRows: 3,
  };
}

/** Returns a valid card preference, falling back when its saved variation is stale. @source */
function resolveCardPreference(
  cardTypeId: string,
  preference?: CardSelection,
): CardSelection | undefined {
  const card = findCardType(cardTypeId);
  if (!card) return undefined;

  const variation =
    preference &&
    card.variations.some((entry) => entry.variation === preference.variation)
      ? preference.variation
      : card.variations[0]?.variation;
  if (!variation) return undefined;

  return {
    variation,
    showFavourites: Boolean(preference?.showFavourites),
  };
}

/**
 * Builds the generator's working state from the saved defaults.
 *
 * The draft starts from the configuration saved by the last successful
 * generation, so a returning visitor finds their username, palette, and card
 * list already filled in. Nothing is written back until the visitor generates,
 * so an abandoned visit does not overwrite those defaults.
 * @source
 */
function buildInitialDraft(
  savedPresetName: string | undefined,
  savedColors: ColorValue[] | undefined,
  savedCardTypes: string[],
  savedVariants: Record<string, string>,
  savedFavourites: Record<string, boolean>,
  savedFrameEnabled: boolean,
  savedFrameColor: string,
  savedRadius: number,
  savedColumns: number,
  savedRows: number,
  savedStatusColors: boolean,
  savedMangaStatusColors: boolean,
  savedPiePercentages: boolean,
  username: string,
): GeneratorDraft {
  const presetName = resolvePresetName(savedPresetName);
  const colors =
    savedColors && savedColors.length === 4
      ? savedColors
      : colorPresets[presetName in colorPresets ? presetName : "default"]
          .colors;

  const cardPreferences: Record<string, CardSelection> = {};
  for (const card of CARD_TYPES) {
    const savedVariation = savedVariants[card.id];
    const savedFavourite = savedFavourites[card.id];
    const preference = resolveCardPreference(card.id, {
      variation: savedVariation ?? card.variations[0]?.variation ?? "default",
      showFavourites: Boolean(savedFavourite),
    });
    if (preference) cardPreferences[card.id] = preference;
  }

  const selections: Record<string, CardSelection> = {};
  for (const id of savedCardTypes) {
    const preference = cardPreferences[id];
    if (preference) selections[id] = preference;
  }

  return {
    username,
    presetName,
    colors,
    selections,
    cardPreferences,
    animeStatusColors: savedStatusColors,
    mangaStatusColors: savedMangaStatusColors,
    piePercentages: savedPiePercentages,
    frameEnabled: savedFrameEnabled,
    frameColor: savedFrameColor || DEFAULT_FRAME_COLOR,
    cornerRadius: savedRadius,
    gridColumns: savedColumns,
    gridRows: savedRows,
  };
}

/**
 * Generator draft state: what the visitor has chosen and the save operation.
 *
 * The generator keeps its own state and reads the saved settings only once, at
 * mount. Edits stay in the draft until generation, when the full configuration
 * is saved as the next visit's starting point.
 * @source
 */
export function useGeneratorDraft() {
  const { setDefaultUsername } = useUserPreferences();
  const { saveGeneratorDefaults } = useCardSettings();

  const [draft, setDraft] = useState<GeneratorDraft>(buildEmptyDraft);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    const hydrateDraft = () => {
      if (
        !useCardSettings.persist.hasHydrated() ||
        !useUserPreferences.persist.hasHydrated()
      ) {
        return;
      }

      const savedCardSettings = useCardSettings.getState();
      const savedUserPreferences = useUserPreferences.getState();
      setDraft(
        buildInitialDraft(
          savedCardSettings.savedColorConfig?.presetName,
          savedCardSettings.savedColorConfig?.colors as
            ColorValue[] | undefined,
          savedCardSettings.defaultCardTypes,
          savedCardSettings.defaultVariants,
          savedCardSettings.defaultShowFavoritesByCard,
          savedCardSettings.defaultBorderEnabled,
          savedCardSettings.defaultBorderColor,
          savedCardSettings.defaultBorderRadius,
          savedCardSettings.favoritesGridColumns,
          savedCardSettings.favoritesGridRows,
          savedCardSettings.useAnimeStatusColors,
          savedCardSettings.useMangaStatusColors,
          savedCardSettings.showPiePercentages,
          savedUserPreferences.defaultUsername,
        ),
      );
      setHydrated(true);
    };

    const unsubscribeCardSettings =
      useCardSettings.persist.onFinishHydration(hydrateDraft);
    const unsubscribeUserPreferences =
      useUserPreferences.persist.onFinishHydration(hydrateDraft);
    hydrateDraft();

    return () => {
      unsubscribeCardSettings();
      unsubscribeUserPreferences();
    };
  }, []);

  const setUsername = useCallback((username: string) => {
    setDraft((current) => ({ ...current, username }));
  }, []);

  /**
   * Applies a named palette to all four colour fields.
   * @param presetName - Preset key, or `custom` to keep the current colours.
   * @source
   */
  const applyPalette = useCallback((presetName: string) => {
    setDraft((current) => {
      if (presetName === "custom") {
        return { ...current, presetName };
      }
      const preset = colorPresets[presetName];
      if (!preset) return current;
      return { ...current, presetName, colors: [...preset.colors] };
    });
  }, []);

  /**
   * Writes one colour field and marks the palette custom.
   * @param index - Position in the four-colour tuple.
   * @param color - Solid hex or gradient definition.
   * @source
   */
  const setColor = useCallback((index: number, color: ColorValue) => {
    setDraft((current) => {
      const colors = [...current.colors];
      colors[index] = color;
      return { ...current, colors, presetName: "custom" };
    });
  }, []);

  /**
   * Adds or removes a card. Adding one defaults its variation to the first
   * variation the template offers, so the card always has a valid shape.
   * @param cardTypeId - Card identifier.
   * @source
   */
  const toggleCardType = useCallback((cardTypeId: string) => {
    setDraft((current) => {
      const selections = { ...current.selections };
      const cardPreferences = { ...current.cardPreferences };
      if (selections[cardTypeId]) {
        cardPreferences[cardTypeId] = selections[cardTypeId];
        delete selections[cardTypeId];
        return { ...current, selections, cardPreferences };
      }
      const selection = resolveCardPreference(
        cardTypeId,
        cardPreferences[cardTypeId],
      );
      if (!selection) return current;
      selections[cardTypeId] = selection;
      cardPreferences[cardTypeId] = selection;
      return { ...current, selections, cardPreferences };
    });
  }, []);

  /**
   * Replaces the whole selection set. Used by the group shortcuts.
   * @param cardTypeIds - Card identifiers to select.
   * @source
   */
  const replaceSelection = useCallback((cardTypeIds: string[]) => {
    setDraft((current) => {
      const selections: Record<string, CardSelection> = {};
      const cardPreferences = { ...current.cardPreferences };
      for (const id of cardTypeIds) {
        const existing = cardPreferences[id] ?? current.selections[id];
        const selection = resolveCardPreference(id, existing);
        if (!selection) continue;
        selections[id] = selection;
        cardPreferences[id] = selection;
      }
      return { ...current, selections, cardPreferences };
    });
  }, []);

  /**
   * Adds every card in a group, keeping any selection already made elsewhere.
   * @param cardTypeIds - Card identifiers in the group.
   * @source
   */
  const addCardTypes = useCallback((cardTypeIds: string[]) => {
    setDraft((current) => {
      const selections = { ...current.selections };
      const cardPreferences = { ...current.cardPreferences };
      for (const id of cardTypeIds) {
        if (selections[id]) continue;
        const preference = cardPreferences[id];
        const selection = resolveCardPreference(id, preference);
        if (!selection) continue;
        selections[id] = selection;
        cardPreferences[id] = selection;
      }
      return { ...current, selections, cardPreferences };
    });
  }, []);

  /**
   * Changes the variation shown for a selected card.
   * @param cardTypeId - Card identifier.
   * @param variation - Variation id from the card's own list.
   * @source
   */
  const setVariation = useCallback((cardTypeId: string, variation: string) => {
    setDraft((current) => {
      const existing = current.selections[cardTypeId];
      if (!existing) return current;
      const selection = { ...existing, variation };
      return {
        ...current,
        selections: {
          ...current.selections,
          [cardTypeId]: selection,
        },
        cardPreferences: {
          ...current.cardPreferences,
          [cardTypeId]: selection,
        },
      };
    });
  }, []);

  /**
   * Turns the favourites indicator on or off for one card.
   * @param cardTypeId - Card identifier.
   * @source
   */
  const toggleFavourites = useCallback((cardTypeId: string) => {
    setDraft((current) => {
      const existing = current.selections[cardTypeId];
      if (!existing) return current;
      const selection = {
        ...existing,
        showFavourites: !existing.showFavourites,
      };
      return {
        ...current,
        selections: {
          ...current.selections,
          [cardTypeId]: selection,
        },
        cardPreferences: {
          ...current.cardPreferences,
          [cardTypeId]: selection,
        },
      };
    });
  }, []);

  /**
   * Sets the favourites indicator on every selected card that supports it.
   *
   * The card API accepts `showFavorites` per card, so this is a bulk write to
   * the four eligible cards rather than one global card setting.
   * @param value - True to show favourites, false to hide them.
   * @source
   */
  const setAllFavourites = useCallback((value: boolean) => {
    setDraft((current) => {
      const selections = { ...current.selections };
      const cardPreferences = { ...current.cardPreferences };
      for (const [id, selection] of Object.entries(selections)) {
        if (!FAVOURITE_CARD_TYPES.has(id)) continue;
        const updatedSelection = { ...selection, showFavourites: value };
        selections[id] = updatedSelection;
        cardPreferences[id] = updatedSelection;
      }
      return { ...current, selections, cardPreferences };
    });
  }, []);

  const toggleAnimeStatusColors = useCallback(() => {
    setDraft((current) => ({
      ...current,
      animeStatusColors: !current.animeStatusColors,
    }));
  }, []);

  const toggleMangaStatusColors = useCallback(() => {
    setDraft((current) => ({
      ...current,
      mangaStatusColors: !current.mangaStatusColors,
    }));
  }, []);

  const togglePiePercentages = useCallback(() => {
    setDraft((current) => ({
      ...current,
      piePercentages: !current.piePercentages,
    }));
  }, []);

  /**
   * Turns the card frame on or off. Turning it on restores the last frame
   * colour rather than resetting it.
   * @source
   */
  const toggleFrame = useCallback(() => {
    setDraft((current) => ({
      ...current,
      frameEnabled: !current.frameEnabled,
    }));
  }, []);

  const setFrameColor = useCallback((color: string) => {
    const trimmed = color.trim();
    if (!trimmed) {
      setDraft((current) => ({ ...current, frameColor: "" }));
      return;
    }
    setDraft((current) => ({
      ...current,
      frameColor: trimmed.startsWith("#") ? trimmed : `#${trimmed}`,
    }));
  }, []);

  const setCornerRadius = useCallback((radius: number) => {
    setDraft((current) => ({
      ...current,
      cornerRadius: clampBorderRadius(radius),
    }));
  }, []);

  const setGridSize = useCallback((columns: number, rows: number) => {
    setDraft((current) => ({
      ...current,
      gridColumns: Math.max(1, Math.min(5, Math.round(columns))),
      gridRows: Math.max(1, Math.min(5, Math.round(rows))),
    }));
  }, []);

  /**
   * Saves the complete generated configuration for the next visit.
   * @source
   */
  const rememberDraft = useCallback(() => {
    const selectedIds = Object.keys(draft.selections);
    const defaultVariants = Object.fromEntries(
      Object.entries(draft.cardPreferences).map(([id, preference]) => [
        id,
        preference.variation,
      ]),
    );
    const defaultShowFavoritesByCard = Object.fromEntries(
      Object.entries(draft.cardPreferences)
        .filter(([id]) => FAVOURITE_CARD_TYPES.has(id))
        .map(([id, selection]) => [id, selection.showFavourites]),
    );

    saveGeneratorDefaults({
      savedColorConfig: {
        colors: [...draft.colors],
        presetName: draft.presetName,
      },
      defaultCardTypes: selectedIds,
      defaultVariants,
      defaultShowFavoritesByCard,
      favoritesGridColumns: draft.gridColumns,
      favoritesGridRows: draft.gridRows,
      defaultBorderEnabled: draft.frameEnabled,
      defaultBorderColor: draft.frameColor,
      defaultBorderRadius: draft.cornerRadius,
      useAnimeStatusColors: draft.animeStatusColors,
      useMangaStatusColors: draft.mangaStatusColors,
      showPiePercentages: draft.piePercentages,
    });
    setDefaultUsername(draft.username.trim());
  }, [draft, saveGeneratorDefaults, setDefaultUsername]);

  const selectedIds = useMemo(
    () => Object.keys(draft.selections),
    [draft.selections],
  );

  const totalCardTypes = CARD_TYPES.length;
  const allSelected = selectedIds.length === totalCardTypes;
  const needsGridSize = Boolean(draft.selections[GRID_CARD_TYPE]);

  const paletteValid =
    draft.colors.length === 4 &&
    draft.colors.every((color) => validateColorValue(color)) &&
    isValidHexColor(draft.frameColor);
  const readyToGenerate =
    draft.username.trim().length > 0 && selectedIds.length > 0 && paletteValid;

  return {
    draft,
    /** False until saved settings have been adopted. */
    hydrated,
    selectedIds,
    selectedCount: selectedIds.length,
    totalCardTypes,
    allSelected,
    needsGridSize,
    paletteValid,
    readyToGenerate,
    setUsername,
    applyPalette,
    setColor,
    toggleCardType,
    replaceSelection,
    addCardTypes,
    setVariation,
    toggleFavourites,
    setAllFavourites,
    toggleAnimeStatusColors,
    toggleMangaStatusColors,
    togglePiePercentages,
    toggleFrame,
    setFrameColor,
    setCornerRadius,
    setGridSize,
    rememberDraft,
  };
}
