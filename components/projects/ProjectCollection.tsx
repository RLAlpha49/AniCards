"use client";

import { motion } from "framer-motion";

import { PROJECTS } from "./constants";
import { ProjectCard } from "./ProjectCard";

const stagger = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.15, delayChildren: 0.05 },
  },
};

export function ProjectCollection() {
  return (
    <section className="relative px-6 py-20 sm:px-12 md:py-28">
      <div className="mx-auto max-w-6xl">
        {/* Section label */}
        <motion.div
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true, margin: "-40px" }}
          transition={{ duration: 0.5 }}
          className="mb-12 flex items-center gap-4 font-mono text-[0.6rem] tracking-[0.4em] uppercase sm:text-xs"
        >
          <span className="text-gold/50">§ 02</span>
          <span className="bg-gold/20 inline-block h-px max-w-20 flex-1" />
          <span className="text-foreground/30">More from the Collection</span>
        </motion.div>

        {/* Top border */}
        <div
          className="mb-0 h-0.5"
          style={{
            background:
              "linear-gradient(90deg, hsl(var(--gold) / 0.4), hsl(var(--gold) / 0.08) 70%, transparent)",
          }}
        />

        {/* Project strips */}
        <motion.div
          variants={stagger}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-40px" }}
        >
          {PROJECTS.map((project, index) => (
            <ProjectCard key={project.url} project={project} index={index} />
          ))}
        </motion.div>
      </div>
    </section>
  );
}
