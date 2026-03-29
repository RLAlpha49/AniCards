"use client";

import { motion, useReducedMotion } from "framer-motion";

import {
  buildFadeUpVariants,
  buildMotionSafeStaggerContainer,
} from "@/lib/animations";

export function ContactHeroSection() {
  const prefersReducedMotion = useReducedMotion() ?? false;
  const container = buildMotionSafeStaggerContainer({
    reducedMotion: prefersReducedMotion,
    staggerChildren: 0.1,
    delayChildren: 0.25,
  });
  const fadeUp = buildFadeUpVariants({
    reducedMotion: prefersReducedMotion,
    distance: 32,
    duration: 0.75,
  });

  return (
    <section className="relative overflow-hidden px-6 pt-28 pb-24 sm:px-12 md:pt-40 md:pb-32">
      {/* Centered radial glow */}
      <div className="
        pointer-events-none absolute top-1/3 left-1/2 h-125 w-175 -translate-1/2 rounded-full
        bg-[hsl(var(--gold)/0.045)] blur-[140px]
      " />

      <motion.div
        variants={container}
        initial="hidden"
        animate="visible"
        className="relative z-10 mx-auto max-w-5xl"
      >
        {/* Decorative top frame */}
        <motion.div variants={fadeUp} className="mb-16 flex items-center gap-4">
          <div className="h-px flex-1 bg-linear-to-r from-transparent to-[hsl(var(--gold)/0.2)]" />
          <div className="flex items-center gap-3">
            <span className="block size-1.5 rotate-45 border border-[hsl(var(--gold)/0.4)]" />
            <span
              className="text-[10px] tracking-[0.5em] uppercase"
              style={{
                fontFamily: "var(--font-geist-mono), monospace",
                color: "hsl(var(--gold) / 0.45)",
              }}
            >
              Say Hello
            </span>
            <span className="block size-1.5 rotate-45 border border-[hsl(var(--gold)/0.4)]" />
          </div>
          <div className="h-px flex-1 bg-linear-to-l from-transparent to-[hsl(var(--gold)/0.2)]" />
        </motion.div>

        {/* Oversized stacked headline */}
        <div className="text-center">
          <motion.h1
            variants={fadeUp}
            className="font-display text-[clamp(3.5rem,13vw,11rem)] leading-[0.82] font-black"
          >
            <span className="block text-foreground">GET IN</span>
            <span className="block text-gold">TOUCH</span>
          </motion.h1>
        </div>

        {/* Gold separator */}
        <motion.div
          variants={fadeUp}
          className="
            mx-auto mt-10 mb-8 h-0.5 max-w-24 bg-linear-to-r from-transparent
            via-[hsl(var(--gold)/0.6)] to-transparent
          "
        />
      </motion.div>
    </section>
  );
}
