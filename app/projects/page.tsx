"use client";

import { ErrorBoundary } from "@/components/ErrorBoundary";
import {
  FeaturedProject,
  ProjectCollection,
  ProjectEthos,
  ProjectsCTA,
  ProjectsHeroSection,
} from "@/components/projects";
import { usePageSEO } from "@/hooks/usePageSEO";

export default function ProjectsPage() {
  usePageSEO("projects");

  return (
    <ErrorBoundary>
      <div className="relative min-h-screen">
        {/* Faint repeating diagonal texture */}
        <div
          className="pointer-events-none absolute inset-0 opacity-20 dark:opacity-10"
          style={{
            backgroundImage:
              "repeating-linear-gradient(135deg, hsl(var(--gold) / 0.03) 0px, hsl(var(--gold) / 0.03) 1px, transparent 1px, transparent 120px)",
          }}
        />

        <ProjectsHeroSection />
        <FeaturedProject />
        <ProjectCollection />
        <ProjectEthos />
        <ProjectsCTA />
      </div>
    </ErrorBoundary>
  );
}
