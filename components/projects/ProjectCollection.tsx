"use client";

import { motion } from "framer-motion";

import { PROJECTS } from "./constants";
import { ProjectCard } from "./ProjectCard";

const stagger = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.18, delayChildren: 0.05 },
  },
};

export function ProjectCollection() {
  return (
    <section className="relative px-6 py-20 sm:px-12 md:py-28">
      <div className="mx-auto max-w-7xl">
        {/* Section label */}
        <motion.div
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true, margin: "-40px" }}
          transition={{ duration: 0.5 }}
          className="mb-14 flex items-center gap-4 font-mono text-[0.6rem] tracking-[0.4em] uppercase sm:text-xs"
        >
          <span className="text-gold/60">02</span>
          <span
            className="inline-block h-px max-w-16 flex-1"
            style={{
              background:
                "linear-gradient(90deg, hsl(var(--gold) / 0.3), transparent)",
            }}
          />
          <span className="text-foreground/30">Collection</span>
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
