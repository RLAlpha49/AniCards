"use client";

import { motion } from "framer-motion";
import { ArrowRight } from "lucide-react";
import Link from "next/link";

export function SearchCTA() {
  return (
    <section className="border-gold/20 border-y-2 px-6 py-20 text-center sm:px-12 md:py-24">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.6 }}
        className="mx-auto max-w-2xl"
      >
        <div className="gold-ornament mb-8">
          <span className="text-gold text-lg">❖</span>
        </div>

        <h2 className="font-display text-gold mb-5 text-3xl tracking-widest sm:text-4xl md:text-5xl">
          EXPLORE THE COLLECTION
        </h2>
        <p className="font-body-serif text-foreground/40 mb-10 text-sm leading-relaxed sm:text-base">
          Curious what&apos;s possible?
        </p>

        <Link href="/examples" className="imperial-btn imperial-btn-fill">
          <span className="inline-flex items-center gap-2">
            Browse Examples
            <ArrowRight className="h-4 w-4" />
          </span>
        </Link>
      </motion.div>
    </section>
  );
}
