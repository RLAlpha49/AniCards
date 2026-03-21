"use client";

import { motion } from "framer-motion";

const orchestrate = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.09, delayChildren: 0.1 },
  },
};

const rise = {
  hidden: { opacity: 0, y: 32 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.7, ease: [0.22, 1, 0.36, 1] as const },
  },
};

const revealLine = {
  hidden: { scaleX: 0 },
  visible: {
    scaleX: 1,
    transition: { duration: 0.9, ease: [0.22, 1, 0.36, 1] as const },
  },
};

export function ProjectsHeroSection() {
  return (
    <section className="relative overflow-hidden px-6 pt-28 pb-20 sm:px-12 md:pt-36 md:pb-28">
      {/* Faint diagonal grid lines */}
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.03] dark:opacity-[0.04]"
        aria-hidden="true"
        style={{
          backgroundImage:
            "repeating-linear-gradient(135deg, hsl(var(--gold)) 0px, hsl(var(--gold)) 1px, transparent 1px, transparent 80px)",
        }}
      />

      <motion.div
        variants={orchestrate}
        initial="hidden"
        animate="visible"
        className="relative z-10 mx-auto max-w-6xl"
      >
        {/* Monospaced catalog annotation */}
        <motion.div
          variants={rise}
          className="mb-8 flex items-center gap-4 font-mono text-[0.65rem] tracking-[0.4em] uppercase sm:text-xs"
        >
          <span className="text-gold/60">No. 03</span>
          <span className="bg-gold/30 inline-block h-px w-12" />
          <span className="text-foreground/35">Open Source Workshop</span>
        </motion.div>

        {/* Enormous headline with clipped overlay */}
        <div className="relative">
          <motion.h1
            variants={rise}
            className="font-display text-foreground/4 pointer-events-none absolute -top-6 -left-2 text-[8rem] leading-none select-none sm:text-[11rem] md:text-[15rem] lg:text-[18rem]"
            aria-hidden="true"
          >
            PRJ
          </motion.h1>

          <motion.h1
            variants={rise}
            className="font-display text-foreground relative text-5xl leading-[0.95] font-black sm:text-6xl md:text-7xl lg:text-[5.5rem]"
          >
            THE
            <br />
            <span className="text-gold">PROJECTS</span>
          </motion.h1>
        </div>

        {/* Animated gold rule */}
        <motion.div
          variants={revealLine}
          className="my-8 h-0.5 max-w-64 origin-left sm:my-10"
          style={{
            background:
              "linear-gradient(90deg, hsl(var(--gold)), hsl(var(--gold) / 0.15))",
          }}
        />

        {/* Two-column intro */}
        <div className="grid gap-8 md:grid-cols-[1fr_1fr] md:gap-16">
          <motion.p
            variants={rise}
            className="font-body-serif text-foreground/50 max-w-md text-base leading-[1.8] sm:text-lg"
          >
            Open-source tools I've put together for anyone who wants a better
            anime and media tracking workflow. Everything's free, actively
            maintained, and wide open for contributions.
          </motion.p>

          <motion.div
            variants={rise}
            className="flex items-end justify-start gap-10 md:justify-end"
          >
            <div className="text-center">
              <span className="font-display text-gold text-3xl sm:text-4xl">
                3
              </span>
              <p className="text-foreground/30 mt-1 text-[0.6rem] tracking-[0.3em] uppercase">
                Projects
              </p>
            </div>
            <div className="bg-gold/15 h-12 w-px" />
            <div className="text-center">
              <span className="font-display text-gold text-3xl sm:text-4xl">
                ∞
              </span>
              <p className="text-foreground/30 mt-1 text-[0.6rem] tracking-[0.3em] uppercase">
                Possibilities
              </p>
            </div>
            <div className="bg-gold/15 h-12 w-px" />
            <div className="text-center">
              <span className="font-display text-gold text-3xl sm:text-4xl">
                0
              </span>
              <p className="text-foreground/30 mt-1 text-[0.6rem] tracking-[0.3em] uppercase">
                Cost
              </p>
            </div>
          </motion.div>
        </div>
      </motion.div>
    </section>
  );
}
