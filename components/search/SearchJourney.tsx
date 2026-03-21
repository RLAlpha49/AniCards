"use client";

import { motion } from "framer-motion";
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
  return (
    <section className="px-6 py-20 sm:px-12 md:py-28">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: "-80px" }}
        transition={{ duration: 0.6 }}
        className="mb-16 text-center"
      >
        <p className="text-gold mb-4 text-xs tracking-[0.5em] uppercase sm:text-sm">
          The Process
        </p>
        <h2 className="font-display text-foreground mb-4 text-3xl tracking-[0.15em] sm:text-4xl">
          YOUR PATH
        </h2>
        <div className="gold-line-thick mx-auto max-w-20" />
      </motion.div>

      <div className="mx-auto max-w-5xl">
        <div className="relative grid grid-cols-1 gap-14 md:grid-cols-3 md:gap-0">
          {/* Horizontal connecting line (desktop) */}
          <div className="absolute top-16 right-[16.67%] left-[16.67%] hidden h-px md:block">
            <motion.div
              className="from-gold/40 via-gold/15 to-gold/40 h-full w-full origin-left bg-linear-to-r"
              initial={{ scaleX: 0 }}
              whileInView={{ scaleX: 1 }}
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
              initial={{ opacity: 0, y: 40 }}
              whileInView={{ opacity: 1, y: 0 }}
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
                initial={{ opacity: 0, scale: 0.7 }}
                whileInView={{ opacity: 1, scale: 1 }}
                viewport={{ once: true }}
                transition={{
                  duration: 1.2,
                  delay: i * 0.15 + 0.2,
                  ease: EASE_OUT_EXPO,
                }}
                className="font-display text-gold/6 pointer-events-none absolute -top-6 text-8xl font-black select-none md:text-9xl"
              >
                {step.num}
              </motion.div>

              {/* Step box with corner tick accents */}
              <motion.div
                whileHover={{
                  scale: 1.06,
                  borderColor: "hsl(42 63% 55% / 0.5)",
                }}
                transition={{ duration: 0.25 }}
                className="border-gold/20 bg-background relative z-10 mb-6 flex h-32 w-32 items-center justify-center border-2"
              >
                <div className="bg-gold/3 absolute inset-0" />
                <motion.div
                  initial={{ opacity: 0, scale: 0 }}
                  whileInView={{ opacity: 1, scale: 1 }}
                  viewport={{ once: true }}
                  transition={{ ...SPRING_GENTLE, delay: i * 0.15 + 0.35 }}
                  className="relative z-10"
                >
                  <step.icon className="text-gold/70 h-8 w-8" />
                </motion.div>

                {/* Corner ticks */}
                <div className="border-gold/50 absolute -top-1 -left-1 h-3 w-3 border-t-2 border-l-2" />
                <div className="border-gold/50 absolute -top-1 -right-1 h-3 w-3 border-t-2 border-r-2" />
                <div className="border-gold/50 absolute -bottom-1 -left-1 h-3 w-3 border-b-2 border-l-2" />
                <div className="border-gold/50 absolute -right-1 -bottom-1 h-3 w-3 border-r-2 border-b-2" />
              </motion.div>

              <h3 className="font-display text-foreground mb-3 text-sm tracking-[0.3em]">
                {step.title}
              </h3>
              <div className="gold-line mx-auto mb-4 max-w-12" />
              <p className="font-body-serif text-foreground/45 max-w-xs text-sm leading-relaxed">
                {step.desc}
              </p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
