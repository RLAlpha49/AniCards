"use client";

import { useCallback, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/Dialog";
import { CardSettingsPanel } from "@/components/user/CardSettingsPanel";
import {
  useUserPageEditor,
  type CardAdvancedSettings,
} from "@/lib/stores/user-page-editor";
import { clampBorderRadius } from "@/lib/utils";
import type { ColorValue } from "@/lib/types/card";

/**
 * Props for CardSettingsDialog component.
 * @source
 */
interface CardSettingsDialogProps {
  /** Whether the dialog is open */
  isOpen: boolean;
  /** Callback to close the dialog */
  onClose: () => void;
  /** Card type ID */
  cardId: string;
  /** Display label for the card */
  label: string;
  /** Whether this card supports status colors */
  supportsStatusColors?: boolean;
  /** Whether this card supports pie percentages (only shown for pie/donut variants) */
  supportsPiePercentages?: boolean;
  /** Whether this card supports favorites */
  supportsFavorites?: boolean;
  /** Whether this card is the favorites grid */
  isFavoritesGrid?: boolean;
  /** Current variant of the card */
  currentVariant?: string;
}

/**
 * Dialog component for configuring individual card settings.
 * Allows overriding global colors and border settings per card.
 * @source
 */
export function CardSettingsDialog({
  isOpen,
  onClose,
  cardId,
  label,
  supportsStatusColors = false,
  supportsPiePercentages = false,
  supportsFavorites = false,
  isFavoritesGrid = false,
  currentVariant = "default",
}: Readonly<CardSettingsDialogProps>) {
  const {
    cardConfigs,
    globalColors,
    globalColorPreset,
    globalBorderEnabled,
    globalBorderColor,
    globalBorderRadius,
    setCardColorPreset,
    setCardColor,
    setCardBorderColor,
    setCardBorderRadius,
    setCardAdvancedSetting,
    resetCardToGlobal,
    toggleCardCustomColors,
  } = useUserPageEditor();

  const config = cardConfigs[cardId] || {
    cardId,
    enabled: false,
    variant: "default",
    colorOverride: { useCustomSettings: false },
    advancedSettings: {},
  };

  const useCustomSettings =
    config.colorOverride.useCustomSettings ||
    config.borderColor !== undefined ||
    config.borderRadius !== undefined;

  // Get effective colors for this card
  const cardColors =
    config.colorOverride.useCustomSettings && config.colorOverride.colors
      ? config.colorOverride.colors
      : globalColors;

  const cardColorPreset =
    config.colorOverride.useCustomSettings && config.colorOverride.colorPreset
      ? config.colorOverride.colorPreset
      : globalColorPreset;

  // Get effective border settings
  const cardBorderColor =
    config.borderColor ?? (globalBorderEnabled ? globalBorderColor : undefined);
  const cardBorderRadius = config.borderRadius ?? globalBorderRadius;
  const hasBorder = Boolean(cardBorderColor);

  // Track local border enabled state for the toggle
  const [localBorderEnabled, setLocalBorderEnabled] = useState(hasBorder);

  // Check if current variation supports pie percentages
  const isPieVariation = currentVariant === "pie" || currentVariant === "donut";

  const handleToggleCustomSettings = useCallback(
    (enabled: boolean) => {
      if (enabled) {
        // Enable custom settings - initialize with current global values
        toggleCardCustomColors(cardId, true);
      } else {
        // Reset to global settings
        resetCardToGlobal(cardId);
      }
    },
    [cardId, toggleCardCustomColors, resetCardToGlobal],
  );

  const handlePresetChange = useCallback(
    (preset: string) => {
      setCardColorPreset(cardId, preset);
    },
    [cardId, setCardColorPreset],
  );

  const handleColorChange = useCallback(
    (index: number, color: ColorValue) => {
      setCardColor(cardId, index, color);
    },
    [cardId, setCardColor],
  );

  const handleBorderColorChange = useCallback(
    (color: string) => {
      setCardBorderColor(cardId, color || undefined);
    },
    [cardId, setCardBorderColor],
  );

  const handleBorderRadiusChange = useCallback(
    (radius: number) => {
      setCardBorderRadius(cardId, clampBorderRadius(radius));
    },
    [cardId, setCardBorderRadius],
  );

  const handleToggleBorder = useCallback(
    (enabled: boolean) => {
      setLocalBorderEnabled(enabled);
      if (enabled) {
        // Enable border with default color if not set
        setCardBorderColor(
          cardId,
          cardBorderColor || globalBorderColor || "#e4e2e2",
        );
      } else {
        // Disable border
        setCardBorderColor(cardId, undefined);
      }
    },
    [cardId, cardBorderColor, globalBorderColor, setCardBorderColor],
  );

  const handleResetToGlobal = useCallback(() => {
    resetCardToGlobal(cardId);
    setLocalBorderEnabled(globalBorderEnabled);
  }, [cardId, resetCardToGlobal, globalBorderEnabled]);

  // Build advanced settings for SettingsContent
  const advancedSettings = {
    useStatusColors: config.advancedSettings.useStatusColors ?? false,
    showPiePercentages: config.advancedSettings.showPiePercentages ?? false,
    showFavorites: config.advancedSettings.showFavorites ?? false,
    gridCols: config.advancedSettings.gridCols ?? 3,
    gridRows: config.advancedSettings.gridRows ?? 3,
  };

  const handleAdvancedSettingChange = useCallback(
    function handleAdvancedSettingChange<K extends keyof CardAdvancedSettings>(
      key: K,
      value: CardAdvancedSettings[K],
    ) {
      setCardAdvancedSetting(cardId, key, value);
    },
    [cardId, setCardAdvancedSetting],
  );

  // Determine which advanced options to show
  const advancedVisibility = {
    showStatusColors: supportsStatusColors,
    showPiePercentages: supportsPiePercentages && isPieVariation,
    showFavorites: supportsFavorites,
    showGridSize: isFavoritesGrid,
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="overlay-scrollbar max-h-[85vh] max-w-4xl overflow-y-auto">
        <DialogHeader className="sr-only">
          <DialogTitle>{label} Settings</DialogTitle>
          <DialogDescription>
            Configure colors and border settings for {label}
          </DialogDescription>
        </DialogHeader>

        <CardSettingsPanel
          mode="card"
          idPrefix={cardId}
          title={`${label} Settings`}
          description="Customize this card's appearance"
          useCustomSettings={useCustomSettings}
          onUseCustomSettingsChange={handleToggleCustomSettings}
          settingsContentProps={{
            colors: cardColors as [
              ColorValue,
              ColorValue,
              ColorValue,
              ColorValue,
            ],
            colorPreset: cardColorPreset,
            onColorChange: handleColorChange,
            onPresetChange: handlePresetChange,
            borderEnabled: localBorderEnabled,
            onBorderEnabledChange: handleToggleBorder,
            borderColor: cardBorderColor || "#e4e2e2",
            onBorderColorChange: handleBorderColorChange,
            borderRadius: cardBorderRadius,
            onBorderRadiusChange: handleBorderRadiusChange,
            advancedSettings,
            onAdvancedSettingChange: handleAdvancedSettingChange,
            advancedVisibility,
            onReset: handleResetToGlobal,
          }}
        />
      </DialogContent>
    </Dialog>
  );
}
