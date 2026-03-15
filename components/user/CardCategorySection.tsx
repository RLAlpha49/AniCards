"use client";

import {
  closestCenter,
  DndContext,
  type DragEndEvent,
  type DraggableAttributes,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  rectSortingStrategy,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { AnimatePresence,motion } from "framer-motion";
import { CheckCircle2, ChevronRight } from "lucide-react";
import {
  memo,
  type ReactElement,
  useCallback,
  useId,
  useMemo,
  useState,
} from "react";

import { VirtualizedCardGrid } from "@/components/user/VirtualizedCardGrid";
import { cn } from "@/lib/utils";

const VIRTUALIZATION_THRESHOLD = 18;

export type CardTileDragHandleProps = {
  attributes: DraggableAttributes;
  // We intentionally keep this loosely typed to avoid depending on dnd-kit internal types.
  // It is safe to spread onto a <button> element.
  listeners?: Record<string, unknown>;
  setActivatorNodeRef: (element: HTMLElement | null) => void;
};

/**
 * Props for CardCategorySection component.
 * @source
 */
export interface CardCategorySectionProps<
  TCard extends { id: string } = { id: string },
> {
  /** Category title */
  title: string;
  /** Number of cards in this category */
  cardCount: number;
  /** Number of enabled cards in this category */
  enabledCount: number;
  /** Category icon component */
  icon?: React.ReactNode;
  /** Whether section is initially expanded */
  defaultExpanded?: boolean;
  /**
   * Controlled expanded state (optional).
   * When provided, the section becomes controlled and relies on `onExpandedChange`.
   */
  expanded?: boolean;
  /** Callback fired when the expanded state should change. */
  onExpandedChange?: (expanded: boolean) => void;
  /** Section content (card tiles) */
  children?: React.ReactNode;

  /** Optional data-driven rendering (enables virtualization). */
  cards?: readonly TCard[];
  renderCard?: (
    card: TCard,
    index: number,
    ctx?: {
      dragHandleProps?: CardTileDragHandleProps;
      isDragging?: boolean;
    },
  ) => React.ReactNode;
  getCardKey?: (card: TCard, index: number) => React.Key;

  /** Force virtualization on/off when `cards` are provided. */
  virtualize?: boolean;

  /** Enable drag-and-drop sorting of cards inside this category. */
  reorderable?: boolean;
  /** Called when the user reorders cards within this category. */
  onReorder?: (opts: {
    activeId: string;
    overId: string;
    scopeIds: readonly string[];
  }) => void;

  /** Used to trigger scroll offset recomputation for window virtualization. */
  scrollMarginKey?: string | number;
}

function SortableCardItem<TCard extends { id: string }>({
  card,
  index,
  renderCard,
}: Readonly<{
  card: TCard;
  index: number;
  renderCard: NonNullable<CardCategorySectionProps<TCard>["renderCard"]>;
}>) {
  const {
    attributes,
    listeners,
    setNodeRef,
    setActivatorNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: card.id });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn("min-w-0", isDragging && "z-10 opacity-70")}
    >
      {renderCard(card, index, {
        dragHandleProps: { attributes, listeners, setActivatorNodeRef },
        isDragging,
      })}
    </div>
  );
}

/**
 * Collapsible section for grouping cards by category.
 * @param props - Component props.
 * @returns JSX element.
 * @source
 */
function CardCategorySectionInner<TCard extends { id: string }>({
  title,
  cardCount,
  enabledCount,
  icon,
  defaultExpanded = true,
  expanded,
  onExpandedChange,
  children,
  cards,
  renderCard,
  getCardKey,
  virtualize,
  reorderable = false,
  onReorder,
  scrollMarginKey,
}: Readonly<CardCategorySectionProps<TCard>>) {
  const contentId = useId();
  const isControlled = typeof expanded === "boolean";
  const [uncontrolledExpanded, setUncontrolledExpanded] =
    useState(defaultExpanded);

  const isExpanded = isControlled ? expanded : uncontrolledExpanded;
  const clampedEnabledCount = Math.min(enabledCount, cardCount);
  const isFullyEnabled = clampedEnabledCount === cardCount && cardCount > 0;

  const setExpanded = useCallback(
    (next: boolean) => {
      if (!isControlled) {
        setUncontrolledExpanded(next);
      }
      onExpandedChange?.(next);
    },
    [isControlled, onExpandedChange],
  );

  const handleToggleExpanded = useCallback(() => {
    setExpanded(!isExpanded);
  }, [isExpanded, setExpanded]);

  const hasCards = Boolean(cards && cards.length > 0 && renderCard);
  const shouldVirtualize = useMemo(() => {
    if (!hasCards) return false;
    if (reorderable) return false;
    if (typeof virtualize === "boolean") return virtualize;
    // Heuristic: once a category has enough items, virtualization pays off.
    return (cards?.length ?? 0) >= VIRTUALIZATION_THRESHOLD;
  }, [cards?.length, hasCards, reorderable, virtualize]);

  const sortableIds = useMemo(
    () => (cards ? cards.map((c) => c.id) : []),
    [cards],
  );

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      if (!reorderable || !onReorder) return;
      const { active, over } = event;
      const activeId = String(active.id);
      // If dropped outside a valid target, `over` is null - treat as cancelled
      const overId = over ? String(over.id) : "";
      if (!overId || activeId === overId) return;
      onReorder({ activeId, overId, scopeIds: sortableIds });
    },
    [onReorder, reorderable, sortableIds],
  );
  const grid = useMemo(() => {
    if (hasCards && cards && renderCard) {
      if (reorderable) {
        return (
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
          >
            <SortableContext items={sortableIds} strategy={rectSortingStrategy}>
              <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
                {cards.map((card, index) => (
                  <SortableCardItem
                    key={card.id}
                    card={card}
                    index={index}
                    renderCard={renderCard}
                  />
                ))}
              </div>
            </SortableContext>
          </DndContext>
        );
      }

      if (shouldVirtualize) {
        return (
          <VirtualizedCardGrid
            items={cards}
            renderItem={renderCard}
            getItemKey={getCardKey}
            scrollMarginKey={scrollMarginKey}
          />
        );
      }

      const keyFn = getCardKey ?? ((c: TCard) => c.id);
      return (
        <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
          {cards.map((card, index) => (
            <div key={keyFn(card, index)} className="min-w-0">
              {renderCard(card, index)}
            </div>
          ))}
        </div>
      );
    }

    return (
      <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">{children}</div>
    );
  }, [
    cards,
    children,
    getCardKey,
    hasCards,
    handleDragEnd,
    reorderable,
    renderCard,
    scrollMarginKey,
    sensors,
    shouldVirtualize,
    sortableIds,
  ]);

  return (
    <div
      className={cn(
        "group/section overflow-hidden rounded-2xl border transition-all duration-300",
        isExpanded
          ? "border-slate-200/70 bg-white/80 shadow-lg backdrop-blur-xl dark:border-slate-700/70 dark:bg-slate-800/80"
          : "border-slate-200/50 bg-white/60 hover:border-slate-300/60 hover:bg-white/70 dark:border-slate-700/50 dark:bg-slate-800/60 dark:hover:border-slate-600/60",
      )}
    >
      {/* Section Header */}
      <button
        type="button"
        onClick={handleToggleExpanded}
        aria-expanded={isExpanded}
        aria-controls={contentId}
        className={cn(
          "flex w-full items-center justify-between gap-4 px-5 py-4 text-left transition-all duration-200 sm:px-6",
          "hover:bg-slate-50/80 dark:hover:bg-slate-700/40",
        )}
      >
        <div className="flex min-w-0 flex-1 items-center gap-4">
          {/* Icon */}
          <div
            className={cn(
              "flex h-11 w-11 shrink-0 items-center justify-center rounded-xl shadow-md transition-all duration-300",
              isFullyEnabled
                ? "bg-gradient-to-br from-emerald-400 to-green-500"
                : "bg-gradient-to-br from-slate-200 to-slate-300 dark:from-slate-600 dark:to-slate-700",
            )}
          >
            {isFullyEnabled ? (
              <CheckCircle2 className="h-5 w-5 text-white" />
            ) : (
              <span className="text-slate-600 dark:text-slate-300">{icon}</span>
            )}
          </div>

          {/* Title and subtitle */}
          <div className="min-w-0 flex-1">
            <h3 className="truncate text-base font-semibold text-slate-900 dark:text-white sm:text-lg">
              {title}
            </h3>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              <span className="font-medium text-slate-700 dark:text-slate-300">
                {clampedEnabledCount}
              </span>{" "}
              of{" "}
              <span className="font-medium text-slate-700 dark:text-slate-300">
                {cardCount}
              </span>{" "}
              cards enabled
            </p>
          </div>
        </div>

        {/* Right side - progress and chevron */}
        <div className="flex shrink-0 items-center gap-4">
          {/* Expand/Collapse Icon */}
          <div
            className={cn(
              "flex h-9 w-9 items-center justify-center rounded-xl transition-all duration-200",
              isExpanded
                ? "bg-blue-100 text-blue-600 dark:bg-blue-900/40 dark:text-blue-400"
                : "bg-slate-100 text-slate-500 group-hover/section:bg-slate-200 dark:bg-slate-700 dark:text-slate-400 dark:group-hover/section:bg-slate-600",
            )}
          >
            <motion.div
              animate={{ rotate: isExpanded ? 90 : 0 }}
              transition={{ duration: 0.2 }}
            >
              <ChevronRight className="h-5 w-5" />
            </motion.div>
          </div>
        </div>
      </button>

      {/* Section Content */}
      <AnimatePresence initial={false}>
        {isExpanded && (
          <motion.div
            id={contentId}
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25, ease: "easeInOut" }}
            className="overflow-hidden"
          >
            <div className="border-t border-slate-200/60 bg-slate-50/50 px-5 py-5 dark:border-slate-700/60 dark:bg-slate-900/30 sm:px-6">
              {grid}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export const CardCategorySection = memo(
  CardCategorySectionInner,
) as unknown as (<TCard extends { id: string }>(
  props: Readonly<CardCategorySectionProps<TCard>>,
) => ReactElement) & { displayName?: string };

CardCategorySection.displayName = "CardCategorySection";
