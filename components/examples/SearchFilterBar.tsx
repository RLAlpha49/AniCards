"use client";

import { AnimatePresence, motion } from "framer-motion";
import { Search, SlidersHorizontal, X } from "lucide-react";

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

  return (
    <div className="flex items-center gap-3">
      {/* Search input */}
      <div className="relative flex-1">
        <Search className="text-foreground/20 absolute top-1/2 left-3.5 h-3.5 w-3.5 -translate-y-1/2 transition-colors" />
        <input
          type="text"
          placeholder="Search cards by name or description…"
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          className={cn(
            "h-10 w-full border bg-transparent pr-9 pl-10 text-sm",
            "border-gold/8 text-foreground placeholder:text-foreground/25",
            "focus:border-gold/30 focus:ring-gold/6 focus:ring-2 focus:outline-none",
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
              className="text-foreground/25 hover:text-foreground/50 absolute top-1/2 right-3 -translate-y-1/2 transition-colors"
              aria-label="Clear search"
            >
              <X className="h-3.5 w-3.5" />
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
            <SlidersHorizontal className="text-gold/40 h-3 w-3 shrink-0" />
            <span className="text-foreground/40 text-xs whitespace-nowrap tabular-nums">
              <span className="text-gold font-semibold">{resultCount}</span>
              <span className="text-foreground/15 mx-0.5">/</span>
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
              "shrink-0 px-3 py-1.5 text-[0.65rem] font-semibold tracking-widest uppercase",
              "border border-transparent transition-all duration-300",
              "text-foreground/40 hover:text-gold hover:border-gold/20 hover:bg-gold/5",
            )}
          >
            Reset
          </motion.button>
        )}
      </AnimatePresence>
    </div>
  );
}
