"use client";

import { motion } from "framer-motion";
import { ArrowRight } from "lucide-react";

interface CTASectionProps {
  onStartCreating: () => void;
}

export function CTASection({ onStartCreating }: Readonly<CTASectionProps>) {
  return (
    <section className="relative overflow-x-clip px-6 py-24 sm:px-12 lg:py-32">
      {/* Atmospheric glow */}
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute top-1/2 left-1/2 h-64 w-120 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[hsl(var(--gold)/0.04)] blur-[120px]" />
      </div>

      {/* Subtle dot pattern */}
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.02]"
        style={{
          backgroundImage:
            "radial-gradient(circle, hsl(var(--foreground)) 0.5px, transparent 0.5px)",
          backgroundSize: "20px 20px",
        }}
      />

      <motion.div
        initial={{ opacity: 0, y: 30 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: "-60px" }}
        transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
        className="relative z-10 mx-auto max-w-2xl text-center"
      >
        {/* Ornamental divider */}
        <div className="mb-10 flex items-center justify-center gap-4">
          <div className="gold-line max-w-16 flex-1" />
          <div className="h-1.5 w-1.5 rotate-45 border border-[hsl(var(--gold)/0.4)]" />
          <div className="gold-line max-w-16 flex-1" />
        </div>

        <p className="text-gold mb-4 text-[0.6rem] tracking-[0.5em] uppercase">
          Your turn
        </p>

        <h2 className="font-display text-foreground mb-5 text-2xl tracking-wide sm:text-3xl md:text-4xl">
          Build <span className="text-gold">Yours</span>
        </h2>

        <p className="font-body-serif text-foreground/35 mx-auto mb-10 max-w-md text-sm leading-relaxed sm:text-base">
          Pull your stats straight from AniList and turn them into shareable
          cards — no cost, no wait, and you control every detail.
        </p>

        <button
          onClick={onStartCreating}
          className="imperial-btn imperial-btn-fill group inline-flex items-center"
        >
          Start Building
          <ArrowRight className="ml-2 h-4 w-4 transition-transform duration-300 group-hover:translate-x-1" />
        </button>
      </motion.div>
    </section>
  );
}
