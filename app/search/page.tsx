import type { Metadata } from "next";

import { MarketingBackdrop } from "@/components/marketing/MarketingBackdrop";
import { SectionReveal } from "@/components/marketing/SectionReveal";
import { SearchCapabilities } from "@/components/search/SearchCapabilities";
import { SearchCTA } from "@/components/search/SearchCTA";
import { SearchJourney } from "@/components/search/SearchJourney";
import { StructuredDataScript } from "@/components/StructuredDataScript";
import { SHOW_LOADING_PREVIEW } from "@/lib/dev-loading-preview";
import {
  buildUserLookupPath,
  generateMetadata as createMetadata,
  getBlankSearchLookupError,
  getSearchLookupMode,
  getSearchLookupValidationError,
  getSearchPagePrefillQuery,
  getSearchPageSEOConfig,
  normalizeSearchLookupInput,
} from "@/lib/seo";

import LoadingPreview from "./loading";
import SearchHeroShell from "./SearchHeroShell";

type SearchLookupAttempt = {
  fallbackHref: string;
  mode: "username" | "userId";
  query: string;
};

function buildInitialSearchLookupState(params: {
  mode?: string;
  query?: string;
}): {
  initialFieldError?: string;
  initialLookupAttempt?: SearchLookupAttempt;
} {
  if (params.query === undefined) {
    return {};
  }

  const requestedMode = getSearchLookupMode(params.mode);
  const normalizedLookup = normalizeSearchLookupInput(
    params.query,
    requestedMode,
  );

  if (!normalizedLookup) {
    return {
      initialFieldError: getBlankSearchLookupError(requestedMode),
    };
  }

  if (!normalizedLookup.ok) {
    return {
      initialFieldError: getSearchLookupValidationError(
        requestedMode,
        normalizedLookup.reason,
      ),
    };
  }

  return {
    initialLookupAttempt: {
      fallbackHref:
        normalizedLookup.mode === "userId"
          ? buildUserLookupPath({ userId: normalizedLookup.query })
          : buildUserLookupPath({ username: normalizedLookup.query }),
      mode: normalizedLookup.mode,
      query: normalizedLookup.query,
    },
  };
}

export async function generateMetadata({
  searchParams,
}: {
  searchParams: Promise<{
    mode?: string;
    query?: string;
  }>;
}): Promise<Metadata> {
  const params = await searchParams;

  return createMetadata(
    getSearchPageSEOConfig({
      mode: params.mode,
      query: params.query,
    }),
  );
}

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

  const resolvedSearchParams = await searchParams;
  const initialSearchMode = getSearchLookupMode(resolvedSearchParams.mode);
  const initialSearchValue = getSearchPagePrefillQuery(
    resolvedSearchParams.query,
    initialSearchMode,
  );
  const { initialFieldError, initialLookupAttempt } =
    buildInitialSearchLookupState(resolvedSearchParams);

  return (
    <>
      <StructuredDataScript page="search" />
      <div className="relative min-h-screen">
        <MarketingBackdrop />
        <SearchHeroShell
          initialFieldError={initialFieldError}
          initialLookupAttempt={initialLookupAttempt}
          initialSearchMode={initialSearchMode}
          initialSearchValue={initialSearchValue}
        />

        <SectionReveal
          variant="lineExpand"
          className="gold-line-thick mx-auto max-w-[60%] origin-center"
        />

        <SectionReveal>
          <SearchCapabilities />
        </SectionReveal>

        <SectionReveal
          variant="lineExpand"
          className="gold-line mx-auto max-w-[40%] origin-center"
        />

        <SectionReveal>
          <SearchJourney />
        </SectionReveal>

        <SectionReveal>
          <SearchCTA />
        </SectionReveal>
      </div>
    </>
  );
}
