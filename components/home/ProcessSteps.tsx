"use client";

import { motion, useInView } from "framer-motion";
import { Palette, Search, Sparkles } from "lucide-react";
import { useRef } from "react";

const STEPS = [
  {
    num: "Ⅰ",
    icon: Search,
    title: "DISCOVER",
    desc: "Enter any AniList username. We fetch your public profile data instantly.",
  },
  {
    num: "Ⅱ",
    icon: Sparkles,
    title: "GENERATE",
    desc: "Your stats are transformed into over 20 beautifully designed card types.",
  },
  {
    num: "Ⅲ",
    icon: Palette,
    title: "CUSTOMIZE",
    desc: "Fine-tune colors, layouts, and themes. Then export as pixel-perfect SVGs.",
  },
] as const;

export function ProcessSteps() {
  const ref = useRef<HTMLElement>(null);
  const isInView = useInView(ref, { once: true, margin: "-20px" });

  return (
    <section ref={ref} className="relative px-6 py-20 sm:px-12 md:py-28">
      <div className="mx-auto max-w-5xl">
        <div className="mb-16 text-center">
          <motion.h2
            initial={{ opacity: 0, y: 20 }}
            animate={isInView ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.5 }}
            className="font-display text-foreground mb-4 text-3xl sm:text-4xl"
          >
            THE <span className="text-gold">JOURNEY</span>
          </motion.h2>
          <motion.div
            initial={{ opacity: 0 }}
            animate={isInView ? { opacity: 1 } : {}}
            transition={{ duration: 0.5, delay: 0.15 }}
            className="gold-line-thick mx-auto max-w-16"
          />
        </div>

        <div className="relative grid gap-12 md:grid-cols-3 md:gap-0">
          <div
            className="gold-line absolute top-14 right-[17%] left-[17%] hidden md:block"
            aria-hidden="true"
          />

          {STEPS.map((step, i) => (
            <motion.div
              key={step.title}
              initial={{ opacity: 0, y: 30 }}
              animate={isInView ? { opacity: 1, y: 0 } : {}}
              transition={{
                duration: 0.6,
                delay: 0.2 + i * 0.15,
                ease: [0.22, 1, 0.36, 1],
              }}
              whileHover={{ y: -6, transition: { duration: 0.3 } }}
              className="relative text-center"
            >
              <motion.div
                initial={{ scale: 0, opacity: 0 }}
                animate={isInView ? { scale: 1, opacity: 1 } : {}}
                transition={{
                  duration: 0.5,
                  delay: 0.4 + i * 0.18,
                  type: "spring",
                  stiffness: 200,
                  damping: 15,
                }}
                className="bg-card relative z-10 mx-auto mb-6 flex h-28 w-28 flex-col items-center justify-center rounded-full border-2 border-[hsl(var(--gold)/0.35)]"
              >
                <span className="font-display text-gold mb-1 text-2xl">
                  {step.num}
                </span>
                <step.icon className="text-gold/50 h-5 w-5" />
              </motion.div>

              <h3 className="font-display text-foreground mb-3 text-sm tracking-[0.3em]">
                {step.title}
              </h3>

              <p className="font-body-serif text-foreground/45 mx-auto max-w-xs text-sm leading-relaxed">
                {step.desc}
              </p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
