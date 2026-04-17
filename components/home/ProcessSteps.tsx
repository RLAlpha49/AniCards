"use client";

import { motion, useInView, useReducedMotion } from "framer-motion";
import { Palette, Search, Sparkles } from "lucide-react";
import { useRef } from "react";

import {
  buildFadeUpVariants,
  EASE_OUT_EXPO,
  getMotionSafeAnimation,
  NO_MOTION_TRANSITION,
} from "@/lib/animations";

function getSteps(totalCardTypes: number) {
  const formattedCardTypeCount = totalCardTypes.toLocaleString();

  return [
    {
      num: "Ⅰ",
      icon: Search,
      title: "LOOK UP",
      desc: "Drop in any AniList username — we grab your public profile data on the spot.",
    },
    {
      num: "Ⅱ",
      icon: Sparkles,
      title: "BUILD",
      desc: `Those numbers get shaped into ${formattedCardTypeCount} distinct card types, each one polished and ready to go.`,
    },
    {
      num: "Ⅲ",
      icon: Palette,
      title: "MAKE IT YOURS",
      desc: "Dial in colors, layouts, and themes until it feels right. Then grab your pixel-perfect SVGs.",
    },
  ] as const;
}

export function ProcessSteps({
  totalCardTypes,
}: Readonly<{
  totalCardTypes: number;
}>) {
  const ref = useRef<HTMLElement>(null);
  const isInView = useInView(ref, { once: true, margin: "-20px" });
  const prefersReducedMotion = useReducedMotion() ?? false;
  const steps = getSteps(totalCardTypes);
  const headingVariants = buildFadeUpVariants({
    reducedMotion: prefersReducedMotion,
    distance: 20,
    duration: 0.5,
  });
  const lineVariants = buildFadeUpVariants({
    reducedMotion: prefersReducedMotion,
    distance: 0,
    duration: 0.5,
  });
  const stepVariants = {
    hidden: prefersReducedMotion ? { opacity: 1, y: 0 } : { opacity: 0, y: 30 },
    visible: (i: number) => ({
      opacity: 1,
      y: 0,
      transition: prefersReducedMotion
        ? NO_MOTION_TRANSITION
        : {
            duration: 0.6,
            delay: 0.2 + i * 0.15,
            ease: EASE_OUT_EXPO,
          },
    }),
  };
  const stepIconVariants = {
    hidden: prefersReducedMotion
      ? { scale: 1, opacity: 1 }
      : { scale: 0, opacity: 0 },
    visible: (i: number) => ({
      scale: 1,
      opacity: 1,
      transition: prefersReducedMotion
        ? NO_MOTION_TRANSITION
        : {
            duration: 0.5,
            delay: 0.4 + i * 0.18,
            type: "spring" as const,
            stiffness: 200,
            damping: 15,
          },
    }),
  };

  return (
    <section ref={ref} className="relative px-6 py-20 sm:px-12 md:py-28">
      <div className="mx-auto max-w-5xl">
        <div className="mb-16 text-center">
          <motion.h2
            variants={headingVariants}
            initial={false}
            animate={isInView ? "visible" : undefined}
            className="mb-4 font-display text-3xl text-foreground sm:text-4xl"
          >
            THE <span className="text-gold">PROCESS</span>
          </motion.h2>
          <motion.div
            variants={lineVariants}
            initial={false}
            animate={isInView ? "visible" : undefined}
            className="gold-line-thick mx-auto max-w-16"
          />
        </div>

        <div className="relative">
          <div
            className="
              pointer-events-none gold-line absolute top-14 right-[0%] left-[15%] hidden w-[70%]
              md:block
            "
            aria-hidden="true"
          />

          <div className="relative z-10 grid gap-12 md:grid-cols-3 md:gap-0">
            {steps.map((step, i) => (
              <motion.div
                key={step.title}
                custom={i}
                variants={stepVariants}
                initial={false}
                animate={isInView ? "visible" : undefined}
                whileHover={getMotionSafeAnimation(prefersReducedMotion, {
                  y: -6,
                  transition: { duration: 0.3, ease: EASE_OUT_EXPO },
                })}
                className="relative text-center"
              >
                <motion.div
                  custom={i}
                  variants={stepIconVariants}
                  initial={false}
                  animate={isInView ? "visible" : undefined}
                  className="
                    relative z-10 mx-auto mb-6 flex size-28 flex-col items-center justify-center
                    rounded-full border-2 border-[hsl(var(--gold)/0.35)] bg-card
                  "
                >
                  <span className="mb-1 font-display text-2xl text-gold">
                    {step.num}
                  </span>
                  <step.icon className="size-5 text-gold/50" />
                </motion.div>

                <h3 className="mb-3 font-display text-sm tracking-[0.3em] text-foreground">
                  {step.title}
                </h3>

                <p className="mx-auto max-w-xs font-body-serif text-sm/relaxed text-foreground/45">
                  {step.desc}
                </p>
              </motion.div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
