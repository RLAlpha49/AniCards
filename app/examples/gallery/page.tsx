import { StructuredDataScript } from "@/components/StructuredDataScript";
import { SHOW_LOADING_PREVIEW } from "@/lib/dev-loading-preview";
import { EXAMPLES_SEARCH_QUERY_PARAM } from "@/lib/examples-collections";
import { getRequestNonce } from "@/lib/request-nonce";
import {
  generateMetadata as createMetadata,
  getExamplesPageSEOConfig,
} from "@/lib/seo";
import { generateStructuredData } from "@/lib/structured-data";

import {
  getExamplesCatalog,
  getExamplesCatalogSummary,
} from "../examples-catalog";
import ExamplesPageClient from "../ExamplesPageClient";
import LoadingPreview from "../loading";

export const EXAMPLES_GALLERY_PAGE_LASTMOD = "2026-04-20";

interface GalleryPageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

function getSearchParamValue(
  value: string | string[] | undefined,
): string | undefined {
  const normalizedValue = Array.isArray(value) ? value[0] : value;
  const trimmedValue = normalizedValue?.trim();

  return trimmedValue || undefined;
}

export async function generateMetadata({ searchParams }: GalleryPageProps) {
  const resolvedSearchParams = await searchParams;
  const search = getSearchParamValue(
    resolvedSearchParams[EXAMPLES_SEARCH_QUERY_PARAM],
  );

  return createMetadata(
    getExamplesPageSEOConfig({
      routeType: "gallery",
      search,
    }),
  );
}

export default async function ExamplesGalleryPage({
  searchParams,
}: Readonly<GalleryPageProps>) {
  if (SHOW_LOADING_PREVIEW) {
    return <LoadingPreview />;
  }

  const resolvedSearchParams = await searchParams;
  const search = getSearchParamValue(
    resolvedSearchParams[EXAMPLES_SEARCH_QUERY_PARAM],
  );
  const seoConfig = getExamplesPageSEOConfig({
    routeType: "gallery",
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
            routeKind: "gallery",
          },
        })}
        nonce={nonce}
      />
      <ExamplesPageClient
        summary={getExamplesCatalogSummary()}
        catalog={getExamplesCatalog()}
        routeKind="gallery"
      />
    </>
  );
}
