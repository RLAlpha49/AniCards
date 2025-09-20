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
}: Readonly<StatCardTypeSelectionProps>) {
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
        <div className="mb-5 rounded-xl bg-green-50/30 p-4 dark:bg-green-950/20">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-2 text-sm text-green-700 dark:text-green-300">
              <span className="text-base">💡</span>
              <span className="font-medium">Tip:</span>
              <span>
                Use the preview button to see how each card will look!
              </span>
            </div>
          </div>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={onSelectAll}
          className="shrink-0 border-blue-200/50 bg-gradient-to-r from-blue-500/10 to-purple-500/10 transition-all duration-300 hover:from-blue-500/20 hover:to-purple-500/20 dark:border-blue-700/50"
          aria-label={
            allSelected ? "Unselect all card types" : "Select all card types"
          }
        >
          {allSelected ? "Unselect All" : "Select All"}
        </Button>
      </div>
      {grouped.order.map((groupName) => (
        <div key={groupName} className="space-y-3">
          <button
            type="button"
            onClick={() => toggleGroup(groupName)}
            className={cn(
              "flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left",
              "text-sm font-semibold tracking-wide text-gray-700 transition-all duration-300 dark:text-gray-300",
              "bg-gradient-to-r from-gray-50 to-gray-100 dark:from-gray-800 dark:to-gray-900",
              "hover:from-blue-50 hover:to-purple-50 dark:hover:from-blue-900/30 dark:hover:to-purple-900/30",
              "border border-gray-200/30 dark:border-gray-700/30",
            )}
            aria-expanded={openGroups[groupName]}
            aria-controls={`group-${groupName}`}
          >
            <span
              className={
                "inline-flex h-4 w-4 items-center justify-center transition-transform duration-300 " +
                (openGroups[groupName] ? "rotate-90" : "rotate-0")
              }
              aria-hidden="true"
            >
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="text-gray-600 dark:text-gray-400"
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
                <div className="grid grid-cols-1 gap-4 px-2 pb-1 pt-4 md:grid-cols-2">
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
                          "flex flex-col items-start space-y-3 rounded-xl p-4",
                          "bg-gradient-to-br from-white to-gray-50 dark:from-gray-800 dark:to-gray-900",
                          "border border-gray-200/50 dark:border-gray-700/50",
                          "transition-all duration-300 hover:scale-[1.02] hover:shadow-lg",
                          "group cursor-pointer hover:border-blue-300/50 dark:hover:border-blue-600/50",
                          "fade-in-up animate-in fill-mode-backwards",
                          selectedCards.includes(type.id)
                            ? "bg-gradient-to-br from-blue-50 to-purple-50 ring-2 ring-blue-500/50 dark:from-blue-900/40 dark:to-purple-900/40"
                            : "",
                        )}
                        style={{ animationDelay: `${index * 50}ms` }}
                      >
                        <div className="flex w-full items-center space-x-3">
                          <Checkbox
                            id={type.id}
                            checked={selectedCards.includes(type.id)}
                            onClick={(e) => e.stopPropagation()}
                            onCheckedChange={() => onToggle(type.id)}
                            className="mt-1 scale-100 transition-all duration-200 checked:scale-110 focus:ring-2 focus:ring-blue-500 group-hover:scale-105"
                          />
                          <div className="flex-grow space-y-2">
                            {supportsFavorites && (
                              <div className="flex items-center gap-2 rounded-lg border border-pink-200/30 bg-pink-50/50 p-2 dark:border-pink-800/30 dark:bg-pink-900/20">
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
                                  className="cursor-pointer text-xs font-medium text-pink-700 dark:text-pink-300"
                                >
                                  Show Favorites
                                </Label>
                                {isFavorite && (
                                  <svg
                                    className="inline-block h-4 w-4 animate-pulse align-middle text-pink-500"
                                    fill="currentColor"
                                    viewBox="0 0 20 20"
                                    aria-label="Favorited"
                                    tabIndex={0}
                                    aria-hidden="false"
                                  >
                                    <title>Favorited</title>
                                    <path d="M3.172 5.172a4 4 0 015.656 0L10 6.343l1.172-1.171a4 4 0 115.656 5.656L10 17.657l-6.828-6.829a4 4 0 010-5.656z" />
                                  </svg>
                                )}
                              </div>
                            )}
                            <div className="space-y-1">
                              <Label
                                htmlFor={type.id}
                                className="text-sm font-semibold leading-none text-gray-800 peer-disabled:cursor-not-allowed peer-disabled:opacity-70 dark:text-gray-200"
                              >
                                {type.label.split(" (")[0]}
                              </Label>
                              {type.label.includes("(") && (
                                <p className="rounded-md bg-gray-100/50 px-2 py-1 text-xs text-gray-600 dark:bg-gray-800/50 dark:text-gray-400">
                                  {(() => {
                                    const start = type.label.indexOf("(");
                                    const end = type.label.indexOf(")", start);
                                    return start !== -1 && end !== -1
                                      ? type.label.substring(start + 1, end)
                                      : "";
                                  })()}
                                </p>
                              )}
                            </div>
                            {type.variations && (
                              <Select
                                value={currentVariation}
                                onValueChange={(value) =>
                                  onVariantChange(type.id, value)
                                }
                              >
                                <SelectTrigger className="h-9 w-full border-gray-300/50 bg-gradient-to-r from-white to-gray-50 transition-colors duration-300 hover:border-blue-400/50 dark:border-gray-600/50 dark:from-gray-700 dark:to-gray-800">
                                  <SelectValue placeholder="Variation" />
                                </SelectTrigger>
                                <SelectContent>
                                  {type.variations.map((variation) => (
                                    <SelectItem
                                      key={variation.id}
                                      value={variation.id}
                                      className="text-sm"
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
                              className="border-blue-200/50 bg-gradient-to-r from-blue-500/10 to-purple-500/10 transition-all duration-300 hover:border-blue-400/50 hover:from-blue-500/20 hover:to-purple-500/20 dark:border-blue-700/50"
                              title={`Preview ${type.label} card`}
                            >
                              <span className="text-xs">👁️</span> Preview
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
