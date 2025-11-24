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
import {
  LayoutGrid,
  PieChart,
  BarChart,
  List,
  Star,
  Eye,
  Check,
} from "lucide-react";

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

const FAVORITE_CARD_IDS = new Set([
  "animeVoiceActors",
  "animeStudios",
  "animeStaff",
  "mangaStaff",
]);

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

  const [activeGroup, setActiveGroup] = useState<string>(grouped.order[0]);

  return (
    <div className="space-y-6">
      {/* Header Actions */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400">
            <LayoutGrid className="h-4 w-4" />
          </div>
          <div>
            <h3 className="font-semibold text-gray-900 dark:text-gray-100">
              Available Cards
            </h3>
            <p className="text-xs text-muted-foreground">
              Select the cards you want to generate
            </p>
          </div>
        </div>
        <Button
          variant={allSelected ? "secondary" : "outline"}
          size="sm"
          onClick={onSelectAll}
          className="gap-2"
        >
          <Check className={cn("h-4 w-4", allSelected && "opacity-100")} />
          {allSelected ? "Unselect All" : "Select All"}
        </Button>
      </div>

      {/* Group Navigation */}
      <div className="flex flex-wrap gap-2 border-b border-gray-200 pb-4 dark:border-gray-800">
        {grouped.order.map((group) => (
          <button
            key={group}
            onClick={() => setActiveGroup(group)}
            className={cn(
              "rounded-full px-4 py-1.5 text-sm font-medium transition-all",
              activeGroup === group
                ? "bg-gray-900 text-white shadow-md dark:bg-white dark:text-gray-900"
                : "bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-400 dark:hover:bg-gray-700",
            )}
          >
            {group}
          </button>
        ))}
      </div>

      {/* Cards Grid */}
      <div className="min-h-[400px]">
        <AnimatePresence mode="wait">
          <motion.div
            key={activeGroup}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2 }}
            className="grid grid-cols-1 gap-4 md:grid-cols-2"
          >
            {grouped.map[activeGroup]?.map((type) => {
              const isSelected = selectedCards.includes(type.id);
              const currentVariation =
                selectedCardVariants[type.id] ||
                (type.variations ? "default" : "");
              const supportsFavorites = FAVORITE_CARD_IDS.has(type.id);
              const isFavorite = showFavoritesByCard[type.id];
              const openParenIndex = type.label.indexOf("(");
              const closeParenIndex = openParenIndex >= 0 ? type.label.indexOf(")", openParenIndex + 1) : -1;
              const labelTextInParens =
                openParenIndex >= 0 && closeParenIndex >= 0
                  ? type.label.slice(openParenIndex + 1, closeParenIndex)
                  : undefined;

              let VariationIcon = List;
              if (currentVariation === "pie") VariationIcon = PieChart;
              else if (currentVariation === "bar") VariationIcon = BarChart;

              return (
                <div
                  key={type.id}
                  className={cn(
                    "group relative flex flex-col gap-4 rounded-xl border-2 p-4 transition-all duration-200 hover:shadow-md",
                    isSelected
                      ? "border-blue-500 bg-blue-50/50 dark:border-blue-500/50 dark:bg-blue-900/10"
                      : "border-transparent bg-white hover:border-gray-200 dark:bg-gray-800 dark:hover:border-gray-700",
                  )}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-start gap-3">
                      <Checkbox
                        checked={isSelected}
                        onCheckedChange={() => onToggle(type.id)}
                        className="mt-1"
                      />
                      <div className="space-y-1">
                        <Label className="cursor-pointer text-base font-semibold leading-none">
                          {type.label.split(" (")[0]}
                        </Label>
                        {type.label.includes("(") && labelTextInParens && (
                          <p className="text-xs text-muted-foreground">
                            {labelTextInParens}
                          </p>
                        )}
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 shrink-0 text-muted-foreground hover:text-blue-600"
                      onClick={(e) => {
                        e.stopPropagation();
                        onPreview(type.id, currentVariation);
                      }}
                      title="Preview Card"
                    >
                      <Eye className="h-4 w-4" />
                    </Button>
                  </div>

                  {/* Controls Area */}
                  {(type.variations || supportsFavorites) && (
                    <div className="mt-auto flex flex-wrap items-center gap-3 border-t border-gray-100 pt-3 dark:border-gray-700/50">
                      {type.variations && (
                        <div className="min-w-[120px] flex-1">
                          <Select
                            value={currentVariation}
                            onValueChange={(value) =>
                              onVariantChange(type.id, value)
                            }
                          >
                            <SelectTrigger className="h-8 text-xs">
                              <div className="flex items-center gap-2">
                                <VariationIcon className="h-3 w-3" />
                                <SelectValue />
                              </div>
                            </SelectTrigger>
                            <SelectContent>
                              {type.variations.map((v) => (
                                <SelectItem
                                  key={v.id}
                                  value={v.id}
                                  className="text-xs"
                                >
                                  {v.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      )}

                      {supportsFavorites && (
                        <div className="flex items-center gap-2">
                          <Checkbox
                            id={`fav-${type.id}`}
                            checked={isFavorite}
                            onCheckedChange={() =>
                              onToggleShowFavorites(type.id)
                            }
                            className="h-4 w-4"
                          />
                          <Label
                            htmlFor={`fav-${type.id}`}
                            className="flex cursor-pointer items-center gap-1.5 text-xs font-medium"
                          >
                            <Star
                              className={cn(
                                "h-3 w-3",
                                isFavorite
                                  ? "fill-yellow-400 text-yellow-400"
                                  : "text-muted-foreground",
                              )}
                            />
                            Show Favorites
                          </Label>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}
