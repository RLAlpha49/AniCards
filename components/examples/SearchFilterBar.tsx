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
    <div className="flex items-center gap-2.5">
      <div className="relative flex-1">
        <Search className="text-foreground/25 absolute top-1/2 left-3 h-3.5 w-3.5 -translate-y-1/2" />
        <input
          type="text"
          placeholder="Search cards…"
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          className={cn(
            "h-9 w-full border bg-transparent pr-8 pl-9 text-sm",
            "border-gold/10 text-foreground placeholder:text-foreground/30",
            "focus:border-gold/30 focus:ring-gold/8 focus:ring-1 focus:outline-none",
            "transition-colors duration-200",
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
              className="text-foreground/30 hover:text-foreground/55 absolute top-1/2 right-2.5 -translate-y-1/2 transition-colors"
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
            initial={{ opacity: 0, x: 6 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 6 }}
            className="text-foreground/40 shrink-0 text-xs tabular-nums"
          >
            <span className="text-gold font-semibold">{resultCount}</span>
            <span className="text-foreground/20 mx-0.5">/</span>
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
            className="text-foreground/40 hover:text-gold border-gold/10 hover:border-gold/25 shrink-0 border px-2.5 py-1 text-[0.7rem] font-medium tracking-wide uppercase transition-colors"
          >
            Reset
          </motion.button>
        )}
      </AnimatePresence>
    </div>
  );
}
