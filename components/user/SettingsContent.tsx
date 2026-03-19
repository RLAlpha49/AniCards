"use client";

import { AnimatePresence, motion } from "framer-motion";
import {
  Grid,
  Heart,
  Palette,
  PieChart,
  RotateCcw,
  Sliders,
  Square,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

import {
  ColorPickerGroup,
  type ColorPickerItem,
} from "@/components/stat-card-generator/ColorPickerGroup";
import { ColorPresetSelector } from "@/components/stat-card-generator/ColorPresetSelector";
import { colorPresets } from "@/components/stat-card-generator/constants";
import { Button } from "@/components/ui/Button";
import { Label } from "@/components/ui/Label";
import { Switch } from "@/components/ui/Switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/Tabs";
import { ColorPreviewCard } from "@/components/user/ColorPreviewCard";
import type { ColorValue } from "@/lib/types/card";
import {
  cn,
  isCssNamedColor,
  normalizeColorInput,
  validateColorValue,
} from "@/lib/utils";

import { Input } from "../ui/Input";
const hexOrNoHashRegex = /^(?:#)?(?:[0-9A-F]{3}|[0-9A-F]{6}|[0-9A-F]{8})$/i;

const GRID_MIN = 1;
const GRID_MAX = 5;

let cachedCanvas: HTMLCanvasElement | null = null;

function tryParseColorWithCanvas(trimmed: string) {
  if (typeof document === "undefined") return undefined;
  cachedCanvas ??= document.createElement("canvas");
  const ctx = cachedCanvas.getContext("2d");
  if (!ctx) return undefined;
  try {
    ctx.fillStyle = trimmed;
  } catch {
    return undefined;
  }
  const result = ctx.fillStyle;
  if (typeof result === "string" && /^#([0-9a-f]{6})$/i.test(result)) {
    return result.toLowerCase();
  }
  return undefined;
}

function parseGridSizeInput(
  value: string,
): { ok: true; value: number } | { ok: false } {
  const trimmed = value.trim();
  if (!trimmed) return { ok: false };
  const n = Number(trimmed);
  if (!Number.isFinite(n) || !Number.isInteger(n)) return { ok: false };
  if (n < GRID_MIN || n > GRID_MAX) return { ok: false };
  return { ok: true, value: n };
}

function isLikelyValidBorderColorInput(args: {
  borderEnabled: boolean;
  value?: string;
}): boolean {
  if (!args.borderEnabled) return true;
  if (!args.value) return false;

  const trimmed = args.value.trim();
  if (hexOrNoHashRegex.test(trimmed)) return true;
  if (isCssNamedColor(trimmed)) return true;
  return false;
}

function useBorderColorInput(args: {
  idPrefix: string;
  borderEnabled: boolean;
  borderColor: string;
  onBorderColorChange: (color: string) => void;
}) {
  const [inputBorderColor, setInputBorderColor] = useState<string>(
    args.borderColor ?? "",
  );
  const [isBorderColorValid, setIsBorderColorValid] = useState<boolean>(true);

  const borderColorAriaDescribedBy = isBorderColorValid
    ? undefined
    : `${args.idPrefix}-borderColor-error`;

  useEffect(() => {
    setInputBorderColor(args.borderColor ?? "");
    setIsBorderColorValid(
      isLikelyValidBorderColorInput({
        borderEnabled: args.borderEnabled,
        value: args.borderColor,
      }),
    );
  }, [args.borderColor, args.borderEnabled]);

  const handleColorPickerChange = (value: string) => {
    const normalized = value.toLowerCase();
    const prev = (inputBorderColor ?? "").trim();
    const prevHex8 = /^#([0-9A-F]{8})$/i.exec(prev);
    const newColor =
      prevHex8 && /^#([0-9a-f]{6})$/i.test(normalized)
        ? normalized + prevHex8[1].slice(6).toLowerCase()
        : normalized;

    setInputBorderColor(newColor);
    setIsBorderColorValid(true);
    args.onBorderColorChange(newColor);
  };

  const handleBorderColorTextChange = (value: string) => {
    setInputBorderColor(value);
    setIsBorderColorValid(
      isLikelyValidBorderColorInput({
        borderEnabled: args.borderEnabled,
        value,
      }),
    );
  };

  const handleBorderColorBlur = () => {
    const v = inputBorderColor.trim();
    if (!v) {
      setInputBorderColor(args.borderColor ?? "");
      setIsBorderColorValid(
        isLikelyValidBorderColorInput({
          borderEnabled: args.borderEnabled,
          value: args.borderColor,
        }),
      );
      return;
    }

    if (
      !isLikelyValidBorderColorInput({
        borderEnabled: args.borderEnabled,
        value: v,
      })
    ) {
      setIsBorderColorValid(false);
      return;
    }

    const normalized = normalizeColorInput(v);

    if (normalized !== args.borderColor) {
      args.onBorderColorChange(normalized);
    }
    setInputBorderColor(normalized);
    setIsBorderColorValid(true);
  };

  return {
    inputBorderColor,
    isBorderColorValid,
    borderColorAriaDescribedBy,
    handleColorPickerChange,
    handleBorderColorTextChange,
    handleBorderColorBlur,
  };
}

function useGridSizeInputs(args: {
  idPrefix: string;
  enabled: boolean;
  cols: number;
  rows: number;
  onColsChange: (value: number) => void;
  onRowsChange: (value: number) => void;
}) {
  const [inputGridCols, setInputGridCols] = useState<string>(() =>
    String(args.cols),
  );
  const [inputGridRows, setInputGridRows] = useState<string>(() =>
    String(args.rows),
  );
  const [isGridColsValid, setIsGridColsValid] = useState(true);
  const [isGridRowsValid, setIsGridRowsValid] = useState(true);

  useEffect(() => {
    setInputGridCols(String(args.cols));
    setInputGridRows(String(args.rows));
    setIsGridColsValid(true);
    setIsGridRowsValid(true);
  }, [args.cols, args.rows]);

  const gridColsAriaDescribedBy =
    args.enabled && !isGridColsValid
      ? `${args.idPrefix}-gridCols-error`
      : undefined;
  const gridRowsAriaDescribedBy =
    args.enabled && !isGridRowsValid
      ? `${args.idPrefix}-gridRows-error`
      : undefined;

  const handleGridColsChange = (value: string) => {
    setInputGridCols(value);
    if (!args.enabled) return;

    const parsed = parseGridSizeInput(value);
    setIsGridColsValid(parsed.ok);
    if (parsed.ok) {
      args.onColsChange(parsed.value);
    }
  };

  const handleGridRowsChange = (value: string) => {
    setInputGridRows(value);
    if (!args.enabled) return;

    const parsed = parseGridSizeInput(value);
    setIsGridRowsValid(parsed.ok);
    if (parsed.ok) {
      args.onRowsChange(parsed.value);
    }
  };

  const handleGridColsBlur = () => {
    if (!args.enabled) return;
    const parsed = parseGridSizeInput(inputGridCols);
    if (!parsed.ok) {
      setInputGridCols(String(args.cols));
      setIsGridColsValid(true);
    }
  };

  const handleGridRowsBlur = () => {
    if (!args.enabled) return;
    const parsed = parseGridSizeInput(inputGridRows);
    if (!parsed.ok) {
      setInputGridRows(String(args.rows));
      setIsGridRowsValid(true);
    }
  };

  const isGridValid = args.enabled ? isGridColsValid && isGridRowsValid : true;

  return {
    inputGridCols,
    inputGridRows,
    isGridColsValid,
    isGridRowsValid,
    gridColsAriaDescribedBy,
    gridRowsAriaDescribedBy,
    handleGridColsChange,
    handleGridRowsChange,
    handleGridColsBlur,
    handleGridRowsBlur,
    isGridValid,
  };
}

/**
 * Converts various color input formats to a 6-digit hex color suitable for <input type="color">.
 * Returns undefined if the input cannot be normalized.
 */
function getColorPickerHex(val?: string) {
  if (!val) return undefined;
  const trimmed = val.trim();
  const m3 = /^#([0-9A-F]{3})$/i.exec(trimmed);
  if (m3) {
    return (
      "#" +
      m3[1]
        .split("")
        .map((c) => c + c)
        .join("")
        .toLowerCase()
    );
  }
  if (/^#([0-9A-F]{6})$/i.test(trimmed)) {
    return trimmed.toLowerCase();
  }
  const m8 = /^#([0-9A-F]{8})$/i.exec(trimmed);
  if (m8) {
    return ("#" + m8[1].slice(0, 6)).toLowerCase();
  }
  const mn = /^([0-9A-F]{3}|[0-9A-F]{6}|[0-9A-F]{8})$/i.exec(trimmed);
  if (mn) {
    const s = mn[1];
    if (s.length === 3) {
      return (
        "#" +
        s
          .split("")
          .map((c) => c + c)
          .join("")
          .toLowerCase()
      );
    }
    return ("#" + s.slice(0, 6)).toLowerCase();
  }

  const canvasResult = tryParseColorWithCanvas(trimmed);
  if (canvasResult) return canvasResult;

  return undefined;
}

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

  /** Array of 4 colors: [title, background, text, circle/accent] */
  colors: [ColorValue, ColorValue, ColorValue, ColorValue];
  /** Currently selected color preset ID */
  colorPreset: string;
  /** Handler when color at index changes */
  onColorChange: (index: number, value: ColorValue) => void;
  /** Handler when preset changes */
  onPresetChange: (preset: string) => void;

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

  /** Current advanced settings values (per-card overrides or global values) */
  advancedSettings: AdvancedSettings;
  /** Optional inherited/global advanced settings to use when per-card values are undefined */
  inheritedAdvancedSettings?: AdvancedSettings;
  /** Handler for advanced setting changes */
  onAdvancedSettingChange: <K extends keyof AdvancedSettings>(
    key: K,
    value: AdvancedSettings[K],
  ) => void;
  /** Which advanced options to show (defaults to all for global, controlled for card) */
  advancedVisibility?: AdvancedVisibility;

  /** Handler for reset action */
  onReset: () => void;
  /** Label for reset button (e.g., "Reset to Defaults" or "Reset to Global Settings") */
  resetLabel?: string;
  /** Optional callback that's called when the validity of the settings changes (true = valid) */
  onValidityChange?: (isValid: boolean) => void;
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
  inheritedAdvancedSettings,
  onAdvancedSettingChange,
  advancedVisibility,
  onValidityChange,
  onReset,
  resetLabel,
}: Readonly<SettingsContentProps>) {
  const visibility: AdvancedVisibility = advancedVisibility ?? {
    showStatusColors: mode === "global",
    showPiePercentages: mode === "global",
    showFavorites: mode === "global",
    showGridSize: mode === "global",
  };

  // Merge per-card advanced settings with any provided inherited/global values so
  // undefined means "inherit" and the UI reflects the resolved behavior.
  const effectiveAdvancedSettings = useMemo(
    () => ({
      useStatusColors:
        advancedSettings.useStatusColors ??
        inheritedAdvancedSettings?.useStatusColors,
      showPiePercentages:
        advancedSettings.showPiePercentages ??
        inheritedAdvancedSettings?.showPiePercentages,
      showFavorites:
        advancedSettings.showFavorites ??
        inheritedAdvancedSettings?.showFavorites,
      gridCols:
        advancedSettings.gridCols ?? inheritedAdvancedSettings?.gridCols ?? 3,
      gridRows:
        advancedSettings.gridRows ?? inheritedAdvancedSettings?.gridRows ?? 3,
    }),
    [advancedSettings, inheritedAdvancedSettings],
  );

  const hasAdvancedOptions =
    visibility.showStatusColors ||
    visibility.showPiePercentages ||
    visibility.showFavorites ||
    visibility.showGridSize;

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

  const quickColorPresets = useMemo(() => {
    const candidates = [
      { id: "default", label: "Default" },
      { id: "anilistDark", label: "AniList Dark" },
      { id: "anilistLight", label: "AniList Light" },
    ];

    return candidates.filter((p) => Boolean(colorPresets[p.id]));
  }, []);

  const borderInputs = useBorderColorInput({
    idPrefix,
    borderEnabled,
    borderColor,
    onBorderColorChange,
  });

  const colorsValid = useMemo(() => {
    return colors.every((c) => validateColorValue(c));
  }, [colors]);

  // Keep a ref to the latest onValidityChange so we can call it without causing
  // this effect to re-run whenever the parent provides a new function identity.
  const onValidityChangeRef =
    useRef<SettingsContentProps["onValidityChange"]>(onValidityChange);
  useEffect(() => {
    onValidityChangeRef.current = onValidityChange;
  }, [onValidityChange]);

  const gridValidationEnabled = Boolean(visibility.showGridSize);

  const gridInputs = useGridSizeInputs({
    idPrefix,
    enabled: gridValidationEnabled,
    cols: effectiveAdvancedSettings.gridCols ?? 3,
    rows: effectiveAdvancedSettings.gridRows ?? 3,
    onColsChange: (value) => onAdvancedSettingChange("gridCols", value),
    onRowsChange: (value) => onAdvancedSettingChange("gridRows", value),
  });

  const isOverallValid = useMemo(() => {
    const borderValid = borderEnabled ? borderInputs.isBorderColorValid : true;
    return colorsValid && borderValid && gridInputs.isGridValid;
  }, [
    borderEnabled,
    borderInputs.isBorderColorValid,
    colorsValid,
    gridInputs.isGridValid,
  ]);

  useEffect(() => {
    onValidityChangeRef.current?.(isOverallValid);
  }, [isOverallValid]);

  return (
    <div className="space-y-5">
      <Tabs defaultValue="colors" className="w-full">
        <TabsList
          className={`border-gold/15 bg-gold/5 dark:border-gold/10 dark:bg-gold/3 grid w-full gap-1 rounded-xl border p-1 ${hasAdvancedOptions ? "grid-cols-3" : "grid-cols-2"}`}
        >
          <TabsTrigger
            value="colors"
            className="data-[state=active]:from-gold data-[state=active]:to-gold-dim data-[state=active]:shadow-gold/20 gap-2 rounded-lg data-[state=active]:bg-linear-to-r data-[state=active]:via-amber-500 data-[state=active]:text-white data-[state=active]:shadow-md"
          >
            <Palette className="h-4 w-4" aria-hidden="true" />
            Colors
          </TabsTrigger>
          <TabsTrigger
            value="border"
            className="data-[state=active]:from-gold data-[state=active]:to-gold-dim data-[state=active]:shadow-gold/20 gap-2 rounded-lg data-[state=active]:bg-linear-to-r data-[state=active]:via-amber-500 data-[state=active]:text-white data-[state=active]:shadow-md"
          >
            <Square className="h-4 w-4" aria-hidden="true" />
            Border
          </TabsTrigger>
          {hasAdvancedOptions && (
            <TabsTrigger
              value="advanced"
              className="data-[state=active]:from-gold data-[state=active]:to-gold-dim data-[state=active]:shadow-gold/20 gap-2 rounded-lg data-[state=active]:bg-linear-to-r data-[state=active]:via-amber-500 data-[state=active]:text-white data-[state=active]:shadow-md"
            >
              <Sliders className="h-4 w-4" aria-hidden="true" />
              Advanced
            </TabsTrigger>
          )}
        </TabsList>

        <TabsContent value="colors" className="mt-5 space-y-5">
          <div className="border-gold/15 bg-gold/3 dark:border-gold/10 dark:bg-gold/3 flex justify-center rounded-xl border p-4">
            <ColorPreviewCard
              titleColor={colors[0]}
              backgroundColor={colors[1]}
              textColor={colors[2]}
              circleColor={colors[3]}
              borderColor={borderEnabled ? borderColor : undefined}
              borderRadius={borderRadius}
            />
          </div>

          {quickColorPresets.length > 0 ? (
            <div className="space-y-2">
              <Label className="text-foreground text-sm font-semibold">
                Quick apply
              </Label>
              <div className="flex flex-wrap gap-2">
                {quickColorPresets.map((p) => (
                  <Button
                    key={p.id}
                    type="button"
                    size="sm"
                    variant={p.id === colorPreset ? "default" : "outline"}
                    onClick={() => onPresetChange(p.id)}
                    className={cn(
                      "h-8 rounded-lg transition-all",
                      p.id === colorPreset
                        ? "from-gold to-gold-dim shadow-gold/20 bg-linear-to-r via-amber-500 text-white shadow-md"
                        : "border-gold/20 hover:border-gold/40 hover:bg-gold/5 dark:border-gold/15 dark:hover:border-gold/30",
                    )}
                  >
                    {p.label}
                  </Button>
                ))}
              </div>
            </div>
          ) : null}

          <div className="via-gold/15 h-px bg-linear-to-r from-transparent to-transparent" />

          <div className="space-y-3">
            <Label className="text-foreground text-sm font-semibold">
              Color Preset
            </Label>
            <ColorPresetSelector
              selectedPreset={colorPreset}
              presets={colorPresets}
              onPresetChange={onPresetChange}
            />
          </div>

          <div className="via-gold/15 h-px bg-linear-to-r from-transparent to-transparent" />

          <div className="space-y-3">
            <Label className="text-foreground text-sm font-semibold">
              Custom Colors
            </Label>
            <ColorPickerGroup pickers={colorPickers} />
          </div>
        </TabsContent>

        <TabsContent value="border" className="mt-5 space-y-5">
          <div className="space-y-2">
            <Label className="text-foreground text-sm font-semibold">
              Quick apply
            </Label>
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                size="sm"
                variant={borderEnabled ? "outline" : "default"}
                onClick={() => onBorderEnabledChange(false)}
                className={cn(
                  "h-8 rounded-lg transition-all",
                  borderEnabled
                    ? "border-gold/20 hover:border-gold/40 hover:bg-gold/5 dark:border-gold/15 dark:hover:border-gold/30"
                    : "from-gold to-gold-dim shadow-gold/20 bg-linear-to-r via-amber-500 text-white shadow-md",
                )}
              >
                No border
              </Button>
              <Button
                type="button"
                size="sm"
                variant={
                  borderEnabled && borderRadius === 0 ? "default" : "outline"
                }
                onClick={() => {
                  if (!borderEnabled) onBorderEnabledChange(true);
                  onBorderRadiusChange(0);
                }}
                className={cn(
                  "h-8 rounded-lg transition-all",
                  borderEnabled && borderRadius === 0
                    ? "from-gold to-gold-dim shadow-gold/20 bg-linear-to-r via-amber-500 text-white shadow-md"
                    : "border-gold/20 hover:border-gold/40 hover:bg-gold/5 dark:border-gold/15 dark:hover:border-gold/30",
                )}
              >
                Square
              </Button>
              <Button
                type="button"
                size="sm"
                variant={
                  borderEnabled && borderRadius === 16 ? "default" : "outline"
                }
                onClick={() => {
                  if (!borderEnabled) onBorderEnabledChange(true);
                  onBorderRadiusChange(16);
                }}
                className={cn(
                  "h-8 rounded-lg transition-all",
                  borderEnabled && borderRadius === 16
                    ? "from-gold to-gold-dim shadow-gold/20 bg-linear-to-r via-amber-500 text-white shadow-md"
                    : "border-gold/20 hover:border-gold/40 hover:bg-gold/5 dark:border-gold/15 dark:hover:border-gold/30",
                )}
              >
                Rounded
              </Button>
            </div>
          </div>

          <div className="border-gold/15 bg-gold/3 dark:border-gold/10 dark:bg-gold/3 flex items-center justify-between rounded-lg border p-3">
            <div className="flex items-center gap-2">
              <Square className="text-gold-dim dark:text-gold h-4 w-4" />
              <span className="text-foreground text-sm font-medium">
                Enable Border
              </span>
            </div>
            <Switch
              checked={borderEnabled}
              onCheckedChange={onBorderEnabledChange}
              className="data-[state=checked]:bg-gold"
              aria-label="Enable border"
            />
          </div>

          <AnimatePresence mode="wait" initial={false}>
            {borderEnabled && (
              <motion.div
                key="border-settings"
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                className="space-y-4"
              >
                <div className="space-y-2">
                  <Label
                    htmlFor={`${idPrefix}-borderColor-input`}
                    className="text-foreground text-sm font-medium"
                  >
                    Border Color
                  </Label>
                  <div className="flex items-center gap-3">
                    <div className="border-gold/20 dark:border-gold/15 relative h-10 w-10 shrink-0 overflow-hidden rounded-lg border-2 shadow-inner">
                      <Input
                        type="color"
                        value={
                          getColorPickerHex(borderInputs.inputBorderColor) ??
                          getColorPickerHex(borderColor) ??
                          "#000000"
                        }
                        onChange={(e) =>
                          borderInputs.handleColorPickerChange(e.target.value)
                        }
                        className="absolute -top-1/2 -left-1/2 h-[200%] w-[200%] cursor-pointer border-0 p-0"
                        aria-label="Border color picker"
                      />
                    </div>
                    <Input
                      id={`${idPrefix}-borderColor-input`}
                      type="text"
                      value={borderInputs.inputBorderColor}
                      onChange={(e) =>
                        borderInputs.handleBorderColorTextChange(e.target.value)
                      }
                      onBlur={borderInputs.handleBorderColorBlur}
                      aria-invalid={!borderInputs.isBorderColorValid}
                      aria-describedby={borderInputs.borderColorAriaDescribedBy}
                      className={`focus-visible:ring-gold/50 h-10 flex-1 font-mono text-sm lowercase ${borderInputs.isBorderColorValid ? "border-gold/20 dark:border-gold/15" : "border-red-500 focus-visible:ring-1 focus-visible:ring-red-500"}`}
                      placeholder="#e4e2e2"
                    />
                  </div>
                  <AnimatePresence>
                    {!borderInputs.isBorderColorValid && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: "auto" }}
                        exit={{ opacity: 0, height: 0 }}
                        className="mt-1"
                      >
                        <p
                          id={`${idPrefix}-borderColor-error`}
                          className="text-xs text-red-600"
                        >
                          Invalid color — use{" "}
                          <span className="font-mono">#RGB</span>,{" "}
                          <span className="font-mono">#RRGGBB</span>,{" "}
                          <span className="font-mono">#RRGGBBAA</span> or a CSS
                          color name.
                        </p>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label className="text-foreground text-sm font-medium">
                      Border Radius
                    </Label>
                    <span className="bg-gold/10 text-gold-dim dark:bg-gold/10 dark:text-gold rounded-md px-2 py-0.5 text-sm font-bold">
                      {borderRadius}px
                    </span>
                  </div>
                  <Input
                    type="range"
                    min={0}
                    max={100}
                    step={0.1}
                    value={borderRadius}
                    onChange={(e) =>
                      onBorderRadiusChange(
                        Math.round(Number.parseFloat(e.target.value) * 10) / 10,
                      )
                    }
                    aria-label={`Border radius (${borderRadius}px)`}
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-valuenow={borderRadius}
                    className="from-gold/20 to-gold/30 dark:from-gold/15 dark:to-gold/25 [&::-moz-range-thumb]:bg-gold [&::-webkit-slider-thumb]:bg-gold h-2 w-full cursor-pointer appearance-none rounded-full bg-linear-to-r px-0 [&::-moz-range-thumb]:h-4 [&::-moz-range-thumb]:w-4 [&::-moz-range-thumb]:cursor-pointer [&::-moz-range-thumb]:appearance-none [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:border-2 [&::-moz-range-thumb]:border-white [&::-moz-range-thumb]:shadow-md [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-white [&::-webkit-slider-thumb]:shadow-md"
                  />
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </TabsContent>

        {hasAdvancedOptions && (
          <TabsContent value="advanced" className="mt-5 space-y-4">
            {visibility.showStatusColors && (
              <div className="border-gold/15 bg-gold/3 dark:border-gold/10 dark:bg-gold/3 flex items-center justify-between rounded-lg border p-3">
                <div className="flex items-center gap-2">
                  <Palette className="text-gold-dim dark:text-gold h-4 w-4" />
                  <div>
                    <span className="text-foreground text-sm font-medium">
                      Status Colors
                    </span>
                    {mode === "global" && (
                      <p className="text-muted-foreground text-xs">
                        Fixed colors for status distribution
                      </p>
                    )}
                  </div>
                </div>
                <Switch
                  checked={effectiveAdvancedSettings.useStatusColors ?? false}
                  onCheckedChange={(checked) =>
                    onAdvancedSettingChange("useStatusColors", checked)
                  }
                  className="data-[state=checked]:bg-green-500"
                  aria-label="Status colors"
                />
              </div>
            )}

            {visibility.showPiePercentages && (
              <div className="border-gold/15 bg-gold/3 dark:border-gold/10 dark:bg-gold/3 flex items-center justify-between rounded-lg border p-3">
                <div className="flex items-center gap-2">
                  <PieChart className="text-gold-dim dark:text-gold h-4 w-4" />
                  <div>
                    <span className="text-foreground text-sm font-medium">
                      Show Percentages
                    </span>
                    {mode === "global" && (
                      <p className="text-muted-foreground text-xs">
                        Display % on pie/donut charts
                      </p>
                    )}
                  </div>
                </div>
                <Switch
                  checked={
                    effectiveAdvancedSettings.showPiePercentages ?? false
                  }
                  onCheckedChange={(checked) =>
                    onAdvancedSettingChange("showPiePercentages", checked)
                  }
                  className="data-[state=checked]:bg-green-500"
                  aria-label="Show percentages"
                />
              </div>
            )}

            {visibility.showFavorites && (
              <div className="border-gold/15 bg-gold/3 dark:border-gold/10 dark:bg-gold/3 flex items-center justify-between rounded-lg border p-3">
                <div className="flex items-center gap-2">
                  <Heart className="text-gold-dim dark:text-gold h-4 w-4" />
                  <div>
                    <span className="text-foreground text-sm font-medium">
                      Show Favorites
                    </span>
                    {mode === "global" && (
                      <p className="text-muted-foreground text-xs">
                        Display favorites on applicable cards
                      </p>
                    )}
                  </div>
                </div>
                <Switch
                  checked={effectiveAdvancedSettings.showFavorites ?? false}
                  onCheckedChange={(checked) =>
                    onAdvancedSettingChange("showFavorites", checked)
                  }
                  className="data-[state=checked]:bg-green-500"
                  aria-label="Show favorites"
                />
              </div>
            )}

            {visibility.showGridSize && (
              <div className="border-gold/15 bg-gold/3 dark:border-gold/10 dark:bg-gold/3 space-y-3 rounded-lg border p-3">
                <div className="flex items-center gap-2">
                  <Grid className="text-gold-dim dark:text-gold h-4 w-4" />
                  <span className="text-foreground text-sm font-medium">
                    {mode === "global" ? "Favorites Grid Size" : "Grid Size"}
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label
                      htmlFor={`${idPrefix}-gridCols`}
                      className="text-muted-foreground mb-1 text-xs"
                    >
                      Columns
                    </Label>
                    <Input
                      id={`${idPrefix}-gridCols`}
                      type="number"
                      min={GRID_MIN}
                      max={GRID_MAX}
                      value={gridInputs.inputGridCols}
                      onChange={(e) =>
                        gridInputs.handleGridColsChange(e.target.value)
                      }
                      onBlur={gridInputs.handleGridColsBlur}
                      aria-invalid={
                        gridValidationEnabled && !gridInputs.isGridColsValid
                      }
                      aria-describedby={gridInputs.gridColsAriaDescribedBy}
                      className={
                        gridValidationEnabled && !gridInputs.isGridColsValid
                          ? "h-9 border-red-500 text-sm focus-visible:ring-1 focus-visible:ring-red-500"
                          : "h-9 text-sm"
                      }
                    />
                    <AnimatePresence>
                      {gridValidationEnabled && !gridInputs.isGridColsValid && (
                        <motion.p
                          id={`${idPrefix}-gridCols-error`}
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: "auto" }}
                          exit={{ opacity: 0, height: 0 }}
                          className="mt-1 text-xs text-red-600"
                        >
                          Enter a whole number between {GRID_MIN} and {GRID_MAX}
                          .
                        </motion.p>
                      )}
                    </AnimatePresence>
                  </div>
                  <div>
                    <Label
                      htmlFor={`${idPrefix}-gridRows`}
                      className="text-muted-foreground mb-1 text-xs"
                    >
                      Rows
                    </Label>
                    <Input
                      id={`${idPrefix}-gridRows`}
                      type="number"
                      min={GRID_MIN}
                      max={GRID_MAX}
                      value={gridInputs.inputGridRows}
                      onChange={(e) =>
                        gridInputs.handleGridRowsChange(e.target.value)
                      }
                      onBlur={gridInputs.handleGridRowsBlur}
                      aria-invalid={
                        gridValidationEnabled && !gridInputs.isGridRowsValid
                      }
                      aria-describedby={gridInputs.gridRowsAriaDescribedBy}
                      className={
                        gridValidationEnabled && !gridInputs.isGridRowsValid
                          ? "h-9 border-red-500 text-sm focus-visible:ring-1 focus-visible:ring-red-500"
                          : "h-9 text-sm"
                      }
                    />
                    <AnimatePresence>
                      {gridValidationEnabled && !gridInputs.isGridRowsValid && (
                        <motion.p
                          id={`${idPrefix}-gridRows-error`}
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: "auto" }}
                          exit={{ opacity: 0, height: 0 }}
                          className="mt-1 text-xs text-red-600"
                        >
                          Enter a whole number between {GRID_MIN} and {GRID_MAX}
                          .
                        </motion.p>
                      )}
                    </AnimatePresence>
                  </div>
                </div>
                {mode === "global" && (
                  <p className="text-muted-foreground text-xs">
                    Grid dimensions for favorites card (1-5 each)
                  </p>
                )}
              </div>
            )}
          </TabsContent>
        )}
      </Tabs>

      <div className="border-gold/20 dark:border-gold/15 flex justify-end border-t pt-5">
        <Button
          variant="outline"
          size="sm"
          onClick={onReset}
          className="border-gold/20 text-muted-foreground hover:border-gold/40 hover:bg-gold/5 hover:text-foreground dark:border-gold/15 dark:hover:border-gold/30 gap-2 transition-all"
        >
          <RotateCcw className="h-4 w-4" />
          {resetLabel ?? defaultResetLabel}
        </Button>
      </div>
    </div>
  );
}
