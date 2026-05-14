"use client";

import { motion, useReducedMotion } from "framer-motion";
import { Send } from "lucide-react";
import Link from "next/link";

import {
  buildFadeUpVariants,
  buildMotionSafeStaggerContainer,
  EASE_OUT_EXPO,
  getMotionSafeAnimation,
} from "@/lib/animations";
import {
  safeTrack,
  trackExternalLinkClick,
} from "@/lib/utils/google-analytics";

export function ContactCTA() {
  const prefersReducedMotion = useReducedMotion() ?? false;
  const ctaContainer = buildMotionSafeStaggerContainer({
    reducedMotion: prefersReducedMotion,
    staggerChildren: 0.1,
    delayChildren: 0.08,
  });
  const ctaChild = buildFadeUpVariants({
    reducedMotion: prefersReducedMotion,
    distance: 20,
    duration: 0.6,
  });

  return (
    <section
      id="drop-a-line"
      className="relative scroll-mt-28 px-6 py-20 sm:px-12 md:py-32"
    >
      {/* Background glow */}
      <div className="pointer-events-none absolute inset-0">
        <div className="
          absolute bottom-0 left-1/2 h-100 w-150 -translate-x-1/2 rounded-full
          bg-[hsl(var(--gold)/0.04)] blur-[120px]
        " />
      </div>

      <motion.div
        variants={ctaContainer}
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true }}
        className="relative z-10 mx-auto max-w-2xl text-center"
      >
        {/* Top ornament */}
        <motion.div
          variants={ctaChild}
          className="mb-10 flex items-center gap-4"
        >
          <div className="h-px flex-1 bg-linear-to-r from-transparent to-[hsl(var(--gold)/0.15)]" />
          <Send className="size-4 text-gold/30" strokeWidth={1.5} />
          <div className="h-px flex-1 bg-linear-to-l from-transparent to-[hsl(var(--gold)/0.15)]" />
        </motion.div>

        <motion.h2
          variants={ctaChild}
          className="mb-3 font-display text-3xl font-bold text-foreground sm:text-4xl"
        >
          DROP A LINE
        </motion.h2>
        <motion.p
          variants={ctaChild}
          className="mb-10 font-body-serif text-base/relaxed text-foreground/35"
        >
          Some things deserve more than a quick message. If you need a manual
          data deletion, a technical clarification, help reproducing a bug,
          email is still the most reliable lane.
        </motion.p>

        <motion.div
          variants={ctaChild}
          whileHover={getMotionSafeAnimation(prefersReducedMotion, {
            scale: 1.04,
            transition: { duration: 0.3, ease: EASE_OUT_EXPO },
          })}
          whileTap={getMotionSafeAnimation(prefersReducedMotion, {
            scale: 0.97,
          })}
          className="inline-block"
        >
          <Link
            href="mailto:contact@alpha49.com"
            onClick={() =>
              safeTrack(() => trackExternalLinkClick("email", "contact_page"))
            }
            className="group imperial-btn inline-flex imperial-btn-fill items-center"
          >
            <Send className="mr-2.5 size-4" />
            contact@alpha49.com
          </Link>
        </motion.div>

        <motion.p
          variants={ctaChild}
          className="mt-8 font-ui-mono text-[10px] tracking-[0.3em] text-foreground/20 uppercase"
        >
          I usually reply within a day or two
        </motion.p>
      </motion.div>
    </section>
  );
}
