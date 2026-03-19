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

  const items = [
    { name: "All", count: totalCount, key: null as string | null },
    ...categories.map((c) => ({ ...c, key: c.name })),
  ];

  return (
    <nav className="relative w-full" aria-label="Category navigation">
      <div className="from-background pointer-events-none absolute top-0 right-0 bottom-0 z-10 w-6 bg-linear-to-l to-transparent sm:hidden" />
      <div className="from-background pointer-events-none absolute top-0 bottom-0 left-0 z-10 w-6 bg-linear-to-r to-transparent sm:hidden" />

      <div className="overflow-x-auto">
        <div className="flex min-w-max items-center gap-1">
          {items.map((item) => {
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
                  "relative flex items-center gap-1.5 px-3 py-2.5 text-xs font-medium whitespace-nowrap transition-colors duration-200",
                  isActive
                    ? "text-gold"
                    : "text-foreground/35 hover:text-foreground/60",
                )}
              >
                {Icon && <Icon className="h-3 w-3" />}
                <span>{item.name}</span>
                <span
                  className={cn(
                    "text-[0.6rem] tabular-nums",
                    isActive ? "text-gold/60" : "text-foreground/20",
                  )}
                >
                  {item.count}
                </span>

                {isActive && (
                  <motion.div
                    layoutId="category-pill-bg"
                    className="border-gold/20 bg-gold/6 absolute inset-0 border"
                    transition={{ type: "spring", stiffness: 380, damping: 28 }}
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
