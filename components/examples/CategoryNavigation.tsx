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
import Link from "next/link";

import { cn } from "@/lib/utils";

import type { CategoryInfo } from "./types";

interface CategoryNavigationProps {
  categories: CategoryInfo[];
  activeCategory: string | null;
  allHref?: string;
  onCategoryClick?: (category: string | null) => void;
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
  allHref,
  onCategoryClick,
}: Readonly<CategoryNavigationProps>) {
  const totalCount = categories.reduce((sum, c) => sum + c.count, 0);

  const items = [
    {
      name: "All",
      count: totalCount,
      key: null as string | null,
      href: allHref,
      indexLabel: undefined,
    },
    ...categories.map((category) => ({
      ...category,
      key: category.name,
      href: category.href,
    })),
  ];

  return (
    <nav className="w-full" aria-label="Filter example cards by category">
      <div className="flex flex-wrap gap-2 pb-1">
        {items.map((item) => {
          const isActive =
            item.key === null
              ? activeCategory === null
              : activeCategory === item.key;
          const Icon =
            item.key === null
              ? undefined
              : CATEGORY_ICONS[item.key] || BarChart2;
          const index = item.key ? item.indexLabel : undefined;
          const className = cn(
            `
              relative z-10 inline-flex min-h-11 w-full min-w-11 touch-manipulation-safe
              items-center justify-between gap-2 rounded-sm border px-3.5 py-2.5 text-xs font-medium
              transition-all duration-300
              focus-visible:bg-gold/5 focus-visible:text-gold focus-visible:ring-2
              focus-visible:ring-gold/50 focus-visible:ring-offset-2
              focus-visible:ring-offset-background focus-visible:outline-none
              sm:w-auto sm:justify-start
            `,
            isActive
              ? "border-gold/25 bg-gold/6 text-gold"
              : `
                border-gold/8 text-foreground/40
                hover:border-gold/20 hover:bg-gold/4 hover:text-foreground/70
              `,
          );
          const content = (
            <>
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
              {Icon && <Icon className="size-3 shrink-0" />}
              <span className="min-w-0 tracking-wide">{item.name}</span>
              <span
                className={cn(
                  "ml-auto inline-flex min-w-7 items-center justify-center rounded-sm px-1.5",
                  "py-0.5 text-[0.55rem] tabular-nums transition-all duration-300",
                  isActive ? "bg-gold/10 text-gold/80" : "text-foreground/18",
                )}
              >
                {item.count}
              </span>

              {/* Active indicator — bottom bar */}
              {isActive && (
                <motion.div
                  layoutId="category-active-bar"
                  className="absolute inset-x-3.5 bottom-0 h-0.5 bg-gold"
                  transition={{ type: "spring", stiffness: 400, damping: 30 }}
                />
              )}
            </>
          );

          if (item.href && !onCategoryClick) {
            return (
              <Link
                key={item.key ?? item.name}
                href={item.href}
                aria-current={isActive ? "page" : undefined}
                className={className}
              >
                {content}
              </Link>
            );
          }

          return (
            <button
              type="button"
              key={item.key ?? item.name}
              aria-pressed={isActive}
              onClick={() => onCategoryClick?.(item.key)}
              className={className}
            >
              {content}
            </button>
          );
        })}
      </div>
    </nav>
  );
}
