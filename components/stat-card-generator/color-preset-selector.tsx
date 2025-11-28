import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  trackColorPresetSelection,
  safeTrack,
} from "@/lib/utils/google-analytics";
import { cn, isGradient, colorValueToString } from "@/lib/utils";
import {
  Check,
  Moon,
  Sun,
  Palette,
  Layers,
  Filter,
  ChevronDown,
  Sparkles,
} from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useEffect, useMemo, useRef, useState } from "react";
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
const DEFAULT_VISIBLE_PRESET_ROWS = 2;
const MIN_PRESET_COLUMN_WIDTH = 120;
const PRESET_GRID_GAP_PX = 10;
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
  const gridRef = useRef<HTMLDivElement | null>(null);
  const [columnCount, setColumnCount] = useState(1);

  // Wrapper that tracks selection for analytics then notifies caller.
  const handlePresetChange = (preset: string) => {
    onPresetChange(preset);
    safeTrack(() => trackColorPresetSelection(preset));
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

  const DEFAULT_VISIBLE_PRESETS = Math.max(
    1,
    columnCount * DEFAULT_VISIBLE_PRESET_ROWS - 1,
  );
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

  useEffect(() => {
    const gridElement = gridRef.current;
    if (!gridElement) return;

    const computeColumns = () => {
      const width = gridElement.clientWidth;
      if (width === 0) {
        setColumnCount(1);
        return;
      }
      const possibleColumns = Math.max(
        1,
        Math.floor(
          (width + PRESET_GRID_GAP_PX) /
            (MIN_PRESET_COLUMN_WIDTH + PRESET_GRID_GAP_PX),
        ),
      );
      setColumnCount((prev) =>
        prev === possibleColumns ? prev : possibleColumns,
      );
    };

    computeColumns();

    if (typeof ResizeObserver === "undefined") {
      return;
    }

    const observer = new ResizeObserver(computeColumns);
    observer.observe(gridElement);

    return () => observer.disconnect();
  }, []);

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <Label className="text-base font-bold text-slate-900 dark:text-white">
          Choose a Preset
        </Label>
        <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-600 dark:bg-slate-800 dark:text-slate-400">
          {filteredPresets.length} of {sortedPresets.length}
        </span>
      </div>

      {/* Filter Tabs */}
      <div className="space-y-3">
        {/* Color Type Filter */}
        <div className="flex items-center gap-2">
          <Filter className="h-4 w-4 text-slate-400" />
          <div className="flex gap-1.5">
            {[
              { value: "all", label: "All Types" },
              {
                value: "solid",
                label: "Solid",
                icon: Palette,
                count: presetCounts.solid,
              },
              {
                value: "gradient",
                label: "Gradient",
                icon: Layers,
                count: presetCounts.gradient,
              },
            ].map((option) => (
              <Button
                key={option.value}
                type="button"
                variant={
                  colorTypeFilter === option.value ? "default" : "outline"
                }
                size="sm"
                onClick={() =>
                  setColorTypeFilter(option.value as typeof colorTypeFilter)
                }
                className={cn(
                  "h-8 gap-1.5 rounded-lg px-3 text-xs font-medium transition-all",
                  colorTypeFilter === option.value
                    ? "bg-slate-900 text-white shadow-md dark:bg-white dark:text-slate-900"
                    : "border-slate-200/50 bg-white text-slate-600 hover:bg-slate-50 dark:border-slate-700/50 dark:bg-slate-800 dark:text-slate-400 dark:hover:bg-slate-700",
                )}
              >
                {option.icon && <option.icon className="h-3 w-3" />}
                {option.label}
                {option.count !== undefined && (
                  <span className="text-[10px] opacity-70">
                    ({option.count})
                  </span>
                )}
              </Button>
            ))}
          </div>
        </div>

        {/* Theme Filter */}
        <div className="flex items-center gap-2">
          <span className="h-4 w-4" />
          <div className="flex gap-1.5">
            {[
              { value: "all", label: "All Themes" },
              {
                value: "light",
                label: "Light",
                icon: Sun,
                count: presetCounts.light,
              },
              {
                value: "dark",
                label: "Dark",
                icon: Moon,
                count: presetCounts.dark,
              },
            ].map((option) => (
              <Button
                key={option.value}
                type="button"
                variant={themeFilter === option.value ? "default" : "outline"}
                size="sm"
                onClick={() =>
                  setThemeFilter(option.value as typeof themeFilter)
                }
                className={cn(
                  "h-8 gap-1.5 rounded-lg px-3 text-xs font-medium transition-all",
                  themeFilter === option.value
                    ? "bg-slate-900 text-white shadow-md dark:bg-white dark:text-slate-900"
                    : "border-slate-200/50 bg-white text-slate-600 hover:bg-slate-50 dark:border-slate-700/50 dark:bg-slate-800 dark:text-slate-400 dark:hover:bg-slate-700",
                )}
              >
                {option.icon && <option.icon className="h-3 w-3" />}
                {option.label}
                {option.count !== undefined && (
                  <span className="text-[10px] opacity-70">
                    ({option.count})
                  </span>
                )}
              </Button>
            ))}
          </div>
        </div>
      </div>

      {/* Presets Grid */}
      <div
        ref={gridRef}
        className="grid grid-cols-[repeat(auto-fit,minmax(120px,1fr))] gap-2.5"
      >
        <TooltipProvider delayDuration={0}>
          <AnimatePresence mode="popLayout">
            {visiblePresets.map(([key, { colors, mode }], index) => {
              const isSelected = selectedPreset === key;
              const isCustom = key === "custom";
              const containsGradient = hasGradient(colors);

              return (
                <Tooltip key={key}>
                  <TooltipTrigger asChild>
                    <motion.button
                      layout
                      initial={{ opacity: 0, scale: 0.9 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.9 }}
                      transition={{ duration: 0.2, delay: index * 0.02 }}
                      type="button"
                      onClick={() => handlePresetChange(key)}
                      className={cn(
                        "group relative flex aspect-[3/2] w-full items-center justify-center overflow-hidden rounded-xl border-2 transition-all duration-200",
                        isSelected
                          ? "border-blue-500 ring-4 ring-blue-500/20 dark:border-blue-400 dark:ring-blue-400/20"
                          : "border-transparent hover:border-slate-300 hover:shadow-lg dark:hover:border-slate-600",
                        "bg-white shadow-sm dark:bg-slate-800",
                      )}
                    >
                      {isCustom ? (
                        <div className="flex h-full w-full flex-col items-center justify-center gap-1 bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-800 dark:to-slate-900">
                          <Sparkles className="h-5 w-5 text-slate-400 transition-colors group-hover:text-purple-500 dark:text-slate-500" />
                          <span className="text-[10px] font-medium text-slate-400 dark:text-slate-500">
                            Custom
                          </span>
                        </div>
                      ) : (
                        <div className="flex h-full w-full">
                          {colors.map((color, i) => (
                            <div
                              key={`${colorValueToString(color)}-${i}`}
                              className="h-full flex-1"
                              style={{
                                background: colorToCssBackground(color),
                              }}
                            />
                          ))}
                        </div>
                      )}

                      {/* Selection Indicator */}
                      {isSelected && (
                        <motion.div
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          className="absolute inset-0 flex items-center justify-center bg-black/30 backdrop-blur-[2px]"
                        >
                          <div className="flex h-7 w-7 items-center justify-center rounded-full bg-white shadow-lg dark:bg-slate-900">
                            <Check className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                          </div>
                        </motion.div>
                      )}

                      {/* Badges */}
                      {!isCustom && (
                        <div className="absolute left-1.5 top-1.5 flex gap-1">
                          {containsGradient && (
                            <div className="rounded-full bg-purple-500/90 p-1 shadow-sm">
                              <Layers className="h-2.5 w-2.5 text-white" />
                            </div>
                          )}
                        </div>
                      )}

                      {!isCustom && (
                        <div className="absolute bottom-1.5 right-1.5">
                          <div
                            className={cn(
                              "rounded-full p-1 shadow-sm",
                              mode === "light"
                                ? "bg-amber-400/90"
                                : "bg-indigo-500/90",
                            )}
                          >
                            {mode === "light" ? (
                              <Sun className="h-2.5 w-2.5 text-white" />
                            ) : (
                              <Moon className="h-2.5 w-2.5 text-white" />
                            )}
                          </div>
                        </div>
                      )}
                    </motion.button>
                  </TooltipTrigger>
                  <TooltipContent
                    side="bottom"
                    className="flex items-center gap-2 rounded-lg border-slate-200/50 bg-white/95 px-3 py-2 shadow-lg backdrop-blur-sm dark:border-slate-700/50 dark:bg-slate-900/95"
                  >
                    <span className="font-semibold capitalize text-slate-900 dark:text-white">
                      {key.replaceAll(/([A-Z])/g, " $1").trim()}
                    </span>
                    <span className="text-xs text-slate-500">
                      {mode === "light" ? "Light" : "Dark"}
                    </span>
                    {containsGradient && (
                      <span className="rounded-full bg-purple-100 px-1.5 py-0.5 text-[10px] font-medium text-purple-600 dark:bg-purple-900/50 dark:text-purple-400">
                        Gradient
                      </span>
                    )}
                  </TooltipContent>
                </Tooltip>
              );
            })}
          </AnimatePresence>
        </TooltipProvider>
      </div>

      {/* Expand Button */}
      {visiblePresets.length < filteredPresets.length && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="flex justify-center pt-2"
        >
          <Button
            variant="outline"
            size="sm"
            type="button"
            onClick={() => setIsExpanded(true)}
            className="gap-2 rounded-full border-slate-200/50 bg-white px-4 text-sm font-medium text-slate-600 shadow-sm hover:bg-slate-50 hover:shadow-md dark:border-slate-700/50 dark:bg-slate-800 dark:text-slate-400 dark:hover:bg-slate-700"
          >
            <ChevronDown className="h-4 w-4" />
            Show all {totalPresets} presets
          </Button>
        </motion.div>
      )}
    </div>
  );
}
