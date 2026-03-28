"use client";

import { motion, useReducedMotion } from "framer-motion";

import {
  buildMotionSafeStaggerContainer,
  EASE_OUT_EXPO,
  NO_MOTION_TRANSITION,
} from "@/lib/animations";

import { PROJECTS } from "./constants";
import { ProjectCard } from "./ProjectCard";

export function ProjectCollection() {
  const prefersReducedMotion = useReducedMotion() ?? false;
  const stagger = buildMotionSafeStaggerContainer({
    reducedMotion: prefersReducedMotion,
    staggerChildren: 0.18,
    delayChildren: 0.05,
  });
  const headerStagger = buildMotionSafeStaggerContainer({
    reducedMotion: prefersReducedMotion,
    staggerChildren: 0.1,
    delayChildren: 0.05,
  });
  const headerChild = {
    hidden: prefersReducedMotion
      ? { opacity: 1, x: 0 }
      : { opacity: 0, x: -12 },
    visible: {
      opacity: 1,
      x: 0,
      transition: prefersReducedMotion
        ? NO_MOTION_TRANSITION
        : { duration: 0.5, ease: EASE_OUT_EXPO },
    },
  };

  return (
    <section className="relative px-6 py-20 sm:px-12 md:py-28">
      <div className="mx-auto max-w-7xl">
        {/* Section label */}
        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-40px" }}
          variants={headerStagger}
          className="
            mb-14 flex items-center gap-4 font-mono text-[0.6rem] tracking-[0.4em] uppercase
            sm:text-xs
          "
        >
          <motion.span variants={headerChild} className="text-gold/60">
            02
          </motion.span>
          <motion.span
            variants={headerChild}
            className="inline-block h-px max-w-16 flex-1"
            style={{
              background:
                "linear-gradient(90deg, hsl(var(--gold) / 0.3), transparent)",
            }}
          />
          <motion.span variants={headerChild} className="text-foreground/30">
            Collection
          </motion.span>
        </motion.div>

        {/* Asymmetric card grid */}
        <motion.div
          variants={stagger}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-40px" }}
          className="grid gap-6 md:grid-cols-2 md:gap-8"
        >
          {PROJECTS.map((project, index) => (
            <ProjectCard key={project.url} project={project} index={index} />
          ))}
        </motion.div>
      </div>
    </section>
  );
}
