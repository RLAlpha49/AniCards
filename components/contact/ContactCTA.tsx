"use client";

import { motion } from "framer-motion";
import { Send } from "lucide-react";
import Link from "next/link";

import {
  safeTrack,
  trackExternalLinkClick,
} from "@/lib/utils/google-analytics";

export function ContactCTA() {
  return (
    <section className="relative px-6 py-20 sm:px-12 md:py-32">
      {/* Background glow */}
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute bottom-0 left-1/2 h-100 w-150 -translate-x-1/2 rounded-full bg-[hsl(var(--gold)/0.04)] blur-[120px]" />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 24 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
        className="relative z-10 mx-auto max-w-2xl text-center"
      >
        {/* Top ornament */}
        <div className="mb-10 flex items-center gap-4">
          <div className="h-px flex-1 bg-linear-to-r from-transparent to-[hsl(var(--gold)/0.15)]" />
          <Send className="text-gold/30 h-4 w-4" strokeWidth={1.5} />
          <div className="h-px flex-1 bg-linear-to-l from-transparent to-[hsl(var(--gold)/0.15)]" />
        </div>

        <h2 className="font-display text-foreground mb-3 text-3xl font-bold sm:text-4xl">
          DIRECT LINE
        </h2>
        <p className="font-body-serif text-foreground/35 mb-10 text-base leading-relaxed">
          For anything that warrants a longer conversation.
        </p>

        <Link
          href="mailto:contact@alpha49.com"
          onClick={() =>
            safeTrack(() => trackExternalLinkClick("email", "contact_page"))
          }
          className="imperial-btn imperial-btn-fill group inline-flex items-center"
        >
          <Send className="mr-2.5 h-4 w-4" />
          contact@alpha49.com
        </Link>

        <p
          className="text-foreground/20 mt-8 text-[10px] tracking-[0.3em] uppercase"
          style={{ fontFamily: "var(--font-geist-mono), monospace" }}
        >
          Typically responds within 24–48 hours
        </p>
      </motion.div>
    </section>
  );
}
