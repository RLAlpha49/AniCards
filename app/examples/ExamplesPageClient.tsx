"use client";

import { motion } from "framer-motion";
import type React from "react";
import { useCallback, useMemo, useState } from "react";

import { ErrorBoundary } from "@/components/ErrorBoundary";
import {
  CategoryNavigation,
  CategorySection,
  CTASection,
  type ExampleCategory,
  type ExamplesCatalogPayload,
  ExamplesHeroSection,
  SearchFilterBar,
} from "@/components/examples";
import { usePreviewColorPreset } from "@/hooks/usePreviewColorPreset";
import { fadeUp, VIEWPORT_ONCE } from "@/lib/animations";
const SEARCH_PAGE_HREF = "/search";

interface ExamplesPageClientProps {
  catalog: ExamplesCatalogPayload;
}

export default function ExamplesPageClient({
  catalog,
}: Readonly<ExamplesPageClientProps>) {
  const [searchQuery, setSearchQuery] = useState("");
  const [activeCategory, setActiveCategory] = useState<ExampleCategory | null>(
    null,
  );
  const previewColorPreset = usePreviewColorPreset();

  const handleSearchChange = useCallback((value: string) => {
    setSearchQuery(value);
  }, []);

  const handleCategoryChange = useCallback(
    (category: string | null) => {
      if (category === null) {
        setActiveCategory(null);
        return;
      }

      if (catalog.categories.includes(category as ExampleCategory)) {
        setActiveCategory(category as ExampleCategory);
      }
    },
    [catalog.categories],
  );

  const handleClearFilters = useCallback(() => {
    setSearchQuery("");
    setActiveCategory(null);
  }, []);

  const hasActiveFilters = searchQuery.length > 0 || activeCategory !== null;

  const filteredCardTypes = useMemo(() => {
    let filtered = catalog.cardTypes;

    if (activeCategory) {
      filtered = filtered.filter((card) => card.category === activeCategory);
    }

    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (card) =>
          card.title.toLowerCase().includes(query) ||
          card.description.toLowerCase().includes(query),
      );
    }

    return filtered;
  }, [catalog.cardTypes, searchQuery, activeCategory]);

  return (
    <ErrorBoundary
      resetKeys={[searchQuery, activeCategory ?? ""]}
      onReset={() => {
        setSearchQuery("");
        setActiveCategory(null);
      }}
    >
      <div className="relative min-h-screen">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 0.5 }}
          transition={{ duration: 1.2, ease: "easeOut" }}
          className="pointer-events-none absolute inset-0 opacity-30 dark:hidden"
          style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M30 0L60 30L30 60L0 30Z' fill='none' stroke='%23a67c1a2e' stroke-width='1'/%3E%3C/svg%3E")`,
          }}
        />
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 0.3 }}
          transition={{ duration: 1.2, ease: "easeOut" }}
          className="pointer-events-none absolute inset-0 hidden opacity-20 dark:block"
          style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M30 0L60 30L30 60L0 30Z' fill='none' stroke='%23c9a84c15' stroke-width='1'/%3E%3C/svg%3E")`,
          }}
        />

        <ExamplesHeroSection
          totalCardTypes={catalog.totalCardTypes}
          totalVariants={catalog.totalVariants}
          categoryCount={catalog.categories.length}
          createHref={SEARCH_PAGE_HREF}
        />

        <motion.div
          variants={fadeUp}
          initial="hidden"
          whileInView="visible"
          viewport={VIEWPORT_ONCE}
          className="flex items-center justify-center gap-4 py-2"
        >
          <div className="gold-line max-w-24 flex-1" />
          <div className="size-1 rotate-45 bg-[hsl(var(--gold)/0.3)]" />
          <div className="gold-line-thick max-w-32 flex-1" />
          <div className="size-1 rotate-45 bg-[hsl(var(--gold)/0.3)]" />
          <div className="gold-line max-w-24 flex-1" />
        </motion.div>

        <motion.div
          variants={fadeUp}
          initial="hidden"
          whileInView="visible"
          viewport={VIEWPORT_ONCE}
          className="sticky top-15 z-30 mx-auto mt-6 max-w-7xl px-4"
        >
          <div className="border border-gold/8 bg-background/85 backdrop-blur-xl">
            <div className="px-5 pt-4 pb-0">
              <div className="mb-3">
                <SearchFilterBar
                  searchQuery={searchQuery}
                  onSearchChange={handleSearchChange}
                  resultCount={filteredCardTypes.length}
                  totalCount={catalog.totalCardTypes}
                  hasActiveFilters={hasActiveFilters}
                  onClearFilters={handleClearFilters}
                />
              </div>
              <CategoryNavigation
                categories={catalog.categoryInfo}
                activeCategory={activeCategory}
                onCategoryClick={handleCategoryChange}
              />
            </div>
          </div>
        </motion.div>

        <motion.section
          variants={fadeUp}
          initial="hidden"
          whileInView="visible"
          viewport={VIEWPORT_ONCE}
          id="card-gallery"
          className="relative w-full py-20 lg:py-24"
        >
          <div className="relative container mx-auto px-4">
            <div className="mx-auto max-w-7xl space-y-28">
              {activeCategory ? (
                <CategorySection
                  key={activeCategory}
                  category={activeCategory}
                  cardTypes={filteredCardTypes}
                  isFirstCategory={true}
                  previewColorPreset={previewColorPreset}
                />
              ) : (
                catalog.categories.reduce<React.ReactNode[]>(
                  (nodes, category, categoryIndex) => {
                    const categoryCardTypes = filteredCardTypes.filter(
                      (card) => card.category === category,
                    );
                    if (categoryCardTypes.length === 0) return nodes;

                    if (nodes.length > 0) {
                      nodes.push(
                        <div
                          key={`divider-${category}`}
                          className="flex items-center justify-center gap-3"
                        >
                          <div className="gold-line max-w-16 flex-1" />
                          <div className="size-1 rotate-45 border border-[hsl(var(--gold)/0.25)]" />
                          <div className="gold-line max-w-16 flex-1" />
                        </div>,
                      );
                    }

                    nodes.push(
                      <CategorySection
                        key={category}
                        category={category}
                        cardTypes={categoryCardTypes}
                        isFirstCategory={categoryIndex === 0}
                        previewColorPreset={previewColorPreset}
                      />,
                    );
                    return nodes;
                  },
                  [],
                )
              )}

              {filteredCardTypes.length === 0 && (
                <div className="py-32 text-center">
                  <div className="
                    mb-4 font-display text-7xl font-black text-foreground/6 select-none
                    sm:text-8xl
                  ">
                    ∅
                  </div>
                  <p className="
                    mb-2 font-display text-base tracking-[0.25em] text-foreground/20 uppercase
                  ">
                    Nothing Here
                  </p>
                  <p className="mx-auto max-w-xs font-body-serif text-sm/relaxed text-foreground/30">
                    Your filters came up empty. Try loosening the search or
                    picking a different category.
                  </p>
                  <button
                    type="button"
                    onClick={handleClearFilters}
                    className="
                      mt-8 text-xs font-semibold tracking-widest text-gold uppercase
                      transition-colors
                      hover:text-gold/80 hover:underline
                    "
                  >
                    Start fresh
                  </button>
                </div>
              )}
            </div>
          </div>
        </motion.section>

        <motion.div
          variants={fadeUp}
          initial="hidden"
          whileInView="visible"
          viewport={VIEWPORT_ONCE}
        >
          <CTASection createHref={SEARCH_PAGE_HREF} />
        </motion.div>
      </div>
    </ErrorBoundary>
  );
}
