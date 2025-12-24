"use client";

import { motion } from "framer-motion";
import {
  BarChart2,
  BookOpen,
  PieChart,
  LucideIcon,
  Users,
  Calendar,
  TrendingUp,
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
  onStartCreating: () => void;
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

const getCategoryStyles = (category: string) => {
  switch (category) {
    case "Anime Deep Dive":
      return {
        bg: "bg-purple-100 dark:bg-purple-900/30",
        text: "text-purple-600 dark:text-purple-400",
        border: "border-purple-200/50 dark:border-purple-800/50",
        gradient: "from-purple-500 to-violet-500",
      };
    case "Manga Deep Dive":
      return {
        bg: "bg-pink-100 dark:bg-pink-900/30",
        text: "text-pink-600 dark:text-pink-400",
        border: "border-pink-200/50 dark:border-pink-800/50",
        gradient: "from-pink-500 to-rose-500",
      };
    case "Library & Progress":
      return {
        bg: "bg-emerald-100 dark:bg-emerald-900/30",
        text: "text-emerald-600 dark:text-emerald-400",
        border: "border-emerald-200/50 dark:border-emerald-800/50",
        gradient: "from-emerald-500 to-green-500",
      };
    case "Activity & Engagement":
      return {
        bg: "bg-amber-100 dark:bg-amber-900/30",
        text: "text-amber-600 dark:text-amber-400",
        border: "border-amber-200/50 dark:border-amber-800/50",
        gradient: "from-amber-500 to-orange-500",
      };
    case "Advanced Analytics":
      return {
        bg: "bg-indigo-100 dark:bg-indigo-900/30",
        text: "text-indigo-600 dark:text-indigo-400",
        border: "border-indigo-200/50 dark:border-indigo-800/50",
        gradient: "from-indigo-500 to-blue-500",
      };
    case "Core Stats":
    default:
      return {
        bg: "bg-blue-100 dark:bg-blue-900/30",
        text: "text-blue-600 dark:text-blue-400",
        border: "border-blue-200/50 dark:border-blue-800/50",
        gradient: "from-blue-500 to-cyan-500",
      };
  }
};

export function CategorySection({
  category,
  cardTypes,
  onStartCreating,
  isFirstCategory,
}: Readonly<CategorySectionProps>) {
  if (cardTypes.length === 0) return null;

  const CategoryIcon = getCategoryIcon(category);
  const styles = getCategoryStyles(category);

  return (
    <motion.div
      initial={{ opacity: 0, y: 30 }}
      animate={isFirstCategory ? { opacity: 1, y: 0 } : undefined}
      whileInView={isFirstCategory ? undefined : { opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      viewport={isFirstCategory ? undefined : { once: true, margin: "-50px" }}
      className="space-y-10"
    >
      {/* Category Header */}
      <div className="flex items-center gap-4">
        <div className={`rounded-2xl p-4 ${styles.bg}`}>
          <CategoryIcon className={`h-8 w-8 ${styles.text}`} />
        </div>
        <div>
          <h2 className="text-2xl font-bold text-slate-900 dark:text-white sm:text-3xl">
            {category}
          </h2>
          <p className="text-slate-600 dark:text-slate-400">
            {cardTypes.length} card type{cardTypes.length === 1 ? "" : "s"} •{" "}
            {cardTypes.reduce((sum, ct) => sum + ct.variants.length, 0)}{" "}
            variants
          </p>
        </div>
      </div>

      {/* Card Types */}
      <div className="space-y-16">
        {cardTypes.map((cardType) => (
          <motion.div
            key={cardType.title}
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5, delay: 0.2 }}
            className="space-y-6"
          >
            {/* Card Type Header */}
            <div
              className={`flex items-center gap-3 rounded-2xl border ${styles.border} bg-white/50 p-4 backdrop-blur-sm dark:bg-slate-800/50`}
            >
              <div className={`rounded-xl p-2 ${styles.bg}`}>
                <cardType.icon className={`h-5 w-5 ${styles.text}`} />
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                  {cardType.title}
                </h3>
                <p className="text-sm text-slate-600 dark:text-slate-400">
                  {cardType.description}
                </p>
              </div>
              <span
                className={`rounded-full px-3 py-1 text-xs font-medium ${styles.bg} ${styles.text}`}
              >
                {cardType.variants.length} variant
                {cardType.variants.length === 1 ? "" : "s"}
              </span>
            </div>

            {/* Variants Grid */}
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {cardType.variants.map((variant, variantIndex) => (
                <ExampleCard
                  key={variant.name}
                  variant={variant}
                  cardTypeTitle={cardType.title}
                  gradient={cardType.gradient}
                  onStartCreating={onStartCreating}
                  index={variantIndex}
                />
              ))}
            </div>
          </motion.div>
        ))}
      </div>
    </motion.div>
  );
}

export type { CardType, CardVariant };
