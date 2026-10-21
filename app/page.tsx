"use client";

import { useState, useCallback } from "react";
import { StatCardGenerator } from "@/components/StatCardGenerator";
import {
  trackButtonClick,
  trackDialogOpen,
  safeTrack,
} from "@/lib/utils/google-analytics";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { HomeSurface } from "@/components/home/HomeSurface";
import { HeroSection } from "@/components/home/HeroSection";
import { PreviewShowcase } from "@/components/home/PreviewShowcase";
import { FeaturesSection } from "@/components/home/FeaturesSection";
import { ClosingSection } from "@/components/home/ClosingSection";

/**
 * Renders the AniCards landing page: hero, card gallery, capabilities, and a
 * closing call to action on the paper surface. The stat card generator dialog
 * is mounted once here and opened by every call to action.
 * @source
 */
export default function HomePage() {
  const [isGeneratorOpen, setIsGeneratorOpen] = useState(false);

  const handleGetStartedClick = useCallback(() => {
    setIsGeneratorOpen(true);

    safeTrack(() => trackButtonClick("get_started", "homepage"));
    safeTrack(() => trackDialogOpen("stat_card_generator"));
  }, []);

  const handleSeeExamplesClick = useCallback(() => {
    document.getElementById("preview-showcase")?.scrollIntoView({
      behavior: "smooth",
    });

    safeTrack(() => trackButtonClick("see_examples", "homepage"));
  }, []);

  return (
    <ErrorBoundary
      resetKeys={[isGeneratorOpen ? "generator_open" : "generator_closed"]}
      onReset={() => setIsGeneratorOpen(false)}
    >
      <HomeSurface>
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

        <StatCardGenerator
          isOpen={isGeneratorOpen}
          onOpenChange={(open) => setIsGeneratorOpen(open)}
          className={`transition-opacity duration-300 ${
            isGeneratorOpen ? "opacity-100" : "opacity-0"
          }`}
        />
      </HomeSurface>
    </ErrorBoundary>
  );
}
