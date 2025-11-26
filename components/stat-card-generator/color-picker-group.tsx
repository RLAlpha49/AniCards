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
import { Plus, Minus, Palette, Layers, HelpCircle } from "lucide-react";
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
    if (stops.length >= 5) return; // Limit to 5 stops
    const lastStop = stops.at(-1);
    const newOffset = Math.min(100, (lastStop?.offset ?? 50) + 25);
    onStopsChange([
      ...stops,
      { color: lastStop?.color ?? "#888888", offset: newOffset },
    ]);
  }, [stops, onStopsChange]);

  const removeStop = useCallback(
    (index: number) => {
      if (stops.length <= 2) return; // Minimum 2 stops
      const newStops = stops.filter((_, i) => i !== index);
      onStopsChange(newStops);
    },
    [stops, onStopsChange],
  );

  return (
    <TooltipProvider delayDuration={0}>
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1">
            <span className="text-xs font-medium text-gray-500 dark:text-gray-400">
              Gradient Stops
            </span>
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                >
                  <HelpCircle className="h-3 w-3" />
                </button>
              </TooltipTrigger>
              <TooltipContent side="top" className="max-w-xs text-xs">
                <p className="mb-1 font-semibold">How Gradient Stops Work</p>
                <p>
                  Each stop defines a color at a position (0-100%) along the
                  gradient. Colors blend smoothly between stops.
                </p>
              </TooltipContent>
            </Tooltip>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={addStop}
            disabled={stops.length >= 5}
            className="h-6 px-2 text-xs"
          >
            <Plus className="mr-1 h-3 w-3" /> Add
          </Button>
        </div>
        {/* Column headers */}
        <div className="flex items-center gap-2 text-[10px] text-gray-400 dark:text-gray-500">
          <span className="w-8">Color</span>
          <span className="w-16">Position</span>
          <span className="w-4" />
          <span className="flex-1 text-center">Opacity</span>
          <span className="w-8" />
          <span className="w-6" />
        </div>
        <div className="space-y-2">
          {stops.map((stop, index) => (
            <div
              key={`gradient-stop-${stop.color}-${stop.offset}-${index}`}
              className="flex items-center gap-2"
            >
              <div className="relative h-8 w-8 shrink-0 overflow-hidden rounded border border-gray-200 dark:border-gray-700">
                <Input
                  type="color"
                  value={isValidHex(stop.color) ? stop.color : "#000000"}
                  onChange={(e) =>
                    handleStopChange(index, "color", e.target.value)
                  }
                  className="absolute -left-1/2 -top-1/2 h-[200%] w-[200%] cursor-pointer border-0 p-0"
                />
              </div>
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
                    className="h-8 w-16 text-xs"
                    aria-label={`Stop ${index + 1} position`}
                  />
                </TooltipTrigger>
                <TooltipContent side="top" className="text-xs">
                  Position along gradient (0% = start, 100% = end)
                </TooltipContent>
              </Tooltip>
              <span className="text-xs text-gray-400">%</span>
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
                className="h-2 flex-1 cursor-pointer appearance-none rounded-full bg-gray-200 px-0 dark:bg-gray-700 [&::-moz-range-thumb]:h-3 [&::-moz-range-thumb]:w-3 [&::-moz-range-thumb]:cursor-pointer [&::-moz-range-thumb]:appearance-none [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:border-0 [&::-moz-range-thumb]:bg-blue-500 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-blue-500"
                aria-label={`Stop ${index + 1} opacity`}
              />
              <span className="w-8 text-xs text-gray-400">
                {Math.round((stop.opacity ?? 1) * 100)}%
              </span>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => removeStop(index)}
                disabled={stops.length <= 2}
                className="h-6 w-6 p-0"
              >
                <Minus className="h-3 w-3" />
              </Button>
            </div>
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

  return (
    <div className="space-y-3">
      <div className="flex gap-2">
        <Button
          type="button"
          variant={gradient.type === "linear" ? "default" : "outline"}
          size="sm"
          onClick={() => handleTypeChange("linear")}
          className="flex-1 text-xs"
        >
          Linear
        </Button>
        <Button
          type="button"
          variant={gradient.type === "radial" ? "default" : "outline"}
          size="sm"
          onClick={() => handleTypeChange("radial")}
          className="flex-1 text-xs"
        >
          Radial
        </Button>
      </div>

      {gradient.type === "linear" ? (
        <div className="space-y-1">
          <div className="flex items-center justify-between">
            <span className="text-xs text-gray-500 dark:text-gray-400">
              Angle
            </span>
            <span className="text-xs text-gray-400">
              {gradient.angle ?? 90}°
            </span>
          </div>
          <Input
            type="range"
            min={0}
            max={360}
            value={gradient.angle ?? 90}
            onChange={(e) => handleAngleChange(Number.parseInt(e.target.value))}
            className="h-2 w-full cursor-pointer appearance-none rounded-full bg-gray-200 px-0 dark:bg-gray-700 [&::-moz-range-thumb]:h-3 [&::-moz-range-thumb]:w-3 [&::-moz-range-thumb]:cursor-pointer [&::-moz-range-thumb]:appearance-none [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:border-0 [&::-moz-range-thumb]:bg-blue-500 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-blue-500"
          />
        </div>
      ) : (
        <div className="grid grid-cols-3 gap-2">
          <div className="space-y-1">
            <span className="text-xs text-gray-500 dark:text-gray-400">
              Center X
            </span>
            <Input
              type="number"
              min={0}
              max={100}
              value={gradient.cx ?? 50}
              onChange={(e) =>
                handleRadialChange("cx", Number.parseInt(e.target.value) || 50)
              }
              className="h-8 text-xs"
            />
          </div>
          <div className="space-y-1">
            <span className="text-xs text-gray-500 dark:text-gray-400">
              Center Y
            </span>
            <Input
              type="number"
              min={0}
              max={100}
              value={gradient.cy ?? 50}
              onChange={(e) =>
                handleRadialChange("cy", Number.parseInt(e.target.value) || 50)
              }
              className="h-8 text-xs"
            />
          </div>
          <div className="space-y-1">
            <span className="text-xs text-gray-500 dark:text-gray-400">
              Radius
            </span>
            <Input
              type="number"
              min={0}
              max={100}
              value={gradient.r ?? 50}
              onChange={(e) =>
                handleRadialChange("r", Number.parseInt(e.target.value) || 50)
              }
              className="h-8 text-xs"
            />
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
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <Label
          htmlFor={picker.id}
          className="text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400"
        >
          {picker.label}
        </Label>
        {!picker.disableGradient && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={handleModeToggle}
            className="h-6 gap-1 px-2 text-xs"
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
        <div className="group relative flex flex-wrap gap-2">
          <div className="relative h-10 w-10 shrink-0 overflow-hidden rounded-lg border border-gray-200 shadow-sm transition-all group-hover:scale-105 dark:border-gray-700">
            <Input
              id={picker.id}
              type="color"
              value={isValidHex(solidBaseHex) ? solidBaseHex : "#000000"}
              onChange={(e) => handleSolidChange(e.target.value)}
              className="absolute -left-1/2 -top-1/2 h-[200%] w-[200%] cursor-pointer border-0 p-0"
              aria-label={`${picker.label} color picker`}
            />
          </div>
          <div className="flex flex-1 flex-col gap-2">
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-medium text-gray-400">
                #
              </span>
              <Input
                type="text"
                value={solidDisplayHex}
                onChange={(e) => handleHexInputChange(e.target.value)}
                className={cn(
                  "min-w-0 pl-7 font-mono text-sm uppercase transition-all",
                  valid
                    ? "border-gray-200 focus-visible:ring-blue-500 dark:border-gray-700"
                    : "border-red-500 focus-visible:ring-red-500",
                )}
                maxLength={8}
                aria-label={`${picker.label} color hex code input`}
                placeholder="000000"
              />
            </div>
            <div className="flex items-center gap-2 text-xs text-gray-500">
              <span>Opacity</span>
              <Input
                type="range"
                min={0}
                max={100}
                value={solidOpacityPercent}
                onChange={(e) =>
                  handleOpacityChange(Number.parseInt(e.target.value) || 0)
                }
                className="h-2 flex-1 cursor-pointer appearance-none rounded-full bg-gray-200 px-0 dark:bg-gray-700 [&::-moz-range-thumb]:h-3 [&::-moz-range-thumb]:w-3 [&::-moz-range-thumb]:cursor-pointer [&::-moz-range-thumb]:appearance-none [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:border-0 [&::-moz-range-thumb]:bg-blue-500 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-blue-500"
                aria-label={`${picker.label} opacity slider`}
              />
              <span className="w-12 text-right text-xs text-gray-400">
                {solidOpacityPercent}%
              </span>
            </div>
          </div>
        </div>
      ) : (
        <div className="space-y-3 rounded-lg border border-gray-200 bg-gray-50/50 p-3 dark:border-gray-700 dark:bg-gray-900/50">
          {/* Gradient preview */}
          <div
            className="h-8 w-full rounded-md border border-gray-200 dark:border-gray-700"
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

      {!valid && (
        <p className="text-[10px] text-red-500 animate-in slide-in-from-top-1">
          Invalid color value
        </p>
      )}
    </div>
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
    <div className="grid grid-cols-[repeat(auto-fit,minmax(220px,1fr))] gap-4">
      {pickers.map((picker) => (
        <SingleColorPicker key={picker.id} picker={picker} />
      ))}
    </div>
  );
}
