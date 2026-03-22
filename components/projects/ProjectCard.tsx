"use client";

import { motion } from "framer-motion";
import { ArrowUpRight } from "lucide-react";

import { SimpleGithubIcon } from "@/components/SimpleIcons";
import { EASE_OUT_EXPO } from "@/lib/animations";

import type { Project } from "./types";

const cardVariants = {
  hidden: { opacity: 0, y: 24 },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.65,
      ease: [0.22, 1, 0.36, 1] as const,
      staggerChildren: 0.08,
      delayChildren: 0.15,
    },
  },
};

const childFade = {
  hidden: { opacity: 0, y: 12 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.5, ease: EASE_OUT_EXPO },
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
    <motion.article variants={cardVariants} className="group relative h-full">
      <a
        href={project.url}
        target="_blank"
        rel="noopener noreferrer"
        className="
          relative flex h-full flex-col overflow-hidden border-2 border-gold/10 bg-card/40
          backdrop-blur-sm transition-all duration-500
          hover:-translate-y-1 hover:border-gold/30 hover:shadow-[0_8px_40px_hsl(var(--gold)/0.08)]
        "
      >
        {/* Gold top accent */}
        <div
          className="h-0.5 transition-all duration-500 group-hover:h-1"
          style={{
            background:
              "linear-gradient(90deg, hsl(var(--gold)), hsl(var(--gold) / 0.3) 70%, transparent)",
          }}
        />

        <div className="relative flex flex-1 flex-col p-7 sm:p-8">
          {/* Watermark number */}
          <span
            className="
              pointer-events-none absolute -top-4 -right-2 font-display text-[8rem] leading-none
              text-gold/5 transition-all duration-500 select-none
              group-hover:text-gold/8
            "
            aria-hidden="true"
          >
            {num}
          </span>

          {/* Header */}
          <motion.div
            variants={childFade}
            className="relative z-10 mb-5 flex items-start justify-between gap-4"
          >
            <div className="flex items-center gap-3">
              <span className="
                font-mono text-xs tracking-[0.3em] text-gold/40
                group-hover:text-gold/70
              ">
                {num}
              </span>
              <div
                className="h-px w-6"
                style={{
                  background:
                    "linear-gradient(90deg, hsl(var(--gold) / 0.3), transparent)",
                }}
              />
            </div>
            <motion.div
              whileHover={{ scale: 1.12 }}
              transition={{ duration: 0.25, ease: EASE_OUT_EXPO }}
              className="
                flex size-9 items-center justify-center border border-gold/15 transition-all
                duration-300
                group-hover:border-gold/40 group-hover:bg-gold/5
              "
            >
              <ArrowUpRight className="
                size-4 text-foreground/25 transition-all duration-300
                group-hover:translate-x-0.5 group-hover:-translate-y-0.5 group-hover:text-gold
              " />
            </motion.div>
          </motion.div>

          {/* Project name */}
          <motion.h3
            variants={childFade}
            className="
              relative z-10 mb-3 font-display text-lg tracking-[0.12em] text-foreground uppercase
              transition-colors duration-300
              group-hover:text-gold
              sm:text-xl
            "
          >
            {project.name}
          </motion.h3>

          {/* Description */}
          <motion.p
            variants={childFade}
            className="
              relative z-10 mb-6 flex-1 font-body-serif text-sm leading-[1.75] text-foreground/40
            "
          >
            {project.highlight}
          </motion.p>

          {/* Tags + GitHub */}
          <motion.div
            variants={childFade}
            className="relative z-10 flex items-center justify-between gap-4"
          >
            <div className="flex flex-wrap gap-x-3 gap-y-1">
              {project.tags.map((tag, i) => (
                <span
                  key={tag}
                  className="
                    font-mono text-[0.55rem] tracking-[0.2em] text-foreground/30 uppercase
                    transition-colors
                    group-hover:text-foreground/50
                  "
                >
                  {tag}
                  {i < project.tags.length - 1 && (
                    <span className="ml-3 text-gold/20">·</span>
                  )}
                </span>
              ))}
            </div>
            <SimpleGithubIcon
              size={16}
              className="shrink-0 text-foreground/15 transition-colors group-hover:text-gold/50"
            />
          </motion.div>
        </div>
      </a>
    </motion.article>
  );
}
