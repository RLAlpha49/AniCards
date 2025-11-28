"use client";

import { ArrowRight, Play, Sparkles } from "lucide-react";
import UiCtaSection from "@/components/ui/cta-section";
import HeroBadge from "@/components/hero-badge";

interface CTASectionProps {
  onOpenGenerator: () => void;
}

export function CTASection({ onOpenGenerator }: Readonly<CTASectionProps>) {
  return (
    <UiCtaSection
      badge={
        <HeroBadge
          icon={Sparkles}
          className="border-blue-200/50 bg-blue-50/80 text-blue-700 dark:border-blue-700/50 dark:bg-blue-950/50 dark:text-blue-300"
        >
          Start Creating
        </HeroBadge>
      }
      title={
        <>
          Ready to Create{" "}
          <span className="bg-gradient-to-r from-blue-600 via-purple-600 to-pink-600 bg-clip-text text-transparent">
            Your Own Cards
          </span>{" "}
          ?
        </>
      }
      subtitle={
        "These examples use real data from @Alpha49. Generate your personalized cards with your own AniList statistics in seconds!"
      }
      primary={{
        label: (
          <>
            <Play className="mr-2 h-5 w-5 fill-current" />
            Create Your Cards
            <ArrowRight className="ml-2 h-5 w-5 transition-transform group-hover:translate-x-1" />
          </>
        ),
        onClick: onOpenGenerator,
        className:
          "group h-14 min-w-[220px] rounded-full bg-gradient-to-r from-blue-600 via-purple-600 to-pink-600 text-lg font-semibold shadow-lg shadow-purple-500/25 transition-all hover:scale-105 hover:shadow-xl hover:shadow-purple-500/30",
      }}
      secondary={{
        label: "Browse User Cards",
        href: "/search",
        asChild: true,
        variant: "outline",
        className:
          "h-14 min-w-[180px] rounded-full border-2 text-lg font-medium",
      }}
    />
  );
}
