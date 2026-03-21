"use client";

import { useState } from "react";

import { ErrorBoundary } from "@/components/ErrorBoundary";
import { LoadingOverlay } from "@/components/LoadingSpinner";
import {
  SearchCapabilities,
  SearchCTA,
  SearchHeroSection,
  SearchJourney,
} from "@/components/search";
import { usePageSEO } from "@/hooks/usePageSEO";

export default function UserSearchPage() {
  usePageSEO("search");

  const [loading, setLoading] = useState(false);

  return (
    <ErrorBoundary
      resetKeys={[loading ? "loading" : "idle"]}
      onReset={() => setLoading(false)}
    >
      <div className="relative min-h-screen">
        {loading && <LoadingOverlay text="Tracking down that profile..." />}

        <div
          className="pointer-events-none absolute inset-0 opacity-30 dark:opacity-20"
          style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M30 0L60 30L30 60L0 30Z' fill='none' stroke='%23c9a84c15' stroke-width='1'/%3E%3C/svg%3E")`,
          }}
        />

        <SearchHeroSection onLoadingChange={setLoading} />
        <div className="gold-line-thick mx-auto max-w-[60%]" />
        <SearchJourney />
        <div className="gold-line mx-auto max-w-[40%]" />
        <SearchCapabilities />
        <SearchCTA />
      </div>
    </ErrorBoundary>
  );
}
