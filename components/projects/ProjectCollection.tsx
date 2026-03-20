"use client";

import { motion } from "framer-motion";

import { PROJECTS } from "./constants";
import { ProjectCard } from "./ProjectCard";

const stagger = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.15, delayChildren: 0.1 },
  },
};

export function ProjectCollection() {
  return (
    <section className="relative px-6 py-20 sm:px-12 md:py-28">
      <div className="mx-auto max-w-6xl">
        {/* Section label — left-aligned with extending line */}
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          whileInView={{ opacity: 1, x: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          className="mb-14 flex items-center gap-4"
        >
          <span className="font-display text-gold/60 text-xs tracking-[0.4em] uppercase">
            The Collection
          </span>
          <div className="h-px flex-1 bg-[hsl(var(--gold)/0.1)]" />
        </motion.div>

        {/* Responsive grid of project cards */}
        <motion.div
          variants={stagger}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-40px" }}
          className="grid gap-8 md:grid-cols-2"
        >
          {PROJECTS.map((project) => (
            <ProjectCard key={project.url} project={project} />
          ))}
        </motion.div>
      </div>
    </section>
  );
}
