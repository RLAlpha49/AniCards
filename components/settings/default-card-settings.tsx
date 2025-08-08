import React, { useMemo, useState } from "react";
import { AnimatePresence, motion as m } from "framer-motion";
import { motion } from "framer-motion";
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
}: DefaultCardSettingsProps) {
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
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.8 }}
      className="space-y-4"
    >
      <Label className="text-lg font-medium">Default Card Settings</Label>
      <div className="space-y-6 rounded-lg bg-accent/40 p-4">
        <Select value={defaultPreset} onValueChange={onPresetChange}>
          <SelectTrigger className="w-full max-w-[300px] bg-background/60">
            <SelectValue placeholder="Select color preset" />
          </SelectTrigger>
          <SelectContent>
            {Object.keys(colorPresets).map((preset) => (
              <SelectItem key={preset} value={preset}>
                {preset.charAt(0).toUpperCase() + preset.slice(1)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <div className="space-y-2">
          <Label>Default Card Types</Label>
          <div className="mb-2 flex">
            <Button
              variant="outline"
              size="sm"
              onClick={onToggleAllCardTypes}
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
          {groups.order.map((group) => (
            <div key={group} className="space-y-1">
              <button
                type="button"
                onClick={() => toggle(group)}
                className="flex w-full items-center gap-2 px-1 py-1 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground transition hover:text-foreground"
                aria-expanded={openGroups[group]}
                aria-controls={`default-group-${group}`}
              >
                <span
                  className={
                    "inline-flex h-3 w-3 items-center justify-center transition-transform " +
                    (openGroups[group] ? "rotate-90" : "rotate-0")
                  }
                  aria-hidden="true"
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
                    className="text-muted-foreground"
                  >
                    <path d="M9 18l6-6-6-6" />
                  </svg>
                </span>
                <span>{group}</span>
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
                    className="grid grid-cols-1 gap-2 overflow-hidden md:grid-cols-2"
                  >
                    {groups.map[group].map((type) => {
                      const hasVariants =
                        type.variations && type.variations.length > 0;
                      const currentVariant =
                        defaultVariants[type.id] || "default";

                      return (
                        <div key={type.id} className="flex flex-col space-y-2">
                          <div className="flex items-center space-x-2">
                            <Checkbox
                              id={type.id}
                              checked={defaultCardTypes.includes(type.id)}
                              onCheckedChange={() => onToggleCardType(type.id)}
                            />
                            <Label htmlFor={type.id} className="text-sm">
                              {type.label.split(" (")[0]}
                            </Label>
                          </div>
                          {/* Show Favorites default toggle for eligible cards */}
                          {FAVORITE_CARD_IDS.includes(type.id) &&
                            defaultCardTypes.includes(type.id) && (
                              <div className="ml-6 flex items-center space-x-2">
                                <Checkbox
                                  id={`default-show-favorites-${type.id}`}
                                  checked={
                                    !!defaultShowFavoritesByCard[type.id]
                                  }
                                  onCheckedChange={() =>
                                    onToggleShowFavoritesDefault(type.id)
                                  }
                                  aria-label="Default Show Favorites"
                                  tabIndex={0}
                                  className="scale-90 transition-all duration-200 checked:scale-110 focus:ring-2 focus:ring-pink-500"
                                />
                                <Label
                                  htmlFor={`default-show-favorites-${type.id}`}
                                  className="cursor-pointer text-xs"
                                >
                                  Show Favorites by Default
                                </Label>
                              </div>
                            )}
                          {hasVariants &&
                            defaultCardTypes.includes(type.id) && (
                              <Select
                                value={currentVariant}
                                onValueChange={(value) =>
                                  onVariantChange(type.id, value)
                                }
                              >
                                <SelectTrigger className="h-8 w-full bg-background/60">
                                  <SelectValue placeholder="Variant" />
                                </SelectTrigger>
                                <SelectContent>
                                  {type.variations?.map(
                                    (variation: {
                                      id: string;
                                      label: string;
                                    }) => (
                                      <SelectItem
                                        key={variation.id}
                                        value={variation.id}
                                        className="text-xs"
                                      >
                                        {variation.label}
                                      </SelectItem>
                                    ),
                                  )}
                                </SelectContent>
                              </Select>
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
    </motion.div>
  );
}
