"use client";

import { useMemo } from "react";
import { motion } from "framer-motion";
import {
  Grid,
  Heart,
  Palette,
  PieChart,
  RotateCcw,
  Sliders,
  Square,
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Label } from "@/components/ui/Label";
import { Switch } from "@/components/ui/Switch";
import { Input } from "@/components/ui/Input";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/Tabs";
import { ColorPresetSelector } from "@/components/stat-card-generator/ColorPresetSelector";
import {
  ColorPickerGroup,
  type ColorPickerItem,
} from "@/components/stat-card-generator/ColorPickerGroup";
import { colorPresets } from "@/components/stat-card-generator/constants";
import { ColorPreviewCard } from "@/components/user/ColorPreviewCard";
import type { ColorValue } from "@/lib/types/card";

/**
 * Advanced settings configuration for status colors, pie percentages, favorites, and grid size.
 */
interface AdvancedSettings {
  useStatusColors?: boolean;
  showPiePercentages?: boolean;
  showFavorites?: boolean;
  gridCols?: number;
  gridRows?: number;
}

/**
 * Visibility flags for advanced options.
 */
interface AdvancedVisibility {
  showStatusColors?: boolean;
  showPiePercentages?: boolean;
  showFavorites?: boolean;
  showGridSize?: boolean;
}

/**
 * Props for SettingsContent component.
 * @source
 */
interface SettingsContentProps {
  /** Unique identifier prefix for form elements */
  idPrefix: string;
  /** Mode determines label text differences ("global" vs "card") */
  mode: "global" | "card";

  // Color state
  /** Array of 4 colors: [title, background, text, circle/accent] */
  colors: [ColorValue, ColorValue, ColorValue, ColorValue];
  /** Currently selected color preset ID */
  colorPreset: string;
  /** Handler when color at index changes */
  onColorChange: (index: number, value: ColorValue) => void;
  /** Handler when preset changes */
  onPresetChange: (preset: string) => void;

  // Border state
  /** Whether border is enabled */
  borderEnabled: boolean;
  /** Handler for border enabled toggle */
  onBorderEnabledChange: (enabled: boolean) => void;
  /** Current border color */
  borderColor: string;
  /** Handler for border color change */
  onBorderColorChange: (color: string) => void;
  /** Current border radius in pixels */
  borderRadius: number;
  /** Handler for border radius change */
  onBorderRadiusChange: (radius: number) => void;

  // Advanced settings
  /** Current advanced settings values */
  advancedSettings: AdvancedSettings;
  /** Handler for advanced setting changes */
  onAdvancedSettingChange: <K extends keyof AdvancedSettings>(
    key: K,
    value: AdvancedSettings[K],
  ) => void;
  /** Which advanced options to show (defaults to all for global, controlled for card) */
  advancedVisibility?: AdvancedVisibility;

  // Reset
  /** Handler for reset action */
  onReset: () => void;
  /** Label for reset button (e.g., "Reset to Defaults" or "Reset to Global Settings") */
  resetLabel?: string;
}

/**
 * Shared settings content component with Colors, Border, and Advanced tabs.
 * Used by both GlobalSettingsPanel and CardSettingsDialog for consistency.
 * @param props - Component props.
 * @returns JSX element.
 * @source
 */
export function SettingsContent({
  idPrefix,
  mode,
  colors,
  colorPreset,
  onColorChange,
  onPresetChange,
  borderEnabled,
  onBorderEnabledChange,
  borderColor,
  onBorderColorChange,
  borderRadius,
  onBorderRadiusChange,
  advancedSettings,
  onAdvancedSettingChange,
  advancedVisibility,
  onReset,
  resetLabel,
}: Readonly<SettingsContentProps>) {
  // Default visibility - show all for global, controlled for card
  const visibility: AdvancedVisibility = advancedVisibility ?? {
    showStatusColors: mode === "global",
    showPiePercentages: mode === "global",
    showFavorites: mode === "global",
    showGridSize: mode === "global",
  };

  // Determine if advanced tab should be shown
  const hasAdvancedOptions =
    visibility.showStatusColors ||
    visibility.showPiePercentages ||
    visibility.showFavorites ||
    visibility.showGridSize;

  // Color pickers configuration
  const colorPickers = useMemo<ColorPickerItem[]>(
    () => [
      {
        id: `${idPrefix}-titleColor`,
        label: "Title",
        value: colors[0],
        onChange: (value: ColorValue) => onColorChange(0, value),
      },
      {
        id: `${idPrefix}-backgroundColor`,
        label: "Background",
        value: colors[1],
        onChange: (value: ColorValue) => onColorChange(1, value),
      },
      {
        id: `${idPrefix}-textColor`,
        label: "Text",
        value: colors[2],
        onChange: (value: ColorValue) => onColorChange(2, value),
      },
      {
        id: `${idPrefix}-circleColor`,
        label: mode === "global" ? "Accent" : "Circle",
        value: colors[3],
        onChange: (value: ColorValue) => onColorChange(3, value),
      },
    ],
    [idPrefix, mode, colors, onColorChange],
  );

  const defaultResetLabel =
    mode === "global" ? "Reset to Defaults" : "Reset to Global Settings";

  return (
    <div className="space-y-4">
      <Tabs defaultValue="colors" className="w-full">
        <TabsList
          className={`grid w-full gap-1 ${hasAdvancedOptions ? "grid-cols-3" : "grid-cols-2"}`}
        >
          <TabsTrigger value="colors" className="gap-2">
            <Palette className="h-4 w-4" />
            Colors
          </TabsTrigger>
          <TabsTrigger value="border" className="gap-2">
            <Square className="h-4 w-4" />
            Border
          </TabsTrigger>
          {hasAdvancedOptions && (
            <TabsTrigger value="advanced" className="gap-2">
              <Sliders className="h-4 w-4" />
              Advanced
            </TabsTrigger>
          )}
        </TabsList>

        {/* Colors Tab */}
        <TabsContent value="colors" className="mt-4 space-y-4">
          {/* Color Preview */}
          <div className="flex justify-center rounded-xl border border-slate-200/60 bg-slate-50/50 p-4 dark:border-slate-700/60 dark:bg-slate-900/50">
            <ColorPreviewCard
              titleColor={colors[0]}
              backgroundColor={colors[1]}
              textColor={colors[2]}
              circleColor={colors[3]}
              borderColor={borderEnabled ? borderColor : undefined}
              borderRadius={borderRadius}
            />
          </div>

          {/* Color Preset Selector */}
          <div className="space-y-3">
            <Label className="text-sm font-semibold text-slate-700 dark:text-slate-300">
              Color Preset
            </Label>
            <ColorPresetSelector
              selectedPreset={colorPreset}
              presets={colorPresets}
              onPresetChange={onPresetChange}
            />
          </div>

          {/* Individual Color Pickers */}
          <div className="space-y-3">
            <Label className="text-sm font-semibold text-slate-700 dark:text-slate-300">
              Custom Colors
            </Label>
            <ColorPickerGroup pickers={colorPickers} />
          </div>
        </TabsContent>

        {/* Border Tab */}
        <TabsContent value="border" className="mt-4 space-y-4">
          {/* Border Toggle */}
          <div className="flex items-center justify-between rounded-lg border border-slate-200/50 bg-slate-50/50 p-3 dark:border-slate-700/50 dark:bg-slate-900/50">
            <div className="flex items-center gap-2">
              <Square className="h-4 w-4 text-slate-500" />
              <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
                Enable Border
              </span>
            </div>
            <Switch
              checked={borderEnabled}
              onCheckedChange={onBorderEnabledChange}
              className="data-[state=checked]:bg-blue-500"
            />
          </div>

          {/* Border Settings - Only shown when border is enabled */}
          {borderEnabled && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="space-y-4"
            >
              {/* Border Color */}
              <div className="space-y-2">
                <Label className="text-sm font-medium text-slate-700 dark:text-slate-300">
                  Border Color
                </Label>
                <div className="flex items-center gap-3">
                  <div className="relative h-10 w-10 shrink-0 overflow-hidden rounded-lg border-2 border-slate-200 shadow-inner dark:border-slate-700">
                    <Input
                      type="color"
                      value={borderColor}
                      onChange={(e) => onBorderColorChange(e.target.value)}
                      className="absolute -left-1/2 -top-1/2 h-[200%] w-[200%] cursor-pointer border-0 p-0"
                    />
                  </div>
                  <Input
                    type="text"
                    value={borderColor}
                    onChange={(e) => onBorderColorChange(e.target.value)}
                    className="h-10 flex-1 font-mono text-sm uppercase"
                    placeholder="#e4e2e2"
                  />
                </div>
              </div>

              {/* Border Radius */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label className="text-sm font-medium text-slate-700 dark:text-slate-300">
                    Border Radius
                  </Label>
                  <span className="rounded-md bg-slate-100 px-2 py-0.5 text-sm font-bold text-slate-700 dark:bg-slate-800 dark:text-slate-300">
                    {borderRadius}px
                  </span>
                </div>
                <Input
                  type="range"
                  min={0}
                  max={20}
                  value={borderRadius}
                  onChange={(e) =>
                    onBorderRadiusChange(Number.parseInt(e.target.value))
                  }
                  className="h-2 w-full cursor-pointer appearance-none rounded-full bg-gradient-to-r from-slate-200 to-slate-300 px-0 dark:from-slate-700 dark:to-slate-600"
                />
              </div>
            </motion.div>
          )}
        </TabsContent>

        {/* Advanced Tab */}
        {hasAdvancedOptions && (
          <TabsContent value="advanced" className="mt-4 space-y-4">
            {/* Use Status Colors */}
            {visibility.showStatusColors && (
              <div className="flex items-center justify-between rounded-lg border border-slate-200/50 bg-slate-50/50 p-3 dark:border-slate-700/50 dark:bg-slate-900/50">
                <div className="flex items-center gap-2">
                  <Palette className="h-4 w-4 text-slate-400" />
                  <div>
                    <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
                      Status Colors
                    </span>
                    {mode === "global" && (
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        Fixed colors for status distribution
                      </p>
                    )}
                  </div>
                </div>
                <Switch
                  checked={advancedSettings.useStatusColors ?? true}
                  onCheckedChange={(checked) =>
                    onAdvancedSettingChange("useStatusColors", checked)
                  }
                  className="data-[state=checked]:bg-green-500"
                />
              </div>
            )}

            {/* Show Pie Percentages */}
            {visibility.showPiePercentages && (
              <div className="flex items-center justify-between rounded-lg border border-slate-200/50 bg-slate-50/50 p-3 dark:border-slate-700/50 dark:bg-slate-900/50">
                <div className="flex items-center gap-2">
                  <PieChart className="h-4 w-4 text-slate-400" />
                  <div>
                    <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
                      Show Percentages
                    </span>
                    {mode === "global" && (
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        Display % on pie/donut charts
                      </p>
                    )}
                  </div>
                </div>
                <Switch
                  checked={advancedSettings.showPiePercentages ?? true}
                  onCheckedChange={(checked) =>
                    onAdvancedSettingChange("showPiePercentages", checked)
                  }
                  className="data-[state=checked]:bg-green-500"
                />
              </div>
            )}

            {/* Show Favorites */}
            {visibility.showFavorites && (
              <div className="flex items-center justify-between rounded-lg border border-slate-200/50 bg-slate-50/50 p-3 dark:border-slate-700/50 dark:bg-slate-900/50">
                <div className="flex items-center gap-2">
                  <Heart className="h-4 w-4 text-slate-400" />
                  <div>
                    <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
                      Show Favorites
                    </span>
                    {mode === "global" && (
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        Display favorites on applicable cards
                      </p>
                    )}
                  </div>
                </div>
                <Switch
                  checked={advancedSettings.showFavorites ?? true}
                  onCheckedChange={(checked) =>
                    onAdvancedSettingChange("showFavorites", checked)
                  }
                  className="data-[state=checked]:bg-green-500"
                />
              </div>
            )}

            {/* Grid Size */}
            {visibility.showGridSize && (
              <div className="space-y-3 rounded-lg border border-slate-200/50 bg-slate-50/50 p-3 dark:border-slate-700/50 dark:bg-slate-900/50">
                <div className="flex items-center gap-2">
                  <Grid className="h-4 w-4 text-slate-400" />
                  <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
                    {mode === "global" ? "Favorites Grid Size" : "Grid Size"}
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label className="mb-1 text-xs text-slate-500">
                      Columns
                    </Label>
                    <Input
                      type="number"
                      min={1}
                      max={5}
                      value={advancedSettings.gridCols ?? 3}
                      onChange={(e) => {
                        const val = Math.max(
                          1,
                          Math.min(5, Number(e.target.value) || 1),
                        );
                        onAdvancedSettingChange("gridCols", val);
                      }}
                      className="h-9 text-sm"
                    />
                  </div>
                  <div>
                    <Label className="mb-1 text-xs text-slate-500">Rows</Label>
                    <Input
                      type="number"
                      min={1}
                      max={5}
                      value={advancedSettings.gridRows ?? 3}
                      onChange={(e) => {
                        const val = Math.max(
                          1,
                          Math.min(5, Number(e.target.value) || 1),
                        );
                        onAdvancedSettingChange("gridRows", val);
                      }}
                      className="h-9 text-sm"
                    />
                  </div>
                </div>
                {mode === "global" && (
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Grid dimensions for favorites card (1-5 each)
                  </p>
                )}
              </div>
            )}
          </TabsContent>
        )}
      </Tabs>

      {/* Reset Button */}
      <div className="flex justify-end border-t border-slate-200/50 pt-4 dark:border-slate-700/50">
        <Button
          variant="outline"
          size="sm"
          onClick={onReset}
          className="gap-2 text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
        >
          <RotateCcw className="h-4 w-4" />
          {resetLabel ?? defaultResetLabel}
        </Button>
      </div>
    </div>
  );
}
