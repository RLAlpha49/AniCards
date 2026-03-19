"use client";

import { motion } from "framer-motion";
import { ArrowRight } from "lucide-react";

interface CTASectionProps {
  onStartCreating: () => void;
}

export function CTASection({ onStartCreating }: Readonly<CTASectionProps>) {
  return (
    <section className="relative overflow-x-clip px-6 py-20 text-center sm:px-12 lg:py-28">
      <div className="pointer-events-none absolute inset-0">
        <div className="bg-gold/5 absolute -top-32 left-1/2 h-64 w-200 -translate-x-1/2 rounded-full blur-[140px]" />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 24 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: "-80px" }}
        transition={{ duration: 0.6 }}
        className="relative z-10"
      >
        <div className="gold-ornament mb-8">
          <span className="text-gold text-base">❖</span>
        </div>

        <h2 className="font-display text-foreground mb-4 text-2xl tracking-wide sm:text-3xl md:text-4xl">
          READY TO CREATE <span className="text-gold">YOUR OWN?</span>
        </h2>

        <p className="font-body-serif text-foreground/45 mx-auto mb-10 max-w-md text-sm leading-relaxed sm:text-base">
          Generate personalised cards from your AniList profile — free, instant,
          and fully customisable.
        </p>

        <button
          onClick={onStartCreating}
          className="imperial-btn imperial-btn-fill group inline-flex items-center"
        >
          Create Your Cards
          <ArrowRight className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-1" />
        </button>
      </motion.div>
    </section>
  );
}
