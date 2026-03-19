"use client";

import { ErrorBoundary } from "@/components/ErrorBoundary";
import { BentoFeatures } from "@/components/home/BentoFeatures";
import { CardMarquee } from "@/components/home/CardMarquee";
import { HeroSection } from "@/components/home/HeroSection";
import { HomeCTA } from "@/components/home/HomeCTA";
import { ProcessSteps } from "@/components/home/ProcessSteps";
import { StatsRibbon } from "@/components/home/StatsRibbon";

export default function HomePage() {
  return (
    <ErrorBoundary>
      <div className="relative min-h-screen">
        <div
          className="pointer-events-none absolute inset-0 opacity-30 dark:opacity-20"
          style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M30 0L60 30L30 60L0 30Z' fill='none' stroke='%23c9a84c15' stroke-width='1'/%3E%3C/svg%3E")`,
          }}
        />
        <HeroSection />
        <CardMarquee />
        <BentoFeatures />
        <StatsRibbon />
        <ProcessSteps />
        <HomeCTA />
      </div>
    </ErrorBoundary>
  );
}
