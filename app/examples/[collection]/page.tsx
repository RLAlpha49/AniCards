import Link from "next/link";
import { notFound } from "next/navigation";

import { StructuredDataScript } from "@/components/StructuredDataScript";
import { SHOW_LOADING_PREVIEW } from "@/lib/dev-loading-preview";
import {
  buildExamplesGalleryPath,
  EXAMPLE_COLLECTIONS,
  EXAMPLES_SEARCH_QUERY_PARAM,
  getExampleCollectionBySlug,
} from "@/lib/examples-collections";
import { getRequestNonce } from "@/lib/request-nonce";
import {
  generateMetadata as createMetadata,
  getExamplesPageSEOConfig,
} from "@/lib/seo";
import { generateStructuredData } from "@/lib/structured-data";

import {
  getExamplesCatalogSummary,
  getExamplesCollectionCatalog,
} from "../examples-catalog";
import ExamplesPageClient from "../ExamplesPageClient";
import LoadingPreview from "../loading";

export const EXAMPLES_COLLECTION_PAGE_LASTMOD = "2026-04-20";

interface CollectionPageProps {
  params: Promise<{
    collection: string;
  }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
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

function getSearchParamValue(
  value: string | string[] | undefined,
): string | undefined {
  const normalizedValue = Array.isArray(value) ? value[0] : value;
  const trimmedValue = normalizedValue?.trim();

  return trimmedValue || undefined;
}

export function generateStaticParams() {
  return EXAMPLE_COLLECTIONS.map((collection) => ({
    collection: collection.slug,
  }));
}

export async function generateMetadata({
  params,
  searchParams,
}: CollectionPageProps) {
  const [{ collection }, resolvedSearchParams] = await Promise.all([
    params,
    searchParams,
  ]);

  return createMetadata(
    getExamplesPageSEOConfig({
      routeType: "collection",
      collectionSlug: collection,
      search: getSearchParamValue(
        resolvedSearchParams[EXAMPLES_SEARCH_QUERY_PARAM],
      ),
    }),
  );
}

export default async function ExamplesCollectionPage({
  params,
  searchParams,
}: Readonly<CollectionPageProps>) {
  if (SHOW_LOADING_PREVIEW) {
    return <LoadingPreview />;
  }

  const [{ collection: collectionSlug }, resolvedSearchParams] =
    await Promise.all([params, searchParams]);
  const collection = getExampleCollectionBySlug(collectionSlug);
  const catalog = getExamplesCollectionCatalog(collectionSlug);

  if (!collection || !catalog) {
    notFound();
  }

  const search = getSearchParamValue(
    resolvedSearchParams[EXAMPLES_SEARCH_QUERY_PARAM],
  );
  const summary = getExamplesCatalogSummary();
  const seoConfig = getExamplesPageSEOConfig({
    routeType: "collection",
    collectionSlug,
    search,
  });
  const nonce = await getRequestNonce();

  return (
    <>
      <StructuredDataScript
        data={generateStructuredData("examples", {
          canonical: seoConfig.canonical,
          description: seoConfig.description,
          keywords: seoConfig.keywords,
          title: seoConfig.title,
          examples: {
            routeKind: "collection",
            collectionSlug,
          },
        })}
        nonce={nonce}
      />
      <ExamplesPageClient
        summary={summary}
        catalog={catalog}
        routeKind="collection"
        activeCategory={collection.name}
        routeHeaderContent={
          <CollectionRouteHeader
            categoryCount={summary.categoryInfo.length}
            collectionCount={catalog.totalCardTypes}
            description={collection.description}
            fullGalleryHref={buildExamplesGalleryPath({ search })}
            title={collection.name}
            variantCount={catalog.totalVariants}
          />
        }
      />
    </>
  );
}
