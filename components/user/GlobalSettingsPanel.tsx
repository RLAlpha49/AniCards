"use client";

import { useCallback } from "react";

import { colorPresets } from "@/components/stat-card-generator/constants";
import {
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/Dialog";
import { CardSettingsPanel } from "@/components/user/CardSettingsPanel";
import { SettingsTools } from "@/components/user/SettingsTools";
import { useUserPageEditor } from "@/lib/stores/user-page-editor";
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
    resetGlobalSettings,
  } = useUserPageEditor();

  const handleResetToDefaults = useCallback(() => {
    resetGlobalSettings();
  }, [resetGlobalSettings]);

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
        tools={<SettingsTools mode="global" />}
        settingsContentProps={{
          colors: (globalColors.length === 4
            ? globalColors
            : [
                ...globalColors,
                ...colorPresets.default.colors.slice(globalColors.length, 4),
              ]) as [ColorValue, ColorValue, ColorValue, ColorValue],
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
