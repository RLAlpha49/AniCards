import React, { useMemo, useState } from "react";
import { AnimatePresence, motion as m, motion } from "framer-motion";

import { Label } from "@/components/ui/Label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/Select";
import { Button } from "@/components/ui/Button";
import { Checkbox } from "@/components/ui/Checkbox";
import { statCardTypes } from "@/components/StatCardGenerator";
import {
  Layers,
  ChevronDown,
  Heart,
  Lightbulb,
  Tv,
  BookOpen,
  Users,
  LayoutGrid,
} from "lucide-react";

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
 * Group icons mapping.
 * @source
 */
const GROUP_ICONS: Record<string, React.ElementType> = {
  Anime: Tv,
  Manga: BookOpen,
  User: Users,
  Other: LayoutGrid,
};

/**
 * Group colors for visual distinction.
 * @source
 */
const GROUP_COLORS: Record<
  string,
  { gradient: string; bg: string; text: string }
> = {
  Anime: {
    gradient: "from-blue-500 to-cyan-500",
    bg: "bg-blue-50 dark:bg-blue-900/20",
    text: "text-blue-600 dark:text-blue-400",
  },
  Manga: {
    gradient: "from-pink-500 to-rose-500",
    bg: "bg-pink-50 dark:bg-pink-900/20",
    text: "text-pink-600 dark:text-pink-400",
  },
  User: {
    gradient: "from-purple-500 to-violet-500",
    bg: "bg-purple-50 dark:bg-purple-900/20",
    text: "text-purple-600 dark:text-purple-400",
  },
  Other: {
    gradient: "from-slate-500 to-slate-600",
    bg: "bg-slate-50 dark:bg-slate-800/50",
    text: "text-slate-600 dark:text-slate-400",
  },
};

/**
 * Props for the DefaultCardSettings component.
 * @property defaultCardTypes - IDs of card types enabled by default.
 * @property defaultVariants - Mapping from card type ID to default variant ID.
 * @property onToggleCardType - Toggle handler for single card type selection changes.
 * @property onToggleAllCardTypes - Toggles all card types on or off.
 * @property onVariantChange - Handler to change the default variant for a card type.
 * @property defaultShowFavoritesByCard - Default 'show favorites' flags per card ID.
 * @property onToggleShowFavoritesDefault - Toggle handler for the 'show favorites' default per card.
 * @source
 */
interface DefaultCardSettingsProps {
  defaultCardTypes: string[];
  defaultVariants: Record<string, string>;
  onToggleCardType: (cardType: string) => void;
  onToggleAllCardTypes: () => void;
  onVariantChange: (cardType: string, variant: string) => void;
  defaultShowFavoritesByCard: Record<string, boolean>;
  onToggleShowFavoritesDefault: (cardId: string) => void;
}

/**
 * Renders the default card settings pane used to configure which stat card types
 * and variants are enabled by default. Color and border persistence is handled
 * through the card generator workflow mentioned in the tip above.
 * @param defaultCardTypes - List of card type ids currently enabled by default.
 * @param defaultVariants - Mapping of card type id to the selected variant id.
 * @param onToggleCardType - Toggles a single card type's default enabled state.
 * @param onToggleAllCardTypes - Toggle to select or unselect all card types.
 * @param onVariantChange - Change handler to set the default variant for a card type.
 * @param defaultShowFavoritesByCard - Default preferences to show favorites per card id.
 * @param onToggleShowFavoritesDefault - Toggle handler to change the default show favorites setting.
 * @returns A React component with interactive default card settings.
 * @source
 */
export function DefaultCardSettings({
  defaultCardTypes,
  defaultVariants,
  onToggleCardType,
  onToggleAllCardTypes,
  onVariantChange,
  defaultShowFavoritesByCard,
  onToggleShowFavoritesDefault,
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

  // Count selected cards per group
  const groupCounts = useMemo(() => {
    const counts: Record<string, { selected: number; total: number }> = {};
    for (const [group, types] of Object.entries(groups.map)) {
      counts[group] = {
        selected: types.filter((t) => defaultCardTypes.includes(t.id)).length,
        total: types.length,
      };
    }
    return counts;
  }, [groups.map, defaultCardTypes]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.5 }}
    >
      <div className="overflow-hidden rounded-3xl border border-slate-200/50 bg-gradient-to-br from-white/80 via-white/60 to-slate-100/80 shadow-xl shadow-slate-200/50 backdrop-blur-xl dark:border-slate-700/50 dark:from-slate-800/80 dark:via-slate-800/60 dark:to-slate-900/80 dark:shadow-slate-900/50">
        {/* Header */}
        <div className="border-b border-slate-200/50 bg-white/50 p-6 dark:border-slate-700/50 dark:bg-slate-800/50">
          <div className="flex items-center gap-4">
            <div className="rounded-2xl bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500 p-3.5 shadow-lg shadow-purple-500/25">
              <Layers className="h-6 w-6 text-white" />
            </div>
            <div className="flex-1">
              <h3 className="text-xl font-bold text-slate-900 dark:text-white">
                Default Card Settings
              </h3>
              <p className="text-sm text-slate-500 dark:text-slate-400">
                Configure default card types and styling for new generations
              </p>
            </div>
            <div className="hidden rounded-full bg-slate-100 px-4 py-2 text-sm font-medium text-slate-600 dark:bg-slate-800 dark:text-slate-300 sm:block">
              {defaultCardTypes.length} / {statCardTypes.length} selected
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="p-6">
          {/* Tip Banner */}
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-8 flex items-start gap-3 rounded-2xl border border-blue-200/50 bg-gradient-to-r from-blue-50 to-cyan-50 p-4 dark:border-blue-800/30 dark:from-blue-900/20 dark:to-cyan-900/20"
          >
            <div className="flex-shrink-0 rounded-lg bg-blue-100 p-2 dark:bg-blue-900/50">
              <Lightbulb className="h-4 w-4 text-blue-600 dark:text-blue-400" />
            </div>
            <div className="space-y-1 text-sm text-blue-700 dark:text-blue-300">
              <p>
                <strong>Tip:</strong> Color and border selections are
                automatically preserved when you customize them inside the card
                generator, leaving the chosen preset, colors, and frame styles
                waiting for your next visit.
              </p>
            </div>
          </motion.div>

          {/* Card Types Section */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <LayoutGrid className="h-5 w-5 text-slate-500 dark:text-slate-400" />
                <Label className="text-base font-semibold text-slate-900 dark:text-white">
                  Default Card Types
                </Label>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={onToggleAllCardTypes}
                className="rounded-full border-indigo-200 bg-indigo-50/50 text-indigo-600 hover:border-indigo-300 hover:bg-indigo-100 dark:border-indigo-800 dark:bg-indigo-900/20 dark:text-indigo-400 dark:hover:border-indigo-700 dark:hover:bg-indigo-900/30"
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
              {groups.order.map((group) => {
                const GroupIcon = GROUP_ICONS[group] || LayoutGrid;
                const colors = GROUP_COLORS[group] || GROUP_COLORS.Other;
                const counts = groupCounts[group];

                return (
                  <motion.div
                    key={group}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="overflow-hidden rounded-2xl border border-slate-200/50 bg-white/50 shadow-sm transition-shadow hover:shadow-md dark:border-slate-700/50 dark:bg-slate-800/50"
                  >
                    <button
                      type="button"
                      onClick={() => toggle(group)}
                      className={`group flex w-full items-center justify-between px-5 py-4 text-left transition-colors ${
                        openGroups[group]
                          ? "border-b border-slate-200/50 bg-white dark:border-slate-700/50 dark:bg-slate-800"
                          : "bg-slate-50/50 hover:bg-slate-100/50 dark:bg-slate-800/30 dark:hover:bg-slate-800/50"
                      }`}
                      aria-expanded={openGroups[group]}
                      aria-controls={`default-group-${group}`}
                    >
                      <div className="flex items-center gap-3">
                        <div
                          className={`rounded-xl bg-gradient-to-br ${colors.gradient} p-2.5 shadow-md`}
                        >
                          <GroupIcon className="h-5 w-5 text-white" />
                        </div>
                        <div>
                          <span className="font-semibold text-slate-900 dark:text-white">
                            {group}
                          </span>
                          <span
                            className={`ml-3 rounded-full px-2.5 py-0.5 text-xs font-medium ${colors.bg} ${colors.text}`}
                          >
                            {counts.selected}/{counts.total}
                          </span>
                        </div>
                      </div>
                      <motion.div
                        animate={{ rotate: openGroups[group] ? 180 : 0 }}
                        transition={{ duration: 0.2 }}
                        className="rounded-full bg-slate-100 p-1.5 dark:bg-slate-700"
                      >
                        <ChevronDown className="h-4 w-4 text-slate-500" />
                      </motion.div>
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
                          transition={{
                            duration: 0.28,
                            ease: [0.4, 0, 0.2, 1],
                          }}
                        >
                          <div className="bg-slate-50/50 p-4 dark:bg-slate-900/30">
                            <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
                              {groups.map[group].map((type) => {
                                const hasVariants =
                                  type.variations && type.variations.length > 0;
                                const currentVariant =
                                  defaultVariants[type.id] || "default";
                                const isSelected = defaultCardTypes.includes(
                                  type.id,
                                );

                                return (
                                  <motion.div
                                    key={type.id}
                                    whileHover={{ scale: 1.01 }}
                                    className={`rounded-xl border-2 p-4 transition-all ${
                                      isSelected
                                        ? "border-indigo-300 bg-gradient-to-br from-indigo-50 to-purple-50 shadow-md shadow-indigo-100 dark:border-indigo-600 dark:from-indigo-900/30 dark:to-purple-900/30 dark:shadow-indigo-900/20"
                                        : "border-slate-200 bg-white hover:border-slate-300 hover:shadow-sm dark:border-slate-700 dark:bg-slate-800 dark:hover:border-slate-600"
                                    }`}
                                  >
                                    <div className="flex items-start gap-3">
                                      <Checkbox
                                        id={type.id}
                                        checked={isSelected}
                                        onCheckedChange={() =>
                                          onToggleCardType(type.id)
                                        }
                                        className="mt-0.5 border-slate-300 data-[state=checked]:border-indigo-600 data-[state=checked]:bg-indigo-600 dark:border-slate-600 dark:data-[state=checked]:bg-indigo-500"
                                      />
                                      <div className="flex-1 space-y-3">
                                        <Label
                                          htmlFor={type.id}
                                          className={`cursor-pointer font-medium ${
                                            isSelected
                                              ? "text-indigo-700 dark:text-indigo-300"
                                              : "text-slate-900 dark:text-white"
                                          }`}
                                        >
                                          {type.label.split(" (")[0]}
                                        </Label>

                                        {/* Show Favorites default toggle for eligible cards */}
                                        {FAVORITE_CARD_IDS.has(type.id) &&
                                          isSelected && (
                                            <motion.div
                                              initial={{ opacity: 0, y: -5 }}
                                              animate={{ opacity: 1, y: 0 }}
                                              className="flex items-center gap-2 rounded-lg border border-pink-200 bg-pink-50 px-3 py-2 dark:border-pink-800 dark:bg-pink-900/20"
                                            >
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
                                              <Heart className="h-3.5 w-3.5 text-pink-500" />
                                              <Label
                                                htmlFor={`default-show-favorites-${type.id}`}
                                                className="cursor-pointer text-xs font-medium text-pink-700 dark:text-pink-300"
                                              >
                                                Show Favorites
                                              </Label>
                                            </motion.div>
                                          )}

                                        {/* Variant Selection */}
                                        {hasVariants && isSelected && (
                                          <motion.div
                                            initial={{ opacity: 0, y: -5 }}
                                            animate={{ opacity: 1, y: 0 }}
                                          >
                                            <Select
                                              value={currentVariant}
                                              onValueChange={(value) =>
                                                onVariantChange(type.id, value)
                                              }
                                            >
                                              <SelectTrigger className="h-9 w-full rounded-lg border-slate-200 bg-white text-xs shadow-sm transition-all hover:border-indigo-300 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/20 dark:border-slate-700 dark:bg-slate-900 dark:hover:border-indigo-600">
                                                <SelectValue placeholder="Select variant" />
                                              </SelectTrigger>
                                              <SelectContent className="rounded-xl border-slate-200 bg-white/95 shadow-lg backdrop-blur-xl dark:border-slate-700 dark:bg-slate-900/95">
                                                {type.variations?.map(
                                                  (variation: {
                                                    id: string;
                                                    label: string;
                                                  }) => (
                                                    <SelectItem
                                                      key={variation.id}
                                                      value={variation.id}
                                                      className="cursor-pointer rounded-lg text-xs focus:bg-indigo-50 dark:focus:bg-slate-800"
                                                    >
                                                      {variation.label}
                                                    </SelectItem>
                                                  ),
                                                )}
                                              </SelectContent>
                                            </Select>
                                          </motion.div>
                                        )}
                                      </div>
                                    </div>
                                  </motion.div>
                                );
                              })}
                            </div>
                          </div>
                        </m.div>
                      )}
                    </AnimatePresence>
                  </motion.div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
