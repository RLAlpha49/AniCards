"use client";

import { motion } from "framer-motion";
import Link from "next/link";

import { useMotionPreferences } from "@/hooks/useMotionPreferences";
import {
  buildFadeUpVariants,
  buildMotionSafeStaggerContainer,
  getMotionSafeAnimation,
  NO_MOTION_TRANSITION,
  VIEWPORT_ONCE,
} from "@/lib/animations";
import { safeTrack, trackButtonClick } from "@/lib/utils/google-analytics";

export function HomeCTA() {
  const { prefersSimplifiedMotion } = useMotionPreferences();
  const ctaContainer = buildMotionSafeStaggerContainer({
    reducedMotion: prefersSimplifiedMotion,
    staggerChildren: 0.1,
    delayChildren: 0.08,
  });
  const ctaChild = buildFadeUpVariants({
    reducedMotion: prefersSimplifiedMotion,
    distance: 24,
    duration: 0.7,
  });

  const handleClick = () => {
    safeTrack(() => trackButtonClick("cta_create_cards", "homepage_cta"));
  };

  return (
    <section className="relative border-y-2 border-gold/20 px-6 py-20 text-center sm:px-12 md:py-28">
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="
          absolute top-1/2 left-1/2 size-96 -translate-1/2 rounded-full bg-[hsl(var(--gold)/0.04)]
          blur-[100px]
        " />
      </div>

      <motion.div
        className="relative z-10"
        variants={ctaContainer}
        initial="hidden"
        whileInView="visible"
        viewport={VIEWPORT_ONCE}
      >
        <motion.div variants={ctaChild} className="mb-8 gold-ornament">
          <span className="text-xl text-gold">❖</span>
        </motion.div>

        <motion.h2
          variants={ctaChild}
          className="mb-5 font-display text-3xl text-gold sm:text-4xl lg:text-5xl"
        >
          READY TO BUILD YOURS?
        </motion.h2>

        <motion.p
          variants={ctaChild}
          className="mx-auto mb-10 max-w-md font-body-serif text-base text-foreground/40 sm:text-lg"
        >
          Numbers that look good enough to frame. Your stats deserve better than
          a spreadsheet.
        </motion.p>

        <motion.div
          variants={ctaChild}
          className="inline-block"
          whileHover={getMotionSafeAnimation(prefersSimplifiedMotion, {
            scale: 1.04,
            boxShadow: "0 0 40px hsl(42 63% 55% / 0.4)",
          })}
          whileTap={getMotionSafeAnimation(prefersSimplifiedMotion, {
            scale: 0.97,
          })}
          transition={
            prefersSimplifiedMotion
              ? NO_MOTION_TRANSITION
              : { type: "spring", stiffness: 400, damping: 20 }
          }
        >
          <Link
            href="/search"
            onClick={handleClick}
            className="imperial-btn imperial-btn-fill"
          >
            ❖ Build Your Cards ❖
          </Link>
        </motion.div>
      </motion.div>
    </section>
  );
}
