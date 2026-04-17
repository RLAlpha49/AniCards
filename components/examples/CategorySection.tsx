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
import { useCallback, useEffect, useMemo, useState } from "react";

import type { PreviewColorPreset } from "@/lib/preview-theme";

import { ExampleCard } from "./ExampleCard";
import type { ExampleCardType, ExampleIconKey } from "./types";

interface CategorySectionProps {
  category: string;
  cardTypes: ExampleCardType[];
  isFirstCategory: boolean;
  previewColorPreset: PreviewColorPreset | null;
}

const CARD_TYPE_CHUNK_THRESHOLD = 6;
const INITIAL_CARD_TYPE_CHUNK_SIZE = 4;
const CARD_TYPE_CHUNK_SIZE = 4;

function getInitialVisibleCardTypeCount(totalCardTypes: number): number {
  if (totalCardTypes <= CARD_TYPE_CHUNK_THRESHOLD) {
    return totalCardTypes;
  }

  return Math.min(totalCardTypes, INITIAL_CARD_TYPE_CHUNK_SIZE);
}

function buildCardTypeSignature(cardTypes: readonly ExampleCardType[]): string {
  return cardTypes.map((cardType) => cardType.title).join("|");
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

function CardTypeIconDisplay({
  iconKey,
}: Readonly<{ iconKey: ExampleIconKey }>) {
  const CardTypeIcon = CARD_TYPE_ICONS[iconKey] ?? BarChart2;

  return <CardTypeIcon className="size-3.5 shrink-0 text-gold/40" />;
}

export function CategorySection({
  category,
  cardTypes,
  isFirstCategory,
  previewColorPreset,
}: Readonly<CategorySectionProps>) {
  const CategoryIcon = CATEGORY_ICONS[category] || BarChart2;
  const categoryId = `category-${category.toLowerCase().replaceAll(/\s+/g, "-")}`;
  const cardTypeSignature = useMemo(
    () => buildCardTypeSignature(cardTypes),
    [cardTypes],
  );
  const [visibleCardTypeCount, setVisibleCardTypeCount] = useState(() =>
    getInitialVisibleCardTypeCount(cardTypes.length),
  );
  const totalVariants = cardTypes.reduce(
    (sum, ct) => sum + ct.variants.length,
    0,
  );
  const sectionNumber = CATEGORY_NUMBERS[category] || "00";
  const visibleCardTypes = useMemo(
    () => cardTypes.slice(0, visibleCardTypeCount),
    [cardTypes, visibleCardTypeCount],
  );
  const remainingCardTypeCount = Math.max(
    0,
    cardTypes.length - visibleCardTypeCount,
  );

  if (cardTypes.length === 0) {
    return null;
  }

  useEffect(() => {
    setVisibleCardTypeCount(getInitialVisibleCardTypeCount(cardTypes.length));
  }, [cardTypeSignature, cardTypes.length]);

  const handleLoadMoreCardTypes = useCallback(() => {
    setVisibleCardTypeCount((currentVisibleCount) =>
      Math.min(currentVisibleCount + CARD_TYPE_CHUNK_SIZE, cardTypes.length),
    );
  }, [cardTypes.length]);

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

            <p className="ml-11 max-w-md font-body-serif text-sm/relaxed text-foreground/35">
              {CATEGORY_DESCRIPTIONS[category]}
            </p>
          </div>
        </div>

        <div className="mt-2 flex w-full justify-center">
          <span className="text-xs whitespace-nowrap text-foreground/20 tabular-nums">
            {cardTypes.length} type{cardTypes.length === 1 ? "" : "s"} ·{" "}
            {totalVariants} variant{totalVariants === 1 ? "" : "s"}
          </span>
        </div>
      </div>

      {/* Card type groups */}
      <div className="space-y-20">
        {visibleCardTypes.map((cardType, typeIndex) => (
          <div key={cardType.title}>
            {/* Card type header with line */}
            <div className="mb-6 flex items-center gap-4">
              <div className="flex items-center gap-2.5">
                <CardTypeIconDisplay iconKey={cardType.iconKey} />
                <h3 className="text-sm font-semibold tracking-wide text-foreground/80">
                  {cardType.title}
                </h3>
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

        {remainingCardTypeCount > 0 && (
          <div className="border border-gold/10 bg-gold/3 px-5 py-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-xs/relaxed text-foreground/35">
                Showing {visibleCardTypes.length} of {cardTypes.length} card
                types in this collection.
              </p>
              <button
                type="button"
                onClick={handleLoadMoreCardTypes}
                className="
                  shrink-0 border border-gold/20 px-4 py-2 text-[0.65rem] font-semibold
                  tracking-[0.18em] text-gold uppercase transition-colors
                  hover:border-gold/35 hover:bg-gold/6
                  focus-visible:ring-2 focus-visible:ring-gold/50 focus-visible:ring-offset-2
                  focus-visible:ring-offset-background focus-visible:outline-none
                "
                aria-controls={categoryId}
              >
                Load more card types
              </button>
            </div>
          </div>
        )}
      </div>
    </motion.section>
  );
}
