"use client";

import { motion } from "framer-motion";

const container = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.1, delayChildren: 0.25 },
  },
};

const fadeUp = {
  hidden: { opacity: 0, y: 32 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.75, ease: [0.22, 1, 0.36, 1] as const },
  },
};

export function ContactHeroSection() {
  return (
    <section className="relative overflow-hidden px-6 pt-28 pb-24 sm:px-12 md:pt-40 md:pb-32">
      {/* Dot grid atmosphere */}
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.06] dark:opacity-[0.035]"
        style={{
          backgroundImage:
            "radial-gradient(hsl(var(--gold)) 0.8px, transparent 0.8px)",
          backgroundSize: "28px 28px",
        }}
      />

      {/* Centered radial glow */}
      <div className="pointer-events-none absolute top-1/3 left-1/2 h-125 w-175 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[hsl(var(--gold)/0.045)] blur-[140px]" />

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
            <span className="block h-1.5 w-1.5 rotate-45 border border-[hsl(var(--gold)/0.4)]" />
            <span
              className="text-[10px] tracking-[0.5em] uppercase"
              style={{
                fontFamily: "var(--font-geist-mono), monospace",
                color: "hsl(var(--gold) / 0.45)",
              }}
            >
              Contact
            </span>
            <span className="block h-1.5 w-1.5 rotate-45 border border-[hsl(var(--gold)/0.4)]" />
          </div>
          <div className="h-px flex-1 bg-linear-to-l from-transparent to-[hsl(var(--gold)/0.2)]" />
        </motion.div>

        {/* Oversized stacked headline */}
        <div className="text-center">
          <motion.h1
            variants={fadeUp}
            className="font-display text-foreground text-[clamp(3.5rem,13vw,11rem)] leading-[0.82] font-black"
          >
            REACH
          </motion.h1>
          <motion.h1
            variants={fadeUp}
            className="font-display text-gold text-[clamp(3.5rem,13vw,11rem)] leading-[0.82] font-black"
          >
            OUT
          </motion.h1>
        </div>

        {/* Gold separator */}
        <motion.div
          variants={fadeUp}
          className="mx-auto mt-10 mb-8 h-0.5 max-w-24 bg-linear-to-r from-transparent via-[hsl(var(--gold)/0.6)] to-transparent"
        />
      </motion.div>
    </section>
  );
}
