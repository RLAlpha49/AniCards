import { StructuredDataScript } from "@/components/StructuredDataScript";
import { SHOW_LOADING_PREVIEW } from "@/lib/dev-loading-preview";
import {
  EXAMPLES_LEGACY_CATEGORY_QUERY_PARAM,
  EXAMPLES_SEARCH_QUERY_PARAM,
  getExampleCollectionFromLegacyValue,
} from "@/lib/examples-collections";
import { getRequestNonce } from "@/lib/request-nonce";
import {
  generateMetadata as createMetadata,
  getExamplesPageSEOConfig,
} from "@/lib/seo";
import { generateStructuredData } from "@/lib/structured-data";

import {
  getExamplesCatalog,
  getExamplesCatalogSummary,
} from "./examples-catalog";
import ExamplesPageClient from "./ExamplesPageClient";
import LoadingPreview from "./loading";

interface ExamplesPageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

function getSearchParamValue(
  value: string | string[] | undefined,
): string | undefined {
  const normalizedValue = Array.isArray(value) ? value[0] : value;
  const trimmedValue = normalizedValue?.trim();

  return trimmedValue || undefined;
}

export async function generateMetadata({ searchParams }: ExamplesPageProps) {
  const resolvedSearchParams = await searchParams;
  const search = getSearchParamValue(
    resolvedSearchParams[EXAMPLES_SEARCH_QUERY_PARAM],
  );
  const legacyCategory = getExampleCollectionFromLegacyValue(
    getSearchParamValue(
      resolvedSearchParams[EXAMPLES_LEGACY_CATEGORY_QUERY_PARAM],
    ),
  );

  return createMetadata(
    search || legacyCategory
      ? getExamplesPageSEOConfig({ routeType: "legacy" })
      : getExamplesPageSEOConfig({ routeType: "index" }),
  );
}

export default async function ExamplesPage({
  searchParams,
}: Readonly<ExamplesPageProps>) {
  if (SHOW_LOADING_PREVIEW) {
    return <LoadingPreview />;
  }

  const resolvedSearchParams = await searchParams;
  const search = getSearchParamValue(
    resolvedSearchParams[EXAMPLES_SEARCH_QUERY_PARAM],
  );
  const legacyCategory = getExampleCollectionFromLegacyValue(
    getSearchParamValue(
      resolvedSearchParams[EXAMPLES_LEGACY_CATEGORY_QUERY_PARAM],
    ),
  );
  const nonce = await getRequestNonce();
  const summary = getExamplesCatalogSummary();
  const catalog = search || legacyCategory ? getExamplesCatalog() : undefined;

  return (
    <>
      {!catalog && (
        <StructuredDataScript
          data={generateStructuredData("examples", {
            examples: {
              routeKind: "index",
            },
          })}
          nonce={nonce}
        />
      )}
      <ExamplesPageClient
        summary={summary}
        {...(catalog
          ? {
              catalog,
              routeKind: "legacy" as const,
              activeCategory: legacyCategory?.name ?? null,
            }
          : {
              routeKind: "index" as const,
            })}
      />
    </>
  );
}
