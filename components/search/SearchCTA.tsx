"use client";

import { motion } from "framer-motion";
import { ArrowRight } from "lucide-react";
import Link from "next/link";

import { fadeIn, fadeUp, sectionReveal, VIEWPORT_ONCE } from "@/lib/animations";

export function SearchCTA() {
  return (
    <section className="border-gold/20 border-y-2 px-6 py-20 text-center sm:px-12 md:py-24">
      <motion.div
        variants={sectionReveal}
        initial="hidden"
        whileInView="visible"
        viewport={VIEWPORT_ONCE}
        className="mx-auto max-w-2xl"
      >
        <motion.div variants={fadeIn} className="gold-ornament mb-8">
          <span className="text-gold text-lg">❖</span>
        </motion.div>

        <motion.h2
          variants={fadeUp}
          className="font-display text-gold mb-5 text-3xl tracking-widest sm:text-4xl md:text-5xl"
        >
          EXPLORE THE COLLECTION
        </motion.h2>
        <motion.p
          variants={fadeUp}
          className="font-body-serif text-foreground/40 mb-10 text-sm leading-relaxed sm:text-base"
        >
          Curious what&apos;s possible?
        </motion.p>

        <motion.div
          variants={fadeUp}
          whileHover={{ scale: 1.05, transition: { duration: 0.25 } }}
          whileTap={{ scale: 0.97 }}
          className="inline-block"
        >
          <Link href="/examples" className="imperial-btn imperial-btn-fill">
            <span className="inline-flex items-center gap-2">
              Browse Examples
              <ArrowRight className="h-4 w-4" />
            </span>
          </Link>
        </motion.div>
      </motion.div>
    </section>
  );
}
