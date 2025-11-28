"use client";

import { motion, useInView } from "framer-motion";
import { useRef } from "react";
import {
  BarChart2,
  Users,
  BookOpen,
  Heart,
  Mic,
  Building2,
  Zap,
  Sparkles,
  Share2,
  Palette,
  Clock,
  Shield,
} from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Feature definition used in the features grid.
 * @source
 */
interface Feature {
  icon: typeof BarChart2;
  title: string;
  description: string;
  gradient: string;
  iconColor: string;
}

/**
 * An array of homepage feature cards, each containing an icon and descriptors
 * used to populate the features grid.
 * @source
 */
const FEATURES: Feature[] = [
  {
    icon: BarChart2,
    title: "Comprehensive Stats",
    description:
      "Detailed statistics about your anime and manga including watch time, episodes, and scores.",
    gradient: "from-blue-500/10 to-cyan-500/10",
    iconColor: "text-blue-500",
  },
  {
    icon: Users,
    title: "Social Insights",
    description:
      "Track your AniList social activity with followers, following, and engagement metrics.",
    gradient: "from-green-500/10 to-emerald-500/10",
    iconColor: "text-green-500",
  },
  {
    icon: BookOpen,
    title: "Manga Analysis",
    description:
      "Deep dive into reading habits with chapter counts, volume progress, and mean scores.",
    gradient: "from-purple-500/10 to-violet-500/10",
    iconColor: "text-purple-500",
  },
  {
    icon: Heart,
    title: "Genre Breakdown",
    description:
      "Discover your top genres and tags with beautiful pie charts and visualizations.",
    gradient: "from-pink-500/10 to-rose-500/10",
    iconColor: "text-pink-500",
  },
  {
    icon: Mic,
    title: "Voice Actor Spotlight",
    description:
      "Identify the voice actors who appear most frequently across your anime collection.",
    gradient: "from-orange-500/10 to-amber-500/10",
    iconColor: "text-orange-500",
  },
  {
    icon: Building2,
    title: "Studio Insights",
    description:
      "See which animation studios produce your most-watched and highest-rated content.",
    gradient: "from-indigo-500/10 to-blue-500/10",
    iconColor: "text-indigo-500",
  },
  {
    icon: Palette,
    title: "Custom Themes",
    description:
      "Choose from beautiful presets or create your own color schemes to match your style.",
    gradient: "from-violet-500/10 to-purple-500/10",
    iconColor: "text-violet-500",
  },
  {
    icon: Share2,
    title: "Easy Sharing",
    description:
      "Generate optimized SVG cards that work perfectly on GitHub, Discord, and social media.",
    gradient: "from-cyan-500/10 to-teal-500/10",
    iconColor: "text-cyan-500",
  },
  {
    icon: Shield,
    title: "Privacy First",
    description:
      "No account needed. We only access public AniList data with full transparency.",
    gradient: "from-slate-500/10 to-gray-500/10",
    iconColor: "text-slate-500",
  },
];

/**
 * Highlights for the "why choose us" section.
 * @source
 */
const HIGHLIGHTS = [
  {
    icon: Zap,
    title: "Instant Generation",
    description: "Cards generated in milliseconds, updated daily",
  },
  {
    icon: Sparkles,
    title: "Always Free",
    description: "No premium tiers, no limitations, free forever",
  },
  {
    icon: Clock,
    title: "Daily Updates",
    description: "Stats automatically refresh to stay current",
  },
];

/**
 * Renders a grid of application feature cards for the homepage.
 * @source
 */
export function FeaturesSection() {
  const sectionRef = useRef<HTMLElement>(null);
  const isInView = useInView(sectionRef, { once: true, margin: "-100px" });

  return (
    <section
      ref={sectionRef}
      className="relative w-full overflow-hidden py-24 lg:py-32"
    >
      <div className="container relative mx-auto px-4">
        <div className="mx-auto max-w-7xl">
          {/* Section header */}
          <div className="mb-16 text-center lg:mb-20">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={isInView ? { opacity: 1, y: 0 } : {}}
              transition={{ duration: 0.5 }}
              className="mb-4"
            >
              <span className="inline-block rounded-full bg-blue-100 px-4 py-1.5 text-sm font-medium text-blue-700 dark:bg-blue-900/30 dark:text-blue-300">
                Features
              </span>
            </motion.div>

            <motion.h2
              initial={{ opacity: 0, y: 20 }}
              animate={isInView ? { opacity: 1, y: 0 } : {}}
              transition={{ duration: 0.5, delay: 0.1 }}
              className="mb-4 text-3xl font-bold text-slate-900 dark:text-white sm:text-4xl lg:text-5xl"
            >
              Everything You Need to{" "}
              <span className="bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
                Showcase Your Journey
              </span>
            </motion.h2>

            <motion.p
              initial={{ opacity: 0, y: 20 }}
              animate={isInView ? { opacity: 1, y: 0 } : {}}
              transition={{ duration: 0.5, delay: 0.2 }}
              className="mx-auto max-w-2xl text-lg text-slate-600 dark:text-slate-300"
            >
              Powerful features designed to visualize your anime and manga
              passion in the most beautiful way possible.
            </motion.p>
          </div>

          {/* Features grid */}
          <div className="mb-20 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map((feature, index) => (
              <motion.div
                key={feature.title}
                initial={{ opacity: 0, y: 20 }}
                animate={isInView ? { opacity: 1, y: 0 } : {}}
                transition={{ duration: 0.5, delay: 0.1 + index * 0.05 }}
              >
                <div className="group relative h-full overflow-hidden rounded-2xl border border-slate-200/50 bg-white/80 p-6 shadow-sm backdrop-blur-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-lg dark:border-slate-700/50 dark:bg-slate-800/80">
                  {/* Gradient background on hover */}
                  <div
                    className={cn(
                      "absolute inset-0 bg-gradient-to-br opacity-0 transition-opacity duration-300 group-hover:opacity-100",
                      feature.gradient,
                    )}
                  />

                  <div className="relative">
                    {/* Icon */}
                    <div
                      className={cn(
                        "mb-4 inline-flex rounded-xl bg-slate-100 p-3 transition-colors dark:bg-slate-700/50",
                        feature.iconColor,
                      )}
                    >
                      <feature.icon className="h-6 w-6" />
                    </div>

                    {/* Content */}
                    <h3 className="mb-2 text-lg font-bold text-slate-900 dark:text-white">
                      {feature.title}
                    </h3>
                    <p className="text-sm leading-relaxed text-slate-600 dark:text-slate-400">
                      {feature.description}
                    </p>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>

          {/* Highlights row */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={isInView ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.5, delay: 0.6 }}
            className="rounded-2xl border border-slate-200/50 bg-gradient-to-r from-blue-50 via-purple-50 to-pink-50 p-8 dark:border-slate-700/50 dark:from-blue-900/20 dark:via-purple-900/20 dark:to-pink-900/20 lg:p-10"
          >
            <div className="grid gap-8 sm:grid-cols-3">
              {HIGHLIGHTS.map((highlight, index) => (
                <div key={highlight.title} className="text-center">
                  <motion.div
                    initial={{ scale: 0.8 }}
                    animate={isInView ? { scale: 1 } : {}}
                    transition={{ duration: 0.5, delay: 0.7 + index * 0.1 }}
                    className="mx-auto mb-4 inline-flex rounded-full bg-white p-4 shadow-md dark:bg-slate-800"
                  >
                    <highlight.icon className="h-6 w-6 text-blue-600 dark:text-blue-400" />
                  </motion.div>
                  <h4 className="mb-1 font-bold text-slate-900 dark:text-white">
                    {highlight.title}
                  </h4>
                  <p className="text-sm text-slate-600 dark:text-slate-400">
                    {highlight.description}
                  </p>
                </div>
              ))}
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
