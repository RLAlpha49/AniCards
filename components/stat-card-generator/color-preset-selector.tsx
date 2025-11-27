import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { trackColorPresetSelection } from "@/lib/utils/google-analytics";
import { cn, isGradient, colorValueToString } from "@/lib/utils";
import { Check, Moon, Sun, Palette, Layers, Filter } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useState, useMemo } from "react";
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
    const stops = color.stops.map((s) => `${s.color} ${s.offset}%`).join(", ");
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
 * Includes filter tabs to filter by color type (solid/gradient) and theme (light/dark).
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
  const [colorTypeFilter, setColorTypeFilter] = useState<
    "all" | "solid" | "gradient"
  >("all");
  const [themeFilter, setThemeFilter] = useState<"all" | "light" | "dark">(
    "all",
  );

  // Wrapper that tracks selection for analytics then notifies caller.
  const handlePresetChange = (preset: string) => {
    trackColorPresetSelection(preset);
    onPresetChange(preset);
  };

  // Sort presets with a specific ordering:
  //  - keep known keys (default, anilistLight, anilistDark) in a fixed order
  //  - push 'custom' to the end
  //  - otherwise sort by mode (light before dark)
  const sortedPresets: PresetEntry[] = useMemo(
    () =>
      Object.entries(presets).sort(([aKey, aVal], [bKey, bVal]) => {
        const fixedOrder = [
          "default",
          "anilistLight",
          "anilistDark",
          "anilistLightGradient",
          "anilistDarkGradient",
        ];
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
      }),
    [presets],
  );

  // Apply filters to presets
  const filteredPresets = useMemo(() => {
    return sortedPresets.filter(([key, { colors, mode }]) => {
      // Always show custom preset
      if (key === "custom") return true;

      // Filter by color type
      const containsGradient = hasGradient(colors);
      if (colorTypeFilter === "solid" && containsGradient) return false;
      if (colorTypeFilter === "gradient" && !containsGradient) return false;

      // Filter by theme
      if (themeFilter === "light" && mode !== "light") return false;
      if (themeFilter === "dark" && mode !== "dark") return false;

      return true;
    });
  }, [sortedPresets, colorTypeFilter, themeFilter]);

  const totalPresets = filteredPresets.length;
  const hasMorePresets = totalPresets > DEFAULT_VISIBLE_PRESETS;
  const selectedIndex = filteredPresets.findIndex(
    ([key]) => key === selectedPreset,
  );
  const initialVisiblePresets = filteredPresets.slice(
    0,
    DEFAULT_VISIBLE_PRESETS,
  );
  const customPresetEntry = filteredPresets.find(([key]) => key === "custom");

  // Ensure 'custom' preset, if present, appears in the visible list
  const ensureCustomVisible = (list: PresetEntry[]): PresetEntry[] => {
    if (!customPresetEntry) return list;
    if (list.some(([key]) => key === "custom")) return list;
    return [...list, customPresetEntry];
  };

  const baseVisiblePresets = (() => {
    if (isExpanded || !hasMorePresets) {
      return filteredPresets;
    }
    if (
      selectedIndex >= DEFAULT_VISIBLE_PRESETS &&
      selectedIndex < filteredPresets.length
    ) {
      return [...initialVisiblePresets, filteredPresets[selectedIndex]];
    }
    return initialVisiblePresets;
  })();

  const visiblePresets = ensureCustomVisible(baseVisiblePresets);

  // Count presets by type for filter badges
  const presetCounts = useMemo(() => {
    const counts = { solid: 0, gradient: 0, light: 0, dark: 0 };
    for (const [key, { colors, mode }] of sortedPresets) {
      if (key === "custom") continue;
      const containsGradient = hasGradient(colors);
      if (containsGradient) counts.gradient++;
      else counts.solid++;
      if (mode === "light") counts.light++;
      else if (mode === "dark") counts.dark++;
    }
    return counts;
  }, [sortedPresets]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <Label className="text-base font-semibold text-gray-900 dark:text-gray-100">
          Color Preset
        </Label>
        <span className="text-xs text-muted-foreground">
          {filteredPresets.length} of {sortedPresets.length} presets
        </span>
      </div>

      {/* Filter Tabs */}
      <div className="space-y-2">
        {/* Color Type Filter */}
        <div className="flex items-center gap-2">
          <Filter className="h-3.5 w-3.5 text-gray-400" />
          <div className="flex gap-1">
            <Button
              type="button"
              variant={colorTypeFilter === "all" ? "default" : "outline"}
              size="sm"
              onClick={() => setColorTypeFilter("all")}
              className="h-7 px-2.5 text-xs"
            >
              All
            </Button>
            <Button
              type="button"
              variant={colorTypeFilter === "solid" ? "default" : "outline"}
              size="sm"
              onClick={() => setColorTypeFilter("solid")}
              className="h-7 gap-1 px-2.5 text-xs"
            >
              <Palette className="h-3 w-3" />
              Solid ({presetCounts.solid})
            </Button>
            <Button
              type="button"
              variant={colorTypeFilter === "gradient" ? "default" : "outline"}
              size="sm"
              onClick={() => setColorTypeFilter("gradient")}
              className="h-7 gap-1 px-2.5 text-xs"
            >
              <Layers className="h-3 w-3" />
              Gradient ({presetCounts.gradient})
            </Button>
          </div>
        </div>
        {/* Theme Filter */}
        <div className="flex items-center gap-2">
          <span className="h-3.5 w-3.5" /> {/* Spacer to align with above */}
          <div className="flex gap-1">
            <Button
              type="button"
              variant={themeFilter === "all" ? "default" : "outline"}
              size="sm"
              onClick={() => setThemeFilter("all")}
              className="h-7 px-2.5 text-xs"
            >
              All Themes
            </Button>
            <Button
              type="button"
              variant={themeFilter === "light" ? "default" : "outline"}
              size="sm"
              onClick={() => setThemeFilter("light")}
              className="h-7 gap-1 px-2.5 text-xs"
            >
              <Sun className="h-3 w-3" />
              Light ({presetCounts.light})
            </Button>
            <Button
              type="button"
              variant={themeFilter === "dark" ? "default" : "outline"}
              size="sm"
              onClick={() => setThemeFilter("dark")}
              className="h-7 gap-1 px-2.5 text-xs"
            >
              <Moon className="h-3 w-3" />
              Dark ({presetCounts.dark})
            </Button>
          </div>
        </div>
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
                      <div className="absolute left-1 top-1 rounded-full bg-black/10 p-0.5 backdrop-blur-sm dark:bg-white/10">
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
      {visiblePresets.length < filteredPresets.length && (
        <div className="flex justify-end">
          <Button
            variant="ghost"
            size="sm"
            type="button"
            onClick={() => setIsExpanded(true)}
            className="text-xs text-muted-foreground"
          >
            {`Show all ${totalPresets} presets`}
          </Button>
        </div>
      )}
    </div>
  );
}
