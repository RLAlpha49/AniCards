"use client";

import { motion } from "framer-motion";
import { usePathname, useSearchParams } from "next/navigation";
import type React from "react";
import { useCallback, useEffect, useMemo, useState } from "react";

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
const SEARCH_QUERY_PARAM = "search";
const CATEGORY_QUERY_PARAM = "category";
const EXAMPLES_CATEGORY_DESCRIPTIONS: Record<ExampleCategory, string> = {
  "Core Stats":
    "Start with the headline cards that summarize anime, manga, social, and profile-level stats before you dive into the more obsessive breakdowns.",
  "Anime Deep Dive":
    "Open the anime collection when you want a denser read on genres, studios, voice actors, scores, seasons, and the patterns buried in your watch history.",
  "Manga Deep Dive":
    "This collection focuses on reading habits, format splits, staff patterns, score spread, and the recurring traits that shape a manga-heavy profile.",
  "Activity & Engagement":
    "Use these cards to zoom in on recency, streaks, milestones, reviews, and the pace of your public AniList activity over time.",
  "Library & Progress":
    "These layouts surface favourites, backlog pressure, current titles, milestone moments, and the broader shape of a working library.",
  "Advanced Analytics":
    "When you want the comparison layer, this collection pairs anime and manga habits side by side so long-term preferences become easier to spot.",
};

function parseExampleCategory(
  category: string | null,
  categories: ReadonlySet<ExampleCategory>,
): ExampleCategory | null {
  if (!category) {
    return null;
  }

  return categories.has(category as ExampleCategory)
    ? (category as ExampleCategory)
    : null;
}

function buildFilterQueryString(
  searchParams: Pick<URLSearchParams, "toString">,
  searchQuery: string,
  activeCategory: ExampleCategory | null,
): string {
  const params = new URLSearchParams(searchParams.toString());

  if (searchQuery.length > 0) {
    params.set(SEARCH_QUERY_PARAM, searchQuery);
  } else {
    params.delete(SEARCH_QUERY_PARAM);
  }

  if (activeCategory) {
    params.set(CATEGORY_QUERY_PARAM, activeCategory);
  } else {
    params.delete(CATEGORY_QUERY_PARAM);
  }

  return params.toString();
}

interface ExamplesPageClientProps {
  catalog: ExamplesCatalogPayload;
}

export default function ExamplesPageClient({
  catalog,
}: Readonly<ExamplesPageClientProps>) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [hasMounted, setHasMounted] = useState(false);
  const categorySet = useMemo(
    () => new Set<ExampleCategory>(catalog.categories),
    [catalog.categories],
  );
  const [searchQuery, setSearchQuery] = useState(
    () => searchParams.get(SEARCH_QUERY_PARAM) ?? "",
  );
  const [activeCategory, setActiveCategory] = useState<ExampleCategory | null>(
    () =>
      parseExampleCategory(searchParams.get(CATEGORY_QUERY_PARAM), categorySet),
  );
  const [showAllCollections, setShowAllCollections] = useState(false);
  const previewColorPreset = usePreviewColorPreset();

  useEffect(() => {
    setHasMounted(true);
  }, []);

  const replaceQueryString = useCallback(
    (nextQueryString: string) => {
      if (nextQueryString === searchParams.toString()) {
        return;
      }

      const queryStringPrefix = nextQueryString ? `?${nextQueryString}` : "";
      const nextUrl = `${pathname}${queryStringPrefix}${globalThis.location.hash}`;

      globalThis.history.replaceState(null, "", nextUrl);
    },
    [pathname, searchParams],
  );

  useEffect(() => {
    const nextSearchQuery = searchParams.get(SEARCH_QUERY_PARAM) ?? "";
    const nextActiveCategory = parseExampleCategory(
      searchParams.get(CATEGORY_QUERY_PARAM),
      categorySet,
    );

    setSearchQuery((currentSearchQuery) =>
      currentSearchQuery === nextSearchQuery
        ? currentSearchQuery
        : nextSearchQuery,
    );
    setActiveCategory((currentActiveCategory) =>
      currentActiveCategory === nextActiveCategory
        ? currentActiveCategory
        : nextActiveCategory,
    );

    if (nextSearchQuery.trim().length > 0 || nextActiveCategory !== null) {
      setShowAllCollections(false);
    }

    const normalizedQueryString = buildFilterQueryString(
      searchParams,
      nextSearchQuery,
      nextActiveCategory,
    );

    if (normalizedQueryString !== searchParams.toString()) {
      replaceQueryString(normalizedQueryString);
    }
  }, [categorySet, replaceQueryString, searchParams]);

  const handleSearchChange = useCallback(
    (value: string) => {
      setSearchQuery(value);
      replaceQueryString(
        buildFilterQueryString(searchParams, value, activeCategory),
      );
    },
    [activeCategory, replaceQueryString, searchParams],
  );

  const handleCategoryChange = useCallback(
    (category: string | null) => {
      const nextActiveCategory =
        category === null ? null : parseExampleCategory(category, categorySet);

      setActiveCategory(nextActiveCategory);
      setShowAllCollections(category === null);
      replaceQueryString(
        buildFilterQueryString(searchParams, searchQuery, nextActiveCategory),
      );
    },
    [categorySet, replaceQueryString, searchParams, searchQuery],
  );

  const handleClearFilters = useCallback(() => {
    setSearchQuery("");
    setActiveCategory(null);
    setShowAllCollections(false);
    replaceQueryString(buildFilterQueryString(searchParams, "", null));
  }, [replaceQueryString, searchParams]);

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

  const categorySummaries = useMemo(
    () =>
      catalog.categories.map((category) => {
        const categoryCardTypes = catalog.cardTypes.filter(
          (card) => card.category === category,
        );

        return {
          name: category,
          description: EXAMPLES_CATEGORY_DESCRIPTIONS[category],
          cardTypeCount: categoryCardTypes.length,
          variantCount: categoryCardTypes.reduce(
            (sum, cardType) => sum + cardType.variants.length,
            0,
          ),
        };
      }),
    [catalog.cardTypes, catalog.categories],
  );

  const shouldRenderExpandedGallery =
    searchQuery.trim().length > 0 ||
    activeCategory !== null ||
    showAllCollections;

  return (
    <ErrorBoundary
      resetKeys={[searchQuery, activeCategory ?? ""]}
      onReset={handleClearFilters}
    >
      <div
        className="relative min-h-screen"
        data-ui-ready={hasMounted ? "true" : "false"}
      >
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
              {!shouldRenderExpandedGallery ? (
                <section
                  aria-labelledby="gallery-collections-heading"
                  className="space-y-10"
                >
                  <div className="mx-auto max-w-3xl text-center">
                    <p className="mb-3 text-xs tracking-[0.4em] text-gold/55 uppercase">
                      Browse by collection
                    </p>
                    <h2
                      id="gallery-collections-heading"
                      className="
                        font-display text-3xl tracking-[0.12em] text-foreground
                        sm:text-4xl
                      "
                    >
                      PICK A SLICE OF THE GALLERY
                    </h2>
                    <p className="
                      mx-auto mt-5 max-w-2xl font-body-serif text-sm/relaxed text-foreground/42
                      sm:text-base/relaxed
                    ">
                      Open the category you care about, or load the full wall if
                      you want every preview on one gloriously oversized canvas.
                    </p>
                  </div>

                  <div className="grid gap-5 lg:grid-cols-2 xl:grid-cols-3">
                    {categorySummaries.map((category, index) => (
                      <button
                        key={category.name}
                        type="button"
                        onClick={() => handleCategoryChange(category.name)}
                        className="
                          group rounded-sm border border-gold/10 bg-gold/3 p-6 text-left
                          transition-all duration-300
                          hover:border-gold/30 hover:bg-gold/6
                          focus-visible:ring-2 focus-visible:ring-gold/50
                          focus-visible:ring-offset-2 focus-visible:ring-offset-background
                          focus-visible:outline-none
                        "
                      >
                        <div className="mb-4 flex items-center justify-between gap-4">
                          <span className="
                            font-display text-[0.65rem] tracking-[0.35em] text-gold/50 uppercase
                          ">
                            {String(index + 1).padStart(2, "0")}
                          </span>
                          <span className="text-xs text-foreground/25 tabular-nums">
                            {category.cardTypeCount} types ·{" "}
                            {category.variantCount} variants
                          </span>
                        </div>
                        <h3 className="
                          font-display text-lg tracking-[0.08em] text-foreground transition-colors
                          group-hover:text-gold/90
                        ">
                          {category.name}
                        </h3>
                        <p className="mt-4 font-body-serif text-sm/relaxed text-foreground/40">
                          {category.description}
                        </p>
                        <span className="
                          mt-6 inline-flex text-xs font-semibold tracking-[0.18em] text-gold
                          uppercase
                        ">
                          Open collection
                        </span>
                      </button>
                    ))}
                  </div>

                  <div className="flex justify-center">
                    <button
                      type="button"
                      onClick={() => setShowAllCollections(true)}
                      className="
                        border border-gold/20 px-5 py-3 text-xs font-semibold tracking-[0.18em]
                        text-gold uppercase transition-colors
                        hover:border-gold/40 hover:bg-gold/6
                        focus-visible:ring-2 focus-visible:ring-gold/50 focus-visible:ring-offset-2
                        focus-visible:ring-offset-background focus-visible:outline-none
                      "
                    >
                      Load the full gallery
                    </button>
                  </div>
                </section>
              ) : activeCategory ? (
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

              {shouldRenderExpandedGallery &&
                filteredCardTypes.length === 0 && (
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
                    <p className="
                      mx-auto max-w-xs font-body-serif text-sm/relaxed text-foreground/30
                    ">
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
