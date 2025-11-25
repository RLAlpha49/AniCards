"use client";

import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { ArrowRight, Play, Sparkles, ArrowDown } from "lucide-react";
import { FloatingCardsLayer } from "@/components/ui/floating-cards";

/**
 * Props for the home page hero section.
 * @property onGetStarted - Called when the primary action (Create Cards) is triggered.
 * @property onSeeExamples - Called when the secondary action (View Gallery) is triggered.
 * @source
 */
interface HeroSectionProps {
  onGetStarted: () => void;
  onSeeExamples: () => void;
}

/**
 * Renders the hero section on the landing page with main actions and a
 * decorative floating cards layer.
 *
 * @param props - Component props.
 * @param props.onGetStarted - Handler invoked when the Create Cards button is clicked.
 * @param props.onSeeExamples - Handler invoked when the View Gallery button is clicked.
 * @returns The hero section element.
 * @source
 */
export function HeroSection({
  onGetStarted,
  onSeeExamples,
}: Readonly<HeroSectionProps>) {
  return (
    <section className="relative min-h-[95vh] w-full overflow-hidden bg-transparent">
      {/* Floating Cards Layer */}
      <FloatingCardsLayer />

      <div className="container relative z-10 mx-auto flex min-h-[95vh] flex-col items-center justify-center px-4 py-20 text-center">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="mb-8 inline-flex items-center rounded-full border border-blue-200 bg-blue-50/80 px-4 py-1.5 text-sm font-medium text-blue-600 backdrop-blur-sm dark:border-blue-800 dark:bg-blue-900/30 dark:text-blue-400"
        >
          <Sparkles className="mr-2 h-4 w-4" />
          <span>The Ultimate AniList Companion</span>
        </motion.div>

        <motion.h1
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.1 }}
          className="mb-6 max-w-4xl text-5xl font-extrabold leading-tight tracking-tight text-slate-900 dark:text-white sm:text-6xl lg:text-7xl"
        >
          Visualize Your <br />
          <span className="bg-gradient-to-r from-blue-600 via-purple-600 to-pink-600 bg-clip-text text-transparent">
            Anime Journey
          </span>
        </motion.h1>

        <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.2 }}
          className="mb-10 max-w-2xl text-lg text-slate-600 dark:text-slate-300 sm:text-xl"
        >
          Turn your AniList profile into stunning, shareable stat cards. Track
          your progress, showcase your favorites, and express your style with
          over 20+ customizable card types.
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.3 }}
          className="flex flex-col items-center justify-center gap-4 sm:flex-row"
        >
          <Button
            size="lg"
            onClick={onGetStarted}
            className="group h-14 min-w-[200px] rounded-full bg-gradient-to-r from-blue-600 via-purple-600 to-pink-600 text-lg font-semibold shadow-lg transition-all hover:scale-105 hover:shadow-xl hover:shadow-blue-500/25"
          >
            <Play className="mr-2 h-5 w-5 fill-current" />
            Create Cards
            <ArrowRight className="ml-2 h-5 w-5 transition-transform group-hover:translate-x-1" />
          </Button>
          <Button
            variant="outline"
            size="lg"
            onClick={onSeeExamples}
            className="h-14 min-w-[200px] rounded-full border-2 bg-white/50 text-lg font-semibold backdrop-blur-sm hover:bg-slate-100 dark:bg-slate-900/50 dark:hover:bg-slate-800"
          >
            View Gallery
          </Button>
        </motion.div>

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.5, delay: 0.4 }}
          className="mt-12 flex flex-wrap items-center justify-center gap-x-8 gap-y-4 text-sm font-medium text-slate-500 dark:text-slate-400"
        >
          <div className="flex items-center gap-2">
            <div className="h-2 w-2 rounded-full bg-green-500" />
            Free Forever
          </div>
          <div className="flex items-center gap-2">
            <div className="h-2 w-2 rounded-full bg-blue-500" />
            No Login Required
          </div>
          <div className="flex items-center gap-2">
            <div className="h-2 w-2 rounded-full bg-purple-500" />
            Instant Generation
          </div>
        </motion.div>

        {/* Scroll Indicator */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1, y: [0, 10, 0] }}
          transition={{
            opacity: { delay: 1, duration: 0.5 },
            y: { repeat: Infinity, duration: 2 },
          }}
          className="absolute bottom-8 left-1/2 -translate-x-1/2 text-slate-400"
        >
          <ArrowDown className="h-6 w-6" />
        </motion.div>
      </div>
    </section>
  );
}
