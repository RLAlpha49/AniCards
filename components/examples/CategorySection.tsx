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

const CATEGORY_ICONS: Record<string, LucideIcon> = {
  "Core Stats": BarChart2,
  "Anime Deep Dive": PieChart,
  "Manga Deep Dive": BookOpen,
  "Activity & Engagement": Calendar,
  "Library & Progress": Users,
  "Advanced Analytics": TrendingUp,
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

  const CategoryIcon = CATEGORY_ICONS[category] || BarChart2;
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
      viewport={isFirstCategory ? undefined : { once: true, margin: "-80px" }}
      className="scroll-mt-32"
    >
      {/* Category header — left-aligned with icon badge */}
      <div className="mb-12">
        <div className="mb-3 flex items-center gap-3">
          <div className="border-gold/20 bg-gold/3 flex h-9 w-9 shrink-0 items-center justify-center border">
            <CategoryIcon className="text-gold h-4 w-4" />
          </div>
          <div>
            <h2 className="font-display text-foreground text-sm tracking-[0.2em] uppercase sm:text-base">
              {category}
            </h2>
            <p className="text-foreground/30 text-xs tabular-nums">
              {cardTypes.length} type{cardTypes.length === 1 ? "" : "s"} ·{" "}
              {totalVariants} variant{totalVariants === 1 ? "" : "s"}
            </p>
          </div>
        </div>
        <p className="text-foreground/40 max-w-lg pl-12 text-sm leading-relaxed">
          {CATEGORY_DESCRIPTIONS[category]}
        </p>
      </div>

      {/* Card type groups */}
      <div className="space-y-16">
        {cardTypes.map((cardType) => (
          <div key={cardType.title}>
            <div className="mb-5 flex items-center gap-3">
              <cardType.icon className="text-gold/50 h-4 w-4 shrink-0" />
              <h4 className="text-foreground text-sm font-semibold tracking-wide">
                {cardType.title}
              </h4>
              <div className="gold-line flex-1" />
              <span className="text-foreground/25 text-xs tabular-nums">
                {cardType.variants.length}
              </span>
            </div>

            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
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
