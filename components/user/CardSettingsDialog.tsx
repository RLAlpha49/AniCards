"use client";

import { useCallback } from "react";
import { useShallow } from "zustand/react/shallow";

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

interface CardSettingsDialogProps {
  isOpen: boolean;
  onClose: () => void;
  cardId: string;
  label: string;
  supportsStatusColors?: boolean;
  supportsPiePercentages?: boolean;
  supportsFavorites?: boolean;
  isFavoritesGrid?: boolean;
  currentVariant?: string;
}

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
    configFromStore,
    globalColors,
    globalColorPreset,
    globalBorderEnabled,
    globalBorderColor,
    globalBorderRadius,
    globalAdvancedSettings,
    setCardColorPreset,
    setCardColor,
    setCardBorderColor,
    setCardBorderRadius,
    setCardAdvancedSetting,
    resetCardToGlobal,
    toggleCardCustomColors,
  } = useUserPageEditor(
    useShallow((state) => ({
      configFromStore: state.cardConfigs[cardId],
      globalColors: state.globalColors,
      globalColorPreset: state.globalColorPreset,
      globalBorderEnabled: state.globalBorderEnabled,
      globalBorderColor: state.globalBorderColor,
      globalBorderRadius: state.globalBorderRadius,
      globalAdvancedSettings: state.globalAdvancedSettings,
      setCardColorPreset: state.setCardColorPreset,
      setCardColor: state.setCardColor,
      setCardBorderColor: state.setCardBorderColor,
      setCardBorderRadius: state.setCardBorderRadius,
      setCardAdvancedSetting: state.setCardAdvancedSetting,
      resetCardToGlobal: state.resetCardToGlobal,
      toggleCardCustomColors: state.toggleCardCustomColors,
    })),
  );

  const config = configFromStore || {
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
      <DialogContent className="
        max-h-[85vh] max-w-4xl overflow-y-auto border border-border/60 bg-background/95 shadow-xl
        backdrop-blur-md
        dark:bg-background/95
      ">
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
