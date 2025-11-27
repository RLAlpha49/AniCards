"use client";

import { useState } from "react";
import { GridPattern } from "@/components/ui/grid-pattern";
import { FloatingCardsLayer } from "@/components/ui/floating-cards";
import { LoadingOverlay } from "@/components/loading-spinner";
import { ErrorBoundary } from "@/components/error-boundary";
import { usePageSEO } from "@/hooks/use-page-seo";
import { SearchHeroSection } from "@/components/search/hero-section";
import { SearchForm } from "@/components/search/search-form";

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

        {/* Background effects matching home page */}
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute inset-0 bg-gradient-to-b from-slate-50 via-white to-slate-100 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950" />
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_50%_at_50%_-20%,rgba(120,119,198,0.15),transparent)] dark:bg-[radial-gradient(ellipse_80%_50%_at_50%_-20%,rgba(120,119,198,0.3),transparent)]" />
          <div className="absolute -top-40 left-1/2 h-[600px] w-[600px] -translate-x-1/2 rounded-full bg-gradient-to-r from-blue-400/20 via-purple-400/20 to-pink-400/20 blur-3xl" />
          <div className="absolute left-0 top-1/4 h-[500px] w-[500px] rounded-full bg-gradient-to-r from-blue-500/10 to-purple-500/10 blur-3xl" />
          <div className="absolute bottom-1/4 right-0 h-[500px] w-[500px] rounded-full bg-gradient-to-r from-pink-500/10 to-orange-500/10 blur-3xl" />
        </div>

        <GridPattern className="z-0" />

        <div className="relative z-10">
          <section className="relative w-full overflow-hidden">
            <FloatingCardsLayer layout="search" />

            <div className="container relative z-10 mx-auto flex flex-col items-center justify-center px-4 py-20">
              <SearchHeroSection />

              <div className="mt-12 flex w-full justify-center">
                <SearchForm onLoadingChange={setLoading} />
              </div>
            </div>
          </section>
        </div>
      </div>
    </ErrorBoundary>
  );
}
