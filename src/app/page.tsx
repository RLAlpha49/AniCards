"use client";

import { useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  trackButtonClick,
  trackNavigation,
  safeTrack,
} from "@/lib/analytics/google-analytics";
import { ErrorBoundary } from "@/components/feedback";
import { PaperSurface } from "@/components/primitives";
import {
  ClosingSection,
  FeaturesSection,
  HeroSection,
  PreviewShowcase,
} from "@/components/home";

/**
 * Renders the AniCards landing page: hero, card gallery, capabilities, and a
 * closing call to action on the paper surface.
 *
 * Every call to action sends the visitor to the generator page, which owns the
 * username, palette, card list, and print action.
 * @source
 */
export default function HomePage() {
  const router = useRouter();

  const handleGetStartedClick = useCallback(() => {
    safeTrack(() => trackButtonClick("get_started", "homepage"));
    safeTrack(() => trackNavigation("generator", "homepage"));
    router.push("/generator");
  }, [router]);

  const handleSeeExamplesClick = useCallback(() => {
    document.getElementById("preview-showcase")?.scrollIntoView({
      behavior: globalThis.matchMedia?.("(prefers-reduced-motion: reduce)")
        .matches
        ? "instant"
        : "smooth",
    });

    safeTrack(() => trackButtonClick("see_examples", "homepage"));
  }, []);

  return (
    <ErrorBoundary>
      <PaperSurface>
        <HeroSection
          onGetStarted={handleGetStartedClick}
          onSeeExamples={handleSeeExamplesClick}
        />

        <PreviewShowcase onGetStarted={handleGetStartedClick} />

        <FeaturesSection onGetStarted={handleGetStartedClick} />

        <ClosingSection
          onGetStarted={handleGetStartedClick}
          onSeeExamples={handleSeeExamplesClick}
        />
      </PaperSurface>
    </ErrorBoundary>
  );
}
