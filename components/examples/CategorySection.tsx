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

import { ExampleCard } from "./ExampleCard";

interface CardVariant {
  name: string;
  url: string;
  description?: string;
}

interface CardType {
  title: string;
  description: string;
  variants: CardVariant[];
  category:
    | "Core Stats"
    | "Anime Deep Dive"
    | "Manga Deep Dive"
    | "Activity & Engagement"
    | "Library & Progress"
    | "Advanced Analytics";
  icon: LucideIcon;
  color: string;
  gradient: string;
}

interface CategorySectionProps {
  category: string;
  cardTypes: CardType[];
  isFirstCategory: boolean;
}

const getCategoryIcon = (category: string): LucideIcon => {
  switch (category) {
    case "Core Stats":
      return BarChart2;
    case "Anime Deep Dive":
      return PieChart;
    case "Manga Deep Dive":
      return BookOpen;
    case "Activity & Engagement":
      return Calendar;
    case "Library & Progress":
      return Users;
    case "Advanced Analytics":
      return TrendingUp;
    default:
      return BarChart2;
  }
};

const CATEGORY_DESCRIPTIONS: Record<string, string> = {
  "Core Stats": "Foundational cards showing your overall anime & manga profile",
  "Anime Deep Dive":
    "Detailed breakdowns of your anime genres, studios, and patterns",
  "Manga Deep Dive":
    "In-depth analysis of your manga reading habits and preferences",
  "Activity & Engagement":
    "Streaks, milestones, and patterns in your daily activity",
  "Library & Progress":
    "Favourites, backlog, and completion milestones at a glance",
  "Advanced Analytics": "Cross-media comparisons and data-driven insights",
};

export function CategorySection({
  category,
  cardTypes,
  isFirstCategory,
}: Readonly<CategorySectionProps>) {
  if (cardTypes.length === 0) return null;

  const CategoryIcon = getCategoryIcon(category);
  const categoryId = `category-${category.toLowerCase().replaceAll(/\s+/g, "-")}`;
  const totalVariants = cardTypes.reduce(
    (sum, ct) => sum + ct.variants.length,
    0,
  );

  return (
    <motion.section
      id={categoryId}
      initial={{ opacity: 0, y: 30 }}
      animate={isFirstCategory ? { opacity: 1, y: 0 } : undefined}
      whileInView={isFirstCategory ? undefined : { opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      viewport={isFirstCategory ? undefined : { once: true, margin: "-100px" }}
      className="scroll-mt-24"
    >
      <div className="mb-10 text-center">
        <div className="border-gold/20 mx-auto mb-4 inline-flex h-12 w-12 items-center justify-center border">
          <CategoryIcon className="text-gold h-5 w-5" />
        </div>
        <h2 className="font-display text-foreground mb-2 text-sm tracking-[0.25em] uppercase sm:text-base">
          {category}
        </h2>
        <p className="text-foreground/40 mx-auto mb-3 max-w-md text-sm">
          {CATEGORY_DESCRIPTIONS[category]}
        </p>
        <div className="gold-line mx-auto max-w-32" />
        <p className="text-foreground/30 mt-3 text-xs tabular-nums">
          {cardTypes.length} card type{cardTypes.length === 1 ? "" : "s"} ·{" "}
          {totalVariants} variant{totalVariants === 1 ? "" : "s"}
        </p>
      </div>

      <div className="space-y-14">
        {cardTypes.map((cardType) => (
          <div key={cardType.title}>
            <div className="mb-5 flex items-center gap-3">
              <cardType.icon className="text-gold/60 h-4 w-4 shrink-0" />
              <h3 className="text-foreground text-sm font-semibold">
                {cardType.title}
              </h3>
              <div className="gold-line flex-1" />
              <span className="text-foreground/30 text-xs tabular-nums">
                {cardType.variants.length}
              </span>
            </div>

            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {cardType.variants.map((variant, variantIndex) => (
                <ExampleCard
                  key={variant.name}
                  variant={variant}
                  cardTypeTitle={cardType.title}
                  gradient={cardType.gradient}
                  index={variantIndex}
                />
              ))}
            </div>
          </div>
        ))}
      </div>
    </motion.section>
  );
}

export type { CardType, CardVariant };
