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
const FAVORITE_CARD_IDS = [
  "animeVoiceActors",
  "animeStudios",
  "animeStaff",
  "mangaStaff",
];

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
    groups.order.forEach((g) => {
      initial[g] = true;
    });
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
      <div className="rounded-xl border border-white/20 bg-white/10 p-6 backdrop-blur-sm dark:border-gray-700/30 dark:bg-gray-700/20">
        <div className="mb-6 flex items-center gap-3">
          <div className="rounded-lg bg-gradient-to-r from-indigo-500 to-purple-500 p-2">
            <svg
              className="h-5 w-5 text-white"
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
            <Label className="text-xl font-semibold text-gray-900 dark:text-white">
              Default Card Settings
            </Label>
            <p className="text-sm text-gray-600 dark:text-gray-300">
              Configure default color presets and card types for new generations
            </p>
          </div>
        </div>

        {/* Color Preset Selection */}
        <div className="mb-8 space-y-3">
          <Label className="text-lg font-medium text-gray-900 dark:text-white">
            Color Preset
          </Label>
          <Select value={defaultPreset} onValueChange={onPresetChange}>
            <SelectTrigger className="max-w-sm border-white/20 bg-white/20 backdrop-blur-sm transition-all duration-200 hover:border-white/30 hover:bg-white/25 dark:border-gray-600/30 dark:bg-gray-700/20 dark:hover:border-gray-600/40 dark:hover:bg-gray-700/30">
              <SelectValue placeholder="Select color preset" />
            </SelectTrigger>
            <SelectContent className="border-white/20 bg-white/90 backdrop-blur-md dark:border-gray-600/30 dark:bg-gray-800/90">
              {Object.keys(colorPresets).map((preset) => (
                <SelectItem
                  key={preset}
                  value={preset}
                  className="transition-colors hover:bg-blue-100/50 dark:hover:bg-gray-700/50"
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
            <Label className="text-lg font-medium text-gray-900 dark:text-white">
              Default Card Types
            </Label>
            <Button
              variant="outline"
              size="sm"
              onClick={onToggleAllCardTypes}
              className="border-blue-200 text-blue-600 transition-all duration-200 hover:border-blue-300 hover:bg-blue-50 dark:border-blue-700 dark:text-blue-400 dark:hover:border-blue-600 dark:hover:bg-blue-900/20"
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

          <div className="rounded-xl border border-white/10 bg-white/10 p-4 backdrop-blur-sm dark:border-gray-600/20 dark:bg-gray-600/20">
            {groups.order.map((group) => (
              <div
                key={group}
                className="mb-4 space-y-3 border-b border-white/10 pb-4 last:mb-0 last:border-b-0 last:pb-0 dark:border-gray-600/20"
              >
                <button
                  type="button"
                  onClick={() => toggle(group)}
                  className="flex w-full items-center gap-3 rounded-lg px-2 py-2 text-left transition-all duration-200 hover:bg-white/10 dark:hover:bg-gray-600/20"
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
                  <span className="text-base font-medium text-gray-900 dark:text-white">
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
                            className="rounded-lg border border-white/10 bg-white/10 p-3 backdrop-blur-sm dark:border-gray-600/20 dark:bg-gray-600/20"
                          >
                            <div className="flex items-center space-x-3">
                              <Checkbox
                                id={type.id}
                                checked={defaultCardTypes.includes(type.id)}
                                onCheckedChange={() =>
                                  onToggleCardType(type.id)
                                }
                                className="transition-all duration-200"
                              />
                              <Label
                                htmlFor={type.id}
                                className="flex-1 cursor-pointer text-sm font-medium text-gray-900 dark:text-white"
                              >
                                {type.label.split(" (")[0]}
                              </Label>
                            </div>

                            {/* Show Favorites default toggle for eligible cards */}
                            {FAVORITE_CARD_IDS.includes(type.id) &&
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
                                    className="scale-90 transition-all duration-200"
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
                                <div className="mt-3">
                                  <Select
                                    value={currentVariant}
                                    onValueChange={(value) =>
                                      onVariantChange(type.id, value)
                                    }
                                  >
                                    <SelectTrigger className="h-8 w-full border-white/20 bg-white/20 text-xs backdrop-blur-sm transition-all duration-200 hover:border-white/30 hover:bg-white/25 dark:border-gray-600/30 dark:bg-gray-700/20 dark:hover:border-gray-600/40 dark:hover:bg-gray-700/30">
                                      <SelectValue placeholder="Select variant" />
                                    </SelectTrigger>
                                    <SelectContent className="border-white/20 bg-white/90 backdrop-blur-md dark:border-gray-600/30 dark:bg-gray-800/90">
                                      {type.variations?.map(
                                        (variation: {
                                          id: string;
                                          label: string;
                                        }) => (
                                          <SelectItem
                                            key={variation.id}
                                            value={variation.id}
                                            className="text-xs transition-colors hover:bg-blue-100/50 dark:hover:bg-gray-700/50"
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
