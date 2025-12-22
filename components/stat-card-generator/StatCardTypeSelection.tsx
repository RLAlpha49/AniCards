import { useState, useMemo } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Button } from "@/components/ui/Button";
import { Checkbox } from "@/components/ui/Checkbox";
import { Label } from "@/components/ui/Label";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/Select";
import { cn } from "@/lib/utils";
import {
  LayoutGrid,
  PieChart,
  BarChart,
  List,
  Star,
  Eye,
  CheckCircle2,
} from "lucide-react";

/**
 * Definition for a stat card type used in selection.
 * @property id - Unique string key for the card type.
 * @property label - Human readable label shown in the UI.
 * @property variations - Optional variants available for the card.
 * @property group - Optional group name used to categorize the card.
 * @source
 */
export interface CardType {
  id: string;
  label: string;
  variations?: { id: string; label: string }[];
  group?: string;
}

/**
 * Props for the StatCardTypeSelection component.
 * @property cardTypes - List of available card type definitions.
 * @property selectedCards - IDs of currently selected cards.
 * @property selectedCardVariants - Map of selected variant ids per card type.
 * @property allSelected - Whether all cards are selected.
 * @property onToggle - Toggle the selection state of a card by id.
 * @property onSelectAll - Toggle selecting or unselecting all cards.
 * @property onVariantChange - Change the variant for a card type.
 * @property onPreview - Invoked to preview a specific card type/variant.
 * @property showFavoritesByCard - Map indicating if favorites are shown for each card.
 * @property onToggleShowFavorites - Toggle favorites for a specific card.
 * @source
 */
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

  /**
   * Favorites Grid layout controls (1..5 each).
   * These are owned by the generator context, but the UI should live in the
   * Cards step near the favorites grid card selection.
   */
  favoritesGridColumns?: number;
  favoritesGridRows?: number;
  onFavoritesGridColumnsChange?: (next: number) => void;
  onFavoritesGridRowsChange?: (next: number) => void;
}

/**
 * Card IDs that support the "Favorites" option.
 * @source
 */
const FAVORITE_CARD_IDS = new Set([
  "animeVoiceActors",
  "animeStudios",
  "animeStaff",
  "mangaStaff",
]);

/** Card id for the Favorites Grid card. @source */
const FAVORITES_GRID_CARD_ID = "favoritesGrid";

/**
 * Renders a grouped selection UI with controls for selecting cards, choosing
 * variants and previewing a card type. Groups are calculated from the
 * `group` property on card types and are shown in a tab-like navigation.
 * @param cardTypes - The available card types to display.
 * @param selectedCards - Selected card type ids.
 * @param selectedCardVariants - Map of selected variant ids.
 * @param allSelected - Whether everything is selected.
 * @param onToggle - Toggle an individual card's selected state.
 * @param onSelectAll - Select or unselect all cards.
 * @param onVariantChange - Callback for changing a card's variant.
 * @param onPreview - Callback to request preview for a card type.
 * @param showFavoritesByCard - Map of flags that indicate favorites for each card.
 * @param onToggleShowFavorites - Toggle favorites flag for a card.
 * @returns React element presenting card selection and controls.
 * @source
 */
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
  favoritesGridColumns,
  favoritesGridRows,
  onFavoritesGridColumnsChange,
  onFavoritesGridRowsChange,
}: Readonly<StatCardTypeSelectionProps>) {
  // Group card types by their `group` property while keeping a stable order.
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

  // Default active group is the first group calculated from the card types.
  const [activeGroup, setActiveGroup] = useState<string>(grouped.order[0]);

  // Count selected cards per group
  const groupCounts = useMemo(() => {
    const counts: Record<string, { total: number; selected: number }> = {};
    for (const group of grouped.order) {
      const cards = grouped.map[group] || [];
      counts[group] = {
        total: cards.length,
        selected: cards.filter((c) => selectedCards.includes(c.id)).length,
      };
    }
    return counts;
  }, [grouped, selectedCards]);

  const clampGridDim = (n: number, fallback = 3) => {
    const parsed = Number.isFinite(n) ? Math.trunc(n) : fallback;
    return Math.max(1, Math.min(5, parsed));
  };

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-blue-500 to-indigo-500 shadow-md shadow-blue-500/25">
            <LayoutGrid className="h-5 w-5 text-white" aria-hidden="true" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-slate-900 dark:text-white">
              Select Your Cards
            </h3>
            <p
              className="text-sm text-slate-500 dark:text-slate-400"
              aria-live="polite"
              aria-atomic="true"
            >
              {selectedCards.length} of {cardTypes.length} cards selected
            </p>
          </div>
        </div>
        <Button
          variant={allSelected ? "default" : "outline"}
          size="sm"
          onClick={onSelectAll}
          aria-label={allSelected ? "Unselect all cards" : "Select all cards"}
          className={cn(
            "gap-2 rounded-full px-4 font-medium transition-all focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500",
            allSelected
              ? "bg-slate-900 text-white shadow-md hover:bg-slate-800 dark:bg-white dark:text-slate-900 dark:hover:bg-slate-100"
              : "border-slate-200/50 bg-white text-slate-600 hover:bg-slate-50 hover:shadow-md dark:border-slate-700/50 dark:bg-slate-800 dark:text-slate-400 dark:hover:bg-slate-700",
          )}
        >
          <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
          {allSelected ? "Unselect All" : "Select All"}
        </Button>
      </div>

      {/* Group Navigation */}
      <nav
        className="flex flex-wrap gap-2 border-b border-slate-200/50 pb-4 dark:border-slate-700/50"
        aria-label="Card category tabs"
      >
        {grouped.order.map((group) => {
          const { selected, total } = groupCounts[group];
          const isActive = activeGroup === group;

          return (
            <button
              key={group}
              onClick={() => setActiveGroup(group)}
              role="tab"
              aria-selected={isActive}
              aria-label={`${group} category, ${selected} of ${total} cards selected`}
              className={cn(
                "group flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium transition-all focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500",
                isActive
                  ? "bg-slate-900 text-white shadow-lg dark:bg-white dark:text-slate-900"
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200 hover:shadow-md dark:bg-slate-800 dark:text-slate-400 dark:hover:bg-slate-700",
              )}
            >
              {group}
              <span
                className={cn(
                  "rounded-full px-1.5 py-0.5 text-[10px] font-bold transition-all",
                  isActive
                    ? "bg-white/20 text-white dark:bg-slate-900/30 dark:text-slate-900"
                    : "bg-slate-200 text-slate-500 dark:bg-slate-700 dark:text-slate-400",
                  selected > 0 &&
                    !isActive &&
                    "bg-blue-100 text-blue-600 dark:bg-blue-900/50 dark:text-blue-400",
                )}
                aria-hidden="true"
              >
                {selected}/{total}
              </span>
            </button>
          );
        })}
      </nav>

      {/* Cards Grid */}
      <div className="min-h-[400px]">
        <AnimatePresence mode="wait">
          <motion.div
            key={activeGroup}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2 }}
            className="grid grid-cols-1 gap-3 md:grid-cols-2"
          >
            {grouped.map[activeGroup]?.map((type, index) => {
              const isSelected = selectedCards.includes(type.id);
              const currentVariation = (() => {
                const selected = selectedCardVariants[type.id];
                if (
                  selected &&
                  type.variations?.some((v) => v.id === selected)
                ) {
                  return selected;
                }
                return type.variations?.[0]?.id ?? "";
              })();
              const supportsFavorites = FAVORITE_CARD_IDS.has(type.id);
              const isFavorite = showFavoritesByCard[type.id];
              const isFavoritesGrid = type.id === FAVORITES_GRID_CARD_ID;

              // Extract optional parenthetical part from the label for an explanatory subtitle.
              const openParenIndex = type.label.indexOf("(");
              const closeParenIndex =
                openParenIndex >= 0
                  ? type.label.indexOf(")", openParenIndex + 1)
                  : -1;
              const labelTextInParens =
                openParenIndex >= 0 && closeParenIndex >= 0
                  ? type.label.slice(openParenIndex + 1, closeParenIndex)
                  : undefined;

              let VariationIcon = List;
              if (currentVariation === "pie") VariationIcon = PieChart;
              else if (currentVariation === "donut") VariationIcon = PieChart;
              else if (currentVariation === "bar") VariationIcon = BarChart;

              const gridColsValue = clampGridDim(favoritesGridColumns ?? 3, 3);
              const gridRowsValue = clampGridDim(favoritesGridRows ?? 3, 3);
              const gridControlsEnabled =
                isFavoritesGrid &&
                isSelected &&
                typeof onFavoritesGridColumnsChange === "function" &&
                typeof onFavoritesGridRowsChange === "function";

              const adjustGridCols = (delta: number) => {
                if (!gridControlsEnabled) return;
                const next = clampGridDim(gridColsValue + delta, 3);
                onFavoritesGridColumnsChange?.(next);
              };

              const adjustGridRows = (delta: number) => {
                if (!gridControlsEnabled) return;
                const next = clampGridDim(gridRowsValue + delta, 3);
                onFavoritesGridRowsChange?.(next);
              };

              return (
                <motion.div
                  key={type.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.2, delay: index * 0.03 }}
                  className={cn(
                    "group relative flex flex-col gap-3 rounded-2xl border-2 p-4 transition-all duration-200",
                    isSelected
                      ? "border-blue-400 bg-gradient-to-br from-blue-50 via-white to-indigo-50/50 shadow-lg shadow-blue-500/10 dark:border-blue-500/50 dark:from-blue-950/30 dark:via-slate-900 dark:to-indigo-950/20"
                      : "border-transparent bg-white shadow-sm hover:border-slate-200 hover:shadow-md dark:bg-slate-800/80 dark:hover:border-slate-700",
                  )}
                >
                  {/* Selection Indicator */}
                  {isSelected && (
                    <div className="absolute -right-1 -top-1">
                      <div className="flex h-6 w-6 items-center justify-center rounded-full bg-blue-500 shadow-md">
                        <CheckCircle2 className="h-4 w-4 text-white" />
                      </div>
                    </div>
                  )}

                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-3">
                      <Checkbox
                        checked={isSelected}
                        onCheckedChange={() => onToggle(type.id)}
                        className={cn(
                          "mt-1 h-5 w-5 rounded-md border-2 transition-all",
                          isSelected
                            ? "border-blue-500 bg-blue-500 text-white"
                            : "border-slate-300 dark:border-slate-600",
                        )}
                      />
                      <div className="space-y-1">
                        <Label className="cursor-pointer text-base font-semibold leading-tight text-slate-900 dark:text-white">
                          {type.label.split(" (")[0]}
                        </Label>
                        {type.label.includes("(") && labelTextInParens && (
                          <p className="text-xs text-slate-500 dark:text-slate-400">
                            {labelTextInParens}
                          </p>
                        )}
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className={cn(
                        "h-8 w-8 shrink-0 rounded-lg transition-all",
                        "text-slate-400 hover:bg-blue-50 hover:text-blue-600 dark:hover:bg-blue-900/30 dark:hover:text-blue-400",
                      )}
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
                  {(type.variations ||
                    supportsFavorites ||
                    isFavoritesGrid) && (
                    <div className="mt-auto flex flex-wrap items-center gap-3 border-t border-slate-100 pt-3 dark:border-slate-700/50">
                      {type.variations && (
                        <div className="min-w-[130px] flex-1">
                          <Select
                            value={currentVariation}
                            onValueChange={(value) =>
                              onVariantChange(type.id, value)
                            }
                          >
                            <SelectTrigger className="h-9 rounded-lg border-slate-200/50 bg-slate-50 text-sm font-medium shadow-sm dark:border-slate-700/50 dark:bg-slate-900">
                              <div className="flex items-center gap-2">
                                <VariationIcon className="h-3.5 w-3.5 text-slate-400" />
                                <SelectValue />
                              </div>
                            </SelectTrigger>
                            <SelectContent className="rounded-xl border-slate-200/50 bg-white/95 shadow-lg backdrop-blur-sm dark:border-slate-700/50 dark:bg-slate-900/95">
                              {type.variations.map((v) => (
                                <SelectItem
                                  key={v.id}
                                  value={v.id}
                                  className="rounded-lg text-sm"
                                >
                                  {v.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      )}

                      {supportsFavorites && (
                        <div className="flex items-center gap-2 rounded-lg bg-amber-50/80 px-3 py-1.5 dark:bg-amber-900/20">
                          <Checkbox
                            id={`fav-${type.id}`}
                            checked={isFavorite}
                            onCheckedChange={() =>
                              onToggleShowFavorites(type.id)
                            }
                            className={cn(
                              "h-4 w-4 rounded border-amber-300 transition-all",
                              isFavorite && "border-amber-500 bg-amber-500",
                            )}
                          />
                          <Label
                            htmlFor={`fav-${type.id}`}
                            className="flex cursor-pointer items-center gap-1.5 text-xs font-medium text-amber-700 dark:text-amber-400"
                          >
                            <Star
                              className={cn(
                                "h-3.5 w-3.5 transition-all",
                                isFavorite
                                  ? "fill-amber-400 text-amber-400"
                                  : "text-amber-400/50",
                              )}
                            />
                            Show Favorites
                          </Label>
                        </div>
                      )}

                      {isFavoritesGrid && (
                        <div
                          className={cn(
                            "flex flex-wrap items-center gap-3 rounded-xl border border-indigo-200/70 bg-indigo-50 px-4 py-2 shadow-sm dark:border-indigo-500/30 dark:bg-indigo-950/50",
                            !gridControlsEnabled && "opacity-70",
                          )}
                          aria-label="Favorites Grid layout"
                        >
                          <Label className="text-sm font-semibold text-indigo-800 dark:text-indigo-200">
                            Grid (cols×rows)
                          </Label>

                          {/* Columns stepper */}
                          <div className="flex items-center gap-1.5">
                            <Button
                              type="button"
                              variant="outline"
                              size="icon"
                              disabled={
                                !gridControlsEnabled || gridColsValue <= 1
                              }
                              onClick={(e) => {
                                e.stopPropagation();
                                adjustGridCols(-1);
                              }}
                              className="h-8 w-8 rounded-lg border-indigo-200 bg-white text-slate-900 shadow-sm ring-offset-0 transition hover:bg-indigo-50 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-indigo-500 disabled:cursor-not-allowed disabled:opacity-60 dark:border-indigo-500/50 dark:bg-slate-900 dark:text-slate-100 dark:hover:bg-indigo-900/40"
                              aria-label="Decrease grid columns"
                            >
                              -
                            </Button>
                            <span
                              className="min-w-[1.75rem] rounded-md bg-white/60 px-2 py-1 text-center text-xs font-bold text-slate-900 shadow-sm dark:bg-slate-900/60 dark:text-slate-50"
                              aria-label="Grid columns value"
                            >
                              {gridColsValue}
                            </span>
                            <Button
                              type="button"
                              variant="outline"
                              size="icon"
                              disabled={
                                !gridControlsEnabled || gridColsValue >= 5
                              }
                              onClick={(e) => {
                                e.stopPropagation();
                                adjustGridCols(1);
                              }}
                              className="h-8 w-8 rounded-lg border-indigo-200 bg-white text-slate-900 shadow-sm ring-offset-0 transition hover:bg-indigo-50 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-indigo-500 disabled:cursor-not-allowed disabled:opacity-60 dark:border-indigo-500/50 dark:bg-slate-900 dark:text-slate-100 dark:hover:bg-indigo-900/40"
                              aria-label="Increase grid columns"
                            >
                              +
                            </Button>
                          </div>

                          <span className="mx-1 text-sm font-bold text-indigo-500 dark:text-indigo-300">
                            ×
                          </span>

                          {/* Rows stepper */}
                          <div className="flex items-center gap-1.5">
                            <Button
                              type="button"
                              variant="outline"
                              size="icon"
                              disabled={
                                !gridControlsEnabled || gridRowsValue <= 1
                              }
                              onClick={(e) => {
                                e.stopPropagation();
                                adjustGridRows(-1);
                              }}
                              className="h-8 w-8 rounded-lg border-indigo-200 bg-white text-slate-900 shadow-sm ring-offset-0 transition hover:bg-indigo-50 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-indigo-500 disabled:cursor-not-allowed disabled:opacity-60 dark:border-indigo-500/50 dark:bg-slate-900 dark:text-slate-100 dark:hover:bg-indigo-900/40"
                              aria-label="Decrease grid rows"
                            >
                              -
                            </Button>
                            <span
                              className="min-w-[1.75rem] rounded-md bg-white/60 px-2 py-1 text-center text-xs font-bold text-slate-900 shadow-sm dark:bg-slate-900/60 dark:text-slate-50"
                              aria-label="Grid rows value"
                            >
                              {gridRowsValue}
                            </span>
                            <Button
                              type="button"
                              variant="outline"
                              size="icon"
                              disabled={
                                !gridControlsEnabled || gridRowsValue >= 5
                              }
                              onClick={(e) => {
                                e.stopPropagation();
                                adjustGridRows(1);
                              }}
                              className="h-8 w-8 rounded-lg border-indigo-200 bg-white text-slate-900 shadow-sm ring-offset-0 transition hover:bg-indigo-50 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-indigo-500 disabled:cursor-not-allowed disabled:opacity-60 dark:border-indigo-500/50 dark:bg-slate-900 dark:text-slate-100 dark:hover:bg-indigo-900/40"
                              aria-label="Increase grid rows"
                            >
                              +
                            </Button>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </motion.div>
              );
            })}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}
