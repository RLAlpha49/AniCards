"use client";

import { motion } from "framer-motion";
import {
  BarChart2,
  BookOpen,
  Calendar,
  type LucideIcon,
  PieChart,
  TrendingUp,
  Users,
} from "lucide-react";

import { cn } from "@/lib/utils";

import type { CategoryInfo } from "./types";

interface CategoryNavigationProps {
  categories: CategoryInfo[];
  activeCategory: string | null;
  onCategoryClick: (category: string | null) => void;
}

const CATEGORY_ICONS: Record<string, LucideIcon> = {
  "Core Stats": BarChart2,
  "Anime Deep Dive": PieChart,
  "Manga Deep Dive": BookOpen,
  "Activity & Engagement": Calendar,
  "Library & Progress": Users,
  "Advanced Analytics": TrendingUp,
};

const CATEGORY_COLORS: Record<
  string,
  { bg: string; text: string; activeBg: string }
> = {
  // NOTE: `activeBg` is an exhaustive, static class string (not fragments).
  // This avoids runtime interpolation of Tailwind classes which can be purged
  // by Tailwind's JIT scanner in production builds.
  "Core Stats": {
    bg: "bg-blue-100 dark:bg-blue-900/30",
    text: "text-blue-600 dark:text-blue-400",
    activeBg: "bg-gradient-to-r from-blue-500 to-cyan-500 text-white shadow-lg",
  },
  "Anime Deep Dive": {
    bg: "bg-purple-100 dark:bg-purple-900/30",
    text: "text-purple-600 dark:text-purple-400",
    activeBg:
      "bg-gradient-to-r from-purple-500 to-violet-500 text-white shadow-lg",
  },
  "Manga Deep Dive": {
    bg: "bg-pink-100 dark:bg-pink-900/30",
    text: "text-pink-600 dark:text-pink-400",
    activeBg: "bg-gradient-to-r from-pink-500 to-rose-500 text-white shadow-lg",
  },
  "Activity & Engagement": {
    bg: "bg-amber-100 dark:bg-amber-900/30",
    text: "text-amber-600 dark:text-amber-400",
    activeBg:
      "bg-gradient-to-r from-amber-500 to-orange-500 text-white shadow-lg",
  },
  "Library & Progress": {
    bg: "bg-emerald-100 dark:bg-emerald-900/30",
    text: "text-emerald-600 dark:text-emerald-400",
    activeBg:
      "bg-gradient-to-r from-emerald-500 to-green-500 text-white shadow-lg",
  },
  "Advanced Analytics": {
    bg: "bg-indigo-100 dark:bg-indigo-900/30",
    text: "text-indigo-600 dark:text-indigo-400",
    activeBg:
      "bg-gradient-to-r from-indigo-500 to-blue-500 text-white shadow-lg",
  },
};

/**
 * Horizontal scrollable category navigation with filter chips.
 * Allows users to filter cards by category or view all.
 */
export function CategoryNavigation({
  categories,
  activeCategory,
  onCategoryClick,
}: Readonly<CategoryNavigationProps>) {
  const totalCount = categories.reduce((sum, c) => sum + c.count, 0);

  return (
    <nav
      className="relative w-full overflow-visible"
      aria-label="Category navigation"
    >
      <div className="flex flex-wrap items-center justify-center gap-2 gap-y-3 px-4 pb-2 sm:px-6">
        {/* All categories chip */}
        <motion.button
          type="button"
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          onClick={() => onCategoryClick(null)}
          className={cn(
            "flex shrink-0 items-center gap-2 whitespace-nowrap rounded-full px-4 py-2 text-sm font-medium transition-all",
            activeCategory === null
              ? "bg-gradient-to-r from-blue-600 via-purple-600 to-pink-600 text-white shadow-lg shadow-purple-500/25"
              : "bg-white/80 text-slate-700 hover:bg-slate-100 dark:bg-slate-800/80 dark:text-slate-300 dark:hover:bg-slate-700/80",
          )}
        >
          <span>All</span>
          <span
            className={cn(
              "rounded-full px-2 py-0.5 text-xs font-semibold",
              activeCategory === null
                ? "bg-white/20"
                : "bg-slate-200 dark:bg-slate-700",
            )}
          >
            {totalCount}
          </span>
        </motion.button>

        {/* Category chips */}
        {categories.map((category) => {
          const Icon = CATEGORY_ICONS[category.name] || BarChart2;
          const colors =
            CATEGORY_COLORS[category.name] || CATEGORY_COLORS["Core Stats"];
          const isActive = activeCategory === category.name;

          return (
            <motion.button
              type="button"
              key={category.name}
              aria-current={isActive ? "true" : undefined}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => onCategoryClick(category.name)}
              className={cn(
                "flex shrink-0 items-center gap-2 whitespace-nowrap rounded-full px-4 py-2 text-sm font-medium transition-all",
                isActive
                  ? colors.activeBg
                  : "bg-white/80 text-slate-700 hover:bg-slate-100 dark:bg-slate-800/80 dark:text-slate-300 dark:hover:bg-slate-700/80",
              )}
            >
              <Icon className="h-4 w-4" />
              <span className="hidden sm:inline">{category.name}</span>
              <span className="sm:hidden">{category.name.split(" ")[0]}</span>
              <span
                className={cn(
                  "rounded-full px-2 py-0.5 text-xs font-semibold",
                  isActive ? "bg-white/20" : "bg-slate-200 dark:bg-slate-700",
                )}
              >
                {category.count}
              </span>
            </motion.button>
          );
        })}
      </div>
    </nav>
  );
}
