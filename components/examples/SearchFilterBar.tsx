"use client";

import { motion, AnimatePresence } from "framer-motion";
import { Search, X, SlidersHorizontal } from "lucide-react";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/utils";

interface SearchFilterBarProps {
  searchQuery: string;
  onSearchChange: (value: string) => void;
  resultCount: number;
  totalCount: number;
  hasActiveFilters: boolean;
  onClearFilters: () => void;
}

/**
 * Enhanced search bar with result count and clear filters action.
 * Designed to be used inline or sticky positioned.
 */
export function SearchFilterBar({
  searchQuery,
  onSearchChange,
  resultCount,
  totalCount,
  hasActiveFilters,
  onClearFilters,
}: Readonly<SearchFilterBarProps>) {
  const showClear = searchQuery.length > 0 || hasActiveFilters;
  const isFiltered = resultCount !== totalCount;

  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-4">
      {/* Search input */}
      <div className="relative flex-1">
        <Search className="absolute left-4 top-1/2 z-10 h-4 w-4 -translate-y-1/2 text-slate-400" />
        <Input
          type="text"
          placeholder="Search cards by name or description..."
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          className={cn(
            "h-12 rounded-full border-slate-200/50 bg-white/80 pl-11 pr-10 text-base backdrop-blur-sm",
            "placeholder:text-slate-400 focus:border-purple-300 focus:ring-purple-200",
            "dark:border-slate-700/50 dark:bg-slate-800/80 dark:focus:border-purple-700 dark:focus:ring-purple-900",
          )}
        />
        <AnimatePresence>
          {searchQuery.length > 0 && (
            <motion.button
              type="button"
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.8 }}
              onClick={() => onSearchChange("")}
              className="absolute right-3 top-1/4 flex h-6 w-6 items-center rounded-full p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-700 dark:hover:text-slate-300"
              aria-label="Clear search"
            >
              <X className="h-4 w-4" />
            </motion.button>
          )}
        </AnimatePresence>
      </div>

      {/* Results count and clear */}
      <div className="flex items-center gap-3">
        <AnimatePresence mode="wait">
          {isFiltered && (
            <motion.div
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -10 }}
              className="flex items-center gap-2"
            >
              <SlidersHorizontal className="h-4 w-4 text-purple-500" />
              <span className="text-sm font-medium text-slate-600 dark:text-slate-400">
                <span className="font-bold text-purple-600 dark:text-purple-400">
                  {resultCount}
                </span>{" "}
                of {totalCount} cards
              </span>
            </motion.div>
          )}
        </AnimatePresence>

        <AnimatePresence>
          {showClear && (
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
            >
              <Button
                variant="ghost"
                size="sm"
                onClick={onClearFilters}
                className="h-9 rounded-full px-4 text-sm font-medium text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-white"
              >
                <X className="mr-1 h-3 w-3" />
                Clear
              </Button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
