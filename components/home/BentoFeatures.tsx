"use client";

import { motion, useInView, useReducedMotion } from "framer-motion";
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

import {
  buildFadeUpVariants,
  buildMotionSafeStaggerContainer,
  buildScaleInVariants,
  getMotionSafeAnimation,
} from "@/lib/animations";

const FEATURES = [
  {
    num: "Ⅰ",
    icon: BarChart2,
    title: "FULL-PICTURE STATS",
    desc: "Watch time, episode counts, scores — the whole rundown for your anime and manga lives here.",
    span: "md:col-span-2 md:row-span-1",
  },
  {
    num: "Ⅱ",
    icon: Heart,
    title: "GENRE DEEP DIVE",
    desc: "Find out which genres and tags pull you in most, laid out in clean pie charts and vivid visuals.",
    span: "md:col-span-1 md:row-span-2",
  },
  {
    num: "Ⅲ",
    icon: Palette,
    title: "CUSTOM PALETTES",
    desc: "Pick a preset that catches your eye, or create your own color scheme from scratch.",
    span: "md:col-span-1 md:row-span-1",
  },
  {
    num: "Ⅳ",
    icon: BookOpen,
    title: "MANGA BREAKDOWN",
    desc: "Chapter counts, volume progress, average scores — your reading habits, all in one spot.",
    span: "md:col-span-1 md:row-span-1",
  },
  {
    num: "Ⅴ",
    icon: Mic,
    title: "VOICE ACTOR SPOTLIGHT",
    desc: "See which voice actors keep showing up across the anime you’ve watched.",
    span: "md:col-span-1 md:row-span-1",
  },
  {
    num: "Ⅵ",
    icon: Building2,
    title: "STUDIO BREAKDOWN",
    desc: "Find out which animation studios are behind the shows you watch most — and rate highest.",
    span: "md:col-span-1 md:row-span-1",
  },
  {
    num: "Ⅶ",
    icon: Share2,
    title: "SHARE ANYWHERE",
    desc: "Crisp SVG cards that look just right on AniList, or wherever you drop them.",
    span: "md:col-span-1 md:row-span-1",
  },
  {
    num: "Ⅷ",
    icon: Shield,
    title: "YOUR DATA, YOUR CALL",
    desc: "No account required. We only pull what’s already public on your AniList profile — nothing hidden.",
    span: "md:col-span-2 md:row-span-1",
  },
] as const;

export function BentoFeatures() {
  const ref = useRef<HTMLElement>(null);
  const isInView = useInView(ref, { once: true, margin: "-20px" });
  const prefersReducedMotion = useReducedMotion() ?? false;
  const headingVariants = buildMotionSafeStaggerContainer({
    reducedMotion: prefersReducedMotion,
    staggerChildren: 0.1,
  });
  const headingItemVariants = buildFadeUpVariants({
    reducedMotion: prefersReducedMotion,
    distance: 20,
    duration: 0.5,
  });
  const featureContainerVariants = buildMotionSafeStaggerContainer({
    reducedMotion: prefersReducedMotion,
    staggerChildren: 0.06,
    delayChildren: 0.15,
  });
  const featureVariants = buildScaleInVariants({
    reducedMotion: prefersReducedMotion,
    initialScale: 0.96,
    y: 24,
    duration: 0.5,
  });

  return (
    <section ref={ref} className="relative px-6 py-20 sm:px-12 md:py-28">
      <div className="mx-auto max-w-6xl">
        <motion.div
          variants={headingVariants}
          initial={false}
          animate={isInView ? "visible" : undefined}
          className="mb-14 text-center"
        >
          <motion.div
            variants={headingItemVariants}
            className="mb-6 gold-ornament"
          >
            <span className="text-lg text-gold">❖</span>
          </motion.div>

          <motion.h2
            variants={headingItemVariants}
            className="mb-4 font-display text-3xl text-foreground sm:text-4xl lg:text-5xl"
          >
            THE <span className="text-gold">REPERTOIRE</span>
          </motion.h2>

          <motion.p
            variants={headingItemVariants}
            className="mx-auto max-w-xl font-body-serif text-base text-foreground/50 sm:text-lg"
          >
            Every corner of your anime and manga world, shaped into cards worth
            showing off.
          </motion.p>
        </motion.div>

        <motion.div
          variants={featureContainerVariants}
          initial={false}
          animate={isInView ? "visible" : undefined}
          className="grid gap-4 md:auto-rows-[180px] md:grid-cols-3"
        >
          {FEATURES.map((f, i) => (
            <motion.div
              key={f.title}
              custom={i}
              variants={featureVariants}
              whileHover={getMotionSafeAnimation(prefersReducedMotion, {
                y: -4,
                transition: { duration: 0.25 },
              })}
              className={`group bento-cell ${f.span}`}
            >
              <div className="flex h-full flex-col justify-between p-6 sm:p-8">
                <div className="flex items-start justify-between">
                  <f.icon className="size-5 text-gold/60 transition-colors group-hover:text-gold" />
                  <span className="
                    font-display text-2xl text-gold/30 transition-colors
                    group-hover:text-gold/50
                  ">
                    {f.num}
                  </span>
                </div>
                <div>
                  <h3 className="
                    mb-2 font-display text-xs tracking-[0.25em] text-foreground
                    sm:text-sm
                  ">
                    {f.title}
                  </h3>
                  <p className="font-body-serif text-sm/relaxed text-foreground/45">
                    {f.desc}
                  </p>
                </div>
              </div>
            </motion.div>
          ))}
        </motion.div>
      </div>
    </section>
  );
}
