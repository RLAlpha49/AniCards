"use client";

import { useState } from "react";

import { ErrorBoundary } from "@/components/ErrorBoundary";
import { LoadingOverlay } from "@/components/LoadingSpinner";
import { SectionReveal } from "@/components/marketing/SectionReveal";
import { SearchHeroSection } from "@/components/search/SearchHeroSection";
import type { SearchLookupMode } from "@/lib/seo";

interface SearchHeroShellProps {
  initialSearchMode: SearchLookupMode;
  initialSearchValue: string;
}

export default function SearchHeroShell({
  initialSearchMode,
  initialSearchValue,
}: Readonly<SearchHeroShellProps>) {
  const [loading, setLoading] = useState(false);

  return (
    <ErrorBoundary
      resetKeys={[loading ? "loading" : "idle"]}
      onReset={() => setLoading(false)}
    >
      {loading && <LoadingOverlay text="Tracking down that profile..." />}

      <SectionReveal>
        <SearchHeroSection
          initialSearchMode={initialSearchMode}
          initialSearchValue={initialSearchValue}
          onLoadingChange={setLoading}
        />
      </SectionReveal>
    </ErrorBoundary>
  );
}
