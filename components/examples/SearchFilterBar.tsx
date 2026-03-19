"use client";

import { AnimatePresence, motion } from "framer-motion";
import { Search, X } from "lucide-react";

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
      <div className="relative flex-1">
        <Search className="text-foreground/30 absolute top-1/2 left-3.5 h-4 w-4 -translate-y-1/2" />
        <input
          type="text"
          placeholder="Search cards…"
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          className={cn(
            "border-gold/15 bg-background h-10 w-full rounded-none border pr-9 pl-10 text-sm",
            "text-foreground placeholder:text-foreground/35",
            "focus:border-gold/40 focus:ring-gold/15 focus:ring-1 focus:outline-none",
          )}
        />
        <AnimatePresence>
          {searchQuery.length > 0 && (
            <motion.button
              type="button"
              initial={{ opacity: 0, scale: 0.7 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.7 }}
              onClick={() => onSearchChange("")}
              className="text-foreground/40 hover:text-foreground/60 absolute top-1/2 right-2.5 -translate-y-1/2"
              aria-label="Clear search"
            >
              <X className="h-3.5 w-3.5" />
            </motion.button>
          )}
        </AnimatePresence>
      </div>

      <AnimatePresence>
        {isFiltered && (
          <motion.span
            initial={{ opacity: 0, x: 8 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 8 }}
            className="text-foreground/50 shrink-0 text-xs tabular-nums"
          >
            <span className="text-gold font-semibold">{resultCount}</span>
            <span className="text-foreground/30 mx-0.5">/</span>
            {totalCount}
          </motion.span>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {hasActiveFilters && (
          <motion.button
            type="button"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            onClick={onClearFilters}
            className="text-foreground/50 hover:text-gold border-gold/15 shrink-0 border px-3 py-1.5 text-xs font-medium transition-colors"
          >
            Clear
          </motion.button>
        )}
      </AnimatePresence>
    </div>
  );
}
