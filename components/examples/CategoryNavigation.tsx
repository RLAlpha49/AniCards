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

export function CategoryNavigation({
  categories,
  activeCategory,
  onCategoryClick,
}: Readonly<CategoryNavigationProps>) {
  const totalCount = categories.reduce((sum, c) => sum + c.count, 0);

  const allItems = [
    { name: "All", count: totalCount, key: null as string | null },
    ...categories.map((c) => ({ ...c, key: c.name })),
  ];

  return (
    <nav className="group/nav relative w-full" aria-label="Category navigation">
      <div className="from-background pointer-events-none absolute top-0 right-0 bottom-0 z-10 w-8 bg-gradient-to-l to-transparent sm:hidden" />
      <div className="from-background pointer-events-none absolute top-0 bottom-0 left-0 z-10 w-8 bg-gradient-to-r to-transparent sm:hidden" />

      <div className="overflow-x-auto">
        <div className="flex min-w-max items-end">
          {allItems.map((item) => {
            const isActive =
              item.key === null
                ? activeCategory === null
                : activeCategory === item.key;
            const Icon =
              item.key === null
                ? undefined
                : CATEGORY_ICONS[item.key] || BarChart2;

            return (
              <button
                type="button"
                key={item.name}
                aria-current={isActive ? "page" : undefined}
                onClick={() => onCategoryClick(item.key)}
                className={cn(
                  "relative flex items-center gap-2 px-4 py-3 text-sm font-medium whitespace-nowrap transition-colors",
                  isActive
                    ? "text-gold"
                    : "text-foreground/45 hover:text-foreground/70",
                )}
              >
                {Icon && <Icon className="h-3.5 w-3.5" />}
                <span>{item.name}</span>
                <span
                  className={cn(
                    "text-[0.65rem] tabular-nums",
                    isActive ? "text-gold/70" : "text-foreground/30",
                  )}
                >
                  {item.count}
                </span>
                {isActive && (
                  <motion.div
                    layoutId="category-underline"
                    className="bg-gold absolute right-0 bottom-0 left-0 h-0.5"
                    transition={{ type: "spring", stiffness: 400, damping: 30 }}
                  />
                )}
              </button>
            );
          })}
        </div>
      </div>
    </nav>
  );
}
