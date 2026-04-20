"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

import { ErrorBoundary } from "@/components/ErrorBoundary";
import { LoadingOverlay } from "@/components/LoadingSpinner";
import { SectionReveal } from "@/components/marketing/SectionReveal";
import { SearchHeroSection } from "@/components/search/SearchHeroSection";
import { requestClientJson } from "@/lib/api/client-fetch";
import { buildCanonicalUserPageUrl, type SearchLookupMode } from "@/lib/seo";
import type { UserBootstrapRecord } from "@/lib/types/records";
import {
  clearPendingSettingsTemplateApply,
  readSearchLaunchContinuityState,
  type SearchLaunchContinuityState,
  subscribeSearchLaunchContinuity,
} from "@/lib/user-page-settings-templates";
import { safeTrack, trackNavigation } from "@/lib/utils/google-analytics";

const EMPTY_CONTINUITY_STATE: SearchLaunchContinuityState = {
  pendingTemplateApply: null,
  lastSuccessfulUserRoute: null,
  recentSuccessfulUserRoutes: [],
  lastDiscoveryContext: null,
};

type SearchLookupAttempt = {
  fallbackHref: string;
  mode: SearchLookupMode;
  query: string;
};

type SearchLookupResult = {
  avatarUrl?: string | null;
  ctaLabel: string;
  description: string;
  eyebrow: string;
  href: string;
  identityLabel?: string;
  isResolving?: boolean;
  kind: "confirmed" | "error" | "fallback" | "notFound";
  title: string;
  trackingSource: string;
};

function getLookupIdentityLabel(attempt: SearchLookupAttempt): string {
  return attempt.mode === "userId"
    ? `AniList ID ${attempt.query}`
    : `@${attempt.query}`;
}

function buildFallbackLookupResult(
  attempt: SearchLookupAttempt,
  options?: { isResolving?: boolean },
): SearchLookupResult {
  return {
    ctaLabel: "Continue to editor",
    description:
      "AniCards can continue with this normalized lookup right away, even before the saved profile is confirmed.",
    eyebrow: "Ready to continue",
    href: attempt.fallbackHref,
    identityLabel: getLookupIdentityLabel(attempt),
    isResolving: options?.isResolving ?? false,
    kind: "fallback",
    title:
      attempt.mode === "userId"
        ? `Continue with AniList user ${attempt.query}`
        : `Continue with @${attempt.query}`,
    trackingSource: "search_lookup",
  };
}

function buildNotFoundLookupResult(
  attempt: SearchLookupAttempt,
): SearchLookupResult {
  return {
    ctaLabel: "Set up in editor",
    description:
      "AniCards couldn't confirm a saved profile for this lookup yet, but the editor can bootstrap it now.",
    eyebrow: "Setup required",
    href: attempt.fallbackHref,
    identityLabel: getLookupIdentityLabel(attempt),
    kind: "notFound",
    title:
      attempt.mode === "userId"
        ? `Set up AniList user ${attempt.query}`
        : `Set up @${attempt.query}`,
    trackingSource: "search_lookup",
  };
}

function buildLookupErrorResult(
  attempt: SearchLookupAttempt,
): SearchLookupResult {
  return {
    ctaLabel: "Open the editor anyway",
    description:
      "AniCards couldn't confirm the saved profile just now, but the direct editor lookup is still available.",
    eyebrow: "Confirmation unavailable",
    href: attempt.fallbackHref,
    identityLabel: getLookupIdentityLabel(attempt),
    kind: "error",
    title: "Continue without a saved-profile confirmation",
    trackingSource: "search_lookup",
  };
}

function buildConfirmedLookupResult(
  attempt: SearchLookupAttempt,
  bootstrapRecord: UserBootstrapRecord,
): SearchLookupResult {
  const normalizedUsername = bootstrapRecord.username?.trim();

  return {
    avatarUrl: bootstrapRecord.avatarUrl ?? null,
    ctaLabel: normalizedUsername
      ? `Open ${normalizedUsername}'s editor`
      : "Open confirmed profile",
    description:
      "AniCards found the saved profile and can open the canonical editor route before the heavier editor bootstrap runs.",
    eyebrow: "Confirmed profile",
    href: normalizedUsername
      ? buildCanonicalUserPageUrl({
          username: normalizedUsername,
        })
      : attempt.fallbackHref,
    identityLabel: `AniList ID ${bootstrapRecord.userId}`,
    kind: "confirmed",
    title: normalizedUsername
      ? `@${normalizedUsername}`
      : getLookupIdentityLabel(attempt),
    trackingSource: "search_confirmation",
  };
}

function getLookupRequestPath(attempt: SearchLookupAttempt): string {
  const params = new URLSearchParams({ view: "bootstrap" });

  if (attempt.mode === "userId") {
    params.set("userId", attempt.query);
  } else {
    params.set("username", attempt.query);
  }

  return `/api/get-user?${params.toString()}`;
}

interface SearchHeroShellProps {
  initialFieldError?: string;
  initialLookupAttempt?: SearchLookupAttempt;
  initialSearchMode: SearchLookupMode;
  initialSearchValue: string;
}

export default function SearchHeroShell({
  initialFieldError = "",
  initialLookupAttempt,
  initialSearchMode,
  initialSearchValue,
}: Readonly<SearchHeroShellProps>) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [lookupResult, setLookupResult] = useState<SearchLookupResult | null>(
    initialLookupAttempt
      ? buildFallbackLookupResult(initialLookupAttempt)
      : null,
  );
  const [continuityState, setContinuityState] =
    useState<SearchLaunchContinuityState>(EMPTY_CONTINUITY_STATE);

  const syncContinuityState = useCallback(() => {
    setContinuityState(readSearchLaunchContinuityState());
  }, []);

  useEffect(() => {
    syncContinuityState();
    return subscribeSearchLaunchContinuity(syncContinuityState);
  }, [syncContinuityState]);

  useEffect(() => {
    setLoading(false);
  }, [
    initialFieldError,
    initialLookupAttempt?.fallbackHref,
    initialSearchMode,
    initialSearchValue,
  ]);

  useEffect(() => {
    if (!initialLookupAttempt) {
      setLookupResult(null);
      return;
    }

    const controller = new AbortController();
    setLookupResult(
      buildFallbackLookupResult(initialLookupAttempt, {
        isResolving: true,
      }),
    );

    void requestClientJson(getLookupRequestPath(initialLookupAttempt), {
      signal: controller.signal,
    })
      .then(({ response, payload }) => {
        if (controller.signal.aborted) {
          return;
        }

        if (response.ok) {
          setLookupResult(
            buildConfirmedLookupResult(
              initialLookupAttempt,
              payload as UserBootstrapRecord,
            ),
          );
          return;
        }

        if (response.status === 404) {
          setLookupResult(buildNotFoundLookupResult(initialLookupAttempt));
          return;
        }

        setLookupResult(buildLookupErrorResult(initialLookupAttempt));
      })
      .catch(() => {
        if (controller.signal.aborted) {
          return;
        }

        setLookupResult(buildLookupErrorResult(initialLookupAttempt));
      });

    return () => {
      controller.abort(
        new DOMException(
          "The search confirmation request was cancelled.",
          "AbortError",
        ),
      );
    };
  }, [initialLookupAttempt]);

  const handleClearPendingTemplateApply = useCallback(() => {
    clearPendingSettingsTemplateApply();
    setContinuityState((currentState) => ({
      ...currentState,
      pendingTemplateApply: null,
    }));
  }, []);

  const handleOpenEditorRoute = useCallback(
    (href: string, trackingSource: string) => {
      setLoading(true);
      safeTrack(() => trackNavigation("user_page", trackingSource));
      void Promise.resolve(router.push(href)).catch(() => {
        setLoading(false);
      });
    },
    [router],
  );

  const handleResumeLastEditor = useCallback(() => {
    if (!continuityState.lastSuccessfulUserRoute?.href) {
      return;
    }

    handleOpenEditorRoute(
      continuityState.lastSuccessfulUserRoute.href,
      "search_resume_last_editor",
    );
  }, [continuityState.lastSuccessfulUserRoute, handleOpenEditorRoute]);

  const handleOpenRecentEditor = useCallback(
    (href: string) => {
      handleOpenEditorRoute(href, "search_recent_editor");
    },
    [handleOpenEditorRoute],
  );

  const handleOpenLookupResult = useCallback(
    (href: string, trackingSource: string) => {
      handleOpenEditorRoute(href, trackingSource);
    },
    [handleOpenEditorRoute],
  );

  return (
    <ErrorBoundary
      resetKeys={[loading ? "loading" : "idle"]}
      onReset={() => setLoading(false)}
    >
      {loading ? (
        <LoadingOverlay
          title="Working on your AniList lookup"
          text="Preparing the next step..."
          description="AniCards is confirming the selected profile and opening the next step in the lookup flow. The search page is temporarily unavailable until navigation finishes."
        />
      ) : null}

      <div
        data-testid="search-hero-content"
        aria-hidden={loading ? true : undefined}
        inert={loading}
      >
        <SectionReveal>
          <SearchHeroSection
            initialFieldError={initialFieldError}
            lookupResult={lookupResult}
            initialSearchMode={initialSearchMode}
            initialSearchValue={initialSearchValue}
            lastSuccessfulUserRoute={continuityState.lastSuccessfulUserRoute}
            recentSuccessfulUserRoutes={
              continuityState.recentSuccessfulUserRoutes
            }
            lastDiscoveryContext={continuityState.lastDiscoveryContext}
            onLoadingChange={setLoading}
            onOpenResolvedLookup={handleOpenLookupResult}
            pendingTemplateApply={continuityState.pendingTemplateApply}
            onClearPendingTemplateApply={handleClearPendingTemplateApply}
            onResumeLastEditor={handleResumeLastEditor}
            onOpenRecentEditor={handleOpenRecentEditor}
          />
        </SectionReveal>
      </div>
    </ErrorBoundary>
  );
}
