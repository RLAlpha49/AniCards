import { motion } from "framer-motion";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { cn, isGradient, validateColorValue } from "@/lib/utils";
import type {
  ColorValue,
  GradientDefinition,
  GradientStop,
} from "@/lib/types/card";
import React, { useState, useCallback, useMemo } from "react";
import {
  Plus,
  Minus,
  Palette,
  Layers,
  HelpCircle,
  RotateCcw,
  Move,
  CircleDot,
  Droplets,
  AlertCircle,
} from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

/**
 * A color picker item used by the color picker group.
 * Supports both solid colors and gradient values.
 * @source
 */
export interface ColorPickerItem {
  id: string;
  label: string;
  value: ColorValue;
  onChange: (newValue: ColorValue) => void;
  /** When true, disables the gradient mode toggle button */
  disableGradient?: boolean;
}

/**
 * Props for the ColorPickerGroup component.
 * @source
 */
interface ColorPickerGroupProps {
  pickers: ColorPickerItem[];
}

/**
 * Returns true when `color` is a valid 3- or 6-digit hex color with a leading '#'.
 * @param color - The color string to validate.
 * @returns Whether the string is a valid hex color.
 * @source
 */
const HEX_COLOR_REGEX = /^#([A-Fa-f0-9]{3}|[A-Fa-f0-9]{6}|[A-Fa-f0-9]{8})$/;

function isValidHex(color: string): boolean {
  return HEX_COLOR_REGEX.test(color);
}

function normalizeHexString(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const candidate = trimmed.startsWith("#") ? trimmed : `#${trimmed}`;
  const match = HEX_COLOR_REGEX.exec(candidate);
  if (!match) return null;
  let hex = match[1];
  if (hex.length === 3) {
    hex = hex
      .split("")
      .map((char) => `${char}${char}`)
      .join("");
  }
  return `#${hex.toUpperCase()}`;
}

function buildHexWithOpacity(baseColor: string, opacity: number): string {
  const clampedOpacity = Math.max(0, Math.min(1, opacity));
  const normalizedBase =
    normalizeHexString(baseColor)?.slice(0, 7) ?? "#000000";
  if (clampedOpacity === 1) {
    return normalizedBase;
  }
  const alphaHex = Math.round(clampedOpacity * 255)
    .toString(16)
    .padStart(2, "0")
    .toUpperCase();
  return `${normalizedBase}${alphaHex}`;
}

function extractOpacityFromHex(normalizedHex: string): number {
  if (normalizedHex.length !== 9) return 1;
  const alphaHex = normalizedHex.slice(7);
  const parsed = Number.parseInt(alphaHex, 16);
  if (Number.isNaN(parsed)) return 1;
  return Number.parseFloat(
    (Math.max(0, Math.min(255, parsed)) / 255).toFixed(3),
  );
}

/**
 * Parses a ColorValue to extract solid color info or gradient info.
 * @param value - The color value to parse.
 * @returns Object with mode and relevant data.
 * @source
 */
function parseColorValue(value: ColorValue): {
  isSolid: boolean;
  hex?: string;
  fullHex?: string;
  opacity?: number;
  gradient?: GradientDefinition;
} {
  if (isGradient(value)) {
    return { isSolid: false, gradient: value };
  }
  const raw = typeof value === "string" ? value : "";
  const fallback = raw.startsWith("#") ? raw : `#${raw}`;
  const normalized = normalizeHexString(raw);
  if (!normalized) {
    return {
      isSolid: true,
      hex: "#000000",
      fullHex: fallback,
      opacity: 1,
    };
  }
  const base = normalized.slice(0, 7);
  return {
    isSolid: true,
    hex: base,
    fullHex: normalized,
    opacity: extractOpacityFromHex(normalized),
  };
}

/**
 * Creates a default gradient when switching from solid to gradient mode.
 * @param baseColor - The base hex color to use for the gradient.
 * @returns A default linear gradient definition.
 * @source
 */
function createDefaultGradient(baseColor: string): GradientDefinition {
  return {
    type: "linear",
    angle: 90,
    stops: [
      { color: baseColor, offset: 0 },
      { color: adjustColor(baseColor, 30), offset: 100 },
    ],
  };
}

/**
 * Adjusts a hex color by a lightness amount.
 * @param hex - The hex color to adjust.
 * @param amount - Positive to lighten, negative to darken.
 * @returns Adjusted hex color.
 * @source
 */
function adjustColor(hex: string, amount: number): string {
  const cleanHex = hex.replace("#", "");
  const num = Number.parseInt(cleanHex, 16);
  const r = Math.min(255, Math.max(0, (num >> 16) + amount));
  const g = Math.min(255, Math.max(0, ((num >> 8) & 0x00ff) + amount));
  const b = Math.min(255, Math.max(0, (num & 0x0000ff) + amount));
  return `#${((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1)}`;
}

/**
 * Generates a CSS gradient string for preview purposes.
 * @param gradient - The gradient definition.
 * @returns CSS gradient string.
 * @source
 */
function gradientToCss(gradient: GradientDefinition): string {
  const stops = gradient.stops
    .map((stop) => {
      const opacity = stop.opacity ?? 1;
      const color = opacity < 1 ? hexToRgba(stop.color, opacity) : stop.color;
      return `${color} ${stop.offset}%`;
    })
    .join(", ");

  if (gradient.type === "linear") {
    return `linear-gradient(${gradient.angle ?? 90}deg, ${stops})`;
  } else {
    const cx = gradient.cx ?? 50;
    const cy = gradient.cy ?? 50;
    return `radial-gradient(circle at ${cx}% ${cy}%, ${stops})`;
  }
}

/**
 * Converts hex color to rgba string.
 * @param hex - Hex color string.
 * @param alpha - Alpha value (0-1).
 * @returns RGBA string.
 * @source
 */
function hexToRgba(hex: string, alpha: number): string {
  const cleanHex = hex.replace("#", "");
  const r = Number.parseInt(cleanHex.substring(0, 2), 16);
  const g = Number.parseInt(cleanHex.substring(2, 4), 16);
  const b = Number.parseInt(cleanHex.substring(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

/**
 * Component for editing gradient stops.
 * @source
 */
function GradientStopEditor({
  stops,
  onStopsChange,
}: Readonly<{
  stops: GradientStop[];
  onStopsChange: (stops: GradientStop[]) => void;
}>) {
  const handleStopChange = useCallback(
    (index: number, field: keyof GradientStop, value: string | number) => {
      const newStops = [...stops];
      newStops[index] = { ...newStops[index], [field]: value };
      onStopsChange(newStops);
    },
    [stops, onStopsChange],
  );

  const addStop = useCallback(() => {
    if (stops.length >= 5) return;
    const lastStop = stops.at(-1);
    const newOffset = Math.min(100, (lastStop?.offset ?? 50) + 25);
    onStopsChange([
      ...stops,
      { color: lastStop?.color ?? "#888888", offset: newOffset },
    ]);
  }, [stops, onStopsChange]);

  const removeStop = useCallback(
    (index: number) => {
      if (stops.length <= 2) return;
      const newStops = stops.filter((_, i) => i !== index);
      onStopsChange(newStops);
    },
    [stops, onStopsChange],
  );

  return (
    <TooltipProvider delayDuration={0}>
      <div className="space-y-3">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Droplets className="h-3.5 w-3.5 text-slate-400" />
            <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
              Color Stops
            </span>
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  className="rounded-full p-0.5 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800 dark:hover:text-slate-300"
                >
                  <HelpCircle className="h-3.5 w-3.5" />
                </button>
              </TooltipTrigger>
              <TooltipContent
                side="top"
                className="max-w-xs rounded-lg border-slate-200/50 bg-white/95 p-3 text-xs shadow-lg backdrop-blur-sm dark:border-slate-700/50 dark:bg-slate-900/95"
              >
                <p className="mb-1 font-semibold text-slate-900 dark:text-white">
                  How Gradient Stops Work
                </p>
                <p className="text-slate-600 dark:text-slate-400">
                  Each stop defines a color at a position (0-100%) along the
                  gradient. Colors blend smoothly between stops.
                </p>
              </TooltipContent>
            </Tooltip>
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={addStop}
            disabled={stops.length >= 5}
            className="h-7 gap-1.5 rounded-lg border-slate-200/50 bg-white px-2.5 text-xs font-medium text-slate-600 shadow-sm transition-all hover:bg-slate-50 hover:shadow-md disabled:opacity-50 dark:border-slate-700/50 dark:bg-slate-800 dark:text-slate-400 dark:hover:bg-slate-700"
          >
            <Plus className="h-3 w-3" /> Add Stop
          </Button>
        </div>

        {/* Stops List */}
        <div className="space-y-2">
          {stops.map((stop, index) => (
            <motion.div
              key={`gradient-stop-${index}`}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.2 }}
              className="group flex items-center gap-3 rounded-xl border border-slate-200/50 bg-white/80 p-2.5 shadow-sm transition-all hover:border-slate-300 hover:shadow-md dark:border-slate-700/50 dark:bg-slate-800/80 dark:hover:border-slate-600"
            >
              {/* Color Picker */}
              <div className="relative h-9 w-9 shrink-0 overflow-hidden rounded-lg border-2 border-slate-200 shadow-inner transition-all group-hover:border-slate-300 dark:border-slate-700 dark:group-hover:border-slate-600">
                <Input
                  type="color"
                  value={isValidHex(stop.color) ? stop.color : "#000000"}
                  onChange={(e) =>
                    handleStopChange(index, "color", e.target.value)
                  }
                  className="absolute -left-1/2 -top-1/2 h-[200%] w-[200%] cursor-pointer border-0 p-0"
                />
              </div>

              {/* Position Input */}
              <div className="flex items-center gap-1.5">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Input
                      type="text"
                      inputMode="numeric"
                      pattern="[0-9]*"
                      value={stop.offset}
                      onChange={(e) => {
                        const val = e.target.value;
                        if (val === "") {
                          handleStopChange(index, "offset", 0);
                          return;
                        }
                        const parsed = Number.parseInt(val, 10);
                        if (!Number.isNaN(parsed)) {
                          handleStopChange(
                            index,
                            "offset",
                            Math.min(100, Math.max(0, parsed)),
                          );
                        }
                      }}
                      className="h-8 w-14 rounded-lg border-slate-200/50 bg-slate-50 text-center text-sm font-medium dark:border-slate-700/50 dark:bg-slate-900"
                      aria-label={`Stop ${index + 1} position`}
                    />
                  </TooltipTrigger>
                  <TooltipContent side="top" className="rounded-lg text-xs">
                    Position (0% = start, 100% = end)
                  </TooltipContent>
                </Tooltip>
                <span className="text-xs font-medium text-slate-400">%</span>
              </div>

              {/* Opacity Slider */}
              <div className="flex flex-1 items-center gap-2">
                <Input
                  type="range"
                  min={0}
                  max={100}
                  value={(stop.opacity ?? 1) * 100}
                  onChange={(e) =>
                    handleStopChange(
                      index,
                      "opacity",
                      Number.parseInt(e.target.value) / 100,
                    )
                  }
                  className="h-1.5 flex-1 cursor-pointer appearance-none rounded-full bg-gradient-to-r from-slate-200 to-slate-300 px-0 dark:from-slate-700 dark:to-slate-600 [&::-moz-range-thumb]:h-3.5 [&::-moz-range-thumb]:w-3.5 [&::-moz-range-thumb]:cursor-pointer [&::-moz-range-thumb]:appearance-none [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:border-2 [&::-moz-range-thumb]:border-white [&::-moz-range-thumb]:bg-blue-500 [&::-moz-range-thumb]:shadow-md [&::-webkit-slider-thumb]:h-3.5 [&::-webkit-slider-thumb]:w-3.5 [&::-webkit-slider-thumb]:cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-white [&::-webkit-slider-thumb]:bg-blue-500 [&::-webkit-slider-thumb]:shadow-md"
                  aria-label={`Stop ${index + 1} opacity`}
                />
                <span className="w-10 rounded-md bg-slate-100 px-1.5 py-0.5 text-center text-xs font-medium text-slate-600 dark:bg-slate-800 dark:text-slate-400">
                  {Math.round((stop.opacity ?? 1) * 100)}%
                </span>
              </div>

              {/* Remove Button */}
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => removeStop(index)}
                disabled={stops.length <= 2}
                className="h-7 w-7 rounded-lg p-0 text-slate-400 opacity-0 transition-all hover:bg-red-50 hover:text-red-500 disabled:opacity-0 group-hover:opacity-100 dark:hover:bg-red-900/20 dark:hover:text-red-400"
              >
                <Minus className="h-3.5 w-3.5" />
              </Button>
            </motion.div>
          ))}
        </div>
      </div>
    </TooltipProvider>
  );
}

/**
 * Component for gradient type and positioning controls.
 * @source
 */
function GradientControls({
  gradient,
  onGradientChange,
}: Readonly<{
  gradient: GradientDefinition;
  onGradientChange: (gradient: GradientDefinition) => void;
}>) {
  const handleTypeChange = useCallback(
    (type: "linear" | "radial") => {
      onGradientChange({ ...gradient, type });
    },
    [gradient, onGradientChange],
  );

  const handleAngleChange = useCallback(
    (angle: number) => {
      onGradientChange({ ...gradient, angle });
    },
    [gradient, onGradientChange],
  );

  const handleRadialChange = useCallback(
    (field: "cx" | "cy" | "r", value: number) => {
      onGradientChange({ ...gradient, [field]: value });
    },
    [gradient, onGradientChange],
  );

  // Quick angle presets
  const anglePresets = [0, 45, 90, 135, 180, 270];

  return (
    <div className="space-y-4">
      {/* Type Selection */}
      <div className="flex gap-2">
        <Button
          type="button"
          variant={gradient.type === "linear" ? "default" : "outline"}
          size="sm"
          onClick={() => handleTypeChange("linear")}
          className={cn(
            "flex-1 gap-2 rounded-lg text-sm font-medium transition-all",
            gradient.type === "linear"
              ? "bg-slate-900 text-white shadow-md dark:bg-white dark:text-slate-900"
              : "border-slate-200/50 bg-white text-slate-600 hover:bg-slate-50 dark:border-slate-700/50 dark:bg-slate-800 dark:text-slate-400 dark:hover:bg-slate-700",
          )}
        >
          <RotateCcw className="h-3.5 w-3.5" />
          Linear
        </Button>
        <Button
          type="button"
          variant={gradient.type === "radial" ? "default" : "outline"}
          size="sm"
          onClick={() => handleTypeChange("radial")}
          className={cn(
            "flex-1 gap-2 rounded-lg text-sm font-medium transition-all",
            gradient.type === "radial"
              ? "bg-slate-900 text-white shadow-md dark:bg-white dark:text-slate-900"
              : "border-slate-200/50 bg-white text-slate-600 hover:bg-slate-50 dark:border-slate-700/50 dark:bg-slate-800 dark:text-slate-400 dark:hover:bg-slate-700",
          )}
        >
          <CircleDot className="h-3.5 w-3.5" />
          Radial
        </Button>
      </div>

      {gradient.type === "linear" ? (
        <div className="space-y-3">
          {/* Angle Slider */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <RotateCcw className="h-3.5 w-3.5 text-slate-400" />
                <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
                  Angle
                </span>
              </div>
              <span className="rounded-md bg-slate-100 px-2 py-0.5 text-sm font-bold text-slate-700 dark:bg-slate-800 dark:text-slate-300">
                {gradient.angle ?? 90}°
              </span>
            </div>
            <Input
              type="range"
              min={0}
              max={360}
              value={gradient.angle ?? 90}
              onChange={(e) =>
                handleAngleChange(Number.parseInt(e.target.value))
              }
              className="h-2 w-full cursor-pointer appearance-none rounded-full bg-gradient-to-r from-slate-200 via-blue-200 to-slate-200 px-0 dark:from-slate-700 dark:via-blue-800 dark:to-slate-700 [&::-moz-range-thumb]:h-4 [&::-moz-range-thumb]:w-4 [&::-moz-range-thumb]:cursor-pointer [&::-moz-range-thumb]:appearance-none [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:border-2 [&::-moz-range-thumb]:border-white [&::-moz-range-thumb]:bg-blue-500 [&::-moz-range-thumb]:shadow-lg [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-white [&::-webkit-slider-thumb]:bg-blue-500 [&::-webkit-slider-thumb]:shadow-lg"
            />
          </div>

          {/* Quick Presets */}
          <div className="flex flex-wrap gap-1.5">
            {anglePresets.map((angle) => (
              <Button
                key={angle}
                type="button"
                variant="outline"
                size="sm"
                onClick={() => handleAngleChange(angle)}
                className={cn(
                  "h-7 min-w-[3rem] rounded-lg px-2 text-xs font-medium transition-all",
                  (gradient.angle ?? 90) === angle
                    ? "border-blue-300 bg-blue-50 text-blue-700 dark:border-blue-700 dark:bg-blue-900/30 dark:text-blue-400"
                    : "border-slate-200/50 bg-white text-slate-500 hover:bg-slate-50 dark:border-slate-700/50 dark:bg-slate-800 dark:text-slate-400 dark:hover:bg-slate-700",
                )}
              >
                {angle}°
              </Button>
            ))}
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <Move className="h-3.5 w-3.5 text-slate-400" />
            <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
              Center Position
            </span>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-slate-500 dark:text-slate-400">
                X Position
              </Label>
              <Input
                type="number"
                min={0}
                max={100}
                value={gradient.cx ?? 50}
                onChange={(e) =>
                  handleRadialChange(
                    "cx",
                    Number.parseInt(e.target.value) || 50,
                  )
                }
                className="h-9 rounded-lg border-slate-200/50 bg-slate-50 text-sm font-medium dark:border-slate-700/50 dark:bg-slate-900"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-slate-500 dark:text-slate-400">
                Y Position
              </Label>
              <Input
                type="number"
                min={0}
                max={100}
                value={gradient.cy ?? 50}
                onChange={(e) =>
                  handleRadialChange(
                    "cy",
                    Number.parseInt(e.target.value) || 50,
                  )
                }
                className="h-9 rounded-lg border-slate-200/50 bg-slate-50 text-sm font-medium dark:border-slate-700/50 dark:bg-slate-900"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-slate-500 dark:text-slate-400">
                Radius
              </Label>
              <Input
                type="number"
                min={0}
                max={100}
                value={gradient.r ?? 50}
                onChange={(e) =>
                  handleRadialChange("r", Number.parseInt(e.target.value) || 50)
                }
                className="h-9 rounded-lg border-slate-200/50 bg-slate-50 text-sm font-medium dark:border-slate-700/50 dark:bg-slate-900"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * Single color picker that supports both solid and gradient modes.
 * @source
 */
function SingleColorPicker({ picker }: Readonly<{ picker: ColorPickerItem }>) {
  const parsed = useMemo(() => parseColorValue(picker.value), [picker.value]);
  const solidOpacity = parsed.opacity ?? 1;

  // Derive mode from the current value - sync with external changes (e.g., from preset selection)
  const derivedMode = parsed.isSolid ? "solid" : "gradient";
  const [mode, setMode] = useState<"solid" | "gradient">(derivedMode);

  // Sync internal mode state when external value changes (e.g., preset with gradients selected)
  React.useEffect(() => {
    setMode(derivedMode);
  }, [derivedMode]);

  const handleModeToggle = useCallback(() => {
    if (mode === "solid") {
      // Switch to gradient mode
      const baseHex = parsed.hex || "#888888";
      picker.onChange(createDefaultGradient(baseHex));
      setMode("gradient");
    } else {
      // Switch to solid mode - use first stop color
      const firstColor = parsed.gradient?.stops[0]?.color || "#888888";
      picker.onChange(firstColor);
      setMode("solid");
    }
  }, [mode, parsed, picker]);

  const handleSolidChange = useCallback(
    (hex: string) => {
      const normalized = normalizeHexString(hex) ?? "#000000";
      const base = normalized.slice(0, 7);
      const nextValue = buildHexWithOpacity(base, solidOpacity);
      picker.onChange(nextValue);
    },
    [picker, solidOpacity],
  );

  const handleHexInputChange = useCallback(
    (value: string) => {
      const candidate = value.startsWith("#") ? value : `#${value}`;
      const normalized = normalizeHexString(candidate);
      if (!normalized) {
        picker.onChange(candidate);
        return;
      }
      if (normalized.length === 7) {
        picker.onChange(buildHexWithOpacity(normalized, solidOpacity));
        return;
      }
      picker.onChange(normalized);
    },
    [picker, solidOpacity],
  );

  const handleOpacityChange = useCallback(
    (percent: number) => {
      const base = parsed.hex ?? "#000000";
      picker.onChange(buildHexWithOpacity(base, percent / 100));
    },
    [picker, parsed.hex],
  );

  const handleGradientChange = useCallback(
    (gradient: GradientDefinition) => {
      picker.onChange(gradient);
    },
    [picker],
  );

  const handleStopsChange = useCallback(
    (stops: GradientStop[]) => {
      if (parsed.gradient) {
        picker.onChange({ ...parsed.gradient, stops });
      }
    },
    [parsed.gradient, picker],
  );

  const valid = useMemo(() => {
    return validateColorValue(picker.value);
  }, [picker.value]);

  const solidBaseHex = parsed.hex || "#000000";
  const solidDisplayHex = (parsed.fullHex ?? "#000000").replace("#", "");
  const gradient = parsed.gradient;
  const solidOpacityPercent = Math.round((parsed.opacity ?? 1) * 100);

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
      className="space-y-3"
    >
      {/* Header */}
      <div className="flex items-center justify-between">
        <Label
          htmlFor={picker.id}
          className="text-sm font-semibold text-slate-800 dark:text-slate-200"
        >
          {picker.label}
        </Label>
        {!picker.disableGradient && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleModeToggle}
            className={cn(
              "h-7 gap-1.5 rounded-lg px-2.5 text-xs font-medium transition-all",
              mode === "gradient"
                ? "border-purple-300 bg-purple-50 text-purple-700 hover:bg-purple-100 dark:border-purple-800 dark:bg-purple-900/30 dark:text-purple-400 dark:hover:bg-purple-900/50"
                : "border-slate-200/50 bg-white text-slate-600 hover:bg-slate-50 dark:border-slate-700/50 dark:bg-slate-800 dark:text-slate-400 dark:hover:bg-slate-700",
            )}
            title={mode === "solid" ? "Switch to gradient" : "Switch to solid"}
          >
            {mode === "solid" ? (
              <>
                <Layers className="h-3 w-3" /> Gradient
              </>
            ) : (
              <>
                <Palette className="h-3 w-3" /> Solid
              </>
            )}
          </Button>
        )}
      </div>

      {mode === "solid" ? (
        <div className="group relative flex items-start gap-3 rounded-xl border border-slate-200/50 bg-white/80 p-3 shadow-sm transition-all hover:border-slate-300 hover:shadow-md dark:border-slate-700/50 dark:bg-slate-800/80 dark:hover:border-slate-600">
          {/* Color Swatch */}
          <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-xl border-2 border-slate-200 shadow-lg transition-all group-hover:border-slate-300 dark:border-slate-700 dark:group-hover:border-slate-600">
            <Input
              id={picker.id}
              type="color"
              value={isValidHex(solidBaseHex) ? solidBaseHex : "#000000"}
              onChange={(e) => handleSolidChange(e.target.value)}
              className="absolute -left-1/2 -top-1/2 h-[200%] w-[200%] cursor-pointer border-0 p-0"
              aria-label={`${picker.label} color picker`}
            />
          </div>

          {/* Controls */}
          <div className="flex flex-1 flex-col gap-3">
            {/* Hex Input */}
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm font-bold text-slate-400">
                #
              </span>
              <Input
                type="text"
                value={solidDisplayHex}
                onChange={(e) => handleHexInputChange(e.target.value)}
                className={cn(
                  "h-10 rounded-lg pl-7 font-mono text-sm font-medium uppercase transition-all",
                  valid
                    ? "border-slate-200/50 bg-slate-50 focus-visible:ring-blue-500 dark:border-slate-700/50 dark:bg-slate-900"
                    : "border-red-300 bg-red-50 focus-visible:ring-red-500 dark:border-red-800 dark:bg-red-900/20",
                )}
                maxLength={8}
                aria-label={`${picker.label} color hex code input`}
                placeholder="000000"
              />
            </div>

            {/* Opacity Slider */}
            <div className="flex items-center gap-3">
              <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
                Opacity
              </span>
              <Input
                type="range"
                min={0}
                max={100}
                value={solidOpacityPercent}
                onChange={(e) =>
                  handleOpacityChange(Number.parseInt(e.target.value) || 0)
                }
                className="h-1.5 flex-1 cursor-pointer appearance-none rounded-full bg-gradient-to-r from-slate-200 to-slate-300 px-0 dark:from-slate-700 dark:to-slate-600 [&::-moz-range-thumb]:h-3.5 [&::-moz-range-thumb]:w-3.5 [&::-moz-range-thumb]:cursor-pointer [&::-moz-range-thumb]:appearance-none [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:border-2 [&::-moz-range-thumb]:border-white [&::-moz-range-thumb]:bg-blue-500 [&::-moz-range-thumb]:shadow-md [&::-webkit-slider-thumb]:h-3.5 [&::-webkit-slider-thumb]:w-3.5 [&::-webkit-slider-thumb]:cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-white [&::-webkit-slider-thumb]:bg-blue-500 [&::-webkit-slider-thumb]:shadow-md"
                aria-label={`${picker.label} opacity slider`}
              />
              <span className="w-12 rounded-md bg-slate-100 px-1.5 py-0.5 text-center text-xs font-medium text-slate-600 dark:bg-slate-800 dark:text-slate-400">
                {solidOpacityPercent}%
              </span>
            </div>
          </div>
        </div>
      ) : (
        <div className="space-y-4 rounded-xl border border-purple-200/50 bg-gradient-to-br from-purple-50/50 to-white p-4 shadow-sm dark:border-purple-900/50 dark:from-purple-950/20 dark:to-slate-900">
          {/* Gradient Preview */}
          <div
            className="h-12 w-full overflow-hidden rounded-lg border border-slate-200/50 shadow-inner dark:border-slate-700/50"
            style={{
              background: gradient ? gradientToCss(gradient) : "#888888",
            }}
          />

          {gradient && (
            <>
              <GradientControls
                gradient={gradient}
                onGradientChange={handleGradientChange}
              />
              <GradientStopEditor
                stops={gradient.stops}
                onStopsChange={handleStopsChange}
              />
            </>
          )}
        </div>
      )}

      {/* Validation Error */}
      {!valid && (
        <motion.div
          initial={{ opacity: 0, y: -5 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center gap-2 rounded-lg bg-red-50 px-3 py-2 text-xs font-medium text-red-600 dark:bg-red-900/20 dark:text-red-400"
        >
          <AlertCircle className="h-3.5 w-3.5" />
          Invalid color value
        </motion.div>
      )}
    </motion.div>
  );
}

/**
 * Renders a responsive group of color inputs and their labels.
 * Each item shows a color swatch and a text input for the hex value,
 * with support for switching to gradient mode.
 * @param pickers - Readonly array of color items to render.
 * @returns The color picker group element.
 * @source
 */
export function ColorPickerGroup({ pickers }: Readonly<ColorPickerGroupProps>) {
  return (
    <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
      {pickers.map((picker) => (
        <SingleColorPicker key={picker.id} picker={picker} />
      ))}
    </div>
  );
}
