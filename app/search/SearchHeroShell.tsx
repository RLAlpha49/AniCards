"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

import { ErrorBoundary } from "@/components/ErrorBoundary";
import { LoadingOverlay } from "@/components/LoadingSpinner";
import { SectionReveal } from "@/components/marketing/SectionReveal";
import { SearchHeroSection } from "@/components/search/SearchHeroSection";
import type { SearchLookupMode } from "@/lib/seo";
import {
  clearPendingSettingsTemplateApply,
  type PendingSettingsTemplateApply,
  readLastSuccessfulUserPageRoute,
  readPendingSettingsTemplateApply,
  type RememberedUserPageRoute,
} from "@/lib/user-page-settings-templates";

interface SearchHeroShellProps {
  initialSearchMode: SearchLookupMode;
  initialSearchValue: string;
}

export default function SearchHeroShell({
  initialSearchMode,
  initialSearchValue,
}: Readonly<SearchHeroShellProps>) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [pendingTemplateApply, setPendingTemplateApply] =
    useState<PendingSettingsTemplateApply | null>(null);
  const [lastSuccessfulUserRoute, setLastSuccessfulUserRoute] =
    useState<RememberedUserPageRoute | null>(null);

  useEffect(() => {
    setPendingTemplateApply(readPendingSettingsTemplateApply());
    setLastSuccessfulUserRoute(readLastSuccessfulUserPageRoute());
  }, []);

  const handleClearPendingTemplateApply = useCallback(() => {
    clearPendingSettingsTemplateApply();
    setPendingTemplateApply(null);
  }, []);

  const handleResumeQueuedEditor = useCallback(() => {
    if (!lastSuccessfulUserRoute?.href) {
      return;
    }

    setLoading(true);
    void Promise.resolve(router.push(lastSuccessfulUserRoute.href)).catch(
      () => {
        setLoading(false);
      },
    );
  }, [lastSuccessfulUserRoute?.href, router]);

  return (
    <ErrorBoundary
      resetKeys={[loading ? "loading" : "idle"]}
      onReset={() => setLoading(false)}
    >
      {loading ? (
        <LoadingOverlay
          title="Opening AniList profile"
          text="Tracking down that profile..."
          description="AniCards is opening the selected AniList profile. The search page is temporarily unavailable until the navigation finishes."
        />
      ) : null}

      <div
        data-testid="search-hero-content"
        aria-hidden={loading ? true : undefined}
        inert={loading}
      >
        <SectionReveal>
          <SearchHeroSection
            initialSearchMode={initialSearchMode}
            initialSearchValue={initialSearchValue}
            onLoadingChange={setLoading}
            pendingTemplateApply={pendingTemplateApply}
            onClearPendingTemplateApply={handleClearPendingTemplateApply}
            onResumeQueuedEditor={handleResumeQueuedEditor}
            queuedEditorResumeAvailable={Boolean(lastSuccessfulUserRoute?.href)}
          />
        </SectionReveal>
      </div>
    </ErrorBoundary>
  );
}
