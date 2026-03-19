"use client";

import { motion } from "framer-motion";
import { ArrowRight, ExternalLink } from "lucide-react";

import { SimpleGithubIcon } from "@/components/SimpleIcons";
import { Button } from "@/components/ui/Button";

import type { Project } from "./types";

const itemVariants = {
  hidden: { opacity: 0, y: 24 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.55 } },
};

export function ProjectCard({
  project,
  isLeft,
}: {
  project: Project;
  isLeft: boolean;
}) {
  return (
    <motion.div variants={itemVariants} className="relative">
      <div className="absolute top-10 left-1/2 z-10 hidden -translate-x-1/2 md:block">
        <div className="border-gold/40 bg-background flex h-10 w-10 items-center justify-center border-2">
          <span className="font-display text-gold text-sm">
            {project.numeral}
          </span>
        </div>
      </div>

      <div
        className={`md:grid md:grid-cols-2 md:gap-16 ${
          isLeft ? "" : "md:direction-rtl"
        }`}
      >
        <div
          className={`${isLeft ? "md:pr-8" : "md:col-start-2 md:pl-8"} md:direction-ltr`}
        >
          <div className="imperial-card group h-full transition-all duration-400 hover:-translate-y-1">
            <div className="pointer-events-none absolute top-0 right-0 select-none">
              <span className="font-display text-gold/4 block text-[8rem] leading-none">
                {project.numeral}
              </span>
            </div>

            <div className="relative z-10 p-8">
              <div className="mb-5 flex items-start justify-between">
                <div className="border-gold/20 border p-2.5">
                  <SimpleGithubIcon size={22} className="text-gold" />
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  asChild
                  className="text-foreground/40 hover:bg-gold/10 hover:text-gold transition-colors"
                >
                  <a
                    href={project.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={`View ${project.name} on GitHub`}
                  >
                    <ExternalLink className="h-5 w-5" />
                  </a>
                </Button>
              </div>

              <h3 className="font-display text-foreground mb-2 text-sm tracking-[0.15em] uppercase sm:text-base">
                {project.name}
              </h3>
              <div className="gold-line mb-4 max-w-8" />

              <p className="font-body-serif text-foreground/55 mb-2 text-sm leading-relaxed italic">
                {project.highlight}
              </p>
              <p className="font-body-serif text-foreground/45 mb-6 text-sm leading-relaxed">
                {project.description}
              </p>

              <div className="mb-6 flex flex-wrap gap-2">
                {project.tags.map((tag) => (
                  <span
                    key={tag}
                    className="border-gold/20 text-foreground/50 border px-3 py-1 text-xs tracking-wider uppercase"
                  >
                    {tag}
                  </span>
                ))}
              </div>

              <Button asChild className="imperial-btn imperial-btn-fill w-full">
                <a
                  href={project.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-center gap-2"
                >
                  <SimpleGithubIcon size={18} />
                  View on GitHub
                  <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
                </a>
              </Button>
            </div>
          </div>
        </div>

        <div className="hidden md:block" />
      </div>
    </motion.div>
  );
}
