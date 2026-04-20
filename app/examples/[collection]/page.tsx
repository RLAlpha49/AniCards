import { notFound } from "next/navigation";

import { StructuredDataScript } from "@/components/StructuredDataScript";
import { SHOW_LOADING_PREVIEW } from "@/lib/dev-loading-preview";
import {
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

interface CollectionPageProps {
  params: Promise<{
    collection: string;
  }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
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
        summary={getExamplesCatalogSummary()}
        catalog={catalog}
        routeKind="collection"
        activeCategory={collection.name}
      />
    </>
  );
}
