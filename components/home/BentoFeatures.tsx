"use client";

import { motion, useInView } from "framer-motion";
import {
  BarChart2,
  BookOpen,
  Building2,
  Heart,
  Mic,
  Palette,
  Share2,
  Shield,
} from "lucide-react";
import { useRef } from "react";

const FEATURES = [
  {
    num: "Ⅰ",
    icon: BarChart2,
    title: "COMPREHENSIVE STATS",
    desc: "Detailed statistics about your anime and manga including watch time, episodes, and scores.",
    span: "md:col-span-2 md:row-span-1",
  },
  {
    num: "Ⅱ",
    icon: Heart,
    title: "GENRE BREAKDOWN",
    desc: "Discover your top genres and tags with beautiful pie charts and visualizations.",
    span: "md:col-span-1 md:row-span-2",
  },
  {
    num: "Ⅲ",
    icon: Palette,
    title: "CUSTOM THEMES",
    desc: "Choose from beautiful presets or create your own color schemes to match your style.",
    span: "md:col-span-1 md:row-span-1",
  },
  {
    num: "Ⅳ",
    icon: BookOpen,
    title: "MANGA ANALYSIS",
    desc: "Deep dive into reading habits with chapter counts, volume progress, and mean scores.",
    span: "md:col-span-1 md:row-span-1",
  },
  {
    num: "Ⅴ",
    icon: Mic,
    title: "VOICE ACTOR SPOTLIGHT",
    desc: "Identify the voice actors who appear most frequently across your anime collection.",
    span: "md:col-span-1 md:row-span-1",
  },
  {
    num: "Ⅵ",
    icon: Building2,
    title: "STUDIO INSIGHTS",
    desc: "See which animation studios produce your most-watched and highest-rated content.",
    span: "md:col-span-1 md:row-span-1",
  },
  {
    num: "Ⅶ",
    icon: Share2,
    title: "EFFORTLESS SHARING",
    desc: "Generate optimized SVG cards that display flawlessly on GitHub, Discord, and social media.",
    span: "md:col-span-1 md:row-span-1",
  },
  {
    num: "Ⅷ",
    icon: Shield,
    title: "PRIVACY FIRST",
    desc: "No account needed. We only access public AniList data with full transparency.",
    span: "md:col-span-2 md:row-span-1",
  },
] as const;

export function BentoFeatures() {
  const ref = useRef<HTMLElement>(null);
  const isInView = useInView(ref, { once: true, margin: "-20px" });

  return (
    <section ref={ref} className="relative px-6 py-20 sm:px-12 md:py-28">
      <div className="mx-auto max-w-6xl">
        <div className="mb-14 text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={isInView ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.5 }}
            className="gold-ornament mb-6"
          >
            <span className="text-gold text-lg">❖</span>
          </motion.div>

          <motion.h2
            initial={{ opacity: 0, y: 20 }}
            animate={isInView ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.5, delay: 0.1 }}
            className="font-display text-foreground mb-4 text-3xl sm:text-4xl lg:text-5xl"
          >
            THE <span className="text-gold">COLLECTION</span>
          </motion.h2>

          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={isInView ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.5, delay: 0.2 }}
            className="font-body-serif text-foreground/50 mx-auto max-w-xl text-base sm:text-lg"
          >
            Every facet of your anime and manga experience, distilled into
            beautifully crafted visual cards.
          </motion.p>
        </div>

        <div className="grid gap-4 md:auto-rows-[180px] md:grid-cols-3">
          {FEATURES.map((f, i) => (
            <motion.div
              key={f.title}
              initial={{ opacity: 0, y: 24, scale: 0.96 }}
              animate={isInView ? { opacity: 1, y: 0, scale: 1 } : {}}
              transition={{
                duration: 0.5,
                delay: 0.15 + i * 0.06,
                ease: [0.22, 1, 0.36, 1],
              }}
              whileHover={{ y: -4, transition: { duration: 0.25 } }}
              className={`bento-cell group ${f.span}`}
            >
              <div className="flex h-full flex-col justify-between p-6 sm:p-8">
                <div className="flex items-start justify-between">
                  <f.icon className="text-gold/60 group-hover:text-gold h-5 w-5 transition-colors" />
                  <span className="font-display text-gold/30 group-hover:text-gold/50 text-2xl transition-colors">
                    {f.num}
                  </span>
                </div>
                <div>
                  <h3 className="font-display text-foreground mb-2 text-xs tracking-[0.25em] sm:text-sm">
                    {f.title}
                  </h3>
                  <p className="font-body-serif text-foreground/45 text-sm leading-relaxed">
                    {f.desc}
                  </p>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
