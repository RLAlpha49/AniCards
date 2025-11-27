"use client";

import { useState, useCallback } from "react";
import { StatCardGenerator } from "@/components/stat-card-generator";
import { GridPattern } from "@/components/ui/grid-pattern";
import {
  trackButtonClick,
  trackDialogOpen,
} from "@/lib/utils/google-analytics";
import { HeroSection } from "@/components/home/hero-section";
import { PreviewShowcase } from "@/components/home/preview-showcase";
import { FeaturesSection } from "@/components/home/features-section";
import { Button } from "@/components/ui/button";
import { ErrorBoundary } from "@/components/error-boundary";
import { ArrowRight } from "lucide-react";
import { motion } from "framer-motion";

/**
 * Renders the AniCards landing page with hero, preview showcase, features,
 * and final call-to-action sections. Exposes the stat card generator modal.
 * @source
 */
export default function HomePage() {
  const [isGeneratorOpen, setIsGeneratorOpen] = useState(false);

  const handleGetStartedClick = useCallback(() => {
    trackButtonClick("get_started", "homepage");
    trackDialogOpen("stat_card_generator");
    setIsGeneratorOpen(true);
  }, []);

  const handleSeeExamplesClick = useCallback(() => {
    trackButtonClick("see_examples", "homepage");
    document.getElementById("preview-showcase")?.scrollIntoView({
      behavior: "smooth",
    });
  }, []);

  return (
    <ErrorBoundary
      resetKeys={[isGeneratorOpen ? "generator_open" : "generator_closed"]}
      onReset={() => setIsGeneratorOpen(false)}
    >
      <div className="relative w-full overflow-hidden">
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute inset-0 bg-gradient-to-b from-slate-50 via-white to-slate-100 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950" />
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_50%_at_50%_-20%,rgba(120,119,198,0.15),transparent)] dark:bg-[radial-gradient(ellipse_80%_50%_at_50%_-20%,rgba(120,119,198,0.3),transparent)]" />
          <div className="absolute -top-40 left-1/2 h-[600px] w-[600px] -translate-x-1/2 rounded-full bg-gradient-to-r from-blue-400/20 via-purple-400/20 to-pink-400/20 blur-3xl" />
          <div className="absolute -bottom-20 left-1/4 h-[400px] w-[400px] rounded-full bg-gradient-to-r from-cyan-400/15 to-blue-400/15 blur-3xl" />
          <div className="absolute left-0 top-1/4 h-[500px] w-[500px] rounded-full bg-gradient-to-r from-blue-500/10 to-purple-500/10 blur-3xl" />
          <div className="absolute bottom-1/4 right-0 h-[500px] w-[500px] rounded-full bg-gradient-to-r from-pink-500/10 to-orange-500/10 blur-3xl" />
        </div>

        <GridPattern className="z-0" />

        <div className="relative z-10">
          <HeroSection
            onGetStarted={handleGetStartedClick}
            onSeeExamples={handleSeeExamplesClick}
          />

          <PreviewShowcase onGetStarted={handleGetStartedClick} />

          <FeaturesSection />

          {/* Final CTA Section */}
          <section className="relative w-full overflow-hidden py-32">
            {/* Background gradient orbs */}
            <div className="pointer-events-none absolute inset-0 overflow-hidden">
              <div className="absolute -left-1/4 top-0 h-[500px] w-[500px] rounded-full bg-gradient-to-r from-blue-500/20 to-purple-500/20 blur-3xl" />
              <div className="absolute -right-1/4 bottom-0 h-[500px] w-[500px] rounded-full bg-gradient-to-r from-pink-500/20 to-orange-500/20 blur-3xl" />
            </div>

            <div className="container relative mx-auto px-4">
              <motion.div
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-100px" }}
                transition={{ duration: 0.6 }}
                className="mx-auto max-w-4xl"
              >
                {/* CTA content */}
                <div className="rounded-3xl border border-slate-200/50 bg-gradient-to-br from-white/80 via-white/60 to-slate-100/80 p-8 text-center shadow-2xl shadow-slate-200/50 backdrop-blur-xl dark:border-slate-700/50 dark:from-slate-800/80 dark:via-slate-800/60 dark:to-slate-900/80 dark:shadow-slate-900/50 sm:p-12 lg:p-16">
                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ delay: 0.2 }}
                    className="space-y-6"
                  >
                    <h2 className="text-3xl font-bold tracking-tight text-slate-900 dark:text-white sm:text-4xl lg:text-5xl">
                      Ready to Showcase Your{" "}
                      <span className="bg-gradient-to-r from-blue-600 via-purple-600 to-pink-600 bg-clip-text text-transparent">
                        Anime Journey
                      </span>?
                    </h2>

                    <p className="mx-auto max-w-2xl text-lg text-slate-600 dark:text-slate-300">
                      Join thousands of anime fans who are already sharing their
                      stats in style. Create beautiful, customizable cards in
                      seconds.
                    </p>

                    <div className="flex flex-col items-center justify-center gap-4 pt-4 sm:flex-row">
                      <Button
                        size="lg"
                        onClick={handleGetStartedClick}
                        className="group h-14 min-w-[220px] rounded-full bg-gradient-to-r from-blue-600 via-purple-600 to-pink-600 text-lg font-semibold shadow-lg shadow-blue-500/25 transition-all hover:scale-105 hover:shadow-xl hover:shadow-blue-500/30"
                      >
                        Start Creating
                        <ArrowRight className="ml-2 h-5 w-5 transition-transform group-hover:translate-x-1" />
                      </Button>
                      <Button
                        variant="outline"
                        size="lg"
                        onClick={handleSeeExamplesClick}
                        className="h-14 min-w-[180px] rounded-full border-2 text-lg font-medium"
                      >
                        View Examples
                      </Button>
                    </div>

                    <p className="pt-4 text-sm text-slate-500 dark:text-slate-400">
                      ✨ Free forever • No account needed • Instant generation
                    </p>
                  </motion.div>
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
      </div>
    </ErrorBoundary>
  );
}
