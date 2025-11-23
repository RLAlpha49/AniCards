import React, { useMemo, useState } from "react";
import { AnimatePresence, motion as m, motion } from "framer-motion";

import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { colorPresets, statCardTypes } from "@/components/stat-card-generator";

// Only these card types support showFavorites
const FAVORITE_CARD_IDS = new Set([
  "animeVoiceActors",
  "animeStudios",
  "animeStaff",
  "mangaStaff",
]);

interface DefaultCardSettingsProps {
  defaultPreset: string;
  onPresetChange: (value: string) => void;
  defaultCardTypes: string[];
  defaultVariants: Record<string, string>;
  onToggleCardType: (cardType: string) => void;
  onToggleAllCardTypes: () => void;
  onVariantChange: (cardType: string, variant: string) => void;
  defaultShowFavoritesByCard: Record<string, boolean>;
  onToggleShowFavoritesDefault: (cardId: string) => void;
}

export function DefaultCardSettings({
  defaultPreset,
  onPresetChange,
  defaultCardTypes,
  defaultVariants,
  onToggleCardType,
  onToggleAllCardTypes,
  onVariantChange,
  defaultShowFavoritesByCard,
  onToggleShowFavoritesDefault,
}: Readonly<DefaultCardSettingsProps>) {
  // Group computation (stable ordering as defined in statCardTypes array)
  const groups = useMemo(() => {
    return statCardTypes.reduce<{
      order: string[];
      map: Record<string, (typeof statCardTypes)[number][]>;
    }>(
      (acc, ct) => {
        const g = (ct as { group?: string }).group || "Other";
        if (!acc.map[g]) {
          acc.map[g] = [];
          acc.order.push(g);
        }
        acc.map[g].push(ct);
        return acc;
      },
      { order: [], map: {} },
    );
  }, []);

  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>(() => {
    const initial: Record<string, boolean> = {};
    for (const g of groups.order) {
      initial[g] = true;
    }
    return initial;
  });
  const toggle = (g: string) => setOpenGroups((o) => ({ ...o, [g]: !o[g] }));
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: 0.4 }}
      className="space-y-4"
    >
      <div className="rounded-2xl border border-white/50 bg-white/80 p-6 shadow-xl backdrop-blur-xl dark:border-slate-800 dark:bg-slate-900/80">
        <div className="mb-6 flex items-center gap-4">
          <div className="rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 p-3 shadow-lg shadow-indigo-500/20">
            <svg
              className="h-6 w-6 text-white"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"
              />
            </svg>
          </div>
          <div>
            <Label className="text-xl font-bold text-slate-900 dark:text-white">
              Default Card Settings
            </Label>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              Configure default color presets and card types for new generations
            </p>
          </div>
        </div>

        {/* Color Preset Selection */}
        <div className="mb-8 space-y-3">
          <Label className="text-base font-semibold text-slate-900 dark:text-white">
            Color Preset
          </Label>
          <Select value={defaultPreset} onValueChange={onPresetChange}>
            <SelectTrigger className="h-12 w-full max-w-sm border-slate-200 bg-white px-4 text-base transition-all hover:border-blue-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 dark:border-slate-700 dark:bg-slate-800 dark:hover:border-blue-500 dark:focus:border-blue-400">
              <SelectValue placeholder="Select color preset" />
            </SelectTrigger>
            <SelectContent className="border-slate-200 bg-white/95 backdrop-blur-xl dark:border-slate-700 dark:bg-slate-900/95">
              {Object.keys(colorPresets).map((preset) => (
                <SelectItem
                  key={preset}
                  value={preset}
                  className="cursor-pointer py-2 transition-colors focus:bg-blue-50 dark:focus:bg-slate-800"
                >
                  {preset.charAt(0).toUpperCase() + preset.slice(1)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Card Types Section */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <Label className="text-base font-semibold text-slate-900 dark:text-white">
              Default Card Types
            </Label>
            <Button
              variant="outline"
              size="sm"
              onClick={onToggleAllCardTypes}
              className="border-blue-200 text-blue-600 hover:bg-blue-50 hover:text-blue-700 dark:border-blue-800 dark:text-blue-400 dark:hover:bg-blue-900/20"
              aria-label={
                defaultCardTypes.length === statCardTypes.length
                  ? "Unselect all card types"
                  : "Select all card types"
              }
            >
              {defaultCardTypes.length === statCardTypes.length
                ? "Unselect All"
                : "Select All"}
            </Button>
          </div>

          <div className="rounded-xl border border-slate-200 bg-slate-50/50 p-4 backdrop-blur-sm dark:border-slate-700 dark:bg-slate-800/50">
            {groups.order.map((group) => (
              <div
                key={group}
                className="mb-4 space-y-3 border-b border-slate-200 pb-4 last:mb-0 last:border-b-0 last:pb-0 dark:border-slate-700"
              >
                <button
                  type="button"
                  onClick={() => toggle(group)}
                  className="flex w-full items-center gap-3 rounded-lg px-2 py-2 text-left transition-all duration-200 hover:bg-white/50 dark:hover:bg-slate-700/50"
                  aria-expanded={openGroups[group]}
                  aria-controls={`default-group-${group}`}
                >
                  <div
                    className={`rounded-md bg-gradient-to-r from-blue-500 to-purple-500 p-1 transition-transform duration-200 ${
                      openGroups[group] ? "rotate-90" : "rotate-0"
                    }`}
                  >
                    <svg
                      width="12"
                      height="12"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="3"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      className="text-white"
                    >
                      <path d="M9 18l6-6-6-6" />
                    </svg>
                  </div>
                  <span className="text-base font-medium text-slate-900 dark:text-white">
                    {group}
                  </span>
                </button>
                <AnimatePresence initial={false}>
                  {openGroups[group] && (
                    <m.div
                      key={group}
                      id={`default-group-${group}`}
                      initial="collapsed"
                      animate="open"
                      exit="collapsed"
                      variants={{
                        open: { opacity: 1, height: "auto" },
                        collapsed: { opacity: 0, height: 0 },
                      }}
                      transition={{ duration: 0.28, ease: [0.4, 0, 0.2, 1] }}
                      className="grid grid-cols-1 gap-3 overflow-hidden pl-8 md:grid-cols-2"
                    >
                      {groups.map[group].map((type) => {
                        const hasVariants =
                          type.variations && type.variations.length > 0;
                        const currentVariant =
                          defaultVariants[type.id] || "default";

                        return (
                          <div
                            key={type.id}
                            className="rounded-lg border border-slate-200 bg-white p-3 shadow-sm transition-all hover:shadow-md dark:border-slate-700 dark:bg-slate-800"
                          >
                            <div className="flex items-center space-x-3">
                              <Checkbox
                                id={type.id}
                                checked={defaultCardTypes.includes(type.id)}
                                onCheckedChange={() =>
                                  onToggleCardType(type.id)
                                }
                                className="border-slate-300 data-[state=checked]:border-blue-600 data-[state=checked]:bg-blue-600 dark:border-slate-600 dark:data-[state=checked]:bg-blue-500"
                              />
                              <Label
                                htmlFor={type.id}
                                className="flex-1 cursor-pointer text-sm font-medium text-slate-900 dark:text-white"
                              >
                                {type.label.split(" (")[0]}
                              </Label>
                            </div>

                            {/* Show Favorites default toggle for eligible cards */}
                            {FAVORITE_CARD_IDS.has(type.id) &&
                              defaultCardTypes.includes(type.id) && (
                                <div className="mt-3 flex items-center space-x-3 pl-6">
                                  <Checkbox
                                    id={`default-show-favorites-${type.id}`}
                                    checked={
                                      !!defaultShowFavoritesByCard[type.id]
                                    }
                                    onCheckedChange={() =>
                                      onToggleShowFavoritesDefault(type.id)
                                    }
                                    aria-label="Default Show Favorites"
                                    className="scale-90 border-pink-300 data-[state=checked]:border-pink-500 data-[state=checked]:bg-pink-500 dark:border-pink-700 dark:data-[state=checked]:bg-pink-600"
                                  />
                                  <Label
                                    htmlFor={`default-show-favorites-${type.id}`}
                                    className="cursor-pointer text-xs font-medium text-pink-600 dark:text-pink-400"
                                  >
                                    Show Favorites by Default
                                  </Label>
                                </div>
                              )}

                            {/* Variant Selection */}
                            {hasVariants &&
                              defaultCardTypes.includes(type.id) && (
                                <div className="mt-3 pl-6">
                                  <Select
                                    value={currentVariant}
                                    onValueChange={(value) =>
                                      onVariantChange(type.id, value)
                                    }
                                  >
                                    <SelectTrigger className="h-8 w-full border-slate-200 bg-slate-50 text-xs transition-all hover:border-blue-400 focus:border-blue-500 dark:border-slate-700 dark:bg-slate-900 dark:hover:border-blue-500">
                                      <SelectValue placeholder="Select variant" />
                                    </SelectTrigger>
                                    <SelectContent className="border-slate-200 bg-white/95 backdrop-blur-xl dark:border-slate-700 dark:bg-slate-900/95">
                                      {type.variations?.map(
                                        (variation: {
                                          id: string;
                                          label: string;
                                        }) => (
                                          <SelectItem
                                            key={variation.id}
                                            value={variation.id}
                                            className="cursor-pointer text-xs focus:bg-blue-50 dark:focus:bg-slate-800"
                                          >
                                            {variation.label}
                                          </SelectItem>
                                        ),
                                      )}
                                    </SelectContent>
                                  </Select>
                                </div>
                              )}
                          </div>
                        );
                      })}
                    </m.div>
                  )}
                </AnimatePresence>
              </div>
            ))}
          </div>
        </div>
      </div>
    </motion.div>
  );
}
