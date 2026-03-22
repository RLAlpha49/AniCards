"use client";

import { AnimatePresence, motion } from "framer-motion";
import {
  ChevronRight,
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

interface AdvancedSettings {
  useStatusColors?: boolean;
  showPiePercentages?: boolean;
  showFavorites?: boolean;
  gridCols?: number;
  gridRows?: number;
}

interface AdvancedVisibility {
  showStatusColors?: boolean;
  showPiePercentages?: boolean;
  showFavorites?: boolean;
  showGridSize?: boolean;
}

interface SettingsContentProps {
  idPrefix: string;
  mode: "global" | "card";
  colors: [ColorValue, ColorValue, ColorValue, ColorValue];
  colorPreset: string;
  onColorChange: (index: number, value: ColorValue) => void;
  onPresetChange: (preset: string) => void;
  borderEnabled: boolean;
  onBorderEnabledChange: (enabled: boolean) => void;
  borderColor: string;
  onBorderColorChange: (color: string) => void;
  borderRadius: number;
  onBorderRadiusChange: (radius: number) => void;
  advancedSettings: AdvancedSettings;
  inheritedAdvancedSettings?: AdvancedSettings;
  onAdvancedSettingChange: <K extends keyof AdvancedSettings>(
    key: K,
    value: AdvancedSettings[K],
  ) => void;
  advancedVisibility?: AdvancedVisibility;
  onReset: () => void;
  resetLabel?: string;
  onValidityChange?: (isValid: boolean) => void;
}

/* ------------------------------------------------------------------ */
/*  Collapsible section wrapper                                       */
/* ------------------------------------------------------------------ */

function SettingsSection({
  title,
  icon: Icon,
  defaultOpen = true,
  children,
}: Readonly<{
  title: string;
  icon: React.ComponentType<{ className?: string }>;
  defaultOpen?: boolean;
  children: React.ReactNode;
}>) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div className="border-border/50 bg-card/40 border backdrop-blur-sm transition-colors">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="hover:bg-muted/40 flex w-full items-center justify-between gap-3 px-4 py-3 text-left transition-colors"
      >
        <div className="flex items-center gap-2.5">
          <div className="bg-gold/10 text-gold dark:bg-gold/15 flex h-7 w-7 items-center justify-center">
            <Icon className="h-3.5 w-3.5" />
          </div>
          <span className="text-foreground text-sm font-semibold tracking-tight">
            {title}
          </span>
        </div>
        <ChevronRight
          className={cn(
            "text-muted-foreground h-4 w-4 transition-transform duration-200",
            open && "rotate-90",
          )}
        />
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            key="content"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2, ease: "easeInOut" }}
            className="overflow-hidden"
          >
            <div className="border-border/40 border-t px-4 py-4">
              {children}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  SettingsContent                                                    */
/* ------------------------------------------------------------------ */

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
      {/* ── Live Preview ────────────────────────────────── */}
      <div className="border-border/50 bg-muted/30 border p-5 backdrop-blur-sm">
        <ColorPreviewCard
          titleColor={colors[0]}
          backgroundColor={colors[1]}
          textColor={colors[2]}
          circleColor={colors[3]}
          borderColor={borderEnabled ? borderColor : undefined}
          borderRadius={borderRadius}
        />
      </div>

      {/* ── Tab Navigation ──────────────────────────────── */}
      <Tabs defaultValue="colors" className="w-full">
        <TabsList
          className={cn(
            "bg-muted/50 border-border/50 grid w-full gap-0.5 border p-1 backdrop-blur-sm",
            hasAdvancedOptions ? "grid-cols-3" : "grid-cols-2",
          )}
        >
          <TabsTrigger
            value="colors"
            className="data-[state=active]:bg-gold/90 data-[state=active]:shadow-gold/15 gap-1.5 text-xs font-medium transition-all data-[state=active]:text-white data-[state=active]:shadow-sm sm:text-sm"
          >
            <Palette className="h-3.5 w-3.5" aria-hidden="true" />
            Colors
          </TabsTrigger>
          <TabsTrigger
            value="border"
            className="data-[state=active]:bg-gold/90 data-[state=active]:shadow-gold/15 gap-1.5 text-xs font-medium transition-all data-[state=active]:text-white data-[state=active]:shadow-sm sm:text-sm"
          >
            <Square className="h-3.5 w-3.5" aria-hidden="true" />
            Border
          </TabsTrigger>
          {hasAdvancedOptions && (
            <TabsTrigger
              value="advanced"
              className="data-[state=active]:bg-gold/90 data-[state=active]:shadow-gold/15 gap-1.5 text-xs font-medium transition-all data-[state=active]:text-white data-[state=active]:shadow-sm sm:text-sm"
            >
              <Sliders className="h-3.5 w-3.5" aria-hidden="true" />
              Advanced
            </TabsTrigger>
          )}
        </TabsList>

        {/* ── Colors Tab ──────────────────────────────── */}
        <TabsContent value="colors" className="mt-4 space-y-4">
          {/* Quick Apply */}
          {quickColorPresets.length > 0 && (
            <div className="space-y-2">
              <Label className="text-muted-foreground text-xs font-medium tracking-wider uppercase">
                Quick Apply
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
                      "h-8 text-xs font-medium transition-all",
                      p.id === colorPreset
                        ? "bg-gold hover:bg-gold/90 text-white shadow-sm"
                        : "border-border/60 hover:border-gold/40 hover:bg-gold/5",
                    )}
                  >
                    {p.label}
                  </Button>
                ))}
              </div>
            </div>
          )}

          {/* Color Preset Selector */}
          <SettingsSection title="Color Preset" icon={Palette}>
            <ColorPresetSelector
              selectedPreset={colorPreset}
              presets={colorPresets}
              onPresetChange={onPresetChange}
            />
          </SettingsSection>

          {/* Custom Colors */}
          <SettingsSection
            title="Custom Colors"
            icon={Palette}
            defaultOpen={false}
          >
            <ColorPickerGroup pickers={colorPickers} />
          </SettingsSection>
        </TabsContent>

        {/* ── Border Tab ──────────────────────────────── */}
        <TabsContent value="border" className="mt-4 space-y-4">
          {/* Quick Apply */}
          <div className="space-y-2">
            <Label className="text-muted-foreground text-xs font-medium tracking-wider uppercase">
              Quick Apply
            </Label>
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                size="sm"
                variant={borderEnabled ? "outline" : "default"}
                onClick={() => onBorderEnabledChange(false)}
                className={cn(
                  "h-8 text-xs font-medium transition-all",
                  borderEnabled
                    ? "border-border/60 hover:border-gold/40 hover:bg-gold/5"
                    : "bg-gold hover:bg-gold/90 text-white shadow-sm",
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
                  "h-8 text-xs font-medium transition-all",
                  borderEnabled && borderRadius === 0
                    ? "bg-gold hover:bg-gold/90 text-white shadow-sm"
                    : "border-border/60 hover:border-gold/40 hover:bg-gold/5",
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
                  "h-8 text-xs font-medium transition-all",
                  borderEnabled && borderRadius === 16
                    ? "bg-gold hover:bg-gold/90 text-white shadow-sm"
                    : "border-border/60 hover:border-gold/40 hover:bg-gold/5",
                )}
              >
                Rounded
              </Button>
            </div>
          </div>

          {/* Enable Border Toggle */}
          <div className="border-border/50 bg-muted/30 flex items-center justify-between border p-4 backdrop-blur-sm">
            <div className="flex items-center gap-3">
              <div className="bg-gold/10 text-gold dark:bg-gold/15 flex h-8 w-8 items-center justify-center">
                <Square className="h-4 w-4" />
              </div>
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

          {/* Border Settings */}
          <AnimatePresence mode="wait" initial={false}>
            {borderEnabled && (
              <motion.div
                key="border-settings"
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.2, ease: "easeInOut" }}
                className="space-y-5 overflow-hidden"
              >
                {/* Border Color */}
                <div className="space-y-2">
                  <Label
                    htmlFor={`${idPrefix}-borderColor-input`}
                    className="text-foreground text-sm font-medium"
                  >
                    Border Color
                  </Label>
                  <div className="flex items-center gap-3">
                    <div className="border-border/60 relative h-10 w-10 shrink-0 overflow-hidden border shadow-inner">
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
                      className={cn(
                        "h-10 flex-1 font-mono text-sm lowercase transition-colors",
                        borderInputs.isBorderColorValid
                          ? "border-border/60 focus-visible:ring-gold/30"
                          : "border-red-500 focus-visible:ring-1 focus-visible:ring-red-500",
                      )}
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

                {/* Border Radius */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <Label className="text-foreground text-sm font-medium">
                      Border Radius
                    </Label>
                    <span className="bg-gold/10 text-gold-dim dark:text-gold px-2.5 py-1 text-xs font-bold tabular-nums">
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
                    className="from-gold/15 to-gold/25 [&::-moz-range-thumb]:bg-gold [&::-webkit-slider-thumb]:bg-gold h-2 w-full cursor-pointer appearance-none rounded-full bg-linear-to-r px-0 [&::-moz-range-thumb]:h-5 [&::-moz-range-thumb]:w-5 [&::-moz-range-thumb]:cursor-pointer [&::-moz-range-thumb]:appearance-none [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:border-2 [&::-moz-range-thumb]:border-white [&::-moz-range-thumb]:shadow-md [&::-webkit-slider-thumb]:h-5 [&::-webkit-slider-thumb]:w-5 [&::-webkit-slider-thumb]:cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-white [&::-webkit-slider-thumb]:shadow-md"
                  />
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </TabsContent>

        {/* ── Advanced Tab ─────────────────────────────── */}
        {hasAdvancedOptions && (
          <TabsContent value="advanced" className="mt-4 space-y-3">
            {visibility.showStatusColors && (
              <ToggleRow
                icon={Palette}
                label="Status Colors"
                description={
                  mode === "global"
                    ? "Fixed colors for status distribution"
                    : undefined
                }
                checked={effectiveAdvancedSettings.useStatusColors ?? false}
                onCheckedChange={(checked) =>
                  onAdvancedSettingChange("useStatusColors", checked)
                }
                ariaLabel="Status colors"
              />
            )}

            {visibility.showPiePercentages && (
              <ToggleRow
                icon={PieChart}
                label="Show Percentages"
                description={
                  mode === "global"
                    ? "Display % on pie/donut charts"
                    : undefined
                }
                checked={effectiveAdvancedSettings.showPiePercentages ?? false}
                onCheckedChange={(checked) =>
                  onAdvancedSettingChange("showPiePercentages", checked)
                }
                ariaLabel="Show percentages"
              />
            )}

            {visibility.showFavorites && (
              <ToggleRow
                icon={Heart}
                label="Show Favorites"
                description={
                  mode === "global"
                    ? "Display favorites on applicable cards"
                    : undefined
                }
                checked={effectiveAdvancedSettings.showFavorites ?? false}
                onCheckedChange={(checked) =>
                  onAdvancedSettingChange("showFavorites", checked)
                }
                ariaLabel="Show favorites"
              />
            )}

            {visibility.showGridSize && (
              <div className="border-border/50 bg-muted/30 border p-4 backdrop-blur-sm">
                <div className="mb-3 flex items-center gap-2.5">
                  <div className="bg-gold/10 text-gold dark:bg-gold/15 flex h-7 w-7 items-center justify-center">
                    <Grid className="h-3.5 w-3.5" />
                  </div>
                  <span className="text-foreground text-sm font-medium">
                    {mode === "global" ? "Favorites Grid Size" : "Grid Size"}
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label
                      htmlFor={`${idPrefix}-gridCols`}
                      className="text-muted-foreground mb-1.5 text-xs font-medium"
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
                      className={cn(
                        "h-9 text-sm",
                        gridValidationEnabled && !gridInputs.isGridColsValid
                          ? "border-red-500 focus-visible:ring-1 focus-visible:ring-red-500"
                          : "border-border/60",
                      )}
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
                      className="text-muted-foreground mb-1.5 text-xs font-medium"
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
                      className={cn(
                        "h-9 text-sm",
                        gridValidationEnabled && !gridInputs.isGridRowsValid
                          ? "border-red-500 focus-visible:ring-1 focus-visible:ring-red-500"
                          : "border-border/60",
                      )}
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
                  <p className="text-muted-foreground mt-2 text-xs">
                    Grid dimensions for favorites card (1-5 each)
                  </p>
                )}
              </div>
            )}
          </TabsContent>
        )}
      </Tabs>

      {/* ── Reset Footer ────────────────────────────────── */}
      <div className="border-border/40 flex justify-end border-t pt-4">
        <Button
          variant="ghost"
          size="sm"
          onClick={onReset}
          className="text-muted-foreground hover:text-foreground gap-2 text-xs transition-colors"
        >
          <RotateCcw className="h-3.5 w-3.5" />
          {resetLabel ?? defaultResetLabel}
        </Button>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Reusable toggle row                                               */
/* ------------------------------------------------------------------ */

function ToggleRow({
  icon: Icon,
  label,
  description,
  checked,
  onCheckedChange,
  ariaLabel,
}: Readonly<{
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  description?: string;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  ariaLabel: string;
}>) {
  return (
    <div className="border-border/50 bg-muted/30 flex items-center justify-between border p-4 backdrop-blur-sm transition-colors">
      <div className="flex items-center gap-3">
        <div className="bg-gold/10 text-gold dark:bg-gold/15 flex h-8 w-8 items-center justify-center">
          <Icon className="h-4 w-4" />
        </div>
        <div>
          <span className="text-foreground text-sm font-medium">{label}</span>
          {description && (
            <p className="text-muted-foreground text-xs">{description}</p>
          )}
        </div>
      </div>
      <Switch
        checked={checked}
        onCheckedChange={onCheckedChange}
        className="data-[state=checked]:bg-gold"
        aria-label={ariaLabel}
      />
    </div>
  );
}
