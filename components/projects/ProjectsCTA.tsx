"use client";

import { motion } from "framer-motion";
import { ArrowRight, GitFork } from "lucide-react";
import Link from "next/link";

import { SimpleGithubIcon } from "@/components/SimpleIcons";
import { Button } from "@/components/ui/Button";

export function ProjectsCTA() {
  return (
    <section className="border-gold/20 border-y-2 px-6 py-16 text-center sm:px-12 md:py-20">
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute top-1/2 left-1/2 h-96 w-96 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[hsl(var(--gold)/0.04)] blur-[100px]" />
      </div>

      <div className="relative z-10">
        <div className="gold-ornament mb-6">
          <span className="text-gold text-base">❖</span>
        </div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="space-y-6"
        >
          <h2 className="font-display text-gold mb-4 text-3xl sm:text-4xl">
            JOIN THE EFFORT
          </h2>
          <div className="gold-line mx-auto mb-3 max-w-10" />
          <p className="font-body-serif text-foreground/40 mx-auto max-w-md text-sm leading-relaxed sm:text-base">
            Every star, issue, and pull request makes these tools better for the
            entire community.
          </p>

          <div className="flex flex-col items-center justify-center gap-4 pt-4 sm:flex-row">
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
