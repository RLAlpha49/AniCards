"use client";

import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import {
  ArrowRight,
  Play,
  Sparkles,
  Star,
  TrendingUp,
  Palette,
  ArrowDown,
} from "lucide-react";
import { FloatingCardsLayer } from "@/components/floating-cards";

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
 * Quick value proposition badges shown below the hero buttons.
 * @source
 */
const VALUE_PROPS = [
  { icon: Star, text: "Free Forever" },
  { icon: TrendingUp, text: "No Login Required" },
  { icon: Palette, text: "Fully Customizable" },
];

/**
 * Animation variants for staggered text reveal.
 * @source
 */
const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.1, delayChildren: 0.1 },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.5 } },
};

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
    <section className="relative min-h-[100dvh] w-full overflow-hidden">
      {/* Floating Cards Layer */}
      <FloatingCardsLayer />

      <div className="container relative z-10 mx-auto flex min-h-[100dvh] flex-col items-center justify-center px-4 py-20 text-center">
        <motion.div
          variants={containerVariants}
          initial="hidden"
          animate="visible"
          className="flex max-w-5xl flex-col items-center gap-8"
        >
          {/* Badge */}
          <motion.div variants={itemVariants}>
            <span className="inline-flex items-center gap-2 rounded-full border border-blue-200/50 bg-blue-50/80 px-4 py-2 text-sm font-medium text-blue-700 shadow-sm backdrop-blur-sm dark:border-blue-700/50 dark:bg-blue-950/50 dark:text-blue-300">
              <Sparkles className="h-4 w-4" />
              Your AniList Stats, Beautifully Visualized
            </span>
          </motion.div>

          {/* Main heading */}
          <motion.h1
            variants={itemVariants}
            className="text-4xl font-extrabold leading-[1.1] tracking-tight text-slate-900 dark:text-white sm:text-5xl md:text-6xl lg:text-7xl"
          >
            Transform Your{" "}
            <span className="relative">
              <span className="relative z-10 bg-gradient-to-r from-blue-600 via-purple-600 to-pink-600 bg-clip-text text-transparent">
                Anime Journey
              </span>
              <motion.span
                className="absolute -inset-1 -z-10 block rounded-lg bg-gradient-to-r from-blue-600/20 via-purple-600/20 to-pink-600/20 blur-xl"
                animate={{ opacity: [0.5, 0.8, 0.5] }}
                transition={{ duration: 3, repeat: Infinity }}
              />
            </span>
            <br />
            Into Stunning Cards
          </motion.h1>

          {/* Subheading */}
          <motion.p
            variants={itemVariants}
            className="max-w-2xl text-lg text-slate-600 dark:text-slate-300 sm:text-xl"
          >
            Create beautiful, shareable stat cards from your AniList profile.
            Over 20+ card types with full customization — colors, themes, and
            layouts that match your style.
          </motion.p>

          {/* CTA buttons */}
          <motion.div
            variants={itemVariants}
            className="flex flex-col items-center gap-4 sm:flex-row"
          >
            <Button
              size="lg"
              onClick={onGetStarted}
              className="group relative h-14 min-w-[200px] overflow-hidden rounded-full bg-gradient-to-r from-blue-600 via-purple-600 to-pink-600 text-lg font-semibold shadow-lg shadow-purple-500/25 transition-all hover:scale-105 hover:shadow-xl hover:shadow-purple-500/30"
            >
              <span className="relative z-10 flex items-center">
                <Play className="mr-2 h-5 w-5 fill-current" />
                Create Your Card
                <ArrowRight className="ml-2 h-5 w-5 transition-transform group-hover:translate-x-1" />
              </span>
            </Button>

            <Button
              variant="outline"
              size="lg"
              onClick={onSeeExamples}
              className="h-14 min-w-[180px] rounded-full border-2 border-slate-300 bg-white/50 text-lg font-medium backdrop-blur-sm transition-all hover:border-slate-400 hover:bg-white dark:border-slate-700 dark:bg-slate-900/50 dark:hover:border-slate-600 dark:hover:bg-slate-800/80"
            >
              View Examples
            </Button>
          </motion.div>

          {/* Value props */}
          <motion.div
            variants={itemVariants}
            className="flex flex-wrap items-center justify-center gap-6 pt-4"
          >
            {VALUE_PROPS.map((prop) => (
              <div
                key={prop.text}
                className="flex items-center gap-2 text-sm font-medium text-slate-600 dark:text-slate-400"
              >
                <prop.icon className="h-4 w-4 text-green-500" />
                <span>{prop.text}</span>
              </div>
            ))}
          </motion.div>
        </motion.div>

        {/* Scroll indicator */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1, y: [0, 10, 0] }}
          transition={{
            opacity: { delay: 1, duration: 0.5 },
            y: { repeat: Infinity, duration: 2 },
          }}
          className="absolute bottom-[10vh] left-1/2"
        >
          <ArrowDown className="h-6 w-6" />
        </motion.div>
      </div>
    </section>
  );
}
