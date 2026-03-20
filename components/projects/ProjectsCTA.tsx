"use client";

import { motion } from "framer-motion";
import { ArrowRight, GitFork } from "lucide-react";
import Link from "next/link";

import { SimpleGithubIcon } from "@/components/SimpleIcons";
import { Button } from "@/components/ui/Button";

export function ProjectsCTA() {
  return (
    <section className="relative px-6 py-20 sm:px-12 md:py-28">
      {/* Atmospheric glow */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute top-1/2 left-1/2 h-96 w-96 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[hsl(var(--gold)/0.05)] blur-[120px]" />
      </div>

      <div className="relative z-10 mx-auto max-w-3xl text-center">
        <div className="gold-ornament mb-8">
          <span className="text-gold text-base">❖</span>
        </div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="space-y-6"
        >
          <h2 className="font-display text-foreground text-3xl sm:text-4xl md:text-5xl">
            JOIN THE <span className="text-gold">EFFORT</span>
          </h2>

          <div className="gold-line mx-auto max-w-12" />

          <p className="font-body-serif text-foreground/40 mx-auto max-w-md text-sm leading-relaxed sm:text-base">
            Every star, issue, and pull request makes these tools better for the
            entire community.
          </p>

          <div className="flex flex-col items-center justify-center gap-4 pt-6 sm:flex-row">
            <Button asChild className="imperial-btn imperial-btn-fill">
              <a
                href="https://github.com/RLAlpha49"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2"
              >
                <SimpleGithubIcon size={20} />
                Visit My GitHub
                <ArrowRight className="h-5 w-5 transition-transform group-hover:translate-x-1" />
              </a>
            </Button>

            <Button asChild className="imperial-btn imperial-btn-ghost">
              <Link href="/" className="flex items-center gap-2">
                <GitFork className="h-4 w-4" />
                Back to Home
              </Link>
            </Button>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
