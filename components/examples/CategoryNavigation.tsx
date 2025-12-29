"use client";

import { useCallback } from "react";
import { motion } from "framer-motion";
import {
  BarChart2,
  BookOpen,
  PieChart,
  TrendingUp,
  Calendar,
  Users,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface CategoryInfo {
  name: string;
  count: number;
}

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
  "Core Stats": {
    bg: "bg-blue-100 dark:bg-blue-900/30",
    text: "text-blue-600 dark:text-blue-400",
    activeBg: "from-blue-500 to-cyan-500",
  },
  "Anime Deep Dive": {
    bg: "bg-purple-100 dark:bg-purple-900/30",
    text: "text-purple-600 dark:text-purple-400",
    activeBg: "from-purple-500 to-violet-500",
  },
  "Manga Deep Dive": {
    bg: "bg-pink-100 dark:bg-pink-900/30",
    text: "text-pink-600 dark:text-pink-400",
    activeBg: "from-pink-500 to-rose-500",
  },
  "Activity & Engagement": {
    bg: "bg-amber-100 dark:bg-amber-900/30",
    text: "text-amber-600 dark:text-amber-400",
    activeBg: "from-amber-500 to-orange-500",
  },
  "Library & Progress": {
    bg: "bg-emerald-100 dark:bg-emerald-900/30",
    text: "text-emerald-600 dark:text-emerald-400",
    activeBg: "from-emerald-500 to-green-500",
  },
  "Advanced Analytics": {
    bg: "bg-indigo-100 dark:bg-indigo-900/30",
    text: "text-indigo-600 dark:text-indigo-400",
    activeBg: "from-indigo-500 to-blue-500",
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
  const handleClick = useCallback(
    (category: string | null) => {
      onCategoryClick(category);

      // Intentionally do not auto-scroll to the category section when a chip is clicked.
      // This prevents unexpected navigation or jumping while browsing the examples.
    },
    [onCategoryClick],
  );

  const totalCount = categories.reduce((sum, c) => sum + c.count, 0);

  return (
    <nav
      className="relative w-full overflow-visible"
      aria-label="Category navigation"
    >
      <div className="flex flex-wrap items-center justify-center gap-2 gap-y-3 px-4 pb-2 sm:px-6">
        {/* All categories chip */}
        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          onClick={() => handleClick(null)}
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
              key={category.name}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => handleClick(category.name)}
              className={cn(
                "flex shrink-0 items-center gap-2 whitespace-nowrap rounded-full px-4 py-2 text-sm font-medium transition-all",
                isActive
                  ? `bg-gradient-to-r ${colors.activeBg} text-white shadow-lg`
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
