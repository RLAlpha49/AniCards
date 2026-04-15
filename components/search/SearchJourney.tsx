"use client";

import { motion, useReducedMotion } from "framer-motion";
import { Palette, Search, Sparkles } from "lucide-react";

import { EASE_OUT_EXPO, SPRING_GENTLE } from "@/lib/animations";

const STEPS = [
  {
    num: "01",
    title: "LOOK UP",
    desc: "Drop in an AniList username or user ID. We'll track down the profile before you can blink.",
    icon: Search,
  },
  {
    num: "02",
    title: "BUILD",
    desc: "Your watching habits, favorites, and stats get shaped into polished visual cards \u2014 no effort required on your end.",
    icon: Sparkles,
  },
  {
    num: "03",
    title: "REFINE",
    desc: "Tinker with colors, swap layouts, adjust styles. Keep going until every card feels distinctly yours.",
    icon: Palette,
  },
];

export function SearchJourney() {
  const prefersReducedMotion = useReducedMotion() ?? false;

  return (
    <section className="px-6 py-20 sm:px-12 md:py-28">
      <motion.div
        initial={prefersReducedMotion ? false : { opacity: 0, y: 20 }}
        whileInView={prefersReducedMotion ? undefined : { opacity: 1, y: 0 }}
        viewport={{ once: true, margin: "-80px" }}
        transition={{ duration: 0.6 }}
        className="mb-16 text-center"
      >
        <p className="mb-4 text-xs tracking-[0.5em] text-gold uppercase sm:text-sm">
          The Process
        </p>
        <h2 className="mb-4 font-display text-3xl tracking-[0.15em] text-foreground sm:text-4xl">
          YOUR PATH
        </h2>
        <div className="gold-line-thick mx-auto max-w-20" />
        <p className="
          mx-auto mt-5 max-w-2xl font-body-serif text-sm/relaxed text-foreground/45
          sm:text-base/relaxed
        ">
          AniCards keeps the lookup flow intentionally lightweight: start with a
          public username or user ID, let the app assemble a stable profile
          snapshot, then move straight into layouts and color choices without
          creating an account or exposing anything private.
        </p>
      </motion.div>

      <div className="mx-auto max-w-5xl">
        <div className="relative grid grid-cols-1 gap-14 md:grid-cols-3 md:gap-0">
          {/* Horizontal connecting line (desktop) */}
          <div className="absolute top-16 right-[16.67%] left-[16.67%] hidden h-px md:block">
            <motion.div
              className="size-full origin-left bg-linear-to-r from-gold/40 via-gold/15 to-gold/40"
              initial={prefersReducedMotion ? false : { scaleX: 0 }}
              whileInView={prefersReducedMotion ? undefined : { scaleX: 1 }}
              viewport={{ once: true }}
              transition={{
                duration: 1.2,
                delay: 0.3,
                ease: [0.22, 1, 0.36, 1],
              }}
            />
          </div>

          {STEPS.map((step, i) => (
            <motion.div
              key={step.title}
              initial={prefersReducedMotion ? false : { opacity: 0, y: 40 }}
              whileInView={
                prefersReducedMotion ? undefined : { opacity: 1, y: 0 }
              }
              viewport={{ once: true, margin: "-50px" }}
              transition={{
                duration: 0.6,
                delay: i * 0.15,
                ease: [0.22, 1, 0.36, 1],
              }}
              className="relative flex flex-col items-center text-center"
            >
              {/* Large ghost number */}
              <motion.div
                initial={
                  prefersReducedMotion ? false : { opacity: 0, scale: 0.7 }
                }
                whileInView={
                  prefersReducedMotion ? undefined : { opacity: 1, scale: 1 }
                }
                viewport={{ once: true }}
                transition={{
                  duration: 1.2,
                  delay: i * 0.15 + 0.2,
                  ease: EASE_OUT_EXPO,
                }}
                className="
                  pointer-events-none absolute -top-6 font-display text-8xl font-black text-gold/6
                  select-none
                  md:text-9xl
                "
              >
                {step.num}
              </motion.div>

              {/* Step box with corner tick accents */}
              <motion.div
                whileHover={
                  prefersReducedMotion
                    ? undefined
                    : {
                        scale: 1.06,
                        borderColor: "hsl(42 63% 55% / 0.5)",
                      }
                }
                transition={{ duration: 0.25 }}
                className="
                  relative z-10 mb-6 flex size-32 items-center justify-center border-2
                  border-gold/20 bg-background
                "
              >
                <div className="absolute inset-0 bg-gold/3" />
                <motion.div
                  initial={
                    prefersReducedMotion ? false : { opacity: 0, scale: 0 }
                  }
                  whileInView={
                    prefersReducedMotion ? undefined : { opacity: 1, scale: 1 }
                  }
                  viewport={{ once: true }}
                  transition={{ ...SPRING_GENTLE, delay: i * 0.15 + 0.35 }}
                  className="relative z-10"
                >
                  <step.icon className="size-8 text-gold/70" />
                </motion.div>

                {/* Corner ticks */}
                <div className="absolute -top-1 -left-1 size-3 border-t-2 border-l-2 border-gold/50" />
                <div className="
                  absolute -top-1 -right-1 size-3 border-t-2 border-r-2 border-gold/50
                " />
                <div className="
                  absolute -bottom-1 -left-1 size-3 border-b-2 border-l-2 border-gold/50
                " />
                <div className="
                  absolute -right-1 -bottom-1 size-3 border-r-2 border-b-2 border-gold/50
                " />
              </motion.div>

              <h3 className="mb-3 font-display text-sm tracking-[0.3em] text-foreground">
                {step.title}
              </h3>
              <div className="gold-line mx-auto mb-4 max-w-12" />
              <p className="max-w-xs font-body-serif text-sm/relaxed text-foreground/45">
                {step.desc}
              </p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
