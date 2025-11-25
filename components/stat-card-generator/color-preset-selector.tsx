import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { trackColorPresetSelection } from "@/lib/utils/google-analytics";
import { cn, isGradient, colorValueToString } from "@/lib/utils";
import { Check, Moon, Sun, Palette, Layers } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useState } from "react";
import type { ColorValue } from "@/lib/types/card";

/**
 * Props for the ColorPresetSelector component.
 * @property selectedPreset - The currently selected preset key.
 * @property presets - Mapping of preset keys to colors and light/dark mode.
 * @property onPresetChange - Callback invoked when a preset is selected.
 * @source
 */
export interface ColorPresetSelectorProps {
  selectedPreset: string;
  presets: {
    [key: string]: { colors: ColorValue[]; mode: string };
  };
  onPresetChange: (preset: string) => void;
}

/** Default number of visible presets before expanding. @source */
const DEFAULT_VISIBLE_PRESETS = 8;
/**
 * Tuple for preset entries, [key, { colors, mode }].
 * @source
 */
type PresetEntry = [string, { colors: ColorValue[]; mode: string }];

/** Check if a preset contains any gradient colors. */
function hasGradient(colors: ColorValue[]): boolean {
  return colors.some(isGradient);
}

/** Convert a ColorValue to a CSS background style string. */
function colorToCssBackground(color: ColorValue): string {
  if (isGradient(color)) {
    const stops = color.stops
      .map((s) => `${s.color} ${s.offset * 100}%`)
      .join(", ");
    if (color.type === "radial") {
      const cx = color.cx ?? 50;
      const cy = color.cy ?? 50;
      return `radial-gradient(circle at ${cx}% ${cy}%, ${stops})`;
    }
    return `linear-gradient(${color.angle ?? 0}deg, ${stops})`;
  }
  return color;
}

/**
 * Renders the available color presets and lets the user pick one.
 * Presets are sorted deterministically and the list can expand when many are present.
 * @param selectedPreset - Key of the currently selected preset.
 * @param presets - Map of preset definitions keyed by string.
 * @param onPresetChange - Callback called with the selected preset key.
 * @returns A React element showing available color presets.
 * @source
 */
export function ColorPresetSelector({
  selectedPreset,
  presets,
  onPresetChange,
}: Readonly<ColorPresetSelectorProps>) {
  const [isExpanded, setIsExpanded] = useState(false);
  // Wrapper that tracks selection for analytics then notifies caller.
  const handlePresetChange = (preset: string) => {
    trackColorPresetSelection(preset);
    onPresetChange(preset);
  };

  // Sort presets with a specific ordering:
  //  - keep known keys (default, anilistLight, anilistDark) in a fixed order
  //  - push 'custom' to the end
  //  - otherwise sort by mode (light before dark)
  const sortedPresets: PresetEntry[] = Object.entries(presets).sort(
    ([aKey, aVal], [bKey, bVal]) => {
      const fixedOrder = ["default", "anilistLight", "anilistDark"];
      const aFixedIndex = fixedOrder.indexOf(aKey);
      const bFixedIndex = fixedOrder.indexOf(bKey);
      if (aFixedIndex !== -1 || bFixedIndex !== -1) {
        if (aFixedIndex !== -1 && bFixedIndex !== -1) {
          return aFixedIndex - bFixedIndex;
        }
        return aFixedIndex === -1 ? 1 : -1;
      }
      if (aKey === "custom") return 1;
      if (bKey === "custom") return -1;
      if (aVal.mode === bVal.mode) return 0;
      return aVal.mode === "light" ? -1 : 1;
    },
  );

  const totalPresets = sortedPresets.length;
  const hasMorePresets = totalPresets > DEFAULT_VISIBLE_PRESETS;
  const selectedIndex = sortedPresets.findIndex(
    ([key]) => key === selectedPreset,
  );
  const initialVisiblePresets = sortedPresets.slice(0, DEFAULT_VISIBLE_PRESETS);
  const customPresetEntry = sortedPresets.find(([key]) => key === "custom");

  // Ensure 'custom' preset, if present, appears in the visible list
  const ensureCustomVisible = (list: PresetEntry[]): PresetEntry[] => {
    if (!customPresetEntry) return list;
    if (list.some(([key]) => key === "custom")) return list;
    return [...list, customPresetEntry];
  };

  const baseVisiblePresets = (() => {
    if (isExpanded || !hasMorePresets) {
      return sortedPresets;
    }
    if (
      selectedIndex >= DEFAULT_VISIBLE_PRESETS &&
      selectedIndex < sortedPresets.length
    ) {
      return [...initialVisiblePresets, sortedPresets[selectedIndex]];
    }
    return initialVisiblePresets;
  })();

  const visiblePresets = ensureCustomVisible(baseVisiblePresets);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <Label className="text-base font-semibold text-gray-900 dark:text-gray-100">
          Color Preset
        </Label>
        <span className="text-xs text-muted-foreground">
          {sortedPresets.length} presets available
        </span>
      </div>

      <div className="grid grid-cols-[repeat(auto-fit,minmax(96px,1fr))] gap-3">
        <TooltipProvider delayDuration={0}>
          {visiblePresets.map(([key, { colors, mode }]) => {
            const isSelected = selectedPreset === key;
            const isCustom = key === "custom";
            const containsGradient = hasGradient(colors);

            return (
              <Tooltip key={key}>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    onClick={() => handlePresetChange(key)}
                    className={cn(
                      "group relative flex h-14 w-full items-center justify-center overflow-hidden rounded-xl border-2 transition-all duration-200",
                      isSelected
                        ? "border-blue-500 ring-2 ring-blue-500/20 dark:border-blue-400"
                        : "border-transparent hover:border-gray-200 dark:hover:border-gray-700",
                      "bg-white dark:bg-gray-800",
                    )}
                  >
                    {isCustom ? (
                      <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-gray-100 to-gray-200 dark:from-gray-800 dark:to-gray-900">
                        <Palette className="h-5 w-5 text-gray-500 dark:text-gray-400" />
                      </div>
                    ) : (
                      <div className="flex h-full w-full">
                        {colors.map((color, i) => (
                          <div
                            key={`${colorValueToString(color)}-${i}`}
                            className="h-full flex-1"
                            style={{ background: colorToCssBackground(color) }}
                          />
                        ))}
                      </div>
                    )}

                    {/* Selection Indicator */}
                    {isSelected && (
                      <div className="absolute inset-0 flex items-center justify-center bg-black/20 backdrop-blur-[1px]">
                        <div className="rounded-full bg-white p-1 shadow-sm dark:bg-gray-900">
                          <Check className="h-3 w-3 text-blue-600 dark:text-blue-400" />
                        </div>
                      </div>
                    )}

                    {/* Gradient Indicator (Top Left) */}
                    {containsGradient && !isCustom && (
                      <div className="absolute top-1 left-1 rounded-full bg-black/10 p-0.5 backdrop-blur-sm dark:bg-white/10">
                        <Layers className="h-2.5 w-2.5 text-purple-600 dark:text-purple-300" />
                      </div>
                    )}

                    {/* Mode Indicator (Corner) */}
                    {!isCustom && (
                      <div className="absolute bottom-1 right-1 rounded-full bg-black/10 p-0.5 backdrop-blur-sm dark:bg-white/10">
                        {mode === "light" ? (
                          <Sun className="h-2.5 w-2.5 text-yellow-600 dark:text-yellow-300" />
                        ) : (
                          <Moon className="h-2.5 w-2.5 text-indigo-600 dark:text-indigo-300" />
                        )}
                      </div>
                    )}
                  </button>
                </TooltipTrigger>
                <TooltipContent
                  side="bottom"
                  className="flex items-center gap-2"
                >
                  <span className="font-medium capitalize">
                    {key.replaceAll(/([A-Z])/g, " $1").trim()}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    ({mode === "light" ? "Light" : "Dark"})
                  </span>
                  {containsGradient && (
                    <span className="text-xs text-purple-500">• Gradient</span>
                  )}
                </TooltipContent>
              </Tooltip>
            );
          })}
        </TooltipProvider>
      </div>
      {hasMorePresets && (
        <div className="flex justify-end">
          <Button
            variant="ghost"
            size="sm"
            type="button"
            onClick={() => setIsExpanded((prev) => !prev)}
            className="text-xs text-muted-foreground"
          >
            {isExpanded
              ? "Show fewer presets"
              : `Show all ${totalPresets} presets`}
          </Button>
        </div>
      )}
    </div>
  );
}
