"use client";

import { AnimatePresence, motion } from "framer-motion";
import { Search, SlidersHorizontal, X } from "lucide-react";
import { useId } from "react";

import { cn } from "@/lib/utils";

interface SearchFilterBarProps {
  searchQuery: string;
  onSearchChange: (value: string) => void;
  resultCount: number;
  totalCount: number;
  hasActiveFilters: boolean;
  onClearFilters: () => void;
}

export function SearchFilterBar({
  searchQuery,
  onSearchChange,
  resultCount,
  totalCount,
  hasActiveFilters,
  onClearFilters,
}: Readonly<SearchFilterBarProps>) {
  const isFiltered = resultCount !== totalCount;
  const searchInputId = useId();

  return (
    <div className="flex items-center gap-3">
      {/* Search input */}
      <div className="relative flex-1">
        <label htmlFor={searchInputId} className="sr-only">
          Search gallery cards
        </label>
        <Search
          aria-hidden="true"
          className="
            absolute top-1/2 left-3.5 size-3.5 -translate-y-1/2 text-foreground/20 transition-colors
          "
        />
        <input
          id={searchInputId}
          type="search"
          autoComplete="off"
          enterKeyHint="search"
          placeholder="Search by card, variant, category, or collection…"
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          className={cn(
            "h-10 w-full border bg-transparent pr-9 pl-10 text-sm",
            "border-gold/8 text-foreground placeholder:text-foreground/25",
            "focus:border-gold/30 focus:ring-2 focus:ring-gold/6 focus:outline-none",
            "transition-all duration-300",
          )}
        />
        <AnimatePresence>
          {searchQuery.length > 0 && (
            <motion.button
              type="button"
              initial={{ opacity: 0, scale: 0.6, rotate: -90 }}
              animate={{ opacity: 1, scale: 1, rotate: 0 }}
              exit={{ opacity: 0, scale: 0.6, rotate: 90 }}
              transition={{ duration: 0.2, ease: "easeOut" }}
              onClick={() => onSearchChange("")}
              className="
                absolute top-1/2 right-3 -translate-y-1/2 rounded-full text-foreground/25
                transition-colors
                hover:text-foreground/50
                focus-visible:text-gold focus-visible:ring-2 focus-visible:ring-gold/50
                focus-visible:ring-offset-2 focus-visible:ring-offset-background
                focus-visible:outline-none
              "
              aria-controls={searchInputId}
              aria-label="Clear gallery search"
            >
              <X aria-hidden="true" className="size-3.5" />
            </motion.button>
          )}
        </AnimatePresence>
      </div>

      {/* Result counter */}
      <AnimatePresence>
        {isFiltered && (
          <motion.div
            initial={{ opacity: 0, width: 0 }}
            animate={{ opacity: 1, width: "auto" }}
            exit={{ opacity: 0, width: 0 }}
            className="flex shrink-0 items-center gap-1.5 overflow-hidden"
          >
            <SlidersHorizontal className="size-3 shrink-0 text-gold/40" />
            <span className="text-xs whitespace-nowrap text-foreground/40 tabular-nums">
              <span className="font-semibold text-gold">{resultCount}</span>
              <span className="mx-0.5 text-foreground/15">/</span>
              {totalCount}
            </span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Reset button */}
      <AnimatePresence>
        {hasActiveFilters && (
          <motion.button
            type="button"
            initial={{ opacity: 0, x: 8, scale: 0.95 }}
            animate={{ opacity: 1, x: 0, scale: 1 }}
            exit={{ opacity: 0, x: 8, scale: 0.95 }}
            transition={{ duration: 0.2 }}
            onClick={onClearFilters}
            className={cn(
              `
                shrink-0 rounded-sm px-3 py-1.5 text-[0.65rem] font-semibold tracking-widest
                uppercase
              `,
              "border border-transparent transition-all duration-300",
              `
                text-foreground/40
                hover:border-gold/20 hover:bg-gold/5 hover:text-gold
                focus-visible:border-gold/20 focus-visible:bg-gold/5 focus-visible:text-gold
                focus-visible:ring-2 focus-visible:ring-gold/50 focus-visible:ring-offset-2
                focus-visible:ring-offset-background focus-visible:outline-none
              `,
            )}
          >
            Clear
          </motion.button>
        )}
      </AnimatePresence>
    </div>
  );
}
