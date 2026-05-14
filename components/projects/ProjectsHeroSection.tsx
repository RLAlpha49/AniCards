"use client";

import { motion, useReducedMotion } from "framer-motion";

import {
  buildFadeUpVariants,
  buildMotionSafeStaggerContainer,
  EASE_OUT_EXPO,
  NO_MOTION_TRANSITION,
} from "@/lib/animations";

import { PROJECT_HERO_STATS } from "./constants";

export function ProjectsHeroSection() {
  const prefersReducedMotion = useReducedMotion() ?? false;
  const orchestrate = buildMotionSafeStaggerContainer({
    reducedMotion: prefersReducedMotion,
    staggerChildren: 0.12,
    delayChildren: 0.15,
  });
  const rise = buildFadeUpVariants({
    reducedMotion: prefersReducedMotion,
    distance: 40,
    duration: 0.8,
  });
  const revealLine = {
    hidden: { scaleX: prefersReducedMotion ? 1 : 0 },
    visible: {
      scaleX: 1,
      transition: prefersReducedMotion
        ? NO_MOTION_TRANSITION
        : { duration: 1.1, ease: EASE_OUT_EXPO },
    },
  };
  const fadeIn = buildFadeUpVariants({
    reducedMotion: prefersReducedMotion,
    distance: 0,
    duration: 1.2,
  });

  return (
    <section className="relative overflow-hidden px-6 pt-32 pb-24 sm:px-12 md:pt-44 md:pb-36">
      {/* Radial spotlight */}
      <div
        aria-hidden="true"
        className="
          pointer-events-none absolute inset-0
          bg-[radial-gradient(ellipse_70%_50%_at_25%_40%,hsl(var(--gold)/0.06),transparent)]
        "
      />

      <motion.div
        variants={orchestrate}
        initial="hidden"
        animate="visible"
        className="relative z-10 mx-auto max-w-7xl"
      >
        {/* Catalog label */}
        <motion.div
          variants={fadeIn}
          className="mb-10 flex items-center gap-4 sm:mb-14"
        >
          <span className="font-mono text-[0.6rem] tracking-[0.5em] text-gold uppercase sm:text-xs">
            ◆ Portfolio
          </span>
          <span className="
            inline-block h-px max-w-32 flex-1 bg-linear-to-r from-gold/40 to-transparent
          " />
        </motion.div>

        {/* Headline stack — massive scale contrast */}
        <motion.h1
          variants={rise}
          className="
            relative mb-10 font-display text-[3.5rem] leading-[0.88] tracking-tight
            sm:mb-14 sm:text-[5.5rem]
            md:text-[7.5rem]
            lg:text-[10rem]
          "
        >
          <span className="block text-foreground">MORE</span>
          <span className="-mt-1 block text-gold sm:-mt-2 md:-mt-3 lg:-mt-4">
            PROJECTS
          </span>
        </motion.h1>

        {/* Gold ruled divider */}
        <motion.div
          variants={revealLine}
          className="
            mb-10 h-0.75 max-w-24 origin-left bg-linear-to-r from-gold to-gold/20
            sm:mb-12 sm:max-w-32
          "
        />

        {/* Two-column intro with stats ribbon */}
        <div className="grid items-end gap-10 md:grid-cols-[1fr_auto] md:gap-20">
          <motion.p
            variants={rise}
            className="
              max-w-lg font-body-serif text-base leading-[1.85] text-foreground/50
              sm:text-lg
            "
          >
            Open-source tools for anyone tired of clunky anime and media
            tracking setups. Carefully built, steadily maintained, and wide open
            if you want to pitch in.
          </motion.p>

          <motion.div
            variants={rise}
            className="flex gap-8 sm:gap-12"
            aria-label="Project statistics"
          >
            {PROJECT_HERO_STATS.map((stat) => (
              <div key={stat.label} className="text-right">
                <span className="block font-display text-2xl text-gold sm:text-3xl">
                  {stat.value}
                </span>
                <span className="
                  font-mono text-[0.6rem] tracking-[0.3em] text-foreground/35 uppercase
                ">
                  {stat.label}
                </span>
              </div>
            ))}
          </motion.div>
        </div>
      </motion.div>
    </section>
  );
}
