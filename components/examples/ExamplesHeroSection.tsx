"use client";

import { motion } from "framer-motion";
import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { ArrowLeft, ArrowDown, Play, Sparkles, Layers } from "lucide-react";
import { SearchFilterBar } from "./SearchFilterBar";
import { CategoryNavigation } from "./CategoryNavigation";
import type { CategoryInfo } from "./types";

interface HeroSectionProps {
  searchQuery: string;
  onSearchChange: (value: string) => void;
  totalCardTypes: number;
  totalVariants: number;
  categories: CategoryInfo[];
  activeCategory: string | null;
  onCategoryChange: (category: string | null) => void;
  filteredCount: number;
  onStartCreating: () => void;
  onClearFilters: () => void;
}

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.08, delayChildren: 0.1 },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.5 } },
};

/**
 * Redesigned hero section with cleaner design, prominent search, and category navigation.
 */
export function ExamplesHeroSection({
  searchQuery,
  onSearchChange,
  totalCardTypes,
  totalVariants,
  categories,
  activeCategory,
  onCategoryChange,
  filteredCount,
  onStartCreating,
  onClearFilters,
}: Readonly<HeroSectionProps>) {
  const hasActiveFilters = searchQuery.length > 0 || activeCategory !== null;

  const scrollToGallery = () => {
    const gallery = document.getElementById("card-gallery");
    if (gallery) {
      gallery.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  };

  return (
    <section className="relative w-full">
      <div className="container relative z-10 mx-auto px-4 py-12 lg:py-20">
        <motion.div
          variants={containerVariants}
          initial="hidden"
          animate="visible"
          className="mx-auto max-w-5xl"
        >
          {/* Back button */}
          <motion.div
            variants={itemVariants}
            className="mb-8 flex w-full justify-start"
          >
            <Link href="/">
              <Button
                variant="ghost"
                size="sm"
                className="group text-slate-600 transition-colors hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
              >
                <ArrowLeft className="mr-2 h-4 w-4 transition-transform group-hover:-translate-x-1" />
                Back to Home
              </Button>
            </Link>
          </motion.div>

          {/* Badge */}
          <motion.div variants={itemVariants} className="mb-6">
            <span className="inline-flex items-center gap-2 rounded-full border border-purple-200/50 bg-purple-50/80 px-4 py-2 text-sm font-medium text-purple-700 shadow-sm backdrop-blur-sm dark:border-purple-700/50 dark:bg-purple-950/50 dark:text-purple-300">
              <Sparkles className="h-4 w-4" />
              Card Gallery
            </span>
          </motion.div>

          {/* Main heading */}
          <motion.h1
            variants={itemVariants}
            className="mb-4 text-4xl font-extrabold leading-[1.1] tracking-tight text-slate-900 dark:text-white sm:text-5xl lg:text-6xl"
          >
            Discover{" "}
            <span className="relative inline-block">
              <span className="relative z-10 bg-gradient-to-r from-blue-600 via-purple-600 to-pink-600 bg-clip-text text-transparent">
                Beautiful
              </span>
              <motion.span
                className="absolute -inset-1 -z-10 block rounded-lg bg-gradient-to-r from-blue-600/20 via-purple-600/20 to-pink-600/20 blur-xl"
                animate={{ opacity: [0.5, 0.8, 0.5] }}
                transition={{ duration: 3, repeat: Infinity }}
              />
            </span>{" "}
            Stat Cards
          </motion.h1>

          {/* Subtitle with stats */}
          <motion.p
            variants={itemVariants}
            className="mx-auto mb-8 max-w-2xl text-lg text-slate-600 dark:text-slate-300 sm:text-xl"
          >
            Explore our complete collection of{" "}
            <span className="font-semibold text-purple-600 dark:text-purple-400">
              {totalCardTypes} card types
            </span>{" "}
            with{" "}
            <span className="font-semibold text-blue-600 dark:text-blue-400">
              {totalVariants}+ variants
            </span>
            . All examples use real data from{" "}
            <a
              href="https://anilist.co/user/Alpha49"
              target="_blank"
              rel="noopener noreferrer"
              className="font-semibold text-blue-600 transition-colors hover:text-blue-700 hover:underline dark:text-blue-400 dark:hover:text-blue-300"
            >
              @Alpha49
            </a>
            {""}.
          </motion.p>

          {/* CTA buttons */}
          <motion.div
            variants={itemVariants}
            className="mb-10 flex flex-col items-center gap-4 sm:flex-row sm:items-center sm:justify-center"
          >
            <Button
              onClick={onStartCreating}
              className="group h-12 gap-2 rounded-full bg-gradient-to-r from-blue-600 via-purple-600 to-pink-600 px-6 font-semibold text-white shadow-lg shadow-purple-500/25 transition-all hover:scale-[1.02] hover:shadow-xl hover:shadow-purple-500/30"
            >
              <Play className="h-4 w-4 fill-current" />
              Create Your Cards
            </Button>
            <Button
              variant="outline"
              onClick={scrollToGallery}
              className="h-12 gap-2 rounded-full border-2 border-slate-300 bg-white/50 px-6 font-medium backdrop-blur-sm transition-all hover:border-slate-400 hover:bg-white dark:border-slate-700 dark:bg-slate-900/50 dark:hover:border-slate-600 dark:hover:bg-slate-800/80"
            >
              <Layers className="h-4 w-4" />
              Browse Gallery
              <ArrowDown className="h-4 w-4" />
            </Button>
          </motion.div>

          {/* Search bar */}
          <motion.div
            variants={itemVariants}
            className="mb-6 flex w-full justify-center"
          >
            <div className="w-full max-w-3xl">
              <SearchFilterBar
                searchQuery={searchQuery}
                onSearchChange={onSearchChange}
                resultCount={filteredCount}
                totalCount={totalCardTypes}
                hasActiveFilters={hasActiveFilters}
                onClearFilters={onClearFilters}
              />
            </div>
          </motion.div>

          {/* Category navigation */}
          <motion.div
            variants={itemVariants}
            className="flex w-full justify-center"
          >
            <div className="w-full max-w-4xl">
              <CategoryNavigation
                categories={categories}
                activeCategory={activeCategory}
                onCategoryClick={onCategoryChange}
              />
            </div>
          </motion.div>
        </motion.div>
      </div>
    </section>
  );
}
