"use client";

import { motion } from "framer-motion";
import { ArrowRight } from "lucide-react";

interface CTASectionProps {
  onStartCreating: () => void;
}

export function CTASection({ onStartCreating }: Readonly<CTASectionProps>) {
  return (
    <section className="relative overflow-x-clip px-6 py-20 text-center sm:px-12 lg:py-24">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute top-0 left-1/2 h-48 w-150 -translate-x-1/2 rounded-full bg-[hsl(var(--gold)/0.04)] blur-[100px]" />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: "-60px" }}
        transition={{ duration: 0.5 }}
        className="relative z-10"
      >
        <div className="gold-line mx-auto mb-10 max-w-20" />

        <h2 className="font-display text-foreground mb-4 text-2xl tracking-wide sm:text-3xl">
          CREATE <span className="text-gold">YOUR OWN</span>
        </h2>

        <p className="font-body-serif text-foreground/40 mx-auto mb-8 max-w-md text-sm leading-relaxed sm:text-base">
          Generate personalised stat cards from your AniList profile — free,
          instant, and fully customisable.
        </p>

        <button
          onClick={onStartCreating}
          className="imperial-btn imperial-btn-fill group inline-flex items-center"
        >
          Get Started
          <ArrowRight className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-1" />
        </button>
      </motion.div>
    </section>
  );
}
