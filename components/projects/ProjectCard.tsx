"use client";

import { motion } from "framer-motion";
import { ArrowUpRight } from "lucide-react";

import { SimpleGithubIcon } from "@/components/SimpleIcons";
import { Button } from "@/components/ui/Button";

import type { Project } from "./types";

const cardVariants = {
  hidden: { opacity: 0, y: 30 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.6, ease: [0.22, 1, 0.36, 1] as const },
  },
};

export function ProjectCard({ project }: Readonly<{ project: Project }>) {
  return (
    <motion.div variants={cardVariants}>
      <div className="imperial-card group relative overflow-hidden transition-all duration-400 hover:-translate-y-1">
        {/* Large watermark numeral */}
        <div className="pointer-events-none absolute -top-4 -right-2 select-none">
          <span className="font-display block text-[10rem] leading-none text-[hsl(var(--gold)/0.04)]">
            {project.numeral}
          </span>
        </div>

        <div className="relative z-10">
          {/* Header: catalog number + external link */}
          <div className="mb-6 flex items-start justify-between">
            <div className="flex items-center gap-3">
              <div className="border-gold/20 border p-2.5">
                <SimpleGithubIcon size={20} className="text-gold" />
              </div>
              <span className="font-display text-gold/40 text-sm">
                № {project.numeral}
              </span>
            </div>
            <a
              href={project.url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-foreground/30 hover:text-gold transition-colors"
              aria-label={`View ${project.name} on GitHub`}
            >
              <ArrowUpRight className="h-5 w-5" />
            </a>
          </div>

          {/* Title */}
          <h3 className="font-display text-foreground mb-3 text-base tracking-[0.12em] uppercase sm:text-lg">
            {project.name}
          </h3>

          <div className="gold-line mb-5 max-w-10" />

          {/* Highlight as emphasized text */}
          <p className="font-body-serif text-foreground/60 mb-3 text-sm leading-relaxed italic">
            {project.highlight}
          </p>

          {/* Description */}
          <p className="font-body-serif text-foreground/40 mb-8 text-sm leading-relaxed">
            {project.description}
          </p>

          {/* Tags */}
          <div className="mb-8 flex flex-wrap gap-2">
            {project.tags.map((tag) => (
              <span
                key={tag}
                className="border-gold/15 text-foreground/40 border px-3 py-1 text-xs tracking-wider uppercase"
              >
                {tag}
              </span>
            ))}
          </div>

          {/* CTA */}
          <Button asChild className="imperial-btn imperial-btn-fill w-full">
            <a
              href={project.url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-2"
            >
              <SimpleGithubIcon size={18} />
              View on GitHub
              <ArrowUpRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
            </a>
          </Button>
        </div>
      </div>
    </motion.div>
  );
}
