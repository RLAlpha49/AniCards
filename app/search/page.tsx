"use client";

import { useState } from "react";

import { ErrorBoundary } from "@/components/ErrorBoundary";
import { FloatingCardsLayer } from "@/components/FloatingCardsLayer";
import { LoadingOverlay } from "@/components/LoadingSpinner";
import PageShell from "@/components/PageShell";
import { SearchForm } from "@/components/search/SearchForm";
import { SearchHeroSection } from "@/components/search/SearchHeroSection";
import { usePageSEO } from "@/hooks/usePageSEO";

/**
 * Renders the AniList user search page with modern styling matching
 * the home and examples pages.
 * @returns The markup for the search page.
 * @source
 */
export default function UserSearchPage() {
  usePageSEO("search");

  const [loading, setLoading] = useState(false);

  return (
    <ErrorBoundary
      resetKeys={[loading ? "loading" : "idle"]}
      onReset={() => setLoading(false)}
    >
      <div className="relative h-full w-full overflow-hidden">
        {loading && <LoadingOverlay text="Searching for user..." />}

        <PageShell mainClassName="h-full" variant="none">
          <section className="relative h-full w-full overflow-hidden">
            <FloatingCardsLayer layout="search" />

            <div className="container relative z-10 mx-auto flex h-full flex-col items-center justify-center px-4 py-20">
              <SearchHeroSection />
              <div className="mt-12 flex w-full justify-center">
                <SearchForm onLoadingChange={setLoading} />
              </div>
            </div>
          </section>
        </PageShell>
      </div>
    </ErrorBoundary>
  );
}
