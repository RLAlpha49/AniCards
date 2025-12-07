"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Input } from "@/components/ui/Input";
import { Label } from "@/components/ui/Label";
import { Switch } from "@/components/ui/Switch";
import { Button } from "@/components/ui/Button";
import { ColorPresetSelector } from "./ColorPresetSelector";
import { ColorPickerGroup } from "./ColorPickerGroup";
import { LivePreview } from "./LivePreview";
import { DEFAULT_CARD_BORDER_RADIUS, cn } from "@/lib/utils";
import { useGeneratorContext } from "./GeneratorContext";
import { colorPresets } from "./constants";
import {
  Palette,
  Brush,
  Square,
  CornerDownRight,
  Sparkles,
  ChevronRight,
} from "lucide-react";

type ColorTab = "presets" | "custom" | "border";

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

  const [activeTab, setActiveTab] = useState<ColorTab>("presets");

  const handlePresetSelection = (preset: string) => {
    handlePresetChange(preset);
  };

  const tabs = [
    {
      id: "presets" as const,
      label: "Presets",
      icon: Palette,
      gradient: "from-blue-500 to-cyan-500",
      description: "Quick color themes",
    },
    {
      id: "custom" as const,
      label: "Custom",
      icon: Brush,
      gradient: "from-orange-500 to-amber-500",
      description: "Fine-tune colors",
    },
    {
      id: "border" as const,
      label: "Border",
      icon: Square,
      gradient: "from-green-500 to-emerald-500",
      description: "Frame styling",
    },
  ];

  return (
    <div className="space-y-6">
      {/* Stack preview above controls */}
      <div className="flex flex-col gap-6">
        {/* Live Preview - Sticky on larger screens */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
        >
          <div className="overflow-hidden rounded-2xl border border-slate-200/50 bg-gradient-to-br from-white/90 via-white/70 to-slate-50/90 shadow-xl shadow-slate-200/50 backdrop-blur-xl dark:border-slate-700/50 dark:from-slate-800/90 dark:via-slate-800/70 dark:to-slate-900/90 dark:shadow-slate-900/50">
            <div className="border-b border-slate-200/50 bg-white/50 px-5 py-4 dark:border-slate-700/50 dark:bg-slate-800/50">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-purple-500 to-pink-500 shadow-md shadow-purple-500/25">
                    <Sparkles className="h-4 w-4 text-white" />
                  </div>
                  <div>
                    <h3 className="font-bold text-slate-900 dark:text-white">
                      Live Preview
                    </h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      See changes in real-time
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-1.5 rounded-full bg-green-100 px-2.5 py-1 dark:bg-green-900/30">
                  <span className="relative flex h-2 w-2">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-green-400 opacity-75" />
                    <span className="relative inline-flex h-2 w-2 rounded-full bg-green-500" />
                  </span>
                  <span className="text-xs font-medium text-green-700 dark:text-green-400">
                    Live
                  </span>
                </div>
              </div>
            </div>
            <div className="p-6">
              <LivePreview previewSVG={previewSVG} />
            </div>
          </div>
        </motion.div>

        {/* Controls Section */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="overflow-hidden rounded-2xl border border-slate-200/50 bg-gradient-to-br from-white/90 via-white/70 to-slate-50/90 shadow-xl shadow-slate-200/50 backdrop-blur-xl dark:border-slate-700/50 dark:from-slate-800/90 dark:via-slate-800/70 dark:to-slate-900/90 dark:shadow-slate-900/50"
        >
          {/* Tab Navigation */}
          <div className="border-b border-slate-200/50 bg-white/50 p-2 dark:border-slate-700/50 dark:bg-slate-800/50">
            <div className="flex gap-1">
              {tabs.map((tab) => {
                const isActive = activeTab === tab.id;
                return (
                  <Button
                    key={tab.id}
                    type="button"
                    variant="ghost"
                    onClick={() => setActiveTab(tab.id)}
                    aria-label={tab.label}
                    className={cn(
                      "group relative flex-1 gap-2 rounded-xl px-4 py-3 text-sm font-medium transition-all",
                      isActive
                        ? "bg-white text-slate-900 shadow-md dark:bg-slate-700 dark:text-white"
                        : "text-slate-500 hover:bg-slate-100/50 hover:text-slate-700 dark:text-slate-400 dark:hover:bg-slate-800/50 dark:hover:text-slate-300",
                    )}
                  >
                    <div
                      className={cn(
                        "flex h-7 w-7 items-center justify-center rounded-lg transition-all",
                        isActive
                          ? `bg-gradient-to-br ${tab.gradient} shadow-sm`
                          : "bg-slate-100 group-hover:bg-slate-200 dark:bg-slate-800 dark:group-hover:bg-slate-700",
                      )}
                    >
                      <tab.icon
                        className={cn(
                          "h-3.5 w-3.5 transition-colors",
                          isActive
                            ? "text-white"
                            : "text-slate-500 dark:text-slate-400",
                        )}
                      />
                    </div>
                    <div className="hidden flex-col items-start sm:flex">
                      <span>{tab.label}</span>
                      <span
                        className={cn(
                          "text-[10px] font-normal",
                          isActive
                            ? "text-slate-500 dark:text-slate-400"
                            : "text-slate-400 dark:text-slate-500",
                        )}
                      >
                        {tab.description}
                      </span>
                    </div>
                  </Button>
                );
              })}
            </div>
          </div>

          {/* Tab Content */}
          <div className="p-5">
            <AnimatePresence mode="wait">
              {activeTab === "presets" && (
                <motion.div
                  key="presets"
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 10 }}
                  transition={{ duration: 0.2 }}
                >
                  <ColorPresetSelector
                    selectedPreset={selectedPreset}
                    presets={colorPresets}
                    onPresetChange={handlePresetSelection}
                  />
                </motion.div>
              )}

              {activeTab === "custom" && (
                <motion.div
                  key="custom"
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 10 }}
                  transition={{ duration: 0.2 }}
                  className="space-y-4"
                >
                  {/* Custom Colors Header */}
                  <div className="flex items-center gap-2">
                    <Sparkles className="h-4 w-4 text-amber-500" />
                    <span className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                      Individual Color Controls
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Customize each color element individually. Changes will
                    switch to custom preset.
                  </p>
                  <ColorPickerGroup pickers={colorPickers} />
                </motion.div>
              )}

              {activeTab === "border" && (
                <motion.div
                  key="border"
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 10 }}
                  transition={{ duration: 0.2 }}
                  className="space-y-5"
                >
                  {/* Border Toggle */}
                  <div className="flex items-center justify-between rounded-xl border border-slate-200/50 bg-slate-50/50 p-4 dark:border-slate-700/50 dark:bg-slate-800/50">
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-green-500 to-emerald-500 shadow-md shadow-green-500/25">
                        <Square className="h-5 w-5 text-white" />
                      </div>
                      <div>
                        <Label className="text-sm font-semibold text-slate-800 dark:text-slate-200">
                          Enable Border
                        </Label>
                        <p className="text-xs text-slate-500 dark:text-slate-400">
                          Add a frame around your card
                        </p>
                      </div>
                    </div>
                    <Switch
                      checked={hasBorder}
                      onCheckedChange={handleToggleBorder}
                      className="data-[state=checked]:bg-gradient-to-r data-[state=checked]:from-green-500 data-[state=checked]:to-emerald-500"
                    />
                  </div>

                  <AnimatePresence>
                    {hasBorder ? (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: "auto" }}
                        exit={{ opacity: 0, height: 0 }}
                        className="space-y-5 overflow-hidden"
                      >
                        {/* Border Radius */}
                        <div className="space-y-3 rounded-xl border border-slate-200/50 bg-white/80 p-4 dark:border-slate-700/50 dark:bg-slate-800/80">
                          <div className="flex items-center gap-2">
                            <CornerDownRight className="h-4 w-4 text-slate-400" />
                            <Label className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                              Border Radius
                            </Label>
                          </div>
                          <div className="flex flex-wrap items-center gap-3">
                            <div className="flex items-center gap-2">
                              <Input
                                type="number"
                                min={0}
                                max={100}
                                step={0.1}
                                value={
                                  Number.isFinite(borderRadius)
                                    ? borderRadius.toFixed(1)
                                    : String(DEFAULT_CARD_BORDER_RADIUS)
                                }
                                onChange={(e) => {
                                  const parsed = Number.parseFloat(
                                    e.target.value,
                                  );
                                  handleBorderRadiusChange(
                                    Number.isFinite(parsed)
                                      ? parsed
                                      : DEFAULT_CARD_BORDER_RADIUS,
                                  );
                                }}
                                onBlur={(e) => {
                                  // Ensure the displayed value snaps back to a clamped value
                                  const parsed = Number.parseFloat(
                                    e.target.value,
                                  );
                                  handleBorderRadiusChange(
                                    Number.isFinite(parsed)
                                      ? parsed
                                      : DEFAULT_CARD_BORDER_RADIUS,
                                  );
                                }}
                                className="h-10 w-20 rounded-xl border-slate-200/50 bg-slate-50 text-center font-mono text-sm shadow-sm dark:border-slate-700/50 dark:bg-slate-900"
                              />
                              <span className="text-sm text-slate-500 dark:text-slate-400">
                                px
                              </span>
                            </div>
                            <div className="flex flex-wrap gap-1.5">
                              {[0, 4, 8, 12, 16, 20].map((val) => (
                                <button
                                  key={val}
                                  type="button"
                                  onClick={() => handleBorderRadiusChange(val)}
                                  className={cn(
                                    "h-8 min-w-[2.5rem] rounded-lg px-2 text-xs font-medium transition-all",
                                    borderRadius === val
                                      ? "bg-slate-900 text-white shadow-md dark:bg-white dark:text-slate-900"
                                      : "bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-700 dark:text-slate-400 dark:hover:bg-slate-600",
                                  )}
                                >
                                  {val}
                                </button>
                              ))}
                            </div>
                          </div>
                          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                            0–100px, rounded to one decimal place; default is{" "}
                            {DEFAULT_CARD_BORDER_RADIUS}px
                          </p>
                        </div>

                        {/* Border Color */}
                        <div className="space-y-3 rounded-xl border border-slate-200/50 bg-white/80 p-4 dark:border-slate-700/50 dark:bg-slate-800/80">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <Brush className="h-4 w-4 text-slate-400" />
                              <Label className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                                Custom Border Color
                              </Label>
                            </div>
                            <Switch
                              checked={borderColorEnabled}
                              onCheckedChange={handleToggleBorderColorEnabled}
                            />
                          </div>

                          <AnimatePresence>
                            {borderColorEnabled && (
                              <motion.div
                                initial={{ opacity: 0, height: 0 }}
                                animate={{ opacity: 1, height: "auto" }}
                                exit={{ opacity: 0, height: 0 }}
                                className="overflow-hidden"
                              >
                                <ColorPickerGroup
                                  pickers={[borderColorPicker]}
                                />
                                <div className="mt-3 flex items-center gap-2 text-xs">
                                  <ChevronRight className="h-3 w-3 text-green-500" />
                                  <span
                                    className={cn(
                                      isBorderColorCustom
                                        ? "text-green-600 dark:text-green-400"
                                        : "text-slate-500 dark:text-slate-400",
                                    )}
                                  >
                                    {isBorderColorCustom
                                      ? "Custom border color applied"
                                      : "Using default border color"}
                                  </span>
                                </div>
                              </motion.div>
                            )}
                          </AnimatePresence>

                          {!borderColorEnabled && (
                            <p className="text-xs text-slate-500 dark:text-slate-400">
                              Enable to customize the border color separately
                            </p>
                          )}
                        </div>
                      </motion.div>
                    ) : (
                      <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        className="flex items-center gap-3 rounded-xl border border-dashed border-slate-200 bg-slate-50/50 p-4 dark:border-slate-700 dark:bg-slate-800/30"
                      >
                        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-100 text-xs font-semibold text-slate-500 dark:bg-slate-700 dark:text-slate-400">
                          i
                        </div>
                        <p className="text-sm text-slate-500 dark:text-slate-400">
                          Border disabled — default radius (
                          {DEFAULT_CARD_BORDER_RADIUS}px) will be applied
                        </p>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
