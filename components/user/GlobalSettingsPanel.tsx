"use client";

import { useCallback } from "react";
import {
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/Dialog";
import { CardSettingsPanel } from "@/components/user/CardSettingsPanel";
import { useUserPageEditor, DEFAULT_GLOBAL_SETTINGS } from "@/lib/stores/user-page-editor";
import type { ColorValue } from "@/lib/types/card";

/**
 * Props for GlobalSettingsPanel component.
 * @source
 */
interface GlobalSettingsPanelProps {
  /** Handler to save all cards (may be async) */
  onSave?: () => void | Promise<void>;
} 

/**
 * Panel for configuring global color and border settings.
 * Uses a tabbed layout matching the individual CardSettingsDialog design.
 * @param props - Component props.
 * @returns JSX element.
 * @source
 */
export function GlobalSettingsPanel({
  onSave,
}: Readonly<GlobalSettingsPanelProps>) {
  const {
    globalColorPreset,
    globalColors,
    globalBorderEnabled,
    globalBorderColor,
    globalBorderRadius,
    globalAdvancedSettings,
    isDirty,
    isSaving,
    setGlobalColorPreset,
    setGlobalColor,
    setGlobalBorderEnabled,
    setGlobalBorderColor,
    setGlobalBorderRadius,
    setGlobalAdvancedSetting,
  } = useUserPageEditor();

  // Handler for resetting global settings to defaults
  const handleResetToDefaults = useCallback(() => {
    setGlobalColorPreset(DEFAULT_GLOBAL_SETTINGS.colorPreset);
    setGlobalBorderEnabled(DEFAULT_GLOBAL_SETTINGS.borderEnabled);
    setGlobalBorderColor(DEFAULT_GLOBAL_SETTINGS.borderColor);
    setGlobalBorderRadius(DEFAULT_GLOBAL_SETTINGS.borderRadius);
    setGlobalAdvancedSetting(
      "useStatusColors",
      DEFAULT_GLOBAL_SETTINGS.advancedSettings.useStatusColors,
    );
    setGlobalAdvancedSetting(
      "showPiePercentages",
      DEFAULT_GLOBAL_SETTINGS.advancedSettings.showPiePercentages,
    );
    setGlobalAdvancedSetting(
      "showFavorites",
      DEFAULT_GLOBAL_SETTINGS.advancedSettings.showFavorites,
    );
    setGlobalAdvancedSetting(
      "gridCols",
      DEFAULT_GLOBAL_SETTINGS.advancedSettings.gridCols,
    );
    setGlobalAdvancedSetting(
      "gridRows",
      DEFAULT_GLOBAL_SETTINGS.advancedSettings.gridRows,
    );
  }, [
    setGlobalColorPreset,
    setGlobalBorderEnabled,
    setGlobalBorderColor,
    setGlobalBorderRadius,
    setGlobalAdvancedSetting,
    DEFAULT_GLOBAL_SETTINGS,
  ]);

  const handleColorChange = useCallback(
    (index: number, value: ColorValue) => {
      setGlobalColor(index, value);
    },
    [setGlobalColor],
  );

  return (
    <>
      <DialogHeader className="sr-only">
        <DialogTitle>Global Settings</DialogTitle>
        <DialogDescription>
          Configure settings that apply to all cards
        </DialogDescription>
      </DialogHeader>

      <CardSettingsPanel
        mode="global"
        title="Global Settings"
        description="Apply to all cards"
        onSaveAll={onSave}
        saveAllDisabled={!isDirty}
        isSaving={isSaving}
        settingsContentProps={{
          colors: globalColors as [
            ColorValue,
            ColorValue,
            ColorValue,
            ColorValue,
          ],
          colorPreset: globalColorPreset,
          onColorChange: handleColorChange,
          onPresetChange: setGlobalColorPreset,
          borderEnabled: globalBorderEnabled,
          onBorderEnabledChange: setGlobalBorderEnabled,
          borderColor: globalBorderColor,
          onBorderColorChange: setGlobalBorderColor,
          borderRadius: globalBorderRadius,
          onBorderRadiusChange: setGlobalBorderRadius,
          advancedSettings: globalAdvancedSettings,
          onAdvancedSettingChange: setGlobalAdvancedSetting,
          onReset: handleResetToDefaults,
        }}
      />
    </>
  );
}
