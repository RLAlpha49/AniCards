"use client";

import { motion, useReducedMotion } from "framer-motion";

import {
  buildFadeUpVariants,
  buildMotionSafeStaggerContainer,
  EASE_OUT_EXPO,
  NO_MOTION_TRANSITION,
} from "@/lib/animations";

import { ETHOS_ITEMS } from "./constants";

export function ProjectEthos() {
  const prefersReducedMotion = useReducedMotion() ?? false;
  const labelFade = buildFadeUpVariants({
    reducedMotion: prefersReducedMotion,
    distance: 0,
    duration: 0.5,
  });
  const stagger = buildMotionSafeStaggerContainer({
    reducedMotion: prefersReducedMotion,
    staggerChildren: 0.15,
    delayChildren: 0.1,
  });
  const cardReveal = {
    hidden: prefersReducedMotion ? { opacity: 1, y: 0 } : { opacity: 0, y: 24 },
    visible: {
      opacity: 1,
      y: 0,
      transition: prefersReducedMotion
        ? NO_MOTION_TRANSITION
        : {
            duration: 0.65,
            ease: EASE_OUT_EXPO,
            staggerChildren: 0.08,
            delayChildren: 0.12,
          },
    },
  };
  const childFade = buildFadeUpVariants({
    reducedMotion: prefersReducedMotion,
    distance: 10,
    duration: 0.45,
  });
  const dotScale = {
    hidden: prefersReducedMotion
      ? { opacity: 1, scale: 1 }
      : { opacity: 0, scale: 0 },
    visible: {
      opacity: 1,
      scale: 1,
      transition: prefersReducedMotion
        ? NO_MOTION_TRANSITION
        : { duration: 0.5, ease: EASE_OUT_EXPO },
    },
  };
  const lineGrow = {
    hidden: { scaleX: prefersReducedMotion ? 1 : 0 },
    visible: {
      scaleX: 1,
      transition: prefersReducedMotion
        ? NO_MOTION_TRANSITION
        : { duration: 1.2, ease: EASE_OUT_EXPO },
    },
  };

  return (
    <section className="relative px-6 py-20 sm:px-12 md:py-28">
      <div className="relative mx-auto max-w-7xl">
        {/* Section label */}
        <motion.div
          variants={labelFade}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-40px" }}
          className="
            mb-14 flex items-center gap-4 font-mono text-[0.6rem] tracking-[0.4em] uppercase
            sm:text-xs
          "
        >
          <span className="text-gold/60">03</span>
          <span className="
            inline-block h-px max-w-16 flex-1 bg-linear-to-r from-gold/30 to-transparent
          " />
          <span className="text-foreground/30">Principles</span>
        </motion.div>

        {/* Connecting gold timeline line */}
        <motion.div
          variants={lineGrow}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-40px" }}
          className="
            mb-12 hidden h-px origin-left bg-linear-to-r from-gold/50 via-gold/15 to-gold/50
            md:block
          "
        />

        {/* Principles grid */}
        <motion.div
          variants={stagger}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-40px" }}
          className="grid grid-cols-1 gap-10 md:grid-cols-3 md:gap-8 lg:gap-12"
        >
          {ETHOS_ITEMS.map((item, i) => (
            <motion.div
              key={item.title}
              variants={cardReveal}
              className="group relative"
            >
              {/* Node dot on the timeline */}
              <motion.div
                variants={dotScale}
                className="
                  absolute -top-[3.35rem] left-1/2 hidden size-3 -translate-x-1/2 rotate-45 border
                  border-gold/40 bg-background
                  md:block
                "
                aria-hidden="true"
              />

              <div className="relative text-center md:text-left">
                {/* Icon container */}
                <motion.div
                  variants={childFade}
                  className="
                    mx-auto mb-6 inline-flex border border-gold/20 p-3.5 transition-all duration-300
                    group-hover:border-gold/40 group-hover:bg-gold/5
                    md:mx-0
                  "
                >
                  <item.icon
                    size={22}
                    className="text-gold/70 transition-colors duration-300 group-hover:text-gold"
                  />
                </motion.div>

                {/* Number + Title */}
                <motion.div
                  variants={childFade}
                  className="mb-4 flex items-center justify-center gap-3 md:justify-start"
                >
                  <span className="font-mono text-xs tracking-[0.3em] text-gold/30">
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  <div className="h-px w-4 bg-linear-to-r from-gold/30 to-transparent" />
                </motion.div>

                <motion.h3
                  variants={childFade}
                  className="
                    mb-4 font-display text-sm tracking-[0.2em] text-foreground transition-colors
                    duration-300
                    group-hover:text-gold/90
                  "
                >
                  {item.title}
                </motion.h3>

                <motion.p
                  variants={childFade}
                  className="
                    mx-auto max-w-xs font-body-serif text-sm leading-[1.75] text-foreground/40
                    md:mx-0
                  "
                >
                  {item.description}
                </motion.p>
              </div>
            </motion.div>
          ))}
        </motion.div>
      </div>
    </section>
  );
}
