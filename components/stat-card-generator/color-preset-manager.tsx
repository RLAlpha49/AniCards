"use client";

import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { ColorPresetSelector } from "./color-preset-selector";
import { ColorPickerGroup } from "./color-picker-group";
import { LivePreview } from "./live-preview";
import { useGeneratorContext } from "./generator-context";
import { colorPresets } from "./constants";

export function ColorPresetManager() {
  const {
    selectedPreset,
    handlePresetChange,
    colorPickers,
    borderColorPicker,
    hasBorder,
    handleToggleBorder,
    previewSVG,
  } = useGeneratorContext();

  const handlePresetSelection = (preset: string) => {
    handlePresetChange(preset);
  };

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-800 dark:bg-gray-900">
        <Label className="mb-4 block text-sm font-medium text-gray-500">
          Live Preview
        </Label>
        <LivePreview previewSVG={previewSVG} />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="min-w-0">
          <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-gray-900">
            <ColorPresetSelector
              selectedPreset={selectedPreset}
              presets={colorPresets}
              onPresetChange={handlePresetSelection}
            />
          </div>
        </div>
        <div className="min-w-0 space-y-6">
          <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-gray-900">
            <ColorPickerGroup pickers={colorPickers} />
          </div>
          <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-gray-900">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label className="text-base">Card Border</Label>
                <p className="text-xs text-muted-foreground">
                  Optional frame around the entire card
                </p>
              </div>
              <Switch
                checked={hasBorder}
                onCheckedChange={handleToggleBorder}
              />
            </div>
            {hasBorder && (
              <div className="mt-4">
                <ColorPickerGroup pickers={[borderColorPicker]} />
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
