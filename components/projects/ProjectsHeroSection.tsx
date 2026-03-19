"use client";

import { motion } from "framer-motion";
import { Code2 } from "lucide-react";

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.12, delayChildren: 0.15 },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 24 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.55 } },
};

export function ProjectsHeroSection() {
  return (
    <section className="relative overflow-hidden px-6 pt-24 pb-12 sm:px-12 md:pt-32">
      <motion.div
        variants={containerVariants}
        initial="hidden"
        animate="visible"
        className="relative z-10 mx-auto max-w-5xl"
      >
        <div className="grid items-end gap-10 md:grid-cols-[1fr_auto]">
          <div>
            <motion.p
              variants={itemVariants}
              className="text-gold mb-4 text-xs tracking-[0.5em] uppercase sm:text-sm"
            >
              Open Source Portfolio
            </motion.p>

            <motion.h1
              variants={itemVariants}
              className="font-display text-foreground mb-5 text-5xl leading-[1.05] font-black sm:text-6xl md:text-7xl lg:text-8xl"
            >
              CRAFTED WITH
              <br />
              <span className="text-gold">PURPOSE</span>
            </motion.h1>

            <motion.div
              variants={itemVariants}
              className="gold-line-thick mb-6 max-w-32"
            />

            <motion.p
              variants={itemVariants}
              className="font-body-serif text-foreground/55 max-w-md text-base leading-relaxed sm:text-lg"
            >
              A collection of open-source tools built to enhance your anime and
              media tracking experience. Each project is free, maintained, and
              open to contributions.
            </motion.p>
          </div>

          <motion.div
            variants={itemVariants}
            className="hidden md:block"
            aria-hidden="true"
          >
            <div className="border-gold/15 relative border-2 p-6">
              <div className="border-gold/10 border-2 p-5">
                <Code2 className="text-gold/30 h-20 w-20" strokeWidth={1} />
              </div>
              <div className="border-gold absolute -top-1.5 -left-1.5 h-3 w-3 border-t-2 border-l-2" />
              <div className="border-gold absolute -right-1.5 -bottom-1.5 h-3 w-3 border-r-2 border-b-2" />
            </div>
          </motion.div>
        </div>

        <motion.div
          variants={itemVariants}
          className="text-foreground/40 mt-12 flex flex-wrap items-center gap-6 text-xs tracking-wider uppercase"
        >
          <span>✦ Open Source</span>
          <span>✦ Community Driven</span>
          <span>✦ Free Forever</span>
        </motion.div>
      </motion.div>
    </section>
  );
}
