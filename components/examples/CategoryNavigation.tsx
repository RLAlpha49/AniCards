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

const CATEGORY_INDEX: Record<string, string> = {
  "Core Stats": "01",
  "Anime Deep Dive": "02",
  "Manga Deep Dive": "03",
  "Activity & Engagement": "04",
  "Library & Progress": "05",
  "Advanced Analytics": "06",
};

export function CategoryNavigation({
  categories,
  activeCategory,
  onCategoryClick,
}: Readonly<CategoryNavigationProps>) {
  const totalCount = categories.reduce((sum, c) => sum + c.count, 0);

  const items = [
    { name: "All", count: totalCount, key: null as string | null },
    ...categories.map((c) => ({ ...c, key: c.name })),
  ];

  return (
    <nav className="relative w-full" aria-label="Category navigation">
      {/* Fade edges for mobile scroll */}
      <div className="from-background pointer-events-none absolute top-0 right-0 bottom-0 z-10 w-8 bg-linear-to-l to-transparent sm:hidden" />
      <div className="from-background pointer-events-none absolute top-0 bottom-0 left-0 z-10 w-8 bg-linear-to-r to-transparent sm:hidden" />

      <div className="overflow-x-auto">
        <div className="flex min-w-max items-center gap-0.5">
          {items.map((item) => {
            const isActive =
              item.key === null
                ? activeCategory === null
                : activeCategory === item.key;
            const Icon =
              item.key === null
                ? undefined
                : CATEGORY_ICONS[item.key] || BarChart2;
            const index = item.key ? CATEGORY_INDEX[item.key] : undefined;

            return (
              <button
                type="button"
                key={item.name}
                aria-current={isActive ? "page" : undefined}
                onClick={() => onCategoryClick(item.key)}
                className={cn(
                  "relative flex items-center gap-2 px-3.5 py-3 text-xs font-medium whitespace-nowrap transition-all duration-300",
                  isActive
                    ? "text-gold"
                    : "text-foreground/30 hover:text-foreground/55",
                )}
              >
                {/* Numbered index for non-All items */}
                {index && (
                  <span
                    className={cn(
                      "font-display text-[0.55rem] tabular-nums transition-colors duration-300",
                      isActive ? "text-gold/70" : "text-foreground/15",
                    )}
                  >
                    {index}
                  </span>
                )}
                {Icon && <Icon className="h-3 w-3 shrink-0" />}
                <span className="tracking-wide">{item.name}</span>
                <span
                  className={cn(
                    "ml-0.5 rounded-full px-1.5 py-0.5 text-[0.55rem] tabular-nums transition-all duration-300",
                    isActive ? "bg-gold/10 text-gold/80" : "text-foreground/18",
                  )}
                >
                  {item.count}
                </span>

                {/* Active indicator — bottom bar */}
                {isActive && (
                  <motion.div
                    layoutId="category-active-bar"
                    className="bg-gold absolute right-3.5 bottom-0 left-3.5 h-0.5"
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
