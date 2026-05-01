import Link from "next/link";

import type { ExamplesCatalogSummary } from "@/components/examples";
import { StructuredDataScript } from "@/components/StructuredDataScript";
import { SHOW_LOADING_PREVIEW } from "@/lib/dev-loading-preview";
import {
  buildExamplesGalleryPath,
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

function ExamplesCollectionChooser({
  summary,
}: Readonly<{ summary: ExamplesCatalogSummary }>) {
  return (
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
              <span className="font-display text-[0.65rem] tracking-[0.35em] text-gold/50 uppercase">
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

  return createMetadata(getExamplesPageSEOConfig({ search }));
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
  const legacyCategoryValue = getSearchParamValue(
    resolvedSearchParams[EXAMPLES_LEGACY_CATEGORY_QUERY_PARAM],
  );
  const legacyCategory =
    getExampleCollectionFromLegacyValue(legacyCategoryValue);
  const summary = getExamplesCatalogSummary();
  const hasLegacyQueryState =
    search !== undefined || legacyCategoryValue !== undefined;
  const catalog = hasLegacyQueryState ? getExamplesCatalog() : undefined;
  const nonce = !catalog ? await getRequestNonce() : null;

  return (
    <>
      {!catalog && (
        <StructuredDataScript
          data={generateStructuredData("examples", {
            examples: {
              routeKind: "index",
            },
          })}
          nonce={nonce ?? undefined}
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
              indexContent: <ExamplesCollectionChooser summary={summary} />,
            })}
      />
    </>
  );
}
