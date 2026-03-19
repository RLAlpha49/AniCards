"use client";

import { motion } from "framer-motion";

import { PROJECTS } from "./constants";
import { ProjectCard } from "./ProjectCard";

const staggerContainer = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.2, delayChildren: 0.1 },
  },
};

export function ProjectCollection() {
  return (
    <section className="relative px-6 py-16 sm:px-12 md:py-24">
      <div className="mx-auto max-w-5xl">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-20px" }}
          transition={{ duration: 0.6 }}
          className="mb-16 text-center"
        >
          <h2 className="font-display text-foreground mb-3 text-sm tracking-[0.3em] uppercase">
            The Collection
          </h2>
          <div className="gold-line mx-auto max-w-12" />
        </motion.div>

        <div className="relative">
          <div className="absolute top-0 bottom-0 left-1/2 hidden w-px -translate-x-1/2 bg-linear-to-b from-transparent via-[hsl(var(--gold)/0.2)] to-transparent md:block" />

          <motion.div
            variants={staggerContainer}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-20px" }}
            className="space-y-12 md:space-y-20"
          >
            {PROJECTS.map((project, index) => (
              <ProjectCard
                key={project.url}
                project={project}
                isLeft={index % 2 === 0}
              />
            ))}
          </motion.div>
        </div>
      </div>
    </section>
  );
}
