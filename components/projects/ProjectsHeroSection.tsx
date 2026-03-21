"use client";

import { motion } from "framer-motion";

import { FEATURED_PROJECT, PROJECTS } from "./constants";

const stagger = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.1, delayChildren: 0.1 },
  },
};

const fadeUp = {
  hidden: { opacity: 0, y: 28 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.7, ease: [0.22, 1, 0.36, 1] as const },
  },
};

export function ProjectsHeroSection() {
  const totalProjects = 1 + PROJECTS.length;

  return (
    <section className="relative overflow-hidden px-6 pt-28 pb-20 sm:px-12 md:pt-36 md:pb-28">
      <motion.div
        variants={stagger}
        initial="hidden"
        animate="visible"
        className="relative z-10 mx-auto max-w-6xl"
      >
        {/* Eyebrow with extending line */}
        <motion.div variants={fadeUp} className="mb-8 flex items-center gap-4">
          <div className="h-px w-12 bg-[hsl(var(--gold)/0.4)]" />
          <span className="font-display text-gold text-xs tracking-[0.5em] uppercase">
            Open Source
          </span>
        </motion.div>

        {/* Asymmetric grid: headline + sidebar */}
        <div className="grid gap-8 md:grid-cols-[1fr_auto] md:items-end md:gap-16">
          <div>
            <motion.h1
              variants={fadeUp}
              className="font-display text-foreground text-5xl leading-[0.92] font-black sm:text-6xl md:text-7xl lg:text-8xl xl:text-9xl"
            >
              OTHER
              <br />
              <span className="text-gold">PROJECTS</span>
            </motion.h1>
          </div>
        </div>

        {/* Mobile description */}
        <motion.p
          variants={fadeUp}
          className="font-body-serif text-foreground/50 mt-6 max-w-md text-sm leading-relaxed md:hidden"
        >
          A curated collection of open-source tools built to enhance your anime
          and media tracking experience.
        </motion.p>

        {/* Bottom tag strip */}
        <motion.div
          variants={fadeUp}
          className="mt-14 flex flex-wrap items-center gap-x-8 gap-y-3"
        >
          {[
            `${totalProjects} Projects`,
            "MIT Licensed",
            "Community Driven",
          ].map((label) => (
            <span
              key={label}
              className="text-foreground/25 text-xs tracking-[0.25em] uppercase"
            >
              ✦ {label}
            </span>
          ))}
        </motion.div>

        {/* Horizontal accent line */}
        <motion.div
          variants={fadeUp}
          className="gold-line-thick mt-14 max-w-48"
        />

        {/* Featured callout for all projects */}
        <motion.div
          variants={fadeUp}
          className="text-foreground/20 mt-6 flex flex-wrap gap-x-6 gap-y-1 text-xs tracking-wider"
        >
          <span className="font-display">{FEATURED_PROJECT.name}</span>
          {PROJECTS.map((p) => (
            <span key={p.url} className="font-display">
              {p.name}
            </span>
          ))}
        </motion.div>
      </motion.div>
    </section>
  );
}
