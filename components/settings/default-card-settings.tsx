import React, { useMemo, useState, useCallback } from "react";
import { AnimatePresence, motion as m, motion } from "framer-motion";

import { Switch } from "@/components/ui/switch";
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
import { ColorPickerGroup } from "@/components/stat-card-generator/color-picker-group";
import { DEFAULT_BORDER_COLOR } from "@/lib/data";
import type { ColorValue } from "@/lib/types/card";
import { isGradient } from "@/lib/utils";

/**
 * Set of card type IDs that support the "Show Favorites" option.
 * Only the IDs present here will render the default 'Show Favorites' toggle in settings.
 * @source
 */
const FAVORITE_CARD_IDS = new Set([
  "animeVoiceActors",
  "animeStudios",
  "animeStaff",
  "mangaStaff",
]);

/**
 * Props for the DefaultCardSettings component.
 * @property defaultPreset - Currently selected color preset ID.
 * @property onPresetChange - Called when the selected preset changes.
 * @property defaultCardTypes - IDs of card types enabled by default.
 * @property defaultVariants - Mapping from card type ID to default variant ID.
 * @property onToggleCardType - Toggle handler for single card type selection changes.
 * @property onToggleAllCardTypes - Toggles all card types on or off.
 * @property onVariantChange - Handler to change the default variant for a card type.
 * @property defaultShowFavoritesByCard - Default 'show favorites' flags per card ID.
 * @property onToggleShowFavoritesDefault - Toggle handler for the 'show favorites' default per card.
 * @property defaultBorderEnabled - Whether borders are enabled by default for generated cards.
 * @property defaultBorderColor - Default border color used when borders are enabled.
 * @property onBorderEnabledChange - Handler to toggle default border enabled state.
 * @property onBorderColorChange - Handler to update default border color.
 * @source
 */
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
  defaultBorderEnabled: boolean;
  defaultBorderColor: string;
  onBorderEnabledChange: (value: boolean) => void;
  onBorderColorChange: (color: string) => void;
}

/**
 * Renders the default card settings pane used to configure presets and card defaults.
 * This includes color presets, border defaults, and which stat card types/variants are enabled by default.
 * @param defaultPreset - The currently selected color preset id.
 * @param onPresetChange - Callback invoked when the preset selection changes.
 * @param defaultCardTypes - List of card type ids currently enabled by default.
 * @param defaultVariants - Mapping of card type id to the selected variant id.
 * @param onToggleCardType - Toggles a single card type's default enabled state.
 * @param onToggleAllCardTypes - Toggle to select or unselect all card types.
 * @param onVariantChange - Change handler to set the default variant for a card type.
 * @param defaultShowFavoritesByCard - Default preferences to show favorites per card id.
 * @param onToggleShowFavoritesDefault - Toggle handler to change the default show favorites setting.
 * @param defaultBorderEnabled - Whether a border is enabled by default.
 * @param defaultBorderColor - Color used for the default border when enabled.
 * @param onBorderEnabledChange - Callback to change the default border enabled state.
 * @param onBorderColorChange - Callback to change the default border color.
 * @returns A React component with interactive default card settings.
 * @source
 */
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
  defaultBorderEnabled,
  defaultBorderColor,
  onBorderEnabledChange,
  onBorderColorChange,
}: Readonly<DefaultCardSettingsProps>) {
  // Group stat card types by 'group' to present them in stable, ordered sections.
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

  // Track expansion state for each group; default to expanded for all groups.
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>(() => {
    const initial: Record<string, boolean> = {};
    for (const g of groups.order) {
      initial[g] = true;
    }
    return initial;
  });
  /**
   * Toggle expansion state for a given group name.
   * @param g - The group name to toggle.
   * @source
   */
  const toggle = (g: string) => setOpenGroups((o) => ({ ...o, [g]: !o[g] }));

  /**
   * Wrapper for border color change that handles ColorValue type.
   * Border only supports solid colors, so gradients are converted to their first stop.
   * @source
   */
  const handleBorderColorChange = useCallback(
    (value: ColorValue) => {
      if (isGradient(value)) {
        // Border only supports solid colors, use first stop
        onBorderColorChange(value.stops[0]?.color ?? DEFAULT_BORDER_COLOR);
      } else {
        onBorderColorChange(value);
      }
    },
    [onBorderColorChange],
  );

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

        <div className="mb-8 space-y-3">
          <Label className="text-base font-semibold text-slate-900 dark:text-white">
            Card Border Defaults
          </Label>
          <div className="rounded-2xl border border-slate-200 bg-slate-50/90 p-4 transition-colors dark:border-slate-700 dark:bg-slate-900/70">
            <div className="flex items-center justify-between gap-4">
              <div>
                <Label className="text-sm font-medium text-slate-900 dark:text-white">
                  Include a border by default
                </Label>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Generate cards with a subtle frame and your chosen color.
                </p>
              </div>
              <Switch
                checked={defaultBorderEnabled}
                onCheckedChange={onBorderEnabledChange}
                className="border-slate-300 bg-white dark:border-slate-700 dark:bg-slate-800"
              />
            </div>
            {defaultBorderEnabled && (
              <div className="mt-4 rounded-xl border border-slate-200 bg-white/80 p-3 dark:border-slate-700 dark:bg-slate-900/80">
                <ColorPickerGroup
                  pickers={[
                    {
                      id: "default-border-color",
                      label: "Border color",
                      value: defaultBorderColor || DEFAULT_BORDER_COLOR,
                      onChange: handleBorderColorChange,
                    },
                  ]}
                />
              </div>
            )}
          </div>
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

          <div className="space-y-4">
            {groups.order.map((group) => (
              <div
                key={group}
                className="overflow-hidden rounded-xl border border-slate-200 bg-slate-50/30 transition-all dark:border-slate-700 dark:bg-slate-800/30"
              >
                <button
                  type="button"
                  onClick={() => toggle(group)}
                  className={`group flex w-full items-center justify-between rounded-t-xl px-4 py-3 text-left text-slate-900 transition-colors hover:bg-slate-100/50 dark:hover:bg-slate-800/50 ${
                    openGroups[group]
                      ? "border-b border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900/70"
                      : "bg-slate-50/90 dark:bg-slate-800/70"
                  }`}
                  aria-expanded={openGroups[group]}
                  aria-controls={`default-group-${group}`}
                >
                  <div className="flex items-center gap-3">
                    <div
                      className={`rounded-lg p-1.5 transition-colors ${
                        openGroups[group]
                          ? "bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400"
                          : "bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400"
                      }`}
                    >
                      <svg
                        width="16"
                        height="16"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        {group === "Anime" && (
                          <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
                        )}
                        {group === "Manga" && (
                          <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
                        )}
                        {group === "User" && (
                          <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                        )}
                        {group === "Other" && (
                          <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
                        )}
                        {!["Anime", "Manga", "User", "Other"].includes(
                          group,
                        ) && <path d="M4 6h16M4 10h16M4 14h16M4 18h16" />}
                      </svg>
                    </div>
                    <span className="font-semibold text-slate-900 dark:text-white">
                      {group}
                    </span>
                  </div>
                  <div className="flex flex-col items-end text-xs text-slate-500 dark:text-slate-400">
                    <div
                      className={`transition-transform duration-200 ${
                        openGroups[group] ? "rotate-180" : "rotate-0"
                      }`}
                    >
                      <svg
                        width="20"
                        height="20"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        className="text-slate-400"
                      >
                        <path d="M6 9l6 6 6-6" />
                      </svg>
                    </div>
                  </div>
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
                    >
                      <div className="rounded-b-xl bg-white/90 px-4 py-4 shadow-inner transition-colors dark:bg-slate-900/80">
                        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                          {groups.map[group].map((type) => {
                            const hasVariants =
                              type.variations && type.variations.length > 0;
                            const currentVariant =
                              defaultVariants[type.id] || "default";
                            const isSelected = defaultCardTypes.includes(
                              type.id,
                            );

                            return (
                              <div
                                key={type.id}
                                className={`rounded-xl border p-3 transition-all ${
                                  isSelected
                                    ? "border-blue-200 bg-blue-50/50 dark:border-blue-800 dark:bg-blue-900/20"
                                    : "border-slate-200 bg-white hover:border-blue-200 hover:shadow-sm dark:border-slate-700 dark:bg-slate-800 dark:hover:border-blue-800"
                                }`}
                              >
                                <div className="flex items-start gap-3">
                                  <Checkbox
                                    id={type.id}
                                    checked={isSelected}
                                    onCheckedChange={() =>
                                      onToggleCardType(type.id)
                                    }
                                    className="mt-1 border-slate-300 data-[state=checked]:border-blue-600 data-[state=checked]:bg-blue-600 dark:border-slate-600 dark:data-[state=checked]:bg-blue-500"
                                  />
                                  <div className="flex-1 space-y-3">
                                    <Label
                                      htmlFor={type.id}
                                      className="cursor-pointer font-medium text-slate-900 dark:text-white"
                                    >
                                      {type.label.split(" (")[0]}
                                    </Label>

                                    {/* Show Favorites default toggle for eligible cards */}
                                    {FAVORITE_CARD_IDS.has(type.id) &&
                                      isSelected && (
                                        <div className="flex items-center gap-2 rounded-lg bg-pink-50 px-2 py-1.5 dark:bg-pink-900/20">
                                          <Checkbox
                                            id={`default-show-favorites-${type.id}`}
                                            checked={
                                              !!defaultShowFavoritesByCard[
                                                type.id
                                              ]
                                            }
                                            onCheckedChange={() =>
                                              onToggleShowFavoritesDefault(
                                                type.id,
                                              )
                                            }
                                            className="h-4 w-4 border-pink-300 data-[state=checked]:border-pink-500 data-[state=checked]:bg-pink-500 dark:border-pink-700 dark:data-[state=checked]:bg-pink-600"
                                          />
                                          <Label
                                            htmlFor={`default-show-favorites-${type.id}`}
                                            className="cursor-pointer text-xs font-medium text-pink-700 dark:text-pink-300"
                                          >
                                            Show Favorites
                                          </Label>
                                        </div>
                                      )}

                                    {/* Variant Selection */}
                                    {hasVariants && isSelected && (
                                      <Select
                                        value={currentVariant}
                                        onValueChange={(value) =>
                                          onVariantChange(type.id, value)
                                        }
                                      >
                                        <SelectTrigger className="h-9 w-full border-slate-200 bg-white text-xs transition-all hover:border-blue-400 focus:border-blue-500 dark:border-slate-700 dark:bg-slate-900 dark:hover:border-blue-500">
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
                                    )}
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
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
