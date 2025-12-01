"use client";

import { useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Card, CardContent } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { ImageWithSkeleton } from "@/components/ImageWithSkeleton";
import { Play, ArrowRight, ChevronLeft, ChevronRight } from "lucide-react";
import Link from "next/link";
import { cn, buildApiUrl } from "@/lib/utils";

/**
 * Props for the preview showcase component.
 * @property onGetStarted - Handler to open the card creation flow from a preview.
 * @source
 */
interface PreviewShowcaseProps {
  onGetStarted: () => void;
}

/**
 * Categories for filtering preview cards.
 * @source
 */
type CategoryId = "all" | "stats" | "analysis" | "social" | "deep-dive";

/**
 * Category metadata for the filter tabs.
 * @source
 */
interface Category {
  id: CategoryId;
  label: string;
}

const CATEGORIES: Category[] = [
  { id: "all", label: "All Cards" },
  { id: "stats", label: "Statistics" },
  { id: "analysis", label: "Analysis" },
  { id: "social", label: "Social" },
  { id: "deep-dive", label: "Deep Dive" },
];

/**
 * Representation of a preview card used by the showcase list.
 * @source
 */
type PreviewCard = {
  title: string;
  description: string;
  cardType: string;
  variation: string;
  category: CategoryId;
  gradient: string;
  featured?: boolean;
};

/**
 * Example preview cards showcased on the landing page.
 * @source
 */
const PREVIEW_CARDS: PreviewCard[] = [
  {
    title: "Anime Statistics",
    description: "Complete overview of your anime watching journey",
    cardType: "animeStats",
    variation: "default",
    category: "stats",
    gradient: "from-blue-500 to-cyan-500",
    featured: true,
  },
  {
    title: "Manga Statistics",
    description: "Comprehensive manga reading statistics",
    cardType: "mangaStats",
    variation: "default",
    category: "stats",
    gradient: "from-pink-500 to-rose-500",
    featured: true,
  },
  {
    title: "Genre Distribution",
    description: "Beautiful visualization of your favorite genres",
    cardType: "animeGenres",
    variation: "pie",
    category: "analysis",
    gradient: "from-purple-500 to-violet-500",
  },
  {
    title: "Social Activity",
    description: "Community engagement and social metrics",
    cardType: "socialStats",
    variation: "default",
    category: "social",
    gradient: "from-green-500 to-emerald-500",
  },
  {
    title: "Voice Actors",
    description: "Most frequent voice actors in your anime",
    cardType: "animeVoiceActors",
    variation: "default",
    category: "deep-dive",
    gradient: "from-orange-500 to-amber-500",
  },
  {
    title: "Score Distribution",
    description: "How you rate anime with detailed charts",
    cardType: "animeScoreDistribution",
    variation: "default",
    category: "analysis",
    gradient: "from-indigo-500 to-blue-500",
  },
  {
    title: "Animation Studios",
    description: "See which studios produce your favorites",
    cardType: "animeStudios",
    variation: "pie",
    category: "deep-dive",
    gradient: "from-teal-500 to-cyan-500",
  },
  {
    title: "Tag Analysis",
    description: "Discover patterns in your anime preferences",
    cardType: "animeTags",
    variation: "bar",
    category: "analysis",
    gradient: "from-fuchsia-500 to-pink-500",
  },
];

/**
 * Renders the previews grid showing sample cards and an option to create them.
 * @source
 */
export function PreviewShowcase({
  onGetStarted,
}: Readonly<PreviewShowcaseProps>) {
  const BASE_URL = buildApiUrl("/card.svg");
  const USER_ID = "542244";

  const [activeCategory, setActiveCategory] = useState<CategoryId>("all");
  const [currentPage, setCurrentPage] = useState(0);

  const filteredCards = useMemo(() => {
    if (activeCategory === "all") return PREVIEW_CARDS;
    return PREVIEW_CARDS.filter((card) => card.category === activeCategory);
  }, [activeCategory]);

  const cardsPerPage = 6;
  const totalPages = Math.ceil(filteredCards.length / cardsPerPage);
  const paginatedCards = filteredCards.slice(
    currentPage * cardsPerPage,
    (currentPage + 1) * cardsPerPage,
  );

  const handleCategoryChange = (category: CategoryId) => {
    setActiveCategory(category);
    setCurrentPage(0);
  };

  return (
    <section
      id="preview-showcase"
      className="relative w-full overflow-hidden py-24 lg:py-32"
    >
      <div className="container relative mx-auto px-4">
        <div className="mx-auto max-w-7xl">
          {/* Section header */}
          <div className="mb-12 text-center lg:mb-16">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              className="mb-4"
            >
              <span className="inline-block rounded-full bg-purple-100 px-4 py-1.5 text-sm font-medium text-purple-700 dark:bg-purple-900/30 dark:text-purple-300">
                Card Gallery
              </span>
            </motion.div>

            <motion.h2
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.1 }}
              className="mb-4 text-3xl font-bold text-slate-900 dark:text-white sm:text-4xl lg:text-5xl"
            >
              Over{" "}
              <span className="bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
                20+ Card Types
              </span>{" "}
              to Choose From
            </motion.h2>

            <motion.p
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.2 }}
              className="mx-auto max-w-2xl text-lg text-slate-600 dark:text-slate-300"
            >
              From basic stats to detailed breakdowns — visualize every aspect
              of your anime and manga journey with beautiful, customizable
              cards.
            </motion.p>
          </div>

          {/* Category filters */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.3 }}
            className="mb-10 flex flex-wrap items-center justify-center gap-2"
          >
            {CATEGORIES.map((category) => (
              <button
                key={category.id}
                type="button"
                onClick={() => handleCategoryChange(category.id)}
                className={cn(
                  "rounded-full px-5 py-2 text-sm font-medium transition-all",
                  activeCategory === category.id
                    ? "bg-slate-900 text-white shadow-lg dark:bg-white dark:text-slate-900"
                    : "bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700",
                )}
              >
                {category.label}
              </button>
            ))}
          </motion.div>

          {/* Cards grid */}
          <AnimatePresence mode="wait">
            <motion.div
              key={`${activeCategory}-${currentPage}`}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.3 }}
              className="grid grid-cols-1 justify-items-center gap-6 sm:grid-cols-2 lg:grid-cols-3"
            >
              {paginatedCards.map((card, index) => (
                <motion.div
                  key={card.cardType + card.variation}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.05 }}
                  className="group w-full"
                >
                  <Card className="h-full overflow-hidden border-0 bg-white/80 shadow-lg shadow-slate-200/50 backdrop-blur-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-xl dark:bg-slate-800/80 dark:shadow-slate-900/50">
                    <CardContent className="p-0">
                      {/* Card image container */}
                      <div className="relative justify-items-center overflow-hidden bg-gradient-to-br from-slate-100 to-slate-50 p-6 dark:from-slate-900 dark:to-slate-800">
                        {/* Gradient accent */}
                        <div
                          className={cn(
                            "absolute -right-10 -top-10 h-32 w-32 rounded-full bg-gradient-to-r opacity-20 blur-2xl transition-all group-hover:scale-150 group-hover:opacity-30",
                            card.gradient,
                          )}
                        />

                        <ImageWithSkeleton
                          src={`${BASE_URL}?cardType=${card.cardType}&userId=${USER_ID}&variation=${card.variation}`}
                          alt={card.title}
                          className="relative h-auto w-full rounded-lg shadow-sm transition-transform duration-300 group-hover:scale-[1.02]"
                        />

                        {/* Hover overlay */}
                        <div className="absolute inset-0 flex items-center justify-center bg-slate-900/0 transition-colors duration-300 group-hover:bg-slate-900/60">
                          <Button
                            onClick={onGetStarted}
                            className="translate-y-4 rounded-full bg-white text-slate-900 opacity-0 shadow-lg transition-all duration-300 hover:bg-slate-100 group-hover:translate-y-0 group-hover:opacity-100"
                          >
                            <Play className="mr-2 h-4 w-4 fill-current" />
                            Create This Card
                          </Button>
                        </div>
                      </div>

                      {/* Card info */}
                      <div className="p-5">
                        <div className="mb-2 flex items-start justify-between gap-2">
                          <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                            {card.title}
                          </h3>
                          {card.featured && (
                            <span className="shrink-0 rounded-full bg-gradient-to-r from-amber-400 to-orange-400 px-2 py-0.5 text-xs font-medium text-white">
                              Popular
                            </span>
                          )}
                        </div>
                        <p className="text-sm text-slate-600 dark:text-slate-400">
                          {card.description}
                        </p>
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              ))}
            </motion.div>
          </AnimatePresence>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="mt-10 flex items-center justify-center gap-4">
              <Button
                variant="outline"
                size="icon"
                onClick={() => setCurrentPage((p) => Math.max(0, p - 1))}
                disabled={currentPage === 0}
                className="h-10 w-10 rounded-full"
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>

              <div className="flex items-center gap-2">
                {Array.from({ length: totalPages }).map((_, i) => (
                  <button
                    key={`page-indicator-${i}-of-${totalPages}`}
                    type="button"
                    onClick={() => setCurrentPage(i)}
                    className={cn(
                      "h-2 rounded-full transition-all",
                      currentPage === i
                        ? "w-6 bg-slate-900 dark:bg-white"
                        : "w-2 bg-slate-300 hover:bg-slate-400 dark:bg-slate-600 dark:hover:bg-slate-500",
                    )}
                  />
                ))}
              </div>

              <Button
                variant="outline"
                size="icon"
                onClick={() =>
                  setCurrentPage((p) => Math.min(totalPages - 1, p + 1))
                }
                disabled={currentPage === totalPages - 1}
                className="h-10 w-10 rounded-full"
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          )}

          {/* View all link */}
          <motion.div
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            className="mt-12 text-center"
          >
            <Link href="/examples">
              <Button
                variant="outline"
                size="lg"
                className="group rounded-full border-2 px-8 text-lg font-medium"
              >
                View All Card Types
                <ArrowRight className="ml-2 h-5 w-5 transition-transform group-hover:translate-x-1" />
              </Button>
            </Link>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
