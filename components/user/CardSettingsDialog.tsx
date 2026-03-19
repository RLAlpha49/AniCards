"use client";

import { useCallback } from "react";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/Dialog";
import { CardSettingsPanel } from "@/components/user/CardSettingsPanel";
import { SettingsTools } from "@/components/user/SettingsTools";
import {
  type CardAdvancedSettings,
  DEFAULT_BORDER_COLOR,
  isCardCustomized,
  useUserPageEditor,
} from "@/lib/stores/user-page-editor";
import type { ColorValue } from "@/lib/types/card";
import { clampBorderRadius } from "@/lib/utils";

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
    globalAdvancedSettings,
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

  const cardColors =
    config.colorOverride.useCustomSettings && config.colorOverride.colors
      ? config.colorOverride.colors
      : globalColors;

  const cardColorPreset =
    config.colorOverride.useCustomSettings && config.colorOverride.colorPreset
      ? config.colorOverride.colorPreset
      : globalColorPreset;

  const cardBorderColor =
    config.borderColor ?? (globalBorderEnabled ? globalBorderColor : undefined);
  const cardBorderRadius = config.borderRadius ?? globalBorderRadius;
  const hasBorder = Boolean(cardBorderColor);

  const isCustomized = isCardCustomized(config);

  const isPieVariation = currentVariant === "pie" || currentVariant === "donut";

  const handleToggleCustomSettings = useCallback(
    (enabled: boolean) => {
      if (enabled) {
        toggleCardCustomColors(cardId, true);
      } else {
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
      if (enabled) {
        setCardBorderColor(
          cardId,
          cardBorderColor || globalBorderColor || DEFAULT_BORDER_COLOR,
        );
      } else {
        setCardBorderColor(cardId, undefined);
      }
    },
    [cardId, cardBorderColor, globalBorderColor, setCardBorderColor],
  );

  const handleResetToGlobal = useCallback(() => {
    resetCardToGlobal(cardId);
  }, [cardId, resetCardToGlobal]);

  const rawAdvancedSettings = config.advancedSettings;

  const handleAdvancedSettingChange = useCallback(
    <K extends keyof CardAdvancedSettings>(
      key: K,
      value: CardAdvancedSettings[K],
    ) => {
      setCardAdvancedSetting(cardId, key, value);
    },
    [cardId, setCardAdvancedSetting],
  );

  const advancedVisibility = {
    showStatusColors: supportsStatusColors,
    showPiePercentages: supportsPiePercentages && isPieVariation,
    showFavorites: supportsFavorites,
    showGridSize: isFavoritesGrid,
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="overlay-scrollbar border-gold/20 bg-background shadow-gold/5 dark:border-gold/15 dark:shadow-gold/10 max-h-[85vh] max-w-4xl overflow-y-auto border-2 shadow-xl">
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
          tools={
            <SettingsTools mode="card" cardId={cardId} cardLabel={label} />
          }
          isCustomized={isCustomized}
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
            borderEnabled: hasBorder,
            onBorderEnabledChange: handleToggleBorder,
            borderColor: cardBorderColor || DEFAULT_BORDER_COLOR,
            onBorderColorChange: handleBorderColorChange,
            borderRadius: cardBorderRadius,
            onBorderRadiusChange: handleBorderRadiusChange,
            advancedSettings: rawAdvancedSettings,
            inheritedAdvancedSettings: globalAdvancedSettings,
            onAdvancedSettingChange: handleAdvancedSettingChange,
            advancedVisibility,
            onReset: handleResetToGlobal,
          }}
        />
      </DialogContent>
    </Dialog>
  );
}
