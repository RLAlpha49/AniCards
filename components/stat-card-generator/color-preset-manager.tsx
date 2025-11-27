"use client";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { ColorPresetSelector } from "./color-preset-selector";
import { ColorPickerGroup } from "./color-picker-group";
import { LivePreview } from "./live-preview";
import { DEFAULT_CARD_BORDER_RADIUS } from "@/lib/utils";
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
    borderRadius,
    borderColorEnabled,
    handleToggleBorderColorEnabled,
    isBorderColorCustom,
    handleBorderRadiusChange,
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
            {hasBorder ? (
              <>
                <div className="mt-6 space-y-2">
                  <div className="space-y-0.5">
                    <Label className="text-sm">Border Radius</Label>
                    <p className="text-xs text-muted-foreground">
                      Corner rounding applied to every card display
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Input
                      type="number"
                      min={0}
                      max={50}
                      step={0.1}
                      value={borderRadius}
                      onChange={(e) => {
                        const parsed = Number.parseFloat(e.target.value);
                        handleBorderRadiusChange(
                          Number.isFinite(parsed) ? parsed : 0,
                        );
                      }}
                      className="h-8 w-20 text-center text-sm"
                    />
                    <span className="text-xs text-muted-foreground">px</span>
                  </div>
                </div>
                <div className="mt-4 space-y-2">
                  <div className="flex items-start justify-between">
                    <div>
                      <Label className="text-sm">Border color</Label>
                      <p className="text-xs text-muted-foreground">
                        Toggle to omit the border color (None) without affecting
                        the radius.
                      </p>
                    </div>
                    <Switch
                      checked={borderColorEnabled}
                      onCheckedChange={handleToggleBorderColorEnabled}
                    />
                  </div>
                  <ColorPickerGroup pickers={[borderColorPicker]} />
                  <div className="text-xs text-muted-foreground">
                    {borderColorEnabled
                      ? isBorderColorCustom
                        ? "Custom border color applied."
                        : "Using the default border color."
                      : "Border color disabled (None)."}
                  </div>
                  <p className="text-[11px] text-muted-foreground">
                    Disabling the border color removes the stroke (None) while
                    still honoring the radius you choose.
                  </p>
                </div>
              </>
            ) : (
              <p className="mt-6 text-xs text-muted-foreground">
                Border radius defaults to {DEFAULT_CARD_BORDER_RADIUS}px when
                the border is disabled.
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
