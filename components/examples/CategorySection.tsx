"use client";

import { motion } from "framer-motion";
import {
  Activity,
  BarChart2,
  BookOpen,
  Building2,
  Calendar,
  Clock,
  Heart,
  LayoutGrid,
  type LucideIcon,
  Mic,
  PieChart,
  TrendingUp,
  Users,
} from "lucide-react";

import type { PreviewColorPreset } from "@/lib/preview-theme";

import { ExampleCard } from "./ExampleCard";
import type { ExampleCardType, ExampleIconKey } from "./types";

interface CategorySectionProps {
  category: string;
  cardTypes: ExampleCardType[];
  isFirstCategory: boolean;
  previewColorPreset: PreviewColorPreset | null;
}

const CATEGORY_ICONS: Record<string, LucideIcon> = {
  "Core Stats": BarChart2,
  "Anime Deep Dive": PieChart,
  "Manga Deep Dive": BookOpen,
  "Activity & Engagement": Calendar,
  "Library & Progress": Users,
  "Advanced Analytics": TrendingUp,
};

const CARD_TYPE_ICONS: Record<ExampleIconKey, LucideIcon> = {
  activity: Activity,
  barChart2: BarChart2,
  bookOpen: BookOpen,
  building2: Building2,
  calendar: Calendar,
  clock: Clock,
  heart: Heart,
  layoutGrid: LayoutGrid,
  mic: Mic,
  pieChart: PieChart,
  trendingUp: TrendingUp,
  users: Users,
};

const CATEGORY_DESCRIPTIONS: Record<string, string> = {
  "Core Stats":
    "The essentials — a bird's-eye view of your anime and manga footprint",
  "Anime Deep Dive":
    "Granular breakdowns covering your anime genres, studios, and viewing habits",
  "Manga Deep Dive":
    "A closer look at what you read, how you read, and which titles define your taste",
  "Activity & Engagement":
    "Tracking the rhythm of your daily engagement — streaks, milestones, and peak days",
  "Library & Progress":
    "Your favourites, your backlog, and the milestones that matter — all in one place",
  "Advanced Analytics":
    "Side-by-side anime-vs-manga comparisons and the deeper patterns most people miss",
};

const CATEGORY_NUMBERS: Record<string, string> = {
  "Core Stats": "01",
  "Anime Deep Dive": "02",
  "Manga Deep Dive": "03",
  "Activity & Engagement": "04",
  "Library & Progress": "05",
  "Advanced Analytics": "06",
};

export function CategorySection({
  category,
  cardTypes,
  isFirstCategory,
  previewColorPreset,
}: Readonly<CategorySectionProps>) {
  if (cardTypes.length === 0) return null;

  const CategoryIcon = CATEGORY_ICONS[category] || BarChart2;
  const categoryId = `category-${category.toLowerCase().replaceAll(/\s+/g, "-")}`;
  const totalVariants = cardTypes.reduce(
    (sum, ct) => sum + ct.variants.length,
    0,
  );
  const sectionNumber = CATEGORY_NUMBERS[category] || "00";

  return (
    <motion.section
      id={categoryId}
      initial={{ opacity: 0, y: 40 }}
      animate={isFirstCategory ? { opacity: 1, y: 0 } : undefined}
      whileInView={isFirstCategory ? undefined : { opacity: 1, y: 0 }}
      transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
      viewport={isFirstCategory ? undefined : { once: true, margin: "-80px" }}
      className="scroll-mt-32"
    >
      {/* Category header — editorial numbered layout */}
      <div className="mb-14">
        <div className="flex items-start gap-5">
          {/* Large section number */}
          <span className="
            hidden font-display text-6xl leading-none font-black text-gold/10 select-none
            sm:block
            md:text-7xl
          ">
            {sectionNumber}
          </span>

          <div className="flex-1">
            <div className="mb-2 flex items-center gap-3">
              <div className="
                flex size-8 shrink-0 items-center justify-center border border-gold/15 bg-gold/4
              ">
                <CategoryIcon className="size-3.5 text-gold" />
              </div>
              <h2 className="
                font-display text-sm tracking-[0.25em] text-foreground uppercase
                sm:text-base
              ">
                {category}
              </h2>
            </div>

            <div className="ml-11 flex flex-wrap items-center gap-x-4 gap-y-1">
              <p className="max-w-md font-body-serif text-sm/relaxed text-foreground/35">
                {CATEGORY_DESCRIPTIONS[category]}
              </p>
              <span className="text-xs text-foreground/20 tabular-nums">
                {cardTypes.length} type{cardTypes.length === 1 ? "" : "s"} ·{" "}
                {totalVariants} variant
                {totalVariants === 1 ? "" : "s"}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Card type groups */}
      <div className="space-y-20">
        {cardTypes.map((cardType, typeIndex) => (
          <div key={cardType.title}>
            {/* Card type header with line */}
            <div className="mb-6 flex items-center gap-4">
              <div className="flex items-center gap-2.5">
                {(() => {
                  const CardTypeIcon =
                    CARD_TYPE_ICONS[cardType.iconKey] || BarChart2;

                  return (
                    <CardTypeIcon className="size-3.5 shrink-0 text-gold/40" />
                  );
                })()}
                <h4 className="text-sm font-semibold tracking-wide text-foreground/80">
                  {cardType.title}
                </h4>
              </div>
              <div className="gold-line flex-1" />
              <span className="
                font-display text-[0.6rem] tracking-widest text-foreground/15 tabular-nums
              ">
                {String(typeIndex + 1).padStart(2, "0")}
              </span>
            </div>

            {/* Description */}
            <p className="mb-6 ml-6 max-w-lg text-xs/relaxed text-foreground/30">
              {cardType.description}
            </p>

            {/* Variant grid */}
            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {cardType.variants.map((variant, variantIndex) => (
                <ExampleCard
                  key={variant.name}
                  variant={variant}
                  cardTypeTitle={cardType.title}
                  previewColorPreset={previewColorPreset}
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
