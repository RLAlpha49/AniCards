"use client";

import { useState } from "react";

import { ErrorBoundary } from "@/components/ErrorBoundary";
import { LoadingOverlay } from "@/components/LoadingSpinner";
import { SectionReveal } from "@/components/marketing/SectionReveal";
import { SearchHeroSection } from "@/components/search/SearchHeroSection";

export default function SearchHeroShell() {
  const [loading, setLoading] = useState(false);

  return (
    <ErrorBoundary
      resetKeys={[loading ? "loading" : "idle"]}
      onReset={() => setLoading(false)}
    >
      {loading && <LoadingOverlay text="Tracking down that profile..." />}

      <SectionReveal>
        <SearchHeroSection onLoadingChange={setLoading} />
      </SectionReveal>
    </ErrorBoundary>
  );
}
