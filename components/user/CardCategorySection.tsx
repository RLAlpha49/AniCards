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
import { AnimatePresence, motion } from "framer-motion";
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
        "group/section relative overflow-hidden border-2 transition-all duration-300",
        isExpanded
          ? "border-gold/25 bg-gold/3 dark:border-gold/18 dark:bg-gold/3 shadow-lg backdrop-blur-xl"
          : "border-gold/15 bg-gold/2 hover:border-gold/30 hover:bg-gold/3 dark:border-gold/10 dark:bg-gold/2 dark:hover:border-gold/20",
      )}
    >
      <div className="border-gold pointer-events-none absolute top-0 left-0 h-4 w-4 border-t-2 border-l-2" />
      <div className="border-gold pointer-events-none absolute right-0 bottom-0 h-4 w-4 border-r-2 border-b-2" />

      <button
        type="button"
        onClick={handleToggleExpanded}
        aria-expanded={isExpanded}
        aria-controls={contentId}
        className={cn(
          "flex w-full items-center justify-between gap-4 px-5 py-4 text-left transition-all duration-200 sm:px-6",
          "hover:bg-gold/5 dark:hover:bg-gold/5",
        )}
      >
        <div className="flex min-w-0 flex-1 items-center gap-4">
          <div
            className={cn(
              "flex h-11 w-11 shrink-0 items-center justify-center shadow-md transition-all duration-300",
              isFullyEnabled
                ? "from-gold to-gold-dim bg-linear-to-br via-amber-500"
                : "from-gold/20 dark:from-gold/15 bg-linear-to-br to-amber-200/30 dark:to-amber-300/20",
            )}
          >
            {isFullyEnabled ? (
              <CheckCircle2 className="h-5 w-5 text-white" />
            ) : (
              <span className="text-gold-dim dark:text-gold">{icon}</span>
            )}
          </div>

          <div className="min-w-0 flex-1">
            <h3 className="font-display text-foreground truncate text-sm tracking-[0.15em] uppercase sm:text-base">
              {title}
            </h3>
            <p className="text-muted-foreground mt-0.5 text-sm">
              <span className="text-gold-dim dark:text-gold font-medium">
                {clampedEnabledCount}
              </span>{" "}
              of{" "}
              <span className="text-gold-dim dark:text-gold font-medium">
                {cardCount}
              </span>{" "}
              cards enabled
            </p>
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-4">
          <div
            className={cn(
              "flex h-9 w-9 items-center justify-center transition-all duration-200",
              isExpanded
                ? "bg-gold/15 text-gold dark:bg-gold/10 dark:text-gold"
                : "bg-gold/5 text-gold/60 group-hover/section:bg-gold/10 dark:bg-gold/5 dark:text-gold/50 dark:group-hover/section:bg-gold/10",
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
            <div className="gold-line" />
            <div className="bg-gold/2 dark:bg-gold/2 px-5 py-5 sm:px-6">
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
