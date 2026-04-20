"use client";

import { motion } from "framer-motion";
import Link from "next/link";
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
  type ExamplesCatalogSummary,
  ExamplesHeroSection,
  SearchFilterBar,
} from "@/components/examples";
import { usePreviewColorPreset } from "@/hooks/usePreviewColorPreset";
import { fadeUp, VIEWPORT_ONCE } from "@/lib/animations";
import {
  buildExamplesCollectionPath,
  buildExamplesGalleryPath,
  EXAMPLES_LEGACY_CATEGORY_QUERY_PARAM,
  EXAMPLES_SEARCH_QUERY_PARAM,
  getExampleCollectionFromLegacyValue,
} from "@/lib/examples-collections";
import {
  rememberExamplesDiscoveryContext,
  type SearchLaunchDiscoveryContextInput,
} from "@/lib/user-page-settings-templates";

const SEARCH_PAGE_HREF = "/search";

function normalizeExamplesSearchText(value: string): string {
  return value
    .toLowerCase()
    .replaceAll(/[^a-z0-9]+/g, " ")
    .trim();
}

function parseExampleCategory(
  category: string | null,
  categories: ReadonlySet<ExampleCategory>,
): ExampleCategory | null {
  const collection = getExampleCollectionFromLegacyValue(category);

  if (!collection) {
    return null;
  }

  return categories.has(collection.name) ? collection.name : null;
}

function buildLegacyFilterQueryString(
  searchParams: Pick<URLSearchParams, "toString">,
  searchQuery: string,
  activeCategory: ExampleCategory | null,
): string {
  const params = new URLSearchParams(searchParams.toString());
  const trimmedSearchQuery = searchQuery.trim();

  if (trimmedSearchQuery.length > 0) {
    params.set(EXAMPLES_SEARCH_QUERY_PARAM, trimmedSearchQuery);
  } else {
    params.delete(EXAMPLES_SEARCH_QUERY_PARAM);
  }

  if (activeCategory) {
    params.set(EXAMPLES_LEGACY_CATEGORY_QUERY_PARAM, activeCategory);
  } else {
    params.delete(EXAMPLES_LEGACY_CATEGORY_QUERY_PARAM);
  }

  return params.toString();
}

function buildSearchQueryString(
  searchParams: Pick<URLSearchParams, "toString">,
  searchQuery: string,
): string {
  const params = new URLSearchParams(searchParams.toString());
  const trimmedSearchQuery = searchQuery.trim();

  if (trimmedSearchQuery.length > 0) {
    params.set(EXAMPLES_SEARCH_QUERY_PARAM, trimmedSearchQuery);
  } else {
    params.delete(EXAMPLES_SEARCH_QUERY_PARAM);
  }

  params.delete(EXAMPLES_LEGACY_CATEGORY_QUERY_PARAM);

  return params.toString();
}

function CollectionRouteHeader({
  categoryCount,
  collectionCount,
  description,
  fullGalleryHref,
  title,
  variantCount,
}: Readonly<{
  categoryCount: number;
  collectionCount: number;
  description: string;
  fullGalleryHref: string;
  title: string;
  variantCount: number;
}>) {
  return (
    <section className="relative px-6 pt-28 pb-16 sm:px-12 md:pt-32 md:pb-22">
      <div className="relative z-10 mx-auto max-w-5xl">
        <div className="
          mb-6 flex flex-wrap items-center gap-3 text-[0.65rem] font-semibold tracking-[0.25em]
          text-gold/70 uppercase
        ">
          <span>Collection</span>
          <span className="text-gold/30">•</span>
          <Link href="/examples" className="transition-colors hover:text-gold">
            Examples index
          </Link>
          <span className="text-gold/30">•</span>
          <Link
            href={fullGalleryHref}
            className="transition-colors hover:text-gold"
          >
            Full gallery
          </Link>
        </div>

        <h1 className="
          font-display text-4xl leading-[1.05] font-black tracking-tight
          sm:text-5xl
          md:text-6xl
          lg:text-7xl
        ">
          <span className="text-foreground">{title}</span>
        </h1>

        <p className="
          mt-6 max-w-3xl font-body-serif text-base/relaxed text-foreground/45
          sm:text-lg/relaxed
        ">
          {description}
        </p>

        <div className="mt-12 flex flex-wrap items-end gap-12 sm:gap-16">
          {[
            { value: collectionCount, label: "Card Types" },
            { value: variantCount, label: "Total Variants" },
            { value: categoryCount, label: "Collections" },
          ].map((stat) => (
            <div key={stat.label}>
              <p className="font-display text-3xl leading-none font-black text-gold sm:text-4xl">
                {stat.value}
              </p>
              <p className="mt-1.5 text-[0.6rem] tracking-[0.2em] text-foreground/30 uppercase">
                {stat.label}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

interface ExamplesPageClientProps {
  summary: ExamplesCatalogSummary;
  catalog?: ExamplesCatalogPayload;
  routeKind: "index" | "gallery" | "collection" | "legacy";
  activeCategory?: ExampleCategory | null;
}

export default function ExamplesPageClient({
  summary,
  catalog,
  routeKind,
  activeCategory = null,
}: Readonly<ExamplesPageClientProps>) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const searchParamsString = searchParams.toString();
  const [hasMounted, setHasMounted] = useState(false);
  const isIndexRoute = routeKind === "index";
  const isLegacyRoute = routeKind === "legacy";
  const categorySet = useMemo(
    () => new Set<ExampleCategory>(summary.categories),
    [summary.categories],
  );
  const [searchQuery, setSearchQuery] = useState(
    () => searchParams.get(EXAMPLES_SEARCH_QUERY_PARAM) ?? "",
  );
  const [legacyActiveCategory, setLegacyActiveCategory] =
    useState<ExampleCategory | null>(() =>
      isLegacyRoute
        ? parseExampleCategory(
            searchParams.get(EXAMPLES_LEGACY_CATEGORY_QUERY_PARAM),
            categorySet,
          )
        : null,
    );
  const previewColorPreset = usePreviewColorPreset();
  const currentActiveCategory = isLegacyRoute
    ? legacyActiveCategory
    : activeCategory;

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
    const nextSearchQuery = searchParams.get(EXAMPLES_SEARCH_QUERY_PARAM) ?? "";

    setSearchQuery((currentSearchQuery) =>
      currentSearchQuery === nextSearchQuery
        ? currentSearchQuery
        : nextSearchQuery,
    );

    if (!isLegacyRoute) {
      setLegacyActiveCategory(null);

      const normalizedQueryString = buildSearchQueryString(
        searchParams,
        nextSearchQuery,
      );

      if (normalizedQueryString !== searchParams.toString()) {
        replaceQueryString(normalizedQueryString);
      }

      return;
    }

    const nextActiveCategory = parseExampleCategory(
      searchParams.get(EXAMPLES_LEGACY_CATEGORY_QUERY_PARAM),
      categorySet,
    );

    setLegacyActiveCategory((currentCategory) =>
      currentCategory === nextActiveCategory
        ? currentCategory
        : nextActiveCategory,
    );

    const normalizedQueryString = buildLegacyFilterQueryString(
      searchParams,
      nextSearchQuery,
      nextActiveCategory,
    );

    if (normalizedQueryString !== searchParams.toString()) {
      replaceQueryString(normalizedQueryString);
    }
  }, [categorySet, isLegacyRoute, replaceQueryString, searchParams]);

  const handleSearchChange = useCallback(
    (value: string) => {
      setSearchQuery(value);
      replaceQueryString(
        isLegacyRoute
          ? buildLegacyFilterQueryString(
              searchParams,
              value,
              currentActiveCategory,
            )
          : buildSearchQueryString(searchParams, value),
      );
    },
    [currentActiveCategory, isLegacyRoute, replaceQueryString, searchParams],
  );

  const handleCategoryChange = useCallback(
    (category: string | null) => {
      if (!isLegacyRoute) {
        return;
      }

      const nextActiveCategory =
        category === null ? null : parseExampleCategory(category, categorySet);

      setLegacyActiveCategory(nextActiveCategory);
      replaceQueryString(
        buildLegacyFilterQueryString(
          searchParams,
          searchQuery,
          nextActiveCategory,
        ),
      );
    },
    [categorySet, isLegacyRoute, replaceQueryString, searchParams, searchQuery],
  );

  const handleClearFilters = useCallback(() => {
    setSearchQuery("");
    if (isLegacyRoute) {
      setLegacyActiveCategory(null);
      replaceQueryString(buildLegacyFilterQueryString(searchParams, "", null));
      return;
    }

    replaceQueryString(buildSearchQueryString(searchParams, ""));
  }, [isLegacyRoute, replaceQueryString, searchParams]);

  const normalizedSearchQuery = useMemo(
    () => normalizeExamplesSearchText(searchQuery),
    [searchQuery],
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

  const hasActiveFilters =
    normalizedSearchQuery.length > 0 ||
    (isLegacyRoute && currentActiveCategory !== null);

  const filteredCardTypes = useMemo(() => {
    if (!currentActiveCategory) {
      return searchMatchedCardTypes;
    }

    return searchMatchedCardTypes.filter(
      (card) => card.category === currentActiveCategory,
    );
  }, [currentActiveCategory, searchMatchedCardTypes]);

  const navigationCategoryInfo = useMemo(() => {
    const searchParam =
      normalizedSearchQuery.length > 0 ? searchQuery : undefined;

    return summary.categoryInfo.map((categoryInfo) => ({
      ...categoryInfo,
      href: buildExamplesCollectionPath(categoryInfo.slug, {
        search: searchParam,
      }),
      count:
        routeKind === "collection"
          ? categoryInfo.count
          : searchMatchedCardTypes.filter(
              (card) => card.category === categoryInfo.name,
            ).length,
    }));
  }, [
    normalizedSearchQuery.length,
    routeKind,
    searchMatchedCardTypes,
    searchQuery,
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
  const currentDiscoverySearchQuery = useMemo(() => {
    const nextSearchQuery = new URLSearchParams(searchParamsString).get(
      EXAMPLES_SEARCH_QUERY_PARAM,
    );
    const normalizedQuery = nextSearchQuery?.trim();

    return normalizedQuery ? normalizedQuery : undefined;
  }, [searchParamsString]);
  const currentDiscoveryContext = useMemo<SearchLaunchDiscoveryContextInput>(
    () => ({
      source: "examples",
      href: `${pathname}${searchParamsString ? `?${searchParamsString}` : ""}`,
      routeKind,
      collectionName:
        currentCategoryInfo?.name ?? currentActiveCategory ?? undefined,
      collectionSlug: currentCategoryInfo?.slug,
      searchQuery: currentDiscoverySearchQuery,
    }),
    [
      currentActiveCategory,
      currentCategoryInfo?.name,
      currentCategoryInfo?.slug,
      currentDiscoverySearchQuery,
      pathname,
      routeKind,
      searchParamsString,
    ],
  );
  const handleCreateClick = useCallback(() => {
    rememberExamplesDiscoveryContext(currentDiscoveryContext);
  }, [currentDiscoveryContext]);

  const shouldRenderExpandedGallery = !isIndexRoute;
  const shouldRenderCollectionChooser = isIndexRoute;
  const galleryHref = useMemo(
    () =>
      buildExamplesGalleryPath({
        search: normalizedSearchQuery.length > 0 ? searchQuery : undefined,
      }),
    [normalizedSearchQuery.length, searchQuery],
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
            Open the category you care about, or load the full wall if you want
            every preview on one gloriously oversized canvas.
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
    galleryContent = catalog.categories.reduce<React.ReactNode[]>(
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

        const sectionCategoryInfo = categoryInfoByName.get(category);

        if (!sectionCategoryInfo) {
          return nodes;
        }

        nodes.push(
          <CategorySection
            key={category}
            category={category}
            categoryInfo={sectionCategoryInfo}
            cardTypes={categoryCardTypes}
            isFirstCategory={categoryIndex === 0}
            previewColorPreset={previewColorPreset}
            discoveryContext={currentDiscoveryContext}
            showCollectionLink={routeKind === "gallery"}
          />,
        );
        return nodes;
      },
      [],
    );
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

        {routeKind === "collection" && currentCategoryInfo && catalog ? (
          <CollectionRouteHeader
            categoryCount={summary.categoryInfo.length}
            collectionCount={catalog.totalCardTypes}
            description={currentCategoryInfo.description}
            fullGalleryHref={galleryHref}
            title={currentCategoryInfo.name}
            variantCount={catalog.totalVariants}
          />
        ) : (
          <ExamplesHeroSection
            totalCardTypes={catalog?.totalCardTypes ?? summary.totalCardTypes}
            totalVariants={catalog?.totalVariants ?? summary.totalVariants}
            categoryCount={summary.categories.length}
            createHref={SEARCH_PAGE_HREF}
            onCreateClick={handleCreateClick}
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
                  {...(isLegacyRoute
                    ? {
                        onCategoryClick: handleCategoryChange,
                      }
                    : {
                        allHref: galleryHref,
                      })}
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
          <CTASection
            createHref={SEARCH_PAGE_HREF}
            onCreateClick={handleCreateClick}
          />
        </motion.div>
      </div>
    </ErrorBoundary>
  );
}
