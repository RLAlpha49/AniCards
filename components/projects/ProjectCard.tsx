"use client";

import { motion } from "framer-motion";
import { ArrowUpRight } from "lucide-react";

import { SimpleGithubIcon } from "@/components/SimpleIcons";

import type { Project } from "./types";

const stripVariants = {
  hidden: { opacity: 0, x: -20 },
  visible: {
    opacity: 1,
    x: 0,
    transition: { duration: 0.6, ease: [0.22, 1, 0.36, 1] as const },
  },
};

export function ProjectCard({
  project,
  index,
}: Readonly<{
  project: Project;
  index: number;
}>) {
  const num = String(index + 2).padStart(2, "0");

  return (
    <motion.article variants={stripVariants} className="group relative">
      {/* Horizontal strip layout */}
      <a
        href={project.url}
        target="_blank"
        rel="noopener noreferrer"
        className="border-gold/10 hover:border-gold/30 hover:bg-gold/2 grid items-center gap-6 border-b-2 px-2 py-8 transition-all duration-500 sm:px-4 md:grid-cols-[4rem_1fr_auto] md:gap-10 md:py-10"
      >
        {/* Large number */}
        <span className="font-display text-gold/15 group-hover:text-gold/30 hidden text-5xl leading-none transition-colors duration-500 md:block">
          {num}
        </span>

        {/* Project info */}
        <div className="min-w-0">
          <div className="mb-2 flex items-center gap-3">
            <span className="font-display text-gold/30 text-2xl md:hidden">
              {num}
            </span>
            <h3 className="font-display text-foreground group-hover:text-gold text-base tracking-[0.12em] uppercase transition-colors duration-300 sm:text-lg">
              {project.name}
            </h3>
          </div>

          <p className="font-body-serif text-foreground/40 mb-4 line-clamp-2 max-w-xl text-sm leading-[1.7]">
            {project.highlight}
          </p>

          <div className="flex flex-wrap gap-2">
            {project.tags.map((tag) => (
              <span
                key={tag}
                className="text-foreground/35 group-hover:text-foreground/50 font-mono text-[0.6rem] tracking-widest uppercase transition-colors"
              >
                {tag}
                {tag !== project.tags.at(-1) && (
                  <span className="text-gold/25 ml-2">·</span>
                )}
              </span>
            ))}
          </div>
        </div>

        {/* Arrow link indicator */}
        <div className="flex items-center gap-3">
          <SimpleGithubIcon
            size={18}
            className="text-foreground/20 group-hover:text-gold/60 transition-colors"
          />
          <div className="border-gold/20 group-hover:border-gold/50 group-hover:bg-gold/5 flex h-10 w-10 items-center justify-center border transition-all duration-300">
            <ArrowUpRight className="text-foreground/30 group-hover:text-gold h-5 w-5 transition-all duration-300 group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
          </div>
        </div>
      </a>
    </motion.article>
  );
}
