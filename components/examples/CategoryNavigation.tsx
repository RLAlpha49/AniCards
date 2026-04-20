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
    <nav
      className="relative w-full"
      aria-label="Filter example cards by category"
    >
      {/* Fade edges for mobile scroll */}
      <div className="
        pointer-events-none absolute inset-y-0 right-0 z-10 w-8 bg-linear-to-l from-background
        to-transparent
        sm:hidden
      " />
      <div className="
        pointer-events-none absolute inset-y-0 left-0 z-10 w-8 bg-linear-to-r from-background
        to-transparent
        sm:hidden
      " />

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
            const index = item.key ? item.indexLabel : undefined;
            const className = cn(
              `
                relative z-10 flex items-center gap-2 rounded-sm px-3.5 py-3 text-xs font-medium
                whitespace-nowrap transition-all duration-300
                focus-visible:bg-gold/5 focus-visible:text-gold focus-visible:ring-2
                focus-visible:ring-gold/50 focus-visible:ring-offset-2
                focus-visible:ring-offset-background focus-visible:outline-none
              `,
              isActive
                ? "text-gold"
                : "text-foreground/30 hover:text-foreground/55",
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
                <span className="tracking-wide">{item.name}</span>
                <span
                  className={cn(
                    "ml-0.5 px-1.5 py-0.5 text-[0.55rem] tabular-nums transition-all duration-300",
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
      </div>
    </nav>
  );
}
