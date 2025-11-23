/* eslint-disable @next/next/no-img-element */
"use client";

import { useState } from "react";
import { StatCardGenerator } from "@/components/stat-card-generator";
import {
  trackButtonClick,
  trackDialogOpen,
} from "@/lib/utils/google-analytics";
import { HeroSection } from "@/components/home/hero-section";
import { PreviewShowcase } from "@/components/home/preview-showcase";
import { FeaturesSection } from "@/components/home/features-section";
import { Button } from "@/components/ui/button";
import { Play, Sparkles } from "lucide-react";
import { motion } from "framer-motion";

export default function HomePage() {
  const [isGeneratorOpen, setIsGeneratorOpen] = useState(false);

  const handleGetStartedClick = () => {
    trackButtonClick("get_started", "homepage");
    trackDialogOpen("stat_card_generator");
    setIsGeneratorOpen(true);
  };

  const handleSeeExamplesClick = () => {
    trackButtonClick("see_examples", "homepage");
    document.getElementById("preview-showcase")?.scrollIntoView({
      behavior: "smooth",
    });
  };

  return (
    <div className="relative w-full overflow-hidden bg-gradient-to-b from-slate-50 via-blue-50/5 via-80% to-slate-900 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950">
      <HeroSection
        onGetStarted={handleGetStartedClick}
        onSeeExamples={handleSeeExamplesClick}
      />

      <PreviewShowcase onGetStarted={handleGetStartedClick} />

      <FeaturesSection />

      {/* CTA Section */}
      <section className="relative w-full overflow-hidden bg-transparent py-24 text-white">
        <div className="container relative mx-auto px-4 text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="mx-auto max-w-3xl space-y-8"
          >
            <div className="inline-flex items-center rounded-full bg-white/10 px-4 py-1.5 backdrop-blur-sm">
              <Sparkles className="mr-2 h-4 w-4 text-yellow-400" />
              <span className="text-sm font-medium">Ready to start?</span>
            </div>

            <h2 className="text-4xl font-bold leading-tight sm:text-5xl">
              Transform Your AniList Data into{" "}
              <span className="block bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text pb-4 text-transparent">
                Stunning Visual Stories
              </span>
            </h2>

            <p className="!mt-0 text-lg text-slate-300 sm:text-xl">
              Create your first card in seconds, completely free.
            </p>

            <div className="flex flex-col items-center justify-center gap-4 sm:flex-row">
              <Button
                size="lg"
                onClick={handleGetStartedClick}
                className="h-14 min-w-[200px] rounded-full bg-white text-lg font-bold text-slate-900 hover:bg-slate-100"
              >
                <Play className="mr-2 h-5 w-5 fill-current" />
                Create Now
              </Button>
            </div>
          </motion.div>
        </div>
      </section>

      <StatCardGenerator
        isOpen={isGeneratorOpen}
        onClose={() => setIsGeneratorOpen(false)}
        className={`transition-opacity duration-300 ${
          isGeneratorOpen ? "opacity-100" : "opacity-0"
        }`}
      />
    </div>
  );
}
