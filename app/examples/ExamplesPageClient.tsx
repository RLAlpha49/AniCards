"use client";

import { motion } from "framer-motion";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import type React from "react";
import {
  useCallback,
  useDeferredValue,
  useEffect,
  useMemo,
  useState,
} from "react";

import { ErrorBoundary } from "@/components/ErrorBoundary";
import {
  CategoryNavigation,
  CategorySection,
  CTASection,
  type ExampleCardType,
  type ExampleCategory,
  type ExamplesCatalogPayload,
  type ExamplesCatalogSummary,
  ExamplesHeroSection,
  SearchFilterBar,
} from "@/components/examples";
import { usePreviewColorPreset } from "@/hooks/usePreviewColorPreset";
import { fadeUp, VIEWPORT_ONCE } from "@/lib/animations";
import {
  buildExamplesCollectionPath,
  buildExamplesGalleryPath,
  buildExamplesIndexPath,
  EXAMPLES_LEGACY_CATEGORY_QUERY_PARAM,
  EXAMPLES_SEARCH_QUERY_PARAM,
} from "@/lib/examples-collections";
import { type SearchLaunchDiscoveryContextInput } from "@/lib/user-page-settings-templates";
const SEARCH_URL_SYNC_DELAY_MS = 180;

function normalizeExamplesSearchText(value: string): string {
  return value
    .toLowerCase()
    .replaceAll(/[^a-z0-9]+/g, " ")
    .trim();
}

function buildSearchQueryString(
  searchParamsString: string,
  searchQuery: string,
  legacyCategory?: ExampleCategory | null,
): string {
  const params = new URLSearchParams(searchParamsString);
  const trimmedSearchQuery = searchQuery.trim();

  if (trimmedSearchQuery.length > 0) {
    params.set(EXAMPLES_SEARCH_QUERY_PARAM, trimmedSearchQuery);
  } else {
    params.delete(EXAMPLES_SEARCH_QUERY_PARAM);
  }

  if (legacyCategory) {
    params.set(EXAMPLES_LEGACY_CATEGORY_QUERY_PARAM, legacyCategory);
  } else {
    params.delete(EXAMPLES_LEGACY_CATEGORY_QUERY_PARAM);
  }

  return params.toString();
}

function normalizeQueryStringForComparison(queryString: string): string {
  const params = new URLSearchParams(queryString);

  return Array.from(params.entries())
    .sort(([leftKey, leftValue], [rightKey, rightValue]) => {
      if (leftKey === rightKey) {
        return leftValue.localeCompare(rightValue);
      }

      return leftKey.localeCompare(rightKey);
    })
    .map(
      ([key, value]) =>
        `${encodeURIComponent(key)}=${encodeURIComponent(value)}`,
    )
    .join("&");
}

function areEquivalentQueryStrings(
  leftQueryString: string,
  rightQueryString: string,
): boolean {
  return (
    normalizeQueryStringForComparison(leftQueryString) ===
    normalizeQueryStringForComparison(rightQueryString)
  );
}

function buildCategoryBuckets(
  categories: readonly ExampleCategory[],
  cardTypes: readonly ExampleCardType[],
) {
  const byCategory = new Map<ExampleCategory, ExampleCardType[]>(
    categories.map((category) => [category, []]),
  );

  for (const cardType of cardTypes) {
    byCategory.get(cardType.category)?.push(cardType);
  }

  const orderedBuckets = categories.map((category) => ({
    category,
    cardTypes: byCategory.get(category) ?? [],
  }));

  return {
    orderedBuckets,
    byCategory,
    countByCategory: new Map(
      orderedBuckets.map((bucket) => [
        bucket.category,
        bucket.cardTypes.length,
      ]),
    ),
  };
}

interface ExamplesPageClientProps {
  summary: ExamplesCatalogSummary;
  catalog?: ExamplesCatalogPayload;
  routeKind: "index" | "gallery" | "collection" | "legacy";
  activeCategory?: ExampleCategory | null;
  indexContent?: React.ReactNode;
  routeHeaderContent?: React.ReactNode;
}

export default function ExamplesPageClient({
  summary,
  catalog,
  routeKind,
  activeCategory = null,
  indexContent,
  routeHeaderContent,
}: Readonly<ExamplesPageClientProps>) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const searchParamsString = searchParams.toString();
  const [hasMounted, setHasMounted] = useState(false);
  const isIndexRoute = routeKind === "index";
  const isLegacyRoute = routeKind === "legacy";
  const currentActiveCategory = activeCategory;
  const [searchQuery, setSearchQuery] = useState(
    () => searchParams.get(EXAMPLES_SEARCH_QUERY_PARAM) ?? "",
  );
  const deferredSearchQuery = useDeferredValue(searchQuery);
  const previewColorPreset = usePreviewColorPreset();

  useEffect(() => {
    setHasMounted(true);
  }, []);

  const replaceQueryString = useCallback(
    (nextQueryString: string) => {
      if (areEquivalentQueryStrings(nextQueryString, searchParamsString)) {
        return;
      }

      const queryStringPrefix = nextQueryString ? `?${nextQueryString}` : "";
      const nextUrl = `${pathname}${queryStringPrefix}${globalThis.location.hash}`;

      globalThis.history.replaceState(null, "", nextUrl);
    },
    [pathname, searchParamsString],
  );

  useEffect(() => {
    const nextSearchQuery = searchParams.get(EXAMPLES_SEARCH_QUERY_PARAM) ?? "";

    setSearchQuery((currentSearchQuery) =>
      currentSearchQuery === nextSearchQuery
        ? currentSearchQuery
        : nextSearchQuery,
    );
  }, [searchParams]);

  useEffect(() => {
    const nextQueryString = buildSearchQueryString(
      searchParamsString,
      searchQuery,
      isLegacyRoute ? currentActiveCategory : null,
    );

    if (areEquivalentQueryStrings(nextQueryString, searchParamsString)) {
      return;
    }

    const timeoutId = globalThis.window.setTimeout(() => {
      replaceQueryString(nextQueryString);
    }, SEARCH_URL_SYNC_DELAY_MS);

    return () => {
      globalThis.window.clearTimeout(timeoutId);
    };
  }, [
    currentActiveCategory,
    isLegacyRoute,
    replaceQueryString,
    searchParamsString,
    searchQuery,
  ]);

  const handleSearchChange = useCallback((value: string) => {
    setSearchQuery(value);
  }, []);

  const handleClearFilters = useCallback(() => {
    setSearchQuery("");
    replaceQueryString(
      buildSearchQueryString(
        searchParamsString,
        "",
        isLegacyRoute ? currentActiveCategory : null,
      ),
    );
  }, [
    currentActiveCategory,
    isLegacyRoute,
    replaceQueryString,
    searchParamsString,
  ]);

  const normalizedSearchQuery = useMemo(
    () => normalizeExamplesSearchText(deferredSearchQuery),
    [deferredSearchQuery],
  );

  const searchMatchedCardTypes = useMemo(() => {
    if (!catalog) {
      return [];
    }

    if (normalizedSearchQuery.length === 0) {
      return catalog.cardTypes;
    }

    return catalog.cardTypes.filter((card) =>
      card.searchText.includes(normalizedSearchQuery),
    );
  }, [catalog, normalizedSearchQuery]);

  const searchMatchedCategoryBuckets = useMemo(
    () => buildCategoryBuckets(summary.categories, searchMatchedCardTypes),
    [searchMatchedCardTypes, summary.categories],
  );

  const hasActiveFilters = normalizedSearchQuery.length > 0;

  const filteredCardTypes = useMemo(() => {
    if (!currentActiveCategory) {
      return searchMatchedCardTypes;
    }

    return (
      searchMatchedCategoryBuckets.byCategory.get(currentActiveCategory) ?? []
    );
  }, [
    currentActiveCategory,
    searchMatchedCardTypes,
    searchMatchedCategoryBuckets,
  ]);

  const currentSearchQuery = useMemo(() => {
    const trimmedSearchQuery = searchQuery.trim();

    return trimmedSearchQuery || undefined;
  }, [searchQuery]);

  const navigationCategoryInfo = useMemo(() => {
    return summary.categoryInfo.map((categoryInfo) => ({
      ...categoryInfo,
      href: isLegacyRoute
        ? buildExamplesIndexPath({
            search: currentSearchQuery,
            category: categoryInfo.name,
          })
        : buildExamplesCollectionPath(categoryInfo.slug, {
            search: currentSearchQuery,
          }),
      count:
        routeKind === "collection"
          ? categoryInfo.count
          : (searchMatchedCategoryBuckets.countByCategory.get(
              categoryInfo.name,
            ) ?? 0),
    }));
  }, [
    currentSearchQuery,
    isLegacyRoute,
    routeKind,
    searchMatchedCategoryBuckets,
    summary.categoryInfo,
  ]);

  const categoryInfoByName = useMemo(
    () =>
      new Map(
        navigationCategoryInfo.map((category) => [category.name, category]),
      ),
    [navigationCategoryInfo],
  );

  const currentCategoryInfo = currentActiveCategory
    ? (categoryInfoByName.get(currentActiveCategory) ?? null)
    : null;
  const currentDiscoveryQueryString = useMemo(
    () =>
      buildSearchQueryString(
        searchParamsString,
        searchQuery,
        isLegacyRoute ? currentActiveCategory : null,
      ),
    [currentActiveCategory, isLegacyRoute, searchParamsString, searchQuery],
  );
  const currentDiscoveryHref = useMemo(
    () =>
      currentDiscoveryQueryString
        ? `${pathname}?${currentDiscoveryQueryString}`
        : pathname,
    [currentDiscoveryQueryString, pathname],
  );
  const currentDiscoveryContext = useMemo<SearchLaunchDiscoveryContextInput>(
    () => ({
      source: "examples",
      href: currentDiscoveryHref,
      routeKind,
      collectionName:
        currentCategoryInfo?.name ?? currentActiveCategory ?? undefined,
      collectionSlug: currentCategoryInfo?.slug,
      searchQuery: currentSearchQuery,
    }),
    [
      currentActiveCategory,
      currentDiscoveryHref,
      currentCategoryInfo?.name,
      currentCategoryInfo?.slug,
      currentSearchQuery,
      routeKind,
    ],
  );

  const shouldRenderExpandedGallery = !isIndexRoute;
  const shouldRenderCollectionChooser = isIndexRoute;
  const galleryHref = useMemo(
    () =>
      isLegacyRoute
        ? buildExamplesIndexPath({
            search: currentSearchQuery,
          })
        : buildExamplesGalleryPath({
            search: currentSearchQuery,
          }),
    [currentSearchQuery, isLegacyRoute],
  );
  const allCategoriesHref = useMemo(
    () => (currentActiveCategory ? galleryHref : currentDiscoveryHref),
    [currentActiveCategory, currentDiscoveryHref, galleryHref],
  );

  const emptyStateDescription =
    normalizedSearchQuery.length > 0
      ? "Try another card title, variant, category, or collection phrase."
      : "Your filters came up empty. Try loosening the search or picking a different category.";

  let galleryContent: React.ReactNode;

  if (shouldRenderCollectionChooser) {
    galleryContent = (
      <section
        aria-labelledby="gallery-collections-heading"
        className="space-y-10"
      >
        {indexContent ?? (
          <>
            <div className="mx-auto max-w-3xl text-center">
              <p className="mb-3 text-xs tracking-[0.4em] text-gold/55 uppercase">
                Browse by collection
              </p>
              <h2
                id="gallery-collections-heading"
                className="font-display text-3xl tracking-[0.12em] text-foreground sm:text-4xl"
              >
                PICK A SLICE OF THE GALLERY
              </h2>
              <p className="
                mx-auto mt-5 max-w-2xl font-body-serif text-sm/relaxed text-foreground/42
                sm:text-base/relaxed
              ">
                Open the category you care about, or load the full wall if you
                want every preview on one gloriously oversized canvas.
              </p>
            </div>

            <div className="grid gap-5 lg:grid-cols-2 xl:grid-cols-3">
              {summary.categoryInfo.map((category) => (
                <Link
                  key={category.name}
                  href={category.href}
                  className="
                    group rounded-sm border border-gold/10 bg-gold/3 p-6 text-left transition-all
                    duration-300
                    hover:border-gold/30 hover:bg-gold/6
                    focus-visible:ring-2 focus-visible:ring-gold/50 focus-visible:ring-offset-2
                    focus-visible:ring-offset-background focus-visible:outline-none
                  "
                >
                  <div className="mb-4 flex items-center justify-between gap-4">
                    <span className="
                      font-display text-[0.65rem] tracking-[0.35em] text-gold/50 uppercase
                    ">
                      {category.indexLabel}
                    </span>
                    <span className="text-xs text-foreground/25 tabular-nums">
                      {category.count} types · {category.variantCount} variants
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
                    mt-6 inline-flex text-xs font-semibold tracking-[0.18em] text-gold uppercase
                  ">
                    Open collection
                  </span>
                </Link>
              ))}
            </div>

            <div className="flex justify-center">
              <Link
                href={buildExamplesGalleryPath()}
                className="
                  border border-gold/20 px-5 py-3 text-xs font-semibold tracking-[0.18em] text-gold
                  uppercase transition-colors
                  hover:border-gold/40 hover:bg-gold/6
                  focus-visible:ring-2 focus-visible:ring-gold/50 focus-visible:ring-offset-2
                  focus-visible:ring-offset-background focus-visible:outline-none
                "
              >
                Load the full gallery
              </Link>
            </div>
          </>
        )}
      </section>
    );
  } else if (currentCategoryInfo) {
    galleryContent = (
      <CategorySection
        key={currentCategoryInfo.name}
        category={currentCategoryInfo.name}
        categoryInfo={currentCategoryInfo}
        cardTypes={filteredCardTypes}
        isFirstCategory={true}
        previewColorPreset={previewColorPreset}
        discoveryContext={currentDiscoveryContext}
        showCollectionLink={false}
      />
    );
  } else if (catalog) {
    galleryContent = searchMatchedCategoryBuckets.orderedBuckets.reduce<
      React.ReactNode[]
    >((nodes, bucket) => {
      if (bucket.cardTypes.length === 0) {
        return nodes;
      }

      const isFirstVisibleCategory = nodes.length === 0;

      if (!isFirstVisibleCategory) {
        nodes.push(
          <div
            key={`divider-${bucket.category}`}
            className="flex items-center justify-center gap-3"
          >
            <div className="gold-line max-w-16 flex-1" />
            <div className="size-1 rotate-45 border border-[hsl(var(--gold)/0.25)]" />
            <div className="gold-line max-w-16 flex-1" />
          </div>,
        );
      }

      const sectionCategoryInfo = categoryInfoByName.get(bucket.category);

      if (!sectionCategoryInfo) {
        return nodes;
      }

      nodes.push(
        <CategorySection
          key={bucket.category}
          category={bucket.category}
          categoryInfo={sectionCategoryInfo}
          cardTypes={bucket.cardTypes}
          isFirstCategory={isFirstVisibleCategory}
          previewColorPreset={previewColorPreset}
          discoveryContext={currentDiscoveryContext}
          showCollectionLink={routeKind === "gallery"}
        />,
      );
      return nodes;
    }, []);
  } else {
    galleryContent = null;
  }

  return (
    <ErrorBoundary
      resetKeys={[searchQuery, currentActiveCategory ?? ""]}
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
          className="
            pointer-events-none absolute inset-0 marketing-backdrop-light opacity-30
            dark:hidden
          "
        />
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 0.3 }}
          transition={{ duration: 1.2, ease: "easeOut" }}
          className="
            pointer-events-none absolute inset-0 hidden marketing-backdrop-dark opacity-20
            dark:block
          "
        />

        {routeKind === "collection" && routeHeaderContent ? (
          routeHeaderContent
        ) : (
          <ExamplesHeroSection
            totalCardTypes={catalog?.totalCardTypes ?? summary.totalCardTypes}
            totalVariants={catalog?.totalVariants ?? summary.totalVariants}
            categoryCount={summary.categories.length}
            discoveryContext={currentDiscoveryContext}
          />
        )}

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

        {catalog && (
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
                  categories={navigationCategoryInfo}
                  activeCategory={currentActiveCategory}
                  allHref={allCategoriesHref}
                />
              </div>
            </div>
          </motion.div>
        )}

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
              {galleryContent}

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
                      {emptyStateDescription}
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
          <CTASection discoveryContext={currentDiscoveryContext} />
        </motion.div>
      </div>
    </ErrorBoundary>
  );
}
