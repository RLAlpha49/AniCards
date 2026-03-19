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
        <div
          className="pointer-events-none absolute inset-0 opacity-30 dark:opacity-20"
          style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M30 0L60 30L30 60L0 30Z' fill='none' stroke='%23c9a84c15' stroke-width='1'/%3E%3C/svg%3E")`,
          }}
        />

        <ProjectsHeroSection />
        <div className="gold-line-thick mx-auto max-w-[60%]" />
        <FeaturedProject />
        <div className="gold-line mx-auto max-w-[40%]" />
        <ProjectCollection />
        <div className="gold-line-thick mx-auto max-w-[60%]" />
        <ProjectEthos />
        <ProjectsCTA />
      </div>
    </ErrorBoundary>
  );
}
