"use client";

import { motion } from "framer-motion";
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
} from "lucide-react";

const FEATURES = [
  {
    icon: BarChart2,
    title: "Comprehensive Stats",
    description:
      "View detailed statistics about your anime and manga, including watch time, episode count, and more.",
    color: "text-blue-500",
    bg: "bg-blue-50 dark:bg-blue-900/20",
  },
  {
    icon: Users,
    title: "Social Insights",
    description:
      "Track your Anilist social activity, including followers, following, and engagement metrics.",
    color: "text-green-500",
    bg: "bg-green-50 dark:bg-green-900/20",
  },
  {
    icon: BookOpen,
    title: "Manga Analysis",
    description:
      "Dive deep into your manga reading habits with chapter and volume counts, mean scores, and more.",
    color: "text-purple-500",
    bg: "bg-purple-50 dark:bg-purple-900/20",
  },
  {
    icon: Heart,
    title: "Genre & Tag Breakdown",
    description:
      "Discover your top anime and manga genres and tags to understand your preferences better.",
    color: "text-pink-500",
    bg: "bg-pink-50 dark:bg-pink-900/20",
  },
  {
    icon: Mic,
    title: "Voice Actor Spotlight",
    description:
      "Identify the voice actors who appear most frequently in your anime collection.",
    color: "text-orange-500",
    bg: "bg-orange-50 dark:bg-orange-900/20",
  },
  {
    icon: Building2,
    title: "Studio Insights",
    description:
      "See which animation studios produce your most-watched content.",
    color: "text-indigo-500",
    bg: "bg-indigo-50 dark:bg-indigo-900/20",
  },
  {
    icon: Zap,
    title: "Daily Updates",
    description:
      "Your statistics automatically refresh daily to keep your cards current and accurate.",
    color: "text-yellow-500",
    bg: "bg-yellow-50 dark:bg-yellow-900/20",
  },
  {
    icon: Sparkles,
    title: "Custom Themes",
    description:
      "Choose from beautiful presets or create your own color schemes to match your style.",
    color: "text-violet-500",
    bg: "bg-violet-50 dark:bg-violet-900/20",
  },
  {
    icon: Share2,
    title: "Easy Sharing",
    description:
      "Generate optimized SVG cards that work perfectly across all social media platforms.",
    color: "text-cyan-500",
    bg: "bg-cyan-50 dark:bg-cyan-900/20",
  },
];

export function FeaturesSection() {
  return (
    <section className="relative w-full overflow-hidden bg-transparent py-24">
      {/* Background Decoration */}
      <div className="absolute left-0 top-0 h-full w-full overflow-hidden opacity-30">
        <div className="absolute -left-[20%] top-[20%] h-[500px] w-[500px] rounded-full bg-blue-100 blur-[100px] dark:bg-blue-900/20" />
        <div className="absolute -right-[20%] bottom-[20%] h-[500px] w-[500px] rounded-full bg-purple-100 blur-[100px] dark:bg-purple-900/20" />
      </div>

      <div className="container relative mx-auto px-4">
        <div className="mx-auto max-w-7xl">
          <div className="mb-16 text-center">
            <motion.h2
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              className="mb-4 text-3xl font-bold text-slate-900 dark:text-white lg:text-4xl"
            >
              Everything You Need
            </motion.h2>
            <motion.p
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.1 }}
              className="mx-auto max-w-2xl text-lg text-slate-600 dark:text-slate-300"
            >
              Powerful features designed to showcase your anime and manga
              passion in the most beautiful way.
            </motion.p>
          </div>

          <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map((feature, index) => (
              <motion.div
                key={feature.title}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: index * 0.05 }}
                className="group relative rounded-2xl border border-slate-200 bg-white p-8 shadow-sm transition-all hover:-translate-y-1 hover:shadow-md dark:border-slate-800 dark:bg-slate-900"
              >
                <div
                  className={`mb-6 inline-flex rounded-xl p-3 ${feature.bg} ${feature.color}`}
                >
                  <feature.icon className="h-6 w-6" />
                </div>
                <h3 className="mb-3 text-xl font-bold text-slate-900 dark:text-white">
                  {feature.title}
                </h3>
                <p className="text-slate-600 dark:text-slate-400">
                  {feature.description}
                </p>
              </motion.div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
