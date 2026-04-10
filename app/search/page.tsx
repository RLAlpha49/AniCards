import { MarketingBackdrop } from "@/components/marketing/MarketingBackdrop";
import { SectionReveal } from "@/components/marketing/SectionReveal";
import { SearchCapabilities } from "@/components/search/SearchCapabilities";
import { SearchCTA } from "@/components/search/SearchCTA";
import { SearchJourney } from "@/components/search/SearchJourney";
import { StructuredDataScript } from "@/components/StructuredDataScript";
import { SHOW_LOADING_PREVIEW } from "@/lib/dev-loading-preview";
import { getRequestNonce } from "@/lib/request-nonce";
import {
  generateMetadata as createMetadata,
  getSearchLookupMode,
  getSearchPagePrefillQuery,
  seoConfigs,
} from "@/lib/seo";
import { generateStructuredData } from "@/lib/structured-data";

import LoadingPreview from "./loading";
import SearchHeroShell from "./SearchHeroShell";

export const metadata = createMetadata(seoConfigs.search);

export default async function UserSearchPage({
  searchParams,
}: Readonly<{
  searchParams: Promise<{
    mode?: string;
    query?: string;
  }>;
}>) {
  if (SHOW_LOADING_PREVIEW) {
    return <LoadingPreview />;
  }

  const [resolvedSearchParams, nonce] = await Promise.all([
    searchParams,
    getRequestNonce(),
  ]);
  const initialSearchMode = getSearchLookupMode(resolvedSearchParams.mode);
  const initialSearchValue = getSearchPagePrefillQuery(
    resolvedSearchParams.query,
  );

  return (
    <>
      <StructuredDataScript
        data={generateStructuredData("search")}
        nonce={nonce}
      />
      <div className="relative min-h-screen">
        <MarketingBackdrop />
        <SearchHeroShell
          initialSearchMode={initialSearchMode}
          initialSearchValue={initialSearchValue}
        />

        <SectionReveal
          variant="lineExpand"
          style={{ originX: 0.5 }}
          className="gold-line-thick mx-auto max-w-[60%]"
        />

        <SectionReveal>
          <SearchJourney />
        </SectionReveal>

        <SectionReveal
          variant="lineExpand"
          style={{ originX: 0.5 }}
          className="gold-line mx-auto max-w-[40%]"
        />

        <SectionReveal>
          <SearchCapabilities />
        </SectionReveal>

        <SectionReveal>
          <SearchCTA />
        </SectionReveal>
      </div>
    </>
  );
}
