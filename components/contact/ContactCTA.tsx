"use client";

import { motion } from "framer-motion";
import { ArrowUpRight, Send } from "lucide-react";
import Link from "next/link";

import {
  safeTrack,
  trackExternalLinkClick,
} from "@/lib/utils/google-analytics";

export function ContactCTA() {
  return (
    <section className="relative px-6 py-16 sm:px-12 md:py-24">
      {/* Background glow */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute top-1/2 left-1/2 h-96 w-96 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[hsl(var(--gold)/0.04)] blur-[100px]" />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 24 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.6 }}
        className="relative z-10 mx-auto max-w-3xl text-center"
      >
        <div className="gold-ornament mb-6">
          <span className="text-gold text-base">❖</span>
        </div>

        <h2 className="font-display text-gold mb-3 text-3xl sm:text-4xl">
          DIRECT LINE
        </h2>
        <div className="gold-line mx-auto mb-6 max-w-10" />
        <p className="font-body-serif text-foreground/50 mx-auto mb-10 max-w-md text-base leading-relaxed">
          For anything that warrants a longer conversation &mdash; detailed
          questions, collaboration proposals, or creative ideas.
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
          <ArrowUpRight className="ml-2.5 h-4 w-4 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
        </Link>

        <p className="text-foreground/30 mt-6 text-xs tracking-wide">
          Typically responds within 24 &ndash; 48 hours
        </p>
      </motion.div>
    </section>
  );
}
