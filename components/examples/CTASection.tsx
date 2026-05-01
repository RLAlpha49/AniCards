"use client";

import { motion } from "framer-motion";

import { SearchLaunchChooser } from "@/components/search/SearchCapabilities";
import type { SearchLaunchDiscoveryContextInput } from "@/lib/user-page-settings-templates";

interface CTASectionProps {
  discoveryContext?: SearchLaunchDiscoveryContextInput | null;
}

export function CTASection({ discoveryContext }: Readonly<CTASectionProps>) {
  return (
    <section className="relative overflow-x-clip px-6 py-24 sm:px-12 lg:py-32">
      {/* Atmospheric glow */}
      <div className="pointer-events-none absolute inset-0">
        <div className="
          absolute top-1/2 left-1/2 h-64 w-120 -translate-1/2 rounded-full
          bg-[hsl(var(--gold)/0.04)] blur-[120px]
        " />
      </div>

      {/* Subtle dot pattern */}
      <div className="pointer-events-none absolute inset-0 examples-dot-pattern opacity-[0.02]" />

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
          <div className="size-1.5 rotate-45 border border-[hsl(var(--gold)/0.4)]" />
          <div className="gold-line max-w-16 flex-1" />
        </div>

        <p className="mb-4 text-[0.6rem] tracking-[0.5em] text-gold uppercase">
          Your turn
        </p>

        <h2 className="
          mb-5 font-display text-2xl tracking-wide text-foreground
          sm:text-3xl
          md:text-4xl
        ">
          Build <span className="text-gold">Yours</span>
        </h2>

        <p className="
          mx-auto mb-10 max-w-md font-body-serif text-sm/relaxed text-foreground/35
          sm:text-base
        ">
          Pull your stats straight from AniList and turn them into shareable
          cards — no cost, no wait, and you control every detail.
        </p>

        <div className="flex justify-center">
          <SearchLaunchChooser
            align="center"
            discoveryContext={discoveryContext}
            fallbackLabel="Start Building"
          />
        </div>
      </motion.div>
    </section>
  );
}
