"use client";

import { useId, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { CheckCircle2, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Props for CardCategorySection component.
 * @source
 */
interface CardCategorySectionProps {
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
  children: React.ReactNode;
}

/**
 * Collapsible section for grouping cards by category.
 * @param props - Component props.
 * @returns JSX element.
 * @source
 */
export function CardCategorySection({
  title,
  cardCount,
  enabledCount,
  icon,
  defaultExpanded = true,
  expanded,
  onExpandedChange,
  children,
}: Readonly<CardCategorySectionProps>) {
  const contentId = useId();
  const isControlled = typeof expanded === "boolean";
  const [uncontrolledExpanded, setUncontrolledExpanded] =
    useState(defaultExpanded);

  const isExpanded = isControlled ? expanded : uncontrolledExpanded;
  const isFullyEnabled = enabledCount === cardCount && cardCount > 0;

  const setExpanded = (next: boolean) => {
    if (!isControlled) {
      setUncontrolledExpanded(next);
    }
    onExpandedChange?.(next);
  };

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
        onClick={() => setExpanded(!isExpanded)}
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
                {enabledCount}
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
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                {children}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
