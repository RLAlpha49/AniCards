import { useState, useMemo } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

export interface CardType {
  id: string;
  label: string;
  variations?: { id: string; label: string }[];
  group?: string;
}

interface StatCardTypeSelectionProps {
  cardTypes: CardType[];
  selectedCards: string[];
  selectedCardVariants: Record<string, string>;
  allSelected: boolean;
  onToggle: (id: string) => void;
  onSelectAll: () => void;
  onVariantChange: (cardType: string, variant: string) => void;
  onPreview: (cardType: string, variant: string) => void;
  showFavoritesByCard: Record<string, boolean>;
  onToggleShowFavorites: (cardId: string) => void;
}

const FAVORITE_CARD_IDS = [
  "animeVoiceActors",
  "animeStudios",
  "animeStaff",
  "mangaStaff",
];

export function StatCardTypeSelection({
  cardTypes,
  selectedCards,
  selectedCardVariants,
  allSelected,
  onToggle,
  onSelectAll,
  onVariantChange,
  onPreview,
  showFavoritesByCard,
  onToggleShowFavorites,
}: StatCardTypeSelectionProps) {
  const grouped = useMemo(() => {
    return cardTypes.reduce<{
      order: string[];
      map: Record<string, CardType[]>;
    }>(
      (acc, ct) => {
        const g = ct.group || "Other";
        if (!acc.map[g]) {
          acc.map[g] = [];
          acc.order.push(g);
        }
        acc.map[g].push(ct);
        return acc;
      },
      { order: [], map: {} },
    );
  }, [cardTypes]);

  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>(() => {
    const initial: Record<string, boolean> = {};
    grouped.order.forEach((g) => {
      initial[g] = true;
    });
    return initial;
  });

  const toggleGroup = (group: string) =>
    setOpenGroups((o) => ({ ...o, [group]: !o[group] }));

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <Label className="text-lg font-semibold">
          Select Stat Cards to Generate
        </Label>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={onSelectAll}
          aria-label={
            allSelected ? "Unselect all card types" : "Select all card types"
          }
        >
          {allSelected ? "Unselect All" : "Select All"}
        </Button>
      </div>
      {grouped.order.map((groupName) => (
        <div key={groupName} className="space-y-2">
          <button
            type="button"
            onClick={() => toggleGroup(groupName)}
            className={cn(
              "flex w-full items-center gap-2 px-1 py-1 text-left",
              "text-xs font-semibold uppercase tracking-wide text-muted-foreground transition hover:text-foreground",
            )}
            aria-expanded={openGroups[groupName]}
            aria-controls={`group-${groupName}`}
          >
            <span
              className={
                "inline-flex h-3 w-3 items-center justify-center transition-transform " +
                (openGroups[groupName] ? "rotate-90" : "rotate-0")
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
            <span>{groupName}</span>
          </button>
          <AnimatePresence initial={false}>
            {openGroups[groupName] && (
              <motion.div
                key={groupName}
                id={`group-${groupName}`}
                initial="collapsed"
                animate="open"
                exit="collapsed"
                variants={{
                  open: { opacity: 1, height: "auto" },
                  collapsed: { opacity: 0, height: 0 },
                }}
                transition={{ duration: 0.28, ease: [0.4, 0, 0.2, 1] }}
                className="overflow-hidden"
              >
                <div className="grid grid-cols-1 gap-4 pb-1 pl-1 pr-1 pt-4 md:grid-cols-2">
                  {grouped.map[groupName].map((type, index) => {
                    const currentVariation =
                      selectedCardVariants[type.id] ||
                      (type.variations ? "default" : "");
                    const supportsFavorites = FAVORITE_CARD_IDS.includes(
                      type.id,
                    );
                    const isFavorite = showFavoritesByCard[type.id];
                    return (
                      <div
                        key={type.id}
                        className={cn(
                          "flex flex-col items-start space-y-2 rounded-lg bg-secondary/50 p-3",
                          "transition-all duration-300 hover:bg-secondary hover:shadow-lg",
                          "group cursor-pointer hover:-translate-y-1",
                          "fade-in-up animate-in fill-mode-backwards",
                          selectedCards.includes(type.id)
                            ? "ring-2 ring-primary"
                            : "",
                        )}
                        style={{ animationDelay: `${index * 50}ms` }}
                      >
                        <div className="flex w-full items-center space-x-2">
                          <Checkbox
                            id={type.id}
                            checked={selectedCards.includes(type.id)}
                            onClick={(e) => e.stopPropagation()}
                            onCheckedChange={() => onToggle(type.id)}
                            className="mt-1 scale-90 transition-all duration-200 checked:scale-110 focus:ring-2 focus:ring-primary group-hover:scale-100"
                          />
                          <div className="flex-grow space-y-1">
                            {supportsFavorites && (
                              <div className="flex items-center gap-2">
                                <Checkbox
                                  id={`show-favorites-${type.id}`}
                                  checked={!!showFavoritesByCard[type.id]}
                                  onCheckedChange={() =>
                                    onToggleShowFavorites(type.id)
                                  }
                                  aria-label="Show Favorites"
                                  tabIndex={0}
                                  className="scale-90 transition-all duration-200 checked:scale-110 focus:ring-2 focus:ring-pink-500"
                                />
                                <Label
                                  htmlFor={`show-favorites-${type.id}`}
                                  className="cursor-pointer text-xs"
                                >
                                  Show Favorites
                                </Label>
                                {isFavorite && (
                                  <svg
                                    className="inline-block h-4 w-4 align-middle text-pink-500"
                                    fill="currentColor"
                                    viewBox="0 0 20 20"
                                    aria-label="Favorited"
                                    tabIndex={0}
                                    role="img"
                                  >
                                    <title>Favorited</title>
                                    <path d="M3.172 5.172a4 4 0 015.656 0L10 6.343l1.172-1.171a4 4 0 115.656 5.656L10 17.657l-6.828-6.829a4 4 0 010-5.656z" />
                                  </svg>
                                )}
                              </div>
                            )}
                            <Label
                              htmlFor={type.id}
                              className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                            >
                              {type.label.split(" (")[0]}
                            </Label>
                            {type.label.includes("(") && (
                              <p className="text-xs text-gray-600 transition-opacity duration-200 group-hover:opacity-100 dark:text-gray-400">
                                {type.label.match(/\((.*)\)/)?.[1]}
                              </p>
                            )}
                            {type.variations && (
                              <Select
                                value={currentVariation}
                                onValueChange={(value) =>
                                  onVariantChange(type.id, value)
                                }
                              >
                                <SelectTrigger className="h-8 w-[120px] bg-background/60 px-2">
                                  <SelectValue placeholder="Variation" />
                                </SelectTrigger>
                                <SelectContent>
                                  {type.variations.map((variation) => (
                                    <SelectItem
                                      key={variation.id}
                                      value={variation.id}
                                      className="text-xs"
                                    >
                                      {variation.label}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            )}
                          </div>
                          <div className="flex gap-2">
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={(e) => {
                                e.stopPropagation();
                                onPreview(type.id, currentVariation);
                              }}
                              className="scale-90 transition-all duration-200 hover:bg-primary hover:text-primary-foreground group-hover:scale-100"
                              title={`Preview ${type.label} card`}
                            >
                              Preview
                            </Button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      ))}
    </div>
  );
}
