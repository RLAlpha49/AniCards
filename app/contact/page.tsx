"use client";

import {
  ContactChannels,
  ContactCTA,
  ContactHeroSection,
  ContactReasons,
} from "@/components/contact";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { usePageSEO } from "@/hooks/usePageSEO";

export default function ContactPage() {
  usePageSEO("contact");

  return (
    <ErrorBoundary>
      <div className="relative min-h-screen">
        {/* Dot grid atmosphere — spans the full page behind all sections */}
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.04] dark:opacity-[0.025]"
          style={{
            backgroundImage:
              "radial-gradient(hsl(var(--gold)) 0.8px, transparent 0.8px)",
            backgroundSize: "28px 28px",
          }}
        />

        <ContactHeroSection />

        {/* Section divider — thin gold fade line */}
        <div className="mx-auto h-px max-w-[60%] bg-linear-to-r from-transparent via-[hsl(var(--gold)/0.2)] to-transparent" />

        <ContactChannels />
        <ContactReasons />
        <ContactCTA />
      </div>
    </ErrorBoundary>
  );
}
